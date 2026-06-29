// =============================================================
// 双轨专家/学生时间轴对照组件 + 播放器
//
// 功能：
//   - 时间游标播放（▶ / ⏸ / 1× 2× 4×）
//   - 进度条拖拽跳转
//   - 事件按当前游标分三态：past（已发生，灰）/ current（正在发生，亮高亮 + 边框跳动）/ future（未发生，半透明）
//   - 当某事件进入 current 状态时，自动滚动到视口
//   - 关键差异面板默认仅显示"当前游标之前已暴露"的差异（可切换全部）
//   - 仅看差异点 + 全部展示 切换保留
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
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

type EventPhase = 'past' | 'current' | 'future';

/** 判断事件相对当前游标的相位：past / current / future */
function phaseOf(ev: TimelineEvent, currentT: number): EventPhase {
  // current 区间：action/view 取 [t, t+1.5)；pause 取 [t, t+durationSec)
  const start = ev.t;
  const end =
    ev.type === 'pause'
      ? ev.t + (ev.durationSec || 1)
      : ev.t + 1.5;
  if (currentT < start) return 'future';
  if (currentT < end) return 'current';
  return 'past';
}

/** 单条事件渲染（左/右轨共用） */
function EventCard({
  ev,
  highlight,
  isExpert,
  phase,
  scrollRef,
}: {
  ev: TimelineEvent;
  highlight?: boolean;
  isExpert: boolean;
  phase: EventPhase;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // 不同类型的基础底色
  const baseTone =
    ev.type === 'action'
      ? isExpert
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-sky-300 bg-sky-50'
      : ev.type === 'pause'
      ? 'border-amber-300 bg-amber-50'
      : 'border-slate-200 bg-slate-50';

  // 三态视觉：future 半透明、current 强边框+底色加深+脉动、past 正常但去饱和
  const phaseClass =
    phase === 'future'
      ? 'opacity-40'
      : phase === 'current'
      ? 'ring-2 ring-offset-1 shadow-md ' +
        (isExpert ? 'ring-emerald-500' : 'ring-sky-500') +
        ' animate-pulse-soft'
      : 'opacity-90'; // past

  const diffRing = highlight ? ' ring-2 ring-rose-400' : '';

  return (
    <div
      ref={scrollRef}
      className={`relative rounded-lg border ${baseTone} ${phaseClass}${diffRing} p-2 text-xs shadow-sm transition-all duration-300`}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="font-mono">{formatTimelineT(ev.t)}</span>
        <span className="uppercase tracking-wider">{ev.type}</span>
      </div>
      {ev.type === 'action' && (
        <div className="mt-1">
          <div className="font-semibold text-slate-800">
            {ev.targetLabel || ev.target}
            {ev.target && ev.targetLabel && ev.target !== ev.targetLabel && (
              <span className="ml-1 text-slate-400">· {ev.target}</span>
            )}
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
  const [showOnlyExposedDiff, setShowOnlyExposedDiff] = useState(true);

  // =============================================================
  // 播放器状态机
  // =============================================================
  /** 时间轴总长度 = 双轨较长者 */
  const totalDuration = useMemo(() => {
    return Math.max(
      expert?.duration_sec || 0,
      student?.duration_sec || 0,
      1,
    );
  }, [expert, student]);

  /** 当前播放游标（秒） */
  const [currentT, setCurrentT] = useState(0);
  /** 是否在播放 */
  const [isPlaying, setIsPlaying] = useState(false);
  /** 播放倍速 */
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(2);

  // 播放循环：requestAnimationFrame，按真实时间步进
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTimeRef.current = performance.now();
    const tick = (now: number) => {
      const dtMs = now - lastTimeRef.current;
      lastTimeRef.current = now;
      setCurrentT((prev) => {
        const next = prev + (dtMs / 1000) * speed;
        if (next >= totalDuration) {
          // 播完自动停
          setIsPlaying(false);
          return totalDuration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, speed, totalDuration]);

  // 切换专家或学生时间轴时，重置游标
  useEffect(() => {
    setCurrentT(0);
    setIsPlaying(false);
  }, [expert, student]);

  const togglePlay = () => {
    if (currentT >= totalDuration) setCurrentT(0); // 重置后播
    setIsPlaying((v) => !v);
  };
  const restart = () => {
    setCurrentT(0);
    setIsPlaying(false);
  };
  const cycleSpeed = () => {
    setSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : s === 4 ? 8 : 1));
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentT(Number(e.target.value));
    setIsPlaying(false); // 拖动时暂停，避免回放争抢
  };

  // =============================================================
  // 差异计算 + 暴露过滤
  // =============================================================
  const diffs = useMemo<TimelineDiff[]>(() => {
    if (!expert || !student) return [];
    return compareTimelines(expert, student);
  }, [expert, student]);

  /** 一条差异在 currentT 时是否已"暴露"：取 expertEvent.t 与 studentEvent.t 的较小值，<= currentT 才算暴露 */
  const isDiffExposed = (d: TimelineDiff): boolean => {
    const ts: number[] = [];
    if (d.expertEvent) ts.push(d.expertEvent.t);
    if (d.studentEvent) ts.push(d.studentEvent.t);
    if (ts.length === 0) return true;
    return Math.min(...ts) <= currentT;
  };

  const visibleDiffs = useMemo(
    () => (showOnlyExposedDiff ? diffs.filter(isDiffExposed) : diffs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [diffs, showOnlyExposedDiff, currentT],
  );

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

  // =============================================================
  // 事件流过滤 + auto-scroll 引用表
  // =============================================================
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

  // 每个事件一个 ref，用于 auto-scroll 到 current
  const expertRefs = useRef<Array<HTMLDivElement | null>>([]);
  const studentRefs = useRef<Array<HTMLDivElement | null>>([]);
  // 上一帧 current 索引（避免每帧 scroll 抖动）
  const lastExpertCurrentRef = useRef<number>(-1);
  const lastStudentCurrentRef = useRef<number>(-1);
  useEffect(() => {
    if (!isPlaying) return; // 拖动跳转不自动滚动，避免争抢
    const findCurrent = (events: TimelineEvent[]): number =>
      events.findIndex((ev) => phaseOf(ev, currentT) === 'current');
    const eIdx = findCurrent(expertEvents);
    const sIdx = findCurrent(studentEvents);
    if (eIdx >= 0 && eIdx !== lastExpertCurrentRef.current) {
      expertRefs.current[eIdx]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      lastExpertCurrentRef.current = eIdx;
    }
    if (sIdx >= 0 && sIdx !== lastStudentCurrentRef.current) {
      studentRefs.current[sIdx]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      lastStudentCurrentRef.current = sIdx;
    }
  }, [currentT, expertEvents, studentEvents, isPlaying]);

  if (!expert || expert.events.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        ⓘ 该故障还没有专家时间轴。请联系教师在「经验蒸馏」页录入。
      </div>
    );
  }

  // 进度百分比
  const pct = Math.min(100, (currentT / totalDuration) * 100);

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
              {student && (
                <>
                  {' '}· {studentLabel}用时 {formatTimelineT(student.duration_sec)}
                </>
              )}
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

      {/* 播放器控制条 */}
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-3">
          {/* 播放/暂停 */}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-slate-700"
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
          </button>
          {/* 重置 */}
          <button
            type="button"
            onClick={restart}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-white"
            title="重置到 00:00"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          {/* 倍速 */}
          <button
            type="button"
            onClick={cycleSpeed}
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
            title="切换倍速"
          >
            <FastForward className="h-3 w-3" />
            {speed}×
          </button>
          {/* 进度条 */}
          <div className="flex flex-1 items-center gap-2">
            <span className="font-mono text-xs text-slate-600 w-12 text-right">
              {formatTimelineT(currentT)}
            </span>
            <div className="relative flex-1">
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={1}
                value={Math.min(currentT, totalDuration)}
                onChange={handleSeek}
                className="w-full cursor-pointer accent-emerald-500"
                aria-label="时间轴进度"
              />
              {/* 在进度条上点缀关键事件锚点（取 action 的 t） */}
              <div className="pointer-events-none absolute inset-0 flex h-1.5 items-center">
                {expert.events
                  .filter((e) => e.type === 'action')
                  .map((e, i) => (
                    <span
                      key={`em-${i}`}
                      className="absolute h-2 w-1 rounded-sm bg-emerald-500/70"
                      style={{ left: `calc(${(e.t / totalDuration) * 100}% - 1px)` }}
                      title={`专家 ${formatTimelineT(e.t)} ${e.targetLabel || e.target}`}
                    />
                  ))}
                {student?.events
                  .filter((e) => e.type === 'action')
                  .map((e, i) => (
                    <span
                      key={`sm-${i}`}
                      className="absolute h-2 w-1 translate-y-2 rounded-sm bg-sky-500/70"
                      style={{ left: `calc(${(e.t / totalDuration) * 100}% - 1px)` }}
                      title={`${studentLabel} ${formatTimelineT(e.t)} ${e.targetLabel || e.target}`}
                    />
                  ))}
              </div>
            </div>
            <span className="font-mono text-xs text-slate-400 w-12">
              {formatTimelineT(totalDuration)}
            </span>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            🟢 专家锚点 / <span className="text-sky-600">🔵 {studentLabel}锚点</span>{' '}
            （进度条下方）
          </span>
          <span>进度 {pct.toFixed(0)}%</span>
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
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1 scroll-smooth">
            {expertEvents.length === 0 && (
              <div className="text-xs text-slate-400">无相关事件</div>
            )}
            {expertEvents.map((ev, i) => (
              <EventCard
                key={`e-${i}-${ev.t}`}
                ev={ev}
                isExpert
                highlight={hitExpert.has(ev)}
                phase={phaseOf(ev, currentT)}
                scrollRef={{
                  // 把 ref 写到 expertRefs.current[i]
                  get current() {
                    return expertRefs.current[i] ?? null;
                  },
                  set current(v) {
                    expertRefs.current[i] = v;
                  },
                } as React.RefObject<HTMLDivElement | null>}
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
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1 scroll-smooth">
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
                  phase={phaseOf(ev, currentT)}
                  scrollRef={{
                    get current() {
                      return studentRefs.current[i] ?? null;
                    },
                    set current(v) {
                      studentRefs.current[i] = v;
                    },
                  } as React.RefObject<HTMLDivElement | null>}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 差异分析 */}
      {diffs.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800">
              🎯 关键差异（{visibleDiffs.length}/{diffs.length}）
            </div>
            <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showOnlyExposedDiff}
                onChange={(e) => setShowOnlyExposedDiff(e.target.checked)}
              />
              仅显示当前进度已暴露的差异
            </label>
          </div>
          {visibleDiffs.length === 0 ? (
            <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
              当前进度还未触发任何差异，继续播放查看…
            </div>
          ) : (
            <ul className="space-y-1.5">
              {visibleDiffs.map((d, i) => {
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
          )}
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
