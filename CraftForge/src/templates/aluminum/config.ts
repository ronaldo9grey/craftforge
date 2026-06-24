import type { Equipment, Pipeline } from '@/types';

// VERSION: 2026-06-23-V4 (电解车间 2.5D 深度还原版)
// 电解铝车间布局 v4：1280×700
//
// vs v3 主要变更：
//   ① 8 槽 → 2 槽（左 #101 大型主槽 460×220 + 右 #102 副槽 460×220），重点呈现真实电解槽细节
//   ② 删除独立设备 BUS-101 / EXIT-202 / CRANE-301，参数合并：
//        - BUS-101 母线电压/电流/温度    → 整合到 TRA-301 (因母线就是整流出线)
//        - CRANE-301 真空泵压力/电流     → 合并到 POT-202 抬包
//        - EXIT-202 出铝量/运次          → 合并到 POT-202 抬包
//   ③ 槽体新增参数：集烟罩抽气负压（cover_pressure）反映烟气净化在槽顶的工作
//   ④ 阴极母线作为视觉元素绘制在 cell-iso 内部底层，不再独立设备
//   ⑤ 天车下方"挂着的红色抬包" 作为天车整体的一部分（在 crane-iso 里绘制）
//   ⑥ 布局：
//        顶部 y= 20~50  厂房屋顶 (FactoryCanvas 绘制)
//        天车 y= 55~95  CRANE-302 横梁（含挂抬包）
//        行 1 y=110~330  2 槽阵列（每槽 460×220 大尺寸）+ 集烟罩 + 阴极母线全部画在内
//        行 2 y=355~430  车间内辅助：氧化铝料仓 / 打壳下料 / 抬包 / 烟气净化主机
//        行 3 y=450~525  电气辅助：整流变压器 / 天车控制柜 / 集控操作站
//        行 4 y=565~660  电气控制柜

const TAU_FAST = 1;
const TAU_TEMP = 30;
const TAU_LIQUID = 20;
const TAU_CHEM = 25;
const TAU_HF = 15;
const TAU_MECH = 2;
const TAU_MID = 5;

// 单槽参数模板（每槽 14 个参数）
function cell(id: string, name: string, x: number, y: number,
              voltOffset: number, currOffset: number, tempOffset: number): Equipment {
  return {
    id, name, type: 'cell-iso',
    x, y, width: 460, height: 220,
    status: 'normal', template: 'aluminum',
    parameters: [
      // 基础电气
      { id: 'cell_voltage',  name: '槽电压',     value: 4.15 + voltOffset, unit: 'V',   min: 3.5, max: 60,  normalMin: 4.0, normalMax: 4.3, trend: [], tau: TAU_FAST },
      { id: 'series_current',name: '系列电流',   value: 480 + currOffset,  unit: 'kA',  min: 0,   max: 600, normalMin: 470, normalMax: 500, trend: [], tau: TAU_FAST },
      // 电解质 + 铝水
      { id: 'bath_temp',     name: '电解质温度', value: 955 + tempOffset,  unit: '°C',  min: 850, max: 1050, normalMin: 945, normalMax: 965, trend: [], tau: TAU_TEMP },
      { id: 'al_height',     name: '铝水高度',   value: 20,  unit: 'cm',     min: 5,   max: 40, normalMin: 18, normalMax: 22, trend: [], tau: TAU_LIQUID },
      { id: 'bath_height',   name: '电解质高度', value: 20,  unit: 'cm',     min: 5,   max: 40, normalMin: 18, normalMax: 22, trend: [], tau: TAU_LIQUID },
      // 化学
      { id: 'mol_ratio',     name: '分子比',     value: 2.4, unit: '',       min: 1.8, max: 3.5, normalMin: 2.3, normalMax: 2.5, trend: [], tau: TAU_CHEM },
      { id: 'alumina_conc',  name: '氧化铝浓度', value: 2.5, unit: 'wt%',   min: 0,   max: 8,  normalMin: 1.8, normalMax: 3.5, trend: [], tau: TAU_CHEM },
      // 几何
      { id: 'anode_distance',name: '极距',       value: 4.5, unit: 'cm',     min: 1,   max: 8,  normalMin: 4.0, normalMax: 5.0, trend: [], tau: 8 },
      // 性能
      { id: 'current_eff',   name: '电流效率',   value: 94,  unit: '%',     min: 60,  max: 100, normalMin: 92, normalMax: 96, trend: [], tau: TAU_CHEM },
      { id: 'noise_level',   name: '槽噪声',     value: 25,  unit: 'mV',    min: 0,   max: 200, normalMin: 0,  normalMax: 50, trend: [], tau: TAU_MID },
      // 新增（合并自其他设备）
      { id: 'cover_pressure',name: '集烟罩负压', value: -150,unit: 'Pa',    min: -400,max: 0,  normalMin: -250, normalMax: -100, trend: [], tau: 5 },
      { id: 'bus_voltage',   name: '阴极母线电压', value: 1660+voltOffset*10, unit: 'V',  min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'bus_temp',      name: '阴极母线温度', value: 65 + tempOffset, unit: '°C', min: 20, max: 150, normalMin: 50, normalMax: 80, trend: [], tau: TAU_TEMP },
      { id: 'anode_count',   name: '阳极块数',   value: 26,  unit: '块',    min: 20, max: 32, normalMin: 24, normalMax: 28, trend: [], inertia: false },
    ],
  };
}

