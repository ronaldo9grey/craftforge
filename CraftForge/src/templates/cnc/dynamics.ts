// CNC 加工场景动力学耦合规则
//
// === 核心物理链路 ===
//
// A. 主轴转速 ↑ → 主轴负载 ↑（切削功率 = 力矩 × ω）
//    gain ≈ 0.015 %/rpm （CNC-101 车床 baseline=1800）
//    gain ≈ 0.005 %/rpm （CNC-102 铣床 baseline=6000）
//
// B. 主轴负载 ↑ → 主轴温度 ↑（电机发热，热惯性大）
//    gain ≈ 0.4 °C/% load  ·  baseline=55  ·  τ=25s
//
// C. 主轴转速 ↑ → 振动 ↑（动不平衡放大）
//    gain ≈ 0.0015 (mm/s)/rpm
//
// D. 主轴转速 ↑ → 刀具磨损 ↑（缓慢累积）
//    gain ≈ 0.005 %/rpm baseline=1800 τ=20s
//
// E. 刀具磨损 ↑ → 振动 ↑（恶化）
//    gain ≈ 0.04 (mm/s)/%wear baseline=15
//
// F. 刀具磨损 ↑ → 表面粗糙度 ↑
//    gain ≈ 0.04 μm/% wear baseline=15 τ=10s
//
// G. 振动 ↑ → 尺寸偏差 ↑
//    gain ≈ 0.02 mm/(mm/s) baseline=1.5 τ=8s
//
// H. 冷却液流量 ↓ → 主轴温度 ↑（冷却失效）
//    gain ≈ -1.5 °C/(L/min) baseline=12 τ=20s
//
// I. 冷却液流量 → 刀具磨损（冷却不足加快磨损）
//    gain ≈ -0.3 %/(L/min) baseline=12 τ=15s
//
// J. 进给速度 ↑ → 主轴负载 ↑（切削负荷）
//    CNC-101 (mm/r) baseline=0.15  gain ≈ 150 %/(mm/r)
//    CNC-102 (mm/min) baseline=800 gain ≈ 0.03 %/(mm/min)
//
// K. 夹紧力 ↓ → 同心度 ↑（变差）
//    gain ≈ -0.000005 mm/N baseline=8000
//
// L. 同心度 ↑ → 尺寸偏差 ↑
//    gain ≈ 1.0 mm/mm（直接传递）
//
// M. 排屑速度 ↓ → 切屑负载 ↑（堆积）
//    gain ≈ -50 %/(m/min) baseline=0.5 τ=8s

import type { CouplingRule } from '@/engine/dynamics';

