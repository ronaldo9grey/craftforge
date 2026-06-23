// 动力学发散状态全局 store
// - DynamicsEngine 每个 tick 把 activeDivergingParams 集合同步到这里
// - UI 组件（ParameterPanel / 设备 tooltip）读取来显示"⚠️ 持续恶化中"标记

import { create } from 'zustand';

interface DivergenceState {
  /** 当前正在发散的参数 key 集合，格式 "eqId::paramId" */
  divergingKeys: Set<string>;
  setDivergingKeys: (keys: Set<string>) => void;
}

export const useDivergenceStore = create<DivergenceState>((set) => ({
  divergingKeys: new Set(),
  setDivergingKeys: (keys) => set({ divergingKeys: new Set(keys) }),
}));

/** 工具函数：判断某个参数当前是否正在发散 */
export function isParamDiverging(equipmentId: string, paramId: string): boolean {
  return useDivergenceStore.getState().divergingKeys.has(`${equipmentId}::${paramId}`);
}
