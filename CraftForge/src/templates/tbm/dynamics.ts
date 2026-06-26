import type { CouplingRule } from '@/engine/dynamics';

/**
 * TBM 盾构机动力学耦合规则
 *
 * 物理逻辑：
 *  1. 刀盘转速↑ → 螺旋转速↑（更多渣土需要排出）
 *  2. 刀盘转速↑ → 刀盘扭矩↑（切削阻力增大）
 *  3. 推进速度↑ → 刀具磨损↑（摩擦加剧）
 *  4. 推进速度↑ → 仓压↑（前方土体挤压）
 *  5. 螺旋转速↑ → 仓压↓（渣土排出减压）
 *  6. 推进速度↑ → 地表沉降↑（地层扰动）
 *  7. 注浆量↑ → 地表沉降↓（空隙填充）
 *  8. 刀盘扭矩 → 主驱动输出扭矩（联动）
 *  9. 刀盘转速↑ → 主驱动振动↑（机械振动）
 * 10. 推进速度↑ → 总推力↑（阻力增大）
 * 11. 仓压↑ → 盾尾密封压力↑（压力传递）
 * 12. 刀盘转速↑ → 刀具温度↑（摩擦发热）
 */
export const tbmCouplings: CouplingRule[] = [
  // 1. 刀盘转速 → 螺旋转速
  {
    from: { equipmentId: 'TBM-CHE-101', param: 'rpm' },
    to: { equipmentId: 'TBM-SCR-101', param: 'screw_rpm' },
    gain: 4.5,
    baseline: 1.2,
    tau: 2,
  },
  // 2. 刀盘转速 → 刀盘扭矩
  {
    from: { equipmentId: 'TBM-CHE-101', param: 'rpm' },
    to: { equipmentId: 'TBM-CHE-101', param: 'torque' },
    gain: 1500,
    baseline: 1.2,
    tau: 3,
  },
  // 3. 推进速度 → 刀具磨损
  {
    from: { equipmentId: 'TBM-SHL-101', param: 'speed' },
    to: { equipmentId: 'TBM-CHE-101', param: 'wear' },
    gain: 0.4,
    baseline: 20,
    tau: 60,
  },
  // 4. 推进速度 → 仓压
  {
    from: { equipmentId: 'TBM-SHL-101', param: 'speed' },
    to: { equipmentId: 'TBM-CHB-101', param: 'pressure' },
    gain: 0.03,
    baseline: 20,
    tau: 3,
  },
  // 5. 螺旋转速 → 仓压（反向：排渣减压）
  {
    from: { equipmentId: 'TBM-SCR-101', param: 'screw_rpm' },
    to: { equipmentId: 'TBM-CHB-101', param: 'pressure' },
    gain: -0.06,
    baseline: 8,
    tau: 3,
  },
  // 6. 推进速度 → 地表沉降
  {
    from: { equipmentId: 'TBM-SHL-101', param: 'speed' },
    to: { equipmentId: 'TBM-MON-101', param: 'settlement_max' },
    gain: 0.12,
    baseline: 20,
    tau: 10,
  },
  // 7. 注浆量 → 地表沉降（反向：注浆填充减少沉降）
  {
    from: { equipmentId: 'TBM-INJ-101', param: 'inject_volume' },
    to: { equipmentId: 'TBM-MON-101', param: 'settlement_max' },
    gain: -0.06,
    baseline: 105,
    tau: 10,
  },
  // 8. 刀盘扭矩 → 主驱动输出扭矩
  {
    from: { equipmentId: 'TBM-CHE-101', param: 'torque' },
    to: { equipmentId: 'TBM-DRV-101', param: 'output_torque' },
    gain: 1,
    baseline: 3200,
    tau: 3,
  },
  // 9. 刀盘转速 → 主驱动振动
  {
    from: { equipmentId: 'TBM-CHE-101', param: 'rpm' },
    to: { equipmentId: 'TBM-DRV-101', param: 'vibration' },
    gain: 1.0,
    baseline: 1.2,
    tau: 2,
  },
  // 10. 推进速度 → 总推力
  {
    from: { equipmentId: 'TBM-SHL-101', param: 'speed' },
    to: { equipmentId: 'TBM-SHL-101', param: 'thrust' },
    gain: 400,
    baseline: 20,
    tau: 2,
  },
  // 11. 仓压 → 盾尾密封压力
  {
    from: { equipmentId: 'TBM-CHB-101', param: 'pressure' },
    to: { equipmentId: 'TBM-SEAL-101', param: 'seal_pressure' },
    gain: 0.15,
    baseline: 2.2,
    tau: 2,
  },
  // 12. 刀盘转速 → 刀具温度
  {
    from: { equipmentId: 'TBM-CHE-101', param: 'rpm' },
    to: { equipmentId: 'TBM-CHE-101', param: 'temp' },
    gain: 30,
    baseline: 1.2,
    tau: 15,
  },
];
