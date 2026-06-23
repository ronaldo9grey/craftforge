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

  // ============================================================
  // v3 新增：4 台新设备 (ROB-201 / CONV-201 / CONV-202 / MTC-301) 接入耦合
  // ============================================================

  // ===== Q. 模温机设定温度 → 实际温度（一阶跟随） =====
  // 设定 60→90 → 实际 +0.95×30 = +28.5 → 58→86.5
  { from: { equipmentId: 'MTC-301', param: 'mtc_set_temp' }, to: { equipmentId: 'MTC-301', param: 'mtc_actual_temp' }, gain: 0.95, baseline: 60, tau: 25 },

  // ===== R. 模温机实际温度 → 模具温度（核心耦合，覆盖冷水机影响） =====
  // 模温机实际 58→30 (失效) → 模温修正 +0.7×(30-58) = -19.6°C → 55→35.4 (低于 normalMin 45)
  // 模温机实际 58→85 → 模温 +18.9 → 73.9 (接近 normalMax 75)
  { from: { equipmentId: 'MTC-301', param: 'mtc_actual_temp' }, to: { equipmentId: 'MOLD-201', param: 'mold_temp' }, gain: 0.7, baseline: 58, tau: 20 },

  // ===== S. 模温机循环流量 → 模具温度（流量低则散热差，模温升） =====
  // 流量 12→5 → 模温 +(-0.8)×(-7) = +5.6°C （次要影响）
  { from: { equipmentId: 'MTC-301', param: 'mtc_flow' }, to: { equipmentId: 'MOLD-201', param: 'mold_temp' }, gain: -0.8, baseline: 12, tau: 15 },

  // ===== T. 取件机械手真空度 → 取件成功率（真空变弱 → 成功率掉） =====
  // vacuum_pressure 是负值，-85→-40 (变弱) → 成功率 +1.5×(-40-(-85))×(-1) 等价 -1.5×|Δ|
  // 用 gain= -0.5 表示真空升（趋近0）→ 成功率掉
  // -85→-40 (Δ=+45) → 成功率 +(-0.5)×45 = -22.5 → 99→76.5 (超出 normalMin 97)
  { from: { equipmentId: 'ROB-201', param: 'vacuum_pressure' }, to: { equipmentId: 'ROB-201', param: 'pick_success' }, gain: -0.5, baseline: -85, tau: 4 },

  // ===== U. 取件成功率 → 合格率（取件失败也算不合格） =====
  // 成功率 99→85 → 合格率 +0.4×(85-99) = -5.6 → 97→91.4 (低于 normalMin 95)
  { from: { equipmentId: 'ROB-201', param: 'pick_success' }, to: { equipmentId: 'ST-202', param: 'pass_rate' }, gain: 0.4, baseline: 99, tau: 6 },

  // ===== V. 机械手速度 → 周期时间（机械手快 → 周期短） =====
  // arm_speed 1.5→0.5 (变慢) → 周期 +(-2)×(0.5-1.5) = +2s → 28→30
  { from: { equipmentId: 'ROB-201', param: 'arm_speed' }, to: { equipmentId: 'IMM-101', param: 'cycle_time' }, gain: -2, baseline: 1.5, tau: 5 },
  { from: { equipmentId: 'ROB-201', param: 'arm_speed' }, to: { equipmentId: 'IMM-102', param: 'cycle_time' }, gain: -2, baseline: 1.5, tau: 5 },

  // ===== W. 上料带速度 → 上料速率（带速决定供料） =====
  // 速度 0.8→0.2 → 上料速率 +(15)×(0.2-0.8) = -9 → 12→3 kg/h (低于 normalMin 8)
  { from: { equipmentId: 'CONV-201', param: 'conveyor_speed' }, to: { equipmentId: 'CONV-201', param: 'feed_rate' }, gain: 15, baseline: 0.8, tau: 4 },

  // ===== X. 上料速率 → 料位（速率低于消耗速率 → 料位降） =====
  // 速率 12→3 → 料位修正 +(2)×(3-12)/10 = -1.8/秒  ... 注意 baseline 是 12 kg/h 当作"正常补给"
  // gain 设较小避免快速触底，让其在长时间演练中体现
  { from: { equipmentId: 'CONV-201', param: 'feed_rate' }, to: { equipmentId: 'HOP-201', param: 'hopper_level' }, gain: 2, baseline: 12, tau: 30 },

  // ===== Y. 成品带速度 → 在途数（带速快 → 在途少） =====
  // 速度 0.6→0.1 (堵停) → 在途数 +(-40)×(0.1-0.6) = +20 → 5→25 (接近 normalMax 30)
  { from: { equipmentId: 'CONV-202', param: 'conveyor_speed' }, to: { equipmentId: 'CONV-202', param: 'product_count' }, gain: -40, baseline: 0.6, tau: 5 },

  // ===== Z. 保压压力 → 重量偏差（保压不足 → 重量负偏） =====
  // 保压 60→30 (不足) → 重量 +(0.02)×(30-60) = -0.6g → 0.05→-0.55 (低于 normalMin -0.3)
  { from: { equipmentId: 'IMM-101', param: 'hold_pressure' }, to: { equipmentId: 'INST-201', param: 'weight_dev' }, gain: 0.02, baseline: 60, tau: 4 },
  { from: { equipmentId: 'IMM-102', param: 'hold_pressure' }, to: { equipmentId: 'INST-201', param: 'weight_dev' }, gain: 0.02, baseline: 65, tau: 4 },

  // ===== AA. 冷却时间 → 周期时间（冷却时间是周期的子项） =====
  // 冷却时间 12→20 → 周期 +(0.9)×(20-12) = +7.2s → 28→35.2
  { from: { equipmentId: 'IMM-101', param: 'cool_time' }, to: { equipmentId: 'IMM-101', param: 'cycle_time' }, gain: 0.9, baseline: 12, tau: 2 },
  { from: { equipmentId: 'IMM-102', param: 'cool_time' }, to: { equipmentId: 'IMM-102', param: 'cycle_time' }, gain: 0.9, baseline: 11, tau: 2 },

  // ===== BB. 螺杆背压 → 螺杆转速（背压高 → 螺杆吃力，转速波动） =====
  // 简化为：背压 8→18 → 螺杆转速 +(2.5)×(18-8) = +25 rpm
  { from: { equipmentId: 'IMM-101', param: 'back_pressure' }, to: { equipmentId: 'IMM-101', param: 'screw_speed' }, gain: 2.5, baseline: 8, tau: 3 },
  { from: { equipmentId: 'IMM-102', param: 'back_pressure' }, to: { equipmentId: 'IMM-102', param: 'screw_speed' }, gain: 2.5, baseline: 9, tau: 3 },

  // ===== CC. 加热筒喂料段 → 压缩段（顺序传热） =====
  { from: { equipmentId: 'HEAT-301', param: 'zone1_temp' }, to: { equipmentId: 'HEAT-301', param: 'zone2_temp' }, gain: 0.7, baseline: 200, tau: 15 },
  // ===== DD. 加热筒压缩段 → 计量段（顺序传热） =====
  { from: { equipmentId: 'HEAT-301', param: 'zone2_temp' }, to: { equipmentId: 'HEAT-301', param: 'zone3_temp' }, gain: 0.7, baseline: 225, tau: 15 },
];
