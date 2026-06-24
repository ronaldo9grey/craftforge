import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V3 (电解车间等距 2.5D 版)
// 电解铝车间布局 v3：1280×700  *** 聚焦电解车间，删除铸锭机 ***
//
// vs v2 主要变更：
//   ① 删除 CAST-202 铸锭机（属于铸造车间，不在电解车间内）
//   ② 4 槽 → 8 槽，配电解车间真实多槽阵列感
//   ③ 槽体使用专属 type='cell-iso' 等距 2.5D 渲染（菱形顶面 + 阳极棒阵列 + 电解质 + 铝水分层 + 火苗粒子）
//   ④ 新增 CRANE-302 阳极天车横梁（type='crane-iso'，跨整个车间宽度，动画沿 x 移动）
//   ⑤ 布局重新设计为电解车间专属：
//        顶部 y=50~90   厂房屋顶 + 天车横梁（FactoryCanvas 绘制 + CRANE-302 实体）
//        行 1 y=100~200 8 槽等距阵列（每槽 140×100）
//        行 2 y=240~310 车间内辅助：氧化铝料仓 / 打壳下料 / 抬包 / 烟罩进风
//        行 3 y=345~430 电气/工艺辅助：整流变压器 / 阳极天车控制 / 烟气净化 / 真空机组
//        行 4 y=465~535 集控操作 + 母线监控
//        行 5 y=570~650 电气控制柜
//   ⑥ 物流线重新走线：氧化铝从料仓 → 8 槽顶部入；铝水从 8 槽底部 → 抬包

const TAU_FAST = 1;
const TAU_TEMP = 30;
const TAU_LIQUID = 20;
const TAU_CHEM = 25;
const TAU_HF = 15;
const TAU_MECH = 2;
const TAU_MID = 5;

