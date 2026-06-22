import { create } from 'zustand';
import { soundService } from '@/services/soundService';

interface UIState {
  activeTemplate: 'fcc' | 'welding' | 'mixed' | null;
  sidebarLeftOpen: boolean;
  sidebarRightOpen: boolean;
  selectedEquipmentId: string | null;
  showParameterPanel: boolean;
  showScoreBoard: boolean;
  systemStatus: 'normal' | 'warning' | 'danger';
  // 现场音效总开关；与 aiStore.voiceEnabled（老张语音）独立
  soundEnabled: boolean;

  // Actions
  setActiveTemplate: (template: 'fcc' | 'welding' | 'mixed' | null) => void;
  toggleSidebarLeft: () => void;
  toggleSidebarRight: () => void;
  selectEquipment: (id: string | null) => void;
  toggleParameterPanel: () => void;
  toggleScoreBoard: () => void;
  setSystemStatus: (status: 'normal' | 'warning' | 'danger') => void;
  toggleSound: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeTemplate: null,
  sidebarLeftOpen: true,
  sidebarRightOpen: true,
  selectedEquipmentId: null,
  showParameterPanel: false,
  showScoreBoard: false,
  systemStatus: 'normal',
  soundEnabled: true,

  setActiveTemplate: (template) => set({ 
    activeTemplate: template, 
    selectedEquipmentId: null,
    showParameterPanel: false 
  }),
  toggleSidebarLeft: () => set((state) => ({ sidebarLeftOpen: !state.sidebarLeftOpen })),
  toggleSidebarRight: () => set((state) => ({ sidebarRightOpen: !state.sidebarRightOpen })),
  selectEquipment: (id) => set({ 
    selectedEquipmentId: id, 
    showParameterPanel: id !== null 
  }),
  toggleParameterPanel: () => set((state) => ({ showParameterPanel: !state.showParameterPanel })),
  toggleScoreBoard: () => set((state) => ({ showScoreBoard: !state.showScoreBoard })),
  setSystemStatus: (status) => set({ systemStatus: status }),
  toggleSound: () => {
    const next = !get().soundEnabled;
    set({ soundEnabled: next });
    // 关闭音效时立刻静音并停掉环境音；开启时取消静音
    if (next) {
      soundService.unmute();
    } else {
      soundService.mute();
      soundService.stopAmbient();
    }
  },
}));
