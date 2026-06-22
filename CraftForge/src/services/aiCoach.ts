// AI 师傅服务：把 DeepSeek 大模型包装成"老张师傅"角色
// 提供 askCoach（流式问答）、coachOpening（演练开场白）、
// coachClosing（演练讲评结语）、coachIntervene（连续错误点拨）

import type { ChatMessage } from './deepseek';
import { chatStream, chatOnce } from './deepseek';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import type { OperationRecord, ScoreBreakdown, DrillDifficulty } from '@/types';

// AI 师傅人设：老张，FCC 老师傅
export const SYSTEM_PROMPT = `你是匠魂实训引擎中的 AI 师傅老张，拥有 20 年炼厂催化裂化（FCC）实操经验。说话风格：
- 简练、贴近现场、用工艺术语（如"再生温度""塞阀开度""主风量"）
- 每次回答 ≤ 3 句话
- 学员在演练时给针对性指导，不要客套话
- 不知道答案时直接说"这个我也得看看运行参数再说"`;

const DIFFICULTY_LABEL: Record<DrillDifficulty, string> = {
  novice: '新手',
  standard: '进阶',
  expert: '专家',
};

/**
 * 拼接当前演练上下文（markdown），让师傅"看见"学员所处工况
 * - 当前模板（uiStore.activeTemplate）
 * - 当前演练状态（drillStore：isRunning, currentFault, difficulty）
 * - 当前关键设备参数（equipmentStore：仅取异常或本次故障涉及的设备）
 * - 学员最近 3 次操作（drillStore.records 末尾 3 条）
 */
export function buildContext(): string {
  const ui = useUIStore.getState();
  const drill = useDrillStore.getState();
  const equipmentState = useEquipmentStore.getState();

  const lines: string[] = [];

  // 1. 当前模板
  const tplName =
    ui.activeTemplate === 'fcc' ? '催化裂化（FCC）'
      : ui.activeTemplate === 'welding' ? '汽车焊装'
      : ui.activeTemplate === 'mixed' ? '混合产线'
      : '未选择';
  lines.push(`## 当前模板\n${tplName}`);

  // 2. 演练状态
  if (drill.isRunning && drill.currentFault) {
    const f = drill.currentFault;
    const diff = DIFFICULTY_LABEL[drill.activeDifficulty] ?? '进阶';
    lines.push(`## 演练状态\n- 进行中（难度：${diff}）\n- 故障：${f.name}（${f.id}）\n- 描述：${f.description}`);
  } else {
    lines.push('## 演练状态\n未进行演练');
  }

  // 3. 关键设备参数：异常项 + 本次故障涉及的设备
  const focusEqIds = new Set<string>();
  if (drill.currentFault) {
    drill.currentFault.affectedEquipments.forEach((id) => focusEqIds.add(id));
    drill.currentFault.symptoms.forEach((s) => focusEqIds.add(s.equipmentId));
  }
  const paramLines: string[] = [];
  equipmentState.equipments.forEach((eq) => {
    const isFocus = focusEqIds.has(eq.id);
    const isAbnormal = eq.status !== 'normal';
    if (!isFocus && !isAbnormal) return;
    eq.parameters.forEach((p) => {
      const off = p.value < p.normalMin || p.value > p.normalMax;
      // 仅展示异常参数，避免上下文过长
      if (!off && !isFocus) return;
      if (!off && isFocus && eq.status === 'normal') return;
      const flag = off ? '⚠️' : '·';
      paramLines.push(`- ${flag} ${eq.name}·${p.name}: ${p.value}${p.unit}（正常 ${p.normalMin}~${p.normalMax}）`);
    });
  });
  if (paramLines.length > 0) {
    lines.push(`## 关键参数\n${paramLines.join('\n')}`);
  }

  // 4. 最近 3 次操作
  const recents = drill.records.slice(-3);
  if (recents.length > 0) {
    const opLines = recents
      .map((r, i) => `${i + 1}. ${r.action}${r.isCorrect ? '（正确）' : '（错误/无关）'}`)
      .join('\n');
    lines.push(`## 学员最近操作\n${opLines}`);
  }

  return lines.join('\n\n');
}

/** 截取最近 N 条对话（user/ai）转成 ChatMessage 数组 */
function recentDialogue(maxTurns = 4): ChatMessage[] {
  const messages = useAIStore.getState().messages;
  const tail = messages.slice(-maxTurns * 2);
  return tail
    .filter((m) => m.content && m.content.trim().length > 0)
    .map<ChatMessage>((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));
}

/**
 * 学员主动提问：流式回答
 * 失败时降级：本地 KB 命中 -> 返回 KB，否则返回固定降级语
 */
