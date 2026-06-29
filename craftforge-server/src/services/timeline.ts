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
