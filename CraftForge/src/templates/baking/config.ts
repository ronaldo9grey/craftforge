import type { Equipment, Pipeline } from '@/types';

// =============================================================
// 阳极焙烧炉车间 · 1280x700 布局 v1
//
// 工艺流向（从左到右，单向）：
//   生阳极装炉 → 焙烧炉阵列（4 个炉室）→ 烟道汇流 → 抽烟机 → 烟气净化 → 烟囱
//                     ↑
//              燃料气调压站
//
// 区域：
//   y=  0~ 80   厂房屋顶 + 工艺流程横幅
//   y=130~280   焙烧炉阵列（4 个炉室横向排列）
//   y=300~390   烟道汇流 + 抽烟机 + 烟气净化
//   y=410~480   燃料气调压站 + 焦床料仓
//   y=510~640   控制层：温控屏 + 班组任务台
// =============================================================

export const bakingEquipments: Equipment[] = [

  // ========== 行 1：4 个焙烧炉室（核心主力，每个炉室是 1 个独立 reactor）==========

  // ① 装炉口 / 1 号炉室（升温阶段 500°C）
  {
    id: 'BAKE-K1',
    name: '1号炉室·升温',
    type: 'reactor',
    x: 40, y: 155, width: 220, height: 150,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'room_temp',  name: '炉室温度', value: 520,  unit: '°C', min: 300, max: 1200, normalMin: 480, normalMax: 560, trend: [], tau: 30 },
      { id: 'flue_temp_l',name: '左火道温度',value: 530, unit: '°C', min: 300, max: 1200, normalMin: 490, normalMax: 570, trend: [], tau: 25 },
      { id: 'flue_temp_r',name: '右火道温度',value: 510, unit: '°C', min: 300, max: 1200, normalMin: 490, normalMax: 570, trend: [], tau: 25 },
      { id: 'gas_flow',   name: '燃料气流量',value: 75,  unit: 'm³/h', min: 0, max: 200, normalMin: 60, normalMax: 90, trend: [], tau: 5 },
      { id: 'days_in',    name: '已焙烧天数',value: 5,    unit: '天', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], tau: 60 },
    ],
  },

  // ② 2 号炉室（升温后期 850°C）
  {
    id: 'BAKE-K2',
    name: '2号炉室·升温',
    type: 'reactor',
    x: 280, y: 155, width: 220, height: 150,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'room_temp',  name: '炉室温度', value: 870,  unit: '°C', min: 300, max: 1200, normalMin: 830, normalMax: 920, trend: [], tau: 30 },
      { id: 'flue_temp_l',name: '左火道温度',value: 885, unit: '°C', min: 300, max: 1200, normalMin: 845, normalMax: 935, trend: [], tau: 25 },
      { id: 'flue_temp_r',name: '右火道温度',value: 865, unit: '°C', min: 300, max: 1200, normalMin: 845, normalMax: 935, trend: [], tau: 25 },
      { id: 'gas_flow',   name: '燃料气流量',value: 105, unit: 'm³/h', min: 0, max: 200, normalMin: 95, normalMax: 120, trend: [], tau: 5 },
      { id: 'days_in',    name: '已焙烧天数',value: 11,   unit: '天', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], tau: 60 },
    ],
  },

  // ③ 3 号炉室（恒温阶段 1100°C - 核心阶段）
  {
    id: 'BAKE-K3',
    name: '3号炉室·恒温',
    type: 'reactor',
    x: 520, y: 155, width: 220, height: 150,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'room_temp',  name: '炉室温度', value: 1100, unit: '°C', min: 300, max: 1200, normalMin: 1085, normalMax: 1115, trend: [], tau: 30 },
      { id: 'flue_temp_l',name: '左火道温度',value: 1115, unit: '°C', min: 300, max: 1200, normalMin: 1095, normalMax: 1125, trend: [], tau: 25 },
      { id: 'flue_temp_r',name: '右火道温度',value: 1095, unit: '°C', min: 300, max: 1200, normalMin: 1095, normalMax: 1125, trend: [], tau: 25 },
      { id: 'gas_flow',   name: '燃料气流量',value: 130, unit: 'm³/h', min: 0, max: 200, normalMin: 120, normalMax: 145, trend: [], tau: 5 },
      { id: 'days_in',    name: '已焙烧天数',value: 17,   unit: '天', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], tau: 60 },
    ],
  },

  // ④ 4 号炉室（降温阶段 600°C）
  {
    id: 'BAKE-K4',
    name: '4号炉室·降温',
    type: 'reactor',
    x: 760, y: 155, width: 220, height: 150,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'room_temp',  name: '炉室温度', value: 620,  unit: '°C', min: 100, max: 1200, normalMin: 580, normalMax: 680, trend: [], tau: 30 },
      { id: 'flue_temp_l',name: '左火道温度',value: 635, unit: '°C', min: 100, max: 1200, normalMin: 595, normalMax: 695, trend: [], tau: 25 },
      { id: 'flue_temp_r',name: '右火道温度',value: 615, unit: '°C', min: 100, max: 1200, normalMin: 595, normalMax: 695, trend: [], tau: 25 },
      { id: 'gas_flow',   name: '燃料气流量',value: 30,  unit: 'm³/h', min: 0, max: 200, normalMin: 25, normalMax: 40, trend: [], tau: 5 },
      { id: 'days_in',    name: '已焙烧天数',value: 24,   unit: '天', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], tau: 60 },
    ],
  },

  // ⑤ 出炉位
  {
    id: 'OUT-K5',
    name: '5号出炉位',
    type: 'station',
    x: 1000, y: 155, width: 240, height: 150,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'finished_count', name: '待出炉块数', value: 32,   unit: '块', min: 0, max: 200, normalMin: 0,    normalMax: 80, trend: [], tau: 60 },
      { id: 'out_temp',       name: '熟阳极温度', value: 210,  unit: '°C', min: 50, max: 400, normalMin: 180, normalMax: 250, trend: [], tau: 20 },
      { id: 'electric_res',   name: '电阻率',     value: 55.0, unit: 'μΩ·m', min: 40, max: 80, normalMin: 50,  normalMax: 60, trend: [], tau: 30 },
    ],
  },

  // ========== 行 2：抽烟系统（焙烧炉的"肺"） ==========

  // ⑥ 烟道汇流箱
  {
    id: 'FLUE-301',
    name: '烟道汇流箱',
    type: 'exchanger',
    x: 40, y: 360, width: 320, height: 85,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'flue_pressure', name: '烟道负压',  value: -280, unit: 'Pa',   min: -800, max: 0,    normalMin: -400, normalMax: -200, trend: [], tau: 5 },
      { id: 'flue_temp',     name: '汇流烟温',  value: 220,  unit: '°C',  min: 100,  max: 500,  normalMin: 200,  normalMax: 280,  trend: [], tau: 15 },
    ],
  },

  // ⑦ 抽烟机
  {
    id: 'FAN-401',
    name: '抽烟机组',
    type: 'pump',
    x: 380, y: 360, width: 200, height: 85,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'fan_speed',    name: '抽烟机转速', value: 1380, unit: 'rpm',  min: 800, max: 1800, normalMin: 1350, normalMax: 1500, trend: [], tau: 4 },
      { id: 'fan_current',  name: '电机电流',   value: 95,   unit: 'A',    min: 0,   max: 200,  normalMin: 80,   normalMax: 110,  trend: [], tau: 3 },
      { id: 'suction_flow', name: '抽气流量',   value: 8200, unit: 'm³/h', min: 0,   max: 15000,normalMin: 7500, normalMax: 9500, trend: [], tau: 5 },
    ],
  },

  // ⑧ 烟气净化器
  {
    id: 'PUR-501',
    name: '烟气净化器',
    type: 'reactor',
    x: 600, y: 360, width: 220, height: 85,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'inlet_dust',   name: '入口含尘', value: 250, unit: 'mg/m³', min: 0, max: 1000, normalMin: 150, normalMax: 350, trend: [], tau: 10 },
      { id: 'outlet_dust',  name: '出口含尘', value: 12,  unit: 'mg/m³', min: 0, max: 100,  normalMin: 0,   normalMax: 20,  trend: [], tau: 10 },
      { id: 'fluoride',     name: '出口氟含量', value: 3.2,unit: 'mg/m³', min: 0, max: 20,   normalMin: 0,   normalMax: 5,   trend: [], tau: 12 },
    ],
  },

  // ⑨ 烟囱
  {
    id: 'STACK-601',
    name: '排放烟囱',
    type: 'fractionator',
    x: 840, y: 360, width: 100, height: 85,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'stack_temp',  name: '排放温度', value: 165, unit: '°C',    min: 80,  max: 300, normalMin: 140, normalMax: 200, trend: [], tau: 20 },
      { id: 'stack_o2',    name: '出口氧含量',value: 8.5, unit: '%',    min: 0,   max: 21,  normalMin: 6,   normalMax: 10,  trend: [], tau: 8 },
    ],
  },

  // ========== 行 3：辅助供给系统 ==========

  // ⑪ 燃料气调压站
  {
    id: 'GAS-701',
    name: '燃料气调压站',
    type: 'valve',
    x: 40, y: 490, width: 240, height: 60,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'gas_pressure', name: '燃料气压力', value: 10.2, unit: 'kPa',  min: 0, max: 25, normalMin: 8,   normalMax: 12,  trend: [], tau: 4 },
      { id: 'gas_temp',     name: '燃料气温度', value: 28,   unit: '°C',   min: -10,max: 80, normalMin: 15, normalMax: 40, trend: [], tau: 30 },
      { id: 'gas_calorific',name: '热值',       value: 8400, unit: 'kJ/m³',min: 0, max: 12000, normalMin: 8000, normalMax: 9000, trend: [], tau: 60 },
    ],
  },

  // ⑫ 焦床料仓
  {
    id: 'COKE-801',
    name: '焦床填料仓',
    type: 'reactor',
    x: 300, y: 490, width: 220, height: 60,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'coke_level',     name: '焦床料位',   value: 65,  unit: '%',  min: 0, max: 100, normalMin: 50, normalMax: 90, trend: [], tau: 20 },
      { id: 'coke_thickness', name: '装炉焦床厚度',value: 100, unit: 'mm', min: 50, max: 200, normalMin: 80, normalMax: 120, trend: [], tau: 30 },
    ],
  },

  // ⑬ 炉室温度曲线监控屏
  {
    id: 'HMI-901',
    name: '炉室温度曲线监控屏',
    type: 'exchanger',
    x: 540, y: 490, width: 400, height: 60,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'curve_target',   name: '目标曲线',  value: 1100, unit: '°C',  min: 0, max: 1500, normalMin: 0, normalMax: 1500, trend: [], tau: 1 },
      { id: 'curve_actual',   name: '实际偏差',  value: 5,    unit: '°C',  min: 0, max: 100,  normalMin: 0, normalMax: 20,   trend: [], tau: 1 },
    ],
  },

  // ========== 行 4：控制层 ==========

  // ⑭ 火道温度对比看板
  {
    id: 'HMI-902',
    name: '火道温度对比',
    type: 'exchanger',
    x: 40, y: 575, width: 480, height: 95,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'max_dev',  name: '最大温差',  value: 12, unit: '°C', min: 0,  max: 100, normalMin: 0, normalMax: 20, trend: [], tau: 1 },
      { id: 'avg_dev',  name: '平均温差',  value: 6,  unit: '°C', min: 0,  max: 50,  normalMin: 0, normalMax: 12, trend: [], tau: 1 },
    ],
  },

  // ⑮ 班组任务台
  {
    id: 'HMI-903',
    name: '班组任务台',
    type: 'task-board',
    x: 540, y: 575, width: 700, height: 95,
    status: 'normal', template: 'baking',
    parameters: [
      { id: 'shift_target', name: '当班指标', value: 80,   unit: '块', min: 0, max: 200, normalMin: 70, normalMax: 100, trend: [], tau: 1 },
      { id: 'shift_actual', name: '已出炉',   value: 32,   unit: '块', min: 0, max: 200, normalMin: 0,  normalMax: 200, trend: [], tau: 1 },
      { id: 'rejected',     name: '不合格数', value: 2,    unit: '块', min: 0, max: 50,  normalMin: 0,  normalMax: 5,   trend: [], tau: 1 },
      { id: 'qc_ratio',     name: '合格率',   value: 94.5, unit: '%',  min: 0, max: 100, normalMin: 92, normalMax: 100, trend: [], tau: 1 },
    ],
  },
];

