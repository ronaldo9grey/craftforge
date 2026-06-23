import type { Equipment, Pipeline } from '@/types';

// 数控加工车间布局 v3（动力学版）：在 v2 基础上为所有参数补 tau
// 让 DynamicsEngine 接管后参数变化"有惯性"
//
// 时间常数尺度：
//   主轴转速 / 进给：~0.5-1s（伺服快速响应）
//   主轴负载 / 振动：~1s（机械响应）
//   主轴温度 / 控制柜温度：~25s（热惯性大）
//   刀具磨损 / 尺寸偏差 / 粗糙度：~10s（缓慢累积）
//   冷却液 / 排屑：~1-2s
const TAU_SERVO = 0.8;     // 伺服类（转速 / 进给）
const TAU_LOAD = 1;        // 负载 / 振动
const TAU_TEMP = 25;       // 温度类
const TAU_QUALITY = 10;    // 加工质量（粗糙度 / 尺寸偏差 / 磨损）
const TAU_FLOW = 1.5;      // 冷却液 / 排屑
const TAU_FORCE = 1.5;     // 夹紧力 / 同心度
export const cncEquipments: Equipment[] = [
  // —— 行 1：双工位加工区（两台数控机床并列） ——
  {
    id: 'CNC-101', name: '数控车床', type: 'reactor',
    x: 290, y: 110, width: 200, height: 140,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'spindle_speed', name: '主轴转速', value: 1800, unit: 'rpm', min: 500, max: 4000, normalMin: 1500, normalMax: 2200, trend: [], tau: TAU_SERVO },
      { id: 'feed_rate',     name: '进给速度', value: 0.15, unit: 'mm/r', min: 0.05, max: 0.5, normalMin: 0.1, normalMax: 0.2, trend: [], tau: TAU_SERVO },
      { id: 'spindle_load',  name: '主轴负载', value: 55, unit: '%', min: 0, max: 100, normalMin: 30, normalMax: 75, trend: [], tau: TAU_LOAD },
      { id: 'spindle_temp',  name: '主轴温度', value: 48, unit: '°C', min: 20, max: 90, normalMin: 35, normalMax: 60, trend: [], tau: TAU_TEMP },
      { id: 'vibration',     name: '振动值', value: 1.2, unit: 'mm/s', min: 0, max: 10, normalMin: 0, normalMax: 2.5, trend: [], tau: TAU_LOAD },
      { id: 'tool_wear',     name: '刀具磨损', value: 15, unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 60, trend: [], tau: TAU_QUALITY },
    ],
  },
  {
    id: 'CNC-102', name: '数控铣床', type: 'reactor',
    x: 790, y: 110, width: 200, height: 140,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'spindle_speed', name: '主轴转速', value: 6000, unit: 'rpm', min: 1000, max: 12000, normalMin: 5500, normalMax: 7000, trend: [], tau: TAU_SERVO },
      { id: 'feed_rate',     name: '进给速度', value: 800, unit: 'mm/min', min: 100, max: 3000, normalMin: 600, normalMax: 1200, trend: [], tau: TAU_SERVO },
      { id: 'spindle_load',  name: '主轴负载', value: 48, unit: '%', min: 0, max: 100, normalMin: 30, normalMax: 75, trend: [], tau: TAU_LOAD },
      { id: 'spindle_temp',  name: '主轴温度', value: 52, unit: '°C', min: 20, max: 90, normalMin: 35, normalMax: 60, trend: [], tau: TAU_TEMP },
      { id: 'vibration',     name: '振动值', value: 1.5, unit: 'mm/s', min: 0, max: 10, normalMin: 0, normalMax: 2.5, trend: [], tau: TAU_LOAD },
      { id: 'tool_wear',     name: '刀具磨损', value: 20, unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 60, trend: [], tau: TAU_QUALITY },
    ],
  },

  // —— 行 2：物流主线（中心线 y=335，所有元素居中对齐） ——
  {
    id: 'ST-201', name: '来料区', type: 'station',
    x: 50, y: 300, width: 90, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'stock_count', name: '毛坯数量', value: 35, unit: '件', min: 0, max: 100, normalMin: 10, normalMax: 80, trend: [], tau: 5 },
    ],
  },
  {
    id: 'FIX-201', name: '工件夹具', type: 'fixture',
    x: 600, y: 305, width: 80, height: 70,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'clamp_force', name: '夹紧力', value: 8000, unit: 'N', min: 5000, max: 12000, normalMin: 7500, normalMax: 9500, trend: [], tau: TAU_FORCE },
      { id: 'concentricity', name: '同心度', value: 0.02, unit: 'mm', min: 0, max: 0.2, normalMin: 0, normalMax: 0.05, trend: [], tau: TAU_FORCE },
    ],
  },
  {
    id: 'INST-201', name: '在线测量仪', type: 'instrument',
    x: 1030, y: 305, width: 80, height: 70,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'dimension_error', name: '尺寸偏差', value: 0.01, unit: 'mm', min: -0.5, max: 0.5, normalMin: -0.05, normalMax: 0.05, trend: [], tau: TAU_QUALITY },
      { id: 'surface_ra', name: '表面粗糙度', value: 1.6, unit: 'μm', min: 0.4, max: 6.3, normalMin: 0.8, normalMax: 3.2, trend: [], tau: TAU_QUALITY },
      { id: 'pass_rate', name: '合格率', value: 98, unit: '%', min: 0, max: 100, normalMin: 95, normalMax: 100, trend: [], tau: TAU_QUALITY },
    ],
  },
  {
    id: 'ST-202', name: '下料区', type: 'station',
    x: 1170, y: 300, width: 90, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'finished_count', name: '成品数量', value: 12, unit: '件', min: 0, max: 100, normalMin: 0, normalMax: 50, trend: [], tau: 5 },
    ],
  },

  // —— 行 3：辅助系统区（冷却 + 排屑 + 数控面板） ——
  {
    id: 'PMP-201', name: '冷却液泵', type: 'pump',
    x: 100, y: 430, width: 90, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'coolant_flow', name: '冷却液流量', value: 12, unit: 'L/min', min: 0, max: 25, normalMin: 10, normalMax: 16, trend: [], tau: TAU_FLOW },
      { id: 'coolant_pressure', name: '冷却压力', value: 0.4, unit: 'MPa', min: 0, max: 1.0, normalMin: 0.3, normalMax: 0.6, trend: [], tau: TAU_FLOW },
      { id: 'coolant_concentration', name: '冷却液浓度', value: 8, unit: '%', min: 0, max: 20, normalMin: 6, normalMax: 10, trend: [], tau: 8 },
    ],
  },
  {
    id: 'CONV-201', name: '排屑器', type: 'conveyor',
    x: 470, y: 445, width: 340, height: 50,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'chip_load', name: '切屑负载', value: 35, unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 70, trend: [], tau: 5 },
      { id: 'conv_speed', name: '排屑速度', value: 0.5, unit: 'm/min', min: 0, max: 2.0, normalMin: 0.3, normalMax: 1.0, trend: [], tau: TAU_FLOW },
    ],
  },
  {
    id: 'HMI-201', name: '数控操作面板', type: 'instrument',
    x: 1090, y: 430, width: 110, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'program_no', name: '当前程序号', value: 1024, unit: '', min: 0, max: 9999, normalMin: 0, normalMax: 9999, trend: [], inertia: false },
      { id: 'cycle_count', name: '工件计数', value: 12, unit: '件', min: 0, max: 999, normalMin: 0, normalMax: 999, trend: [], tau: 5 },
      { id: 'override',    name: '进给倍率', value: 100, unit: '%', min: 0, max: 200, normalMin: 80, normalMax: 120, trend: [], tau: 1 },
    ],
  },

  // —— 行 4：电气控制区 ——
  {
    id: 'CTRL-201', name: '机床总控柜', type: 'control_box',
    x: 560, y: 580, width: 160, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'main_voltage', name: '主电压', value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [], inertia: false },
      { id: 'cnc_temp',     name: '控制柜温度', value: 32, unit: '°C', min: 0, max: 60, normalMin: 20, normalMax: 40, trend: [], tau: TAU_TEMP },
    ],
  },
];

