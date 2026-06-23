import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from '@/pages/LoginPage';
import { ChangePasswordRequiredPage } from '@/pages/ChangePasswordRequiredPage';
import App from './App';

/**
 * 顶层路由器：
 * - 应用启动先调 bootstrap() 恢复登录态
 * - 未登录 → 显示 LoginPage
 * - 已登录但 must_change_pw → 显示 ChangePasswordRequiredPage
 * - 否则 → 进入主工作台 App
 *
 * 不引入 react-router，仅根据 store 状态条件渲染
 */
export const AppRoot: React.FC = () => {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // 初始化中：黑屏 loading
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary text-text-muted">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-sm">加载中...</div>
        </div>
      </div>
    );
  }

  // 未登录
  if (!user) return <LoginPage />;

  // 强制改密
  if (user.must_change_pw) return <ChangePasswordRequiredPage />;

  // 已登录，进入主工作台
  return <App />;
};
