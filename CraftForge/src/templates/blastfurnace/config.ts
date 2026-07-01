import type { Equipment, Pipeline } from '@/types';

// 高炉炼铁 3D 场景配置 v1
// 8 个关键设备 + 4 段主干管路
// 说明：本场景为 3D 渲染，x/y/width/height 仅用于复用 2D 数据结构，
// 真实 3D 空间位置在 src/scenes/blastfurnace/BlastFurnace3D.tsx 内单独映射。

// 时间常数（秒）—— 高炉是热惯性极大的巨型反应器
const TAU_HOT_TEMP = 20;   // 炉腹温度、铁水温度：升降都慢
const TAU_BLAST = 6;       // 送风温度：热风炉换向时较快
const TAU_MAF = 2;         // 风量：鼓风机响应快
const TAU_COKE = 30;       // 焦比：装料到起效存在滞后
const TAU_TOP_TEMP = 15;   // 炉顶温度：烟气温度中等惯性
const TAU_LOAD = 4;        // 鱼雷罐装载量：跟随出铁流量
const TAU_STOCK = 8;       // 料线：装料/下料时的滞后

export const blastfurnaceEquipments: Equipment[] = [
  // ============= 1. 高炉本体 — 炉腹温度控制核心 =============
  {
    id: 'BF-BODY', name: '高炉本体', type: 'reactor',
    x: 600, y: 300, width: 120, height: 260,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      // T-body 炉腹温度：< 1450 冷炉，> 1520 高温烧穿
      { id: 'T-body',      name: '炉腹温度',   value: 1480, unit: '°C',      min: 1200, max: 1700, normalMin: 1450, normalMax: 1520, trend: [], tau: TAU_HOT_TEMP },
      // 炉顶压力：辅助工艺参数
      { id: 'P-top',       name: '炉顶压力',   value: 220,  unit: 'kPa',     min: 0,    max: 350,  normalMin: 180,  normalMax: 260,  trend: [], tau: 3 },
    ],
  },

  // ============= 2. 热风炉 — 送风温度 =============
  {
    id: 'STOVE', name: '热风炉',   type: 'heater',
    x: 380, y: 340, width: 110, height: 200,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      { id: 'T-blast',     name: '送风温度',   value: 1050, unit: '°C',      min: 700,  max: 1350, normalMin: 1000, normalMax: 1250, trend: [], tau: TAU_BLAST },
      // 蓄热室富氧：辅助监控
      { id: 'stove-rich',  name: '蓄热室富氧', value: 22,   unit: '%',       min: 15,   max: 30,   normalMin: 20,   normalMax: 25,   trend: [], tau: 4 },
    ],
  },

  // ============= 3. 鼓风机 — 风量 =============
  {
    id: 'BLOWER', name: '高炉鼓风机', type: 'compressor',
    x: 210, y: 380, width: 110, height: 100,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      { id: 'MAF',         name: '风量',       value: 3200, unit: 'Nm³/min', min: 2000, max: 5000, normalMin: 3000, normalMax: 4200, trend: [], tau: TAU_MAF },
      { id: 'blower-pres', name: '鼓风压力',   value: 380,  unit: 'kPa',     min: 200,  max: 550,  normalMin: 320,  normalMax: 450,  trend: [], tau: 1.5 },
    ],
  },

  // ============= 4. 上料料斗 — 焦比 =============
  {
    id: 'CHARGE', name: '上料料斗',  type: 'conveyor',
    x: 620, y: 90, width: 100, height: 60,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      // 焦比 COKE-RATIO：焦炭 / 矿石比例，0.42 为常态
      { id: 'COKE-RATIO',  name: '焦比',       value: 0.42, unit: '',        min: 0.30, max: 0.65, normalMin: 0.35, normalMax: 0.55, trend: [], tau: TAU_COKE },
      // 每次装料量：辅助监控
      { id: 'charge-load', name: '装料量',     value: 42,   unit: 't',       min: 0,    max: 80,   normalMin: 35,   normalMax: 55,   trend: [], tau: 2 },
    ],
  },

  // ============= 5. 出铁口 — 铁水温度 =============
  {
    id: 'TAP-HOLE', name: '出铁口',    type: 'valve',
    x: 720, y: 470, width: 90, height: 60,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      // T-tap 铁水温度：出铁口的最终质量指标
      { id: 'T-tap',       name: '铁水温度',   value: 1490, unit: '°C',      min: 1300, max: 1600, normalMin: 1450, normalMax: 1510, trend: [], tau: TAU_HOT_TEMP },
      // 铁水流量：随出铁进程变化，工艺辅助监控
      { id: 'tap-flow',    name: '铁水流量',   value: 5.6,  unit: 't/min',   min: 0,    max: 12,   normalMin: 4.0,  normalMax: 8.5,  trend: [], tau: 3 },
    ],
  },

  // ============= 6. 排烟囱 — 炉顶温度 =============
  {
    id: 'STACK', name: '排烟囱',     type: 'valve',
    x: 850, y: 90, width: 60, height: 220,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      { id: 'T-top',       name: '炉顶温度',   value: 220,  unit: '°C',      min: 80,   max: 500,  normalMin: 150,  normalMax: 350,  trend: [], tau: TAU_TOP_TEMP },
      // 泄压阀开度：抢救悬料时要临时打开
      { id: 'valve-pos',   name: '泄压阀开度', value: 15,   unit: '%',       min: 0,    max: 100,  normalMin: 5,    normalMax: 35,   trend: [], tau: 1 },
    ],
  },

  // ============= 7. 鱼雷罐车 — 装载量 =============
  {
    id: 'TORPEDO', name: '鱼雷罐车',  type: 'conveyor',
    x: 890, y: 520, width: 260, height: 60,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      // LOAD 装载量：从 0 装到 350 吨一节，装满自动切换到下一节
      { id: 'LOAD',        name: '装载量',     value: 120,  unit: 't',       min: 0,    max: 400,  normalMin: 0,    normalMax: 350,  trend: [], tau: TAU_LOAD },
    ],
  },

  // ============= 8. 探尺 — 料线 =============
  {
    id: 'PROBE-1', name: '探尺',      type: 'instrument',
    x: 750, y: 180, width: 60, height: 120,
    status: 'normal', template: 'blastfurnace',
    parameters: [
      // STOCK-LINE 料线：悬料时会突然卡住（不再下降）
      { id: 'STOCK-LINE',  name: '料线',       value: 1.0,  unit: 'm',       min: 0.2,  max: 3.5,  normalMin: 0.5,  normalMax: 2.5,  trend: [], tau: TAU_STOCK },
    ],
  },
];

