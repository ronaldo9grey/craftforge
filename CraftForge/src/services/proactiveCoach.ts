// AI 师傅主动提醒引擎
//
// 设计原则：
//   - 演练运行中：完全闭嘴 — 让 fault step 的"开局诊断 + 步骤反馈"机制独占 AI 师傅
//   - 非演练（自由探索模式）：学员调参后 30s 活跃窗口内，按规则主动点拨 + 语音
//   - 同一 tick 最多 1 条（取最严重的），避免一股脑全弹
//
// 规则定义同前

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

// 学员"最近一次操作"全局时间戳（毫秒）— drillStore 在每次调参时更新
let lastUserActionAt = 0;
export function notifyUserActed() {
  lastUserActionAt = Date.now();
}

class ProactiveCoachEngine {
  private timer: any = null;
  private rules: ProactiveRule[] = [];
  private lastFired = new Map<string, number>();
  private engineStartTime = 0;
  private readonly STARTUP_QUIET_MS = 5000;
  private readonly USER_ACTIVE_WINDOW_MS = 30000;
  private readonly MAX_PER_TICK = 1;

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

  private fillMessage(template: string, eqMap: Record<string, Record<string, number>>): string {
    return template.replace(/\{([^.]+)\.([^}]+)\}/g, (_, prefix, paramId) => {
      const v = eqMap[prefix]?.[paramId];
      if (v === undefined) return '?';
      return Number.isInteger(v) ? String(v) : v.toFixed(1);
    });
  }

  private severityRank(s: ProactiveRule['severity']): number {
    return s === 'danger' ? 3 : s === 'warning' ? 2 : 1;
  }

  private tick() {
    if (this.rules.length === 0) return;
    // 启动后 5 秒静默期
    if (Date.now() - this.engineStartTime < this.STARTUP_QUIET_MS) return;

    const equipments = useEquipmentStore.getState().equipments;
    if (equipments.length === 0) return;

    // ★ 核心门限 1：演练运行中，完全闭嘴 — 让 fault step 的反馈机制独占
    const drillNow = useDrillStore.getState().isRunning;
    if (drillNow) return;

    const now = Date.now();

    // ★ 核心门限 2：必须学员"最近 30s 内动过参数"才允许触发
    if (now - lastUserActionAt > this.USER_ACTIVE_WINDOW_MS) return;

    // 收集本轮所有命中规则
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
      const fullText = prefix + text;
      const ai = useAIStore.getState();
      ai.sendMessage(fullText, 'ai');
      // 配套语音（演练外的主动点拨也朗读出来）
      // requestSpeak 只读纯文本，不带 emoji 前缀更自然
      ai.requestSpeak(text);
      this.lastFired.set(rule.id, now);
    });
  }
}

export const proactiveCoach = new ProactiveCoachEngine();

