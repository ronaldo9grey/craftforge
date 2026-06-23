import type { Equipment, Pipeline } from '@/types';

// 注塑成型车间布局 v1：1280×700
// 四行水平分区（继承焊装/CNC 的成功设计原则，避免历史坑）：
//   行 1 (y=110~250) 双工位主机区   ─ IMM-101 立式注塑机 / IMM-102 卧式注塑机
//   行 2 (y=300~370) 物料/成品主线   ─ HOP-201 料斗 → DRY-201 干燥机 → MOLD-201 模具 → INST-201 检测 → ST-202 下料
//   行 3 (y=420~500) 辅助系统区     ─ HEAT-301 加热筒 / CHILL-301 冷水机 / HMI-301 操作面板
//   行 4 (y=580~660) 电气控制区     ─ CTRL-401 总控柜
//
// 设计要点：
// - 行间净距 ≥ 50px，避免遮挡
// - 所有坐标严格 ≤ (1260, 690)
// - 设备 type 复用现有渲染原语（reactor / pump / instrument / station / fixture / control_box）
// - 所有关键参数补 tau 字段，给 DynamicsEngine 提供物理惯性

// 时间常数（秒）
const TAU_FAST = 1;      // 注射压力 / 速度 / 螺杆转速 等伺服类
const TAU_FORCE = 2;     // 锁模力 / 顶出力
const TAU_FLOW = 2;      // 流量类
const TAU_MID = 5;       // 计数 / 周期类
const TAU_TEMP = 20;     // 加热筒各段温度
const TAU_MOLD = 30;     // 模具温度（热惯性最大）
const TAU_HOPPER = 15;   // 料斗 / 干燥机
const TAU_QUALITY = 8;   // 在线检测类