// 单槽参数模板
function cell(id: string, name: string, x: number, y: number,
              voltOffset: number, currOffset: number, tempOffset: number): Equipment {
  return {
    id, name, type: 'cell-iso',
    x, y, width: 140, height: 100,
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
  // 顶部：阳极天车横梁（沿 x 轴移动）
  // 跨整个车间，y=55 高度 35px
  // ============================================================
  {
    id: 'CRANE-302', name: '阳极天车横梁', type: 'crane-iso',
    x: 30, y: 55, width: 1220, height: 40,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'crane_position', name: '横梁位置',   value: 50, unit: '%',  min: 0, max: 100, normalMin: 0, normalMax: 100, trend: [], tau: 5 },
      { id: 'crane_speed',    name: '行走速度',   value: 0.3, unit: 'm/s', min: 0, max: 1, normalMin: 0.1, normalMax: 0.5, trend: [], tau: TAU_MECH },
      { id: 'crane_load',     name: '当前载荷',   value: 0,   unit: 't',   min: 0, max: 25, normalMin: 0, normalMax: 20, trend: [], tau: 1 },
    ],
  },

  // ============================================================
  // 行 1：8 槽等距阵列 (CELL-101 ~ CELL-108)
  // y=110~210，每槽 140×100，间距 13px
  // 起始 x=30，8 槽总宽 = 8×140 + 7×13 = 1211
  // ============================================================
  cell('CELL-101', '#101', 30,    110,  0,    0,    0),
  cell('CELL-102', '#102', 183,   110, -0.05,+2,   -3),
  cell('CELL-103', '#103', 336,   110, +0.03,-1,   +2),
  cell('CELL-104', '#104', 489,   110, +0.02,+3,   +1),
  cell('CELL-105', '#105', 642,   110, -0.02,-2,   +3),
  cell('CELL-106', '#106', 795,   110, +0.05,+1,   -1),
  cell('CELL-107', '#107', 948,   110, -0.03,+2,   +2),
  cell('CELL-108', '#108', 1101,  110, +0.04,-3,   -2),

  // ============================================================
  // 行 2：车间内辅助 y=240~310 (70h)
  // 氧化铝料仓 → 打壳下料器 (左侧)  /  抬包真空 → 出铝口 (右侧)
  // ============================================================
  {
    id: 'AL-201', name: '氧化铝料仓', type: 'station',
    x: 30, y: 240, width: 100, height: 65,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'silo_level',  name: '料仓料位',   value: 70,   unit: '%',    min: 0,    max: 100, normalMin: 30, normalMax: 90, trend: [], tau: 30 },
      { id: 'feed_flow',   name: '下料速率',   value: 1.8,  unit: 'kg/min', min: 0,  max: 5,   normalMin: 1.5, normalMax: 2.4, trend: [], tau: TAU_MID },
      { id: 'fluid_air_p', name: '流化风压',   value: 0.18, unit: 'MPa',  min: 0,    max: 0.5, normalMin: 0.15, normalMax: 0.25, trend: [], tau: 3 },
    ],
  },
  {
    id: 'FEED-201', name: '打壳下料器', type: 'fixture',
    x: 150, y: 250, width: 100, height: 50,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'break_freq',   name: '打壳频次', value: 6,   unit: '次/h', min: 0, max: 20, normalMin: 4, normalMax: 10, trend: [], tau: TAU_MID },
      { id: 'feed_amount',  name: '下料量',   value: 2.5, unit: 'kg/次', min: 0, max: 5,  normalMin: 2, normalMax: 3,   trend: [], tau: TAU_MECH },
      { id: 'cylinder_p',   name: '气缸压力', value: 0.6, unit: 'MPa',   min: 0, max: 1, normalMin: 0.5, normalMax: 0.7, trend: [], tau: TAU_MECH },
    ],
  },
  {
    id: 'POT-202', name: '铝水抬包', type: 'pump',
    x: 1010, y: 245, width: 120, height: 55,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'vacuum_pressure', name: '真空度',   value: -80,  unit: 'kPa',  min: -100, max: 0,   normalMin: -90, normalMax: -65, trend: [], tau: TAU_FAST },
      { id: 'al_metal_temp',   name: '铝水温度', value: 920,  unit: '°C',  min: 700,  max: 1000, normalMin: 880, normalMax: 950, trend: [], tau: TAU_TEMP },
      { id: 'al_metal_qty',    name: '铝水量',   value: 4.2,  unit: 't',    min: 0,    max: 6,   normalMin: 3.5, normalMax: 5.0, trend: [], tau: TAU_LIQUID },
    ],
  },
  {
    id: 'EXIT-202', name: '出铝口', type: 'station',
    x: 1150, y: 240, width: 100, height: 65,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'al_out_count',  name: '日出铝量', value: 12, unit: 't', min: 0, max: 80, normalMin: 8, normalMax: 24, trend: [], tau: TAU_MID },
      { id: 'transport_no',  name: '运次号', value: 4, unit: '次', min: 0, max: 999, normalMin: 0, normalMax: 999, trend: [], inertia: false },
    ],
  },

  // ============================================================
  // 行 3：电气/工艺辅助 y=345~430 (85h)
  // ============================================================
  {
    id: 'TRA-301', name: '整流变压器', type: 'exchanger',
    x: 30, y: 345, width: 220, height: 85,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'primary_voltage',   name: '一次电压', value: 35,   unit: 'kV', min: 0, max: 40, normalMin: 33, normalMax: 37, trend: [], tau: TAU_FAST },
      { id: 'secondary_dc_volt', name: '二次直流电压', value: 1660, unit: 'V', min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'tap_position',      name: '调压档位', value: 18,   unit: '挡',  min: 0, max: 32, normalMin: 14, normalMax: 22, trend: [], inertia: false },
      { id: 'oil_temp',          name: '变压器油温', value: 55, unit: '°C', min: 20, max: 110, normalMin: 40, normalMax: 75, trend: [], tau: TAU_TEMP },
    ],
  },
  {
    id: 'CRA-301', name: '天车控制柜', type: 'control_box',
    x: 275, y: 350, width: 180, height: 80,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'anode_change_count', name: '换极次数', value: 4,   unit: '次/班', min: 0, max: 20, normalMin: 3, normalMax: 8, trend: [], tau: TAU_MID },
      { id: 'residual_weight',    name: '残极重量', value: 230, unit: 'kg',   min: 100, max: 400, normalMin: 200, normalMax: 280, trend: [], tau: TAU_MID },
      { id: 'lift_force',         name: '提升力',   value: 12,  unit: 't',    min: 0, max: 25, normalMin: 8, normalMax: 16, trend: [], tau: TAU_MECH },
    ],
  },
  {
    id: 'FGT-301', name: '烟气净化系统', type: 'pump',
    x: 480, y: 345, width: 280, height: 85,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'hf_conc',      name: 'HF 浓度',      value: 2.1, unit: 'mg/m³', min: 0, max: 15, normalMin: 0,    normalMax: 3,   trend: [], tau: TAU_HF },
      { id: 'flue_temp',    name: '烟气温度',    value: 110, unit: '°C',     min: 60, max: 200, normalMin: 90, normalMax: 130, trend: [], tau: TAU_TEMP },
      { id: 'fan_freq',     name: '引风机频率',  value: 45,  unit: 'Hz',     min: 0,  max: 50, normalMin: 40,  normalMax: 48,  trend: [], tau: 5 },
      { id: 'dust_conc',    name: '出口含尘量',  value: 8,   unit: 'mg/m³', min: 0, max: 50, normalMin: 0,    normalMax: 15,  trend: [], tau: TAU_HF },
    ],
  },
  {
    id: 'CRANE-301', name: '抬包真空机组', type: 'pump',
    x: 785, y: 345, width: 200, height: 85,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'vacuum_pump_p',  name: '真空泵压力', value: -88, unit: 'kPa', min: -100, max: 0, normalMin: -95, normalMax: -75, trend: [], tau: TAU_FAST },
      { id: 'vacuum_motor_a', name: '真空泵电流', value: 35,  unit: 'A',   min: 0,    max: 80, normalMin: 25, normalMax: 50, trend: [], tau: TAU_FAST },
    ],
  },
  {
    id: 'BUS-101', name: '直流母线汇流', type: 'instrument',
    x: 1005, y: 345, width: 245, height: 85,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'bus_voltage', name: '母线电压',  value: 1660, unit: 'V', min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'bus_current', name: '系列总电流', value: 480, unit: 'kA', min: 0, max: 600, normalMin: 470, normalMax: 500, trend: [], tau: TAU_FAST },
      { id: 'bus_temp',    name: '母线温度',  value: 65,  unit: '°C', min: 20, max: 150, normalMin: 50, normalMax: 80, trend: [], tau: TAU_TEMP },
    ],
  },

  // ============================================================
  // 行 4：集控操作 y=465~535 (70h)
  // ============================================================
  {
    id: 'HMI-301', name: '集控操作站', type: 'instrument',
    x: 540, y: 465, width: 200, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'series_no',     name: '系列号',   value: 5, unit: '', min: 1, max: 10, normalMin: 1, normalMax: 10, trend: [], inertia: false },
      { id: 'shift_no',      name: '当前班组', value: 3, unit: '', min: 1, max: 4, normalMin: 1, normalMax: 4, trend: [], inertia: false },
      { id: 'alarm_count',   name: '报警条数', value: 2, unit: '条', min: 0, max: 50, normalMin: 0, normalMax: 5, trend: [], tau: 5 },
    ],
  },

  // ============================================================
  // 行 5：电气控制 y=570~650 (80h)
  // ============================================================
  {
    id: 'CTRL-401', name: '直流母线监控柜', type: 'control_box',
    x: 540, y: 575, width: 200, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'main_voltage', name: '配电电压',  value: 380, unit: 'V', min: 350, max: 410, normalMin: 375, normalMax: 385, trend: [], tau: 0.3 },
      { id: 'comm_status',  name: '通讯状态',  value: 1,   unit: '',  min: 0,   max: 1,   normalMin: 1,   normalMax: 1,   trend: [], inertia: false },
      { id: 'panel_temp',   name: '柜内温度',  value: 32,  unit: '°C',min: 0,   max: 60,  normalMin: 20,  normalMax: 40,  trend: [], tau: TAU_TEMP },
    ],
  },
];

