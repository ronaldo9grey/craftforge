// =============================================================
// 前端时间轴工具（与后端 craftforge-server/src/services/timeline.ts 保持结构一致）
// 既负责类型定义，也负责对前端 OperationRecord 做本地转换（如学生侧降级展示）
// =============================================================

import type { OperationRecord } from '@/types';

/** 与后端事件类型保持一致 */
export type TimelineEventType =
  | 'action'
  | 'view'
  | 'pause'
  | 'speech'
  | 'note';

export interface TimelineEvent {
  /** 相对录制起点的秒数 */
  t: number;
  type: TimelineEventType;
  target?: string;
  targetLabel?: string;
  from?: number;
  to?: number;
  text?: string;
  durationSec?: number;
  pinned?: boolean;
}

export interface ExpertTimeline {
  version: 1;
  duration_sec: number;
  events: TimelineEvent[];
}

/**
 * 把前端 OperationRecord[] 转 timeline（与后端 buildTimelineFromOperations 行为一致）。
 * 用于：① 学生侧离线展示（不调后端）② 教师录入时本地预览
 */
export function buildTimelineFromOperations(
  ops: OperationRecord[],
  opts?: { minPauseSec?: number; noiseRatio?: number }
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

/** 把秒数格式化为 mm:ss */
export function formatTimelineT(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// =============================================================
// 差异检测 v1：按 action.target 配对 + 顺序检查
//
// 输入：专家 timeline、学生 timeline
// 输出：diff 列表，每项标注差异类型 + 严重度
// =============================================================

export type DiffSeverity = 'critical' | 'warning' | 'info';

export interface TimelineDiff {
  /** 差异分类 */
  kind:
    | 'missing'         // 专家做了但学生没做
    | 'extra'           // 学生做了但专家没做
    | 'value_mismatch'  // 都做了，但参数值差异大
    | 'order_swap'      // 顺序颠倒
    | 'skip_observe';   // 学生跳过了专家的观察期
  severity: DiffSeverity;
  /** 专家侧事件（如果有） */
  expertEvent?: TimelineEvent;
  /** 学生侧事件（如果有） */
  studentEvent?: TimelineEvent;
  /** 给学生看的中文解释 */
  message: string;
}

/** 取 action 事件 + 按 target 分组 */
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

/**
 * 比较专家与学生时间轴。
 * - missing：专家有某个 action.target，学生完全没碰
 * - extra：学生改了某个 target，专家根本没碰
 * - value_mismatch：都改了，但 to 值相差超过 20%
 * - skip_observe：专家在某 action 后有 pause（观察期），学生该 action 后立刻接下一动作
 *
 * 简化版：不做顺序 DTW 对齐，按 target 维度比对足够暴露 80% 关键差异
 */
export function compareTimelines(
  expert: ExpertTimeline,
  student: ExpertTimeline,
): TimelineDiff[] {
  const diffs: TimelineDiff[] = [];
  const eMap = indexActions(expert);
  const sMap = indexActions(student);

  // 1) 专家做了 student 没做：missing
  for (const [target, eEvs] of eMap) {
    if (!sMap.has(target)) {
      const head = eEvs[0];
      diffs.push({
        kind: 'missing',
        severity: 'critical',
        expertEvent: head,
        message: `专家调整了 ${head.targetLabel || target}（${head.from}→${head.to}），但你完全没操作`,
      });
    }
  }

  // 2) 学生做了 expert 没做：extra
  for (const [target, sEvs] of sMap) {
    if (!eMap.has(target)) {
      const head = sEvs[0];
      diffs.push({
        kind: 'extra',
        severity: 'warning',
        studentEvent: head,
        message: `你调整了 ${head.targetLabel || target}（${head.from}→${head.to}），但专家并没有动这里`,
      });
    }
  }

  // 3) 都做了：检查 value 差异
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
          message: `${eFinal.targetLabel || target}：专家调到 ${eFinal.to}，你调到 ${sFinal.to}，偏离 ${Math.round((delta / base) * 100)}%`,
        });
      }
    }
  }

  // 4) skip_observe：专家在某 action 后下一个事件是 pause；学生没有
  for (let i = 0; i < expert.events.length - 1; i++) {
    const cur = expert.events[i];
    const next = expert.events[i + 1];
    if (cur.type !== 'action' || next.type !== 'pause') continue;
    // 学生在这个 target 后有没有间隔？
    const studentMatch = student.events.find(
      (s) => s.type === 'action' && s.target === cur.target,
    );
    if (!studentMatch) continue;
    const idx = student.events.indexOf(studentMatch);
    const studentNext = student.events[idx + 1];
    const studentGap = studentNext ? studentNext.t - studentMatch.t : 999;
    if (studentGap < (next.durationSec || 15) / 2) {
      diffs.push({
        kind: 'skip_observe',
        severity: 'warning',
        expertEvent: cur,
        studentEvent: studentMatch,
        message: `专家调整 ${cur.targetLabel || cur.target} 后等了 ${next.durationSec}s 观察反应；你只等了 ${studentGap}s 就接下一动作`,
      });
    }
  }

  return diffs;
}

/** 差异等级的样式（给前端 UI 用） */
export const SEVERITY_STYLE: Record<DiffSeverity, { color: string; label: string }> = {
  critical: { color: 'text-red-600 bg-red-50 border-red-300', label: '关键' },
  warning: { color: 'text-amber-700 bg-amber-50 border-amber-300', label: '差异' },
  info: { color: 'text-blue-700 bg-blue-50 border-blue-300', label: '提示' },
};
