// 班级学习分析页 (Teacher Class Analytics) - 深化版
// 面向教师：全景掌握所辖班级的学习状况
// 数据来源：/api/teacher/dashboard (班级列表) + /api/analytics/teacher/class/:id/overview (单班分析概览)
// 深化维度：成绩等级分布 / 能力维度雷达 / 14天活跃度趋势 / 错题热点 / 优秀学员 / 需关注学员 / 全班明细 / AI深度洞察

import { useEffect, useState, useCallback } from 'react';
import {
  analyticsApi,
  teacherApi,
  type ClassAnalyticsResponse,
  type ClassDashboard,
  type AIInsightResponse,
} from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import {
  ArrowLeft,
  BarChart3,
  Users,
  Trophy,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  BookOpen,
  Clock,
  Award,
  UserCheck,
  Sparkles,
  Flame,
  PieChart as PieIcon,
} from 'lucide-react';

// =============================================================
// 局部类型
// =============================================================
type Dim = { key: string; label: string; avg: number; max: number; rate: number };
type Fault = {
  fault_id: string;
  fault_name: string;
  scene_id: string;
  scene_name: string;
  fail_count: number;
  total_count: number;
  fail_rate: number;
  open_mistakes: number;
};
type AllStudent = {
  user_id: string;
  name: string;
  avg_score: number;
  best_score: number;
  drill_count: number;
  s_count: number;
  trend: string;
  last_drill_at: number;
};
type TrendPoint = { date: string; drill_count: number; avg_score: number };

// =============================================================
// 工具函数 & 常量
// =============================================================

/** 时间戳 -> "M月D日 HH:MM" */
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** 日期字符串 -> "M/D"（用于趋势横轴） */
const fmtDateShort = (d: string) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d.length > 5 ? d.slice(5) : d;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
};

/** 趋势字符串 -> {图标节点, 颜色类} */
function trendMeta(trend: string): { node: React.ReactNode; cls: string } {
  switch (trend) {
    case 'improving':
      return { node: <TrendingUp className="w-4 h-4" />, cls: 'text-green-400' };
    case 'declining':
      return { node: <TrendingDown className="w-4 h-4" />, cls: 'text-red-400' };
    default:
      return { node: <Minus className="w-4 h-4" />, cls: 'text-text-muted' };
  }
}