export const cncCouplings: CouplingRule[] = [
  // === A. 主轴转速 → 主轴负载（每台机床独立） ===
  { from: { equipmentId: 'CNC-101', param: 'spindle_speed' }, to: { equipmentId: 'CNC-101', param: 'spindle_load' }, gain: 0.015, baseline: 1800, tau: 1.5 },
  { from: { equipmentId: 'CNC-102', param: 'spindle_speed' }, to: { equipmentId: 'CNC-102', param: 'spindle_load' }, gain: 0.005, baseline: 6000, tau: 1.5 },

  // === B. 主轴负载 → 主轴温度（热惯性大） ===
  { from: { equipmentId: 'CNC-101', param: 'spindle_load' }, to: { equipmentId: 'CNC-101', param: 'spindle_temp' }, gain: 0.4, baseline: 55, tau: 25 },
  { from: { equipmentId: 'CNC-102', param: 'spindle_load' }, to: { equipmentId: 'CNC-102', param: 'spindle_temp' }, gain: 0.4, baseline: 48, tau: 25 },

  // === C. 主轴转速 → 振动 ===
  { from: { equipmentId: 'CNC-101', param: 'spindle_speed' }, to: { equipmentId: 'CNC-101', param: 'vibration' }, gain: 0.0015, baseline: 1800, tau: 1 },
  { from: { equipmentId: 'CNC-102', param: 'spindle_speed' }, to: { equipmentId: 'CNC-102', param: 'vibration' }, gain: 0.0005, baseline: 6000, tau: 1 },

  // === D. 主轴转速 → 刀具磨损（慢） ===
  { from: { equipmentId: 'CNC-101', param: 'spindle_speed' }, to: { equipmentId: 'CNC-101', param: 'tool_wear' }, gain: 0.005, baseline: 1800, tau: 20 },
  { from: { equipmentId: 'CNC-102', param: 'spindle_speed' }, to: { equipmentId: 'CNC-102', param: 'tool_wear' }, gain: 0.002, baseline: 6000, tau: 20 },

  // === E. 刀具磨损 → 振动（正反馈但不发散，因为 wear 自身被限制） ===
  { from: { equipmentId: 'CNC-101', param: 'tool_wear' }, to: { equipmentId: 'CNC-101', param: 'vibration' }, gain: 0.04, baseline: 15, tau: 5 },
  { from: { equipmentId: 'CNC-102', param: 'tool_wear' }, to: { equipmentId: 'CNC-102', param: 'vibration' }, gain: 0.04, baseline: 20, tau: 5 },

  // === F. 刀具磨损 → 表面粗糙度（共享 INST-201） ===
  // 主导：取车床 CNC-101 的刀具磨损作为代表
  { from: { equipmentId: 'CNC-101', param: 'tool_wear' }, to: { equipmentId: 'INST-201', param: 'surface_ra' }, gain: 0.04, baseline: 15, tau: 10 },

  // === G. 振动 → 尺寸偏差（INST-201 共享） ===
  { from: { equipmentId: 'CNC-101', param: 'vibration' }, to: { equipmentId: 'INST-201', param: 'dimension_error' }, gain: 0.02, baseline: 1.5, tau: 8 },

  // === H. 冷却液流量 → 主轴温度（不足时温度上升） ===
  { from: { equipmentId: 'PMP-201', param: 'coolant_flow' }, to: { equipmentId: 'CNC-101', param: 'spindle_temp' }, gain: -1.5, baseline: 12, tau: 20 },
  { from: { equipmentId: 'PMP-201', param: 'coolant_flow' }, to: { equipmentId: 'CNC-102', param: 'spindle_temp' }, gain: -1.5, baseline: 12, tau: 20 },

  // === I. 冷却液流量 → 刀具磨损（冷却不足加快磨损） ===
  { from: { equipmentId: 'PMP-201', param: 'coolant_flow' }, to: { equipmentId: 'CNC-101', param: 'tool_wear' }, gain: -0.3, baseline: 12, tau: 15 },
  { from: { equipmentId: 'PMP-201', param: 'coolant_flow' }, to: { equipmentId: 'CNC-102', param: 'tool_wear' }, gain: -0.3, baseline: 12, tau: 15 },

  // === J. 进给速度 → 主轴负载 ===
  { from: { equipmentId: 'CNC-101', param: 'feed_rate' }, to: { equipmentId: 'CNC-101', param: 'spindle_load' }, gain: 150,  baseline: 0.15, tau: 1.5 },
  { from: { equipmentId: 'CNC-102', param: 'feed_rate' }, to: { equipmentId: 'CNC-102', param: 'spindle_load' }, gain: 0.03, baseline: 800,  tau: 1.5 },

  // === K. 夹紧力 → 同心度（反向） ===
  { from: { equipmentId: 'FIX-201', param: 'clamp_force' }, to: { equipmentId: 'FIX-201', param: 'concentricity' }, gain: -0.000005, baseline: 8000, tau: 3 },

  // === L. 同心度 → 尺寸偏差（直接传递） ===
  { from: { equipmentId: 'FIX-201', param: 'concentricity' }, to: { equipmentId: 'INST-201', param: 'dimension_error' }, gain: 1.0, baseline: 0.02, tau: 5 },

  // === M. 排屑速度 → 切屑负载（反向：速度低 → 堆积） ===
  { from: { equipmentId: 'CONV-201', param: 'conv_speed' }, to: { equipmentId: 'CONV-201', param: 'chip_load' }, gain: -50, baseline: 0.5, tau: 8 },
];
