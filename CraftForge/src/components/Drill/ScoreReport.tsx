import { useEffect, useRef, useState, type ReactElement } from 'react';
import { X, Trophy, TrendingUp, Lightbulb, Sparkles, Target, Clock, Zap, Activity, Sprout, Settings2, Target as TargetIcon } from 'lucide-react';
import type { DrillRecord, DrillDifficulty } from '@/types';
import { useDrillStore } from '@/stores/drillStore';

interface ScoreReportProps {
  record: DrillRecord;
  onClose: () => void;
}

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  S: { text: 'text-yellow-400', bg: 'bg-yellow-400/20 border-yellow-400/40' },
  A: { text: 'text-green-400', bg: 'bg-green-400/20 border-green-400/40' },
  B: { text: 'text-blue-400', bg: 'bg-blue-400/20 border-blue-400/40' },
  C: { text: 'text-orange-400', bg: 'bg-orange-400/20 border-orange-400/40' },
  D: { text: 'text-red-400', bg: 'bg-red-400/20 border-red-400/40' },
};

const DIM_ICONS: Record<string, ReactElement> = {
  baseScore: <Activity className="w-4 h-4 text-info" />,
  stepScore: <Target className="w-4 h-4 text-success" />,
  speedScore: <Clock className="w-4 h-4 text-primary" />,
  penalty: <Zap className="w-4 h-4 text-danger" />,
};

// 难度徽章配置：与 TopBar / ScoreBoard 完全一致
const DIFFICULTY_BADGES: Record<DrillDifficulty, {
  label: string;
  icon: ReactElement;
  cls: string;
}> = {
  novice:   { label: '新手', icon: <Sprout className="w-3 h-3" />,    cls: 'bg-success/20 text-success border-success/40' },
  standard: { label: '进阶', icon: <Settings2 className="w-3 h-3" />, cls: 'bg-info/20 text-info border-info/40' },
  expert:   { label: '专家', icon: <TargetIcon className="w-3 h-3" />, cls: 'bg-warning/20 text-warning border-warning/40' },
};

// 演练讲评弹窗：分数怎么来的、强项/短板、AI 师傅点评 + 提升建议
export const ScoreReport: React.FC<ScoreReportProps> = ({ record, onClose }) => {
  const breakdown = record.breakdown;
  const gradeColor = GRADE_COLORS[record.grade] ?? GRADE_COLORS.D;
  const durationSec = Math.round((record.endTime - record.startTime) / 1000);

  if (!breakdown) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 头部：等级 + 总分 + 难度标签 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-border ${gradeColor.bg}`}>
          <div className="flex items-center gap-3">
            <Trophy className={`w-7 h-7 ${gradeColor.text}`} />
            <div>
              <div className="text-xs text-text-secondary">演练讲评</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-3xl font-bold ${gradeColor.text}`}>{record.grade}</span>
                <span className="text-2xl font-bold text-text-primary">{record.score}</span>
                <span className="text-xs text-text-muted">/ 100 · {durationSec}s</span>
                {/* 难度标签：紧贴等级徽章右侧，与历史 / 演练态徽章一致 */}
                {record.difficulty && (() => {
                  const b = DIFFICULTY_BADGES[record.difficulty];
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${b.cls}`}
                      title={`难度：${b.label}`}
                    >
                      {b.icon}
                      <span>{b.label}</span>
                    </span>
                  );
                })()}
              </div>
              {breakdown.bypassed && (
                <div className="text-xs text-warning mt-0.5">⚡ 通过"一键平稳工况"结束</div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI 师傅点评 */}
        <div className="px-5 py-3 bg-primary/5 border-b border-border flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-xs text-primary font-medium mb-0.5">AI 师傅点评</div>
            <div className="text-sm text-text-primary">{breakdown.coachComment}</div>
          </div>
        </div>

        {/* 评分明细：4 个维度 */}
        <div className="px-5 py-3 border-b border-border">
          <div className="text-xs text-text-muted font-medium mb-2">评分明细（这些分是怎么来的）</div>
          <div className="space-y-3">
            {breakdown.dimensions.map((d) => {
              const isPenalty = d.key === 'penalty';
              const ratio = d.max > 0 ? d.score / d.max : 0;
              const barColor = isPenalty
                ? 'bg-danger'
                : ratio >= 0.8
                ? 'bg-success'
                : ratio >= 0.6
                ? 'bg-info'
                : 'bg-warning';
              return (
                <div key={d.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      {DIM_ICONS[d.key]}
                      <span className="text-text-primary font-medium">{d.label}</span>
                    </div>
                    <span className="font-mono text-text-primary">
                      {isPenalty ? '-' : ''}
                      {d.score}
                      <span className="text-text-muted text-xs"> / {d.max}</span>
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div className="h-1.5 bg-bg-tertiary rounded overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                  </div>
                  <div className="text-xs text-text-secondary">
                    <span className="text-text-muted">公式：</span>
                    {d.formula}
                  </div>
                  <div className="text-xs text-text-secondary">{d.explain}</div>
                  {d.suggestion && (
                    <div className="text-xs text-warning flex items-start gap-1 pl-1">
                      <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{d.suggestion}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 强项 / 短板 */}
        <div className="px-5 py-3 border-b border-border grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-success font-medium mb-1.5 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              强项
            </div>
            {breakdown.highlights.length > 0 ? (
              <ul className="space-y-1">
                {breakdown.highlights.map((h, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-start gap-1">
                    <span className="text-success">✓</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-text-muted">暂无突出表现</div>
            )}
          </div>
          <div>
            <div className="text-xs text-warning font-medium mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5" />
              提升建议
            </div>
            {breakdown.improvements.length > 0 ? (
              <ul className="space-y-1">
                {breakdown.improvements.map((s, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-start gap-1">
                    <span className="text-warning">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-text-muted">本次表现已经很优秀</div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            关闭
          </button>
          <button
            onClick={() => {
              onClose();
              useDrillStore.getState().startDrill();
            }}
            className="px-4 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition-colors"
          >
            再来一次
          </button>
        </div>
      </div>
    </div>
  );
};

// 容器组件：监听演练历史新增，自动弹出最新一次的讲评报告
// 同时暴露 useScoreReport hook 给 ScoreBoard 主动打开
export const ScoreReportContainer: React.FC = () => {
  const history = useDrillStore((state) => state.history);
  const [openRecord, setOpenRecord] = useState<DrillRecord | null>(null);
  const lastSeenLength = useRef(history.length);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // 跳过首次渲染（避免页面初始化时把已存在历史也弹一次）
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastSeenLength.current = history.length;
      return;
    }
    if (history.length > lastSeenLength.current) {
      const latest = history[history.length - 1];
      setOpenRecord(latest);
      lastSeenLength.current = history.length;
    }
  }, [history.length]);

  // 监听全局自定义事件 'open-score-report'，让 ScoreBoard 的"查看详情"按钮可以触发打开
  useEffect(() => {
    const handler = () => {
      const latest = useDrillStore.getState().history.slice(-1)[0];
      if (latest) setOpenRecord(latest);
    };
    window.addEventListener('open-score-report', handler);
    return () => window.removeEventListener('open-score-report', handler);
  }, []);

  if (!openRecord) return null;
  return <ScoreReport record={openRecord} onClose={() => setOpenRecord(null)} />;
};
