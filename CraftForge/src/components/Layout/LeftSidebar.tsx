import { Factory, AlertCircle, Lock } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { useDrillStore } from '@/stores/drillStore';
import { SCENES } from '@/templates';

// 场景列表自动从注册中心生成 + 末尾追加一个 coming-soon 占位卡
const scenes = [
  ...Object.values(SCENES).map((pack) => ({
    id: pack.meta.id,
    name: pack.meta.name,
    description: pack.meta.description,
    icon: pack.meta.icon,
    color: pack.meta.primaryColor,
    status: pack.meta.status,
  })),
  {
    id: 'more' as const,
    name: '更多场景',
    description: '化工合成、电力变电站等场景陆续推出，敬请期待',
    icon: '✨',
    color: '#64748b',
    status: 'coming-soon' as const,
  },
];

export const LeftSidebar: React.FC = () => {
  const activeTemplate = useUIStore((state) => state.activeTemplate);
  const sidebarLeftOpen = useUIStore((state) => state.sidebarLeftOpen);
  const setActiveTemplate = useUIStore((state) => state.setActiveTemplate);
  const loadTemplate = useEquipmentStore((state) => state.loadTemplate);
  const loadKnowledge = useAIStore((state) => state.loadKnowledge);
  const clearMessages = useAIStore((state) => state.clearMessages);
  const isDrillRunning = useDrillStore((state) => state.isRunning);

  const handleSelectScene = (sceneId: string, status: string) => {
    if (status === 'coming-soon') {
      alert('该场景即将推出，敬请期待！');
      return;
    }
    if (isDrillRunning) {
      alert('演练进行中，请先结束当前演练再切换场景！');
      return;
    }
    setActiveTemplate(sceneId as any);
    loadTemplate(sceneId as any);
    loadKnowledge(sceneId as any);
    clearMessages();
  };

  if (!sidebarLeftOpen) return null;

  return (
    <div className="w-72 bg-bg-secondary border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Factory className="w-5 h-5 text-primary" />
          场景选择器
        </h2>
        <p className="text-xs text-text-muted mt-1">选择工业实训场景</p>
        {isDrillRunning && (
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-danger/20 text-danger rounded text-xs">
            <Lock className="w-3 h-3" />
            <span>演练中禁止切换</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {scenes.map((scene) => {
          const isActive = activeTemplate === scene.id;
          const isComingSoon = scene.status === 'coming-soon';

          return (
            <button
              key={scene.id}
              onClick={() => handleSelectScene(scene.id, scene.status)}
              disabled={isComingSoon || isDrillRunning}
              className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                isActive
                  ? 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  : isComingSoon
                  ? 'border-border bg-bg-secondary opacity-50 cursor-not-allowed'
                  : isDrillRunning
                  ? 'border-border bg-bg-secondary opacity-40 cursor-not-allowed'
                  : 'border-border bg-bg-secondary hover:border-border-light hover:bg-bg-tertiary'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ backgroundColor: `${scene.color}20` }}
                >
                  <span>{scene.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary text-sm">
                      {scene.name}
                    </h3>
                    {isComingSoon && (
                      <span className="px-2 py-0.5 text-xs bg-text-muted text-text-primary rounded-full">
                        即将推出
                      </span>
                    )}
                    {isActive && (
                      <span className="px-2 py-0.5 text-xs bg-primary text-white rounded-full">
                        当前
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {scene.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="flex-shrink-0 px-4 flex items-center border-t border-border"
        style={{ height: 'var(--bottom-bar-h, 64px)' }}
      >
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <AlertCircle className="w-4 h-4" />
          <span>点击场景卡片加载对应工况</span>
        </div>
      </div>
    </div>
  );
};
