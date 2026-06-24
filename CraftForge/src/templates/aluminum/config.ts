import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V6 (600 kA 电解槽聚焦版)
// 电解铝车间布局 v6：1280×700
//
// 设计哲学：聚焦电解车间 + 突出大型 600 kA 电解槽细节
//
// vs v5 主要变更：
//   ① 4 槽 → 2 槽（每槽 580×290 大尺寸，充分展示 600 kA 槽细节）
//   ② 阳极 26 块 → 44 块（600 kA 标准），三段式视觉：铝导杆 + 钢爪 + 碳阳极块
//   ③ 控制层设备缩小：TRA/FGT/HMI 从 380x85 → 280x60 紧凑电气柜样式
//   ④ HMI-301 改名"班组任务台" type='task-board'（工位办公屏样式）
//   ⑤ 槽控柜 2 台（POT-CTRL-101/102），与槽宽对齐 580×60
//
// 布局：
//   y= 20~50   厂房屋顶
//   y= 55~95   CRANE-302 天车横梁 + 红色抬包
//   y=100~110  氧化铝输送管道（2 分支）
//   y=120~410  2 槽阵列 CELL-101/102 (每槽 580×290)
//   y=425~485  2 台槽控柜 POT-CTRL-101/102 (每柜 580×60)
//   y=500~510  阴极母线（FactoryCanvas 画）
//   y=540~600  控制层：TRA-301 / FGT-301 / HMI-301 (3 台 × 280×60)
//   y=620~675  CTRL-401 总控柜 (200×55)

const TAU_FAST = 1;
const TAU_TEMP = 30;
const TAU_LIQUID = 20;
const TAU_CHEM = 25;
const TAU_HF = 15;
const TAU_MECH = 2;
const TAU_MID = 5;

function cell(id: string, name: string, x: number): Equipment {
  return {
    id, name, type: 'cell-iso',
    x, y: 120, width: 580, height: 290,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'cell_voltage',  name: '槽电压',     value: 4.15, unit: 'V',   min: 3.5, max: 60,  normalMin: 4.0, normalMax: 4.3, trend: [], tau: TAU_FAST },
      { id: 'series_current',name: '系列电流',   value: 600,  unit: 'kA',  min: 0,   max: 700, normalMin: 580, normalMax: 620, trend: [], tau: TAU_FAST },
      { id: 'bath_temp',     name: '电解质温度', value: 955,  unit: '°C',  min: 850, max: 1050, normalMin: 945, normalMax: 965, trend: [], tau: TAU_TEMP },
      { id: 'al_height',     name: '铝水高度',   value: 22,  unit: 'cm',     min: 5,   max: 40, normalMin: 18, normalMax: 24, trend: [], tau: TAU_LIQUID },
      { id: 'bath_height',   name: '电解质高度', value: 20,  unit: 'cm',     min: 5,   max: 40, normalMin: 18, normalMax: 22, trend: [], tau: TAU_LIQUID },
      { id: 'mol_ratio',     name: '分子比',     value: 2.4, unit: '',       min: 1.8, max: 3.5, normalMin: 2.3, normalMax: 2.5, trend: [], tau: TAU_CHEM },
      { id: 'alumina_conc',  name: '氧化铝浓度', value: 2.5, unit: 'wt%',   min: 0,   max: 8,  normalMin: 1.8, normalMax: 3.5, trend: [], tau: TAU_CHEM },
      { id: 'anode_distance',name: '极距',       value: 4.5, unit: 'cm',     min: 1,   max: 8,  normalMin: 4.0, normalMax: 5.0, trend: [], tau: 8 },
      { id: 'current_eff',   name: '电流效率',   value: 94,  unit: '%',     min: 60,  max: 100, normalMin: 92, normalMax: 96, trend: [], tau: TAU_CHEM },
      { id: 'noise_level',   name: '槽噪声',     value: 25,  unit: 'mV',    min: 0,   max: 200, normalMin: 0,  normalMax: 50, trend: [], tau: TAU_MID },
      { id: 'anode_count',   name: '阳极块数',   value: 44,  unit: '块',    min: 40, max: 48, normalMin: 42, normalMax: 46, trend: [], inertia: false },
      { id: 'break_freq',    name: '打壳频次',   value: 6,   unit: '次/h', min: 0, max: 20, normalMin: 4, normalMax: 10, trend: [], tau: TAU_MID },
      { id: 'feed_amount',   name: '单次下料量', value: 2.5, unit: 'kg/次', min: 0, max: 5, normalMin: 2, normalMax: 3, trend: [], tau: TAU_MECH },
    ],
  };
}

