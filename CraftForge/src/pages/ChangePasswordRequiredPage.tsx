import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api';
import { ShieldAlert, KeyRound, LogOut } from 'lucide-react';

/**
 * 强制改密页：当 user.must_change_pw === true 时强制弹出，不能跳过
 * 改密成功后 store 自动 refresh，回到主应用
 */
export const ChangePasswordRequiredPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (newPw.length < 6) {
      setErr('新密码至少 6 位');
      return;
    }
    if (newPw !== newPw2) {
      setErr('两次新密码不一致');
      return;
    }
    if (newPw === oldPw) {
      setErr('新密码不能与旧密码相同');
      return;
    }
    setBusy(true);
    try {
      await changePassword(oldPw, newPw);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : '修改失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-secondary">
      <div className="w-[420px] max-w-[90vw] bg-bg-secondary border border-warning/40 rounded-xl shadow-2xl">
        <div className="bg-warning/15 p-5 border-b border-warning/40 flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-warning" />
          <div>
            <h2 className="text-base font-semibold text-text-primary">请先修改初始密码</h2>
            <p className="text-xs text-text-muted">为了安全，{user?.display_name} 您必须先设置新密码</p>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">当前密码</label>
            <input
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">新密码（≥6 位）</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">再次输入新密码</label>
            <input
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-md text-sm"
            />
          </div>

          {err && (
            <div className="px-3 py-2 bg-danger/15 border border-danger/40 rounded-md text-xs text-danger">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-warning hover:bg-warning/90 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            {busy ? '提交中...' : '设置新密码'}
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="w-full py-2 text-xs text-text-muted hover:text-text-primary flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> 退出登录
          </button>
        </form>
      </div>
    </div>
  );
};