// ============================================================
// 管线
// 配色：氧化铝粉=灰 / 铝水=橙红 / 直流大电流=金黄 / 控制=紫 / 烟气=深绿 / 真空=蓝
// 简化版（8 槽全连会画太密，只代表性连前 4 槽 + 后 4 槽）
// ============================================================
export const aluminumPipelines: Pipeline[] = [
  // ① 氧化铝供料
  { id: 'AP-001', from: 'AL-201',   to: 'FEED-201', fromPoint: 'right', toPoint: 'left',   medium: '氧化铝粉', flowRate: 0.6, color: '#94a3b8' },
  { id: 'AP-002', from: 'FEED-201', to: 'CELL-101', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },
  { id: 'AP-003', from: 'FEED-201', to: 'CELL-104', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },
  { id: 'AP-004', from: 'FEED-201', to: 'CELL-108', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },

  // ② 铝水抽吸（代表性走 4 条）
  { id: 'AP-101', from: 'CELL-101', to: 'POT-202', fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-102', from: 'CELL-104', to: 'POT-202', fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-103', from: 'CELL-108', to: 'POT-202', fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-110', from: 'POT-202',  to: 'EXIT-202', fromPoint: 'right', toPoint: 'left', medium: '运出', flowRate: 1.0, color: '#f97316' },

  // ③ 直流大电流：整流 → 母线 → 4 槽（代表）
  { id: 'AP-201', from: 'TRA-301', to: 'BUS-101',  fromPoint: 'right', toPoint: 'left',  medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-202', from: 'BUS-101', to: 'CELL-104', fromPoint: 'top',   toPoint: 'bottom',medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-203', from: 'BUS-101', to: 'CELL-108', fromPoint: 'top',   toPoint: 'bottom',medium: '直流电', flowRate: 1.5, color: '#facc15' },

  // ④ 烟气净化（4 槽 → 烟气）
  { id: 'AP-401', from: 'CELL-101', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-402', from: 'CELL-104', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-403', from: 'CELL-105', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-404', from: 'CELL-108', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },

  // ⑤ 真空抽吸
  { id: 'AP-501', from: 'CRANE-301', to: 'POT-202', fromPoint: 'top', toPoint: 'left', medium: '真空', flowRate: 0.5, color: '#3b82f6' },

  // ⑥ 控制信号
  { id: 'AP-601', from: 'CTRL-401', to: 'HMI-301', fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-602', from: 'CTRL-401', to: 'TRA-301', fromPoint: 'left', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-603', from: 'CTRL-401', to: 'CRA-301', fromPoint: 'top',  toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const aluminumConfig = {
  equipments: aluminumEquipments,
  pipelines: aluminumPipelines,
};
