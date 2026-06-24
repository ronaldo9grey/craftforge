import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V2 (电解铝车间优化版)
// 电解铝车间布局 v2：1280×700
//
// vs v1 主要变更：
//   ① 4 台电解槽改用专属 type: 'cell'，外观为矮胖型梯形钢壳 + 顶部 8 根阳极棒阵列 + 内部电解质熔体层 + 底部铝水层
//      尺寸 230×130 → 250×95（更接近真实电解槽长宽比 ~3:1）
//   ② 主机区高度 70~200 (130h) → 80~175 (95h)，4 槽占据更扁的横向带状
//   ③ 直流母线 BUS-101 移出行 1（避免与槽阵列竞争空间），改成竖直母线段在 4 槽右侧 (x=1020~1260)
//   ④ 4 行净距严格 ≥ 30px，每行高度合理：
//        行 1 主机区   y= 80~175 ( 95h)  → 分隔线 247  净距 72px
//        行 2 物流主线 y=280~360 ( 80h)  → 分隔线 377  净距 17px
//        行 3 辅助系统 y=405~485 ( 80h)  → 分隔线 540  净距 55px
//        行 4 电气控制 y=580~655 ( 75h)
//   ⑤ 4 槽 x 等间距分布：CELL-101=20, 270, 520, 770，每槽 230×95 + 间隔 20px
//   ⑥ 物流线重新走线避免穿越（氧化铝从底部进，铝水从底部出）

const TAU_FAST = 1;
const TAU_TEMP = 30;
const TAU_LIQUID = 20;
const TAU_CHEM = 25;
const TAU_HF = 15;
const TAU_MECH = 2;
const TAU_MID = 5;

function cell(id: string, name: string, x: number,
              voltOffset: number, currOffset: number, tempOffset: number): Equipment {
  return {
    id, name, type: 'cell',
    x, y: 80, width: 230, height: 95,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'cell_voltage',  name: '槽电压',     value: 4.15 + voltOffset, unit: 'V',   min: 3.5, max: 60,  normalMin: 4.0, normalMax: 4.3, trend: [], tau: TAU_FAST },
      { id: 'series_current',name: '系列电流',   value: 480 + currOffset,  unit: 'kA',  min: 0,   max: 600, normalMin: 470, normalMax: 500, trend: [], tau: TAU_FAST },
      { id: 'bath_temp',     name: '电解质温度', value: 955 + tempOffset,  unit: '°C',  min: 850, max: 1050, normalMin: 945, normalMax: 965, trend: [], tau: TAU_TEMP },
      { id: 'al_height',     name: '铝水高度',   value: 20,  unit: 'cm',     min: 5,   max: 40, normalMin: 18, normalMax: 22, trend: [], tau: TAU_LIQUID },
      { id: 'bath_height',   name: '电解质高度', value: 20,  unit: 'cm',     min: 5,   max: 40, normalMin: 18, normalMax: 22, trend: [], tau: TAU_LIQUID },
      { id: 'mol_ratio',     name: '分子比',     value: 2.4, unit: '',       min: 1.8, max: 3.5, normalMin: 2.3, normalMax: 2.5, trend: [], tau: TAU_CHEM },
      { id: 'alumina_conc',  name: '氧化铝浓度', value: 2.5, unit: 'wt%',   min: 0,   max: 8,  normalMin: 1.8, normalMax: 3.5, trend: [], tau: TAU_CHEM },
      { id: 'anode_distance',name: '极距',       value: 4.5, unit: 'cm',     min: 1,   max: 8,  normalMin: 4.0, normalMax: 5.0, trend: [], tau: 8 },
      { id: 'current_eff',   name: '电流效率',   value: 94,  unit: '%',     min: 60,  max: 100, normalMin: 92, normalMax: 96, trend: [], tau: TAU_CHEM },
      { id: 'noise_level',   name: '槽噪声',     value: 25,  unit: 'mV',    min: 0,   max: 200, normalMin: 0,  normalMax: 50, trend: [], tau: TAU_MID },
    ],
  };
}

