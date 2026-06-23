import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V2 (注塑场景布局优化版)
// 注塑成型车间布局 v2：1280×700
// 主要变更 vs v1：
//   ① 行 1 中间补 ROB-201 取件机械手，填补两台 IMM 间空白
//   ② 行 2 增加 CONV-201 上料输送带（HOP→DRY 之间）和 CONV-202 成品输送带（MOLD→INST 之间），补齐传动语言
//   ③ MOLD-201 type 改为 reactor（圆柱形更接近合模板视觉，比 fixture 更贴合注塑语义）
//   ④ 行 3 增加 MTC-301 模温机（关键辅助设备），填补 CHILL→HMI 之间 420px 空洞
//   ⑤ 所有行间净距 ≥ 50px，所有坐标 ≤ (1260, 690)
//   ⑥ DRY→IMM 改成双 right→bottom 对称走线
//
// 四行布局：
//   行 1 (y=110~250) 双工位主机区 + 中央取件机械手  IMM-101 / ROB-201 / IMM-102
//   行 2 (y=300~370) 物料/成品主线  HOP → CONV-201 → DRY → IMM料筒区 → MOLD → CONV-202 → INST → ST
//   行 3 (y=420~500) 辅助系统区     HEAT-301 / CHILL-301 / MTC-301 / HMI-301
//   行 4 (y=580~660) 电气控制区     CTRL-401

const TAU_FAST = 1;
const TAU_FORCE = 2;
const TAU_FLOW = 2;
const TAU_MID = 5;
const TAU_TEMP = 20;
const TAU_MOLD = 30;
const TAU_HOPPER = 15;
const TAU_QUALITY = 8;
const TAU_SPEED = 2;

