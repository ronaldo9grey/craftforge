// 电解铝车间动力学耦合规则
//
// 核心物理化学链路：
//
// A. 极距 ↑ → 槽电压 ↑（欧姆压降）
// B. 系列电流 ↑ → 槽电压 ↑（IR 压降）
// C. 系列电流 ↑ → 电解质温度 ↑（焦耳热）
// D. 氧化铝浓度 ↓ → 槽噪声 ↑ → 阳极效应风险（不直接，需故障驱动 EF005）
// E. 氧化铝浓度 ↓ → 电流效率 ↓（次要副反应增多）
// F. 电解质温度 ↑ → HF 挥发 ↑ → 烟气 HF 浓度 ↑
// G. 电解质温度 ↑ → 铝水温度 ↑（共享熔池热）
// H. 分子比 ↑（偏碱）→ 电解质温度 ↑（电导率上升放热多）
// I. 整流二次直流电压 → 系列电流（V=IR 直接转换）
// J. 系列电流 → 母线电流（汇总）
// K. 调压档位 → 二次直流电压
// L. 引风机频率 → 烟气温度（散热）
// M. 阳极天车提升力 → 残极重量（更换关系）
// N. 真空泵压力 → 抬包真空度（直接传递）
// O. 抬包真空度 → 铝水量（吸出量）
// P. 系列电流 → 母线温度（焦耳热）
// Q. 槽电压 → 槽噪声（异常时电压抖动）
// R. 流化风压 → 下料速率（气力输送）
// S. 下料速率 → 槽内氧化铝浓度（4 槽分担，简化为 CELL-101）
// T. 电解质温度 → 铝水温度（CELL-101 → POT-202）

import type { CouplingRule } from '@/engine/dynamics';

// 每个电解槽独立耦合的模板
function cellCouplings(cellId: string): CouplingRule[] {
  return [
    // A. 极距 → 槽电压：极距 4.5→6.0 → 电压 +0.15×1.5 = +0.225V
    { from: { equipmentId: cellId, param: 'anode_distance' }, to: { equipmentId: cellId, param: 'cell_voltage' }, gain: 0.15, baseline: 4.5, tau: 3 },
    // B. 系列电流 → 槽电压：电流 480→520 → 电压 +0.002×40 = +0.08V
    { from: { equipmentId: cellId, param: 'series_current' }, to: { equipmentId: cellId, param: 'cell_voltage' }, gain: 0.002, baseline: 480, tau: 2 },
    // C. 系列电流 → 电解质温度（焦耳热）：电流 480→520 → 温度 +0.4×40 = +16°C
    { from: { equipmentId: cellId, param: 'series_current' }, to: { equipmentId: cellId, param: 'bath_temp' }, gain: 0.4, baseline: 480, tau: 30 },
    // D. 氧化铝浓度 → 槽噪声：浓度低 → 噪声升
    { from: { equipmentId: cellId, param: 'alumina_conc' }, to: { equipmentId: cellId, param: 'noise_level' }, gain: -20, baseline: 2.5, tau: 10 },
    // E. 氧化铝浓度 → 电流效率
    { from: { equipmentId: cellId, param: 'alumina_conc' }, to: { equipmentId: cellId, param: 'current_eff' }, gain: 3, baseline: 2.5, tau: 25 },
    // F. 电解质温度 → 反馈到本槽铝水高度（高温使铝溶解）
    { from: { equipmentId: cellId, param: 'bath_temp' }, to: { equipmentId: cellId, param: 'al_height' }, gain: -0.05, baseline: 955, tau: 30 },
    // G. 分子比 → 电解质温度（碱性高 → 电导率高 → 焦耳放热多）
    { from: { equipmentId: cellId, param: 'mol_ratio' }, to: { equipmentId: cellId, param: 'bath_temp' }, gain: 25, baseline: 2.4, tau: 30 },
    // Q. 槽电压 → 槽噪声（电压剧烈波动反映噪声）
    { from: { equipmentId: cellId, param: 'cell_voltage' }, to: { equipmentId: cellId, param: 'noise_level' }, gain: 80, baseline: 4.15, tau: 3 },
  ];
}

