// 阳极焙烧炉车间动力学耦合规则 v1
import type { CouplingRule } from '@/engine/dynamics';

export const bakingCouplings: CouplingRule[] = [
  // 燃料气流量 → 3 号恒温炉室温度（核心炉室）
  {
    from: { equipmentId: 'BAKE-K3', param: 'gas_flow' },
    to:   { equipmentId: 'BAKE-K3', param: 'room_temp' },
    gain: 5.0, baseline: 130, tau: 60,
  },
  // 炉室温度 → 左右火道温度（同步）
  {
    from: { equipmentId: 'BAKE-K3', param: 'room_temp' },
    to:   { equipmentId: 'BAKE-K3', param: 'flue_temp_l' },
    gain: 1.05, baseline: 1100, tau: 40,
  },
  {
    from: { equipmentId: 'BAKE-K3', param: 'room_temp' },
    to:   { equipmentId: 'BAKE-K3', param: 'flue_temp_r' },
    gain: 0.95, baseline: 1100, tau: 40,
  },

  // 抽烟机转速 → 抽气流量
  {
    from: { equipmentId: 'FAN-401', param: 'fan_speed' },
    to:   { equipmentId: 'FAN-401', param: 'suction_flow' },
    gain: 5.5, baseline: 1380, tau: 5,
  },
  // 抽气流量 → 烟道负压（流量↑→负压更负，绝压↓）
  {
    from: { equipmentId: 'FAN-401', param: 'suction_flow' },
    to:   { equipmentId: 'FLUE-301', param: 'flue_pressure' },
    gain: -0.025, baseline: 8200, tau: 8,
  },
  // 抽气流量 → 电机电流
  {
    from: { equipmentId: 'FAN-401', param: 'suction_flow' },
    to:   { equipmentId: 'FAN-401', param: 'fan_current' },
    gain: 0.012, baseline: 8200, tau: 4,
  },

  // 燃料气压力 → 燃料气流量（压力高→流量大）
  {
    from: { equipmentId: 'GAS-701', param: 'gas_pressure' },
    to:   { equipmentId: 'BAKE-K3', param: 'gas_flow' },
    gain: 8, baseline: 10, tau: 6,
  },

  // 焙烧温度 → 出炉熟阳极温度
  {
    from: { equipmentId: 'BAKE-K3', param: 'room_temp' },
    to:   { equipmentId: 'OUT-K5', param: 'out_temp' },
    gain: 0.18, baseline: 1100, tau: 90,
  },

  // 焙烧温度 → 电阻率（温度高→电阻率低，反相关）
  {
    from: { equipmentId: 'BAKE-K3', param: 'room_temp' },
    to:   { equipmentId: 'OUT-K5', param: 'electric_res' },
    gain: -0.035, baseline: 1100, tau: 120,
  },

  // 左右火道温差 → 最大温差
  // 这里简化：把左火道温度作为单一来源，gain 反向接到 max_dev
  {
    from: { equipmentId: 'BAKE-K3', param: 'flue_temp_l' },
    to:   { equipmentId: 'HMI-902', param: 'max_dev' },
    gain: 0.5, baseline: 1115, tau: 15,
  },

  // 抽烟机入口含尘 → 净化器出口含尘
  {
    from: { equipmentId: 'PUR-501', param: 'inlet_dust' },
    to:   { equipmentId: 'PUR-501', param: 'outlet_dust' },
    gain: 0.05, baseline: 250, tau: 8,
  },

  // 焙烧温度异常/温差大 → 合格率下降
  {
    from: { equipmentId: 'HMI-902', param: 'max_dev' },
    to:   { equipmentId: 'HMI-903', param: 'qc_ratio' },
    gain: -0.3, baseline: 12, tau: 30,
  },
];
