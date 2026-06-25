// AI 师傅主动提醒引擎
//   - 每 2 秒扫描一次所有规则
//   - 命中后调 aiStore.sendMessage('...', 'assistant') 推送一条话术
//   - 单条规则在 cooldownSec 内不重复触发
//
// 规则定义：
//   - id: 规则唯一标识（同 id 共享 cooldown）
//   - severity: 'info' / 'warning' / 'danger'，控制 UI 颜色 + AI 师傅心情
//   - check: 接收 { 设备前缀: { 参数 id: 值 } } 的扁平 map，返回 true 表示需要提醒
//   - message: 模板字符串，{XX.param} 占位符会自动替换为当前值（保留 1 位小数）
//   - cooldownSec: 同规则触发间隔（秒）

import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';

export interface ProactiveRule {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  cooldownSec: number;
  check: (eq: Record<string, Record<string, number>>) => boolean;
  message: string;
}

class ProactiveCoachEngine {
  private timer: any = null;
  private rules: ProactiveRule[] = [];
  // 每条规则上次触发时间戳（毫秒）
  private lastFired = new Map<string, number>();
  // 故障未注入前 5 秒不弹（避免演练开局立刻刷屏）
  private engineStartTime = 0;
  private readonly STARTUP_QUIET_MS = 5000;

  setRules(rules: ProactiveRule[]) {
    this.rules = rules;
    this.lastFired.clear();
  }

  start() {
    if (this.timer) return;
    this.engineStartTime = Date.now();
    this.timer = setInterval(() => this.tick(), 2000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** 把 equipments 数组转换成 { 设备前缀: { 参数 id: 值 } } 扁平 map
   *  例：FORM-201 → key='FORM'，{ press_time: 95, ... }
   */
  private buildEqMapFrom(equipments: ReturnType<typeof useEquipmentStore.getState>['equipments']): Record<string, Record<string, number>> {
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
      // 整数显示整数，小数显示 1 位
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    });
  }

  private tick() {
    if (this.rules.length === 0) return;
    // 启动后 5 秒静默期
    if (Date.now() - this.engineStartTime < this.STARTUP_QUIET_MS) return;
    // 必须有设备数据（场景已加载）才生效；演练是否运行不再作硬门限，
    // 学员探索式调参也希望师傅吱声
    const equipments = useEquipmentStore.getState().equipments;
    if (equipments.length === 0) return;

    const eqMap = this.buildEqMapFrom(equipments);
    const now = Date.now();
    for (const rule of this.rules) {
      const lastT = this.lastFired.get(rule.id) ?? 0;
      if (now - lastT < rule.cooldownSec * 1000) continue;
      try {
        if (rule.check(eqMap)) {
          const text = this.fillMessage(rule.message, eqMap);
          // 主动 AI 提醒前缀（前端可识别样式）
          const prefix = rule.severity === 'danger' ? '🔴 ' : rule.severity === 'warning' ? '🟡 ' : '💡 ';
          useAIStore.getState().sendMessage(prefix + text, 'ai');
          this.lastFired.set(rule.id, now);
        }
      } catch (e) {
        console.warn(`[ProactiveCoach] 规则 ${rule.id} 异常`, e);
      }
    }
  }
}

export const proactiveCoach = new ProactiveCoachEngine();
