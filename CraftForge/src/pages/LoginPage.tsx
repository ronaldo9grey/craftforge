import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { authApi, ApiError } from '@/services/api';
import { Factory, LogIn, KeyRound, UserPlus } from 'lucide-react';

/**
 * 登录页
 * - 默认显示用户名/密码登录
 * - 若后端 /bootstrap-teacher 可用（用户表只有 admin 1 个），显示一个"首次开荒"按钮
 * - 登录后自动进入主页（由顶层 AppRoot 路由控制）
 */
export const LoginPage: React.FC = () => {
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // bootstrap 引导：手动展开（不再自动探测，避免 403 报错污染控制台）
  const [bsForm, setBsForm] = useState({ username: '', password: '', display_name: '' });
  const [bsBusy, setBsBusy] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch {
      /* error 已在 store 里设置 */
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bsForm.username || !bsForm.password || !bsForm.display_name) return;
    setBsBusy(true);
    try {
      await authApi.bootstrapTeacher(bsForm);
      // 创建成功后自动用此账号登录
      await login(bsForm.username, bsForm.password);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '创建失败';
      setError(msg);
    } finally {
      setBsBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-secondary">
      <div className="w-[420px] max-w-[90vw] bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* 头部 Logo */}
        <div className="bg-gradient-to-r from-primary/30 to-primary/10 p-6 flex items-center gap-3 border-b border-border">
          <Factory className="w-10 h-10 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-text-primary">匠魂实训引擎</h1>
            <p className="text-xs text-text-muted">CraftForge · 工业 AI 实训平台</p>
          </div>
        </div>

        {/* 表单 */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">账号 / 学号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              autoComplete="username"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-text-primary text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-text-primary text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-danger/15 border border-danger/40 rounded-md text-xs text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {loading ? '登录中...' : '登 录'}
          </button>

          {/* 游客模式：跳过登录直接进场景画廊。不依赖后端、不调任何 API。 */}
          <button
            type="button"
            onClick={() => {
              // ⚠️ 顺序至关重要：必须**先**把 page 设为 gallery，再注入 user。
              //    否则 zustand 通知 AppRoot re-render 时 page 默认还是 'dashboard'，
              //    StudentDashboard 会被瞬间挂载并触发 loadAll → 4 个 401。
              usePageStore.getState().setPage('gallery');
              useAuthStore.setState({
                user: {
                  id: 'guest',
                  username: 'guest',
                  display_name: '游客体验',
                  student_no: null,
                  role: 'student',
                  class_id: null,
                  must_change_pw: false,
                  created_at: Date.now(),
                  last_login_at: Date.now(),
                },
                status: 'ready',
                error: null,
              });
            }}
            className="w-full py-2 border border-dashed border-border hover:border-primary hover:text-primary text-text-secondary rounded-md text-xs flex items-center justify-center gap-2 transition-colors"
          >
            👤 游客模式（跳过登录直接体验场景）
          </button>

          <div className="text-xs text-text-muted text-center">
            没有账号？请联系管理员 / 教师创建
          </div>
        </form>

        {/* 首次开荒入口（手动展开，不自动探测） */}
        <div className="px-6 pb-6">
          <details className="border border-warning/40 rounded-md bg-warning/5">
            <summary className="px-3 py-2 cursor-pointer text-xs text-warning flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5" />
              首次部署？点这里创建第一个教师账号
            </summary>
              <form onSubmit={handleBootstrap} className="p-3 space-y-2 border-t border-warning/40">
                <input
                  type="text"
                  placeholder="教师账号（如 teacher1）"
                  value={bsForm.username}
                  onChange={(e) => setBsForm({ ...bsForm, username: e.target.value })}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border rounded text-xs"
                />
                <input
                  type="text"
                  placeholder="教师姓名"
                  value={bsForm.display_name}
                  onChange={(e) => setBsForm({ ...bsForm, display_name: e.target.value })}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border rounded text-xs"
                />
                <input
                  type="password"
                  placeholder="设置密码（≥6 位）"
                  value={bsForm.password}
                  onChange={(e) => setBsForm({ ...bsForm, password: e.target.value })}
                  className="w-full px-2 py-1.5 bg-bg-tertiary border border-border rounded text-xs"
                />
                <button
                  type="submit"
                  disabled={bsBusy}
                  className="w-full py-1.5 bg-warning hover:bg-warning/90 text-white rounded text-xs disabled:opacity-50"
                >
                  {bsBusy ? '创建中...' : '创建教师并登录'}
                </button>
                <p className="text-[10px] text-text-muted text-center pt-1">
                  此入口只在系统初次部署、还没有教师账号时可用，创建后会自动关闭。
                </p>
              </form>
            </details>
          </div>

        {/* 底部：默认 admin 提示 */}
        <div className="px-6 pb-4 text-[11px] text-text-muted text-center border-t border-border pt-3">
          <KeyRound className="inline w-3 h-3 mr-1 align-text-bottom" />
          管理员默认账号：admin / admin123（首次登录请立即修改）
        </div>
      </div>
    </div>
  );
};
