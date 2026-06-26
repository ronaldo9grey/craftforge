import type { CouplingRule } from '@/engine/dynamics';

export const offshoreCouplings: CouplingRule[] = [
  // 1. 钻压↑ → 扭矩↑
  { from: { equipmentId: 'RIG-DCR-101', param: 'wob' }, to: { equipmentId: 'RIG-RST-101', param: 'torque' }, gain: 0.08, baseline: 150, tau: 3 },
  // 2. 转速↑ → 扭矩↓（转速高时切削效率高，阻力反而小）
  { from: { equipmentId: 'RIG-RST-101', param: 'rpm' }, to: { equipmentId: 'RIG-RST-101', param: 'torque' }, gain: -0.03, baseline: 120, tau: 2 },
  // 3. 转速↑ → 轴承温度↑
  { from: { equipmentId: 'RIG-RST-101', param: 'rpm' }, to: { equipmentId: 'RIG-RST-101', param: 'temp' }, gain: 0.3, baseline: 120, tau: 15 },
  // 4. 泥浆泵流量↑ → 泵压↑
  { from: { equipmentId: 'RIG-MP-101', param: 'flow_rate' }, to: { equipmentId: 'RIG-MP-101', param: 'pressure' }, gain: 0.008, baseline: 2200, tau: 2 },
  // 5. 泥浆泵流量↑ → 泥浆返出↑
  { from: { equipmentId: 'RIG-MP-101', param: 'flow_rate' }, to: { equipmentId: 'RIG-RIS-101', param: 'mud_return' }, gain: 0.95, baseline: 2200, tau: 5 },
  // 6. 泥浆泵流量↑ → 振动筛处理量↑
  { from: { equipmentId: 'RIG-MP-101', param: 'flow_rate' }, to: { equipmentId: 'RIG-SH-101', param: 'throughput' }, gain: 0.93, baseline: 2200, tau: 5 },
  // 7. 节流阀开度↑ → 环空压力↓
  { from: { equipmentId: 'RIG-CK-101', param: 'valve_pos' }, to: { equipmentId: 'RIG-BOP-101', param: 'annular_pressure' }, gain: -0.15, baseline: 35, tau: 2 },
  // 8. 环空压力↑ → 井架载荷↑（井筒内压力增大）
  { from: { equipmentId: 'RIG-BOP-101', param: 'annular_pressure' }, to: { equipmentId: 'RIG-DER-101', param: 'derrick_load' }, gain: 50, baseline: 8, tau: 3 },
  // 9. 钻压↑ → 大钩载荷↑
  { from: { equipmentId: 'RIG-DCR-101', param: 'wob' }, to: { equipmentId: 'RIG-DCR-101', param: 'hoist_load' }, gain: 3, baseline: 150, tau: 2 },
  // 10. 风速↑ → 井架振动↑
  { from: { equipmentId: 'RIG-DER-101', param: 'wind_speed' }, to: { equipmentId: 'RIG-DER-101', param: 'vibration' }, gain: 0.15, baseline: 12, tau: 5 },
  // 11. 扭矩↑ → 振动↑
  { from: { equipmentId: 'RIG-RST-101', param: 'torque' }, to: { equipmentId: 'RIG-DER-101', param: 'vibration' }, gain: 0.08, baseline: 15, tau: 3 },
  // 12. 功率↑ → 电压稳定性（轻微影响）
  { from: { equipmentId: 'RIG-PWR-101', param: 'power' }, to: { equipmentId: 'RIG-PWR-101', param: 'voltage' }, gain: 0.01, baseline: 3200, tau: 5 },
];
