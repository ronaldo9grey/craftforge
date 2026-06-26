// 学习分析页 (Learning Analytics)
// 数据来源：/api/analytics/me/weakness + /api/analytics/me/radar
// 展示：概览卡片 / 能力雷达+提升建议 / 场景弱点表 / 故障掌握+参数调偏 / 评分维度分布

import { useEffect, useState } from 'react';
import {
  analyticsApi,
  type WeaknessResponse,
  type RadarResponse,
  type SceneWeakness,
  type FaultDifficulty,
  type ParameterError,
  type Recommendation,
} from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { SCENES } from '@/templates';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Activity,
  Target,
  Clock,
  Brain,
  Radar as RadarIcon,
  Lightbulb,
  Wrench,
  Gauge,
  Play,
  CheckCircle2,
  Table2,
  BarChart3,
  XCircle,
} from 'lucide-react';

// =============================================================
// 工具函数 & 常量
// =============================================================

/** 时长格式化：秒 -> X分Y秒 */
const fmtDur = (s: number) => `${Math.floor(s / 60)}分${s % 60}秒`;

/** 雷达图 5 个维度的标准顺序（顶点从正上方顺时针排列） */
const RADAR_DIMS = ['基础工况', '操作准确度', '响应速度', '知识掌握', '稳定性'];

/** 评分维度分布（Row5）：key -> 中文标签，penalty 为"越低越好"需反转 */
const DIM_ROWS: { key: string; label: string; invert?: boolean }[] = [
  { key: 'baseScore', label: '基础工况' },
  { key: 'stepScore', label: '操作准确度' },
  { key: 'speedScore', label: '响应速度' },
  { key: 'penalty', label: '错误扣分', invert: true },
];

/** 用 SCENES 注册表解析场景显示名，回退到后端给的 scene_name */
const sceneName = (id: string, fallback?: string) =>
  SCENES[id]?.meta?.name ?? fallback ?? id;

/** 取场景图标，未注册返回默认工厂图标 */
const sceneIcon = (id: string) => SCENES[id]?.meta?.icon ?? '🏭';

/** 趋势字符串 -> {箭头, 颜色类} */
function trendMeta(trend: string): { arrow: string; cls: string } {
  switch (trend) {
    case 'improving':
      return { arrow: '↗', cls: 'text-green-400' };
    case 'declining':
      return { arrow: '↘', cls: 'text-red-400' };
    default:
      return { arrow: '→', cls: 'text-text-muted' };
  }
}

