import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V7 (烟气走屋顶 + 班组任务台放大 + 单排阳极)
// 电解铝车间布局 v7：1280×700
//
// vs v6 主要变更：
//   ① 烟气净化 FGT-301 不再独立显示在车间内（真实情况是在屋顶烟道 → 厂房外净化车间）
//      FGT 参数保留（仍可点击参数面板查看），但视觉上由"屋顶水平烟道 + 右上角小烟囱"代替
//      FGT 位置移到画面外（x=-500）作隐藏处理；参数仍受 dynamics 驱动
//   ② 班组任务台 280×60 → 580×120（任务列表更清晰、与槽控柜同宽）
//   ③ 天车 240s → 600s（10 分钟一周期，真实换极节奏）
//   ④ 阳极改单排 22 块（侧视图正确）+ 顶部金黄阳极母线粗条
//   ⑤ 布局重新调整以适应任务台放大
//
// 布局：
//   y= 20~50   厂房屋顶
//   y= 55~95   CRANE-302 天车横梁（600s 周期）
//   y=100~110  氧化铝输送管道
//   y=120~410  2 槽阵列 CELL-101/102 (每槽 580×290)
//   y=425~485  2 台槽控柜 POT-CTRL-101/102 (每柜 580×60)
//   y=500~515  阴极母线（FactoryCanvas 画）
//   y=525~585  控制层左：整流变压器 + 总控柜
//   y=525~645  控制层右：班组任务台（放大 580×120）

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
  // 控制层：左侧整流变压器 + 中间总控柜（行 1） / 右侧班组任务台（占 2 行高）
  // ============================================================
  {
    id: 'TRA-301', name: '整流变压器', type: 'exchanger',
    x: 30, y: 530, width: 280, height: 60,
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
  // 烟气净化 FGT-301：参数保留，位置移到画面外（视觉由 FactoryCanvas 屋顶烟道代替）
  {
    id: 'FGT-301', name: '烟气净化（屋顶烟道 → 净化车间）', type: 'pump',
    x: -500, y: -500, width: 1, height: 1,
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
    x: 340, y: 530, width: 580, height: 120,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'shift_no',          name: '当前班组',   value: 3, unit: '', min: 1, max: 4, normalMin: 1, normalMax: 4, trend: [], inertia: false },
      { id: 'series_no',         name: '系列号',     value: 5, unit: '', min: 1, max: 10, normalMin: 1, normalMax: 10, trend: [], inertia: false },
      { id: 'task_count',        name: '今日任务数', value: 8, unit: '条', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], inertia: false },
      { id: 'done_count',        name: '已完成数',   value: 3, unit: '条', min: 0, max: 30, normalMin: 0, normalMax: 30, trend: [], inertia: false },
      { id: 'global_alarm',      name: '全场报警数', value: 2, unit: '条', min: 0, max: 50, normalMin: 0, normalMax: 5, trend: [], tau: 5 },
      { id: 'vacuum_pressure',   name: '抬包真空度', value: -80,  unit: 'kPa',  min: -100, max: 0,   normalMin: -90, normalMax: -65, trend: [], tau: TAU_FAST },
      { id: 'al_metal_temp',     name: '抬包铝水温', value: 920,  unit: '°C',  min: 700,  max: 1000, normalMin: 880, normalMax: 950, trend: [], tau: TAU_TEMP },
      { id: 'al_out_count',      name: '日出铝量',   value: 12,   unit: 't',    min: 0, max: 80, normalMin: 8, normalMax: 24, trend: [], tau: TAU_MID },
    ],
  },

  // ============================================================
  // 总控柜（行 2 左侧）
  // ============================================================
  {
    id: 'CTRL-401', name: '电解车间总控柜', type: 'control_box',
    x: 60, y: 600, width: 220, height: 55,
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

  // 烟气：2 槽 → FGT 屋顶汇流（由 FactoryCanvas 画的屋顶烟道代替，不画 Pipeline）

  // 槽控 → 槽
  { id: 'AP-501', from: 'POT-CTRL-101', to: 'CELL-101', fromPoint: 'top', toPoint: 'bottom', medium: '槽控', flowRate: 0.3, color: '#a855f7' },
  { id: 'AP-502', from: 'POT-CTRL-102', to: 'CELL-102', fromPoint: 'top', toPoint: 'bottom', medium: '槽控', flowRate: 0.3, color: '#a855f7' },

  // 控制：总控柜 → 各设备
  { id: 'AP-601', from: 'CTRL-401', to: 'HMI-301',  fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-602', from: 'CTRL-401', to: 'TRA-301',  fromPoint: 'left', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const aluminumConfig = {
  equipments: aluminumEquipments,
  pipelines: aluminumPipelines,
};