export const injectionEquipments: Equipment[] = [
  // ============================================================
  // 行 1：双工位主机区 + 中央取件机械手
  // ============================================================
  {
    id: 'IMM-101', name: '立式注塑机', type: 'reactor',
    x: 180, y: 110, width: 200, height: 140,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'inject_pressure', name: '注射压力', value: 85,  unit: 'MPa',  min: 30, max: 180, normalMin: 70,  normalMax: 110, trend: [], tau: TAU_FAST },
      { id: 'inject_speed',    name: '注射速度', value: 60,  unit: 'mm/s', min: 10, max: 150, normalMin: 50,  normalMax: 80,  trend: [], tau: TAU_FAST },
      { id: 'clamp_force',     name: '锁模力',   value: 1200,unit: 'kN',   min: 500, max: 2000,normalMin: 1100,normalMax: 1300,trend: [], tau: TAU_FORCE },
      { id: 'screw_speed',     name: '螺杆转速', value: 80,  unit: 'rpm',  min: 0,  max: 200, normalMin: 60,  normalMax: 100, trend: [], tau: TAU_FAST },
      { id: 'cycle_time',      name: '周期时间', value: 28,  unit: 's',    min: 10, max: 90,  normalMin: 22,  normalMax: 32,  trend: [], tau: TAU_MID },
    ],
  },
  {
    id: 'ROB-201', name: '取件机械手', type: 'robot',
    x: 540, y: 110, width: 110, height: 140,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'arm_position', name: '机械臂位置', value: 0,    unit: '°',     min: 0,   max: 180, normalMin: 0,    normalMax: 180, trend: [], tau: 0.5 },
      { id: 'arm_speed',    name: '机械臂速度', value: 1.5,  unit: 'm/s',   min: 0,   max: 3,   normalMin: 1.0,  normalMax: 2.0, trend: [], tau: TAU_SPEED },
      { id: 'pick_success', name: '取件成功率', value: 99,   unit: '%',     min: 0,   max: 100, normalMin: 97,   normalMax: 100, trend: [], tau: TAU_QUALITY },
      { id: 'vacuum_pressure', name: '吸盘真空度', value: -85, unit: 'kPa', min: -100,max: 0,   normalMin: -95,  normalMax: -70, trend: [], tau: TAU_FAST },
    ],
  },
  {
    id: 'IMM-102', name: '卧式注塑机', type: 'reactor',
    x: 800, y: 110, width: 200, height: 140,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'inject_pressure', name: '注射压力', value: 92,  unit: 'MPa',  min: 30, max: 180, normalMin: 70,  normalMax: 110, trend: [], tau: TAU_FAST },
      { id: 'inject_speed',    name: '注射速度', value: 65,  unit: 'mm/s', min: 10, max: 150, normalMin: 50,  normalMax: 80,  trend: [], tau: TAU_FAST },
      { id: 'clamp_force',     name: '锁模力',   value: 1250,unit: 'kN',   min: 500, max: 2000,normalMin: 1100,normalMax: 1300,trend: [], tau: TAU_FORCE },
      { id: 'screw_speed',     name: '螺杆转速', value: 85,  unit: 'rpm',  min: 0,  max: 200, normalMin: 60,  normalMax: 100, trend: [], tau: TAU_FAST },
      { id: 'cycle_time',      name: '周期时间', value: 26,  unit: 's',    min: 10, max: 90,  normalMin: 22,  normalMax: 32,  trend: [], tau: TAU_MID },
    ],
  },

  // ============================================================
  // 行 2：物料/成品主线（中心线 y=335）
  //  HOP-201 → CONV-201 上料 → DRY-201 → (向上送入 IMM) ... MOLD-201 → CONV-202 成品 → INST-201 → ST-202
  // ============================================================
  {
    id: 'HOP-201', name: '原料料斗', type: 'station',
    x: 30, y: 305, width: 70, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'hopper_level', name: '料位',     value: 65, unit: '%',  min: 0,  max: 100, normalMin: 30, normalMax: 90,  trend: [], tau: TAU_HOPPER },
      { id: 'mat_temp',     name: '物料温度', value: 55, unit: '°C', min: 20, max: 120, normalMin: 50, normalMax: 70,  trend: [], tau: TAU_HOPPER },
    ],
  },
  {
    id: 'CONV-201', name: '上料输送带', type: 'conveyor',
    x: 110, y: 320, width: 110, height: 40,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'conveyor_speed', name: '输送速度', value: 0.8, unit: 'm/min', min: 0, max: 2.0, normalMin: 0.5, normalMax: 1.2, trend: [], tau: TAU_SPEED },
      { id: 'feed_rate',      name: '上料速率', value: 12,  unit: 'kg/h',  min: 0, max: 30,  normalMin: 8,   normalMax: 18,  trend: [], tau: TAU_MID },
    ],
  },
  {
    id: 'DRY-201', name: '物料干燥机', type: 'pump',
    x: 235, y: 305, width: 95, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'dry_temp',     name: '干燥温度', value: 85,  unit: '°C',  min: 40,  max: 130, normalMin: 75, normalMax: 95, trend: [], tau: TAU_TEMP },
      { id: 'moisture_ppm', name: '含水率',   value: 280, unit: 'ppm', min: 0,   max: 1000,normalMin: 0,  normalMax: 400,trend: [], tau: 15 },
    ],
  },
  {
    id: 'MOLD-201', name: '注塑模具', type: 'reactor',
    x: 535, y: 290, width: 120, height: 90,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'mold_temp',   name: '模具温度', value: 55,    unit: '°C',  min: 20,  max: 130, normalMin: 45,  normalMax: 75,  trend: [], tau: TAU_MOLD },
      { id: 'eject_force', name: '顶出力',   value: 180,   unit: 'kN',  min: 50,  max: 400, normalMin: 150, normalMax: 220, trend: [], tau: TAU_FAST },
      { id: 'cycle_count', name: '合模次数', value: 12450, unit: '次',  min: 0,   max: 999999, normalMin: 0,normalMax: 999999, trend: [], tau: TAU_MID },
    ],
  },
  {
    id: 'CONV-202', name: '成品输送带', type: 'conveyor',
    x: 720, y: 320, width: 180, height: 40,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'conveyor_speed', name: '输送速度', value: 0.6, unit: 'm/min', min: 0, max: 2.0,  normalMin: 0.4, normalMax: 1.0, trend: [], tau: TAU_SPEED },
      { id: 'product_count',  name: '在途数',   value: 5,   unit: '件',    min: 0, max: 50,   normalMin: 0,   normalMax: 30,  trend: [], tau: TAU_MID },
    ],
  },
  {
    id: 'INST-201', name: '在线检测仪', type: 'instrument',
    x: 925, y: 305, width: 90, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'weight_dev',   name: '重量偏差',   value: 0.05, unit: 'g',  min: -2,  max: 2,   normalMin: -0.3, normalMax: 0.3,  trend: [], tau: TAU_QUALITY },
      { id: 'dim_dev',      name: '尺寸偏差',   value: 0.02, unit: 'mm', min: -0.5,max: 0.5, normalMin: -0.05,normalMax: 0.05, trend: [], tau: TAU_QUALITY },
      { id: 'defect_count', name: '外观缺陷数', value: 1,    unit: '个', min: 0,   max: 20,  normalMin: 0,    normalMax: 3,    trend: [], tau: 5 },
    ],
  },
  {
    id: 'ST-202', name: '成品下料区', type: 'station',
    x: 1080, y: 305, width: 90, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'finished_count', name: '成品数量', value: 320, unit: '件', min: 0, max: 9999, normalMin: 0,  normalMax: 9999, trend: [], tau: TAU_MID },
      { id: 'pass_rate',      name: '合格率',   value: 97,  unit: '%',  min: 0, max: 100,  normalMin: 95, normalMax: 100,  trend: [], tau: TAU_QUALITY },
    ],
  },

  // ============================================================
  // 行 3：辅助系统区（加热筒 / 冷水机 / 模温机 / 操作面板）
  // ============================================================
  {
    id: 'HEAT-301', name: '加热筒控制', type: 'heater',
    x: 50, y: 420, width: 200, height: 80,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'zone1_temp', name: '喂料段温度', value: 200, unit: '°C', min: 100, max: 280, normalMin: 180, normalMax: 220, trend: [], tau: TAU_TEMP },
      { id: 'zone2_temp', name: '压缩段温度', value: 225, unit: '°C', min: 100, max: 300, normalMin: 210, normalMax: 240, trend: [], tau: TAU_TEMP },
      { id: 'zone3_temp', name: '计量段温度', value: 240, unit: '°C', min: 100, max: 310, normalMin: 220, normalMax: 250, trend: [], tau: TAU_TEMP },
      { id: 'nozzle_temp',name: '喷嘴温度',   value: 245, unit: '°C', min: 100, max: 320, normalMin: 225, normalMax: 255, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'CHILL-301', name: '冷水机', type: 'pump',
    x: 290, y: 425, width: 130, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'chiller_flow',   name: '冷却水流量', value: 18,  unit: 'L/min', min: 0,  max: 40, normalMin: 14, normalMax: 24, trend: [], tau: TAU_FLOW },
      { id: 'water_in_temp',  name: '进水温度',   value: 14,  unit: '°C',    min: 5,  max: 35, normalMin: 10, normalMax: 18, trend: [], tau: 15 },
      { id: 'water_out_temp', name: '出水温度',   value: 22,  unit: '°C',    min: 5,  max: 45, normalMin: 18, normalMax: 28, trend: [], tau: 15 },
    ],
  },
  {
    id: 'MTC-301', name: '模温机', type: 'exchanger',
    x: 460, y: 420, width: 200, height: 80,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'mtc_set_temp',   name: '设定温度', value: 60, unit: '°C',    min: 20, max: 120, normalMin: 45, normalMax: 80, trend: [], tau: 25 },
      { id: 'mtc_actual_temp',name: '实际温度', value: 58, unit: '°C',    min: 20, max: 120, normalMin: 45, normalMax: 80, trend: [], tau: 25 },
      { id: 'mtc_flow',       name: '循环流量', value: 12, unit: 'L/min', min: 0,  max: 25,  normalMin: 10, normalMax: 16, trend: [], tau: TAU_FLOW },
    ],
  },
  {
    id: 'HMI-301', name: '操作面板', type: 'instrument',
    x: 1060, y: 425, width: 120, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'program_no',     name: '当前程序号', value: 207, unit: '',  min: 0,  max: 9999, normalMin: 0,  normalMax: 9999, trend: [], inertia: false },
      { id: 'shot_count',     name: '射出计数',   value: 12450, unit: '次', min: 0, max: 999999, normalMin: 0, normalMax: 999999, trend: [], tau: TAU_MID },
      { id: 'speed_override', name: '速度倍率',   value: 100, unit: '%', min: 0,  max: 200,  normalMin: 80, normalMax: 120, trend: [], tau: 1 },
    ],
  },

  // ============================================================
  // 行 4：电气控制区
  // ============================================================
  {
    id: 'CTRL-401', name: '注塑总控柜', type: 'control_box',
    x: 540, y: 590, width: 200, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'main_voltage', name: '主电压',     value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态',   value: 1,   unit: '',  min: 0,   max: 1,   normalMin: 1,   normalMax: 1,   trend: [], inertia: false },
      { id: 'panel_temp',   name: '控制柜温度', value: 30,  unit: '°C',min: 0,   max: 60,  normalMin: 20,  normalMax: 40,  trend: [], tau: TAU_TEMP },
    ],
  },
];

