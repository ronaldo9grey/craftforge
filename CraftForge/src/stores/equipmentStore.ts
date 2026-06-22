import { create } from 'zustand';
import type { Equipment, Pipeline, Alarm, OperationRecord } from '@/types';
import { getScenePack } from '@/templates';

interface EquipmentState {
  equipments: Equipment[];
  pipelines: Pipeline[];
  alarms: Alarm[];
  // 按设备 id 分组的操作历史，用于"历史记录"视图展示
  operationHistory: Record<string, OperationRecord[]>;

  // Actions
  loadTemplate: (template: string) => void;
  // 更新参数实际值；silent=true 时跳过 operationHistory 写入（供动力学引擎内部演化使用）
  updateParameter: (equipmentId: string, paramId: string, value: number, silent?: boolean) => void;
  // 仅更新参数 setpoint（目标值），不触发任何副作用，由动力学引擎驱动 value 逐步逼近
  setSetpoint: (equipmentId: string, paramId: string, value: number) => void;
  setEquipmentStatus: (equipmentId: string, status: Equipment['status']) => void;
  addAlarm: (alarm: Alarm) => void;
  acknowledgeAlarm: (alarmId: string) => void;
  clearAlarms: () => void;
  getEquipmentById: (id: string) => Equipment | undefined;
  // 追加一条设备操作记录（同时被 updateParameter 内部调用）
  addOperationRecord: (eqId: string, record: OperationRecord) => void;
}

export const useEquipmentStore = create<EquipmentState>((set, get) => ({
  equipments: [],
  pipelines: [],
  alarms: [],
  operationHistory: {},

  loadTemplate: (template) => {
    const pack = getScenePack(template);
    if (!pack) {
      console.warn(`[equipmentStore] 场景 "${template}" 未注册，回退到 fcc`);
      const fallback = getScenePack('fcc');
      if (!fallback) return;
      set({
        equipments: fallback.equipments.map((e) => ({
          ...e,
          parameters: e.parameters.map((p) => ({ ...p, setpoint: p.setpoint ?? p.value })),
        })),
        pipelines: fallback.pipelines,
        alarms: [],
        operationHistory: {},
      });
      return;
    }
    set({
      equipments: pack.equipments.map((e) => ({
        ...e,
        parameters: e.parameters.map((p) => ({ ...p, setpoint: p.setpoint ?? p.value })),
      })),
      pipelines: pack.pipelines,
      alarms: [],
      operationHistory: {},
    });
  },

  // 写入参数"实际值"。
  //   silent=false（默认）：常规人工调参或外部模拟，会写入操作历史；
  //   silent=true：动力学引擎内部演化用，不写历史、不进评分。
  updateParameter: (equipmentId, paramId, value, silent = false) => {
    // 先取出旧值与参数名，便于生成可读的操作记录
    const equipment = get().equipments.find((eq) => eq.id === equipmentId);
    const param = equipment?.parameters.find((p) => p.id === paramId);
    const oldValue = param?.value;
    const paramName = param?.name ?? paramId;

    set((state) => ({
      equipments: state.equipments.map((eq) => {
        if (eq.id !== equipmentId) return eq;
        return {
          ...eq,
          parameters: eq.parameters.map((p) => {
            if (p.id !== paramId) return p;
            const newTrend = [...p.trend, value].slice(-60);
            return { ...p, value, trend: newTrend };
          }),
        };
      }),
    }));

    // silent 模式：动力学引擎自然演化，不进操作历史
    if (silent) return;

    // 自动记录一条操作日志（仅在数值实际变化时记录，避免重复）
    if (oldValue !== undefined && oldValue !== value) {
      const isNormal = param ? value >= param.normalMin && value <= param.normalMax : true;
      const record: OperationRecord = {
        timestamp: Date.now(),
        action: `调整参数: ${paramName} ${oldValue} -> ${value}`,
        targetEquipment: equipmentId,
        parameterChange: { param: paramId, from: Number(oldValue), to: value },
        isCorrect: isNormal,
        aiFeedback: '',
      };
      get().addOperationRecord(equipmentId, record);
    }
  },

  // 仅修改 setpoint（目标值）；不会写 value、不会写历史，由动力学引擎驱动 value 演化
  setSetpoint: (equipmentId, paramId, value) => {
    set((state) => ({
      equipments: state.equipments.map((eq) => {
        if (eq.id !== equipmentId) return eq;
        return {
          ...eq,
          parameters: eq.parameters.map((p) =>
            p.id === paramId ? { ...p, setpoint: value } : p,
          ),
        };
      }),
    }));
  },

  setEquipmentStatus: (equipmentId, status) => {
    set((state) => ({
      equipments: state.equipments.map((eq) =>
        eq.id === equipmentId ? { ...eq, status } : eq
      ),
    }));
  },

  addAlarm: (alarm) => {
    set((state) => ({ alarms: [...state.alarms, alarm] }));
  },

  acknowledgeAlarm: (alarmId) => {
    set((state) => ({
      alarms: state.alarms.map((a) =>
        a.id === alarmId ? { ...a, acknowledged: true } : a
      ),
    }));
  },

  clearAlarms: () => set({ alarms: [] }),

  getEquipmentById: (id) => {
    return get().equipments.find((e) => e.id === id);
  },

  addOperationRecord: (eqId, record) => {
    set((state) => {
      const prev = state.operationHistory[eqId] ?? [];
      // 仅保留最近 50 条，避免历史无限制增长
      const next = [...prev, record].slice(-50);
      return {
        operationHistory: { ...state.operationHistory, [eqId]: next },
      };
    });
  },
}));
