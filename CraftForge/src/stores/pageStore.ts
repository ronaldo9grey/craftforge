// 页面切换 store：用最简方式实现"Dashboard / 工作台"两态切换
// 不引入 react-router，保持改动最小

import { create } from 'zustand';

export type AppPage = 'dashboard' | 'workbench';

interface PageState {
  page: AppPage;
  setPage: (p: AppPage) => void;
}

export const usePageStore = create<PageState>((set) => ({
  page: 'dashboard',  // 登录后默认进 Dashboard
  setPage: (page) => set({ page }),
}));
