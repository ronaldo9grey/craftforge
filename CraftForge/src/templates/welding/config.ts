import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V9 (动力学加 tau + setpoint 默认)
// 汽车焊装车间布局 v9
// 在 v8 布局基础上为每个关键参数增加 tau（一阶滞后时间常数 秒）
// 让 DynamicsEngine 接管后参数变化"有惯性"，符合真实焊装设备物理行为

// 四类典型时间常数（秒）
const TAU_CURRENT = 0.5;   // 电流：焊接电源响应非常快
const TAU_VOLTAGE = 0.8;   // 电压：随电流耦合，略慢
const TAU_SPEED = 2;       // 速度类（输送带/机械臂）
const TAU_TEMP = 15;       // 温度类（电极/焊枪温度，热惯性大）
const TAU_FORCE = 1.5;     // 夹紧力/张力
const TAU_FLOW = 1;        // 气体/冷却水流量
const TAU_SLOW = 5;        // 节拍 / 计数类（慢响应）

export const weldingEquipments: Equipment[] = [
  // 行 2：主输送线（左 → 右）
  {
    id: 'ST-101', name: '上件工位', type: 'station',
    x: 30, y: 230, width: 80, height: 90,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'feed_rate',    name: '上件节拍', value: 60, unit: 's/件', min: 30, max: 120, normalMin: 50, normalMax: 70, trend: [], tau: TAU_SLOW },
      { id: 'ready_status', name: '就位状态', value: 1,  unit: '',     min: 0,  max: 1,   normalMin: 1,  normalMax: 1,  trend: [], inertia: false },
    ],
  },
  {
    id: 'CONV-101', name: '输入输送带', type: 'conveyor',
    x: 150, y: 250, width: 220, height: 50,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'conveyor_speed', name: '输送速度', value: 1.2, unit: 'm/min', min: 0.5, max: 2.0,  normalMin: 1.0, normalMax: 1.5, trend: [], tau: TAU_SPEED },
      { id: 'belt_tension',   name: '皮带张力', value: 800, unit: 'N',     min: 500, max: 1200, normalMin: 700, normalMax: 900, trend: [], tau: TAU_FORCE },
    ],
  },
  {
    id: 'FIX-101', name: '定位夹具', type: 'fixture',
    x: 480, y: 240, width: 80, height: 70,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'clamp_force',     name: '夹紧力',   value: 5000, unit: 'N',  min: 3000, max: 8000, normalMin: 4500, normalMax: 5500, trend: [], tau: TAU_FORCE },
      { id: 'position_error',  name: '定位误差', value: 0.05, unit: 'mm', min: 0,    max: 0.5,  normalMin: 0,    normalMax: 0.1,  trend: [], tau: TAU_SLOW },
      { id: 'clamp_status',    name: '夹紧状态', value: 1,    unit: '',   min: 0,    max: 1,    normalMin: 1,    normalMax: 1,    trend: [], inertia: false },
    ],
  },
  {
    id: 'INST-101', name: '焊缝检测仪', type: 'instrument',
    x: 820, y: 240, width: 70, height: 70,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'weld_quality', name: '焊缝质量', value: 95,  unit: '%',  min: 0, max: 100, normalMin: 90, normalMax: 100, trend: [], tau: TAU_SLOW },
      { id: 'defect_count', name: '缺陷计数', value: 0,   unit: '个', min: 0, max: 10,  normalMin: 0,  normalMax: 2,   trend: [], tau: TAU_SLOW },
      { id: 'penetration',  name: '熔深',     value: 2.5, unit: 'mm', min: 1, max: 5,   normalMin: 2.0, normalMax: 3.0, trend: [], tau: TAU_SLOW },
    ],
  },
  {
    id: 'CONV-102', name: '输出输送带', type: 'conveyor',
    x: 920, y: 250, width: 220, height: 50,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'conveyor_speed', name: '输送速度', value: 1.2, unit: 'm/min', min: 0.5, max: 2.0,  normalMin: 1.0, normalMax: 1.5, trend: [], tau: TAU_SPEED },
      { id: 'belt_tension',   name: '皮带张力', value: 820, unit: 'N',     min: 500, max: 1200, normalMin: 700, normalMax: 900, trend: [], tau: TAU_FORCE },
    ],
  },
  {
    id: 'ST-102', name: '下件工位', type: 'station',
    x: 1170, y: 230, width: 80, height: 90,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'output_rate', name: '下件节拍', value: 60, unit: 's/件', min: 30, max: 120, normalMin: 50, normalMax: 70, trend: [], tau: TAU_SLOW },
      { id: 'queue_count', name: '排队数量', value: 1,  unit: '件',   min: 0,  max: 5,   normalMin: 0,  normalMax: 2,  trend: [], tau: TAU_SLOW },
    ],
  },

  // 行 1：上排机器人
  {
    id: 'ROB-101', name: '机器人1号', type: 'robot',
    x: 540, y: 110, width: 110, height: 80,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流',   value: 180, unit: 'A',     min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [], tau: TAU_CURRENT },
      { id: 'weld_voltage', name: '焊接电压',   value: 22,  unit: 'V',     min: 15,  max: 35,  normalMin: 20,  normalMax: 25,  trend: [], tau: TAU_VOLTAGE },
      { id: 'arm_speed',    name: '机械臂速度', value: 0.8, unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [], tau: TAU_SPEED },
      { id: 'tip_temp',     name: '电极温度',   value: 320, unit: '°C',    min: 100, max: 600, normalMin: 280, normalMax: 380, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'ROB-102', name: '机器人2号', type: 'robot',
    x: 680, y: 110, width: 110, height: 80,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流',   value: 175, unit: 'A',     min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [], tau: TAU_CURRENT },
      { id: 'weld_voltage', name: '焊接电压',   value: 21,  unit: 'V',     min: 15,  max: 35,  normalMin: 20,  normalMax: 25,  trend: [], tau: TAU_VOLTAGE },
      { id: 'arm_speed',    name: '机械臂速度', value: 0.75,unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [], tau: TAU_SPEED },
      { id: 'tip_temp',     name: '电极温度',   value: 305, unit: '°C',    min: 100, max: 600, normalMin: 280, normalMax: 380, trend: [], tau: TAU_TEMP },
    ],
  },

  // 行 3：下排机器人 + 焊枪
  {
    id: 'ROB-103', name: '机器人3号', type: 'robot',
    x: 540, y: 440, width: 110, height: 80,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流',   value: 185, unit: 'A',     min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [], tau: TAU_CURRENT },
      { id: 'weld_voltage', name: '焊接电压',   value: 23,  unit: 'V',     min: 15,  max: 35,  normalMin: 20,  normalMax: 25,  trend: [], tau: TAU_VOLTAGE },
      { id: 'arm_speed',    name: '机械臂速度', value: 0.85,unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [], tau: TAU_SPEED },
      { id: 'tip_temp',     name: '电极温度',   value: 340, unit: '°C',    min: 100, max: 600, normalMin: 280, normalMax: 380, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'WG-101', name: '焊枪总成', type: 'weld_gun',
    x: 720, y: 430, width: 60, height: 110,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'gas_flow',       name: '保护气流量', value: 15,  unit: 'L/min', min: 5, max: 30, normalMin: 12, normalMax: 18, trend: [], tau: TAU_FLOW },
      { id: 'cooling_water',  name: '冷却水流量', value: 4.5, unit: 'L/min', min: 1, max: 10, normalMin: 4,  normalMax: 6,  trend: [], tau: TAU_FLOW },
      { id: 'wire_feed_rate', name: '送丝速度',   value: 6.0, unit: 'm/min', min: 2, max: 12, normalMin: 5,  normalMax: 7,  trend: [], tau: TAU_SPEED },
    ],
  },

  // 行 4：产线控制柜
  {
    id: 'CTRL-101', name: '产线控制柜', type: 'control_box',
    x: 580, y: 605, width: 120, height: 70,
    status: 'normal', template: 'welding',
    parameters: [
      { id: 'main_voltage', name: '主电压',   value: 380, unit: 'V', min: 360, max: 400, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态', value: 1,   unit: '',  min: 0,   max: 1,   normalMin: 1,   normalMax: 1,   trend: [], inertia: false },
      { id: 'sys_load',     name: '系统负载', value: 45,  unit: '%', min: 0,   max: 100, normalMin: 30,  normalMax: 70,  trend: [], tau: 3 },
    ],
  },
];

