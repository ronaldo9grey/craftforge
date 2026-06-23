// 错题本页：按 status (open/mastered/all) Tab 切换
// - 每项显示：场景 + 故障名 + 失败次数 + 最近成绩 + 最近时间
// - 操作：去重练（跳工作台 + 锁定该故障）/ 标记已掌握

import { useEffect, useState } from 'react';
import { mistakeApi, type Mistake } from '@/services/api';
import { usePageStore } from '@/stores/pageStore';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { ArrowLeft, BookOpen, Play, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

const SCENE_LABEL: Record<string, string> = {
  fcc: '催化裂化',
  welding: '汽车焊装',
  cnc: '数控加工',
};

export const MistakeBookPage: React.FC = () => {
  const setPage = usePageStore((s) => s.setPage);
  const [tab, setTab] = useState<'open' | 'mastered' | 'all'>('open');
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({ open: 0, mastered: 0 });
  const [loading, setLoading] = useState(true);

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
    // 切到对应场景再跳工作台。学员手动启动演练即可重练
    setActiveTemplate(m.scene_id);
    loadTemplate(m.scene_id);
    loadKnowledge(m.scene_id as any);
    clearMessages();
    setPage('workbench');
  };

  const handleMaster = async (m: Mistake) => {
    if (!confirm(`确认把"${m.fault_name}"标记为已掌握？`)) return;
    await mistakeApi.master(m.id);
    await load();
  };

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
              {tab === 'open'
                ? '太棒了！当前没有未掌握的错题'
                : tab === 'mastered'
                ? '尚无已掌握的错题'
                : '错题本是空的'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {mistakes.map((m) => (
              <MistakeRow
                key={m.id}
                mistake={m}
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

const MistakeRow: React.FC<{
  mistake: Mistake;
  onRetry: () => void;
  onMaster: () => void;
}> = ({ mistake, onRetry, onMaster }) => {
  const isMastered = mistake.status === 'mastered';
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
        isMastered
          ? 'bg-bg-secondary border-border opacity-70'
          : 'bg-bg-secondary border-warning/40'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isMastered ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
        }`}
      >
        {isMastered ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">
            {SCENE_LABEL[mistake.scene_id] ?? mistake.scene_id}
          </span>
          <span className="text-sm font-medium truncate">{mistake.fault_name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
          <span>失败 {mistake.fail_count} 次</span>
          <span>最近 {new Date(mistake.last_fail_at).toLocaleString()}</span>
          <span>
            上次 {mistake.last_grade} 级 / {mistake.last_score} 分
          </span>
          {isMastered && mistake.mastered_at && (
            <span className="text-success">
              · 已于 {new Date(mistake.mastered_at).toLocaleDateString()} 掌握
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
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
    </div>
  );
};
