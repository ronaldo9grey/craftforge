import type { Equipment, Pipeline } from '@/types';

// 数控加工车间布局 v1：1280×700 网格化布局
// 设计思路：
//  - 行 1（y=120）：两台数控机床（车床 + 铣床）作为主作业
//  - 行 2（y=340）：物料流水线 ─ 来料→上料→工件位→测量仪→下料
//  - 行 3（y=480）：辅助系统 ─ 冷却液泵、排屑器、数控操作面板
//  - 行 4（y=620）：总控柜
//  - 所有坐标严格 ≤ (1260, 690)
export const cncEquipments: Equipment[] = [
  // —— 行 1：两台数控机床 ——
  {
    id: 'CNC-101', name: '数控车床', type: 'reactor',
    x: 220, y: 120, width: 220, height: 160,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'spindle_speed', name: '主轴转速', value: 1800, unit: 'rpm', min: 500, max: 4000, normalMin: 1500, normalMax: 2200, trend: [] },
      { id: 'feed_rate',     name: '进给速度', value: 0.15, unit: 'mm/r', min: 0.05, max: 0.5, normalMin: 0.1, normalMax: 0.2, trend: [] },
      { id: 'spindle_load',  name: '主轴负载', value: 55, unit: '%', min: 0, max: 100, normalMin: 30, normalMax: 75, trend: [] },
      { id: 'spindle_temp',  name: '主轴温度', value: 48, unit: '°C', min: 20, max: 90, normalMin: 35, normalMax: 60, trend: [] },
      { id: 'vibration',     name: '振动值', value: 1.2, unit: 'mm/s', min: 0, max: 10, normalMin: 0, normalMax: 2.5, trend: [] },
      { id: 'tool_wear',     name: '刀具磨损', value: 15, unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 60, trend: [] },
    ],
  },
  {
    id: 'CNC-102', name: '数控铣床', type: 'reactor',
    x: 720, y: 120, width: 220, height: 160,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'spindle_speed', name: '主轴转速', value: 6000, unit: 'rpm', min: 1000, max: 12000, normalMin: 5500, normalMax: 7000, trend: [] },
      { id: 'feed_rate',     name: '进给速度', value: 800, unit: 'mm/min', min: 100, max: 3000, normalMin: 600, normalMax: 1200, trend: [] },
      { id: 'spindle_load',  name: '主轴负载', value: 48, unit: '%', min: 0, max: 100, normalMin: 30, normalMax: 75, trend: [] },
      { id: 'spindle_temp',  name: '主轴温度', value: 52, unit: '°C', min: 20, max: 90, normalMin: 35, normalMax: 60, trend: [] },
      { id: 'vibration',     name: '振动值', value: 1.5, unit: 'mm/s', min: 0, max: 10, normalMin: 0, normalMax: 2.5, trend: [] },
      { id: 'tool_wear',     name: '刀具磨损', value: 20, unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 60, trend: [] },
    ],
  },

  // —— 行 2：物料流水线（中心线 y=365）——
  {
    id: 'ST-201', name: '来料区', type: 'station',
    x: 60, y: 320, width: 90, height: 90,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'stock_count', name: '毛坯数量', value: 35, unit: '件', min: 0, max: 100, normalMin: 10, normalMax: 80, trend: [] },
    ],
  },
  {
    id: 'FIX-201', name: '工件夹具', type: 'fixture',
    x: 480, y: 330, width: 80, height: 70,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'clamp_force', name: '夹紧力', value: 8000, unit: 'N', min: 5000, max: 12000, normalMin: 7500, normalMax: 9500, trend: [] },
      { id: 'concentricity', name: '同心度', value: 0.02, unit: 'mm', min: 0, max: 0.2, normalMin: 0, normalMax: 0.05, trend: [] },
    ],
  },
  {
    id: 'INST-201', name: '在线测量仪', type: 'instrument',
    x: 970, y: 330, width: 80, height: 70,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'dimension_error', name: '尺寸偏差', value: 0.01, unit: 'mm', min: -0.5, max: 0.5, normalMin: -0.05, normalMax: 0.05, trend: [] },
      { id: 'surface_ra', name: '表面粗糙度', value: 1.6, unit: 'μm', min: 0.4, max: 6.3, normalMin: 0.8, normalMax: 3.2, trend: [] },
      { id: 'pass_rate', name: '合格率', value: 98, unit: '%', min: 0, max: 100, normalMin: 95, normalMax: 100, trend: [] },
    ],
  },
  {
    id: 'ST-202', name: '下料区', type: 'station',
    x: 1170, y: 320, width: 90, height: 90,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'finished_count', name: '成品数量', value: 12, unit: '件', min: 0, max: 100, normalMin: 0, normalMax: 50, trend: [] },
    ],
  },

  // —— 行 3：辅助系统 ——
  {
    id: 'PMP-201', name: '冷却液泵', type: 'pump',
    x: 220, y: 480, width: 90, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'coolant_flow', name: '冷却液流量', value: 12, unit: 'L/min', min: 0, max: 25, normalMin: 10, normalMax: 16, trend: [] },
      { id: 'coolant_pressure', name: '冷却压力', value: 0.4, unit: 'MPa', min: 0, max: 1.0, normalMin: 0.3, normalMax: 0.6, trend: [] },
      { id: 'coolant_concentration', name: '冷却液浓度', value: 8, unit: '%', min: 0, max: 20, normalMin: 6, normalMax: 10, trend: [] },
    ],
  },
  {
    id: 'CONV-201', name: '排屑器', type: 'conveyor',
    x: 380, y: 495, width: 220, height: 50,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'chip_load', name: '切屑负载', value: 35, unit: '%', min: 0, max: 100, normalMin: 0, normalMax: 70, trend: [] },
      { id: 'conv_speed', name: '排屑速度', value: 0.5, unit: 'm/min', min: 0, max: 2.0, normalMin: 0.3, normalMax: 1.0, trend: [] },
    ],
  },
  {
    id: 'HMI-201', name: '数控操作面板', type: 'instrument',
    x: 720, y: 480, width: 100, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'program_no', name: '当前程序号', value: 1024, unit: '', min: 0, max: 9999, normalMin: 0, normalMax: 9999, trend: [] },
      { id: 'cycle_count', name: '工件计数', value: 12, unit: '件', min: 0, max: 999, normalMin: 0, normalMax: 999, trend: [] },
      { id: 'override',    name: '进给倍率', value: 100, unit: '%', min: 0, max: 200, normalMin: 80, normalMax: 120, trend: [] },
    ],
  },

  // —— 行 4：总控柜 ——
  {
    id: 'CTRL-201', name: '机床总控柜', type: 'control_box',
    x: 560, y: 600, width: 160, height: 80,
    status: 'normal', template: 'cnc',
    parameters: [
      { id: 'main_voltage', name: '主电压', value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [] },
      { id: 'comm_status',  name: '通讯状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [] },
      { id: 'cnc_temp',     name: '控制柜温度', value: 32, unit: '°C', min: 0, max: 60, normalMin: 20, normalMax: 40, trend: [] },
    ],
  },
];

