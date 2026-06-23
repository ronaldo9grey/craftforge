import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { LoginPage } from '@/pages/LoginPage';
import { ChangePasswordRequiredPage } from '@/pages/ChangePasswordRequiredPage';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { TeacherDashboard } from '@/pages/TeacherDashboard';
import App from './App';

/**
 * 顶层路由器：
 * - 应用启动先调 bootstrap() 恢复登录态
 * - 未登录 → LoginPage
 * - 已登录但 must_change_pw → ChangePasswordRequiredPage
 * - 已登录 + page='dashboard' → StudentDashboard / TeacherDashboard (根据角色)
 * - 已登录 + page='workbench' → App (工作台)
 */
export const AppRoot: React.FC = () => {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const page = usePageStore((s) => s.page);
  const setPage = usePageStore((s) => s.setPage);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // 登录后默认强制进 Dashboard（避免直接进工作台错过个人成长信息）
  useEffect(() => {
    if (user) setPage('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  if (!user) return <LoginPage />;
  if (user.must_change_pw) return <ChangePasswordRequiredPage />;

  // 工作台
  if (page === 'workbench') return <App />;

  // Dashboard：按角色分发
  if (user.role === 'student') return <StudentDashboard />;
  return <TeacherDashboard />;
};

