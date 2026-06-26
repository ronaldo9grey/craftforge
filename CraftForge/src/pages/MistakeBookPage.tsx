// 错题本页：按 status (open/mastered/all) Tab 切换
// - 每项显示：场景 + 故障名 + 失败次数 + 最近成绩 + 最近时间
// - 展开后显示：错误操作详情 + 得分拆解 + 师傅点评 + 成绩轨迹 + 错误模式
// - 操作：去重练（跳工作台 + 锁定该故障）/ 标记已掌握

import { useEffect, useState } from 'react';
import { mistakeApi, experienceApi, type Mistake, type DistilledExperience } from '@/services/api';
import { usePageStore } from '@/stores/pageStore';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import {
  ArrowLeft, BookOpen, Play, CheckCircle2, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus,
  Lightbulb, Target, AlertCircle, History, Wrench, Sparkles
} from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmDialog';

const SCENE_LABEL: Record<string, string> = {
  fcc: '催化裂化', welding: '汽车焊装', cnc: '数控加工',
  injection: '注塑成型', aluminum: '电解铝', anode: '阳极振压',
  baking: '焙烧炉', tbm: '盾构机', offshore: '海上钻井',
};

const GRADE_COLOR: Record<string, string> = {
  S: 'text-yellow-400', A: 'text-green-400', B: 'text-blue-400',
  C: 'text-orange-400', D: 'text-red-400',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  novice: '新手', standard: '标准', expert: '专家',
};

