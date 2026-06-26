// AI 师傅服务：根据当前激活场景动态切换师傅人设
// 通过 templates/index.ts 注册中心读取 SceneCoach，新增场景无需改这里
//
// 当前内置：
// - 催化裂化 (fcc) → 老张：20 年炼厂老师傅
// - 汽车焊装 (welding) → 老王：15 年焊装技师
// - 数控加工 (cnc) → 老李：20 年机修师傅（M5 加入）

import type { ChatMessage } from './deepseek';
import { chatStream, chatOnce } from './deepseek';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import type { OperationRecord, ScoreBreakdown, DrillDifficulty } from '@/types';
import { getSceneCoach } from '@/templates';

/** 根据当前场景返回对应师傅 */
function getCurrentCoach() {
  const sceneId = useUIStore.getState().activeTemplate ?? 'fcc';
  const coach = getSceneCoach(sceneId);
  // 兜底：未注册场景时回退到 FCC 老张
  if (!coach) {
    return getSceneCoach('fcc')!;
  }
  return coach;
}

export function getCoachName(): string {
  return getCurrentCoach().name;
}

export function getCoachTitle(): string {
  return getCurrentCoach().title;
}

export function getCoachGreeting(): string {
  return getCurrentCoach().greeting;
}

/**
 * 通用的"前后一致性铁律"片段 — 自动拼接到每个场景的 systemPrompt 后面
 * 解决所有场景共同的痛点：
 *   - AI 上一轮和下一轮指令互相矛盾
 *   - 学员按指示调了，AI 装作没看见再发同样指令
 *   - 故障没解决就跳到无关话题（温度→极距→分子比 乱跳）
 *   - 量化指令不连续（"调到 10" 然后又说 "调到 3"）
 */
const COHERENCE_RULES = `

【⚠️ 极重要 · 所有场景通用 · 前后一致性铁律 ⚠️】
你之前的发言会作为对话历史附在前面，回答前必须先读自己上一两轮说过什么、学员做了什么：
1. **保持方向一致**：如果你上一句让学员"调 X 参数到 Y 值"，这一轮就不能转向其他参数——故障没消除前死磕同一处方
2. **承认学员的操作**：如果学员按你说的做了（操作日志中能看到），先肯定"对，方向对"，再说"接着看 Z 参数有没有压下来"，**不要装作没看见就重发同一条指令**
3. **量化新目标 = 增量而非复读**：如果学员已调到位但参数还没回正，要说"X 已加到 12 了，再把 Y 从 3 → 3.5 试一下"——给具体数字增量，不要复读同一个数
4. **故障消除前不变话题**：一个故障没解决，**绝对不**主动跳到无关参数。如果学员在错误方向调，直接打断："停！现在是 X 的问题，不是 Y 的事"
5. **数字不前后矛盾**：上一轮说"调到 10"，下一轮就不能说"调到 3"。如果要变，必须说明原因（"看到压下来了，可以收回 3"）
6. **看 context 中的"本次故障标准处方"**：那是教练手册，按它指导，不要凭空发挥`;

function buildSystemPrompt(): string {
  return getCurrentCoach().systemPrompt + COHERENCE_RULES;
}

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
      : ui.activeTemplate === 'cnc' ? '数控加工'
      : ui.activeTemplate === 'injection' ? '注塑成型'
      : ui.activeTemplate === 'aluminum' ? '电解铝车间'
      : ui.activeTemplate === 'anode' ? '阳极振压成型'
      : ui.activeTemplate === 'baking' ? '阳极焙烧炉'
      : ui.activeTemplate === 'tbm' ? '盾构机隧道掘进（TBM）'
      : ui.activeTemplate === 'offshore' ? '海上钻井平台'
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

  // 4. 最近 8 次操作（更长视野 — 让师傅看到学员到底动了哪些参数，避免重复发同一条指令）
  const recents = drill.records.slice(-8);
  if (recents.length > 0) {
    const opLines = recents
      .map((r, i) => `${i + 1}. ${r.action}${r.isCorrect ? '（✓ 正确方向）' : '（✗ 错误/无关）'}`)
      .join('\n');
    lines.push(`## 学员最近操作（含正误判定）\n${opLines}`);
  }

  // 5. 故障的标准处方（让 AI 强制沿一条线走，不要中途换方向）
  //    使用 fault.steps（正确动作列表）+ fault.hints + fault.cause 拼出 SOP
  if (drill.currentFault) {
    const f = drill.currentFault;
    const sopLines: string[] = [];
    sopLines.push(`根因：${f.cause}`);
    const correctSteps = (f.steps ?? []).filter((s) => s.correct).sort((a, b) => a.order - b.order);
    if (correctSteps.length > 0) {
      sopLines.push('正确处置步骤（你应该围绕这些步骤指导，不要让学员去调其他无关参数）：');
      correctSteps.forEach((s, i) => sopLines.push(`${i + 1}. ${s.action}`));
    }
    if (f.hints && f.hints.length > 0) {
      sopLines.push(`关键提示：${f.hints.join('；')}`);
    }
    lines.push(`## 本次故障标准处方\n${sopLines.join('\n')}`);
  }

  return lines.join('\n\n');
}