function potCtrl(id: string, name: string, x: number): Equipment {
  return {
    id, name, type: 'pot-ctrl',
    x, y: 425, width: 580, height: 60,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'plc_load',     name: 'PLC 负载',  value: 35, unit: '%', min: 0, max: 100, normalMin: 20, normalMax: 70, trend: [], tau: 3 },
      { id: 'comm_status',  name: '通讯状态',  value: 1,  unit: '',  min: 0, max: 1,   normalMin: 1,  normalMax: 1,  trend: [], inertia: false },
      { id: 'cabinet_temp', name: '柜内温度',  value: 32, unit: '°C',min: 0, max: 60,  normalMin: 20, normalMax: 45, trend: [], tau: TAU_TEMP },
      { id: 'ctrl_mode',    name: '控制模式',  value: 1,  unit: '',  min: 0, max: 2,   normalMin: 1,  normalMax: 1,  trend: [], inertia: false },
      { id: 'alarm_count',  name: '累积报警',  value: 0,  unit: '条',min: 0, max: 100, normalMin: 0,  normalMax: 5,  trend: [], tau: 5 },
    ],
  };
}

export const aluminumEquipments: Equipment[] = [
  // ============================================================
  // 顶部：阳极天车横梁（240s 一周期慢速移动）
  // ============================================================
  {
    id: 'CRANE-302', name: '阳极天车横梁', type: 'crane-iso',
    x: 30, y: 55, width: 1220, height: 45,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'crane_position', name: '横梁位置',   value: 50, unit: '%',  min: 0, max: 100, normalMin: 0, normalMax: 100, trend: [], tau: 5 },
      { id: 'crane_speed',    name: '行走速度',   value: 0.03, unit: 'm/s', min: 0, max: 0.3, normalMin: 0.02, normalMax: 0.10, trend: [], tau: TAU_MECH },
      { id: 'crane_load',     name: '当前载荷',   value: 0,   unit: 't',   min: 0, max: 25, normalMin: 0, normalMax: 20, trend: [], tau: 1 },
      { id: 'ladle_temp',     name: '抬包温度',   value: 900, unit: '°C',  min: 600, max: 1000, normalMin: 850, normalMax: 950, trend: [], tau: TAU_TEMP },
    ],
  },

  // ============================================================
  // 行 1：2 槽阵列  CELL-101 / CELL-102
  // 每槽 580×290，间隔 40px，起始 x=30，终止 x=30+580+40+580=1230 ≤ 1280
  // ============================================================
  cell('CELL-101', '#101 电解槽 (600 kA)', 30),
  cell('CELL-102', '#102 电解槽 (600 kA)', 650),

  // ============================================================
  // 行 2：2 台槽控柜 POT-CTRL-101/102 (紧贴槽下方，与槽宽对齐)
  // ============================================================
  potCtrl('POT-CTRL-101', '#101 槽控柜', 30),
  potCtrl('POT-CTRL-102', '#102 槽控柜', 650),

  // ============================================================
  // 控制层：紧凑电气柜样式（每台 280×60，3 台并排 + 居中）
  // 共 3 台 × 280 + 2 间隔 30 = 900，居中放 x=190~1090
  // ============================================================
  {
    id: 'TRA-301', name: '整流变压器', type: 'exchanger',
    x: 190, y: 540, width: 280, height: 60,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'primary_voltage',   name: '一次电压',     value: 35,   unit: 'kV', min: 0, max: 40, normalMin: 33, normalMax: 37, trend: [], tau: TAU_FAST },
      { id: 'secondary_dc_volt', name: '二次直流电压', value: 1660, unit: 'V', min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'tap_position',      name: '调压档位',     value: 18,   unit: '挡', min: 0, max: 32, normalMin: 14, normalMax: 22, trend: [], inertia: false },
      { id: 'oil_temp',          name: '变压器油温',   value: 55,   unit: '°C', min: 20, max: 110, normalMin: 40, normalMax: 75, trend: [], tau: TAU_TEMP },
      { id: 'bus_current',       name: '直流母线电流', value: 600,  unit: 'kA', min: 0, max: 700, normalMin: 580, normalMax: 620, trend: [], tau: TAU_FAST },
      { id: 'bus_temp',          name: '直流母线温度', value: 65,   unit: '°C', min: 20, max: 150, normalMin: 50, normalMax: 80, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'FGT-301', name: '烟气净化', type: 'pump',
    x: 500, y: 540, width: 280, height: 60,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'hf_conc',      name: 'HF 浓度',      value: 2.1, unit: 'mg/m³', min: 0, max: 15, normalMin: 0,    normalMax: 3,   trend: [], tau: TAU_HF },
      { id: 'flue_temp',    name: '烟气温度',     value: 110, unit: '°C',     min: 60, max: 200, normalMin: 90, normalMax: 130, trend: [], tau: TAU_TEMP },
      { id: 'fan_freq',     name: '引风机频率',   value: 45,  unit: 'Hz',     min: 0,  max: 50, normalMin: 40,  normalMax: 48,  trend: [], tau: 5 },
      { id: 'dust_conc',    name: '出口含尘量',   value: 8,   unit: 'mg/m³', min: 0, max: 50, normalMin: 0,    normalMax: 15,  trend: [], tau: TAU_HF },
      { id: 'cover_pressure', name: '集烟罩负压', value: -150, unit: 'Pa',    min: -400, max: 0, normalMin: -250, normalMax: -100, trend: [], tau: 5 },
    ],
  },
  {
    id: 'HMI-301', name: '班组任务台', type: 'task-board',
    x: 810, y: 540, width: 280, height: 60,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'shift_no',          name: '当前班组',   value: 3, unit: '', min: 1, max: 4, normalMin: 1, normalMax: 4, trend: [], inertia: false },
      { id: 'series_no',         name: '系列号',     value: 5, unit: '', min: 1, max: 10, normalMin: 1, normalMax: 10, trend: [], inertia: false },
      { id: 'task_count',        name: '今日任务数', value: 8, unit: '条', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], inertia: false },
      { id: 'done_count',        name: '已完成数',   value: 3, unit: '条', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], inertia: false },
      { id: 'global_alarm',      name: '全场报警数', value: 2, unit: '条', min: 0, max: 50, normalMin: 0, normalMax: 5, trend: [], tau: 5 },
      // 铝水抬包参数（操作上由班组任务台协调）
      { id: 'vacuum_pressure',   name: '抬包真空度', value: -80,  unit: 'kPa',  min: -100, max: 0,   normalMin: -90, normalMax: -65, trend: [], tau: TAU_FAST },
      { id: 'al_metal_temp',     name: '抬包铝水温', value: 920,  unit: '°C',  min: 700,  max: 1000, normalMin: 880, normalMax: 950, trend: [], tau: TAU_TEMP },
      { id: 'al_out_count',      name: '日出铝量',   value: 12,   unit: 't',    min: 0, max: 80, normalMin: 8, normalMax: 24, trend: [], tau: TAU_MID },
    ],
  },

  // ============================================================
  // 总控柜
  // ============================================================
  {
    id: 'CTRL-401', name: '电解车间总控柜', type: 'control_box',
    x: 540, y: 620, width: 200, height: 55,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'main_voltage', name: '配电电压',  value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态',  value: 1,   unit: '',  min: 0,   max: 1,   normalMin: 1,   normalMax: 1,   trend: [], inertia: false },
      { id: 'panel_temp',   name: '柜内温度',  value: 32,  unit: '°C',min: 0,   max: 60,  normalMin: 20,  normalMax: 40,  trend: [], tau: TAU_TEMP },
      { id: 'anode_change_count', name: '换极次数', value: 4,   unit: '次/班', min: 0, max: 20, normalMin: 3, normalMax: 8, trend: [], tau: TAU_MID },
      { id: 'lift_force',         name: '天车提升力', value: 12, unit: 't',   min: 0, max: 25, normalMin: 8, normalMax: 16, trend: [], tau: TAU_MECH },
    ],
  },
];

