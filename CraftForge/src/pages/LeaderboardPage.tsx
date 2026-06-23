// 排行榜页：本班 / 全站 双 Tab + 30 天 / 全部历史 双窗口 + 三种指标
// - 顶部三个切换：scope (class/global) + window (30d/all) + metric (avg/drill_count/s_count)
// - 表格：rank / display_name / class_name (global时) / total_drills / avg_score / s_count
// - 高亮"我"的所在行
// - 若我不在 top50，额外用单独一行显示

import { useEffect, useState } from 'react';
import { leaderboardApi, type LeaderboardEntry } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { ArrowLeft, Trophy, RefreshCw } from 'lucide-react';

const SCOPE_OPTIONS: Array<{ value: 'class' | 'global'; label: string }> = [
  { value: 'class', label: '本班' },
  { value: 'global', label: '全站' },
];

const WINDOW_OPTIONS: Array<{ value: '30d' | 'all'; label: string }> = [
  { value: '30d', label: '近 30 天' },
  { value: 'all', label: '全部历史' },
];

const METRIC_OPTIONS: Array<{ value: 'avg' | 'drill_count' | 's_count'; label: string }> = [
  { value: 'avg',         label: '平均分' },
  { value: 'drill_count', label: '演练数' },
  { value: 's_count',     label: 'S 级数' },
];

const RANK_BADGE: Record<number, string> = {
  1: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/50',
  2: 'bg-slate-300/20 text-slate-300 border-slate-300/50',
  3: 'bg-orange-400/20 text-orange-400 border-orange-400/50',
};

export const LeaderboardPage: React.FC = () => {
  const setPage = usePageStore((s) => s.setPage);
  const user = useAuthStore((s) => s.user);
  const [scope, setScope]   = useState<'class' | 'global'>('class');
  const [window_, setWindow] = useState<'30d' | 'all'>('30d');
  const [metric, setMetric] = useState<'avg' | 'drill_count' | 's_count'>('avg');
  const [data, setData] = useState<{
    leaderboard: LeaderboardEntry[];
    my_rank: number | null;
    my_extra_row: LeaderboardEntry | null;
    total: number;
    note?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await leaderboardApi.query({ scope, window: window_, metric });
      setData(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, window_, metric]);

  return (
    <div className="h-full overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* 顶部 */}
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
                <Trophy className="w-6 h-6 text-yellow-400" />
                排行榜
              </h1>
              <p className="text-sm text-text-muted">看看你在 {scope === 'class' ? '班级' : '全站'} 中的位置</p>
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

        {/* 三组 Tab */}
        <div className="bg-bg-secondary border border-border rounded-lg p-3 flex flex-wrap gap-3">
          <TabGroup label="范围" options={SCOPE_OPTIONS} value={scope} onChange={(v) => setScope(v as any)} />
          <TabGroup label="时间" options={WINDOW_OPTIONS} value={window_} onChange={(v) => setWindow(v as any)} />
          <TabGroup label="指标" options={METRIC_OPTIONS} value={metric} onChange={(v) => setMetric(v as any)} />
        </div>

        {/* 我的排名提示 */}
        {data && (
          <div className="bg-primary/10 border border-primary/40 rounded-lg p-3 text-sm flex items-center justify-between">
            <span>
              {data.note ? (
                <span className="text-warning">{data.note}</span>
              ) : data.my_rank ? (
                <>
                  当前你的排名：<strong className="text-primary text-base">#{data.my_rank}</strong>
                  <span className="ml-2 text-text-muted">/ 共 {data.total} 人</span>
                </>
              ) : (
                <span className="text-text-muted">你还没有演练记录</span>
              )}
            </span>
          </div>
        )}

        {/* 表格 */}
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-sm text-text-muted">加载中...</div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-muted">
              {data?.note ? data.note : '尚无榜单数据'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-tertiary text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-2 w-16 text-center">名次</th>
                  <th className="px-3 py-2 text-left">学员</th>
                  {scope === 'global' && <th className="px-3 py-2 text-left">班级</th>}
                  <th className="px-3 py-2 text-right">演练数</th>
                  <th className="px-3 py-2 text-right">平均分</th>
                  <th className="px-3 py-2 text-right">S 级数</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((row) => (
                  <Row key={row.user_id} row={row} isMe={row.user_id === user?.id} showClass={scope === 'global'} />
                ))}
                {data.my_extra_row && (
                  <>
                    <tr className="border-t border-border">
                      <td colSpan={scope === 'global' ? 6 : 5} className="px-3 py-1 text-center text-xs text-text-muted">
                        … 你的位置 …
                      </td>
                    </tr>
                    <Row row={data.my_extra_row} isMe={true} showClass={scope === 'global'} />
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const TabGroup: React.FC<{
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, options, value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-text-muted">{label}</span>
    <div className="flex bg-bg-tertiary rounded p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            value === o.value ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const Row: React.FC<{ row: LeaderboardEntry; isMe: boolean; showClass: boolean }> = ({ row, isMe, showClass }) => (
  <tr className={`border-t border-border ${isMe ? 'bg-primary/10' : ''}`}>
    <td className="px-3 py-2.5 text-center">
      {RANK_BADGE[row.rank] ? (
        <span className={`inline-block min-w-[28px] px-1.5 py-0.5 rounded font-bold border ${RANK_BADGE[row.rank]}`}>
          #{row.rank}
        </span>
      ) : (
        <span className="text-text-secondary font-mono">#{row.rank}</span>
      )}
    </td>
    <td className="px-3 py-2.5">
      <span className="font-medium">{row.display_name}</span>
      {isMe && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-primary text-white rounded-full">你</span>}
    </td>
    {showClass && (
      <td className="px-3 py-2.5 text-xs text-text-muted">{row.class_name ?? '-'}</td>
    )}
    <td className="px-3 py-2.5 text-right font-mono">{row.total_drills}</td>
    <td className="px-3 py-2.5 text-right font-mono">{row.avg_score}</td>
    <td className="px-3 py-2.5 text-right font-mono">{row.s_count}</td>
  </tr>
);
