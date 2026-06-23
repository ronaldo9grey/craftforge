// 注塑成型动力学耦合规则
//
// 核心物理链路：
//
// A. 螺杆转速 ↑ → 注射压力 ↑（剪切热+背压上升）
// B. 加热筒计量段温度 → 物料温度 → 喷嘴温度（顺序传热）
// C. 注射压力 → 注射速度（在限制流量下耦合）
// D. 模具温度 ↑ → 周期时间 ↑（冷却时间不够）
// E. 模具温度 ↑ → 尺寸偏差 ↑（热膨胀）
// F. 冷却水流量 → 模具温度（反向：流量↓ → 模温↑）
// G. 含水率 ↑ → 外观缺陷数 ↑（银纹/气泡）
// H. 锁模力 ↓ → 外观缺陷数 ↑（飞边）
// I. 加热筒温度过高 → 注射压力升（熔体黏度降但泵送特性变）
// J. 干燥温度 → 含水率（反向）

import type { CouplingRule } from '@/engine/dynamics';

export const injectionCouplings: CouplingRule[] = [
  // A. 螺杆转速 → 注射压力（每台机各自独立）
  { from: { equipmentId: 'IMM-101', param: 'screw_speed' }, to: { equipmentId: 'IMM-101', param: 'inject_pressure' }, gain: 0.6, baseline: 80, tau: 2 },
  { from: { equipmentId: 'IMM-102', param: 'screw_speed' }, to: { equipmentId: 'IMM-102', param: 'inject_pressure' }, gain: 0.6, baseline: 85, tau: 2 },

  // B. 加热筒计量段 → 喷嘴温度（顺序热传递）
  { from: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, to: { equipmentId: 'HEAT-301', param: 'nozzle_temp' }, gain: 0.9, baseline: 240, tau: 15 },

  // 物料温度跟随干燥温度
  { from: { equipmentId: 'DRY-201', param: 'dry_temp' }, to: { equipmentId: 'HOP-201', param: 'mat_temp' }, gain: 0.4, baseline: 85, tau: 20 },

  // C. 注射压力 → 注射速度（高压时速度受限稍降）
  { from: { equipmentId: 'IMM-101', param: 'inject_pressure' }, to: { equipmentId: 'IMM-101', param: 'inject_speed' }, gain: -0.15, baseline: 85, tau: 1 },
  { from: { equipmentId: 'IMM-102', param: 'inject_pressure' }, to: { equipmentId: 'IMM-102', param: 'inject_speed' }, gain: -0.15, baseline: 92, tau: 1 },

  // D. 模具温度 → 周期时间（模温高 → 冷却时间不足 → 周期延长）
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'IMM-101', param: 'cycle_time' }, gain: 0.2, baseline: 55, tau: 10 },
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'IMM-102', param: 'cycle_time' }, gain: 0.2, baseline: 55, tau: 10 },

  // E. 模具温度 → 尺寸偏差（热膨胀）
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'INST-201', param: 'dim_dev' }, gain: 0.003, baseline: 55, tau: 8 },

  // F. 冷却水流量 → 模具温度（反向：流量越小，模温越高）
  { from: { equipmentId: 'CHILL-301', param: 'chiller_flow' }, to: { equipmentId: 'MOLD-201', param: 'mold_temp' }, gain: -2, baseline: 18, tau: 15 },

  // 冷却水出水温度跟随模具温度
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'CHILL-301', param: 'water_out_temp' }, gain: 0.25, baseline: 55, tau: 10 },

  // G. 含水率 → 外观缺陷数
  { from: { equipmentId: 'DRY-201', param: 'moisture_ppm' }, to: { equipmentId: 'INST-201', param: 'defect_count' }, gain: 0.015, baseline: 280, tau: 5 },

  // H. 锁模力 → 外观缺陷数（反向：锁模力低 → 缺陷高）
  { from: { equipmentId: 'IMM-101', param: 'clamp_force' }, to: { equipmentId: 'INST-201', param: 'defect_count' }, gain: -0.008, baseline: 1200, tau: 4 },
  { from: { equipmentId: 'IMM-102', param: 'clamp_force' }, to: { equipmentId: 'INST-201', param: 'defect_count' }, gain: -0.008, baseline: 1250, tau: 4 },

  // I. 加热筒温度过高 → 注射压力升（黏度反常）
  { from: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, to: { equipmentId: 'IMM-101', param: 'inject_pressure' }, gain: 0.15, baseline: 240, tau: 8 },
  { from: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, to: { equipmentId: 'IMM-102', param: 'inject_pressure' }, gain: 0.15, baseline: 240, tau: 8 },

  // J. 干燥温度 → 含水率（反向：干燥温度高 → 含水率低）
  { from: { equipmentId: 'DRY-201', param: 'dry_temp' }, to: { equipmentId: 'DRY-201', param: 'moisture_ppm' }, gain: -10, baseline: 85, tau: 15 },

  // K. 合格率随缺陷数反向
  { from: { equipmentId: 'INST-201', param: 'defect_count' }, to: { equipmentId: 'ST-202', param: 'pass_rate' }, gain: -1.5, baseline: 1, tau: 5 },
];