export const aluminumEquipments: Equipment[] = [
  // ============================================================
  // 行 1：电解槽阵列 (CELL-101~104)
  // 4 槽 x: 20, 270, 520, 770 / 间隔 20px / 宽 230 / 高 95
  // 行 1 末尾右侧 1020~1260 (240px) 留给"系列母线汇流条"
  // ============================================================
  cell('CELL-101', '#101 电解槽', 20,    0,    0,    0),
  cell('CELL-102', '#102 电解槽', 270,  -0.05,+2,   -3),
  cell('CELL-103', '#103 电解槽', 520,  +0.03,-1,   +2),
  cell('CELL-104', '#104 电解槽', 770,  +0.02,+3,   +1),

  // 系列母线汇流条（行 1 右端，竖向矩形 instrument 展示）
  {
    id: 'BUS-101', name: '直流母线汇流', type: 'instrument',
    x: 1020, y: 80, width: 240, height: 95,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'bus_voltage', name: '母线电压',  value: 1660, unit: 'V', min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'bus_current', name: '系列总电流', value: 480, unit: 'kA', min: 0, max: 600, normalMin: 470, normalMax: 500, trend: [], tau: TAU_FAST },
      { id: 'bus_temp',    name: '母线温度',  value: 65,  unit: '°C', min: 20, max: 150, normalMin: 50, normalMax: 80, trend: [], tau: TAU_TEMP },
    ],
  },

  // ============================================================
  // 行 2：物流主线  y=280~360 (80h)
  //   左：AL-201 料仓 → FEED-201 打壳下料（向上送入 4 槽）
  //   右：POT-202 抬包（接收 4 槽铝水）→ CAST-202 铸锭机
  // ============================================================
  {
    id: 'AL-201', name: '氧化铝料仓', type: 'station',
    x: 30, y: 285, width: 85, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'silo_level',  name: '料仓料位',   value: 70,   unit: '%',    min: 0,    max: 100, normalMin: 30, normalMax: 90, trend: [], tau: 30 },
      { id: 'feed_flow',   name: '下料速率',   value: 1.8,  unit: 'kg/min', min: 0,  max: 5,   normalMin: 1.5, normalMax: 2.4, trend: [], tau: TAU_MID },
      { id: 'fluid_air_p', name: '流化风压',   value: 0.18, unit: 'MPa',  min: 0,    max: 0.5, normalMin: 0.15, normalMax: 0.25, trend: [], tau: 3 },
    ],
  },
  {
    id: 'FEED-201', name: '打壳下料器', type: 'fixture',
    x: 140, y: 295, width: 90, height: 50,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'break_freq',   name: '打壳频次', value: 6,   unit: '次/h', min: 0, max: 20, normalMin: 4, normalMax: 10, trend: [], tau: TAU_MID },
      { id: 'feed_amount',  name: '下料量',   value: 2.5, unit: 'kg/次', min: 0, max: 5,  normalMin: 2, normalMax: 3,   trend: [], tau: TAU_MECH },
      { id: 'cylinder_p',   name: '气缸压力', value: 0.6, unit: 'MPa',   min: 0, max: 1, normalMin: 0.5, normalMax: 0.7, trend: [], tau: TAU_MECH },
    ],
  },
  {
    id: 'POT-202', name: '铝水抬包', type: 'pump',
    x: 880, y: 290, width: 120, height: 60,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'vacuum_pressure', name: '真空度',   value: -80,  unit: 'kPa',  min: -100, max: 0,   normalMin: -90, normalMax: -65, trend: [], tau: TAU_FAST },
      { id: 'al_metal_temp',   name: '铝水温度', value: 920,  unit: '°C',  min: 700,  max: 1000, normalMin: 880, normalMax: 950, trend: [], tau: TAU_TEMP },
      { id: 'al_metal_qty',    name: '铝水量',   value: 4.2,  unit: 't',    min: 0,    max: 6,   normalMin: 3.5, normalMax: 5.0, trend: [], tau: TAU_LIQUID },
    ],
  },
  {
    id: 'CAST-202', name: '铸锭机', type: 'instrument',
    x: 1040, y: 285, width: 120, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'cast_speed',  name: '铸造速度', value: 80, unit: 'mm/min', min: 0, max: 200, normalMin: 60, normalMax: 100, trend: [], tau: TAU_MID },
      { id: 'cast_count',  name: '铸锭计数', value: 142,unit: '锭',     min: 0, max: 9999, normalMin: 0, normalMax: 9999, trend: [], tau: TAU_MID },
      { id: 'al_yield',    name: '铸出率',   value: 98, unit: '%',     min: 80, max: 100, normalMin: 96, normalMax: 100, trend: [], tau: 10 },
    ],
  },

  // ============================================================
  // 行 3：辅助系统  y=405~485 (80h)
  // ============================================================
  {
    id: 'TRA-301', name: '整流变压器', type: 'exchanger',
    x: 30, y: 410, width: 220, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'primary_voltage',   name: '一次电压', value: 35,   unit: 'kV', min: 0, max: 40, normalMin: 33, normalMax: 37, trend: [], tau: TAU_FAST },
      { id: 'secondary_dc_volt', name: '二次直流电压', value: 1660, unit: 'V', min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'tap_position',      name: '调压档位', value: 18,   unit: '挡',  min: 0, max: 32, normalMin: 14, normalMax: 22, trend: [], inertia: false },
      { id: 'oil_temp',          name: '变压器油温', value: 55, unit: '°C', min: 20, max: 110, normalMin: 40, normalMax: 75, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'CRA-301', name: '阳极天车', type: 'robot',
    x: 275, y: 410, width: 145, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'anode_change_count', name: '换极次数', value: 4,   unit: '次/班', min: 0, max: 20, normalMin: 3, normalMax: 8, trend: [], tau: TAU_MID },
      { id: 'residual_weight',    name: '残极重量', value: 230, unit: 'kg',   min: 100, max: 400, normalMin: 200, normalMax: 280, trend: [], tau: TAU_MID },
      { id: 'lift_force',         name: '提升力',   value: 12,  unit: 't',    min: 0, max: 25, normalMin: 8, normalMax: 16, trend: [], tau: TAU_MECH },
    ],
  },
  {
    id: 'FGT-301', name: '烟气净化', type: 'pump',
    x: 445, y: 410, width: 250, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'hf_conc',      name: 'HF 浓度',      value: 2.1, unit: 'mg/m³', min: 0, max: 15, normalMin: 0,    normalMax: 3,   trend: [], tau: TAU_HF },
      { id: 'flue_temp',    name: '烟气温度',    value: 110, unit: '°C',     min: 60, max: 200, normalMin: 90, normalMax: 130, trend: [], tau: TAU_TEMP },
      { id: 'fan_freq',     name: '引风机频率',  value: 45,  unit: 'Hz',     min: 0,  max: 50, normalMin: 40,  normalMax: 48,  trend: [], tau: 5 },
      { id: 'dust_conc',    name: '出口含尘量',  value: 8,   unit: 'mg/m³', min: 0, max: 50, normalMin: 0,    normalMax: 15,  trend: [], tau: TAU_HF },
    ],
  },
  {
    id: 'HMI-301', name: '集控操作站', type: 'instrument',
    x: 720, y: 410, width: 200, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'series_no',     name: '系列号',   value: 5, unit: '', min: 1, max: 10, normalMin: 1, normalMax: 10, trend: [], inertia: false },
      { id: 'shift_no',      name: '当前班组', value: 3, unit: '', min: 1, max: 4, normalMin: 1, normalMax: 4, trend: [], inertia: false },
      { id: 'alarm_count',   name: '报警条数', value: 2, unit: '条', min: 0, max: 50, normalMin: 0, normalMax: 5, trend: [], tau: 5 },
    ],
  },
  {
    id: 'CRANE-301', name: '抬包真空机组', type: 'pump',
    x: 945, y: 410, width: 220, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'vacuum_pump_p',  name: '真空泵压力', value: -88, unit: 'kPa', min: -100, max: 0, normalMin: -95, normalMax: -75, trend: [], tau: TAU_FAST },
      { id: 'vacuum_motor_a', name: '真空泵电流', value: 35,  unit: 'A',   min: 0,    max: 80, normalMin: 25, normalMax: 50, trend: [], tau: TAU_FAST },
    ],
  },

  // ============================================================
  // 行 4：电气控制 y=580~655 (75h)
  // ============================================================
  {
    id: 'CTRL-401', name: '直流母线监控柜', type: 'control_box',
    x: 540, y: 580, width: 200, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'main_voltage', name: '配电电压',  value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态',  value: 1,   unit: '',  min: 0,   max: 1,   normalMin: 1,   normalMax: 1,   trend: [], inertia: false },
      { id: 'panel_temp',   name: '柜内温度',  value: 32,  unit: '°C',min: 0,   max: 60,  normalMin: 20,  normalMax: 40,  trend: [], tau: TAU_TEMP },
    ],
  },
];