export const aluminumCouplings: CouplingRule[] = [
  // 4 槽各自耦合
  ...cellCouplings('CELL-101'),
  ...cellCouplings('CELL-102'),
  ...cellCouplings('CELL-103'),
  ...cellCouplings('CELL-104'),

  // I. 整流二次直流电压 → 系列电流（V=IR 直接驱动）
  // 二次电压 1660→1700 → 系列电流 +(1.0)×40 = +40 kA → 480→520
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-101', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-102', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-103', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'CELL-104', param: 'series_current' }, gain: 1.0, baseline: 1660, tau: 2 },
  // 调压档位 → 二次电压：档位 18→22 → 电压 +10×4 = +40V → 1660→1700
  { from: { equipmentId: 'TRA-301', param: 'tap_position' }, to: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, gain: 10, baseline: 18, tau: 1.5 },

  // J. 系列电流 → 母线电流（汇总，取 CELL-101 代表系列状态）
  { from: { equipmentId: 'CELL-101', param: 'series_current' }, to: { equipmentId: 'BUS-101', param: 'bus_current' }, gain: 1.0, baseline: 480, tau: 1 },
  // P. 母线电流 → 母线温度（焦耳热）
  { from: { equipmentId: 'BUS-101', param: 'bus_current' }, to: { equipmentId: 'BUS-101', param: 'bus_temp' }, gain: 0.2, baseline: 480, tau: 30 },
  // 二次电压 → 母线电压（直接传递）
  { from: { equipmentId: 'TRA-301', param: 'secondary_dc_volt' }, to: { equipmentId: 'BUS-101', param: 'bus_voltage' }, gain: 1.0, baseline: 1660, tau: 1 },

  // F. 电解质温度 → HF 排放（高温下氟挥发）
  // CELL-101 温度 955→985 → HF 浓度 +0.06×30 = +1.8 mg/m³ → 2.1→3.9 (超 normalMax 3)
  { from: { equipmentId: 'CELL-101', param: 'bath_temp' }, to: { equipmentId: 'FGT-301', param: 'hf_conc' }, gain: 0.06, baseline: 955, tau: 15 },

  // L. 引风机频率 → 烟气温度（反向：频率高散热好温度低）
  { from: { equipmentId: 'FGT-301', param: 'fan_freq' }, to: { equipmentId: 'FGT-301', param: 'flue_temp' }, gain: -2, baseline: 45, tau: 15 },

  // N. 真空泵压力 → 抬包真空度（直接传递）
  { from: { equipmentId: 'CRANE-301', param: 'vacuum_pump_p' }, to: { equipmentId: 'POT-202', param: 'vacuum_pressure' }, gain: 0.9, baseline: -88, tau: 2 },
  // O. 抬包真空度 → 铝水量（真空越好越能抽出）
  { from: { equipmentId: 'POT-202', param: 'vacuum_pressure' }, to: { equipmentId: 'POT-202', param: 'al_metal_qty' }, gain: 0.04, baseline: -80, tau: 5 },

  // T. CELL-101 电解质温度 → 抬包铝水温度
  { from: { equipmentId: 'CELL-101', param: 'bath_temp' }, to: { equipmentId: 'POT-202', param: 'al_metal_temp' }, gain: 0.8, baseline: 955, tau: 25 },

  // R. 流化风压 → 下料速率
  { from: { equipmentId: 'AL-201', param: 'fluid_air_p' }, to: { equipmentId: 'AL-201', param: 'feed_flow' }, gain: 5, baseline: 0.18, tau: 4 },
  // S. 下料速率 → 氧化铝浓度（CELL-101 受影响）
  { from: { equipmentId: 'AL-201', param: 'feed_flow' }, to: { equipmentId: 'CELL-101', param: 'alumina_conc' }, gain: 0.6, baseline: 1.8, tau: 25 },

  // 铸出率随铝水温度反向（温度低浇不出）
  { from: { equipmentId: 'POT-202', param: 'al_metal_temp' }, to: { equipmentId: 'CAST-202', param: 'al_yield' }, gain: 0.05, baseline: 920, tau: 10 },
];
