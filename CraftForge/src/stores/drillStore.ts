import { create } from 'zustand';
import type { Fault, DrillRecord, OperationRecord, ScoreBreakdown, ScoreDimension, DrillDifficulty } from '@/types';
import { getScenePack } from '@/templates';
import { useEquipmentStore } from './equipmentStore';
import { useAIStore } from './aiStore';
import { useUIStore } from './uiStore';
import { useAuthStore } from './authStore';
import { drillApi } from '@/services/api';
import { coachClosing, coachIntervene } from '@/services/aiCoach';
import { soundService } from '@/services/soundService';

// 演练点拨节流：coachIntervene 正在生成或语音未播完时，不再触发新一次
// 用模块级标志位而非 zustand state，避免触发 UI 重渲
let intervenePending = false;
// 最近一次成功触发点拨的时间戳，用于"冷却时间"窗口（最近 N 秒内不再触发）
let lastInterveneAt = 0;
const INTERVENE_COOLDOWN_MS = 8000;

/** 当前 UI 是否允许播放音效（音效开关 + 用户已交互） */
function soundOn(): boolean {
  return useUIStore.getState().soundEnabled;
}

// 难度配置：错误扣分系数 / 基础工况分倍率 / 总分上限 / 中文名
// 新手：错误轻扣，基础分不放大，分数封顶 80（保留 A 级，避免简单模式刷高分）
// 进阶：和原模型一致
// 专家：错误重扣，基础工况分 ×1.2，最终再 cap 到 40
const DIFFICULTY_CONFIG: Record<DrillDifficulty, {
  label: string;            // 中文名（用于 explain 文本拼接）
  errorPenaltyPerWrong: number; // 每次错误操作扣多少分
  baseMultiplier: number;   // 基础工况分（baseRaw）放大倍数
  totalCap: number;         // 总分上限
}> = {
  novice:   { label: '新手', errorPenaltyPerWrong: 1, baseMultiplier: 1.0, totalCap: 80 },
  standard: { label: '进阶', errorPenaltyPerWrong: 2, baseMultiplier: 1.0, totalCap: 100 },
  expert:   { label: '专家', errorPenaltyPerWrong: 3, baseMultiplier: 1.2, totalCap: 100 },
};

interface DrillState {
  isRunning: boolean;
  currentFault: Fault | null;
  currentStep: number;
  records: OperationRecord[];
  score: number;
  startTime: number;
  history: DrillRecord[];
  // 标记本次演练是否被"一键平稳工况"终止 - 影响最终评分
  bypassedByStabilize: boolean;
  // 当前选择的难度（持久存在的全局状态，开始演练时锁定到 activeDifficulty）
  difficulty: DrillDifficulty;
  // 本次演练锁定的难度：startDrill 时拷贝自 difficulty，演练过程中即便用户切换 difficulty 也不影响本次评分
  activeDifficulty: DrillDifficulty;
  // 任务 7：连续错误计数；recordParameterAdjustment 内累计，达到 2 时调 coachIntervene 点拨后清零
  wrongStreak: number;

  // Actions
  setDifficulty: (d: DrillDifficulty) => void;
  startDrill: () => void;
  endDrill: () => void;
  // 标记一键平稳，并随后 endDrill；用于按钮直接调用
  bypassByStabilize: () => void;
  submitStep: (action: string, equipmentId: string) => { correct: boolean; feedback: string; nextHint?: string };
  // 演练中调参时自动调用：根据"参数是否朝 normal 方向移动"判断是否命中某个建议步骤
  recordParameterAdjustment: (
    equipmentId: string,
    paramId: string,
    paramName: string,
    oldValue: number,
    newValue: number,
  ) => void;
  // 非参数化的"操作动作"（如检查夹具/更换阳极/清理碳渣/撕开壳料）
  // 与故障 steps 比对命中即记 isCorrect=true，否则 false
  recordCustomAction: (action: string, equipmentId: string) => { correct: boolean; matched?: string };
  getCurrentHint: () => string;
  // 当前已"正确完成"的 step.action 数组（用于演练面板高亮）
  getCompletedSteps: () => string[];
  calculateScore: () => { score: number; grade: 'S' | 'A' | 'B' | 'C' | 'D' };
  // 详细讲评报告：含每个维度得分/解释/提升建议、强项/短板/师傅点评
  getScoreBreakdown: () => ScoreBreakdown;
}

