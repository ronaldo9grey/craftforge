// =============================================================
// 专家时间轴（Expert Timeline）数据规范 + 转换工具
//
// P1-4 核心数据结构：
//   ExpertTimeline = {
//     version: 1,
//     duration_sec: 总时长（秒）
//     events: TimelineEvent[]   // 按 t 升序
//   }
//
// 设计原则：
// - 一个 OperationRecord = 一个 TimelineEvent，避免重写录制器
// - "等待 / 静止观察" 也是事件（type='pause'），通过相邻 action 间隔自动识别
// - 教师可在前端预览页删除噪声事件、加注释
// =============================================================

/** 单条时间轴事件 */
export type TimelineEventType =
  | 'action'   // 真实操作（参数调整 / 阀门启停 / 设备点击）
  | 'view'     // 仅观察（点击查看仪表，未改值）
  | 'pause'    // 静止期 / 观察期（无操作的真空段）
  | 'speech'   // 专家口述（未来音频/字幕都映射到这里）
  | 'note';    // 教师手工添加的注释

export interface TimelineEvent {
  /** 相对录制起点的秒数 */
  t: number;
  /** 事件类型 */
  type: TimelineEventType;
  /** 目标设备/参数 id（action / view 用） */
  target?: string;
  /** 目标显示名 */
  targetLabel?: string;
  /** 数值变更（action 用） */
  from?: number;
  /** 数值变更（action 用） */
  to?: number;
  /** 文本说明（speech / note 用，或 action 的人话解释） */
  text?: string;
  /** pause 持续时长（秒） */
  durationSec?: number;
  /** 是否被标记为关键节点（蒸馏 prompt 会更关注） */
  pinned?: boolean;
}

export interface ExpertTimeline {
  version: 1;
  duration_sec: number;
  events: TimelineEvent[];
}

/** 学生侧/演练侧用的 OperationRecord（与前端 types/index.ts 中保持一致） */
export interface OperationRecordLike {
  timestamp: number;
  action: string;
  targetEquipment: string;
  parameterChange?: { param: string; from: number; to: number };
  isCorrect?: boolean;
  aiFeedback?: string;
}

/**
 * 把演练记录中的 operations 序列转成 ExpertTimeline。
 * - 第一条 operation 的 timestamp 视为 t=0
 * - 相邻 op 间隔 ≥ minPauseSec 则插入一个 pause 事件
 * - parameterChange.from→to 差值占绝对量 < noiseRatio 视为噪声跳过（学生录制时不过滤）
 */
export function buildTimelineFromOperations(
  ops: OperationRecordLike[],
  opts?: {
    /** 静止间隔阈值（秒），超过则插 pause 事件，默认 15 秒 */
    minPauseSec?: number;
    /** 噪声比例阈值，参数变化占绝对量 < 此比例视为噪声跳过（默认 0，即不过滤；专家时间轴可调到 0.05） */
    noiseRatio?: number;
  }
): ExpertTimeline {
  const minPauseSec = opts?.minPauseSec ?? 15;
  const noiseRatio = opts?.noiseRatio ?? 0;

  if (!ops || ops.length === 0) {
    return { version: 1, duration_sec: 0, events: [] };
  }

  const sorted = [...ops].sort((a, b) => a.timestamp - b.timestamp);
  const t0 = sorted[0].timestamp;
  const events: TimelineEvent[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const op = sorted[i];
    const t = Math.max(0, Math.round((op.timestamp - t0) / 1000));

    // 插入 pause 事件（基于与上一条 op 的间隔）
    if (i > 0) {
      const prevT = Math.round((sorted[i - 1].timestamp - t0) / 1000);
      const gap = t - prevT;
      if (gap >= minPauseSec) {
        events.push({
          t: prevT + 1,
          type: 'pause',
          durationSec: gap,
          text: `观察期 ${gap}s`,
        });
      }
    }

    // 噪声过滤（仅对参数微调）
    if (op.parameterChange && noiseRatio > 0) {
      const { from, to } = op.parameterChange;
      const base = Math.max(Math.abs(from), Math.abs(to), 1);
      const delta = Math.abs(to - from);
      if (delta / base < noiseRatio) continue;
    }

    if (op.parameterChange) {
      events.push({
        t,
        type: 'action',
        target: op.parameterChange.param,
        targetLabel: op.targetEquipment,
        from: op.parameterChange.from,
        to: op.parameterChange.to,
        text: op.aiFeedback || op.action,
      });
    } else {
      events.push({
        t,
        type: 'view',
        target: op.targetEquipment,
        targetLabel: op.targetEquipment,
        text: op.action,
      });
    }
  }

  const last = sorted[sorted.length - 1];
  const duration_sec = Math.max(1, Math.round((last.timestamp - t0) / 1000));

  return { version: 1, duration_sec, events };
}

/** 安全解析 timeline JSON 字符串 */
export function parseTimeline(json: string | null | undefined): ExpertTimeline | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object' && Array.isArray(obj.events)) {
      return obj as ExpertTimeline;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================================
