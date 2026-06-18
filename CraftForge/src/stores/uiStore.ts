import { create } from 'zustand';

interface UIState {
  activeTemplate: 'fcc' | 'welding' | 'mixed' | null;
  sidebarLeftOpen: boolean;
  sidebarRightOpen: boolean;
  selectedEquipmentId: string | null;
  showParameterPanel: boolean;
  showScoreBoard: boolean;
  systemStatus: 'normal' | 'warning' | 'danger';
  
  // Actions
  setActiveTemplate: (template: 'fcc' | 'welding' | 'mixed' | null) => void;
  toggleSidebarLeft: () => void;
  toggleSidebarRight: () => void;
  selectEquipment: (id: string | null) => void;
  toggleParameterPanel: () => void;
  toggleScoreBoard: () => void;
  setSystemStatus: (status: 'normal' | 'warning' | 'danger') => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTemplate: null,
  sidebarLeftOpen: true,
  sidebarRightOpen: true,
  selectedEquipmentId: null,
  showParameterPanel: false,
  showScoreBoard: false,
  systemStatus: 'normal',

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
}));