// 把"参数 id"映射到对应的"建议步骤关键字"，用于自动判定调参动作命中了哪个步骤
// 每个故障的 correct steps action 文本里若包含其中任一关键字，则视为对应。
const PARAM_TO_STEP_KEYWORDS: Record<string, string[]> = {
  // FCC 场景
  reactor_temp: ['反应温度', '急冷油', '反应器'],
  regenerator_temp: ['再生温度', '再生器'],
  air_flow: ['风量', '主风', '过滤器'],
  regenerator_pressure: ['再生压力', '催化剂循环'],
  tower_top_temp: ['塔顶温度', '回流'],
  tower_top_pressure: ['塔顶压力', '吹汽'],
  catalyst_circulation: ['催化剂循环', '滑阀'],
  valve_opening: ['滑阀', '塞阀'],
  pump_flow: ['流量'],

  // 阳极振压成型场景
  paste_temp:     ['糊料温度', '糊料', '保温', '升温'],
  pitch_ratio:    ['沥青', '配比'],
  mixer_speed:    ['搅拌'],
  mold_temp:      ['模具温度', '模具'],
  mold_pre_temp:  ['模具预热', '预热', '加热'],
  heat_power:     ['加热功率', '加热站', '功率'],
  press_force:    ['振压压力', '压力', '振压'],
  press_time:     ['振压时间', '时间', '振压'],
  vib_freq:       ['振动频率', '频率', '振动'],
  vac_pressure:   ['真空', '绝压', '抽气'],
  vac_flow:       ['抽气流量', '真空', '抽气'],
  feed_weight:    ['加料量', '称量'],
  coke_ratio:     ['石油焦', '粒度', '配比'],
  fine_ratio:     ['细粒', '配比'],
  cool_speed:     ['冷却', '传送速度'],
};