// 流程管线（保持 v8 不变）
export const weldingPipelines: Pipeline[] = [
  { id: 'WP-001', from: 'ST-101',   to: 'CONV-101', fromPoint: 'right', toPoint: 'left', medium: '白车身', flowRate: 1.0, color: '#94a3b8' },
  { id: 'WP-002', from: 'CONV-101', to: 'FIX-101',  fromPoint: 'right', toPoint: 'left', medium: '白车身', flowRate: 1.0, color: '#94a3b8' },
  { id: 'WP-003', from: 'FIX-101',  to: 'INST-101', fromPoint: 'right', toPoint: 'left', medium: '焊接件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'WP-004', from: 'INST-101', to: 'CONV-102', fromPoint: 'right', toPoint: 'left', medium: '检测件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'WP-005', from: 'CONV-102', to: 'ST-102',   fromPoint: 'right', toPoint: 'left', medium: '合格件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'WP-101', from: 'ROB-101', to: 'FIX-101', fromPoint: 'bottom', toPoint: 'top',    medium: '点焊', flowRate: 0.6, color: '#f97316' },
  { id: 'WP-102', from: 'ROB-102', to: 'FIX-101', fromPoint: 'bottom', toPoint: 'top',    medium: '点焊', flowRate: 0.6, color: '#f97316' },
  { id: 'WP-103', from: 'ROB-103', to: 'FIX-101', fromPoint: 'top',    toPoint: 'bottom', medium: '点焊', flowRate: 0.6, color: '#f97316' },
  { id: 'WP-201', from: 'WG-101', to: 'ROB-103', fromPoint: 'top', toPoint: 'bottom', medium: '保护气', flowRate: 0.5, color: '#84cc16' },
  { id: 'WP-301', from: 'CTRL-101', to: 'FIX-101', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const weldingConfig = {
  equipments: weldingEquipments,
  pipelines: weldingPipelines,
};