/** 平均分进度条颜色：<60 红，60-75 黄，>75 绿 */
function scoreBarColor(score: number): string {
  if (score < 60) return 'bg-red-500';
  if (score <= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

/** 等级徽章配色 */
const GRADE_CLS: Record<string, string> = {
  S: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/40',
  A: 'bg-green-400/20 text-green-400 border-green-400/40',
  B: 'bg-blue-400/20 text-blue-400 border-blue-400/40',
  C: 'bg-orange-400/20 text-orange-400 border-orange-400/40',
  D: 'bg-red-400/20 text-red-400 border-red-400/40',
};

/** 弱点标签配色：按字符串 hash 在调色板中取色，保证同一标签颜色稳定 */
const TAG_COLORS = [
  'bg-red-500/15 text-red-400 border-red-500/30',
  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'bg-pink-500/15 text-pink-400 border-pink-500/30',
];
const tagColor = (tag: string) => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
};

/** 建议优先级 -> 左边框颜色 / 标签 */
const priorityMeta = (p: string): { color: string; label: string; text: string } => {
  if (p === 'high') return { color: '#ef4444', label: '高优先', text: 'text-red-400' };
  if (p === 'medium') return { color: '#eab308', label: '中优先', text: 'text-yellow-400' };
  return { color: '#22c55e', label: '低优先', text: 'text-green-400' };
};

// =============================================================
// 主页面
// =============================================================

export const LearningAnalyticsPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setPage = usePageStore((s) => s.setPage);
  const setActiveTemplate = useUIStore((s) => s.setActiveTemplate);
  const loadTemplate = useEquipmentStore((s) => s.loadTemplate);
  const loadKnowledge = useAIStore((s) => s.loadKnowledge);
  const clearMessages = useAIStore((s) => s.clearMessages);

  const [weak, setWeak] = useState<WeaknessResponse | null>(null);
  const [radar, setRadar] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, r] = await Promise.all([
        analyticsApi.myWeakness(),
        analyticsApi.myRadar(),
      ]);
      setWeak(w);
      setRadar(r);
    } catch (e: any) {
      setError(e?.message ?? '加载学习数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 跳转到对应场景工作台练习（建议卡 / 未掌握故障共用） */
  const goPractice = (sceneId: string) => {
    setActiveTemplate(sceneId);
    loadTemplate(sceneId);
    loadKnowledge(sceneId);
    clearMessages();
    setPage('workbench');
  };

  // 知识掌握率：取雷达"知识掌握"维度 score/max
  const knowledgeItem = radar?.radar.find((d) => d.dimension === '知识掌握');
  const knowledgeRate = knowledgeItem && knowledgeItem.max > 0
    ? Math.round((knowledgeItem.score / knowledgeItem.max) * 100)
    : 0;

  return (
    <div className="h-screen overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-7xl mx-auto p-8 pb-20 space-y-6">
        {/* ---------- 顶部 ---------- */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('dashboard')}
              className="p-2 text-text-muted hover:text-text-primary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="w-6 h-6 text-primary" />
                学习分析
              </h1>
              <p className="text-sm text-text-muted mt-0.5">
                {user?.display_name
                  ? `${user.display_name} 的学习数据画像`
                  : '你的学习数据画像'}
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

        {/* ---------- 加载中 ---------- */}
        {loading && (
          <div className="py-24 flex flex-col items-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm">正在加载学习数据…</span>
          </div>
        )}

        {/* ---------- 加载失败 ---------- */}
        {!loading && error && (
          <div className="py-16 text-center bg-bg-secondary border border-danger/40 rounded-lg">
            <XCircle className="w-8 h-8 text-danger mx-auto mb-2" />
            <p className="text-sm text-danger mb-3">{error}</p>
            <button
              onClick={() => void load()}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg"
            >
              重试
            </button>
          </div>
        )}

        {/* ---------- 空状态 ---------- */}
        {!loading && !error && weak && weak.total_drills === 0 && (
          <div className="py-24 text-center bg-bg-secondary border border-border rounded-lg">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-sm text-text-muted">
              暂无演练记录，完成演练后可查看学习分析
            </p>
            <button
              onClick={() => setPage('gallery')}
              className="mt-4 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              去演练
            </button>
          </div>
        )}

        {/* ---------- 主体内容 ---------- */}
        {!loading && !error && weak && weak.total_drills > 0 && (
          <>
            {/* Row 1: 概览卡片 */}
            <div className="grid grid-cols-4 gap-4">
              <SummaryCard
                icon={<Activity className="w-5 h-5 text-cyan-400" />}
                label="总演练次数"
                value={String(weak.total_drills)}
                sub="次"
                trend={weak.score_trend}
              />
              <SummaryCard
                icon={<Target className="w-5 h-5 text-blue-400" />}
                label="平均得分"
                value={String(Math.round(weak.avg_score))}
                sub="分"
                trend={weak.score_trend}
              />
              <SummaryCard
                icon={<Clock className="w-5 h-5 text-purple-400" />}
                label="平均用时"
                value={fmtDur(weak.time_analysis.avg_duration)}
                trend={weak.time_analysis.trend}
              />
              <SummaryCard
                icon={<Brain className="w-5 h-5 text-green-400" />}
                label="知识掌握率"
                value={`${knowledgeRate}%`}
              />
            </div>

            {/* Row 2: 能力雷达 + 提升建议 */}
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-2 bg-bg-secondary border border-border rounded-lg p-4">
                <SectionTitle
                  icon={<RadarIcon className="w-4 h-4 text-cyan-400" />}
                  title="能力雷达"
                />
                <RadarChart data={radar} />
              </div>
              <div className="col-span-3 bg-bg-secondary border border-border rounded-lg p-4">
                <SectionTitle
                  icon={<Lightbulb className="w-4 h-4 text-yellow-400" />}
                  title="提升建议"
                  extra={
                    <span className="text-xs text-text-muted">
                      共 {weak.recommendations.length} 条
                    </span>
                  }
                />
                <Recommendations
                  items={weak.recommendations}
                  onPractice={goPractice}
                />
              </div>
            </div>

            {/* Row 3: 场景弱点表 */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <SectionTitle
                icon={<Table2 className="w-4 h-4 text-blue-400" />}
                title="场景弱点分析"
                extra={
                  <span className="text-xs text-text-muted">按平均分升序（最弱在前）</span>
                }
              />
              <SceneWeaknessTable rows={weak.scene_weakness} />
            </div>

            {/* Row 4: 故障掌握 + 参数调偏 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-secondary border border-border rounded-lg p-4">
                <SectionTitle
                  icon={<Wrench className="w-4 h-4 text-orange-400" />}
                  title="故障掌握情况"
                />
                <FaultList
                  items={weak.fault_difficulty}
                  onPractice={goPractice}
                />
              </div>
              <div className="bg-bg-secondary border border-border rounded-lg p-4">
                <SectionTitle
                  icon={<Gauge className="w-4 h-4 text-cyan-400" />}
                  title="参数调偏分析"
                />
                <ParamErrorList items={weak.parameter_errors} />
              </div>
            </div>

            {/* Row 5: 评分维度分布 */}
            <div className="bg-bg-secondary border border-border rounded-lg p-4">
              <SectionTitle
                icon={<BarChart3 className="w-4 h-4 text-purple-400" />}
                title="评分维度分布"
              />
              <DimensionBars scores={weak.dimension_scores} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================
// 子组件
// =============================================================

/** 趋势箭头 */
const TrendArrow: React.FC<{ trend?: string }> = ({ trend }) => {
  if (!trend) return null;
  const t = trendMeta(trend);
  return <span className={`text-sm font-semibold ${t.cls}`}>{t.arrow}</span>;
};

/** 区块标题 */
const SectionTitle: React.FC<{
  icon: React.ReactNode;
  title: string;
  extra?: React.ReactNode;
}> = ({ icon, title, extra }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-semibold flex items-center gap-2">
      {icon}
      {title}
    </h3>
    {extra}
  </div>
);

/** 概览卡片 */
const SummaryCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: string;
}> = ({ icon, label, value, sub, trend }) => {
  const t = trend ? trendMeta(trend) : null;
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        {sub && <span className="text-xs text-text-muted">{sub}</span>}
        {t && <span className={`text-lg font-semibold ${t.cls}`}>{t.arrow}</span>}
      </div>
    </div>
  );
};

/** 能力雷达图（纯 SVG，内联样式） */
const RadarChart: React.FC<{ data: RadarResponse | null }> = ({ data }) => {
  const cx = 160;
  const cy = 160;
  const R = 100; // 数据最大半径
  const labelR = 128; // 标签半径
  const gridLevels = [0.33, 0.66, 1];

  /** 计算第 i 个顶点在半径 r 处的坐标 */
  const pt = (i: number, r: number): [number, number] => {
    const a = ((-90 + i * 72) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const toPoly = (r: number) =>
    RADAR_DIMS.map((_, i) => {
      const [x, y] = pt(i, r);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  // 各维度得分占比（score/max）
  const ratios = RADAR_DIMS.map((dim) => {
    const item = data?.radar.find((d) => d.dimension === dim);
    return item && item.max > 0 ? Math.min(item.score / item.max, 1) : 0;
  });
  const dataPts = ratios.map((ratio, i) => pt(i, R * ratio));
  const dataPoly = dataPts
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  return (
    <div className="flex justify-center">
      <svg
        width={320}
        height={320}
        viewBox="0 0 320 320"
        style={{ display: 'block' }}
      >
        {/* 网格五边形（3 层） */}
        {gridLevels.map((lv, idx) => (
          <polygon
            key={idx}
            points={toPoly(R * lv)}
            fill="none"
            stroke="#334155"
            strokeWidth={1}
            style={{ opacity: 0.6 }}
          />
        ))}
        {/* 轴线 */}
        {RADAR_DIMS.map((_, i) => {
          const [x, y] = pt(i, R);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="#334155"
              strokeWidth={1}
              style={{ opacity: 0.5 }}
            />
          );
        })}
        {/* 数据多边形 */}
        <polygon
          points={dataPoly}
          fill="rgba(34,211,238,0.22)"
          stroke="#22d3ee"
          strokeWidth={2}
        />
        {/* 数据顶点 */}
        {dataPts.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3.5}
            fill="#22d3ee"
            stroke="#0e7490"
            strokeWidth={1}
          />
        ))}
        {/* 维度标签 + 分值 */}
        {RADAR_DIMS.map((dim, i) => {
          const [x, y] = pt(i, labelR);
          const item = data?.radar.find((d) => d.dimension === dim);
          const val = item ? `${Math.round(item.score)}/${item.max}` : '-';
          const anchor = x > cx + 3 ? 'start' : x < cx - 3 ? 'end' : 'middle';
          return (
            <g key={dim}>
              <text
                x={x}
                y={y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={12}
                fill="#e2e8f0"
                style={{ fontWeight: 600 }}
              >
                {dim}
              </text>
              <text
                x={x}
                y={y + 14}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={10}
                fill="#64748b"
              >
                {val}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/** 提升建议列表 */
const Recommendations: React.FC<{
  items: Recommendation[];
  onPractice: (sceneId: string) => void;
}> = ({ items, onPractice }) => {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        暂无提升建议，继续保持！
      </div>
    );
  }
  return (
    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
      {items.map((rec, i) => {
        const pm = priorityMeta(rec.priority);
        return (
          <div
            key={i}
            className="bg-bg-tertiary border border-border rounded-r-lg p-3"
            style={{ borderLeft: '4px solid', borderLeftColor: pm.color }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary ${pm.text} flex-shrink-0`}
                >
                  {pm.label}
                </span>
                {rec.scene_name && (
                  <span className="text-xs text-text-muted truncate">
                    {rec.scene_name}
                  </span>
                )}
              </div>
              {rec.scene_id && (
                <button
                  onClick={() => onPractice(rec.scene_id!)}
                  className="px-2.5 py-1 text-xs bg-primary hover:bg-primary/90 text-white rounded flex items-center gap-1 flex-shrink-0"
                >
                  <Play className="w-3 h-3" />
                  去练习
                </button>
              )}
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{rec.reason}</p>
            <p className="text-xs text-text-secondary mt-1.5 flex items-start gap-1">
              <Lightbulb className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
              {rec.suggested_action}
            </p>
          </div>
        );
      })}
    </div>
  );
};

/** 场景弱点表 */
const SceneWeaknessTable: React.FC<{ rows: SceneWeakness[] }> = ({ rows }) => {
  const sorted = [...rows].sort((a, b) => a.avg_score - b.avg_score);
  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">暂无场景数据</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted text-xs border-b border-border">
            <th className="text-left py-2 px-2 font-medium">场景</th>
            <th className="text-center py-2 px-2 font-medium">演练次数</th>
            <th className="text-left py-2 px-2 font-medium w-[26%]">平均分</th>
            <th className="text-center py-2 px-2 font-medium">最佳分</th>
            <th className="text-center py-2 px-2 font-medium">平均用时</th>
            <th className="text-center py-2 px-2 font-medium">趋势</th>
            <th className="text-left py-2 px-2 font-medium">弱点标签</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const t = trendMeta(r.score_trend);
            return (
              <tr
                key={r.scene_id}
                className="border-b border-border/50 hover:bg-bg-tertiary/50"
              >
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <span>{sceneIcon(r.scene_id)}</span>
                    <span className="font-medium">
                      {sceneName(r.scene_id, r.scene_name)}
                    </span>
                  </div>
                </td>
                <td className="text-center py-2.5 px-2 text-text-secondary">
                  {r.drill_count}
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${scoreBarColor(r.avg_score)}`}
                        style={{ width: `${Math.min(r.avg_score, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-9 text-right">
                      {Math.round(r.avg_score)}
                    </span>
                  </div>
                </td>
                <td className="text-center py-2.5 px-2 font-medium">
                  {Math.round(r.best_score)}
                </td>
                <td className="text-center py-2.5 px-2 text-text-secondary">
                  {fmtDur(r.avg_duration)}
                </td>
                <td className="text-center py-2.5 px-2">
                  <span className={`text-base font-semibold ${t.cls}`}>{t.arrow}</span>
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex flex-wrap gap-1">
                    {r.weakness_tags.length === 0 ? (
                      <span className="text-xs text-text-muted">-</span>
                    ) : (
                      r.weakness_tags.map((tag) => (
                        <span
                          key={tag}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${tagColor(
                            tag,
                          )}`}
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** 故障掌握情况列表 */
const FaultList: React.FC<{
  items: FaultDifficulty[];
  onPractice: (sceneId: string) => void;
}> = ({ items, onPractice }) => {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">暂无故障数据</div>
    );
  }
  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
      {items.map((f) => {
        const grade = f.best_grade || '-';
        const gcls =
          GRADE_CLS[grade] ?? 'bg-bg-tertiary text-text-secondary border-border';
        return (
          <div
            key={`${f.scene_id}-${f.fault_id}`}
            className="bg-bg-tertiary border border-border rounded-lg p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded border ${gcls} flex-shrink-0`}
                >
                  {grade}
                </span>
                <span className="text-sm font-medium truncate">{f.fault_name}</span>
                {f.is_mastered && (
                  <span className="text-[10px] text-green-400 flex items-center gap-0.5 flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    已掌握
                  </span>
                )}
              </div>
              {!f.is_mastered && (
                <button
                  onClick={() => onPractice(f.scene_id)}
                  className="px-2.5 py-1 text-xs bg-primary hover:bg-primary/90 text-white rounded flex items-center gap-1 flex-shrink-0"
                >
                  <Play className="w-3 h-3" />
                  去练习
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted mt-1.5 flex-wrap">
              <span className="flex items-center gap-1">
                <span>{sceneIcon(f.scene_id)}</span>
                {sceneName(f.scene_id, f.scene_name)}
              </span>
              <span>尝试 {f.attempt_count} 次</span>
              <span>均分 {Math.round(f.avg_score)}</span>
              <span>用时 {fmtDur(f.avg_duration)}</span>
            </div>
            {f.common_errors.length > 0 && (
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                <span className="text-text-muted">常见错误：</span>
                {f.common_errors.join('；')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** 参数调偏分析列表 */
const ParamErrorList: React.FC<{ items: ParameterError[] }> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">
        暂无参数调偏数据
      </div>
    );
  }
  const maxCount = Math.max(...items.map((p) => p.error_count), 1);
  return (
    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
      {items.map((p) => {
        const dirText = p.direction === 'high' ? '偏高↑' : '偏低↓';
        const dirCls = p.direction === 'high' ? 'text-red-400' : 'text-blue-400';
        const barColor = p.direction === 'high' ? 'bg-red-500' : 'bg-blue-500';
        const widthPct = Math.round((p.error_count / maxCount) * 100);
        return (
          <div
            key={`${p.scene_id}-${p.param_id}`}
            className="bg-bg-tertiary border border-border rounded-lg p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Gauge className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-sm font-medium truncate">{p.param_name}</span>
              </div>
              <span className={`text-xs font-semibold ${dirCls} flex-shrink-0`}>
                {dirText}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted mb-2">
              <span className="flex items-center gap-1">
                <span>{sceneIcon(p.scene_id)}</span>
                {sceneName(p.scene_id, p.scene_name)}
              </span>
              <span>偏差 {Math.abs(p.avg_deviation).toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary w-16 text-right">
                {p.error_count} 次
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 评分维度分布条 */
const DimensionBars: React.FC<{
  scores: Record<string, { avg: number; max: number; trend: string }>;
}> = ({ scores }) => {
  const rows = DIM_ROWS.map((d) => ({ ...d, data: scores[d.key] })).filter(
    (r) => r.data,
  );
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-text-muted">暂无维度数据</div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      {rows.map((r) => {
        const { avg, max, trend } = r.data;
        const ratio = max > 0 ? avg / max : 0;
        // penalty 越低越好：反转（扣分越少条越满）
        const pct = r.invert
          ? Math.round((1 - ratio) * 100)
          : Math.round(ratio * 100);
        const barColor = r.invert
          ? ratio >= 0.5
            ? 'bg-red-500'
            : ratio >= 0.25
            ? 'bg-yellow-500'
            : 'bg-green-500'
          : pct >= 75
          ? 'bg-green-500'
          : pct >= 60
          ? 'bg-yellow-500'
          : 'bg-red-500';
        return (
          <div key={r.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium flex items-center gap-1.5">
                {r.label}
                {r.invert && (
                  <span className="text-[10px] text-text-muted">(越低越好)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">
                  {Math.round(avg)} / {max}
                </span>
                <TrendArrow trend={trend} />
              </div>
            </div>
            <div className="h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div
                className={`h-full ${barColor} transition-all`}
                style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