// 物料流主线 + 冷却/排屑/控制辅助线
// 配色统一：钢灰=毛坯 / 青蓝=工件 / 蓝=冷却 / 橙=切屑 / 紫=控制
export const cncPipelines: Pipeline[] = [
  // —— ① 物料主线（左→右，走中心线 y=335） ——
  { id: 'CP-001', from: 'ST-201',  to: 'FIX-201',  fromPoint: 'right', toPoint: 'left',  medium: '毛坯',  flowRate: 1.0, color: '#94a3b8' },

  // 夹具 ↑ 上料到车床、铣床（两台同时取件）
  { id: 'CP-002', from: 'FIX-201', to: 'CNC-101',  fromPoint: 'top',   toPoint: 'bottom', medium: '装夹→车床', flowRate: 0.8, color: '#22d3ee' },
  { id: 'CP-003', from: 'FIX-201', to: 'CNC-102',  fromPoint: 'top',   toPoint: 'bottom', medium: '装夹→铣床', flowRate: 0.8, color: '#22d3ee' },

  // 机床 → 测量（加工完成回到物流线再去测量）
  { id: 'CP-004', from: 'CNC-101', to: 'INST-201', fromPoint: 'right', toPoint: 'left',  medium: '加工件→测量', flowRate: 0.8, color: '#22d3ee' },
  { id: 'CP-005', from: 'CNC-102', to: 'INST-201', fromPoint: 'bottom', toPoint: 'top', medium: '加工件→测量', flowRate: 0.8, color: '#22d3ee' },

  // 测量 → 下料
  { id: 'CP-006', from: 'INST-201', to: 'ST-202',  fromPoint: 'right', toPoint: 'left',  medium: '合格件', flowRate: 1.0, color: '#22d3ee' },

  // —— ② 冷却液回路（泵 → 两台机床） ——
  { id: 'CP-101', from: 'PMP-201', to: 'CNC-101', fromPoint: 'top', toPoint: 'bottom', medium: '冷却液', flowRate: 0.6, color: '#3b82f6' },
  { id: 'CP-102', from: 'PMP-201', to: 'CNC-102', fromPoint: 'top', toPoint: 'bottom', medium: '冷却液', flowRate: 0.6, color: '#3b82f6' },

  // —— ③ 切屑排放（两台机床 → 排屑器） ——
  { id: 'CP-201', from: 'CNC-101', to: 'CONV-201', fromPoint: 'bottom', toPoint: 'top', medium: '切屑', flowRate: 0.5, color: '#f97316' },
  { id: 'CP-202', from: 'CNC-102', to: 'CONV-201', fromPoint: 'bottom', toPoint: 'top', medium: '切屑', flowRate: 0.5, color: '#f97316' },

  // —— ④ 控制信号（总控柜 → 机床/面板，紫色虚线感） ——
  { id: 'CP-301', from: 'CTRL-201', to: 'CNC-101', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'CP-302', from: 'CTRL-201', to: 'CNC-102', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'CP-303', from: 'CTRL-201', to: 'HMI-201', fromPoint: 'right', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const cncConfig = {
  equipments: cncEquipments,
  pipelines: cncPipelines,
};
