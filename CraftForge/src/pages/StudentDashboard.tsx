// 学生个人成长 Dashboard
// - 顶部 4 个指标卡：总演练数 / 平均分 / 最佳分 / 已解锁成就
// - 中部：成绩曲线（最近 20 次）+ 各场景统计表
// - 底部：成就墙（10 个，未解锁灰显）
// - 如果尚未加入班级，会先显示"加入班级"卡片
// 数据来自后端 /api/drill-records/me/summary + /api/achievements

import { useEffect, useState } from 'react';
import { drillApi, achievementApi, classApi, type Achievement, type ClassRow } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { Trophy, Target, Sparkles, Activity, Play, RefreshCw, Users, UserPlus, History, BookOpen, Award, BarChart3 } from 'lucide-react';

interface Summary {
  total: number;
  avg_score: number;
  best_score: number;
  grade_count: Record<string, number>;
  scene_stats: Record<string, { count: number; avg: number; best: number }>;
  recent_curve: Array<{ created_at: number; score: number; grade: string; scene_id: string }>;
}

const SCENE_LABEL: Record<string, string> = {
  fcc: '催化裂化',
  welding: '汽车焊装',
  cnc: '数控加工',
};

const SCENE_ICON: Record<string, string> = {
  fcc: '🛢️',
  welding: '🚗',
  cnc: '🔧',
};

const GRADE_COLOR: Record<string, string> = {
  S: 'text-yellow-400',
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-orange-400',
  D: 'text-red-400',
};