// ============================================================
// 管线
// ============================================================
export const aluminumPipelines: Pipeline[] = [
  // 直流电：整流 → 2 槽
  { id: 'AP-201', from: 'TRA-301', to: 'CELL-101', fromPoint: 'top', toPoint: 'bottom', medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-202', from: 'TRA-301', to: 'CELL-102', fromPoint: 'top', toPoint: 'bottom', medium: '直流电', flowRate: 1.5, color: '#facc15' },

  // 烟气：2 槽 → 烟气净化
  { id: 'AP-401', from: 'CELL-101', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-402', from: 'CELL-102', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },

  // 槽控 → 槽
  { id: 'AP-501', from: 'POT-CTRL-101', to: 'CELL-101', fromPoint: 'top', toPoint: 'bottom', medium: '槽控', flowRate: 0.3, color: '#a855f7' },
  { id: 'AP-502', from: 'POT-CTRL-102', to: 'CELL-102', fromPoint: 'top', toPoint: 'bottom', medium: '槽控', flowRate: 0.3, color: '#a855f7' },

  // 控制：总控柜 → 各设备
  { id: 'AP-601', from: 'CTRL-401', to: 'HMI-301',  fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-602', from: 'CTRL-401', to: 'TRA-301',  fromPoint: 'left', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-603', from: 'CTRL-401', to: 'FGT-301',  fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const aluminumConfig = {
  equipments: aluminumEquipments,
  pipelines: aluminumPipelines,
};