/** 平均分进度条颜色：<60 红，60-75 黄，>75 绿 */
function scoreBarColor(score: number): string {
  if (score < 60) return 'bg-red-500';
  if (score <= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

/** 前三名名次徽章配色：金 / 银 / 铜 */
const RANK_BADGE: Record<number, string> = {
  1: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/50',
  2: 'bg-slate-300/20 text-slate-300 border-slate-300/50',
  3: 'bg-orange-400/20 text-orange-400 border-orange-400/50',
};

/** 风险等级 -> 徽章配色 + 文案 */
function riskBadge(level: string): { cls: string; label: string } {
  if (level === 'high')
    return { cls: 'bg-red-500/20 text-red-400 border-red-500/50', label: '高风险' };
  if (level === 'medium')
    return { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', label: '中风险' };
  return { cls: 'bg-bg-tertiary text-text-secondary border-border', label: level || '关注' };
}

/** 成绩等级颜色 */
const GRADE_COLORS: Record<string, string> = {
  S: '#fbbf24',
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f97316',
  D: '#ef4444',
};
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'];

/** 由活跃度趋势推导班级均分整体走向 */
function computeScoreTrend(trend?: TrendPoint[]): 'up' | 'down' | 'stable' | null {
  if (!trend || trend.length < 2) return null;
  const first = trend[0].avg_score;
  const last = trend[trend.length - 1].avg_score;
  if (last > first + 1) return 'up';
  if (last < first - 1) return 'down';
  return 'stable';
}

/** 失败率兼容 0~1 与 0~100 两种存储格式 */
function failRatePct(rate: number): number {
  if (rate <= 1) return Math.round(rate * 100);
  return Math.round(rate);
}

// =============================================================
// Markdown 轻量渲染（仅用于 AI 洞察文本）
// =============================================================

/** 行内 **加粗** 渲染 */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-cyan-300 font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** 将 Markdown 文本按行渲染为带样式的 JSX */
const MarkdownInsight: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        // 形如 "1. 标题" / "1、标题" 视为小节标题
        if (/^\d+[.、]\s+/.test(trimmed)) {
          const content = trimmed.replace(/^\d+[.、]\s+/, '');
          return (
            <div
              key={i}
              className="text-sm font-semibold text-cyan-300 mt-4 first:mt-0 flex items-start gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-purple-400" />
              <span>{renderInline(content)}</span>
            </div>
          );
        }
        // 无序列表项
        if (/^[-•]\s+/.test(trimmed)) {
          return (
            <div key={i} className="text-sm text-text-secondary pl-5 flex gap-2 leading-relaxed">
              <span className="text-cyan-400 mt-0.5">•</span>
              <span>{renderInline(trimmed.replace(/^[-•]\s+/, ''))}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm text-text-secondary leading-relaxed pl-5">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

// =============================================================
// 主页面
// =============================================================

export const TeacherAnalyticsPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setPage = usePageStore((s) => s.setPage);

  const [classes, setClasses] = useState<ClassDashboard[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [analyticsMap, setAnalyticsMap] = useState<Record<string, ClassAnalyticsResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI 深度洞察
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  /** 加载班级列表 + 全部班级的分析概览（并行） */
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { dashboard } = await teacherApi.dashboard();
      setClasses(dashboard);
      if (dashboard.length === 0) {
        setAnalyticsMap({});
        return;
      }
      // 默认选中第一个班级；若当前选中仍存在则保持
      setSelectedClassId((prev) =>
        prev && dashboard.some((c) => c.class_id === prev) ? prev : dashboard[0].class_id,
      );
      // 并行拉取每个班级的学习分析概览，单个失败不阻塞其它班级
      const entries = await Promise.all(
        dashboard.map(async (c): Promise<[string, ClassAnalyticsResponse | null]> => {
          try {
            const ov = await analyticsApi.classOverview(c.class_id);
            return [c.class_id, ov];
          } catch {
            return [c.class_id, null];
          }
        }),
      );
      const map: Record<string, ClassAnalyticsResponse> = {};
      for (const [id, ov] of entries) {
        if (ov) map[id] = ov;
      }
      setAnalyticsMap(map);
    } catch (e: any) {
      setError(e?.message ?? '加载班级数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /** 触发 AI 深度洞察（按需加载，不自动） */
  const loadAIInsight = useCallback(async () => {
    if (!selectedClassId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res: AIInsightResponse = await analyticsApi.aiInsight(selectedClassId);
      setAiInsight(res.insight);
    } catch (e: any) {
      setAiError(e?.message ?? 'AI洞察生成失败');
    } finally {
      setAiLoading(false);
    }
  }, [selectedClassId]);

  // 切换班级时清空上一次的 AI 洞察（洞察与班级绑定）
  useEffect(() => {
    setAiInsight(null);
    setAiError(null);
  }, [selectedClassId]);

  const selectedClass = classes.find((c) => c.class_id === selectedClassId) ?? null;
  const analytics = selectedClassId ? analyticsMap[selectedClassId] ?? null : null;
  const scoreTrend = computeScoreTrend(analytics?.activity_trend);

  return (
    <div className="h-screen overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-7xl mx-auto p-8 pb-20 space-y-6">
        {/* ---------- 顶部 ---------- */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('dashboard')}
              className="p-2 text-text-muted hover:text-text-primary"
              title="返回"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-cyan-400" />
                班级学习分析
              </h1>
              <p className="text-sm text-text-muted mt-0.5">
                {user?.display_name ? `${user.display_name} · ` : ''}
                {selectedClass?.class_name ?? '班级'}学习全景
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {classes.length > 1 && (
              <select
                value={selectedClassId ?? ''}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                {classes.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name}（{c.student_count} 人）
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => void loadAll()}
              className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>
            <button
              onClick={() => void loadAIInsight()}
              disabled={aiLoading || !analytics}
              className="px-4 py-2 text-sm rounded-lg flex items-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' }}
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {aiLoading ? '分析中...' : 'AI深度洞察'}
            </button>
          </div>
        </div>

        {/* ---------- 加载中 ---------- */}
        {loading && (
          <div className="py-24 flex flex-col items-center gap-3 text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm">正在加载班级学习数据…</span>
          </div>
        )}

        {/* ---------- 加载失败 ---------- */}
        {!loading && error && (
          <div className="py-16 text-center bg-bg-secondary border border-danger/40 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2" />
            <p className="text-sm text-danger mb-3">{error}</p>
            <button
              onClick={() => void loadAll()}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg"
            >
              重试
            </button>
          </div>
        )}

        {/* ---------- 无班级 ---------- */}
        {!loading && !error && classes.length === 0 && (
          <div className="py-24 text-center bg-bg-secondary border border-border rounded-lg">
            <div className="text-5xl mb-3">📚</div>
            <p className="text-sm text-text-muted">还没有班级，无法查看学习分析</p>
            <button
              onClick={() => setPage('dashboard')}
              className="mt-4 px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg"
            >
              返回教学看板
            </button>
          </div>
        )}

        {/* ---------- 主体 ---------- */}
        {!loading && !error && classes.length > 0 && (
          <>
            {/* 该班级分析数据不可用 */}
            {!analytics && (
              <div className="py-16 text-center bg-bg-secondary border border-border rounded-lg">
                <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                <p className="text-sm text-text-muted mb-3">
                  {selectedClass?.class_name ?? '该班级'} 的分析数据暂不可用
                </p>
                <button
                  onClick={() => void loadAll()}
                  className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg"
                >
                  重新加载
                </button>
              </div>
            )}

            {/* 该班级无演练数据 */}
            {analytics && analytics.total_drills === 0 && (
              <div className="py-24 text-center bg-bg-secondary border border-border rounded-lg">
                <div className="text-5xl mb-3">📊</div>
                <p className="text-sm text-text-muted">
                  {selectedClass?.class_name ?? '该班级'} 暂无演练记录，学员完成演练后可查看分析
                </p>
              </div>
            )}

            {/* 有数据：完整看板 */}
            {analytics && analytics.total_drills > 0 && (
              <>
                {/* Row 1: 概览卡片 */}
                <div className="grid grid-cols-4 gap-4">
                  <SummaryCard
                    icon={<Users className="w-5 h-5 text-blue-400" />}
                    iconBg="bg-blue-400/15"
                    label="总学员数"
                    value={analytics.student_count}
                    sub="人"
                  />
                  <SummaryCard
                    icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}
                    iconBg="bg-cyan-400/15"
                    label="总演练次数"
                    value={analytics.total_drills}
                    sub="次"
                  />
                  <SummaryCard
                    icon={<Trophy className="w-5 h-5 text-yellow-400" />}
                    iconBg="bg-yellow-400/15"
                    label="班级均分"
                    value={Math.round(analytics.avg_score)}
                    sub="分"
                    trend={scoreTrend ?? undefined}
                  />
                  <SummaryCard
                    icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
                    iconBg="bg-red-400/15"
                    label="需关注学员"
                    value={analytics.at_risk_students.length}
                    sub="人"
                  />
                </div>

                {/* Row 2: 成绩等级分布 + 班级能力维度 */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-bg-secondary border border-border rounded-lg p-4">
                    <SectionTitle
                      icon={<PieIcon className="w-4 h-4 text-yellow-400" />}
                      title="成绩等级分布"
                      extra={
                        <span className="text-xs text-text-muted">S/A/B/C/D 五级</span>
                      }
                    />
                    <GradeDistributionChart data={analytics.grade_distribution} />
                  </div>
                  <div className="bg-bg-secondary border border-border rounded-lg p-4">
                    <SectionTitle
                      icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
                      title="班级能力维度"
                      extra={
                        <span className="text-xs text-text-muted">扣分项越低越好</span>
                      }
                    />
                    <RadarChart dimensions={analytics.class_dimensions} />
                  </div>
                </div>

                {/* Row 3: 活跃度趋势（整行） */}
                <div className="bg-bg-secondary border border-border rounded-lg p-4">
                  <SectionTitle
                    icon={<TrendingUp className="w-4 h-4 text-cyan-400" />}
                    title="近14天活跃度趋势"
                    extra={
                      <span className="text-xs text-text-muted">柱：演练次数 / 线：平均分</span>
                    }
                  />
                  <ActivityTrendChart data={analytics.activity_trend} />
                </div>

                {/* Row 4: 错题热点排行（60%） + 优秀学员榜（40%） */}
                <div className="grid grid-cols-5 gap-6">
                  <div className="col-span-3 bg-bg-secondary border border-border rounded-lg p-4">
                    <SectionTitle
                      icon={<Flame className="w-4 h-4 text-red-400" />}
                      title="班级错题热点"
                      extra={
                        <span className="text-xs text-text-muted">按失败次数排序</span>
                      }
                    />
                    <FaultHotspots items={analytics.fault_hotspots} />
                  </div>
                  <div className="col-span-2 bg-bg-secondary border border-border rounded-lg p-4">
                    <SectionTitle
                      icon={<Award className="w-4 h-4 text-yellow-400" />}
                      title="优秀学员榜"
                    />
                    <TopStudentsList items={analytics.top_students} />
                  </div>
                </div>

                {/* Row 5: 需关注学员（整行，红色强调） */}
                <div
                  className="bg-bg-secondary border rounded-lg p-4"
                  style={{ borderColor: 'rgba(239,68,68,0.25)' }}
                >
                  <SectionTitle
                    icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                    title="需关注学员"
                    extra={
                      <span className="text-xs text-text-muted">
                        共 {analytics.at_risk_students.length} 人
                      </span>
                    }
                  />
                  <AtRiskList items={analytics.at_risk_students} />
                </div>

                {/* Row 6: 全班学员明细（整行） */}
                <div className="bg-bg-secondary border border-border rounded-lg p-4">
                  <SectionTitle
                    icon={<BookOpen className="w-4 h-4 text-blue-400" />}
                    title="全班学员明细"
                    extra={
                      <span className="text-xs text-text-muted">按平均分降序</span>
                    }
                  />
                  <AllStudentsTable items={analytics.all_students} />
                </div>

                {/* Row 7: AI深度洞察（仅有内容或加载中时显示） */}
                {(aiInsight !== null || aiLoading) && (
                  <div
                    className="bg-bg-secondary border rounded-lg p-5"
                    style={{ borderColor: 'rgba(139,92,246,0.4)' }}
                  >
                    <SectionTitle
                      icon={<Sparkles className="w-4 h-4 text-purple-400" />}
                      title="AI深度洞察"
                      extra={
                        <span className="text-xs text-text-muted">基于班级全维度数据生成</span>
                      }
                    />
                    {aiLoading ? (
                      <div className="py-10 flex flex-col items-center gap-3 text-text-muted">
                        <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
                        <span className="text-sm">AI正在分析班级数据...</span>
                      </div>
                    ) : aiInsight !== null ? (
                      <div className="bg-bg-tertiary border border-border rounded-lg p-4">
                        <MarkdownInsight text={aiInsight} />
                      </div>
                    ) : null}
                    {aiError && <p className="text-sm text-danger mt-3">{aiError}</p>}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================
// 子组件
// =============================================================

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

/** 概览卡片（可选趋势箭头） */
const SummaryCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'stable';
}> = ({ icon, iconBg, label, value, sub, trend }) => {
  const trendNode =
    trend === 'up' ? (
      <TrendingUp className="w-4 h-4 text-green-400" />
    ) : trend === 'down' ? (
      <TrendingDown className="w-4 h-4 text-red-400" />
    ) : trend === 'stable' ? (
      <Minus className="w-4 h-4 text-text-muted" />
    ) : null;
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-text-muted">{label}</span>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        {sub && <span className="text-xs text-text-muted">{sub}</span>}
        {trendNode && <span className="ml-auto">{trendNode}</span>}
      </div>
    </div>
  );
};

/** 成绩等级分布 —— SVG 柱状图 */
const GradeDistributionChart: React.FC<{ data?: Record<string, number> }> = ({ data }) => {
  const counts = GRADE_ORDER.map((g) => data?.[g] ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...counts, 1);

  const W = 300;
  const H = 200;
  const barW = 36;
  const gap = 20;
  const startX = 20;
  const baseY = 160;
  const topY = 30;
  const areaH = baseY - topY;

  if (!data || total === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-text-muted">
        暂无成绩分布数据
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
      <line x1={startX - 6} y1={baseY} x2={W - startX + 6} y2={baseY} stroke="rgba(255,255,255,0.12)" />
      {GRADE_ORDER.map((g, i) => {
        const c = counts[i];
        const h = (c / maxCount) * areaH;
        const x = startX + i * (barW + gap);
        const y = baseY - h;
        const pct = total > 0 ? Math.round((c / total) * 100) : 0;
        const color = GRADE_COLORS[g];
        return (
          <g key={g}>
            {c > 0 && (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fill="#e5e7eb"
                fontWeight="600"
              >
                {c}
              </text>
            )}
            <rect x={x} y={y} width={barW} height={h} rx={4} fill={color} opacity={0.9} />
            <text
              x={x + barW / 2}
              y={baseY + 15}
              textAnchor="middle"
              fontSize="12"
              fill={color}
              fontWeight="700"
            >
              {g}
            </text>
            <text
              x={x + barW / 2}
              y={baseY + 30}
              textAnchor="middle"
              fontSize="10"
              fill="#9ca3af"
            >
              {pct}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/** 班级能力维度 —— SVG 四轴菱形雷达 */
const RadarChart: React.FC<{ dimensions?: Dim[] }> = ({ dimensions }) => {
  const W = 280;
  const H = 280;
  const cx = 140;
  const cy = 140;
  const maxR = 80;
  const levels = 3;

  if (!dimensions || dimensions.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-text-muted">
        暂无能力维度数据
      </div>
    );
  }

  const n = dimensions.length;
  const angleAt = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angleAt(i)),
    y: cy + r * Math.sin(angleAt(i)),
  });

  /** 维度展示分值：扣分项取反（越低越好） */
  const displayRate = (d: Dim) => {
    const isPenalty = d.key === 'penalty' || d.label.includes('扣分');
    if (isPenalty) {
      const ratio = d.max > 0 ? d.avg / d.max : 0;
      return Math.max(0, Math.min(100, (1 - ratio) * 100));
    }
    return d.rate || (d.max > 0 ? (d.avg / d.max) * 100 : 0);
  };

  // 网格菱形
  const gridPolys: string[] = [];
  for (let l = 1; l <= levels; l++) {
    const r = (maxR * l) / levels;
    const pts = dimensions.map((_, i) => {
      const p = point(i, r);
      return `${p.x},${p.y}`;
    });
    gridPolys.push(pts.join(' '));
  }

  // 数据多边形
  const dataPts = dimensions.map((d, i) => {
    const r = (displayRate(d) / 100) * maxR;
    return point(i, r);
  });
  const dataPolyStr = dataPts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
      {/* 网格 */}
      {gridPolys.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
      ))}
      {/* 轴线 */}
      {dimensions.map((_, i) => {
        const p = point(i, maxR);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        );
      })}
      {/* 数据多边形 */}
      <polygon
        points={dataPolyStr}
        fill="rgba(34,211,238,0.2)"
        stroke="#22d3ee"
        strokeWidth={2}
      />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#22d3ee" />
      ))}
      {/* 维度标签 + 分值 */}
      {dimensions.map((d, i) => {
        const labelTop = point(i, maxR + 14);
        const labelBottom = point(i, maxR + 28);
        const rate = Math.round(displayRate(d));
        return (
          <g key={i}>
            <text
              x={labelTop.x}
              y={labelTop.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fill="#e5e7eb"
              fontWeight="600"
            >
              {d.label}
            </text>
            <text
              x={labelBottom.x}
              y={labelBottom.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#22d3ee"
            >
              {rate}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/** 活跃度趋势 —— SVG 柱+折线双轴图 */
const ActivityTrendChart: React.FC<{ data?: TrendPoint[] }> = ({ data }) => {
  const W = 900;
  const H = 200;
  const padL = 45;
  const padR = 45;
  const padT = 28;
  const padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const baseY = padT + chartH;

  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-text-muted">
        暂无活跃度趋势数据
      </div>
    );
  }

  const n = data.length;
  const step = chartW / n;
  const xAt = (i: number) => padL + step * (i + 0.5);
  const maxDrill = Math.max(...data.map((d) => d.drill_count), 1);
  const barW = Math.min(26, step * 0.5);
  const drillY = (v: number) => baseY - (v / maxDrill) * chartH;
  const scoreY = (v: number) => baseY - (Math.min(v, 100) / 100) * chartH;

  const gridLevels = [0, 0.25, 0.5, 0.75, 1];
  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${scoreY(d.avg_score)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
      {/* 图例 */}
      <g>
        <rect x={W - 230} y={6} width={12} height={12} fill="#22d3ee" rx={2} />
        <text x={W - 212} y={16} fontSize="11" fill="#9ca3af">
          演练次数
        </text>
        <line x1={W - 140} y1={12} x2={W - 118} y2={12} stroke="#facc15" strokeWidth={2} />
        <circle cx={W - 129} cy={12} r={3} fill="#facc15" />
        <text x={W - 110} y={16} fontSize="11" fill="#9ca3af">
          平均分
        </text>
      </g>

      {/* 网格线 */}
      {gridLevels.map((lv, i) => {
        const y = padT + chartH * lv;
        return (
          <line
            key={i}
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
          />
        );
      })}

      {/* 左轴刻度（演练次数） */}
      <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="9" fill="#6b7280">
        {maxDrill}
      </text>
      <text x={padL - 6} y={baseY + 3} textAnchor="end" fontSize="9" fill="#6b7280">
        0
      </text>
      {/* 右轴刻度（分数） */}
      <text x={W - padR + 6} y={padT + 4} textAnchor="start" fontSize="9" fill="#6b7280">
        100
      </text>
      <text x={W - padR + 6} y={baseY + 3} textAnchor="start" fontSize="9" fill="#6b7280">
        0
      </text>

      {/* 柱：演练次数 */}
      {data.map((d, i) => {
        const x = xAt(i);
        const y = drillY(d.drill_count);
        const h = baseY - y;
        return (
          <rect
            key={`b-${i}`}
            x={x - barW / 2}
            y={y}
            width={barW}
            height={h}
            fill="#22d3ee"
            opacity={0.65}
            rx={2}
          />
        );
      })}

      {/* 线：平均分 */}
      <path d={linePath} fill="none" stroke="#facc15" strokeWidth={2} />
      {data.map((d, i) => (
        <circle key={`p-${i}`} cx={xAt(i)} cy={scoreY(d.avg_score)} r={2.5} fill="#facc15" />
      ))}

      {/* 横轴日期 */}
      {data.map((d, i) => (
        <text
          key={`x-${i}`}
          x={xAt(i)}
          y={baseY + 16}
          textAnchor="middle"
          fontSize="9"
          fill="#6b7280"
        >
          {fmtDateShort(d.date)}
        </text>
      ))}
    </svg>
  );
};

/** 班级错题热点排行 */
const FaultHotspots: React.FC<{ items?: Fault[] }> = ({ items }) => {
  const sorted = [...(items ?? [])].sort((a, b) => b.fail_count - a.fail_count);
  if (sorted.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-text-muted">暂无错题热点数据</div>
    );
  }
  return (
    <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
      {sorted.map((f) => {
        const ratePct = failRatePct(f.fail_rate);
        return (
          <div
            key={f.fault_id}
            className="bg-bg-tertiary border border-border rounded-lg p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">{f.fault_name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-text-muted border border-border flex-shrink-0">
                  {f.scene_name}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-text-secondary">
                  {f.fail_count}/{f.total_count}次失败
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/40">
                  {f.open_mistakes}人未掌握
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${ratePct}%`,
                    background: 'linear-gradient(90deg,#dc2626,#f87171)',
                  }}
                />
              </div>
              <span className="text-xs font-medium text-red-400 w-9 text-right">{ratePct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 优秀学员榜（前三名奖牌） */
const TopStudentsList: React.FC<{ items: ClassAnalyticsResponse['top_students'] }> = ({
  items,
}) => {
  if (items.length === 0) {
    return <div className="py-10 text-center text-sm text-text-muted">暂无优秀学员数据</div>;
  }
  return (
    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
      {items.map((s, i) => {
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
        return (
          <div
            key={s.user_id}
            className="flex items-center gap-3 bg-bg-tertiary border border-border rounded-lg p-2.5"
          >
            <span className="text-lg w-6 text-center flex-shrink-0">
              {medal ?? (
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold border ${
                    RANK_BADGE[rank] ?? 'bg-bg-secondary text-text-secondary border-border'
                  }`}
                >
                  {rank}
                </span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-[11px] text-text-muted flex items-center gap-2">
                <span>演练 {s.drill_count} 次</span>
                <span className="text-yellow-400/90">S 级 {s.s_count}</span>
              </div>
            </div>
            <span className="text-base font-bold">{Math.round(s.avg_score)}</span>
          </div>
        );
      })}
    </div>
  );
};

/** 需关注学员卡片墙（3 列） */
const AtRiskList: React.FC<{ items: ClassAnalyticsResponse['at_risk_students'] }> = ({
  items,
}) => {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-text-muted">暂无需要特别关注的学员</div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((s) => {
        const t = trendMeta(s.trend);
        const rb = riskBadge(s.risk_level);
        const lowScore = s.avg_score < 60;
        return (
          <div
            key={s.user_id}
            className="bg-bg-tertiary border border-border rounded-lg p-3"
            style={{
              borderLeft: `3px solid ${s.risk_level === 'high' ? '#ef4444' : '#eab308'}`,
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate">{s.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${rb.cls} flex-shrink-0`}
                >
                  {rb.label}
                </span>
              </div>
              <span
                className={`flex items-center gap-1 text-sm font-bold ${
                  lowScore ? 'text-red-400' : ''
                }`}
              >
                {Math.round(s.avg_score)}
                <span className={t.cls}>{t.node}</span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-text-muted mb-2">
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                演练 {s.drill_count} 次
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmtTime(s.last_drill_at)}
              </span>
            </div>
            {s.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {s.reasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary border border-border"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** 全班学员明细表（按平均分降序） */
const AllStudentsTable: React.FC<{ items?: AllStudent[] }> = ({ items }) => {
  const sorted = [...(items ?? [])].sort((a, b) => b.avg_score - a.avg_score);
  if (sorted.length === 0) {
    return <div className="py-10 text-center text-sm text-text-muted">暂无学员明细数据</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted text-xs border-b border-border">
            <th className="text-center py-2 px-2 font-medium w-12">排名</th>
            <th className="text-left py-2 px-2 font-medium">姓名</th>
            <th className="text-center py-2 px-2 font-medium">
              <UserCheck className="w-3.5 h-3.5 inline mr-1" />
              演练次数
            </th>
            <th className="text-left py-2 px-2 font-medium w-[28%]">平均分</th>
            <th className="text-center py-2 px-2 font-medium">最佳分</th>
            <th className="text-center py-2 px-2 font-medium">S级数</th>
            <th className="text-center py-2 px-2 font-medium">趋势</th>
            <th className="text-center py-2 px-2 font-medium">最近演练</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => {
            const t = trendMeta(s.trend);
            const lowScore = s.avg_score < 60;
            return (
              <tr key={s.user_id} className="border-b border-border/50 hover:bg-bg-tertiary/50">
                <td className="text-center py-2.5 px-2 text-text-muted">{i + 1}</td>
                <td className="py-2.5 px-2 font-medium">{s.name}</td>
                <td className="text-center py-2.5 px-2 text-text-secondary">{s.drill_count}</td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${scoreBarColor(s.avg_score)}`}
                        style={{ width: `${Math.min(s.avg_score, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium w-9 text-right ${
                        lowScore ? 'text-red-400' : ''
                      }`}
                    >
                      {Math.round(s.avg_score)}
                    </span>
                  </div>
                </td>
                <td className="text-center py-2.5 px-2 text-text-secondary">
                  {Math.round(s.best_score)}
                </td>
                <td className="text-center py-2.5 px-2">
                  <span className="text-yellow-400/90">{s.s_count}</span>
                </td>
                <td className="text-center py-2.5 px-2">
                  <span className={`inline-flex ${t.cls}`}>{t.node}</span>
                </td>
                <td className="text-center py-2.5 px-2 text-text-muted text-xs">
                  {fmtTime(s.last_drill_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
