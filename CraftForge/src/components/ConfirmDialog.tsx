// =============================================================
// 全局确认对话框 (ConfirmDialog)
// 替代原生 window.confirm，统一暗色主题风格
//
// 用法（任意组件内，无需引入 JSX）：
//   const ok = await confirmDialog({ title: '确认删除？', description: '此操作不可撤销' });
//   if (!ok) return;
//
// 也支持危险操作样式：
//   await confirmDialog({ title: '...', danger: true });
// =============================================================

import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, HelpCircle } from 'lucide-react';

// =============================================================
// Store：管理对话框状态
// =============================================================
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;       // 危险操作（红色确认按钮 + 警告图标）
  icon?: 'info' | 'warning' | 'danger' | 'question';
}

interface ConfirmState {
  visible: boolean;
  options: ConfirmOptions;
  resolver: ((ok: boolean) => void) | null;
  show: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  visible: false,
  options: { title: '' },
  resolver: null,
  show: (opts) => {
    return new Promise<boolean>((resolve) => {
      set({ visible: true, options: opts, resolver: resolve });
    });
  },
  resolve: (ok) => {
    const r = get().resolver;
    if (r) r(ok);
    set({ visible: false, resolver: null });
  },
}));

// =============================================================
// 全局 API：在任意组件中调用
// =============================================================
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(opts);
}

// =============================================================
// 渲染组件：放在 AppRoot 中全局挂载一次
// =============================================================
const ICON_MAP = {
  info:    { Icon: Info,           color: 'text-cyan-400' },
  warning: { Icon: AlertTriangle,  color: 'text-yellow-400' },
  danger:  { Icon: AlertCircle,    color: 'text-red-400' },
  question:{ Icon: HelpCircle,     color: 'text-blue-400' },
};

export const ConfirmHost: React.FC = () => {
  const visible = useConfirmStore((s) => s.visible);
  const options = useConfirmStore((s) => s.options);
  const resolve = useConfirmStore((s) => s.resolve);

  // ESC 键取消
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false);
      if (e.key === 'Enter') resolve(true);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, resolve]);

  // 动画：visible 切换时触发
  const [animIn, setAnimIn] = useState(false);
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => setAnimIn(true));
    } else {
      setAnimIn(false);
    }
  }, [visible]);

  if (!visible) return null;

  const iconKey = options.icon ?? (options.danger ? 'danger' : 'warning');
  const { Icon, color } = ICON_MAP[iconKey];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={() => resolve(false)}
      style={{
        background: animIn ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: animIn ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.2s ease, backdrop-filter 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[420px] bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{
          transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          opacity: animIn ? 1 : 0,
          transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease',
        }}
      >
        {/* 顶部色带 */}
        <div className={`h-1 ${options.danger ? 'bg-red-500' : 'bg-yellow-400'}`} />

        {/* 主体 */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 ${color}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text-primary">{options.title}</h3>
              {options.description && (
                <p className="text-sm text-text-secondary mt-2 leading-relaxed">{options.description}</p>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 mt-6 justify-end">
            <button
              onClick={() => resolve(false)}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-secondary border border-border rounded-lg transition-colors min-w-[72px]"
            >
              {options.cancelText ?? '取消'}
            </button>
            <button
              onClick={() => resolve(true)}
              className={`px-4 py-2 text-sm text-white rounded-lg font-medium transition-colors min-w-[72px] ${
                options.danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {options.confirmText ?? '确认'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
