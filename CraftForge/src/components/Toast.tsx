// Toast 通知组件 + store
// - 全局右下角排队显示
// - 自动 3.5s 消失，可手动关闭
// - 接收 drillStore 抛出的 'drill:achievement' CustomEvent，转成成就 toast

import { create } from 'zustand';
import { useEffect } from 'react';
import { X, Trophy, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { achievementApi } from '@/services/api';

export type ToastType = 'info' | 'success' | 'warning' | 'achievement';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  icon?: string;        // 自定义 emoji（用于 achievement）
  durationMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { id, ...t };
    set((s) => ({ toasts: [...s.toasts, item] }));
    const ms = t.durationMs ?? 3500;
    setTimeout(() => get().remove(id), ms);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// =============================================================
// 全局 ToastHost：放在 AppRoot 里，监听 drillStore 抛出的成就事件
// =============================================================
export const ToastHost: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  const push = useToastStore((s) => s.push);

  // 监听 drill:achievement 自定义事件，拉成就元数据后推 toast
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as string[] | undefined;
      if (!detail || detail.length === 0) return;
      try {
        const { achievements } = await achievementApi.list();
        const map = new Map(achievements.map((a) => [a.key, a]));
        // 错开 600ms 弹出，给学员"逐一开宝箱"的爽感
        detail.forEach((key, i) => {
          const def = map.get(key);
          if (!def) return;
          setTimeout(() => {
            push({
              type: 'achievement',
              title: `🎉 解锁成就：${def.name}`,
              description: def.description,
              icon: def.icon,
              durationMs: 4500,
            });
          }, i * 600);
        });
      } catch {
        // 拉失败：兜底用通用提示
        push({
          type: 'achievement',
          title: `🎉 解锁 ${detail.length} 项新成就`,
          description: '前往 Dashboard 查看成就墙',
        });
      }
    };
    window.addEventListener('drill:achievement', handler);
    return () => window.removeEventListener('drill:achievement', handler);
  }, [push]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  );
};

const TYPE_STYLE: Record<ToastType, { bar: string; bg: string; Icon: React.ComponentType<any> }> = {
  info:        { bar: 'bg-cyan-400',   bg: 'bg-bg-secondary border-cyan-400/40',     Icon: Info },
  success:     { bar: 'bg-green-400',  bg: 'bg-bg-secondary border-green-400/40',    Icon: CheckCircle2 },
  warning:     { bar: 'bg-warning',    bg: 'bg-bg-secondary border-warning/40',      Icon: AlertCircle },
  achievement: { bar: 'bg-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/60',  Icon: Trophy },
};

const ToastCard: React.FC<{ item: ToastItem; onClose: () => void }> = ({ item, onClose }) => {
  const sty = TYPE_STYLE[item.type];
  const Icon = sty.Icon;
  return (
    <div
      className={`pointer-events-auto w-[340px] rounded-lg border shadow-2xl backdrop-blur-md flex items-start gap-3 p-3 animate-in slide-in-from-right ${sty.bg}`}
    >
      <div className={`w-1 rounded-full self-stretch ${sty.bar}`} />
      <div className="flex-shrink-0 mt-0.5">
        {item.icon ? (
          <span className="text-2xl">{item.icon}</span>
        ) : (
          <Icon className="w-5 h-5 text-text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary truncate">{item.title}</div>
        {item.description && (
          <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">{item.description}</div>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-text-muted hover:text-text-primary"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