const fmtDur = (s: number) => `${Math.floor(s / 60)}分${s % 60}秒`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const MistakeBookPage: React.FC = () => {
  const setPage = usePageStore((s) => s.setPage);
  const [tab, setTab] = useState<'open' | 'mastered' | 'all'>('open');
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ open: 0, mastered: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setActiveTemplate = useUIStore((s) => s.setActiveTemplate);
  const loadTemplate = useEquipmentStore((s) => s.loadTemplate);
  const loadKnowledge = useAIStore((s) => s.loadKnowledge);
  const clearMessages = useAIStore((s) => s.clearMessages);

  const load = async () => {
    setLoading(true);
    try {
      const r = await mistakeApi.list(tab);
      setMistakes(r.mistakes);
      setStats(r.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleRetry = (m: Mistake) => {
    setActiveTemplate(m.scene_id);
    loadTemplate(m.scene_id);
    loadKnowledge(m.scene_id as any);
    clearMessages();
    setPage('workbench');
  };

  const handleMaster = async (m: Mistake) => {
    const ok = await confirmDialog({
      title: `确认把"${m.fault_name}"标记为已掌握？`,
      description: '标记后该错题将移入"已掌握"列表，可随时重新标记。',
      icon: 'question',
      confirmText: '标记掌握',
    });
    if (!ok) return;
    await mistakeApi.master(m.id);
    await load();
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="h-screen overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-5xl mx-auto p-6 pb-20 space-y-4">
        {/* 顶部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setPage('dashboard')} className="p-2 text-text-muted hover:text-text-primary">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-warning" />
                错题本
              </h1>
              <p className="text-sm text-text-muted">
                未掌握 {stats.open ?? 0} · 已掌握 {stats.mastered ?? 0}
              </p>
            </div>
          </div>
          <button
            onClick={() => void load()}
            className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>

        {/* Tab */}
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1 w-fit">
          {(['open', 'mastered', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs rounded-md transition-colors ${
                tab === t ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'open' ? '未掌握' : t === 'mastered' ? '已掌握' : '全部'}
              {t === 'open' && stats.open > 0 && (
                <span className="ml-1.5 inline-block min-w-[18px] px-1 bg-warning text-white text-[10px] rounded-full">
                  {stats.open}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="py-12 text-center text-sm text-text-muted">加载中...</div>
        ) : mistakes.length === 0 ? (
          <div className="py-16 text-center bg-bg-secondary border border-border rounded-lg">
            <div className="text-4xl mb-2">{tab === 'open' ? '🎉' : '📖'}</div>
            <p className="text-sm text-text-muted">
              {tab === 'open' ? '太棒了！当前没有未掌握的错题' : tab === 'mastered' ? '尚无已掌握的错题' : '错题本是空的'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mistakes.map((m) => (
              <MistakeCard
                key={m.id}
                mistake={m}
                expanded={expandedId === m.id}
                onToggle={() => toggleExpand(m.id)}
                onRetry={() => handleRetry(m)}
                onMaster={() => handleMaster(m)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================
// 错题卡片（可展开）
// =============================================================
const MistakeCard: React.FC<{
  mistake: Mistake;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onMaster: () => void;
}> = ({ mistake: m, expanded, onToggle, onRetry, onMaster }) => {
  const isMastered = m.status === 'mastered';
  const [expertExp, setExpertExp] = useState<DistilledExperience | null>(null);
  const [expLoaded, setExpLoaded] = useState(false);

  // 展开时加载专家经验
  useEffect(() => {
    if (!expanded || expLoaded) return;
    if (m.scene_id && m.fault_id) {
      experienceApi.getByFault(m.scene_id, m.fault_id)
        .then(({ experience }) => setExpertExp(experience?.distilled ?? null))
        .catch(() => setExpertExp(null))
        .finally(() => setExpLoaded(true));
    } else {
      setExpLoaded(true);
    }
  }, [expanded, m.scene_id, m.fault_id, expLoaded]);

  const trend = m.score_history && m.score_history.length >= 2
    ? m.score_history[0].score > m.score_history[m.score_history.length - 1].score ? 'improving' : 'declining'
    : 'stable';

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  const trendColor = trend === 'improving' ? 'text-green-400' : trend === 'declining' ? 'text-red-400' : 'text-text-muted';

  return (
    <div
      className={`rounded-lg border transition-all overflow-hidden ${
        isMastered ? 'bg-bg-secondary border-border opacity-80' : 'bg-bg-secondary border-warning/40'
      }`}
    >
      {/* 卡片头部（可点击展开） */}
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-bg-tertiary/50" onClick={onToggle}>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isMastered ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
          }`}
        >
          {isMastered ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">
              {SCENE_LABEL[m.scene_id] ?? m.scene_id}
            </span>
            <span className="text-sm font-medium truncate">{m.fault_name}</span>
            {m.latest_difficulty && (
              <span className="text-[10px] px-1 py-0.5 bg-bg-tertiary rounded text-text-muted">
                {DIFFICULTY_LABEL[m.latest_difficulty] ?? m.latest_difficulty}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap">
            <span>失败 {m.fail_count} 次</span>
            <span>共练 {m.total_attempts ?? m.fail_count} 次</span>
            <span className={`${GRADE_COLOR[m.last_grade] ?? ''}`}>
              最近 {m.last_grade} 级 / {m.last_score} 分
            </span>
            {m.latest_duration != null && m.latest_duration > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" /> {fmtDur(m.latest_duration)}
              </span>
            )}
            <span className={`flex items-center gap-0.5 ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              {trend === 'improving' ? '进步中' : trend === 'declining' ? '退步' : '稳定'}
            </span>
            {isMastered && m.mastered_at && (
              <span className="text-success">
                · 已于 {new Date(m.mastered_at).toLocaleDateString()} 掌握
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {!isMastered && (
            <button
              onClick={onMaster}
              className="px-3 py-1.5 text-xs text-success bg-success/10 hover:bg-success/20 border border-success/40 rounded flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              标已掌握
            </button>
          )}
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-white rounded flex items-center gap-1"
          >
            <Play className="w-3.5 h-3.5" />
            去重练
          </button>
        </div>

        <button onClick={onToggle} className="p-1 text-text-muted hover:text-text-primary flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-bg-tertiary/30">
          {/* 师傅点评 */}
          {m.coach_comment && (
            <div className="flex items-start gap-2 p-3 bg-bg-secondary rounded-lg border border-cyan-500/20">
              <Lightbulb className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-cyan-400 font-medium mb-1">AI师傅点评</div>
                <p className="text-sm text-text-secondary leading-relaxed">{m.coach_comment}</p>
              </div>
            </div>
          )}

          {/* 得分拆解 */}
          {m.dimensions && m.dimensions.length > 0 && (
            <div>
              <div className="text-xs text-text-muted font-medium mb-2 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                得分拆解
              </div>
              <div className="grid grid-cols-2 gap-2">
                {m.dimensions.map((dim) => (
                  <div key={dim.key} className="p-2 bg-bg-secondary rounded border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-secondary">{dim.label}</span>
                      <span className={`text-xs font-medium ${dim.key === 'penalty' ? 'text-red-400' : 'text-text-primary'}`}>
                        {dim.score}/{dim.max}
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dim.key === 'penalty'
                            ? 'bg-red-500'
                            : dim.score / dim.max > 0.7
                            ? 'bg-green-500'
                            : dim.score / dim.max > 0.4
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${dim.key === 'penalty' ? (dim.max > 0 ? (1 - dim.score / dim.max) * 100 : 0) : (dim.max > 0 ? (dim.score / dim.max) * 100 : 0)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">{dim.explain}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 强项与短板 */}
          {(m.highlights?.length || m.improvements?.length) ? (
            <div className="grid grid-cols-2 gap-3">
              {m.highlights && m.highlights.length > 0 && (
                <div>
                  <div className="text-xs text-green-400 font-medium mb-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    做得好的
                  </div>
                  <ul className="space-y-1">
                    {m.highlights.map((h, i) => (
                      <li key={i} className="text-xs text-text-secondary flex items-start gap-1">
                        <span className="text-green-400 flex-shrink-0">•</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.improvements && m.improvements.length > 0 && (
                <div>
                  <div className="text-xs text-orange-400 font-medium mb-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    待改进
                  </div>
                  <ul className="space-y-1">
                    {m.improvements.map((imp, i) => (
                      <li key={i} className="text-xs text-text-secondary flex items-start gap-1">
                        <span className="text-orange-400 flex-shrink-0">•</span>
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {/* 错误操作详情 */}
          {m.error_operations && m.error_operations.length > 0 && (
            <div>
              <div className="text-xs text-text-muted font-medium mb-2 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" />
                错误操作详情（最近一次）
              </div>
              <div className="space-y-1">
                {m.error_operations.map((op, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-bg-secondary rounded border border-red-500/20">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-text-secondary flex-1">
                      {op.action || '参数调整'}
                      {op.parameterChange && (
                        <span className="text-text-muted ml-1">
                          ({op.parameterChange.param}: {op.parameterChange.from} → {op.parameterChange.to})
                        </span>
                      )}
                    </span>
                    {op.timestamp != null && (
                      <span className="text-[10px] text-text-muted">{fmtTime(op.timestamp)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 高频错误模式 */}
          {m.top_error_patterns && m.top_error_patterns.length > 0 && (
            <div>
              <div className="text-xs text-text-muted font-medium mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                高频错误模式（累计{m.total_attempts ?? 0}次练习）
              </div>
              <div className="flex flex-wrap gap-2">
                {m.top_error_patterns.map((ep, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded">
                    <span className="text-xs text-text-secondary">{ep.action}</span>
                    <span className="text-[10px] text-red-400 font-medium">×{ep.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 专家经验建议 */}
          {expertExp && (
            <div className="border border-purple-500/30 rounded-lg p-3 bg-purple-500/5">
              <div className="text-xs text-purple-400 font-medium mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                老师傅经验指导
              </div>
              {expertExp.master_insight && (
                <p className="text-xs text-purple-300 italic mb-2">"{expertExp.master_insight}"</p>
              )}
              {expertExp.common_mistakes?.length > 0 && (
                <div className="space-y-1">
                  {expertExp.common_mistakes.map((cm, i) => (
                    <div key={i} className="text-xs">
                      <span className="text-red-400">✗ {cm.mistake}</span>
                      <span className="text-text-muted"> → </span>
                      <span className="text-green-400">✓ {cm.correct_alternative}</span>
                    </div>
                  ))}
                </div>
              )}
              {expertExp.rhythm && (
                <div className="text-xs text-text-muted mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  节奏：{expertExp.rhythm}
                </div>
              )}
            </div>
          )}

          {/* 成绩轨迹 */}
          {m.score_history && m.score_history.length > 1 && (
            <div>
              <div className="text-xs text-text-muted font-medium mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                成绩轨迹
              </div>
              <div className="flex items-end gap-1 h-20">
                {m.score_history.slice().reverse().map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[9px] text-text-muted group-hover:text-text-primary">{h.score}</div>
                    <div
                      className={`w-full rounded-t transition-all ${
                        h.grade === 'S' ? 'bg-yellow-400' :
                        h.grade === 'A' ? 'bg-green-400' :
                        h.grade === 'B' ? 'bg-blue-400' :
                        h.grade === 'C' ? 'bg-orange-400' : 'bg-red-400'
                      }`}
                      style={{ height: `${h.score}%`, minHeight: '4px' }}
                      title={`${h.grade}级 ${h.score}分 ${fmtDur(h.duration_sec)}`}
                    />
                    <div className="text-[8px] text-text-muted">{fmtTime(h.created_at).split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
