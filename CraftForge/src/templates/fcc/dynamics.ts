/**
 * FCC（催化裂化）装置参数耦合规则
 *
 * 每条规则刻画一组"上游参数 → 下游 setpoint 修正"的关系：
 *   下游 setpoint 修正 = gain × (from.value - baseline)
 *
 * 多上游耦合到同一下游时按"叠加"汇总。
 *
 * tau 为该耦合下的滞后时间常数（秒），表示信号从上游传到下游再被反映出来的工艺响应时间。
 * 若下游参数自身在 config 中已配置 tau，会优先使用参数自身 tau；耦合规则的 tau 作为兜底。
 */
import type { CouplingRule } from '@/engine/dynamics';

export const fccCouplings: CouplingRule[] = [
  // 1) 主风量上升 → 再生器供氧增加 → 烧焦放热增加 → 再生温度上升
  {
    from: { equipmentId: 'K-101', param: 'air_flow' },
    to: { equipmentId: 'REG-101', param: 'regenerator_temp' },
    gain: 0.3,
    baseline: 1650,
    tau: 30,
  },
  // 2) 主风量上升 → 再生器气量增加 → 再生压力上升
  {
    from: { equipmentId: 'K-101', param: 'air_flow' },
    to: { equipmentId: 'REG-101', param: 'regenerator_pressure' },
    gain: 0.0001,
    baseline: 1650,
    tau: 10,
  },
  // 3) 再生温度升高 → 再生催化剂热量带入提升管 → 反应温度升高
  {
    from: { equipmentId: 'REG-101', param: 'regenerator_temp' },
    to: { equipmentId: 'R-101', param: 'reactor_temp' },
    gain: 0.8,
    baseline: 690,
    tau: 20,
  },
  // 4) 反应温度升高 → 进塔气相轻组分增加 → 塔顶温度上升
  {
    from: { equipmentId: 'R-101', param: 'reactor_temp' },
    to: { equipmentId: 'T-101', param: 'tower_top_temp' },
    gain: 0.6,
    baseline: 500,
    tau: 25,
  },
  // 5) 反应温度升高 → 进塔气相负荷增加 → 塔顶压力上升
  {
    from: { equipmentId: 'R-101', param: 'reactor_temp' },
    to: { equipmentId: 'T-101', param: 'tower_top_pressure' },
    gain: 0.001,
    baseline: 500,
    tau: 25,
  },
];
