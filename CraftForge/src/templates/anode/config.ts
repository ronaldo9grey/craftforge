import type { Equipment, Pipeline } from '@/types';

// =============================================================
// 阳极振压成型车间 · 1280x700 布局 v2（按工艺流横向铺开）
//
// 工艺流向（从左到右，单向）：
//   配料控制柜 CFG → 糊料保温缸 PASTE → 称量给料斗 WGT → 振压成型机 FORM → 生阳极冷却台 COOL
//                         ↑                                       ↑
//                    模具加热站 MHT                            真空泵机组 VAC
//
// 区域：
//   y=  0~ 60   厂房屋顶 + 排气罩（FactoryCanvas 画）
//   y= 80~120   工艺流标签栏
//   y=130~360   核心工艺主轴：PASTE → WGT → FORM-201 → COOL（4 台横向）
//   y=380~460   辅助设备区：CFG(左) | MHT(中左) | VAC(中右)
//   y=480~620   控制层：糊料温控屏（左） + 班组任务台（右）
// =============================================================

export const anodeEquipments: Equipment[] = [

  // ========== 行 1 工艺主轴（横向工艺流）==========

  // ① 糊料保温缸（最左侧，竖立罐体；高度从 210 → 185 让 "辅助系统" 标签有空间）
  {
    id: 'PASTE-101',
    name: '糊料保温缸',
    type: 'reactor',
    x: 40, y: 155, width: 170, height: 185,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'paste_temp',  name: '糊料温度', value: 150, unit: '°C',  min: 100, max: 200, normalMin: 145, normalMax: 155, trend: [], tau: 8 },
      { id: 'paste_level', name: '料位',     value: 75,  unit: '%',   min: 0,   max: 100, normalMin: 50,  normalMax: 85,  trend: [], tau: 30 },
      { id: 'pitch_ratio', name: '沥青配比', value: 15.0,unit: 'wt%', min: 10,  max: 20,  normalMin: 14.0,normalMax: 16.0,trend: [], tau: 20 },
      { id: 'mixer_speed', name: '搅拌转速', value: 12,  unit: 'rpm', min: 0,   max: 30,  normalMin: 10,  normalMax: 15,  trend: [], tau: 2 },
    ],
  },

  // ② 称量给料斗（在糊料缸和成型机之间；按比例 190→168 同步缩小）
  {
    id: 'WGT-401',
    name: '称量给料斗',
    type: 'reactor',
    x: 240, y: 165, width: 130, height: 168,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'feed_weight', name: '单块加料量', value: 1080, unit: 'kg', min: 800, max: 1200, normalMin: 1070, normalMax: 1095, trend: [], tau: 2 },
      { id: 'feed_dev',    name: '重量偏差',   value: 0.8,  unit: '%',  min: 0,   max: 10,   normalMin: 0,    normalMax: 2,    trend: [], tau: 10 },
    ],
  },

  // ③ 振压成型机（中央主角，专属渲染 form-press）
  {
    id: 'FORM-201',
    name: '振压成型机',
    type: 'form-press',  // ⭐ 专属类型 — 由 EquipmentRenderer 定制渲染
    x: 400, y: 150, width: 380, height: 210,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'press_force', name: '振压压力',   value: 1280, unit: 't',     min: 500,  max: 1500, normalMin: 1250, normalMax: 1300, trend: [], tau: 1 },
      { id: 'press_time',  name: '振压时间',   value: 95,   unit: 's',     min: 30,   max: 180,  normalMin: 90,   normalMax: 110,  trend: [], tau: 1 },
      { id: 'vib_freq',    name: '振动频率',   value: 50,   unit: 'Hz',    min: 10,   max: 80,   normalMin: 45,   normalMax: 55,   trend: [], tau: 1 },
      { id: 'mold_temp',   name: '模具温度',   value: 138,  unit: '°C',    min: 30,   max: 200,  normalMin: 130,  normalMax: 145,  trend: [], tau: 15 },
      { id: 'block_dens',  name: '生阳极密度', value: 1.62, unit: 'g/cm³', min: 1.3,  max: 1.8,  normalMin: 1.58, normalMax: 1.65, trend: [], tau: 10 },
      { id: 'cycle_count', name: '本班块数',   value: 35,   unit: '块',    min: 0,    max: 999,  normalMin: 0,    normalMax: 999,  trend: [], tau: 60 },
    ],
  },

  // ④ 生阳极冷却台（右侧，传送辊道；高度同主轴中线对齐）
  {
    id: 'COOL-301',
    name: '生阳极冷却台',
    type: 'conveyor',
    x: 810, y: 210, width: 430, height: 90,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'cool_speed',    name: '冷却传送速度', value: 0.05, unit: 'm/s', min: 0,    max: 0.2, normalMin: 0.03, normalMax: 0.08, trend: [], tau: 5 },
      { id: 'cool_temp_in',  name: '入口温度',     value: 220,  unit: '°C',  min: 100,  max: 350, normalMin: 200,  normalMax: 250,  trend: [], tau: 15 },
      { id: 'cool_temp_out', name: '出口温度',     value: 60,   unit: '°C',  min: 20,   max: 150, normalMin: 50,   normalMax: 80,   trend: [], tau: 20 },
      { id: 'queue_len',     name: '待冷却数',     value: 4,    unit: '块',  min: 0,    max: 20,  normalMin: 0,    normalMax: 12,   trend: [], tau: 30 },
    ],
  },

  // ========== 行 2 辅助设备区（一字排开在主轴下方）==========

  // ⑤ 配料控制柜（最左下，对应糊料缸）
  {
    id: 'CFG-701',
    name: '配料控制柜',
    type: 'pot-ctrl',
    x: 40, y: 405, width: 170, height: 60,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'coke_ratio', name: '石油焦粒度配比', value: 30, unit: 'wt%', min: 15, max: 50, normalMin: 28, normalMax: 32, trend: [], tau: 30 },
      { id: 'fine_ratio', name: '细粒配比',       value: 35, unit: 'wt%', min: 20, max: 50, normalMin: 33, normalMax: 37, trend: [], tau: 30 },
    ],
  },

  // ⑥ 模具加热站（FORM 正下方左侧，导热油送入 FORM 模具）
  {
    id: 'MHT-501',
    name: '模具加热站',
    type: 'heater',
    x: 400, y: 405, width: 175, height: 80,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'heat_power',    name: '加热功率',     value: 65,  unit: 'kW', min: 0,  max: 150, normalMin: 50,  normalMax: 80,  trend: [], tau: 5 },
      { id: 'mold_pre_temp', name: '模具预热温度', value: 135, unit: '°C', min: 25, max: 200, normalMin: 130, normalMax: 145, trend: [], tau: 25 },
    ],
  },

  // ⑦ 真空泵机组（FORM 正下方右侧，抽气送入 FORM 真空腔）
  {
    id: 'VAC-601',
    name: '真空泵机组',
    type: 'pump',
    x: 605, y: 405, width: 175, height: 80,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'vac_pressure', name: '绝对压力', value: 4.5, unit: 'kPa',  min: 0.5, max: 100, normalMin: 1.0, normalMax: 5.0, trend: [], tau: 5 },
      { id: 'vac_flow',     name: '抽气流量', value: 200, unit: 'm³/h', min: 0,   max: 400, normalMin: 150, normalMax: 250, trend: [], tau: 3 },
    ],
  },

  // ========== 行 3 控制层（下移 25px 充分利用画布底部空间） ==========

  {
    id: 'HMI-801',
    name: '糊料温控监控屏',
    type: 'exchanger',
    x: 40, y: 525, width: 320, height: 115,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'temp_band',  name: '糊料温度带宽', value: 145, unit: '°C', min: 100, max: 200, normalMin: 142, normalMax: 158, trend: [], tau: 1 },
      { id: 'temp_alarm', name: '温度报警阈值', value: 165, unit: '°C', min: 150, max: 200, normalMin: 160, normalMax: 170, trend: [], tau: 1 },
    ],
  },

  {
    id: 'HMI-802',
    name: '班组任务台',
    type: 'task-board',
    x: 400, y: 525, width: 840, height: 115,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'shift_target', name: '当班指标',   value: 60,   unit: '块', min: 0, max: 100, normalMin: 55, normalMax: 65, trend: [], tau: 1 },
      { id: 'shift_actual', name: '已完成',     value: 35,   unit: '块', min: 0, max: 99,  normalMin: 0,  normalMax: 99, trend: [], tau: 1 },
      { id: 'qc_passed',    name: '一次合格数', value: 33,   unit: '块', min: 0, max: 99,  normalMin: 0,  normalMax: 99, trend: [], tau: 1 },
      { id: 'qc_ratio',     name: '合格率',     value: 94.3, unit: '%',  min: 0, max: 100, normalMin: 92, normalMax: 100,trend: [], tau: 1 },
    ],
  },
];