export const aluminumEquipments: Equipment[] = [
  // ============================================================
  // 顶部：阳极天车横梁 + 挂抬包（沿 x 轴慢速移动）
  // ============================================================
  {
    id: 'CRANE-302', name: '阳极天车横梁', type: 'crane-iso',
    x: 30, y: 55, width: 1220, height: 45,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'crane_position', name: '横梁位置',   value: 50, unit: '%',  min: 0, max: 100, normalMin: 0, normalMax: 100, trend: [], tau: 5 },
      { id: 'crane_speed',    name: '行走速度',   value: 0.05, unit: 'm/s', min: 0, max: 0.5, normalMin: 0.02, normalMax: 0.15, trend: [], tau: TAU_MECH },
      { id: 'crane_load',     name: '当前载荷',   value: 0,   unit: 't',   min: 0, max: 25, normalMin: 0, normalMax: 20, trend: [], tau: 1 },
      { id: 'ladle_temp',     name: '抬包温度',   value: 900, unit: '°C',  min: 600, max: 1000, normalMin: 850, normalMax: 950, trend: [], tau: TAU_TEMP },
    ],
  },

  // ============================================================
  // 行 1：2 槽阵列（每槽 460×220）
  // x=70~530 / x=600~1060 / 中间 70px 间隔为换极通道
  // ============================================================
  cell('CELL-101', '#101 主槽', 70,  110,  0,    0,    0),
  cell('CELL-102', '#102 副槽', 750, 110, -0.05, +2,   -3),

  // ============================================================
  // 行 2：车间内辅助 y=355~430 (75h)
  // ============================================================
  {
    id: 'AL-201', name: '氧化铝料仓', type: 'station',
    x: 30, y: 355, width: 110, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'silo_level',  name: '料仓料位',   value: 70,   unit: '%',    min: 0,    max: 100, normalMin: 30, normalMax: 90, trend: [], tau: 30 },
      { id: 'feed_flow',   name: '下料速率',   value: 1.8,  unit: 'kg/min', min: 0,  max: 5,   normalMin: 1.5, normalMax: 2.4, trend: [], tau: TAU_MID },
      { id: 'fluid_air_p', name: '流化风压',   value: 0.18, unit: 'MPa',  min: 0,    max: 0.5, normalMin: 0.15, normalMax: 0.25, trend: [], tau: 3 },
    ],
  },
  {
    id: 'FEED-201', name: '打壳下料器', type: 'fixture',
    x: 160, y: 365, width: 110, height: 55,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'break_freq',   name: '打壳频次', value: 6,   unit: '次/h', min: 0, max: 20, normalMin: 4, normalMax: 10, trend: [], tau: TAU_MID },
      { id: 'feed_amount',  name: '下料量',   value: 2.5, unit: 'kg/次', min: 0, max: 5,  normalMin: 2, normalMax: 3,   trend: [], tau: TAU_MECH },
      { id: 'cylinder_p',   name: '气缸压力', value: 0.6, unit: 'MPa',   min: 0, max: 1, normalMin: 0.5, normalMax: 0.7, trend: [], tau: TAU_MECH },
    ],
  },
  // 铝水抬包（合并真空泵和出铝口参数）
  {
    id: 'POT-202', name: '铝水抬包', type: 'pump',
    x: 290, y: 360, width: 180, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      // 抬包本身参数
      { id: 'vacuum_pressure', name: '真空度',       value: -80,  unit: 'kPa',  min: -100, max: 0,   normalMin: -90, normalMax: -65, trend: [], tau: TAU_FAST },
      { id: 'al_metal_temp',   name: '铝水温度',     value: 920,  unit: '°C',   min: 700,  max: 1000, normalMin: 880, normalMax: 950, trend: [], tau: TAU_TEMP },
      { id: 'al_metal_qty',    name: '铝水量',       value: 4.2,  unit: 't',    min: 0,    max: 6,    normalMin: 3.5, normalMax: 5.0, trend: [], tau: TAU_LIQUID },
      // 真空泵参数（合并自 CRANE-301）
      { id: 'vacuum_pump_p',   name: '真空泵压力',   value: -88,  unit: 'kPa',  min: -100, max: 0,    normalMin: -95, normalMax: -75, trend: [], tau: TAU_FAST },
      { id: 'vacuum_motor_a',  name: '真空泵电流',   value: 35,   unit: 'A',    min: 0,    max: 80,   normalMin: 25, normalMax: 50, trend: [], tau: TAU_FAST },
      // 出铝口参数（合并自 EXIT-202）
      { id: 'al_out_count',    name: '日出铝量',     value: 12,   unit: 't',    min: 0,    max: 80,   normalMin: 8,  normalMax: 24, trend: [], tau: TAU_MID },
      { id: 'transport_no',    name: '运次号',       value: 4,    unit: '次',   min: 0,    max: 999,  normalMin: 0,  normalMax: 999, trend: [], inertia: false },
    ],
  },
  {
    id: 'FGT-301', name: '烟气净化系统', type: 'pump',
    x: 490, y: 360, width: 280, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'hf_conc',      name: 'HF 浓度',      value: 2.1, unit: 'mg/m³', min: 0, max: 15, normalMin: 0,    normalMax: 3,   trend: [], tau: TAU_HF },
      { id: 'flue_temp',    name: '烟气温度',     value: 110, unit: '°C',     min: 60, max: 200, normalMin: 90, normalMax: 130, trend: [], tau: TAU_TEMP },
      { id: 'fan_freq',     name: '引风机频率',   value: 45,  unit: 'Hz',     min: 0,  max: 50, normalMin: 40,  normalMax: 48,  trend: [], tau: 5 },
      { id: 'dust_conc',    name: '出口含尘量',   value: 8,   unit: 'mg/m³', min: 0, max: 50, normalMin: 0,    normalMax: 15,  trend: [], tau: TAU_HF },
    ],
  },
  {
    id: 'TRA-301', name: '整流变压器', type: 'exchanger',
    x: 790, y: 360, width: 220, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'primary_voltage',   name: '一次电压',     value: 35,   unit: 'kV', min: 0, max: 40, normalMin: 33, normalMax: 37, trend: [], tau: TAU_FAST },
      { id: 'secondary_dc_volt', name: '二次直流电压', value: 1660, unit: 'V', min: 0, max: 2000, normalMin: 1620, normalMax: 1700, trend: [], tau: TAU_FAST },
      { id: 'tap_position',      name: '调压档位',     value: 18,   unit: '挡', min: 0, max: 32, normalMin: 14, normalMax: 22, trend: [], inertia: false },
      { id: 'oil_temp',          name: '变压器油温',   value: 55,   unit: '°C', min: 20, max: 110, normalMin: 40, normalMax: 75, trend: [], tau: TAU_TEMP },
      // 母线参数（合并自 BUS-101，因母线就是整流出线）
      { id: 'bus_current',       name: '母线总电流',   value: 480, unit: 'kA', min: 0, max: 600, normalMin: 470, normalMax: 500, trend: [], tau: TAU_FAST },
    ],
  },
  {
    id: 'HMI-301', name: '集控操作站', type: 'instrument',
    x: 1030, y: 360, width: 220, height: 70,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'series_no',     name: '系列号',   value: 5, unit: '', min: 1, max: 10, normalMin: 1, normalMax: 10, trend: [], inertia: false },
      { id: 'shift_no',      name: '当前班组', value: 3, unit: '', min: 1, max: 4, normalMin: 1, normalMax: 4, trend: [], inertia: false },
      { id: 'alarm_count',   name: '报警条数', value: 2, unit: '条', min: 0, max: 50, normalMin: 0, normalMax: 5, trend: [], tau: 5 },
    ],
  },

  // ============================================================
  // 行 3：电气辅助 y=450~525 (75h)  — 天车控制
  // ============================================================
  {
    id: 'CRA-301', name: '天车控制柜', type: 'control_box',
    x: 540, y: 450, width: 200, height: 75,
    status: 'normal', template: 'aluminum',
    parameters: [
      { id: 'anode_change_count', name: '换极次数', value: 4,   unit: '次/班', min: 0, max: 20, normalMin: 3, normalMax: 8, trend: [], tau: TAU_MID },
      { id: 'residual_weight',    name: '残极重量', value: 230, unit: 'kg',   min: 100, max: 400, normalMin: 200, normalMax: 280, trend: [], tau: TAU_MID },
      { id: 'lift_force',         name: '提升力',   value: 12,  unit: 't',    min: 0, max: 25, normalMin: 8, normalMax: 16, trend: [], tau: TAU_MECH },
    ],
  },

  // ============================================================
  // 行 4：电气控制 y=565~660 (95h)
  // ============================================================
  {
    id: 'CTRL-401', name: '直流母线监控柜', type: 'control_box',
    x: 540, y: 575, width: 200, height: 80,
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
// 简化：2 槽场景，只画必要的连接线
// ============================================================
export const aluminumPipelines: Pipeline[] = [
  // 物料：料仓 → 下料器 → 2 槽
  { id: 'AP-001', from: 'AL-201',   to: 'FEED-201', fromPoint: 'right', toPoint: 'left',   medium: '氧化铝粉', flowRate: 0.6, color: '#94a3b8' },
  { id: 'AP-002', from: 'FEED-201', to: 'CELL-101', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },
  { id: 'AP-003', from: 'FEED-201', to: 'CELL-102', fromPoint: 'top',   toPoint: 'bottom', medium: '下料', flowRate: 0.5, color: '#94a3b8' },

  // 铝水：2 槽 → 抬包
  { id: 'AP-101', from: 'CELL-101', to: 'POT-202', fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },
  { id: 'AP-102', from: 'CELL-102', to: 'POT-202', fromPoint: 'bottom', toPoint: 'top', medium: '铝水', flowRate: 1.0, color: '#f97316' },

  // 整流 → 槽（直流，金黄）
  { id: 'AP-201', from: 'TRA-301', to: 'CELL-101', fromPoint: 'top', toPoint: 'bottom', medium: '直流电', flowRate: 1.5, color: '#facc15' },
  { id: 'AP-202', from: 'TRA-301', to: 'CELL-102', fromPoint: 'top', toPoint: 'bottom', medium: '直流电', flowRate: 1.5, color: '#facc15' },

  // 烟气：2 槽 → 烟气净化
  { id: 'AP-401', from: 'CELL-101', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },
  { id: 'AP-402', from: 'CELL-102', to: 'FGT-301', fromPoint: 'bottom', toPoint: 'top', medium: '烟气', flowRate: 0.7, color: '#16a34a' },

  // 控制
  { id: 'AP-601', from: 'CTRL-401', to: 'HMI-301', fromPoint: 'top',   toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-602', from: 'CTRL-401', to: 'TRA-301', fromPoint: 'top',   toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'AP-603', from: 'CTRL-401', to: 'CRA-301', fromPoint: 'top',   toPoint: 'top', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const aluminumConfig = {
  equipments: aluminumEquipments,
  pipelines: aluminumPipelines,
};
