import type { Equipment, Pipeline } from '@/types';

// 工艺动力学时间常数（秒）— 按参数物理特性分类，引擎据此实现一阶滞后逼近
//   流量类：tau=5     —— 流量变化通过泵/阀门快速响应，5 秒级
//   压力类：tau=8     —— 压力受气相 / 液相缓冲影响，8 秒级
//   温度类：tau=20    —— 温度有热惯量，20 秒级（再生温度更慢由耦合规则补偿）
//   开度类：tau=2     —— 滑阀执行机构动作快，2 秒级
const TAU_FLOW = 5;
const TAU_PRESSURE = 8;
const TAU_TEMP = 20;
const TAU_VALVE = 2;

export const fccEquipments: Equipment[] = [
  {
    id: 'P-101',
    name: '原料油泵',
    type: 'pump',
    x: 80,
    y: 450,
    width: 80,
    height: 80,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'pump_flow', name: '流量', value: 120, unit: 't/h', min: 50, max: 200, normalMin: 100, normalMax: 140, trend: [], tau: TAU_FLOW },
      { id: 'pump_speed', name: '转速', value: 2950, unit: 'rpm', min: 1000, max: 3500, normalMin: 2800, normalMax: 3000, trend: [], tau: TAU_FLOW },
    ],
  },
  {
    id: 'E-101',
    name: '原料油换热器',
    type: 'exchanger',
    x: 260,
    y: 430,
    width: 100,
    height: 100,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'inlet_temp', name: '入口温度', value: 180, unit: '°C', min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [], tau: TAU_TEMP },
      { id: 'outlet_temp', name: '出口温度', value: 280, unit: '°C', min: 200, max: 350, normalMin: 260, normalMax: 300, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'F-101',
    name: '加热炉',
    type: 'heater',
    x: 420,
    y: 230,
    width: 120,
    height: 100,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'furnace_temp', name: '炉膛温度', value: 750, unit: '°C', min: 500, max: 900, normalMin: 700, normalMax: 800, trend: [], tau: TAU_TEMP },
      { id: 'fuel_gas_flow', name: '燃料气流量', value: 800, unit: 'Nm³/h', min: 400, max: 1200, normalMin: 700, normalMax: 900, trend: [], tau: TAU_FLOW },
    ],
  },
  {
    id: 'R-101',
    name: '提升管反应器',
    type: 'reactor',
    x: 620,
    y: 210,
    width: 100,
    height: 140,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'reactor_temp', name: '反应温度', value: 485, unit: '°C', min: 400, max: 600, normalMin: 480, normalMax: 520, trend: [], tau: TAU_TEMP },
      { id: 'reactor_pressure', name: '反应压力', value: 0.25, unit: 'MPa', min: 0.1, max: 0.5, normalMin: 0.22, normalMax: 0.28, trend: [], tau: TAU_PRESSURE },
      { id: 'oil_ratio', name: '油气比', value: 6.5, unit: '', min: 4, max: 10, normalMin: 5, normalMax: 8, trend: [], tau: TAU_FLOW },
    ],
  },
  {
    id: 'REG-101',
    name: '再生器',
    type: 'regenerator',
    x: 820,
    y: 210,
    width: 100,
    height: 140,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'regenerator_temp', name: '再生温度', value: 690, unit: '°C', min: 600, max: 800, normalMin: 680, normalMax: 700, trend: [], tau: TAU_TEMP },
      { id: 'catalyst_circulation', name: '催化剂循环量', value: 25, unit: 't/h', min: 10, max: 40, normalMin: 20, normalMax: 30, trend: [], tau: TAU_FLOW },
      { id: 'coke_burning', name: '烧焦量', value: 3.2, unit: 't/h', min: 1, max: 6, normalMin: 2.5, normalMax: 4, trend: [], tau: TAU_FLOW },
      // 再生压力：再生器顶部稀相段压力，与反应压力联锁，差压控制催化剂循环
      { id: 'regenerator_pressure', name: '再生压力', value: 0.23, unit: 'MPa', min: 0.1, max: 0.4, normalMin: 0.22, normalMax: 0.25, trend: [], tau: TAU_PRESSURE },
    ],
  },
  {
    id: 'T-101',
    name: '分馏塔',
    type: 'fractionator',
    x: 1020,
    y: 190,
    width: 90,
    height: 180,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'tower_top_temp', name: '塔顶温度', value: 125, unit: '°C', min: 80, max: 180, normalMin: 120, normalMax: 130, trend: [], tau: TAU_TEMP },
      { id: 'tower_bottom_temp', name: '塔底温度', value: 340, unit: '°C', min: 280, max: 400, normalMin: 330, normalMax: 350, trend: [], tau: TAU_TEMP },
      { id: 'reflux_ratio', name: '回流比', value: 2.5, unit: '', min: 1, max: 5, normalMin: 2, normalMax: 3, trend: [], tau: TAU_FLOW },
      // 塔顶压力：分馏塔顶部操作压力，控制塔内气相负荷与冷凝效果
      { id: 'tower_top_pressure', name: '塔顶压力', value: 0.12, unit: 'MPa', min: 0.05, max: 0.3, normalMin: 0.10, normalMax: 0.15, trend: [], tau: TAU_PRESSURE },
    ],
  },
  {
    id: 'K-101',
    name: '主风机',
    type: 'compressor',
    x: 940,
    y: 500,
    width: 100,
    height: 100,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'air_flow', name: '风量', value: 1650, unit: 'Nm³/min', min: 1000, max: 2500, normalMin: 1500, normalMax: 1800, trend: [], tau: TAU_FLOW },
      { id: 'air_pressure', name: '风压', value: 0.25, unit: 'MPa', min: 0.15, max: 0.4, normalMin: 0.22, normalMax: 0.28, trend: [], tau: TAU_PRESSURE },
    ],
  },
  {
    id: 'V-101',
    name: '塞阀',
    type: 'valve',
    x: 720,
    y: 50,
    width: 50,
    height: 50,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'valve_opening', name: '开度', value: 65, unit: '%', min: 0, max: 100, normalMin: 50, normalMax: 80, trend: [], tau: TAU_VALVE },
    ],
  },
  {
    id: 'PI-101',
    name: '反应压力表',
    type: 'instrument',
    x: 520,
    y: 50,
    width: 60,
    height: 60,
    status: 'normal',
    template: 'fcc',
    parameters: [
      { id: 'pressure_indication', name: '压力指示', value: 0.25, unit: 'MPa', min: 0, max: 1, normalMin: 0.22, normalMax: 0.28, trend: [], tau: TAU_PRESSURE },
    ],
  },
];

