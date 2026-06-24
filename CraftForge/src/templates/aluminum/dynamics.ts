// 电解铝车间动力学耦合规则 v2 - 适配 v5 config（4 槽 + 槽控柜 + 控制层独立）
//
// 核心物理化学链路：
//
// A. 极距 ↑ → 槽电压 ↑（欧姆压降）
// B. 系列电流 ↑ → 槽电压 ↑（IR 压降）
// C. 系列电流 ↑ → 电解质温度 ↑（焦耳热）
// D. 氧化铝浓度 ↓ → 槽噪声 ↑
// E. 氧化铝浓度 ↑ → 电流效率 ↑
// G. 分子比 ↑（偏碱）→ 电解质温度 ↑
// I. 整流二次直流电压 → 系列电流（每槽）
// J. 调压档位 → 二次直流电压
// K. 系列电流 → 直流母线电流（整流变压器）
// L. 直流母线电流 → 直流母线温度（焦耳热）
// M. 电解质温度 → HF 排放（高温下氟挥发）
// N. 引风机频率 → 烟气温度（散热）
// O. 打壳频次 → 槽内氧化铝浓度
// P. 槽电压 → 槽噪声（异常电压抖动）

import type { CouplingRule } from '@/engine/dynamics';

// 每个电解槽独立耦合
function cellCouplings(cellId: string): CouplingRule[] {
  return [
    // A. 极距 → 槽电压
    { from: { equipmentId: cellId, param: 'anode_distance' }, to: { equipmentId: cellId, param: 'cell_voltage' }, gain: 0.15, baseline: 4.5, tau: 3 },
    // B. 系列电流 → 槽电压
    { from: { equipmentId: cellId, param: 'series_current' }, to: { equipmentId: cellId, param: 'cell_voltage' }, gain: 0.002, baseline: 480, tau: 2 },
    // C. 系列电流 → 电解质温度
    { from: { equipmentId: cellId, param: 'series_current' }, to: { equipmentId: cellId, param: 'bath_temp' }, gain: 0.4, baseline: 480, tau: 30 },
    // D. 氧化铝浓度 → 槽噪声
    { from: { equipmentId: cellId, param: 'alumina_conc' }, to: { equipmentId: cellId, param: 'noise_level' }, gain: -20, baseline: 2.5, tau: 10 },
    // E. 氧化铝浓度 → 电流效率
    { from: { equipmentId: cellId, param: 'alumina_conc' }, to: { equipmentId: cellId, param: 'current_eff' }, gain: 3, baseline: 2.5, tau: 25 },
    // F. 电解质温度 → 铝水高度（高温溶解 Al）
    { from: { equipmentId: cellId, param: 'bath_temp' }, to: { equipmentId: cellId, param: 'al_height' }, gain: -0.05, baseline: 955, tau: 30 },
    // G. 分子比 → 电解质温度
    { from: { equipmentId: cellId, param: 'mol_ratio' }, to: { equipmentId: cellId, param: 'bath_temp' }, gain: 25, baseline: 2.4, tau: 30 },
    // P. 槽电压 → 槽噪声
    { from: { equipmentId: cellId, param: 'cell_voltage' }, to: { equipmentId: cellId, param: 'noise_level' }, gain: 80, baseline: 4.15, tau: 3 },
    // O. 打壳频次 → 氧化铝浓度（同槽自驱）
    { from: { equipmentId: cellId, param: 'break_freq' }, to: { equipmentId: cellId, param: 'alumina_conc' }, gain: 0.15, baseline: 6, tau: 25 },
  ];
}

export const aluminumCouplings: CouplingRule[] = [
  ...cellCouplings('CELL-101'),
  ...cellCouplings('CELL-102'),
  ...cellCouplings('CELL-103'),
  ...cellCouplings('CELL-104'),

  // I. 整流二次直流电压 → 每槽系列电流
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-101', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-102', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-103', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-104', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },

  // J. 调压档位 → 二次电压
  { from: { equipmentId: 'TRA-301', param: 'tap_position' }, to: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, gain: 10, baseline: 18, tau: 1.5 },

  // K. CELL-101 系列电流 → 母线电流（汇总，取代表）
  { from: { equipmentId: 'CELL-101', param: 'series_current' }, to: { equipmentId: 'TRA-301', param: 'bus_current' }, gain: 1.0, baseline: 480, tau: 1 },
  // L. 母线电流 → 母线温度
  { from: { equipmentId: 'TRA-301', param: 'bus_current' }, to: { equipmentId: 'TRA-301', param: 'bus_temp' }, gain: 0.06, baseline: 480, tau: 30 },

  // M. CELL-101 电解质温度 → HF 排放
  { from: { equipmentId: 'CELL-101', param: 'bath_temp' }, to: { equipmentId: 'FGT-301', param: 'hf_conc' }, gain: 0.06, baseline: 955, tau: 15 },

  // N. 引风机频率 → 烟气温度（反向）
  { from: { equipmentId: 'FGT-301', param: 'fan_freq' }, to: { equipmentId: 'FGT-301', param: 'flue_temp' }, gain: -2, baseline: 45, tau: 15 },

  // CELL-101 电解质温度 → 集控室抬包铝水温
  { from: { equipmentId: 'CELL-101', param: 'bath_temp' }, to: { equipmentId: 'HMI-301', param: 'al_metal_temp' }, gain: 0.8, baseline: 955, tau: 25 },
];