// 流程管线：物料流向 + 冷却液 + 控制信号
// 配色：毛坯（钢灰）/ 工件（青蓝）/ 冷却液（蓝）/ 切屑（橙）/ 控制（紫）
export const cncPipelines: Pipeline[] = [
  // —— 物料主线 ——
  { id: 'CP-001', from: 'ST-201',  to: 'FIX-201',  fromPoint: 'right', toPoint: 'left',   medium: '毛坯', flowRate: 1.0, color: '#94a3b8' },
  { id: 'CP-002', from: 'FIX-201', to: 'CNC-101',  fromPoint: 'top',   toPoint: 'bottom', medium: '工件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'CP-003', from: 'FIX-201', to: 'CNC-102',  fromPoint: 'top',   toPoint: 'bottom', medium: '工件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'CP-004', from: 'FIX-201', to: 'INST-201', fromPoint: 'right', toPoint: 'left',   medium: '工件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'CP-005', from: 'INST-201', to: 'ST-202',  fromPoint: 'right', toPoint: 'left',   medium: '成品', flowRate: 1.0, color: '#22d3ee' },

  // —— 冷却液 ——
  { id: 'CP-101', from: 'PMP-201', to: 'CNC-101', fromPoint: 'top', toPoint: 'bottom', medium: '冷却液', flowRate: 0.6, color: '#3b82f6' },
  { id: 'CP-102', from: 'PMP-201', to: 'CNC-102', fromPoint: 'top', toPoint: 'bottom', medium: '冷却液', flowRate: 0.6, color: '#3b82f6' },

  // —— 排屑 ——
  { id: 'CP-201', from: 'CNC-101', to: 'CONV-201', fromPoint: 'bottom', toPoint: 'top', medium: '切屑', flowRate: 0.5, color: '#f97316' },
  { id: 'CP-202', from: 'CNC-102', to: 'CONV-201', fromPoint: 'bottom', toPoint: 'top', medium: '切屑', flowRate: 0.5, color: '#f97316' },

  // —— 控制信号 ——
  { id: 'CP-301', from: 'CTRL-201', to: 'CNC-101', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'CP-302', from: 'CTRL-201', to: 'CNC-102', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'CP-303', from: 'CTRL-201', to: 'HMI-201', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const cncConfig = {
  equipments: cncEquipments,
  pipelines: cncPipelines,
};