// ============================================================
// 管线：精心走线避开穿越
// 配色：原料=灰 / 熔体=橙 / 成品=青 / 冷却=蓝 / 控制=紫 / 加热=红
// ============================================================
export const injectionPipelines: Pipeline[] = [
  // —— ① 物料主线（横向流动）——
  { id: 'IP-001', from: 'HOP-201',  to: 'CONV-201', fromPoint: 'right', toPoint: 'left', medium: '原料', flowRate: 0.6, color: '#94a3b8' },
  { id: 'IP-002', from: 'CONV-201', to: 'DRY-201',  fromPoint: 'right', toPoint: 'left', medium: '颗粒', flowRate: 0.6, color: '#94a3b8' },
  { id: 'IP-003', from: 'DRY-201',  to: 'IMM-101',  fromPoint: 'top',   toPoint: 'bottom', medium: '干料', flowRate: 0.6, color: '#94a3b8' },
  { id: 'IP-004', from: 'DRY-201',  to: 'IMM-102',  fromPoint: 'top',   toPoint: 'bottom', medium: '干料', flowRate: 0.6, color: '#94a3b8' },

  // —— ② 注塑机 → 模具（熔体注入）——
  { id: 'IP-101', from: 'IMM-101', to: 'MOLD-201', fromPoint: 'bottom', toPoint: 'left',  medium: '熔体', flowRate: 1.0, color: '#f97316' },
  { id: 'IP-102', from: 'IMM-102', to: 'MOLD-201', fromPoint: 'bottom', toPoint: 'right', medium: '熔体', flowRate: 1.0, color: '#f97316' },

  // —— ③ 取件机械手抓取成品 → 输送带 ——
  { id: 'IP-201', from: 'MOLD-201', to: 'ROB-201',  fromPoint: 'top',   toPoint: 'bottom', medium: '取件', flowRate: 0.8, color: '#22d3ee' },
  { id: 'IP-202', from: 'ROB-201',  to: 'CONV-202', fromPoint: 'right', toPoint: 'left',  medium: '成品', flowRate: 0.8, color: '#22d3ee' },
  { id: 'IP-203', from: 'CONV-202', to: 'INST-201', fromPoint: 'right', toPoint: 'left',  medium: '成品', flowRate: 1.0, color: '#22d3ee' },
  { id: 'IP-204', from: 'INST-201', to: 'ST-202',   fromPoint: 'right', toPoint: 'left',  medium: '合格件', flowRate: 1.0, color: '#22d3ee' },

  // —— ④ 加热筒控制信号（仅 IMM 通过控制柜接 HEAT，避免和模具冷却线重叠）——
  { id: 'IP-301', from: 'HEAT-301', to: 'IMM-101', fromPoint: 'top', toPoint: 'bottom', medium: '加热', flowRate: 0.5, color: '#ef4444' },
  { id: 'IP-302', from: 'HEAT-301', to: 'IMM-102', fromPoint: 'top', toPoint: 'bottom', medium: '加热', flowRate: 0.5, color: '#ef4444' },

  // —— ⑤ 冷却水回路（CHILL-301 + MTC-301 双源）——
  { id: 'IP-401', from: 'CHILL-301', to: 'IMM-101', fromPoint: 'top', toPoint: 'bottom', medium: '冷却水', flowRate: 0.5, color: '#3b82f6' },
  { id: 'IP-402', from: 'CHILL-301', to: 'IMM-102', fromPoint: 'top', toPoint: 'bottom', medium: '冷却水', flowRate: 0.5, color: '#3b82f6' },
  { id: 'IP-403', from: 'MTC-301',   to: 'MOLD-201', fromPoint: 'top', toPoint: 'bottom', medium: '模温水', flowRate: 0.6, color: '#3b82f6' },

  // —— ⑥ 控制信号（紫色，CTRL-401 是大脑）——
  { id: 'IP-501', from: 'CTRL-401', to: 'IMM-101',  fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'IP-502', from: 'CTRL-401', to: 'IMM-102',  fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'IP-503', from: 'CTRL-401', to: 'HMI-301',  fromPoint: 'right', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'IP-504', from: 'CTRL-401', to: 'ROB-201',  fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },

  // —— ⑦ 检测反馈信号（INST → CTRL，闭环质量控制）——
  { id: 'IP-601', from: 'INST-201', to: 'CTRL-401', fromPoint: 'bottom', toPoint: 'right', medium: '检测反馈', flowRate: 0.3, color: '#a855f7' },
];

export const injectionConfig = {
  equipments: injectionEquipments,
  pipelines: injectionPipelines,
};
