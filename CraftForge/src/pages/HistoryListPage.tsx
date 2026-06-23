// 演练历史页：列表 + 筛选 + 分页 + 点击查看详情
//
// - 学生看自己的（GET /api/drill-records）
// - 教师在 TeacherDashboard 里通过学生详情抽屉看，本页只服务学生入口
// - 显示：时间 / 场景 / 故障 / 难度 / 分数 / 等级 / 用时
// - 点击行 → 进入 HistoryDetailPage（通过 pageStore.detailRecordId 传参）

import { useEffect, useState } from 'react';
import { drillApi, type DrillRecord } from '@/services/api';
import { usePageStore } from '@/stores/pageStore';
import { ArrowLeft, Filter, ChevronRight, Search } from 'lucide-react';

const SCENE_LABEL: Record<string, string> = {
  fcc: '催化裂化',
  welding: '汽车焊装',
  cnc: '数控加工',
};

const GRADE_BADGE: Record<string, string> = {
  S: 'bg-yellow-400/25 text-yellow-400',
  A: 'bg-green-400/20 text-green-400',
  B: 'bg-blue-400/20 text-blue-400',
  C: 'bg-orange-400/20 text-orange-400',
  D: 'bg-red-400/20 text-red-400',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  novice: '新手',
  standard: '标准',
  expert: '专家',
};

const PAGE_SIZE = 20;

export const HistoryListPage: React.FC = () => {
  const setPage = usePageStore((s) => s.setPage);
  const setDetailRecordId = usePageStore((s) => s.setDetailRecordId);
  const [records, setRecords] = useState<DrillRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageNo] = useState(0);
  const [sceneFilter, setSceneFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await drillApi.list({
        scene_id: sceneFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRecords(r.records);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="h-full overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('dashboard')}
              className="p-2 text-text-muted hover:text-text-primary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">演练历史</h1>
              <p className="text-sm text-text-muted">共 {total} 条记录</p>
            </div>
          </div>

          {/* 场景筛选 */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <select
              value={sceneFilter}
              onChange={(e) => {
                setSceneFilter(e.target.value);
                setPageNo(0);
              }}
              className="px-3 py-1.5 bg-bg-secondary border border-border rounded text-sm"
            >
              <option value="">全部场景</option>
              <option value="fcc">催化裂化</option>
              <option value="welding">汽车焊装</option>
              <option value="cnc">数控加工</option>
            </select>
          </div>
        </div>

        {/* 列表 */}
        <div className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-text-muted">加载中...</div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted">
                {sceneFilter ? '该场景下尚无演练记录' : '还没有演练记录，先去练一次吧 ✊'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-tertiary text-xs text-text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">时间</th>
                  <th className="px-3 py-2 text-left">场景</th>
                  <th className="px-3 py-2 text-left">故障</th>
                  <th className="px-3 py-2 text-left">难度</th>
                  <th className="px-3 py-2 text-right">用时</th>
                  <th className="px-3 py-2 text-right">分数</th>
                  <th className="px-3 py-2 text-center">等级</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setDetailRecordId(r.id);
                      setPage('history-detail');
                    }}
                    className="border-t border-border hover:bg-bg-tertiary cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-xs text-text-muted">
                      {formatTime(r.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      {SCENE_LABEL[r.scene_id] ?? r.scene_id}
                    </td>
                    <td className="px-3 py-2.5 truncate max-w-[200px]">{r.fault_name}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.difficulty ? DIFFICULTY_LABEL[r.difficulty] : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {formatDuration(r.duration_sec)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium">
                      {r.score}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                          GRADE_BADGE[r.grade] ?? ''
                        }`}
                      >
                        {r.grade}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 分页 */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs">
            <div className="text-text-muted">
              第 {page + 1} / {totalPages} 页
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPageNo((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 bg-bg-secondary border border-border rounded disabled:opacity-40"
              >
                上一页
              </button>
              <button
                onClick={() => setPageNo((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page + 1 >= totalPages}
                className="px-3 py-1 bg-bg-secondary border border-border rounded disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${String(s).padStart(2, '0')}s`;
}