/** 截取最近 N 条对话（user/ai）转成 ChatMessage 数组
 * 默认取 8 轮（16 条消息）— 比之前 4 轮更长，让师傅记得自己说过什么、学员做过什么
 * 解决"前后矛盾、反复发同一条指令"的问题
 */
function recentDialogue(maxTurns = 8): ChatMessage[] {
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
    { role: 'system', content: `${buildSystemPrompt()}\n\n${buildContext()}` },
    ...recentDialogue(8),
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
    `请用教练的语气说一句开场白。${stylePolicy}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
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
export async function coachClosing(breakdown: ScoreBreakdown, sceneId?: string, faultId?: string): Promise<string> {
  // 维度详情，让模型看到"各项满分多少 / 实际得多少"，避免在 D 级时夸"工况平稳"等空话
  const dimsLines = breakdown.dimensions
    .map((d) => `- ${d.label}：${d.score}/${d.max}`)
    .join('\n');

  // 查询专家经验（如果有），注入到 system prompt
  let experienceContext = '';
  if (sceneId && faultId) {
    try {
      const { experienceApi } = await import('@/services/api');
      const { experience } = await experienceApi.getByFault(sceneId, faultId);
      if (experience?.distilled) {
        const d = experience.distilled;
        const expLines: string[] = [
          `\n\n【⚠️ 老师傅真实经验（来自专家口述蒸馏）⚠️】`,
          `以下是真实老师傅处理同类故障的经验，请在讲评中引用对比：`,
        ];
        if (d.key_decisions?.length) {
          expLines.push('专家关键操作：');
          d.key_decisions.forEach(kd => {
            expLines.push(`  第${kd.step}步：${kd.action}（时机：${kd.timing}，原因：${kd.reasoning}）`);
          });
        }
        if (d.common_mistakes?.length) {
          expLines.push('新手常见错误：');
          d.common_mistakes.forEach(cm => {
            expLines.push(`  ${cm.mistake} → 正确做法：${cm.correct_alternative}`);
          });
        }
        if (d.master_insight) {
          expLines.push(`核心经验：${d.master_insight}`);
        }
        expLines.push('请在讲评中对比学生操作和专家经验，指出差异，引用专家的具体建议。');
        experienceContext = expLines.join('\n');
      }
    } catch {
      // 经验库查询失败不影响正常讲评
    }
  }

  const userPrompt =
    `【本次演练评分】\n` +
    `总分 ${breakdown.total}（${breakdown.grade} 级）\n${dimsLines}\n\n` +
    `【强项】${breakdown.highlights.length ? breakdown.highlights.join('；') : '无明显强项'}\n` +
    `【短板】${breakdown.improvements.length ? breakdown.improvements.join('；') : '无明显短板'}\n\n` +
    `请用教练的语气讲评（≤3 句、≤120 字）。要求：\n` +
    `1. 评价必须与"总分等级"一致，D/C 级不要说"完成不错"，S/A 级不要泼冷水\n` +
    `2. 至少点出最关键的一个短板（或表扬最突出的一个强项）\n` +
    `3. 如果有专家经验，对比学生操作和专家做法，引用专家的具体建议\n` +
    `4. 用第二人称"你"或祈使句，不要客套话`;

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() + experienceContext },
    { role: 'user', content: userPrompt },
  ];

  try {
    const text = await chatOnce(messages, { temperature: 0.5, maxTokens: 300 });
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
    { role: 'system', content: `${buildSystemPrompt()}\n\n${ctx}` },
    {
      role: 'user',
      content:
        `学员刚连续做错两步：\n${wrongLines}\n\n` +
        `请用教练的语气主动点拨一句（≤2 句），告诉他下一步该看哪个参数 / 调哪个方向，不要骂人。`,
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