export const injectionEquipments: Equipment[] = [
  // —— 行 1：双工位主机区 ——
  {
    id: 'IMM-101', name: '立式注塑机', type: 'reactor',
    x: 280, y: 110, width: 200, height: 140,
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
    id: 'IMM-102', name: '卧式注塑机', type: 'reactor',
    x: 780, y: 110, width: 200, height: 140,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'inject_pressure', name: '注射压力', value: 92,  unit: 'MPa',  min: 30, max: 180, normalMin: 70,  normalMax: 110, trend: [], tau: TAU_FAST },
      { id: 'inject_speed',    name: '注射速度', value: 65,  unit: 'mm/s', min: 10, max: 150, normalMin: 50,  normalMax: 80,  trend: [], tau: TAU_FAST },
      { id: 'clamp_force',     name: '锁模力',   value: 1250,unit: 'kN',   min: 500, max: 2000,normalMin: 1100,normalMax: 1300,trend: [], tau: TAU_FORCE },
      { id: 'screw_speed',     name: '螺杆转速', value: 85,  unit: 'rpm',  min: 0,  max: 200, normalMin: 60,  normalMax: 100, trend: [], tau: TAU_FAST },
      { id: 'cycle_time',      name: '周期时间', value: 26,  unit: 's',    min: 10, max: 90,  normalMin: 22,  normalMax: 32,  trend: [], tau: TAU_MID },
    ],
  },

  // —— 行 2：物料 / 模具 / 检测 / 下料 主线（中心线 y=335） ——
  {
    id: 'HOP-201', name: '原料料斗', type: 'station',
    x: 50, y: 305, width: 80, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'hopper_level', name: '料位',       value: 65, unit: '%',  min: 0,  max: 100, normalMin: 30, normalMax: 90,  trend: [], tau: TAU_HOPPER },
      { id: 'mat_temp',     name: '物料温度',   value: 55, unit: '°C', min: 20, max: 120, normalMin: 50, normalMax: 70,  trend: [], tau: TAU_HOPPER },
    ],
  },
  {
    id: 'DRY-201', name: '物料干燥机', type: 'pump',
    x: 165, y: 305, width: 95, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'dry_temp',     name: '干燥温度', value: 85,  unit: '°C',  min: 40,  max: 130, normalMin: 75, normalMax: 95, trend: [], tau: TAU_TEMP },
      { id: 'moisture_ppm', name: '含水率',   value: 280, unit: 'ppm', min: 0,   max: 1000,normalMin: 0,  normalMax: 400,trend: [], tau: 15 },
    ],
  },
  {
    id: 'MOLD-201', name: '模具', type: 'fixture',
    x: 580, y: 305, width: 90, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'mold_temp',   name: '模具温度', value: 55,    unit: '°C',  min: 20,  max: 130, normalMin: 45,  normalMax: 75,  trend: [], tau: TAU_MOLD },
      { id: 'eject_force', name: '顶出力',   value: 180,   unit: 'kN',  min: 50,  max: 400, normalMin: 150, normalMax: 220, trend: [], tau: TAU_FAST },
      { id: 'cycle_count', name: '合模次数', value: 12450, unit: '次',  min: 0,   max: 999999, normalMin: 0,normalMax: 999999, trend: [], tau: TAU_MID },
    ],
  },
  {
    id: 'INST-201', name: '在线检测仪', type: 'instrument',
    x: 1020, y: 305, width: 90, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'weight_dev',   name: '重量偏差',   value: 0.05, unit: 'g',  min: -2,  max: 2,   normalMin: -0.3, normalMax: 0.3,  trend: [], tau: TAU_QUALITY },
      { id: 'dim_dev',      name: '尺寸偏差',   value: 0.02, unit: 'mm', min: -0.5,max: 0.5, normalMin: -0.05,normalMax: 0.05, trend: [], tau: TAU_QUALITY },
      { id: 'defect_count', name: '外观缺陷数', value: 1,    unit: '个', min: 0,   max: 20,  normalMin: 0,    normalMax: 3,    trend: [], tau: 5 },
    ],
  },
  {
    id: 'ST-202', name: '成品下料区', type: 'station',
    x: 1160, y: 305, width: 90, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'finished_count', name: '成品数量', value: 320, unit: '件', min: 0, max: 9999, normalMin: 0,  normalMax: 9999, trend: [], tau: TAU_MID },
      { id: 'pass_rate',      name: '合格率',   value: 97,  unit: '%',  min: 0, max: 100,  normalMin: 95, normalMax: 100,  trend: [], tau: TAU_QUALITY },
    ],
  },

  // —— 行 3：辅助系统区（加热 / 冷却 / 操作面板） ——
  {
    id: 'HEAT-301', name: '加热筒', type: 'reactor',
    x: 100, y: 420, width: 280, height: 80,
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
    x: 420, y: 425, width: 220, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'chiller_flow',   name: '冷却水流量', value: 18,  unit: 'L/min', min: 0,  max: 40, normalMin: 14, normalMax: 24, trend: [], tau: TAU_FLOW },
      { id: 'water_in_temp',  name: '进水温度',   value: 14,  unit: '°C',    min: 5,  max: 35, normalMin: 10, normalMax: 18, trend: [], tau: 15 },
      { id: 'water_out_temp', name: '出水温度',   value: 22,  unit: '°C',    min: 5,  max: 45, normalMin: 18, normalMax: 28, trend: [], tau: 15 },
    ],
  },
  {
    id: 'HMI-301', name: '操作面板', type: 'instrument',
    x: 1060, y: 425, width: 120, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'program_no',  name: '当前程序号', value: 207, unit: '',  min: 0,  max: 9999, normalMin: 0,  normalMax: 9999, trend: [], inertia: false },
      { id: 'shot_count',  name: '射出计数',   value: 12450, unit: '次', min: 0, max: 999999, normalMin: 0, normalMax: 999999, trend: [], tau: TAU_MID },
      { id: 'speed_override', name: '速度倍率', value: 100, unit: '%', min: 0,  max: 200,  normalMin: 80, normalMax: 120, trend: [], tau: 1 },
    ],
  },

  // —— 行 4：电气控制区 ——
  {
    id: 'CTRL-401', name: '注塑总控柜', type: 'control_box',
    x: 570, y: 590, width: 160, height: 70,
    status: 'normal', template: 'injection',
    parameters: [
      { id: 'main_voltage', name: '主电压',   value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态', value: 1,   unit: '',  min: 0,   max: 1,   normalMin: 1,   normalMax: 1,   trend: [], inertia: false },
      { id: 'panel_temp',   name: '控制柜温度', value: 30,unit: '°C',min: 0,   max: 60,  normalMin: 20,  normalMax: 40,  trend: [], tau: TAU_TEMP },
    ],
  },
];