// ============= 主干管路（4 段）=============
// 高炉工艺链：鼓风机 → 热风炉（升温）→ 高炉本体（冶炼）→ 出铁口（出铁）
// 另有 上料料斗 → 高炉顶部（矿石+焦炭下料）
export const blastfurnacePipelines: Pipeline[] = [
  // 1. 冷风：鼓风机 → 热风炉（蓝色，未加热）
  { id: 'BF-P-01', from: 'BLOWER',   to: 'STOVE',    fromPoint: 'right',  toPoint: 'left',   medium: '冷风',   flowRate: 3200, color: '#3b82f6' },
  // 2. 热风：热风炉 → 高炉本体（红色，1050°C 送风）
  { id: 'BF-P-02', from: 'STOVE',    to: 'BF-BODY',  fromPoint: 'right',  toPoint: 'left',   medium: '热风',   flowRate: 3200, color: '#ef4444' },
  // 3. 铁水：高炉本体 → 出铁口（橙红，铁水外流）
  { id: 'BF-P-03', from: 'BF-BODY',  to: 'TAP-HOLE', fromPoint: 'bottom', toPoint: 'top',    medium: '铁水',   flowRate: 5.6,  color: '#f97316' },
  // 4. 炉顶煤气：高炉顶部 → 排烟囱（灰绿，热烟气）
  { id: 'BF-P-04', from: 'BF-BODY',  to: 'STACK',    fromPoint: 'top',    toPoint: 'bottom', medium: '炉顶煤气', flowRate: 380, color: '#84cc16' },
];
