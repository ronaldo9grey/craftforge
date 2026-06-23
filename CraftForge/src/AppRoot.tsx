import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { LoginPage } from '@/pages/LoginPage';
import { ChangePasswordRequiredPage } from '@/pages/ChangePasswordRequiredPage';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { TeacherDashboard } from '@/pages/TeacherDashboard';
import { HistoryListPage } from '@/pages/HistoryListPage';
import { HistoryDetailPage } from '@/pages/HistoryDetailPage';
import { ToastHost } from '@/components/Toast';
import App from './App';

/**
 * 顶层路由器：
 * - 应用启动先调 bootstrap() 恢复登录态
 * - 未登录 → LoginPage
 * - 已登录但 must_change_pw → ChangePasswordRequiredPage
 * - 已登录 + page='dashboard' → StudentDashboard / TeacherDashboard
 * - page='workbench' → App
 * - page='history' → HistoryListPage
 * - page='history-detail' → HistoryDetailPage
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

  // 登录后默认进 Dashboard
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

  // 统一渲染：用 fragment 把主页面 + ToastHost 一起返回
  const renderPage = () => {
    if (!user) return <LoginPage />;
    if (user.must_change_pw) return <ChangePasswordRequiredPage />;
    if (page === 'workbench') return <App />;
    if (page === 'history') return <HistoryListPage />;
    if (page === 'history-detail') return <HistoryDetailPage />;
    if (user.role === 'student') return <StudentDashboard />;
    return <TeacherDashboard />;
  };

  return (
    <>
      {renderPage()}
      <ToastHost />
    </>
  );
};


