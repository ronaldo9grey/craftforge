// 场景大屏首页 (SceneGallery)
// - 显示所有已注册场景的卡片（含 coming-soon 占位）
// - 卡片信息：图标、名称、描述、难度、设备数、故障数、师傅
// - 点击卡片 → 弹出"难度选择 + 立即演练"小窗
// - 进入演练流程：先 loadTemplate + loadKnowledge，再 setPage('workbench')

import { useState } from 'react';
import { SCENES } from '@/templates';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { useDrillStore } from '@/stores/drillStore';
import { usePageStore } from '@/stores/pageStore';
import { useAuthStore } from '@/stores/authStore';
import type { DrillDifficulty } from '@/types';
import { ArrowLeft, Play, Sparkles, Cog, AlertTriangle, User2, ChevronRight, X } from 'lucide-react';

export const SceneGalleryPage: React.FC = () => {
  const setPage = usePageStore((s) => s.setPage);
  const user = useAuthStore((s) => s.user);
  const [pickedSceneId, setPickedSceneId] = useState<string | null>(null);

  const setActiveTemplate = useUIStore((s) => s.setActiveTemplate);
  const loadTemplate = useEquipmentStore((s) => s.loadTemplate);
  const loadKnowledge = useAIStore((s) => s.loadKnowledge);
  const clearMessages = useAIStore((s) => s.clearMessages);

  // 把场景包 + 占位"更多"合并成一个数组
  const scenes = [
    ...Object.values(SCENES).map((p) => ({
      id: p.meta.id,
      meta: p.meta,
      coach: p.coach,
      equipCount: p.equipments.length,
      faultCount: p.faults.length,
      status: p.meta.status,
    })),
    {
      id: '__more__',
      meta: {
        id: '__more__',
        name: '更多场景',
        shortName: '即将推出',
        icon: '✨',
        description: '阳极焙烧炉、火电厂集控、整流所等场景正在路上...',
        primaryColor: '#64748b',
        designSize: { width: 0, height: 0 },
        difficulty: 'beginner' as const,
        status: 'coming-soon' as const,
      },
      coach: null,
      equipCount: 0,
      faultCount: 0,
      status: 'coming-soon' as const,
    },
  ];

  const handleQuickEnter = (sceneId: string) => {
    setActiveTemplate(sceneId);
    loadTemplate(sceneId);
    loadKnowledge(sceneId as any);
    clearMessages();
    setPage('workbench');
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-bg-primary via-bg-primary to-bg-secondary text-text-primary">
      <div className="max-w-7xl mx-auto p-8">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('dashboard')}
              className="p-2 text-text-muted hover:text-text-primary"
              title="返回 Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                选择实训场景
              </h1>
              <p className="text-sm text-text-muted mt-1">
                {user?.display_name}，挑一个场景开始今天的训练吧
              </p>
            </div>
          </div>
        </div>

        {/* 4 列卡片网格（在窄屏自动 2 列） */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {scenes.map((s) => (
            <SceneCard
              key={s.id}
              data={s}
              onPick={(id) => setPickedSceneId(id)}
            />
          ))}
        </div>

        {/* 提示 */}
        <div className="mt-10 text-center text-xs text-text-muted">
          匠魂实训引擎 · 共 {Object.keys(SCENES).length} 个可用场景，更多陆续上线
        </div>
      </div>

      {/* 难度选择 / 直接进入 弹窗 */}
      {pickedSceneId && (
        <ScenePickerModal
          sceneId={pickedSceneId}
          onClose={() => setPickedSceneId(null)}
          onConfirm={(id) => {
            setPickedSceneId(null);
            handleQuickEnter(id);
          }}
        />
      )}
    </div>
  );
};

// =============================================================
// 场景卡片
// =============================================================
const DIFFICULTY_BADGE: Record<string, { label: string; cls: string }> = {
  beginner:     { label: '入门', cls: 'bg-green-400/15 text-green-400 border-green-400/40' },
  intermediate: { label: '中级', cls: 'bg-blue-400/15  text-blue-400  border-blue-400/40' },
  advanced:     { label: '高级', cls: 'bg-purple-400/15 text-purple-400 border-purple-400/40' },
};

