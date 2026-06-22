import { Factory, Settings, Layers, AlertCircle, Lock } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { useDrillStore } from '@/stores/drillStore';

const templates = [
  {
    id: 'fcc' as const,
    name: '催化裂化装置',
    description: '石油炼制核心工艺，包含反应器、分馏塔、加热炉等设备',
    icon: Factory,
    status: 'available' as const,
    color: '#3b82f6',
  },
  {
    id: 'welding' as const,
    name: '汽车焊装车间',
    description: '工业机器人焊装，包含机械臂、夹具、传送带等设备',
    icon: Settings,
    status: 'available' as const,
    color: '#10b981',
  },
  {
    id: 'mixed' as const,
    name: '混合模式',
    description: '支持自定义组合流程+离散设备，灵活配置',
    icon: Layers,
    status: 'coming-soon' as const,
    color: '#64748b',
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

  const handleSelectTemplate = (templateId: 'fcc' | 'welding' | 'mixed') => {
    if (templateId === 'mixed') {
      alert('混合模式即将推出，敬请期待！');
      return;
    }
    
    // 演练中禁止切换模板
    if (isDrillRunning) {
      alert('演练进行中，请先结束当前演练再切换场景！');
      return;
    }
    
    setActiveTemplate(templateId);
    loadTemplate(templateId);
    loadKnowledge(templateId);
    clearMessages();
  };

  if (!sidebarLeftOpen) return null;

  return (
    <div className="w-72 bg-bg-secondary border-r border-border flex flex-col h-full">
      {/* 标题 */}
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

      {/* 模板列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {templates.map((template) => {
          const Icon = template.icon;
          const isActive = activeTemplate === template.id;
          const isComingSoon = template.status === 'coming-soon';

          return (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template.id)}
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
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${template.color}20` }}
                >
                  <Icon className="w-6 h-6" style={{ color: template.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary text-sm">
                      {template.name}
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
                    {template.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 底部提示 - 高度跟随中央演练面板（CSS 变量 --bottom-bar-h），保持三栏底部对齐 */}
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