// 差异检测：与前端 services/timeline.ts 中的 compareTimelines 保持一致
// 主要给验证脚本 / 服务端测试用；学生 UI 走前端版本
// =============================================================

export type DiffSeverity = 'critical' | 'warning' | 'info';

export interface TimelineDiff {
  kind:
    | 'missing'
    | 'extra'
    | 'value_mismatch'
    | 'order_swap'
    | 'skip_observe';
  severity: DiffSeverity;
  expertEvent?: TimelineEvent;
  studentEvent?: TimelineEvent;
  message: string;
}

function indexActions(tl: ExpertTimeline): Map<string, TimelineEvent[]> {
  const m = new Map<string, TimelineEvent[]>();
  for (const ev of tl.events) {
    if (ev.type !== 'action' || !ev.target) continue;
    const list = m.get(ev.target) || [];
    list.push(ev);
    m.set(ev.target, list);
  }
  return m;
}

export function compareTimelines(expert: ExpertTimeline, student: ExpertTimeline): TimelineDiff[] {
  const diffs: TimelineDiff[] = [];
  const eMap = indexActions(expert);
  const sMap = indexActions(student);
  // 显示用：target + targetLabel 拼起来更清晰（同一台设备上多个参数容易混淆）
  const tname = (ev: TimelineEvent) =>
    ev.targetLabel && ev.targetLabel !== ev.target
      ? `${ev.targetLabel}·${ev.target}`
      : ev.target || '';

  for (const [target, eEvs] of eMap) {
    if (!sMap.has(target)) {
      const head = eEvs[0];
      diffs.push({
        kind: 'missing',
        severity: 'critical',
        expertEvent: head,
        message: `专家调整了 ${tname(head)}（${head.from}→${head.to}），但你完全没操作`,
      });
    }
  }

  for (const [target, sEvs] of sMap) {
    if (!eMap.has(target)) {
      const head = sEvs[0];
      diffs.push({
        kind: 'extra',
        severity: 'warning',
        studentEvent: head,
        message: `你调整了 ${tname(head)}（${head.from}→${head.to}），但专家并没有动这里`,
      });
    }
  }

  for (const [target, eEvs] of eMap) {
    const sEvs = sMap.get(target);
    if (!sEvs) continue;
    const eFinal = eEvs[eEvs.length - 1];
    const sFinal = sEvs[sEvs.length - 1];
    if (eFinal.to !== undefined && sFinal.to !== undefined) {
      const base = Math.max(Math.abs(eFinal.to), Math.abs(sFinal.to), 1);
      const delta = Math.abs(eFinal.to - sFinal.to);
      if (delta / base > 0.2) {
        diffs.push({
          kind: 'value_mismatch',
          severity: 'warning',
          expertEvent: eFinal,
          studentEvent: sFinal,
          message: `${tname(eFinal)}：专家调到 ${eFinal.to}，你调到 ${sFinal.to}，偏离 ${Math.round((delta / base) * 100)}%`,
        });
      }
    }
  }

  // skip_observe：专家在某 action 后下一个事件是 pause（观察期）；学生处置
  // 同 target 后却没有等同等长度的观察。算法只看 action 之间的真实间隔，
  // pause 事件本身不参与计算（避免同 timeline 自比时误判）。
  for (let i = 0; i < expert.events.length - 1; i++) {
    const cur = expert.events[i];
    if (cur.type !== 'action') continue;
    // 专家观察期：跳过 cur 后的相邻 pause / view 事件，找到下一个 action
    let expectedPauseSec = 0;
    for (let j = i + 1; j < expert.events.length; j++) {
      const nx = expert.events[j];
      if (nx.type === 'pause') {
        expectedPauseSec += nx.durationSec || 0;
      } else if (nx.type === 'action') {
        break;
      }
    }
    if (expectedPauseSec < 15) continue; // 专家自己也没等多久，不算观察期
    // 在学生轨上找同一 target 的 action
    const studentIdx = student.events.findIndex(
      (s) => s.type === 'action' && s.target === cur.target,
    );
    if (studentIdx < 0) continue;
    const studentAction = student.events[studentIdx];
    // 学生此 action 后下一个 action 的 t
    let studentNextActionT: number | null = null;
    for (let j = studentIdx + 1; j < student.events.length; j++) {
      if (student.events[j].type === 'action') {
        studentNextActionT = student.events[j].t;
        break;
      }
    }
    if (studentNextActionT === null) continue; // 学生本来就是最后一动作
    const studentGap = studentNextActionT - studentAction.t;
    if (studentGap < expectedPauseSec / 2) {
      diffs.push({
        kind: 'skip_observe',
        severity: 'warning',
        expertEvent: cur,
        studentEvent: studentAction,
        message: `专家调整 ${tname(cur)} 后等了 ${expectedPauseSec}s 观察反应；你只等了 ${studentGap}s 就接下一动作`,
      });
    }
  }

  return diffs;
}
