import type { CouplingRule } from '@/engine/dynamics';

/**
 * 高炉炼铁 动力学耦合规则
 *
 * 物理逻辑：
 *  1. 焦比 ↑ → 炉腹温度 ↑（焦炭是主热源）
 *  2. 送风温度 ↑ → 炉腹温度 ↑（热风带入热量）
 *  3. 风量 ↑ → 炉腹温度 ↑（助燃）—— 但增益较小
 *  4. 炉腹温度 ↑ → 铁水温度 ↑（下部炉缸受炉腹传热）
 *  5. 炉腹温度 ↑ → 炉顶温度 ↑（热烟气上升）
 *  6. 铁水温度 ↑ → 铁水流量 ↑（铁水粘度下降）
 *  7. 铁水流量 ↑ → 鱼雷罐装载量 ↑
 *  8. 风量 ↑ → 鼓风压力 ↑（风机负载）
 *  9. 泄压阀开度 ↑ → 炉顶压力 ↓（释放压力）
 * 10. 装料量 ↑ → 料线 ↑（新料把料线抬高，读数变小）
 * 11. 铁水流量 ↑ → 炉顶压力 ↓（内部释放）
 * 12. 送风温度 ↑ → 铁水温度 ↑（长时间热积累）
 */
export const blastfurnaceCouplings: CouplingRule[] = [
  // 1. 焦比 → 炉腹温度（焦炭是主热源，滞后大：焦炭要下到风口才起效）
  {
    from: { equipmentId: 'CHARGE',  param: 'COKE-RATIO' },
    to:   { equipmentId: 'BF-BODY', param: 'T-body' },
    gain: 800,       // 焦比 +0.05 → 炉腹 +40°C
    baseline: 0.42,
    tau: 40,
  },
  // 2. 送风温度 → 炉腹温度（热风带入热量）
  {
    from: { equipmentId: 'STOVE',   param: 'T-blast' },
    to:   { equipmentId: 'BF-BODY', param: 'T-body' },
    gain: 0.35,      // 送风 +100°C → 炉腹 +35°C
    baseline: 1050,
    tau: 25,
  },
  // 3. 风量 → 炉腹温度（助燃，正贡献；但风太大也压料，此处只算助燃效应）
  {
    from: { equipmentId: 'BLOWER',  param: 'MAF' },
    to:   { equipmentId: 'BF-BODY', param: 'T-body' },
    gain: 0.02,      // 风量 +500 → 炉腹 +10°C
    baseline: 3200,
    tau: 15,
  },
  // 4. 炉腹温度 → 铁水温度（炉缸受炉腹传热，1:1 传导）
  {
    from: { equipmentId: 'BF-BODY',  param: 'T-body' },
    to:   { equipmentId: 'TAP-HOLE', param: 'T-tap' },
    gain: 0.9,       // 炉腹 +10°C → 铁水 +9°C
    baseline: 1480,
    tau: 30,
  },
  // 5. 炉腹温度 → 炉顶温度（热烟气上升）
  {
    from: { equipmentId: 'BF-BODY', param: 'T-body' },
    to:   { equipmentId: 'STACK',   param: 'T-top' },
    gain: 0.6,       // 炉腹 +50°C → 顶温 +30°C
    baseline: 1480,
    tau: 20,
  },
  // 6. 铁水温度 → 铁水流量（温度高铁水稀，流得快）
  {
    from: { equipmentId: 'TAP-HOLE', param: 'T-tap' },
    to:   { equipmentId: 'TAP-HOLE', param: 'tap-flow' },
    gain: 0.05,      // +10°C → +0.5 t/min
    baseline: 1490,
    tau: 5,
  },
  // 7. 铁水流量 → 鱼雷罐装载量（流量直接进罐）
  {
    from: { equipmentId: 'TAP-HOLE', param: 'tap-flow' },
    to:   { equipmentId: 'TORPEDO',  param: 'LOAD' },
    gain: 12,        // 5 t/min * 12 = +60 t（一段时间累积）
    baseline: 5.6,
    tau: 4,
  },
  // 8. 风量 → 鼓风压力（风机负载）
  {
    from: { equipmentId: 'BLOWER', param: 'MAF' },
    to:   { equipmentId: 'BLOWER', param: 'blower-pres' },
    gain: 0.08,      // 风量 +1000 → 压力 +80 kPa
    baseline: 3200,
    tau: 1.5,
  },
  // 9. 泄压阀开度 → 炉顶压力（反向：开度大压力降）
  {
    from: { equipmentId: 'STACK',   param: 'valve-pos' },
    to:   { equipmentId: 'BF-BODY', param: 'P-top' },
    gain: -1.8,      // 开度 +50% → 压力 -90 kPa
    baseline: 15,
    tau: 3,
  },
  // 10. 装料量 → 料线（新料抬高料面，读数变小）
  {
    from: { equipmentId: 'CHARGE',  param: 'charge-load' },
    to:   { equipmentId: 'PROBE-1', param: 'STOCK-LINE' },
    gain: -0.03,     // 装料 +10t → 料线读数 -0.3m（面抬高）
    baseline: 42,
    tau: 8,
  },
  // 11. 风量 → 炉顶压力（吹得越猛顶压越高）
  {
    from: { equipmentId: 'BLOWER',  param: 'MAF' },
    to:   { equipmentId: 'BF-BODY', param: 'P-top' },
    gain: 0.04,      // 风量 +1000 → 顶压 +40 kPa
    baseline: 3200,
    tau: 2,
  },
  // 12. 送风温度 → 铁水温度（长期热积累，最慢的一条）
  {
    from: { equipmentId: 'STOVE',    param: 'T-blast' },
    to:   { equipmentId: 'TAP-HOLE', param: 'T-tap' },
    gain: 0.15,      // 送风 +100°C → 铁水 +15°C
    baseline: 1050,
    tau: 45,
  },
];