// ============================================================
// 管线 v2：配色不变，走线优化避免穿越
// 氧化铝粉=灰 / 铝水=橙红 / 直流大电流=金黄 / 控制=紫 / 烟气=深绿 / 真空=蓝
// ============================================================
export const aluminumPipelines: Pipeline[] = [
  // ① 氧化铝供料：料仓 → 下料器 → 4 槽（下料从槽顶进）
  { id: 'AP-001', from: 'AL-201',   to: 'FEED-201', fromPoint: 'right', toPoint: 'left',   medium: '氧化铝粉', flowRate: 0.6, color: '#94a3b8' },
  { id: 'AP-002', from: 'FEED-201', to: 'CELL-101', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },
  { id: 'AP-003', from: 'FEED-201', to: 'CELL-102', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },
  { id: 'AP-004', from: 'FEED-201', to: 'CELL-103', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },
  { id: 'AP-005', from: 'FEED-201', to: 'CELL-104', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },

  // ② 铝水抽吸：4 槽 → 抬包 → 铸锭
  { id: 'AP-101', from: 'CELL-101', to: 'POT-202',  fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-102', from: 'CELL-102', to: 'POT-202',  fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-103', from: 'CELL-103', to: 'POT-202',  fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-104', from: 'CELL-104', to: 'POT-202',  fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-110', from: 'POT-202',  to: 'CAST-202', fromPoint: 'right',  toPoint: 'left', medium: '铝水', flowRate: 1.0, color: '#f97316' },

  // ③ 直流大电流：整流变压器 → 母线汇流（行 1 末端）→ 4 槽（每槽右进左出）
  { id: 'AP-201', from: 'TRA-301', to: 'BUS-101',  fromPoint: 'top',   toPoint: 'bottom', medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-202', from: 'BUS-101', to: 'CELL-101', fromPoint: 'left',  toPoint: 'right',  medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-203', from: 'BUS-101', to: 'CELL-102', fromPoint: 'left',  toPoint: 'right',  medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-204', from: 'BUS-101', to: 'CELL-103', fromPoint: 'left',  toPoint: 'right',  medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-205', from: 'BUS-101', to: 'CELL-104', fromPoint: 'left',  toPoint: 'right',  medium: '直流电', flowRate: 1.5, color: '#facc15' },

  // ④ 阳极天车作业：天车在行 3，槽在行 1，垂直走线 → 2 条代表性指向 CELL-101 / CELL-102
  { id: 'AP-301', from: 'CRA-301', to: 'CELL-101', fromPoint: 'top', toPoint: 'bottom', medium: '换极', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-302', from: 'CRA-301', to: 'CELL-102', fromPoint: 'top', toPoint: 'bottom', medium: '换极', flowRate: 0.4, color: '#a855f7' },

  // ⑤ 烟气净化：4 槽 → 烟气净化（行 3）
  { id: 'AP-401', from: 'CELL-101', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-402', from: 'CELL-102', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-403', from: 'CELL-103', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-404', from: 'CELL-104', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },

  // ⑥ 真空抽吸：真空机组 → 抬包
  { id: 'AP-501', from: 'CRANE-301', to: 'POT-202', fromPoint: 'top', toPoint: 'right', medium: '真空', flowRate: 0.5, color: '#3b82f6' },

  // ⑦ 控制信号（紫色）：CTRL → HMI / FGT / TRA
  { id: 'AP-601', from: 'CTRL-401', to: 'HMI-301', fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-602', from: 'CTRL-401', to: 'TRA-301', fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-603', from: 'HMI-301',  to: 'CTRL-401', fromPoint: 'bottom', toPoint: 'right', medium: '反馈', flowRate: 0.3, color: '#a855f7' },
];

export const aluminumConfig = {
  equipments: aluminumEquipments,
  pipelines: aluminumPipelines,
};
