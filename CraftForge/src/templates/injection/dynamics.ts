// 注塑成型动力学耦合规则 v2（精调版）
//
// 调优原则：
//   - 在每个故障的"症状值"下，耦合修正幅度应使下游参数恰好滑出 normalMin/normalMax，但不至于撞 max
//   - 时间常数 (tau) 体现真实物理：电气 < 1s / 机械 1-3s / 流体 2-5s / 加热 15-25s / 模具 25-30s
//   - 避免"双向放大"的不稳定环（避免 A→B→A 同向耦合）
//
// 链路一览：
//
// 主链 - 螺杆转速：
//   A. 螺杆转速 ↑ → 注射压力 ↑（剪切热+背压）
//   B. 注射压力 ↑ → 注射速度 ↓（被压力上限钳制）
//
// 主链 - 加热筒：
//   C. 计量段温度 → 喷嘴温度（顺序传热 15s）
//   D. 计量段温度 → 注射压力（黏度变化）
//   E. 干燥温度 → 物料温度（接料后传递）
//
// 主链 - 模具冷却：
//   F. 冷却水流量 → 模具温度（反向）
//   G. 模具温度 → 周期时间（冷却时间）
//   H. 模具温度 → 尺寸偏差（热膨胀）
//   I. 模具温度 → 顶出力（粘模时顶出阻力↑）
//   J. 模具温度 → 出水温度（带走热量）
//
// 主链 - 含水与缺陷：
//   K. 干燥温度 → 含水率（反向）
//   L. 含水率 → 外观缺陷数（银纹/气泡）
//   M. 锁模力 → 外观缺陷数（反向，飞边）
//   N. 缺陷数 → 合格率（反向）
//
// 主链 - 注射力学：
//   O. 注射压力 → 重量偏差（压力过高过满；过低欠注）
//   P. 注射压力 → 锁模力反作用（轻微，型腔反推）

import type { CouplingRule } from '@/engine/dynamics';

