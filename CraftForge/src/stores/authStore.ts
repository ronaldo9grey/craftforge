// 用户认证状态管理 (zustand)
// - user / token 持久化到 localStorage（user 信息缓存 + token 由 tokenStorage 单独管理）
// - 应用启动时若有 token，自动调用 /api/auth/me 拉新鲜的用户信息
// - 401 时自动登出并触发 UI 跳回登录页

import { create } from 'zustand';
import { authApi, tokenStorage, registerOn401, type PublicUser, ApiError } from '@/services/api';

interface AuthState {
  user: PublicUser | null;
  /** 'idle' 初始 | 'loading' 正在初始化（拉 /me） | 'ready' 已就绪 */
  status: 'idle' | 'loading' | 'ready';
  /** 登录页/操作的错误信息 */
  error: string | null;

  /** 应用启动时调用：若有 token 则拉 /me 恢复登录态 */
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPw: string, newPw: string) => Promise<void>;
  /** 服务端 401 触发的强制登出（不发请求） */
  forceLogout: () => void;
  /** 刷新当前用户信息（如改密后） */
  refresh: () => Promise<void>;
  setError: (msg: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  bootstrap: async () => {
    set({ status: 'loading' });
    const token = tokenStorage.get();
    if (!token) {
      set({ user: null, status: 'ready' });
      return;
    }
    try {
      const { user } = await authApi.me();
      set({ user, status: 'ready' });
    } catch {
      // token 失效，清掉
      tokenStorage.clear();
      set({ user: null, status: 'ready' });
    }
  },

  login: async (username, password) => {
    set({ error: null });
    try {
      const { token, user } = await authApi.login(username, password);
      tokenStorage.set(token);
      set({ user, status: 'ready' });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : '登录失败';
      set({ error: msg });
      throw e;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // 即使后端失败也强制清掉本地
    }
    tokenStorage.clear();
    set({ user: null });
  },

  forceLogout: () => {
    tokenStorage.clear();
    set({ user: null });
  },

  changePassword: async (oldPw, newPw) => {
    await authApi.changePassword(oldPw, newPw);
    // 改密成功后刷新用户信息（must_change_pw 变成 false）
    await get().refresh();
  },

  refresh: async () => {
    try {
      const { user } = await authApi.me();
      set({ user });
    } catch {
      /* ignore */
    }
  },

  setError: (msg) => set({ error: msg }),
}));

// 注册 401 全局回调（在 api.ts 里被调）
registerOn401(() => {
  useAuthStore.getState().forceLogout();
});
