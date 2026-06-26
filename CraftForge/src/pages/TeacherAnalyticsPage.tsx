// 班级学习分析页 (Teacher Class Analytics)
// 面向教师：全景掌握所辖班级的学习状况
// 数据来源：/api/teacher/dashboard (班级列表) + /api/analytics/teacher/class/:id/overview (单班分析概览)
// - 顶部：返回 / 标题 / 刷新
// - 多班级时提供班级选择器，默认第一个班级
// - 概览卡片：总学员数 / 总演练次数 / 班级均分 / 需关注学员
// - 场景掌握分布表（按平均分升序）+ 优秀学员榜（前三名金银铜）
// - 需关注学员卡片墙（风险等级、趋势、原因标签、最近演练时间）

import { useEffect, useState } from 'react';
import {
  analyticsApi,
  teacherApi,
  type ClassAnalyticsResponse,
  type ClassDashboard,
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
} from 'lucide-react';

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

/** 趋势字符串 -> {图标节点, 颜色类}；lucide 图标使用 currentColor，颜色由外层 span 决定 */
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

  /** 加载班级列表 + 全部班级的分析概览（并行） */
  const load = async () => {
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
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedClass = classes.find((c) => c.class_id === selectedClassId) ?? null;
  const analytics = selectedClassId ? analyticsMap[selectedClassId] ?? null : null;

  return (
    <div className="h-screen overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-7xl mx-auto p-8 pb-20 space-y-6">
        {/* ---------- 顶部 ---------- */}
        <div className="flex items-center justify-between">
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
                {user?.display_name ? `${user.display_name} · ` : ''}全景掌握班级学习状况
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
            <span className="text-sm">正在加载班级学习数据…</span>
          </div>
        )}

        {/* ---------- 加载失败 ---------- */}
        {!loading && error && (
          <div className="py-16 text-center bg-bg-secondary border border-danger/40 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2" />
            <p className="text-sm text-danger mb-3">{error}</p>
            <button
              onClick={() => void load()}
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
            {/* 班级选择器（多班级时显示） */}
            {classes.length > 1 && (
              <div className="flex items-center gap-3 bg-bg-secondary border border-border rounded-lg px-4 py-2.5">
                <span className="text-xs text-text-muted">选择班级</span>
                <select
                  value={selectedClassId ?? ''}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  {classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name}（{c.student_count} 人）
                    </option>
                  ))}
                </select>
                {selectedClass && (
                  <span className="text-xs text-text-muted ml-auto">
                    邀请码 <code className="text-warning">{selectedClass.join_code}</code>
                  </span>
                )}
              </div>
            )}

            {/* 该班级分析数据不可用 */}
            {!analytics && (
              <div className="py-16 text-center bg-bg-secondary border border-border rounded-lg">
                <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                <p className="text-sm text-text-muted mb-3">
                  {selectedClass?.class_name ?? '该班级'} 的分析数据暂不可用
                </p>
                <button
                  onClick={() => void load()}
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
                  />
                  <SummaryCard
                    icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
                    iconBg="bg-red-400/15"
                    label="需关注学员"
                    value={analytics.at_risk_students.length}
                    sub="人"
                  />
                </div>

                {/* Row 2: 场景掌握分布（60%） + 优秀学员榜（40%） */}
                <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-3 bg-bg-secondary border border-border rounded-lg p-4">
                    <SectionTitle
                      icon={<BookOpen className="w-4 h-4 text-blue-400" />}
                      title="场景掌握分布"
                      extra={
                        <span className="text-xs text-text-muted">按平均分升序（最弱在前）</span>
                      }
                    />
                    <SceneWeaknessTable rows={analytics.scene_weakness} />
                  </div>
                  <div className="col-span-2 bg-bg-secondary border border-border rounded-lg p-4">
                    <SectionTitle
                      icon={<Award className="w-4 h-4 text-yellow-400" />}
                      title="优秀学员榜"
                    />
                    <TopStudentsList items={analytics.top_students} />
                  </div>
                </div>

                {/* Row 3: 需关注学员（整行） */}
                <div className="bg-bg-secondary border border-border rounded-lg p-4">
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

/** 概览卡片 */
const SummaryCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  sub?: string;
}> = ({ icon, iconBg, label, value, sub }) => (
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
    </div>
  </div>
);

/** 场景掌握分布表（按平均分升序，最弱在前） */
const SceneWeaknessTable: React.FC<{ rows: ClassAnalyticsResponse['scene_weakness'] }> = ({
  rows,
}) => {
  const sorted = [...rows].sort((a, b) => a.avg_score - b.avg_score);
  if (sorted.length === 0) {
    return <div className="py-8 text-center text-sm text-text-muted">暂无场景数据</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-text-muted text-xs border-b border-border">
            <th className="text-left py-2 px-2 font-medium">场景</th>
            <th className="text-center py-2 px-2 font-medium">演练次数</th>
            <th className="text-left py-2 px-2 font-medium w-[36%]">平均分</th>
            <th className="text-center py-2 px-2 font-medium">覆盖人数</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.scene_id} className="border-b border-border/50 hover:bg-bg-tertiary/50">
              <td className="py-2.5 px-2 font-medium">{r.scene_name}</td>
              <td className="text-center py-2.5 px-2 text-text-secondary">{r.drill_count}</td>
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
              <td className="text-center py-2.5 px-2">
                <span className="inline-flex items-center gap-1 text-text-secondary">
                  <UserCheck className="w-3.5 h-3.5 text-text-muted" />
                  {r.student_coverage}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** 优秀学员榜（前三名金银铜徽章 + 奖牌图标） */
const TopStudentsList: React.FC<{ items: ClassAnalyticsResponse['top_students'] }> = ({
  items,
}) => {
  if (items.length === 0) {
    return <div className="py-8 text-center text-sm text-text-muted">暂无优秀学员数据</div>;
  }
  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
      {items.map((s, i) => {
        const rank = i + 1;
        const isTop3 = rank <= 3;
        return (
          <div
            key={s.user_id}
            className="flex items-center gap-3 bg-bg-tertiary border border-border rounded-lg p-2.5"
          >
            <span
              className={`min-w-[30px] h-7 px-1.5 rounded-md flex items-center justify-center text-sm font-bold border ${
                RANK_BADGE[rank] ?? 'bg-bg-secondary text-text-secondary border-border'
              }`}
            >
              {rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-[11px] text-text-muted flex items-center gap-2">
                <span>演练 {s.drill_count} 次</span>
                <span className="text-yellow-400/90">S 级 {s.s_count}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold">{Math.round(s.avg_score)}</span>
              {isTop3 && <Award className="w-4 h-4 text-yellow-400" />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 需关注学员卡片墙 */
const AtRiskList: React.FC<{ items: ClassAnalyticsResponse['at_risk_students'] }> = ({
  items,
}) => {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-text-muted">暂无需要特别关注的学员</div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
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
