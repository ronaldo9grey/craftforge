/**
 * 工艺物理动力学引擎
 *
 * 目标：把"调参立即生效"改造为"调参 → 目标值 → 实际值按一阶滞后逐步逼近"，
 * 并实现关键参数间的耦合传递（上游参数变化按 gain 系数影响下游 setpoint）。
 *
 * 算法（每个 tick=500ms 执行一次）：
 *   1. 遍历所有耦合规则，把 from 端最新 value 按 gain×(from.value-baseline) 计算"耦合修正项"，
 *      与下游参数原始 setpoint 相加得到"有效 setpoint"（多上游叠加）。
 *   2. 对每个参数应用一阶离散滞后：value_new = value_old + (effSetpoint - value_old) * dt/τ；
 *      其中 dt=0.5s，τ 取参数自身的 tau 或耦合规则的 tau，默认 5s。
 *   3. 调用 store.updateParameter(eqId, paramId, value_new, true) 静默写回，
 *      不污染演练操作历史与评分。
 */
import type { useEquipmentStore } from '@/stores/equipmentStore';
import type { useDrillStore } from '@/stores/drillStore';
import type { Parameter } from '@/types';

// 耦合规则：上游参数值变化按 gain 系数影响下游参数的 setpoint
export interface CouplingRule {
  from: { equipmentId: string; param: string };
  to: { equipmentId: string; param: string };
  gain: number;       // 增益：下游 setpoint 修正 = gain × (from.value - baseline)
  baseline?: number;  // 上游基线（不偏离时不产生耦合修正），缺省=上游当前 value
  tau?: number;       // 该耦合下的滞后时间常数（秒），优先级低于参数自身 tau
}

// store 类型别名（避免在引擎里把 store 的所有泛型展开）
type EquipmentStoreLike = typeof useEquipmentStore;
type DrillStoreLike = typeof useDrillStore;

// 默认参数：每 500ms 触发一次；默认 τ=5s
const DEFAULT_TICK_MS = 500;
const DEFAULT_TAU = 5;
// 当 |value - effSetpoint| 小于该比例阈值（相对参数自身量程）时，认为已经稳态，不再写回避免抖动
const STABLE_THRESHOLD_RATIO = 1e-6;

export class DynamicsEngine {
  private equipmentStore: EquipmentStoreLike;
  private drillStore: DrillStoreLike;
  private couplings: CouplingRule[];
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private tickMs: number;

  constructor(
    equipmentStore: EquipmentStoreLike,
    drillStore: DrillStoreLike,
    couplings: CouplingRule[],
    tickMs: number = DEFAULT_TICK_MS,
  ) {
    this.equipmentStore = equipmentStore;
    this.drillStore = drillStore;
    this.couplings = couplings;
    this.tickMs = tickMs;
  }

  /** 启动周期 tick（幂等：已运行则不重复创建） */
  start(): void {
    if (this.tickHandle !== null) return;
    this.tickHandle = setInterval(() => this.tick(), this.tickMs);
  }

  /** 停止周期 tick */
  stop(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  /** 是否在运行 */
  isRunning(): boolean {
    return this.tickHandle !== null;
  }

  /** 单次 tick：根据耦合规则计算有效 setpoint，并对每个参数推进一阶滞后 */
  private tick(): void {
    const dt = this.tickMs / 1000; // 秒
    const equipments = this.equipmentStore.getState().equipments;
    if (!equipments || equipments.length === 0) return;

    // 1) 先把当前参数快照拍下来（避免在循环内被中途写入污染）
    type ParamRef = {
      eqId: string;
      param: Parameter;
    };
    const paramIndex = new Map<string, ParamRef>();
    equipments.forEach((eq) => {
      eq.parameters.forEach((p) => {
        paramIndex.set(`${eq.id}::${p.id}`, { eqId: eq.id, param: p });
      });
    });

    // 2) 计算每个下游参数的"有效 setpoint"：原始 setpoint + Σ 上游耦合修正
    //    若某参数没有 setpoint，引擎默认 setpoint = value（保持兼容，自然不动）
    const effSetpoints = new Map<string, number>();
    paramIndex.forEach((ref, key) => {
      const baseSp = ref.param.setpoint ?? ref.param.value;
      effSetpoints.set(key, baseSp);
    });

    // 用于在没有自身 tau 时回退到耦合规则中的 tau（取所有命中规则中最小 tau，使响应更快）
    const couplingTau = new Map<string, number>();

    this.couplings.forEach((rule) => {
      const fromKey = `${rule.from.equipmentId}::${rule.from.param}`;
      const toKey = `${rule.to.equipmentId}::${rule.to.param}`;
      const fromRef = paramIndex.get(fromKey);
      const toRef = paramIndex.get(toKey);
      if (!fromRef || !toRef) return; // 规则指向不存在的参数则跳过

      const baseline = rule.baseline ?? fromRef.param.value;
      const correction = rule.gain * (fromRef.param.value - baseline);
      const prev = effSetpoints.get(toKey) ?? toRef.param.value;
      effSetpoints.set(toKey, prev + correction);

      if (rule.tau !== undefined) {
        const cur = couplingTau.get(toKey);
        couplingTau.set(toKey, cur === undefined ? rule.tau : Math.min(cur, rule.tau));
      }
    });

    // 3) 一阶离散滞后推进，并静默写回
    const updateParameter = this.equipmentStore.getState().updateParameter;
    paramIndex.forEach((ref, key) => {
      // 是否启用一阶滞后；默认启用
      const inertia = ref.param.inertia !== false;
      const sp = effSetpoints.get(key) ?? ref.param.value;
      const cur = ref.param.value;

      // 量程归一化阈值：如果两值已经几乎相等，则不写回，避免无意义抖动
      const span = Math.max(1e-9, ref.param.max - ref.param.min);
      if (Math.abs(sp - cur) / span < STABLE_THRESHOLD_RATIO) {
        return;
      }

      let next: number;
      if (!inertia) {
        // 显式关闭滞后：直接跳变到 setpoint
        next = sp;
      } else {
        const tau =
          ref.param.tau !== undefined
            ? ref.param.tau
            : couplingTau.get(key) !== undefined
              ? (couplingTau.get(key) as number)
              : DEFAULT_TAU;
        // 一阶 IIR：value_new = value_old + (sp - value_old) * dt/τ
        // 限制比例 ≤ 1，避免 dt > τ 时出现"过冲"
        const k = Math.min(1, dt / Math.max(1e-3, tau));
        next = cur + (sp - cur) * k;
      }

      // 钳制到物理量程
      if (next < ref.param.min) next = ref.param.min;
      if (next > ref.param.max) next = ref.param.max;

      // 数值精度：保留 4 位小数，避免 trend 数组里出现长尾
      next = Math.round(next * 10000) / 10000;

      // 静默写回：不进 operationHistory，不触发 drillStore 评分
      updateParameter(ref.eqId, ref.param.id, next, true);
    });

    // drillStore 仅作为引用持有，未来如需"动力学事件" hook 可在此扩展；当前不主动调用
    void this.drillStore;
  }
}