const SceneCard: React.FC<{
  data: {
    id: string;
    meta: any;
    coach: any;
    equipCount: number;
    faultCount: number;
    status: string;
  };
  onPick: (id: string) => void;
}> = ({ data, onPick }) => {
  const disabled = data.status === 'coming-soon';
  const color = data.meta.primaryColor;

  return (
    <button
      onClick={() => !disabled && onPick(data.id)}
      disabled={disabled}
      className={`group relative text-left overflow-hidden rounded-2xl border transition-all duration-300 ${
        disabled
          ? 'border-border bg-bg-secondary opacity-60 cursor-not-allowed'
          : 'border-border bg-bg-secondary hover:border-primary hover:-translate-y-1 hover:shadow-2xl'
      }`}
    >
      {/* 顶部色带 */}
      <div className="h-28 relative overflow-hidden" style={{ backgroundColor: `${color}30` }}>
        <div
          className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-30 blur-2xl"
          style={{ backgroundColor: color }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-7xl">
          {data.meta.icon}
        </div>
        {!disabled && (
          <span
            className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full border ${
              DIFFICULTY_BADGE[data.meta.difficulty]?.cls ?? ''
            }`}
          >
            {DIFFICULTY_BADGE[data.meta.difficulty]?.label ?? '-'}
          </span>
        )}
        {disabled && (
          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
            即将推出
          </span>
        )}
      </div>

      {/* 主体 */}
      <div className="p-4 space-y-2">
        <h3 className="text-base font-bold">{data.meta.name}</h3>
        <p className="text-xs text-text-secondary line-clamp-2 min-h-[2.5rem]">
          {data.meta.description}
        </p>

        {!disabled && data.coach && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted pt-1">
            <User2 className="w-3 h-3" />
            <span>师傅：{data.coach.name}</span>
            <span className="text-text-muted">·</span>
            <span className="truncate">{data.coach.title}</span>
          </div>
        )}

        {!disabled && (
          <div className="flex items-center gap-3 pt-2 text-xs">
            <span className="flex items-center gap-1 text-text-secondary">
              <Cog className="w-3 h-3" />
              {data.equipCount} 设备
            </span>
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="w-3 h-3" />
              {data.faultCount} 故障
            </span>
          </div>
        )}

        {!disabled && (
          <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
            <span className="text-xs text-text-muted">点击开始</span>
            <span
              className="flex items-center gap-1 text-xs font-semibold transition-colors"
              style={{ color }}
            >
              进入演练
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

// =============================================================
// 难度选择弹窗
// =============================================================
const DIFFICULTY_OPTIONS: { value: DrillDifficulty; label: string; desc: string; tag: string }[] = [
  { value: 'novice',   label: '新手模式', desc: '允许 1 次重试，提示更详细', tag: '🌱' },
  { value: 'standard', label: '标准模式', desc: '默认难度，符合考核要求', tag: '⚙️' },
  { value: 'expert',   label: '专家模式', desc: '无提示、零容错，挑战 S 级', tag: '🎯' },
];

const ScenePickerModal: React.FC<{
  sceneId: string;
  onClose: () => void;
  onConfirm: (id: string) => void;
}> = ({ sceneId, onClose, onConfirm }) => {
  const pack = SCENES[sceneId];
  const setDifficulty = useDrillStore((s) => s.setDifficulty);
  const [picked, setPicked] = useState<DrillDifficulty>('standard');

  if (!pack) return null;

  const start = () => {
    setDifficulty(picked);
    onConfirm(sceneId);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[520px] bg-bg-secondary border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部 banner */}
        <div
          className="relative h-32 overflow-hidden"
          style={{ backgroundColor: `${pack.meta.primaryColor}40` }}
        >
          <div
            className="absolute -right-8 -top-8 w-44 h-44 rounded-full opacity-40 blur-3xl"
            style={{ backgroundColor: pack.meta.primaryColor }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-8xl">
            {pack.meta.icon}
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 text-text-muted hover:text-text-primary bg-black/30 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold">{pack.meta.name}</h2>
            <p className="text-xs text-text-muted mt-1">{pack.meta.description}</p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <User2 className="w-3 h-3 text-primary" />
              师傅：<strong className="text-text-primary">{pack.coach.name}</strong>
            </span>
            <span className="flex items-center gap-1 text-text-secondary">
              <Cog className="w-3 h-3" />
              {pack.equipments.length} 设备
            </span>
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="w-3 h-3" />
              {pack.faults.length} 故障
            </span>
          </div>

          {/* 难度选择 */}
          <div>
            <div className="text-xs text-text-secondary mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              选择难度
            </div>
            <div className="space-y-1.5">
              {DIFFICULTY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setPicked(d.value)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    picked === d.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-bg-tertiary hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {d.tag} {d.label}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">{d.desc}</div>
                    </div>
                    {picked === d.value && (
                      <span className="text-[10px] px-2 py-0.5 bg-primary text-white rounded-full">
                        已选
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 操作 */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary bg-bg-tertiary rounded-lg"
            >
              取消
            </button>
            <button
              onClick={start}
              className="flex-1 px-4 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              进入演练
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