export const injectionCouplings: CouplingRule[] = [
  // ===== A. 螺杆转速 → 注射压力（每台机各自独立） =====
  // 螺杆 80→135 rpm 时，压力 +(135-80)×0.35 = +19 MPa → 从 85 涨到 104 (仍在 70-110 内但接近上限)
  { from: { equipmentId: 'IMM-101', param: 'screw_speed' }, to: { equipmentId: 'IMM-101', param: 'inject_pressure' }, gain: 0.35, baseline: 80, tau: 2 },
  { from: { equipmentId: 'IMM-102', param: 'screw_speed' }, to: { equipmentId: 'IMM-102', param: 'inject_pressure' }, gain: 0.35, baseline: 85, tau: 2 },

  // ===== B. 注射压力 → 注射速度（高压下流速被钳制） =====
  // 压力 85→105 → 速度 -0.2×20 = -4 mm/s
  { from: { equipmentId: 'IMM-101', param: 'inject_pressure' }, to: { equipmentId: 'IMM-101', param: 'inject_speed' }, gain: -0.20, baseline: 85, tau: 1 },
  { from: { equipmentId: 'IMM-102', param: 'inject_pressure' }, to: { equipmentId: 'IMM-102', param: 'inject_speed' }, gain: -0.20, baseline: 92, tau: 1 },

  // ===== C. 加热筒计量段 → 喷嘴温度 =====
  // 计量段 240→275 → 喷嘴温度 +(275-240)×0.9 = +31.5°C → 从 245 升到 276.5°C
  { from: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, to: { equipmentId: 'HEAT-301', param: 'nozzle_temp' }, gain: 0.9, baseline: 240, tau: 15 },

  // ===== D. 加热筒计量段 → 注射压力（料温高黏度变） =====
  // 计量段 240→275 → 压力 +5 MPa
  { from: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, to: { equipmentId: 'IMM-101', param: 'inject_pressure' }, gain: 0.15, baseline: 240, tau: 8 },
  { from: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, to: { equipmentId: 'IMM-102', param: 'inject_pressure' }, gain: 0.15, baseline: 240, tau: 8 },

  // ===== E. 干燥温度 → 物料温度（接料传递） =====
  // 干燥 85→60 → 物料温度 -10°C → 55 降至 45
  { from: { equipmentId: 'DRY-201', param: 'dry_temp' }, to: { equipmentId: 'HOP-201', param: 'mat_temp' }, gain: 0.40, baseline: 85, tau: 20 },

  // ===== F. 冷却水流量 → 模具温度（反向，关键耦合） =====
  // 流量 18→9 → 模温 +(-2.2)×(-9) = +20°C → 55 升到 75 (恰好接近 normalMax)
  // 流量 18→6 → 模温 +26°C → 75 (接近) ✓
  { from: { equipmentId: 'CHILL-301', param: 'chiller_flow' }, to: { equipmentId: 'MOLD-201', param: 'mold_temp' }, gain: -2.2, baseline: 18, tau: 25 },

  // ===== G. 模具温度 → 周期时间（冷却不下来需要等） =====
  // 模温 55→88 → 周期 +0.2×33 = +6.6s → 28 升到 34.6s
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'IMM-101', param: 'cycle_time' }, gain: 0.20, baseline: 55, tau: 10 },
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'IMM-102', param: 'cycle_time' }, gain: 0.20, baseline: 55, tau: 10 },

  // ===== H. 模具温度 → 尺寸偏差（热膨胀） =====
  // 模温 55→88 → 尺寸偏差 +0.003×33 = +0.099 mm → 0.02→0.119 (超出 normalMax 0.05) ✓
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'INST-201', param: 'dim_dev' }, gain: 0.003, baseline: 55, tau: 8 },

  // ===== I. 模具温度 → 顶出力（粘模时顶出阻力↑，新增） =====
  // 模温 55→88 → 顶出力 +0.8×33 = +26 kN → 180→206 (超出 normalMax 220 接近) ✓
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'MOLD-201', param: 'eject_force' }, gain: 0.8, baseline: 55, tau: 6 },

  // ===== J. 模具温度 → 出水温度（带走热量） =====
  // 模温 55→88 → 出水温度 +0.25×33 = +8.25°C → 22→30 (超出 normalMax 28) ✓
  { from: { equipmentId: 'MOLD-201', param: 'mold_temp' }, to: { equipmentId: 'CHILL-301', param: 'water_out_temp' }, gain: 0.25, baseline: 55, tau: 10 },

  // ===== K. 干燥温度 → 含水率（反向） =====
  // 干燥 85→60 → 含水率 +(-10)×(-25) = +250 ppm → 280→530 (超出 normalMax 400) ✓
  { from: { equipmentId: 'DRY-201', param: 'dry_temp' }, to: { equipmentId: 'DRY-201', param: 'moisture_ppm' }, gain: -10, baseline: 85, tau: 15 },

  // ===== L. 含水率 → 外观缺陷数（银纹/气泡） =====
  // 含水 280→720 → 缺陷 +0.015×440 = +6.6 → 1→7.6 (超出 normalMax 3) ✓
  { from: { equipmentId: 'DRY-201', param: 'moisture_ppm' }, to: { equipmentId: 'INST-201', param: 'defect_count' }, gain: 0.015, baseline: 280, tau: 5 },

  // ===== M. 锁模力 → 外观缺陷数（反向，飞边） =====
  // 锁模 1200→900 → 缺陷 +(-0.012)×(-300) = +3.6 → 1→4.6 (超出 normalMax 3) ✓
  { from: { equipmentId: 'IMM-101', param: 'clamp_force' }, to: { equipmentId: 'INST-201', param: 'defect_count' }, gain: -0.012, baseline: 1200, tau: 4 },
  { from: { equipmentId: 'IMM-102', param: 'clamp_force' }, to: { equipmentId: 'INST-201', param: 'defect_count' }, gain: -0.012, baseline: 1250, tau: 4 },

  // ===== N. 缺陷数 → 合格率（反向） =====
  // 缺陷 1→8 → 合格率 +(-1.5)×7 = -10.5% → 97→86.5 (超出 normalMin 95) ✓
  { from: { equipmentId: 'INST-201', param: 'defect_count' }, to: { equipmentId: 'ST-202', param: 'pass_rate' }, gain: -1.5, baseline: 1, tau: 5 },

  // ===== O. 注射压力 → 重量偏差（新增：压力直接影响充模量） =====
  // 压力 85→55 (短射故障) → 重量偏差 +(-0.025)×(-30) = +0.75g（应为负值！修正方向）
  // 实际短射时重量偏低（缺料）。所以 gain 应为正（压力高 → 多注 → 重量增）
  { from: { equipmentId: 'IMM-101', param: 'inject_pressure' }, to: { equipmentId: 'INST-201', param: 'weight_dev' }, gain: 0.025, baseline: 85, tau: 4 },
  { from: { equipmentId: 'IMM-102', param: 'inject_pressure' }, to: { equipmentId: 'INST-201', param: 'weight_dev' }, gain: 0.025, baseline: 92, tau: 4 },

  // ===== P. 螺杆转速 → 重量偏差（计量不稳） =====
  // 螺杆 80→135 → 重量偏差 +0.012×55 = +0.66g （IF007 故障，重量飘忽）
  { from: { equipmentId: 'IMM-101', param: 'screw_speed' }, to: { equipmentId: 'INST-201', param: 'weight_dev' }, gain: 0.012, baseline: 80, tau: 3 },
];