export const fccPipelines: Pipeline[] = [
  // 原料油流程
  { id: 'PL-001', from: 'P-101', to: 'E-101', fromPoint: 'top', toPoint: 'bottom', medium: '原料油', flowRate: 120, color: '#8B4513' },
  { id: 'PL-002', from: 'E-101', to: 'F-101', fromPoint: 'top', toPoint: 'bottom', medium: '预热原料油', flowRate: 120, color: '#8B4513' },
  { id: 'PL-003', from: 'F-101', to: 'R-101', fromPoint: 'right', toPoint: 'left', medium: '加热原料油', flowRate: 120, color: '#FF4500' },
  // 催化剂循环
  { id: 'PL-004', from: 'R-101', to: 'REG-101', fromPoint: 'right', toPoint: 'left', medium: '待生催化剂', flowRate: 25, color: '#696969' },
  { id: 'PL-005', from: 'REG-101', to: 'R-101', fromPoint: 'top', toPoint: 'top', medium: '再生催化剂', flowRate: 25, color: '#FFD700' },
  // 反应产物
  { id: 'PL-006', from: 'R-101', to: 'T-101', fromPoint: 'right', toPoint: 'left', medium: '反应产物', flowRate: 150, color: '#4169E1' },
  // 主风系统 - 主风机在再生器右下方，从主风机顶部出 → 接入再生器右侧（绕行避开主水平干流）
  { id: 'PL-007', from: 'K-101', to: 'REG-101', fromPoint: 'top', toPoint: 'right', medium: '主风', flowRate: 1650, color: '#87CEEB' },
];

export const fccConfig = {
  equipments: fccEquipments,
  pipelines: fccPipelines,
};