export async function* askCoach(
  userQuestion: string,
  opts?: { signal?: AbortSignal },
): AsyncGenerator<string, void, unknown> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${buildContext()}` },
    ...recentDialogue(3),
    { role: 'user', content: userQuestion },
  ];

  try {
    for await (const chunk of chatStream(messages, { temperature: 0.7, maxTokens: 400, signal: opts?.signal })) {
      yield chunk;
    }
  } catch (err: unknown) {
    console.warn('[aiCoach] askCoach 失败，启用降级', err instanceof Error ? err.message : err);
    // 降级：本地知识库
    const kb = useAIStore.getState().findAnswer(userQuestion);
    if (kb) {
      yield kb.answer;
      return;
    }
    yield '这个我也得看看运行参数再说，你先把异常参数面板拉出来对一下。';
  }
}

/**
 * 演练开场白：按难度生成
 * - 新手：偏完整提示（先看哪个参数）
 * - 进阶：精炼提点（提一句方向）
 * - 专家：仅一句话压场
 */
export async function coachOpening(scenario: {
  faultName: string;
  difficulty: DrillDifficulty;
  symptoms: string[];
}): Promise<string> {
  const diffLabel = DIFFICULTY_LABEL[scenario.difficulty] ?? '进阶';
  const symLine = scenario.symptoms.slice(0, 4).join('；');

  let stylePolicy: string;
  if (scenario.difficulty === 'novice') {
    stylePolicy = '给学员一句"重点先看哪个参数"的明确指引，2~3 句话。';
  } else if (scenario.difficulty === 'standard') {
    stylePolicy = '点一下排查方向，但不要直接说处置步骤，1~2 句话。';
  } else {
    stylePolicy = '只压一句场，让学员自行判断，不要透露任何线索，1 句话。';
  }

  const userPrompt =
    `演练开始（难度：${diffLabel}）。\n` +
    `故障：${scenario.faultName}\n` +
    `主要现象：${symLine}\n\n` +
    `请用老张师傅的语气说一句开场白。${stylePolicy}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  try {
    const text = await chatOnce(messages, { temperature: 0.6, maxTokens: 200 });
    return text.trim();
  } catch (err: unknown) {
    console.warn('[aiCoach] coachOpening 失败', err instanceof Error ? err.message : err);
    // 降级：固定文本
    if (scenario.difficulty === 'novice') return '小伙子，先盯一下异常参数，按建议步骤一步步来，别慌。';
    if (scenario.difficulty === 'standard') return '现象都给到了，思路从根因往回推，操作要稳。';
    return '工况不对，自己看参数。';
  }
}

/** 演练讲评：基于 breakdown 生成一句话点评 */
export async function coachClosing(breakdown: ScoreBreakdown): Promise<string> {
  // 维度详情，让模型看到"各项满分多少 / 实际得多少"，避免在 D 级时夸"工况平稳"等空话
  const dimsLines = breakdown.dimensions
    .map((d) => `- ${d.label}：${d.score}/${d.max}`)
    .join('\n');

  const userPrompt =
    `【本次演练评分】\n` +
    `总分 ${breakdown.total}（${breakdown.grade} 级）\n${dimsLines}\n\n` +
    `【强项】${breakdown.highlights.length ? breakdown.highlights.join('；') : '无明显强项'}\n` +
    `【短板】${breakdown.improvements.length ? breakdown.improvements.join('；') : '无明显短板'}\n\n` +
    `请用老张师傅的语气讲评（≤2 句、≤80 字）。要求：\n` +
    `1. 评价必须与"总分等级"一致，D/C 级不要说"完成不错"，S/A 级不要泼冷水\n` +
    `2. 至少点出最关键的一个短板（或表扬最突出的一个强项）\n` +
    `3. 用第二人称"你"或祈使句，不要客套话`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  try {
    const text = await chatOnce(messages, { temperature: 0.5, maxTokens: 200 });
    return text.trim();
  } catch (err: unknown) {
    console.warn('[aiCoach] coachClosing 失败', err instanceof Error ? err.message : err);
    return breakdown.coachComment || '本次完成了，继续多练几把找手感。';
  }
}

/** 连续错误时主动点拨：提取最近错误操作做提示 */
export async function coachIntervene(records: OperationRecord[]): Promise<string> {
  const wrongTail = records.filter((r) => !r.isCorrect).slice(-2);
  const wrongLines = wrongTail.map((r, i) => `${i + 1}. ${r.action}`).join('\n');
  const ctx = buildContext();

  const messages: ChatMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${ctx}` },
    {
      role: 'user',
      content:
        `学员刚连续做错两步：\n${wrongLines}\n\n` +
        `请用老张师傅的语气主动点拨一句（≤2 句），告诉他下一步该看哪个参数 / 调哪个方向，不要骂人。`,
    },
  ];

  try {
    const text = await chatOnce(messages, { temperature: 0.6, maxTokens: 160 });
    return text.trim();
  } catch (err: unknown) {
    console.warn('[aiCoach] coachIntervene 失败', err instanceof Error ? err.message : err);
    return '停一下，先看异常参数的方向：症状偏高就调小，偏低就调大，先把方向走对。';
  }
}
