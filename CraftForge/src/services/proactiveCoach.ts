// AI 师傅主动提醒引擎
//   - 每 2 秒扫描一次所有规则
//   - 命中后调 aiStore.sendMessage('...', 'ai') 推送一条话术
//   - 单条规则在 cooldownSec 内不重复触发
//
// ★ 触发条件（防"开演就刷屏"）：
//   1. 学员必须**先动过参数**（30 秒内有操作）才进入扫描
//   2. 演练刚开始时有 20 秒"安静观察期"避免与故障开局诊断撞车
//   3. 每个 tick 最多弹 1 条（优先级 danger > warning > info）— 防一股脑全弹
//
// 规则定义：
//   - id: 规则唯一标识（同 id 共享 cooldown）
//   - severity: 'info' / 'warning' / 'danger'
//   - check: 接收 { 设备前缀: { 参数 id: 值 } } 的扁平 map，返回 true 表示需要提醒
//   - message: 模板字符串，{XX.param} 占位符会自动替换为当前值（保留 1 位小数）
//   - cooldownSec: 同规则触发间隔（秒）

import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { useDrillStore } from '@/stores/drillStore';

export interface ProactiveRule {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  cooldownSec: number;
  check: (eq: Record<string, Record<string, number>>) => boolean;
  message: string;
}

// 学员"最近一次操作"全局时间戳（毫秒）— 由 drillStore.recordParameterAdjustment 在每次调参时更新
let lastUserActionAt = 0;
export function notifyUserActed() {
  lastUserActionAt = Date.now();
}

class ProactiveCoachEngine {
  private timer: any = null;
  private rules: ProactiveRule[] = [];
  // 每条规则上次触发时间戳（毫秒）
  private lastFired = new Map<string, number>();
  // 引擎启动时间戳
  private engineStartTime = 0;
  // 上一次演练状态（用于检测"从未运行 → 运行"切换，重置静默期）
  private lastDrillRunning = false;
  // 演练开始时间戳（用于演练开局静默期）
  private drillStartTime = 0;
  // 启动初期静默（避免场景刚加载就弹）
  private readonly STARTUP_QUIET_MS = 5000;
  // 演练开局静默期（让故障诊断/学员观察画面）
  private readonly DRILL_QUIET_MS = 20000;
  // 学员"最近调过参"视为活跃窗口（毫秒）— 演练外只在学员调参后窗口内允许触发
  private readonly USER_ACTIVE_WINDOW_MS = 30000;
  // 同一 tick 内最多弹 1 条（避免一股脑全弹）
  private readonly MAX_PER_TICK = 1;

  setRules(rules: ProactiveRule[]) {
    this.rules = rules;
    this.lastFired.clear();
  }

  start() {
    if (this.timer) return;
    this.engineStartTime = Date.now();
    this.lastDrillRunning = false;
    this.drillStartTime = 0;
    this.timer = setInterval(() => this.tick(), 2000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 把 equipments 数组转换成 { 设备前缀: { 参数 id: 值 } } 扁平 map */
  private buildEqMapFrom(
    equipments: ReturnType<typeof useEquipmentStore.getState>['equipments'],
  ): Record<string, Record<string, number>> {
    const map: Record<string, Record<string, number>> = {};
    equipments.forEach((eq) => {
      const prefix = eq.id.split('-')[0];
      if (!map[prefix]) map[prefix] = {};
      eq.parameters.forEach((p) => {
        map[prefix][p.id] = p.value;
      });
    });
    return map;
  }

  /** 把 message 模板里的 {PREFIX.paramId} 替换成实际值 */
  private fillMessage(template: string, eqMap: Record<string, Record<string, number>>): string {
    return template.replace(/\{([^.]+)\.([^}]+)\}/g, (_, prefix, paramId) => {
      const v = eqMap[prefix]?.[paramId];
      if (v === undefined) return '?';
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    });
  }

  /** 严重度优先级排序（danger > warning > info） */
  private severityRank(s: ProactiveRule['severity']): number {
    return s === 'danger' ? 3 : s === 'warning' ? 2 : 1;
  }

  private tick() {
    if (this.rules.length === 0) return;
    // 启动后 5 秒静默期
    if (Date.now() - this.engineStartTime < this.STARTUP_QUIET_MS) return;

    const equipments = useEquipmentStore.getState().equipments;
    if (equipments.length === 0) return;

    // 检测演练状态变化：从未运行 → 运行（即"刚开始演练"），重置开局静默期
    const drillNow = useDrillStore.getState().isRunning;
    if (drillNow && !this.lastDrillRunning) {
      this.drillStartTime = Date.now();
      this.lastFired.clear();   // 清掉历史 cooldown，让规则在新演练里独立计算
    }
    this.lastDrillRunning = drillNow;

    const now = Date.now();

    // ★ 核心门限 1：演练运行中，开局 20s 静默 —— 让 fault 自身的开局诊断说话
    if (drillNow && now - this.drillStartTime < this.DRILL_QUIET_MS) return;

    // ★ 核心门限 2：必须学员"最近 30s 内动过参数"才允许触发
    //   （演练外这是唯一门限；演练内 + 开局 20s 通过后，也用这个门限：
    //    学员还没动过任何东西，故障注入的初始偏离值不该刷屏）
    if (now - lastUserActionAt > this.USER_ACTIVE_WINDOW_MS) return;

    // 构造 eqMap + 收集本轮所有命中规则
    const eqMap = this.buildEqMapFrom(equipments);
    const candidates: ProactiveRule[] = [];
    for (const rule of this.rules) {
      const lastT = this.lastFired.get(rule.id) ?? 0;
      if (now - lastT < rule.cooldownSec * 1000) continue;
      try {
        if (rule.check(eqMap)) candidates.push(rule);
      } catch (e) {
        console.warn(`[ProactiveCoach] 规则 ${rule.id} 异常`, e);
      }
    }
    if (candidates.length === 0) return;

    // 按严重度从高到低排序，取 MAX_PER_TICK 条
    candidates.sort((a, b) => this.severityRank(b.severity) - this.severityRank(a.severity));
    const toEmit = candidates.slice(0, this.MAX_PER_TICK);
    toEmit.forEach((rule) => {
      const text = this.fillMessage(rule.message, eqMap);
      const prefix =
        rule.severity === 'danger' ? '🔴 ' :
        rule.severity === 'warning' ? '🟡 ' :
        '💡 ';
      useAIStore.getState().sendMessage(prefix + text, 'ai');
      this.lastFired.set(rule.id, now);
    });
  }
}

export const proactiveCoach = new ProactiveCoachEngine();