// =============================================================
// 物料/能流连接
//   红色 = 高温烟气
//   橙色 = 燃料气
//   紫色 = 净化后排放气
//   灰色 = 控制信号
// =============================================================
export const bakingPipelines: Pipeline[] = [
  // 4 炉室 → 烟道汇流（4 条进汇流箱）
  { id: 'BP-101', from: 'BAKE-K1', to: 'FLUE-301',  fromPoint: 'bottom', toPoint: 'top',    medium: '炉室烟气', flowRate: 0.5, color: '#dc2626' },
  { id: 'BP-102', from: 'BAKE-K2', to: 'FLUE-301',  fromPoint: 'bottom', toPoint: 'top',    medium: '炉室烟气', flowRate: 0.5, color: '#dc2626' },
  { id: 'BP-103', from: 'BAKE-K3', to: 'FLUE-301',  fromPoint: 'bottom', toPoint: 'top',    medium: '炉室烟气', flowRate: 0.6, color: '#dc2626' },
  { id: 'BP-104', from: 'BAKE-K4', to: 'FLUE-301',  fromPoint: 'bottom', toPoint: 'top',    medium: '炉室烟气', flowRate: 0.4, color: '#dc2626' },
  // 汇流箱 → 抽烟机
  { id: 'BP-201', from: 'FLUE-301', to: 'FAN-401',  fromPoint: 'right',  toPoint: 'left',   medium: '负压抽气', flowRate: 0.6, color: '#dc2626' },
  // 抽烟机 → 净化器
  { id: 'BP-202', from: 'FAN-401',  to: 'PUR-501',  fromPoint: 'right',  toPoint: 'left',   medium: '热烟气',  flowRate: 0.6, color: '#ea580c' },
  // 净化器 → 烟囱
  { id: 'BP-203', from: 'PUR-501',  to: 'STACK-601',fromPoint: 'right',  toPoint: 'left',   medium: '净化烟气',flowRate: 0.6, color: '#a855f7' },
  // 燃料气调压站 → 4 炉室（合并表达）
  { id: 'BP-301', from: 'GAS-701',  to: 'BAKE-K1',  fromPoint: 'top',    toPoint: 'bottom', medium: '燃料气',  flowRate: 0.3, color: '#fbbf24' },
  { id: 'BP-302', from: 'GAS-701',  to: 'BAKE-K2',  fromPoint: 'top',    toPoint: 'bottom', medium: '燃料气',  flowRate: 0.3, color: '#fbbf24' },
  { id: 'BP-303', from: 'GAS-701',  to: 'BAKE-K3',  fromPoint: 'top',    toPoint: 'bottom', medium: '燃料气',  flowRate: 0.4, color: '#fbbf24' },
  // 焦床仓 → 炉室填料（一条代表）
  { id: 'BP-401', from: 'COKE-801', to: 'BAKE-K2',  fromPoint: 'top',    toPoint: 'bottom', medium: '焦粉填料',flowRate: 0.2, color: '#94a3b8' },
];