// 流程管线
// 颜色：物料=灰 / 熔体=橙 / 成品=青 / 冷却=蓝 / 控制=紫 / 加热=红
export const injectionPipelines: Pipeline[] = [
  // —— ① 物料主线 ——
  { id: 'IP-001', from: 'HOP-201', to: 'DRY-201', fromPoint: 'right', toPoint: 'left', medium: '原料', flowRate: 0.6, color: '#94a3b8' },
  { id: 'IP-002', from: 'DRY-201', to: 'IMM-101', fromPoint: 'top',   toPoint: 'bottom', medium: '干料', flowRate: 0.6, color: '#94a3b8' },
  { id: 'IP-003', from: 'DRY-201', to: 'IMM-102', fromPoint: 'right', toPoint: 'bottom', medium: '干料', flowRate: 0.6, color: '#94a3b8' },

  // —— ② 注塑机→模具→检测→下料 ——
  { id: 'IP-101', from: 'IMM-101', to: 'MOLD-201', fromPoint: 'bottom', toPoint: 'left',  medium: '熔体', flowRate: 1.0, color: '#f97316' },
  { id: 'IP-102', from: 'IMM-102', to: 'MOLD-201', fromPoint: 'bottom', toPoint: 'right', medium: '熔体', flowRate: 1.0, color: '#f97316' },
  { id: 'IP-103', from: 'MOLD-201', to: 'INST-201', fromPoint: 'right', toPoint: 'left',  medium: '成品', flowRate: 1.0, color: '#22d3ee' },
  { id: 'IP-104', from: 'INST-201', to: 'ST-202',   fromPoint: 'right', toPoint: 'left',  medium: '合格件', flowRate: 1.0, color: '#22d3ee' },

  // —— ③ 加热筒（HEAT-301 是注塑机的内置料筒，这里画一条提示线） ——
  { id: 'IP-201', from: 'HEAT-301', to: 'IMM-101', fromPoint: 'top',  toPoint: 'bottom', medium: '加热', flowRate: 0.5, color: '#ef4444' },
  { id: 'IP-202', from: 'HEAT-301', to: 'IMM-102', fromPoint: 'right',toPoint: 'bottom', medium: '加热', flowRate: 0.5, color: '#ef4444' },

  // —— ④ 冷却水回路 ——
  { id: 'IP-301', from: 'CHILL-301', to: 'MOLD-201', fromPoint: 'top', toPoint: 'bottom', medium: '冷却水', flowRate: 0.6, color: '#3b82f6' },
  { id: 'IP-302', from: 'CHILL-301', to: 'IMM-101',  fromPoint: 'top', toPoint: 'bottom', medium: '冷却水', flowRate: 0.5, color: '#3b82f6' },
  { id: 'IP-303', from: 'CHILL-301', to: 'IMM-102',  fromPoint: 'right', toPoint: 'bottom', medium: '冷却水', flowRate: 0.5, color: '#3b82f6' },

  // —— ⑤ 控制信号（紫色） ——
  { id: 'IP-401', from: 'CTRL-401', to: 'IMM-101', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'IP-402', from: 'CTRL-401', to: 'IMM-102', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'IP-403', from: 'CTRL-401', to: 'HMI-301', fromPoint: 'right', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const injectionConfig = {
  equipments: injectionEquipments,
  pipelines: injectionPipelines,
};