export const useDrillStore = create<DrillState>((set, get) => ({
  isRunning: false,
  currentFault: null,
  currentStep: 0,
  records: [],
  score: 0,
  startTime: 0,
  history: [],
  bypassedByStabilize: false,
  difficulty: 'standard',
  activeDifficulty: 'standard',
  wrongStreak: 0,

  // 切换全局选中难度（演练运行时不允许调用，UI 层通过 disabled 兜底）
  setDifficulty: (d) => {
    if (get().isRunning) return;
    set({ difficulty: d });
  },

  startDrill: () => {
    // 根据当前激活场景选用对应故障库（直接从注册中心读）
    const activeTpl = useUIStore.getState().activeTemplate ?? 'fcc';
    const pack = getScenePack(activeTpl);
    const pool: Fault[] = pack?.faults ?? [];
    if (pool.length === 0) {
      console.warn(`[drillStore] 场景 "${activeTpl}" 无可用故障库`);
      return;
    }
    const randomFault = pool[Math.floor(Math.random() * pool.length)];
    // 重置点拨节流状态，避免上一局残留影响新局
    intervenePending = false;
    lastInterveneAt = 0;
    // 把当前 difficulty 拷贝到 activeDifficulty，本次演练全程使用这个值
    set((state) => ({
      isRunning: true,
      currentFault: randomFault,
      currentStep: 0,
      records: [],
      score: 0,
      startTime: Date.now(),
      bypassedByStabilize: false,
      activeDifficulty: state.difficulty,
      wrongStreak: 0,
    }));
    // 音效：先来一声启动音，紧接着开启工厂环境底噪，再用报警声标识故障已发生
    if (soundOn()) {
      soundService.playStartup();
      setTimeout(() => {
        if (soundOn()) soundService.playAmbient();
      }, 600);
      // 1.2s 后报警一声（中等级别），代表故障已生效
      setTimeout(() => {
        if (soundOn()) soundService.playAlarm(2);
      }, 1200);
    }
  },

  endDrill: () => {
    const { currentFault, records, startTime, activeDifficulty } = get();
    if (currentFault) {
      const result = get().calculateScore();
      // 在结束时同时生成讲评报告（依赖当前 records、参数、bypass 标记、难度）
      const breakdown = get().getScoreBreakdown();
      const record: DrillRecord = {
        id: `drill-${Date.now()}`,
        faultId: currentFault.id,
        startTime,
        endTime: Date.now(),
        steps: records,
        score: result.score,
        grade: result.grade,
        breakdown,
        difficulty: activeDifficulty,
      };
      set((state) => ({
        isRunning: false,
        history: [...state.history, record],
      }));
      // 音效：停止环境底噪，播放停机下扫音，提示演练结束
      if (soundOn()) {
        soundService.stopAmbient();
        soundService.playShutdown();
      }

      // 任务 9：演练结束后，把记录同步上报到后端（仅当用户已登录）
      // 失败降级：本地仍保留 history，控制台输出错误即可
      const authedUser = useAuthStore.getState().user;
      if (authedUser) {
        const sceneId = useUIStore.getState().activeTemplate ?? 'fcc';
        const startMs = startTime ?? record.startTime;
        const endMs = record.endTime;
        const durationSec = Math.max(0, Math.round((endMs - startMs) / 1000));
        drillApi
          .submit({
            scene_id: sceneId,
            fault_id: currentFault.id,
            fault_name: currentFault.name,
            start_time: startMs,
            end_time: endMs,
            duration_sec: durationSec,
            score: Math.round(record.score),
            grade: record.grade,
            difficulty: activeDifficulty,
            // P2+ 演练上报扩展：是否本次故障存在"正反馈发散"驱动
            // 详情页可读 breakdown.divergence_active=true 表示这是一次"自漂故障"
            score_breakdown: {
              ...breakdown,
              divergence_active: !!currentFault.divergence,
              divergence_drivers: currentFault.divergence?.drivers ?? [],
            },
            operations: records,
          })
          .then((resp) => {
            if (resp.new_achievements && resp.new_achievements.length > 0) {
              // 简单弹窗提示新解锁的成就（D10 会替换为更精致的 toast）
              console.info('[drillStore] 新解锁成就:', resp.new_achievements);
              try {
                const text = `🎉 解锁新成就：${resp.new_achievements.length} 项`;
                window.dispatchEvent(new CustomEvent('drill:achievement', { detail: resp.new_achievements }));
                // 兜底通知：用 AI 消息（type='ai'）走"老师"频道
                useAIStore.getState().sendMessage(text, 'ai');
              } catch {
                /* ignore */
              }
            }
          })
          .catch((err) => {
            console.warn('[drillStore] 上报演练记录失败', err);
          });
      }

      // 任务 6：异步通过大模型生成"师傅讲评"，流式推到右侧消息面板
      // 失败降级：使用 breakdown.coachComment 作为兜底文本
      // 不阻塞 endDrill 主流程
      const ai = useAIStore.getState();
      const placeholderId = `msg-coach-closing-${Date.now()}`;
      ai.sendMessage('', 'ai');
      // 把刚发的空 ai 消息 id 取出（messages 数组末尾），改写其 id 以便流式 append
      // 因 sendMessage 自动生成随机 id，我们用 streamMessage 必须知道 id - 这里直接拿最末一条
      const lastMsg = useAIStore.getState().messages.slice(-1)[0];
      const targetId = lastMsg?.id ?? placeholderId;

      coachClosing(breakdown)
        .then((text) => {
          const finalText = text?.trim() || breakdown.coachComment || '本次演练已结束。';
          // 一次性 set（coachClosing 是 chatOnce），借用 streamMessage 把全文写入占位
          ai.streamMessage(targetId, finalText);
          ai.flushStream(targetId);
          // 触发 TTS 朗读讲评
          ai.requestSpeak(finalText);
        })
        .catch((err) => {
          console.warn('[drillStore] coachClosing 失败，使用兜底点评', err instanceof Error ? err.message : err);
          ai.streamMessage(targetId, breakdown.coachComment || '本次演练已结束。');
          ai.flushStream(targetId);
          ai.requestSpeak(breakdown.coachComment || '本次演练已结束。');
        });
    }
  },

  bypassByStabilize: () => {
    // 写入一条"工况复位"操作记录（isCorrect=false），让"操作命中/准确率"指标真实反映"用户绕过演练"
    const bypassRecord: OperationRecord = {
      timestamp: Date.now(),
      action: '一键平稳工况（跳过逐步处置）',
      targetEquipment: '',
      isCorrect: false,
      aiFeedback: '',
    };
    set((state) => ({
      bypassedByStabilize: true,
      records: [...state.records, bypassRecord],
    }));
    get().endDrill();
  },

  submitStep: (action, equipmentId) => {
    const { currentFault, currentStep } = get();
    if (!currentFault) return { correct: false, feedback: '演练未开始' };

    const correctSteps = currentFault.steps.filter((s) => s.correct);
    const isCorrect = correctSteps.some((s) =>
      action.includes(s.action) || s.action.includes(action),
    );

    const record: OperationRecord = {
      timestamp: Date.now(),
      action,
      targetEquipment: equipmentId,
      isCorrect,
      aiFeedback: '',
    };

    set((state) => ({
      records: [...state.records, record],
      currentStep: state.currentStep + 1,
    }));

    if (isCorrect) {
      const nextCorrectStep = correctSteps[currentStep + 1];
      return {
        correct: true,
        feedback: '操作正确！',
        nextHint: nextCorrectStep ? `下一步建议：${nextCorrectStep.action}` : '所有步骤已完成！',
      };
    }
    const hint = currentFault.hints[Math.min(currentStep, currentFault.hints.length - 1)];
    return {
      correct: false,
      feedback: `操作不太对。提示：${hint}`,
    };
  },

  // 自动把"参数调整"翻译为演练步骤提交
  // 判定规则：
  // 1) 该参数关联了 currentFault 的某个症状（在 symptoms 内）
  // 2) 调整方向朝 normal 区间靠拢（异常 up 时新值更小，异常 down 时新值更大）
  // 3) action 文本里至少包含一个 PARAM_TO_STEP_KEYWORDS[paramId] 的关键字
  // 满足以上即视作"做对了一步"，否则记一个错误操作。
  recordParameterAdjustment: (equipmentId, paramId, paramName, oldValue, newValue) => {
    const { currentFault, isRunning } = get();
    if (!isRunning || !currentFault) return;

    // 找该故障里是否有同 (设备,参数) 的症状
    const symptom = currentFault.symptoms.find(
      (s) => s.equipmentId === equipmentId && s.param === paramId,
    );

    // 该参数对应的步骤关键字（用于在 correct steps 文本中匹配）
    const keywords = PARAM_TO_STEP_KEYWORDS[paramId] ?? [paramName];
    const correctSteps = currentFault.steps.filter((s) => s.correct);
    const matchedStep = correctSteps.find((s) =>
      keywords.some((kw) => s.action.includes(kw)),
    );

    let isCorrect = false;
    let actionText: string;
    if (symptom && matchedStep) {
      // 朝 normal 方向移动才算命中
      const movedTowardNormal =
        (symptom.trend === 'up' && newValue < oldValue) ||
        (symptom.trend === 'down' && newValue > oldValue);
      isCorrect = movedTowardNormal;
      actionText = isCorrect
        ? matchedStep.action
        : `误调参数: ${paramName} ${oldValue} -> ${newValue}（方向不对）`;
    } else if (matchedStep) {
      // 设备/参数未直接进入症状，但能匹配到步骤关键字 - 视为相关操作但不一定正确
      isCorrect = true;
      actionText = matchedStep.action;
    } else {
      // 与本次故障无关的调参 - 不影响评分但记录为"无关操作"
      actionText = `调整参数: ${paramName} ${oldValue} -> ${newValue}`;
    }

    const record: OperationRecord = {
      timestamp: Date.now(),
      action: actionText,
      targetEquipment: equipmentId,
      parameterChange: { param: paramId, from: Number(oldValue), to: Number(newValue) },
      isCorrect,
      aiFeedback: '',
    };
    set((state) => ({
      records: [...state.records, record],
      currentStep: state.currentStep + 1,
      // 任务 7：维护连续错误计数（仅 isCorrect=false 时累加，做对一次清零）
      wrongStreak: isCorrect ? 0 : state.wrongStreak + 1,
    }));

    // 操作音效反馈：正确"叮"、错误"嗡"。仅在该参数关联到故障 symptom/step 时才播，
    // 避免学员"乱拖一个无关参数"也被音效骚扰
    if (soundOn() && (symptom || matchedStep)) {
      if (isCorrect) {
        soundService.playCorrect();
      } else {
        soundService.playWrong();
      }
    }

    // 任务 7：连续 2 次错误 → 调 coachIntervene 推送一句点拨，然后 wrongStreak 清零避免反复打扰
    if (!isCorrect) {
      const newStreak = get().wrongStreak;
      if (newStreak >= 2) {
        // 节流：上一次点拨还在生成中、或处于冷却时间内（避免连续拖动多个滑块时反复触发），跳过这次
        const inCooldown = Date.now() - lastInterveneAt < INTERVENE_COOLDOWN_MS;
        if (intervenePending || inCooldown) {
          set({ wrongStreak: 0 });
          return;
        }
        intervenePending = true;
        lastInterveneAt = Date.now();
        // 老张介入时给一声轻警告，提示学员"师傅要说话了"
        if (soundOn()) soundService.playAlarm(1);
        const ai = useAIStore.getState();
        // 占位空 ai 消息 + 流式 append
        ai.sendMessage('', 'ai');
        const lastMsg = useAIStore.getState().messages.slice(-1)[0];
        const targetId = lastMsg?.id;
        const recordsSnapshot = get().records;
        coachIntervene(recordsSnapshot)
          .then((text) => {
            const finalText = text?.trim() || '停一下，先看异常参数的方向：症状偏高就调小，偏低就调大。';
            if (targetId) {
              ai.streamMessage(targetId, finalText);
              ai.flushStream(targetId);
            }
            ai.requestSpeak(finalText);
          })
          .catch((err) => {
            console.warn('[drillStore] coachIntervene 失败，使用兜底点拨', err instanceof Error ? err.message : err);
            const fallback = '停一下，先看异常参数的方向：症状偏高就调小，偏低就调大。';
            if (targetId) {
              ai.streamMessage(targetId, fallback);
              ai.flushStream(targetId);
            }
            ai.requestSpeak(fallback);
          })
          .finally(() => {
            // 释放节流：API 完成即可释放（语音播完时间由 ttsService 队列接管）
            // 语音队列里这一段播完之前，并发触发的请求会走"上面 if (intervenePending)"被忽略，
            // 这里在 API 成功后就释放，让后续真正"新一批连续错"能尽快触发下一次点拨
            intervenePending = false;
          });
        // 清零，避免反复打扰
        set({ wrongStreak: 0 });
      }
    }
  },

  recordCustomAction: (action, equipmentId) => {
    const { currentFault } = get();
    let isCorrect = false;
    let matched: string | undefined;

    if (currentFault) {
      const correctSteps = currentFault.steps.filter((s) => s.correct);
      const hit = correctSteps.find(
        (s) => action.includes(s.action) || s.action.includes(action),
      );
      if (hit) {
        isCorrect = true;
        matched = hit.action;
      }
    }

    const record: OperationRecord = {
      timestamp: Date.now(),
      action,
      targetEquipment: equipmentId,
      isCorrect,
      aiFeedback: '',
    };
    set((state) => ({
      records: [...state.records, record],
      wrongStreak: isCorrect ? 0 : state.wrongStreak + 1,
    }));

    if (currentFault) {
      if (isCorrect) {
        soundService.playCorrect();
      } else {
        soundService.playWrong();
      }
    }

    return { correct: isCorrect, matched };
  },

  getCurrentHint: () => {
    const { currentFault, currentStep } = get();
    if (!currentFault) return '';
    return currentFault.hints[Math.min(currentStep, currentFault.hints.length - 1)] || '';
  },

  // 当前演练中已经"做对"的步骤 action 列表（用于 ScoreBoard 已完成态显示）
  getCompletedSteps: () => {
    const { currentFault, records } = get();
    if (!currentFault) return [];
    const correctActions = currentFault.steps.filter((s) => s.correct).map((s) => s.action);
    const done = new Set<string>();
    records.forEach((rec) => {
      if (!rec.isCorrect) return;
      correctActions.forEach((act) => {
        if (rec.action.includes(act) || act.includes(rec.action)) {
          done.add(act);
        }
      });
    });
    return Array.from(done);
  },

  // 评分模型（百分制，按难度分支调整）：
  //   基础工况分 (40)：演练结束时所有参数处于 normal 区间的比例 × 40 × baseMultiplier，最终 cap 到 40
  //                  expert 模式 baseMultiplier=1.2，让"工况整体调得好"在专家模式更值钱
  //   正确步骤分 (30)：已完成正确步骤数 / 总正确步骤数 × 30
  //   速度分    (20)：完成全部正确步骤越快得分越高，5 分钟封顶；未完成不给该项
  //   错误扣分 (-10) ：每个错误操作 -errorPenaltyPerWrong 分（novice=1, standard=2, expert=3），最多扣 10 分
  //   总分上限：novice=80（最高 A 级），standard/expert=100
  //   一键平稳工况：bypassedByStabilize=true 时只给基础工况分，其他维度封 0
  calculateScore: () => {
    const { currentFault, records, startTime, bypassedByStabilize, activeDifficulty } = get();
    if (!currentFault) return { score: 0, grade: 'D' as const };
    const cfg = DIFFICULTY_CONFIG[activeDifficulty];

    // 1. 基础工况分：从 equipmentStore 读取所有参数，看 normal 占比
    const equipments = useEquipmentStore.getState().equipments;
    let normalCount = 0;
    let totalParams = 0;
    equipments.forEach((eq) => {
      eq.parameters.forEach((p) => {
        totalParams += 1;
        if (p.value >= p.normalMin && p.value <= p.normalMax) normalCount += 1;
      });
    });
    // baseRaw 先按比例 × 40，再按难度倍率放大；最终 cap 到 40（避免超出维度满分）
    const baseRatio = totalParams > 0 ? normalCount / totalParams : 1;
    const baseScore = Math.min(40, baseRatio * 40 * cfg.baseMultiplier);

    // 一键平稳工况：直接返回基础分（最高 D），但仍受难度上限影响
    if (bypassedByStabilize) {
      const total = Math.min(cfg.totalCap, Math.round(baseScore));
      return { score: total, grade: total >= 60 ? 'C' : 'D' };
    }

    // 2. 正确步骤分
    const correctSteps = currentFault.steps.filter((s) => s.correct);
    const completed = get().getCompletedSteps();
    const stepScore = correctSteps.length > 0
      ? (completed.length / correctSteps.length) * 30
      : 30;

    // 3. 速度分：仅当所有正确步骤完成时才计算
    let speedScore = 0;
    if (completed.length >= correctSteps.length && correctSteps.length > 0) {
      const duration = (Date.now() - startTime) / 1000; // 秒
      const cap = 300; // 5 分钟
      speedScore = Math.max(0, 20 * (1 - Math.min(duration, cap) / cap));
    }

    // 4. 错误扣分（每错一次扣的分按难度系数变化）
    const wrongCount = records.filter((r) => !r.isCorrect).length;
    const penalty = Math.min(10, wrongCount * cfg.errorPenaltyPerWrong);

    // 总分先按 100 分制汇总，再按难度上限 cap
    const rawTotal = Math.round(baseScore + stepScore + speedScore - penalty);
    const total = Math.max(0, Math.min(cfg.totalCap, rawTotal));
    let grade: 'S' | 'A' | 'B' | 'C' | 'D';
    if (total >= 90) grade = 'S';
    else if (total >= 80) grade = 'A';
    else if (total >= 70) grade = 'B';
    else if (total >= 60) grade = 'C';
    else grade = 'D';
    return { score: total, grade };
  },

  // 生成完整讲评报告：每个维度得分明细 + 强项/短板 + AI 师傅点评
  // 学员可据此明确知道"分数怎么来的"以及"下一步如何提升"
  getScoreBreakdown: () => {
    const { currentFault, records, startTime, bypassedByStabilize, activeDifficulty } = get();
    const fallback: ScoreBreakdown = {
      total: 0,
      grade: 'D',
      bypassed: false,
      dimensions: [],
      highlights: [],
      improvements: ['暂无演练数据'],
      coachComment: '请先开始一次故障演练。',
    };
    if (!currentFault) return fallback;

    const cfg = DIFFICULTY_CONFIG[activeDifficulty];
    // 难度后缀：用于在每个维度的 explain 文本末尾追加（{难度}模式）标识
    const diffSuffix = `（${cfg.label}模式）`;

    // 重新计算各维度（保持与 calculateScore 一致），同时生成解释文本
    const equipments = useEquipmentStore.getState().equipments;
    let normalCount = 0;
    let totalParams = 0;
    const abnormalParams: string[] = [];
    equipments.forEach((eq) => {
      eq.parameters.forEach((p) => {
        totalParams += 1;
        const inNormal = p.value >= p.normalMin && p.value <= p.normalMax;
        if (inNormal) {
          normalCount += 1;
        } else {
          abnormalParams.push(`${eq.name}·${p.name}`);
        }
      });
    });
    const baseRatio = totalParams > 0 ? normalCount / totalParams : 1;
    // 基础工况分：按难度倍率放大后 cap 到 40
    const baseRaw = Math.min(40, baseRatio * 40 * cfg.baseMultiplier);
    const baseScore = Math.round(baseRaw);

    const correctSteps = currentFault.steps.filter((s) => s.correct);
    const completed = get().getCompletedSteps();
    const stepRaw = correctSteps.length > 0
      ? (completed.length / correctSteps.length) * 30
      : 30;
    const stepScore = Math.round(stepRaw);

    let speedRaw = 0;
    let durationSec = Math.round((Date.now() - startTime) / 1000);
    if (completed.length >= correctSteps.length && correctSteps.length > 0) {
      const cap = 300;
      speedRaw = Math.max(0, 20 * (1 - Math.min(durationSec, cap) / cap));
    }
    const speedScore = Math.round(speedRaw);

    const wrongRecords = records.filter((r) => !r.isCorrect);
    const wrongCount = wrongRecords.length;
    // 每错一次扣分系数随难度而变（novice=1, standard=2, expert=3）
    const penalty = Math.min(10, wrongCount * cfg.errorPenaltyPerWrong);

    // bypass 模式：所有维度封 0、只显示基础分；总分仍受难度上限影响
    if (bypassedByStabilize) {
      const total = Math.min(cfg.totalCap, baseScore);
      const grade: 'S' | 'A' | 'B' | 'C' | 'D' = total >= 60 ? 'C' : 'D';
      return {
        total,
        grade,
        bypassed: true,
        dimensions: [
          {
            key: 'baseScore',
            label: '基础工况分',
            score: baseScore,
            max: 40,
            formula: `(参数处于正常区间数 / 参数总数) × 40 × ${cfg.baseMultiplier}（cap 40）`,
            explain: `本次结束时 ${normalCount}/${totalParams} 个参数处于正常区间，得 ${baseScore} 分。${diffSuffix}`,
            suggestion: baseScore < 40 ? '检查所有参数都已回到 normal 区间' : undefined,
          },
          {
            key: 'stepScore',
            label: '正确步骤分',
            score: 0,
            max: 30,
            formula: '已完成正确步骤数 / 总正确步骤数 × 30',
            explain: `使用了"一键平稳工况"，跳过了逐步处置，本项不计分。${diffSuffix}`,
            suggestion: '尝试不点一键平稳，按"建议步骤"逐项调整参数，让操作真正贴合工艺处置思路。',
          },
          {
            key: 'speedScore',
            label: '响应速度分',
            score: 0,
            max: 20,
            formula: '完成全部正确步骤越快，分数越高（5 分钟封顶）',
            explain: `使用了"一键平稳工况"，本项不计分。${diffSuffix}`,
            suggestion: '完整跑完一次演练后再追求速度。',
          },
          {
            key: 'penalty',
            label: '错误扣分',
            score: cfg.errorPenaltyPerWrong,
            max: 10,
            formula: `每个错误操作 -${cfg.errorPenaltyPerWrong} 分（最多扣 10 分）`,
            explain: `"一键平稳"被记为一次绕过演练（扣 ${cfg.errorPenaltyPerWrong} 分）。${diffSuffix}`,
            suggestion: '仅在工况严重失控时使用一键平稳作为兜底。',
          },
        ],
        highlights: baseScore >= 30 ? ['工艺最终回到平稳工况'] : [],
        improvements: [
          '本次直接用了"一键平稳工况"，没有真正完成故障处置',
          '建议重新发起演练，按【建议步骤】逐项调整参数',
        ],
        coachComment: '一键平稳是个兜底手段，但学不到真本事。下次试着自己一步步处理，看看能不能拿 B 以上。',
      };
    }

    // 正常模式：各维度均参与；总分按难度 cap
    const rawTotal = baseScore + stepScore + speedScore - penalty;
    const total = Math.max(0, Math.min(cfg.totalCap, rawTotal));
    let grade: 'S' | 'A' | 'B' | 'C' | 'D';
    if (total >= 90) grade = 'S';
    else if (total >= 80) grade = 'A';
    else if (total >= 70) grade = 'B';
    else if (total >= 60) grade = 'C';
    else grade = 'D';

    const dimensions: ScoreDimension[] = [
      {
        key: 'baseScore',
        label: '基础工况分',
        score: baseScore,
        max: 40,
        formula: `(参数处于正常区间数 / 参数总数) × 40 × ${cfg.baseMultiplier}（cap 40）`,
        explain:
          (totalParams > 0
            ? `结束时 ${normalCount}/${totalParams} 个参数处于正常区间（${Math.round(baseRatio * 100)}%），得 ${baseScore}/40。`
            : '无参数可统计。') + diffSuffix,
        suggestion:
          baseScore < 40
            ? `仍有 ${abnormalParams.length} 个参数偏离正常范围${
                abnormalParams.length ? `（如 ${abnormalParams.slice(0, 3).join('、')}${abnormalParams.length > 3 ? '…' : ''}）` : ''
              }，演练结束前应把它们调回 normalMin~normalMax 之间。`
            : undefined,
      },
      {
        key: 'stepScore',
        label: '正确步骤分',
        score: stepScore,
        max: 30,
        formula: '已完成正确步骤数 / 总正确步骤数 × 30',
        explain:
          (correctSteps.length > 0
            ? `本故障建议处置 ${correctSteps.length} 步，你完成了 ${completed.length} 步，得 ${stepScore}/30。`
            : '本故障无建议步骤，自动满分。') + diffSuffix,
        suggestion:
          completed.length < correctSteps.length
            ? `还有 ${correctSteps.length - completed.length} 步建议未完成${
                correctSteps.length
                  ? `（${correctSteps.filter((s) => !completed.includes(s.action)).map((s) => s.action).slice(0, 2).join('、')}）`
                  : ''
              }。注意每条建议都需要在对应设备的参数上做"朝正常方向调整"才算完成。`
            : undefined,
      },
      {
        key: 'speedScore',
        label: '响应速度分',
        score: speedScore,
        max: 20,
        formula: '完成全部正确步骤越快，分数越高（5 分钟封顶）',
        explain:
          (completed.length >= correctSteps.length && correctSteps.length > 0
            ? `用时 ${durationSec} 秒，得 ${speedScore}/20。`
            : '未完成全部建议步骤，速度分不计入。') + diffSuffix,
        suggestion:
          completed.length < correctSteps.length
            ? '先完成全部建议步骤，速度分才会计入。建议先看【建议步骤】逐项执行。'
            : speedScore < 16
            ? '可以尝试更早识别故障关键参数、减少无关操作，争取 60 秒内完成。'
            : undefined,
      },
      {
        key: 'penalty',
        label: '错误扣分',
        score: penalty,
        max: 10,
        formula: `每个错误操作 -${cfg.errorPenaltyPerWrong} 分（最多扣 10 分）`,
        explain:
          (wrongCount > 0
            ? `共 ${wrongCount} 次错误操作，扣 ${penalty} 分。${
                wrongRecords.length
                  ? `示例：${wrongRecords.slice(0, 2).map((r) => r.action).join('；')}`
                  : ''
              }`
            : '无错误操作，未扣分。') + diffSuffix,
        suggestion:
          wrongCount > 0
            ? '调参前先看【现象】和【根因】判断方向：症状 ↑ 应调小、↓ 应调大。先做"对方向"的调整再追求精度。'
            : undefined,
      },
    ];

    // 强项：每条都必须同时满足"维度分高 + 与总分等级自洽"
    // 关键修复：避免"总分 34 但工况平稳 18/21"这种自相矛盾的描述
    // 思路：只有 B 级以上 (total >= 70) 才认可"工况整体平稳"，否则视为故障未真正处置完
    const highlights: string[] = [];

    // 故障相关参数是否还有异常：以 fault.symptoms 涉及的参数为基准
    const symptomParamKeys = new Set(
      currentFault.symptoms.map((s) => `${s.equipmentId}.${s.param}`),
    );
    const symptomEquipments = new Map<string, { name: string; abnormal: boolean }>();
    equipments.forEach((eq) => {
      eq.parameters.forEach((p) => {
        const key = `${eq.id}.${p.id}`;
        if (symptomParamKeys.has(key)) {
          const off = p.value < p.normalMin || p.value > p.normalMax;
          // 同一台设备只要有一个故障参数没回到 normal，就标记该设备未处置完
          const prev = symptomEquipments.get(eq.id);
          symptomEquipments.set(eq.id, {
            name: eq.name,
            abnormal: (prev?.abnormal ?? false) || off,
          });
        }
      });
    });
    const symptomAllNormal = Array.from(symptomEquipments.values()).every((v) => !v.abnormal);

    // ① 工况平稳：basetScore 高 + 总分 B 级以上 + 故障参数全部回正
    if (baseScore >= 32 && total >= 70 && symptomAllNormal) {
      highlights.push(`工况整体平稳（${normalCount}/${totalParams} 参数 normal）`);
    }
    // ② 完整执行所有正确步骤
    if (correctSteps.length > 0 && completed.length >= correctSteps.length) {
      highlights.push(`完整执行了全部 ${correctSteps.length} 步建议处置`);
    } else if (correctSteps.length > 0 && completed.length / correctSteps.length >= 0.6 && total >= 60) {
      // 仅在 C 级以上才把"完成 60%"视为强项
      highlights.push(`完成了 ${completed.length}/${correctSteps.length} 步关键处置`);
    }
    // ③ 响应迅速：需配合"已完成全部步骤"才有意义
    if (speedScore >= 16 && completed.length >= correctSteps.length && correctSteps.length > 0) {
      highlights.push(`响应迅速，${durationSec}s 内完成处置`);
    }
    // ④ 全程零错误：需要有过有效操作（避免"啥都没干"也被算优秀）
    if (wrongCount === 0 && records.length >= 2 && total >= 60) {
      highlights.push('全程零错误操作');
    }

    // 短板：单项得分 < 60% 满分
    const improvements: string[] = [];
    dimensions.forEach((d) => {
      if (d.key === 'penalty') {
        if (d.score >= 4) improvements.push(d.suggestion ?? '减少错误操作');
      } else if (d.max > 0 && d.score / d.max < 0.6 && d.suggestion) {
        improvements.push(d.suggestion);
      }
    });

    // AI 师傅点评 - 按等级分语气，并补充难度提示
    // 注意：这里只是"兜底文本"，正常会被 coachClosing(LLM) 流式覆盖
    let coachComment: string;
    if (grade === 'S') coachComment = '满分级别！工况控制、步骤执行、速度都拿捏到位，可以挑战更复杂故障了。';
    else if (grade === 'A') coachComment = '操作老练。再精进的话，把响应速度提一提，争取 S 级。';
    else if (grade === 'B') coachComment = '思路对了，但还有提升空间。重点看看"短板"里给的建议。';
    else if (grade === 'C') coachComment = '基本完成，但处置不够全面。建议重做一次，参考【建议步骤】逐项执行。';
    else {
      // D 级：明确指出问题；避免"工况平稳但分数低"的认知矛盾
      const undoneEqs = Array.from(symptomEquipments.values()).filter((v) => v.abnormal).map((v) => v.name);
      if (completed.length === 0 && records.length === 0) {
        coachComment = '本次几乎没有有效操作，故障还摆在那儿。先看右上角"故障简报"，了解症状和建议步骤再开始。';
      } else if (undoneEqs.length > 0) {
        coachComment = `分数偏低主要因为故障没真正解决——${undoneEqs.slice(0, 2).join('、')} 的关键参数还没回到正常区间。建议重做一次，按建议步骤逐项处置。`;
      } else if (wrongCount >= 3) {
        coachComment = `这次错误操作偏多（${wrongCount} 次），方向没找对。下次调参前先看【现象】，症状偏高就调小、偏低就调大。`;
      } else {
        coachComment = '本次得分较低，强烈建议先看 AI 师傅推送的"故障简报"再操作，按建议步骤逐项处置。';
      }
    }
    // 难度上下文备注
    if (activeDifficulty === 'novice') {
      coachComment += '（新手模式：分数封顶 80，可挑战进阶模式冲击 S 级）';
    } else if (activeDifficulty === 'expert') {
      coachComment += '（专家模式：基础工况分 ×1.2、错误扣分加重，能拿 A 已经很难得）';
    }

    return {
      total,
      grade,
      bypassed: false,
      dimensions,
      highlights,
      improvements,
      coachComment,
    };
  },
}));
