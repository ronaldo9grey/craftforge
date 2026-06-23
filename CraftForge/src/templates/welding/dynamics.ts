// 焊装场景动力学耦合规则
// 建模焊装工艺的物理 / 电气因果链
//
// === 链路设计 ===
//
// A. 焊接电流 → 电压（焦耳定律）
//    电流升高 → 电弧电压略升（恒功率源特性）
//    gain ≈ 0.05 V/A  ·  baseline = 180A
//    每台机器人独立
//
// B. 焊接电流 → 电极温度（I²R 热功率累积）
//    电流升高 → 电极发热加快
//    gain ≈ 1.5 °C/A  ·  baseline = 180A  ·  τ=15s（热惯性）
//    每台机器人独立
//
// C. 电极温度 → 焊枪冷却水需求间接体现（暂只做主链）
//
// D. 焊接电流 → 熔深（共享 INST-101）
//    电流升高 → 熔深加深；下排机器人 ROB-103 作为主焊主导熔深
//    gain ≈ 0.015 mm/A  baseline=180A
//
// E. 保护气流量 → 焊缝质量
//    气流不足 → 质量下降；气流偏高也降（鼓泡）→ 取双向
//    gain ≈ +2 %/L/min  ·  baseline=15
//
// F. 保护气流量 → 缺陷数（反向）
//    气流偏离正常 → 缺陷增加
//    通过 weld_quality 反向不再单独建模，避免过耦合
//
// G. 输送速度 → 节拍（反比）
//    速度高 → 节拍小；speed=1.2 对应 feed_rate=60
//    gain ≈ -25 s·min/m  ·  baseline=1.2
//
// H. 输入输送速度 → 输出输送速度（同步）
//    gain=1.0  baseline=1.2  τ=2s
//
// I. 夹紧力 → 定位误差（反向）
//    夹紧力低 → 定位误差大
//    gain ≈ -0.00005 mm/N  baseline=5000
//
// J. 主电压 → 系统负载（弱）
//    主电压不稳 → 系统负载小波动；这条不强建模
//
// 时间常数尺度（焊装比 FCC 快 5-10 倍）：电流 0.5s / 电压 0.8s / 温度 15s / 速度 2s

import type { CouplingRule } from '@/engine/dynamics';

export const weldingCouplings: CouplingRule[] = [
  // === A. 电流 → 电压（每台机器人） ===
  { from: { equipmentId: 'ROB-101', param: 'weld_current' }, to: { equipmentId: 'ROB-101', param: 'weld_voltage' }, gain:  0.05, baseline: 180, tau: 0.8 },
  { from: { equipmentId: 'ROB-102', param: 'weld_current' }, to: { equipmentId: 'ROB-102', param: 'weld_voltage' }, gain:  0.05, baseline: 175, tau: 0.8 },
  { from: { equipmentId: 'ROB-103', param: 'weld_current' }, to: { equipmentId: 'ROB-103', param: 'weld_voltage' }, gain:  0.05, baseline: 185, tau: 0.8 },

  // === B. 电流 → 电极温度（每台机器人，热惯性大） ===
  { from: { equipmentId: 'ROB-101', param: 'weld_current' }, to: { equipmentId: 'ROB-101', param: 'tip_temp' }, gain: 1.5, baseline: 180, tau: 15 },
  { from: { equipmentId: 'ROB-102', param: 'weld_current' }, to: { equipmentId: 'ROB-102', param: 'tip_temp' }, gain: 1.5, baseline: 175, tau: 15 },
  { from: { equipmentId: 'ROB-103', param: 'weld_current' }, to: { equipmentId: 'ROB-103', param: 'tip_temp' }, gain: 1.5, baseline: 185, tau: 15 },

  // === D. 主焊机器人 ROB-103 电流 → 熔深 ===
  { from: { equipmentId: 'ROB-103', param: 'weld_current' }, to: { equipmentId: 'INST-101', param: 'penetration' }, gain: 0.015, baseline: 185, tau: 5 },

  // === E. 保护气流量 → 焊缝质量 ===
  { from: { equipmentId: 'WG-101', param: 'gas_flow' }, to: { equipmentId: 'INST-101', param: 'weld_quality' }, gain: 2.0, baseline: 15, tau: 4 },

  // === G. 输入输送速度 → 上件节拍（反比） ===
  { from: { equipmentId: 'CONV-101', param: 'conveyor_speed' }, to: { equipmentId: 'ST-101', param: 'feed_rate' }, gain: -25, baseline: 1.2, tau: 3 },

  // === H. 输入输送速度 → 输出输送速度（同步） ===
  { from: { equipmentId: 'CONV-101', param: 'conveyor_speed' }, to: { equipmentId: 'CONV-102', param: 'conveyor_speed' }, gain: 1.0, baseline: 1.2, tau: 2 },

  // === I. 夹紧力 → 定位误差（反向） ===
  { from: { equipmentId: 'FIX-101', param: 'clamp_force' }, to: { equipmentId: 'FIX-101', param: 'position_error' }, gain: -0.00005, baseline: 5000, tau: 3 },

  // === K. 冷却水不足 → 电极温度升（每台机器人共享 WG-101.cooling_water） ===
  // 冷却水低于 baseline 时，温度被推高
  { from: { equipmentId: 'WG-101', param: 'cooling_water' }, to: { equipmentId: 'ROB-101', param: 'tip_temp' }, gain: -15, baseline: 4.5, tau: 10 },
  { from: { equipmentId: 'WG-101', param: 'cooling_water' }, to: { equipmentId: 'ROB-102', param: 'tip_temp' }, gain: -15, baseline: 4.5, tau: 10 },
  { from: { equipmentId: 'WG-101', param: 'cooling_water' }, to: { equipmentId: 'ROB-103', param: 'tip_temp' }, gain: -15, baseline: 4.5, tau: 10 },

  // === L. 送丝速度 → 缺陷计数（双向：偏离都会有焊瘤/虚焊） ===
  // 简化：送丝速度超过 baseline 显著时，缺陷↑
  { from: { equipmentId: 'WG-101', param: 'wire_feed_rate' }, to: { equipmentId: 'INST-101', param: 'defect_count' }, gain: 0.8, baseline: 6.0, tau: 4 },
];
