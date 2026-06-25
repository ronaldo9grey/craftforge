// 阳极振压成型车间 · 老炉的主动提醒规则
// 每条规则被 proactiveCoach 引擎周期扫描；触发后给学员推送一条 AI 师傅的话术
//
// 触发设计原则：
//   - 只有真正"工艺出事/接近出事"才弹，避免噪音
//   - 单条规则在 cooldown 内不重复触发（避免刷屏）
//   - 话术口语化、贴近老炉人设、不超过 30 字

import type { ProactiveRule } from '@/services/proactiveCoach';

export const anodeProactiveRules: ProactiveRule[] = [
  // === 糊料温度链 ===
  {
    id: 'an-paste-temp-low',
    severity: 'warning',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.PASTE?.['paste_temp'] ?? 150;
      return v < 140;
    },
    message: '小伙子，糊料凉了！才 {PASTE.paste_temp}°C，再不升温要开裂的。',
  },
  {
    id: 'an-paste-temp-high',
    severity: 'warning',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.PASTE?.['paste_temp'] ?? 150;
      return v > 165;
    },
    message: '糊料烧过了！{PASTE.paste_temp}°C 高于 165，气体多要起鼓，赶紧降油温。',
  },

  // === 模具温度链 ===
  {
    id: 'an-mold-temp-low',
    severity: 'warning',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.FORM?.['mold_temp'] ?? 138;
      return v < 115;
    },
    message: '模具还冷着呢，{FORM.mold_temp}°C 直接压糊料就缺角，先预热到 130。',
  },
  {
    id: 'an-mold-temp-high',
    severity: 'warning',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.FORM?.['mold_temp'] ?? 138;
      return v > 160;
    },
    message: '模具烧过头了 {FORM.mold_temp}°C，糊料要粘模脱不出来！降到 140 以下。',
  },

  // === 真空度 ===
  {
    id: 'an-vac-pressure-high',
    severity: 'warning',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.VAC?.['vac_pressure'] ?? 4.5;
      return v > 8;
    },
    message: '真空跟不上 {VAC.vac_pressure} kPa，气体困在里头阳极要起鼓，查管路漏没漏。',
  },
  {
    id: 'an-vac-flow-low',
    severity: 'info',
    cooldownSec: 120,
    check: (eq) => {
      const v = eq.VAC?.['vac_flow'] ?? 200;
      return v < 130;
    },
    message: '抽气流量才 {VAC.vac_flow} m³/h，清下过滤器吧，正常要 200 左右。',
  },

  // === 振压参数 ===
  {
    id: 'an-press-time-short',
    severity: 'warning',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.FORM?.['press_time'] ?? 95;
      return v < 70;
    },
    message: '振压时间 {FORM.press_time}s 太短，没振实密度肯定不够，给到 90 以上。',
  },
  {
    id: 'an-press-force-low',
    severity: 'warning',
    cooldownSec: 120,
    check: (eq) => {
      const v = eq.FORM?.['press_force'] ?? 1280;
      return v < 1100;
    },
    message: '压力才 {FORM.press_force} 吨太软了，提到 1280 才振得实。',
  },
  {
    id: 'an-vib-freq-low',
    severity: 'info',
    cooldownSec: 120,
    check: (eq) => {
      const v = eq.FORM?.['vib_freq'] ?? 50;
      return v < 35;
    },
    message: '振动频率 {FORM.vib_freq} Hz 低了，颗粒重排不充分。50 Hz 是 sweet spot。',
  },

  // === 加热站 ===
  {
    id: 'an-heat-power-low',
    severity: 'warning',
    cooldownSec: 120,
    check: (eq) => {
      const power = eq.MHT?.['heat_power'] ?? 65;
      const mt = eq.FORM?.['mold_temp'] ?? 138;
      return power < 30 && mt < 130;
    },
    message: '加热功率 {MHT.heat_power} kW 不够，模具凉了 {FORM.mold_temp}°C，赶紧把功率提到 65。',
  },

  // === 沥青配比 ===
  {
    id: 'an-pitch-low',
    severity: 'info',
    cooldownSec: 180,
    check: (eq) => {
      const v = eq.PASTE?.['pitch_ratio'] ?? 15;
      return v < 13.5;
    },
    message: '沥青比例才 {PASTE.pitch_ratio}%，颗粒粘不住，密度上不去。给到 15 左右。',
  },
  {
    id: 'an-pitch-high',
    severity: 'info',
    cooldownSec: 180,
    check: (eq) => {
      const v = eq.PASTE?.['pitch_ratio'] ?? 15;
      return v > 17;
    },
    message: '沥青加多了 {PASTE.pitch_ratio}%，焙烧时收缩开裂多，控制在 15~16。',
  },

  // === 综合 KPI ===
  {
    id: 'an-density-low',
    severity: 'danger',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.FORM?.['block_dens'] ?? 1.62;
      return v < 1.55;
    },
    message: '密度 {FORM.block_dens} g/cm³ 不合格！查下糊料温度、振压时间、压力。',
  },
  {
    id: 'an-qc-ratio-low',
    severity: 'danger',
    cooldownSec: 90,
    check: (eq) => {
      const v = eq.HMI?.['qc_ratio'] ?? 94;
      return v < 85;
    },
    message: '合格率 {HMI.qc_ratio}% 跌穿底线了，今天什么情况？开个 QC 会查查！',
  },
  {
    id: 'an-weight-dev-high',
    severity: 'warning',
    cooldownSec: 120,
    check: (eq) => {
      const v = eq.WGT?.['feed_dev'] ?? 0.8;
      return v > 2.5;
    },
    message: '加料重量偏差 {WGT.feed_dev}% 超 ±2%，称量传感器要校准了。',
  },
];