// =============================================================
// 物料/能流连接（按工艺流向 + 类型区分颜色）
//   橙色 = 高温糊料 (160°C)
//   红色 = 导热油 / 生阳极坯料
//   青色 = 真空管路（抽气，反向流）
//   黄色 = 重力下料
//   灰色 = 控制信号
// =============================================================
export const anodePipelines: Pipeline[] = [
  // 主流：糊料缸 → 给料斗（上方 → 顶部）
  { id: 'AP-101', from: 'PASTE-101', to: 'WGT-401',  fromPoint: 'right',  toPoint: 'left',   medium: '糊料',       flowRate: 0.5, color: '#f97316' },
  // 给料斗 → 振压成型机（重力下料）
  { id: 'AP-102', from: 'WGT-401',   to: 'FORM-201', fromPoint: 'right',  toPoint: 'left',   medium: '糊料计量',   flowRate: 0.5, color: '#fbbf24' },
  // 振压成型机 → 冷却台（红热生阳极）
  { id: 'AP-103', from: 'FORM-201',  to: 'COOL-301', fromPoint: 'right',  toPoint: 'left',   medium: '生阳极坯块', flowRate: 0.4, color: '#dc2626' },
  // 模具加热站 → 振压机（导热油）
  { id: 'AP-104', from: 'MHT-501',   to: 'FORM-201', fromPoint: 'top',    toPoint: 'bottom', medium: '导热油',     flowRate: 0.4, color: '#dc2626' },
  // 真空泵 → 振压机（抽气）
  { id: 'AP-105', from: 'VAC-601',   to: 'FORM-201', fromPoint: 'top',    toPoint: 'bottom', medium: '真空抽气',   flowRate: 0.5, color: '#22d3ee' },
  // 配料控制柜 → 糊料缸（配比指令）
  { id: 'AP-106', from: 'CFG-701',   to: 'PASTE-101',fromPoint: 'top',    toPoint: 'bottom', medium: '配比指令',   flowRate: 0.3, color: '#94a3b8' },
];
