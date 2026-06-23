// 页面切换 store：用最简方式实现多页面切换
// 不引入 react-router，保持改动最小

import { create } from 'zustand';

export type AppPage = 'dashboard' | 'gallery' | 'workbench' | 'history' | 'history-detail';

interface PageState {
  page: AppPage;
  /** 演练详情页要展示的记录 ID */
  detailRecordId: string | null;
  setPage: (p: AppPage) => void;
  setDetailRecordId: (id: string | null) => void;
}

export const usePageStore = create<PageState>((set) => ({
  page: 'dashboard',  // 登录后默认进 Dashboard
  detailRecordId: null,
  setPage: (page) => set({ page }),
  setDetailRecordId: (detailRecordId) => set({ detailRecordId }),
}));