export const StudentDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refresh);
  const setPage = usePageStore((s) => s.setPage);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [myClass, setMyClass] = useState<ClassRow | null>(null);
  const [pendingReq, setPendingReq] = useState<{ class_name: string; status: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, a, c, mr] = await Promise.all([
        drillApi.mySummary(),
        achievementApi.list(),
        classApi.mine(),
        classApi.myRequest().catch(() => ({ request: null })),
      ]);
      setSummary(s);
      setAchievements(a.achievements);
      setMyClass(c.classes[0] ?? null);
      // 如果学生有 class_id 就不显示 pending；否则展示最新申请状态（pending/rejected/approved）
      if (!c.classes[0] && mr.request) {
        setPendingReq({ class_name: mr.request.class_name, status: mr.request.status });
      } else {
        setPendingReq(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="h-full overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* 头部欢迎 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              你好，<span className="text-primary">{user?.display_name}</span>
            </h1>
            <p className="text-sm text-text-muted mt-1">
              欢迎回到匠魂实训引擎 · 看看你的成长轨迹
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => void loadAll()}
              className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>
            <button
              onClick={() => setPage('mistakes')}
              className="px-3 py-2 text-sm bg-bg-secondary hover:bg-bg-tertiary border border-warning/40 text-warning rounded-lg flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              错题本
            </button>
            <button
              onClick={() => setPage('leaderboard')}
              className="px-3 py-2 text-sm bg-bg-secondary hover:bg-bg-tertiary border border-yellow-400/40 text-yellow-400 rounded-lg flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              排行榜
            </button>
            <button
              onClick={() => setPage('history')}
              className="px-3 py-2 text-sm bg-bg-secondary hover:bg-bg-tertiary border border-border text-text-primary rounded-lg flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              演练历史
            </button>
            <button
              onClick={() => setPage('analytics')}
              className="px-3 py-2 text-sm bg-bg-secondary hover:bg-bg-tertiary border border-cyan-400/40 text-cyan-400 rounded-lg flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              学习分析
            </button>
            <button
              onClick={() => setPage('gallery')}
              className="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 font-medium"
            >
              <Play className="w-4 h-4" />
              开始演练
            </button>
          </div>
        </div>

        {/* 班级状态：未加入显示加入卡，已加入显示班级名 */}
        <ClassStatusCard
          myClass={myClass}
          pendingReq={pendingReq}
          onJoined={async () => {
            await refreshUser();
            await loadAll();
          }}
        />

        {/* 4 个指标卡 */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            icon={<Activity className="w-5 h-5 text-cyan-400" />}
            label="总演练数"
            value={summary?.total ?? 0}
            unit="次"
            color="cyan"
          />
          <MetricCard
            icon={<Target className="w-5 h-5 text-blue-400" />}
            label="平均得分"
            value={summary?.avg_score ?? 0}
            unit="分"
            color="blue"
          />
          <MetricCard
            icon={<Trophy className="w-5 h-5 text-yellow-400" />}
            label="最佳得分"
            value={summary?.best_score ?? 0}
            unit="分"
            color="yellow"
          />
          <MetricCard
            icon={<Sparkles className="w-5 h-5 text-purple-400" />}
            label="已解锁成就"
            value={unlockedCount}
            unit={`/ ${achievements.length}`}
            color="purple"
          />
        </div>

        {/* 等级分布 */}
        {summary && summary.total > 0 && (
          <div className="bg-bg-secondary border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">等级分布</h3>
            <div className="grid grid-cols-5 gap-3">
              {(['S', 'A', 'B', 'C', 'D'] as const).map((g) => (
                <div key={g} className="text-center bg-bg-tertiary rounded p-3">
                  <div className={`text-2xl font-bold ${GRADE_COLOR[g]}`}>{g}</div>
                  <div className="text-xs text-text-muted mt-1">
                    {summary.grade_count[g] || 0} 次
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 成绩曲线 */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            最近 20 次成绩曲线
          </h3>
          {summary && summary.recent_curve.length > 0 ? (
            <ScoreCurve points={summary.recent_curve} />
          ) : (
            <EmptyHint text={loading ? '加载中...' : '还没有演练记录，先去开个练练吧 ✊'} />
          )}
        </div>

        {/* 各场景统计 */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">各场景表现</h3>
          {summary && Object.keys(summary.scene_stats).length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(summary.scene_stats).map(([sceneId, stats]) => (
                <div key={sceneId} className="bg-bg-tertiary rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{SCENE_ICON[sceneId] ?? '🏭'}</span>
                    <span className="text-sm font-medium">
                      {SCENE_LABEL[sceneId] ?? sceneId}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="次数" value={stats.count} />
                    <Stat label="均分" value={Math.round(stats.avg)} />
                    <Stat label="最佳" value={stats.best} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyHint text="尚无场景数据" />
          )}
        </div>

        {/* 成就墙 */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            成就墙 ({unlockedCount} / {achievements.length})
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {achievements.map((a) => (
              <div
                key={a.key}
                className={`rounded-lg p-3 border transition-all ${
                  a.unlocked
                    ? 'bg-yellow-400/10 border-yellow-400/40 shadow-md shadow-yellow-400/10'
                    : 'bg-bg-tertiary border-border opacity-40 grayscale'
                }`}
                title={a.description}
              >
                <div className="text-3xl text-center mb-1">{a.icon}</div>
                <div className="text-xs font-medium text-center">{a.name}</div>
                <div className="text-[10px] text-text-muted text-center mt-0.5 truncate">
                  {a.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================
// 子组件：指标卡 / 成绩曲线 / 小统计 / 空提示
// =============================================================
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  color: 'cyan' | 'blue' | 'yellow' | 'purple';
}> = ({ icon, label, value, unit }) => (
  <div className="bg-bg-secondary border border-border rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="text-xs text-text-muted">{label}</div>
      {icon}
    </div>
    <div className="mt-2 flex items-baseline gap-1">
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-xs text-text-muted">{unit}</span>
    </div>
  </div>
);

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-bg-secondary rounded p-1.5 text-center">
    <div className="text-text-muted">{label}</div>
    <div className="text-text-primary font-medium">{value}</div>
  </div>
);

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-8 text-center text-sm text-text-muted">{text}</div>
);

/** 成绩曲线（SVG 折线图，无第三方依赖） */
const ScoreCurve: React.FC<{
  points: Array<{ created_at: number; score: number; grade: string; scene_id: string }>;
}> = ({ points }) => {
  if (points.length === 0) return null;
  const W = 800;
  const H = 180;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = points.length;
  const xStep = n === 1 ? 0 : plotW / (n - 1);
  const ys = (s: number) => padT + (1 - s / 100) * plotH;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${padL + i * xStep} ${ys(p.score)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* y 轴刻度 */}
      {[0, 25, 50, 75, 100].map((y) => (
        <g key={y}>
          <line
            x1={padL}
            x2={W - padR}
            y1={ys(y)}
            y2={ys(y)}
            stroke="#334155"
            strokeWidth={0.5}
            strokeDasharray="3,4"
          />
          <text x={6} y={ys(y) + 3} fontSize="9" fill="#64748b">
            {y}
          </text>
        </g>
      ))}
      {/* 折线 */}
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} />
      {/* 数据点 */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={padL + i * xStep} cy={ys(p.score)} r={3.5} fill="#3b82f6" />
          <title>
            {SCENE_LABEL[p.scene_id] ?? p.scene_id} · {p.grade} 级 · {p.score} 分
          </title>
        </g>
      ))}
    </svg>
  );
};

// =============================================================
// 班级状态卡：未加入 → 加入表单；申请中 → 等待审批；已加入 → 班级名
// =============================================================
const ClassStatusCard: React.FC<{
  myClass: ClassRow | null;
  pendingReq: { class_name: string; status: string } | null;
  onJoined: () => void | Promise<void>;
}> = ({ myClass, pendingReq, onJoined }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOkMsg(null);
    if (code.trim().length !== 6) {
      setErr('邀请码应为 6 位');
      return;
    }
    setBusy(true);
    try {
      const resp = await classApi.join(code.trim());
      setCode('');
      if (resp.status === 'pending') {
        setOkMsg(`已提交申请，等待 ${resp.class.name} 的教师审批`);
      } else if (resp.status === 'already_member') {
        setOkMsg('你已经在这个班级里了');
      }
      await onJoined();
    } catch (e: any) {
      setErr(e?.message ?? '加入失败');
    } finally {
      setBusy(false);
    }
  };

  if (myClass) {
    return (
      <div className="bg-bg-secondary border border-border rounded-lg p-3 flex items-center gap-3">
        <Users className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <div className="text-xs text-text-muted">我的班级</div>
          <div className="text-sm font-medium">{myClass.name}</div>
        </div>
      </div>
    );
  }

  // 申请中 / 被拒
  if (pendingReq) {
    if (pendingReq.status === 'pending') {
      return (
        <div className="bg-blue-400/10 border border-blue-400/30 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">申请审批中…</div>
            <div className="text-xs text-text-muted mt-0.5">
              已申请加入 <strong className="text-text-primary">{pendingReq.class_name}</strong>，
              等待教师审批后即可加入班级
            </div>
          </div>
          <button
            onClick={() => onJoined()}
            className="text-xs text-blue-400 hover:underline"
          >
            刷新
          </button>
        </div>
      );
    }
    if (pendingReq.status === 'rejected') {
      return (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold">
              申请 {pendingReq.class_name} 被拒绝
            </span>
          </div>
          <p className="text-xs text-text-muted mb-3">可重新申请该班级，或填写其他班级的邀请码</p>
          <form onSubmit={submit} className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              placeholder="6 位邀请码"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded text-sm font-mono tracking-widest uppercase"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-warning text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {busy ? '提交中...' : '重新申请'}
            </button>
          </form>
          {err && (
            <div className="mt-2 px-2 py-1 bg-danger/15 border border-danger/40 rounded text-xs text-danger">
              {err}
            </div>
          )}
        </div>
      );
    }
  }

  // 未提交申请
  return (
    <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus className="w-4 h-4 text-warning" />
        <span className="text-sm font-semibold">尚未加入班级</span>
      </div>
      <p className="text-xs text-text-muted mb-3">
        向你的老师索取 6 位邀请码，提交申请后老师审批通过即可加入班级
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          maxLength={6}
          placeholder="6 位邀请码"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          className="flex-1 px-3 py-2 bg-bg-tertiary border border-border rounded text-sm font-mono tracking-widest uppercase"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-4 py-2 bg-warning text-white rounded text-sm font-medium disabled:opacity-50"
        >
          {busy ? '提交中...' : '提交申请'}
        </button>
      </form>
      {err && (
        <div className="mt-2 px-2 py-1 bg-danger/15 border border-danger/40 rounded text-xs text-danger">
          {err}
        </div>
      )}
      {okMsg && (
        <div className="mt-2 px-2 py-1 bg-success/15 border border-success/40 rounded text-xs text-success">
          {okMsg}
        </div>
      )}
    </div>
  );
};
