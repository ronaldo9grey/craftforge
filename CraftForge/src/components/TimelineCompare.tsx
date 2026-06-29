// =============================================================
// 双轨专家/学生时间轴对照组件
// 用于学生在 HistoryDetailPage / MistakeBookPage 看完演练后，
// 一键查看"老师傅是怎么处置同一个故障的"，并自动高亮关键差异。
// =============================================================
import { useMemo, useState } from 'react';
import {
  type ExpertTimeline,
  type TimelineEvent,
  type TimelineDiff,
  compareTimelines,
  formatTimelineT,
  SEVERITY_STYLE,
} from '@/services/timeline';

interface Props {
  expert: ExpertTimeline | null;
  student: ExpertTimeline | null;
  expertName?: string | null;
  expertTitle?: string | null;
  /** 学生姓名/称谓（默认"你"） */
  studentLabel?: string;
  /** 关闭回调 */
  onClose?: () => void;
}

/** 单条事件渲染（左/右轨共用） */
function EventCard({
  ev,
  highlight,
  isExpert,
}: {
  ev: TimelineEvent;
  highlight?: boolean;
  isExpert: boolean;
}) {
  // 不同类型的事件用不同颜色
  const tone =
    ev.type === 'action'
      ? isExpert
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-sky-300 bg-sky-50'
      : ev.type === 'pause'
      ? 'border-amber-300 bg-amber-50'
      : 'border-slate-200 bg-slate-50';
  const ring = highlight ? 'ring-2 ring-rose-400 ring-offset-1' : '';
  return (
    <div className={`relative rounded-lg border ${tone} ${ring} p-2 text-xs shadow-sm transition-opacity`}>
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="font-mono">{formatTimelineT(ev.t)}</span>
        <span className="uppercase tracking-wider">{ev.type}</span>
      </div>
      {ev.type === 'action' && (
        <div className="mt-1">
          <div className="font-semibold text-slate-800">
            {ev.targetLabel || ev.target}
          </div>
          <div className="text-slate-600">
            <span className="font-mono">{ev.from}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className="font-mono text-slate-900">{ev.to}</span>
          </div>
          {ev.text && <div className="mt-1 text-slate-500">{ev.text}</div>}
        </div>
      )}
      {ev.type === 'view' && (
        <div className="mt-1 text-slate-700">
          👁 查看 <span className="font-medium">{ev.targetLabel}</span>
        </div>
      )}
      {ev.type === 'pause' && (
        <div className="mt-1 text-slate-700">
          ⏸ 观察期 <span className="font-mono">{ev.durationSec}s</span>
        </div>
      )}
      {ev.type === 'speech' && (
        <div className="mt-1 italic text-slate-700">"{ev.text}"</div>
      )}
      {ev.type === 'note' && (
        <div className="mt-1 text-slate-700">📝 {ev.text}</div>
      )}
    </div>
  );
}

export default function TimelineCompare({
  expert,
  student,
  expertName,
  expertTitle,
  studentLabel = '你',
  onClose,
}: Props) {
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);

  // 计算差异（仅在两侧时间轴都存在时）
  const diffs = useMemo<TimelineDiff[]>(() => {
    if (!expert || !student) return [];
    return compareTimelines(expert, student);
  }, [expert, student]);

  // 把每个事件映射到它涉及的差异（用于高亮）
  const hitExpert = useMemo(() => {
    const s = new Set<TimelineEvent>();
    diffs.forEach((d) => d.expertEvent && s.add(d.expertEvent));
    return s;
  }, [diffs]);
  const hitStudent = useMemo(() => {
    const s = new Set<TimelineEvent>();
    diffs.forEach((d) => d.studentEvent && s.add(d.studentEvent));
    return s;
  }, [diffs]);

  // 过滤后的事件流（只看差异时仅保留高亮事件）
  const expertEvents = useMemo(() => {
    if (!expert) return [];
    if (!showOnlyDiff) return expert.events;
    return expert.events.filter((e) => hitExpert.has(e));
  }, [expert, showOnlyDiff, hitExpert]);
  const studentEvents = useMemo(() => {
    if (!student) return [];
    if (!showOnlyDiff) return student.events;
    return student.events.filter((e) => hitStudent.has(e));
  }, [student, showOnlyDiff, hitStudent]);

  if (!expert || expert.events.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        ⓘ 该故障还没有专家时间轴。请联系教师在「经验蒸馏」页录入。
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <div className="text-base font-semibold text-slate-800">
            🎬 专家 / {studentLabel} 操作对照
          </div>
          {expertName && (
            <div className="mt-0.5 text-xs text-slate-500">
              专家：{expertName}
              {expertTitle ? `（${expertTitle}）` : ''} · 时长 {formatTimelineT(expert.duration_sec)}
              {student && <> · {studentLabel}用时 {formatTimelineT(student.duration_sec)}</>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {diffs.length > 0 && (
            <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showOnlyDiff}
                onChange={(e) => setShowOnlyDiff(e.target.checked)}
              />
              仅看差异点
            </label>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              收起
            </button>
          )}
        </div>
      </div>

      {/* 双轨时间轴 */}
      <div className="grid grid-cols-2 gap-3 p-3">
        {/* 专家轨 */}
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            👨‍🔧 老师傅的处置
          </div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {expertEvents.length === 0 && (
              <div className="text-xs text-slate-400">无相关事件</div>
            )}
            {expertEvents.map((ev, i) => (
              <EventCard
                key={`e-${i}-${ev.t}`}
                ev={ev}
                isExpert
                highlight={hitExpert.has(ev)}
              />
            ))}
          </div>
        </div>

        {/* 学生轨 */}
        <div>
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-sky-700">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
            👨‍🎓 {studentLabel}的处置
          </div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {!student || studentEvents.length === 0 ? (
              <div className="text-xs text-slate-400">
                {!student ? '暂无你的演练记录' : '无相关事件'}
              </div>
            ) : (
              studentEvents.map((ev, i) => (
                <EventCard
                  key={`s-${i}-${ev.t}`}
                  ev={ev}
                  isExpert={false}
                  highlight={hitStudent.has(ev)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 差异分析 */}
      {diffs.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="mb-2 text-sm font-semibold text-slate-800">
            🎯 关键差异分析（{diffs.length}）
          </div>
          <ul className="space-y-1.5">
            {diffs.map((d, i) => {
              const sty = SEVERITY_STYLE[d.severity];
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs ${sty.color}`}
                >
                  <span className="rounded bg-white/60 px-1 py-0.5 text-[10px] font-bold">
                    {sty.label}
                  </span>
                  <span className="flex-1">{d.message}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {student && diffs.length === 0 && (
        <div className="border-t border-slate-200 px-4 py-3 text-sm text-emerald-700">
          🎉 没有明显差异，你的处置和专家高度一致！
        </div>
      )}
    </div>
  );
}
