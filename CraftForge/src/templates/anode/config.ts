import type { Equipment, Pipeline } from '@/types';

// =============================================================
// 阳极振压成型车间 · 1280x700 布局 v1
// 工艺流：糊料缸 → 加热保温 → 称量给料 → 振压成型机 → 真空脱气 → 生阳极冷却台
//
// 布局：
//   y= 60~120   厂房屋顶/排气罩
//   y=140~360   主工艺设备：糊料缸 + 振压机 + 冷却台
//   y=380~440   1 台模具加热站（左下）+ 1 台真空泵机组（中下）+ 1 台配料控制柜（右下）
//   y=460~610   控制层：糊料温度监控屏 + 班组任务台
// =============================================================

export const anodeEquipments: Equipment[] = [

  // ========== 行 1：核心工艺设备 (y=140~360) ==========

  // 糊料保温缸（左侧，竖立反应器形状，加热夹套）
  {
    id: 'PASTE-101',
    name: '糊料保温缸',
    type: 'reactor',
    x: 60, y: 140, width: 200, height: 220,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'paste_temp',  name: '糊料温度', value: 150, unit: '°C',  min: 100, max: 200, normalMin: 145, normalMax: 155, trend: [], tau: 8 },
      { id: 'paste_level', name: '料位',     value: 75,  unit: '%',   min: 0,   max: 100, normalMin: 50,  normalMax: 85,  trend: [], tau: 30 },
      { id: 'pitch_ratio', name: '沥青配比', value: 15.0,unit: 'wt%', min: 10,  max: 20,  normalMin: 14.0,normalMax: 16.0,trend: [], tau: 20 },
      { id: 'mixer_speed', name: '搅拌转速', value: 12,  unit: 'rpm', min: 0,   max: 30,  normalMin: 10,  normalMax: 15,  trend: [], tau: 2 },
    ],
  },

  // 振压成型机（中央主角，1250t 大型液压机；用 reactor 形状）
  {
    id: 'FORM-201',
    name: '振压成型机',
    type: 'reactor',
    x: 320, y: 140, width: 320, height: 220,
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

  // 生阳极冷却输送台（右侧，传送辊道）
  {
    id: 'COOL-301',
    name: '生阳极冷却台',
    type: 'conveyor',
    x: 700, y: 220, width: 220, height: 70,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'cool_speed',    name: '冷却传送速度', value: 0.05, unit: 'm/s', min: 0,    max: 0.2, normalMin: 0.03, normalMax: 0.08, trend: [], tau: 5 },
      { id: 'cool_temp_in',  name: '入口温度',     value: 220,  unit: '°C',  min: 100,  max: 350, normalMin: 200,  normalMax: 250,  trend: [], tau: 15 },
      { id: 'cool_temp_out', name: '出口温度',     value: 60,   unit: '°C',  min: 20,   max: 150, normalMin: 50,   normalMax: 80,   trend: [], tau: 20 },
      { id: 'queue_len',     name: '待冷却数',     value: 4,    unit: '块',  min: 0,    max: 20,  normalMin: 0,    normalMax: 12,   trend: [], tau: 30 },
    ],
  },

  // 称量给料斗（成型机正上方）— 用 reactor 形状（小尺寸）
  {
    id: 'WGT-401',
    name: '称量给料斗',
    type: 'reactor',
    x: 380, y: 30, width: 200, height: 90,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'feed_weight', name: '单块加料量', value: 1080, unit: 'kg', min: 800, max: 1200, normalMin: 1070, normalMax: 1095, trend: [], tau: 2 },
      { id: 'feed_dev',    name: '重量偏差',   value: 0.8,  unit: '%',  min: 0,   max: 10,   normalMin: 0,    normalMax: 2,    trend: [], tau: 10 },
    ],
  },

  // ========== 行 2：辅助设备 (y=380~440) ==========

  {
    id: 'MHT-501',
    name: '模具加热站',
    type: 'heater',
    x: 80, y: 380, width: 200, height: 80,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'heat_power',    name: '加热功率',     value: 65,  unit: 'kW', min: 0,  max: 150, normalMin: 50,  normalMax: 80,  trend: [], tau: 5 },
      { id: 'mold_pre_temp', name: '模具预热温度', value: 135, unit: '°C', min: 25, max: 200, normalMin: 130, normalMax: 145, trend: [], tau: 25 },
    ],
  },

  {
    id: 'VAC-601',
    name: '真空泵机组',
    type: 'pump',
    x: 360, y: 380, width: 180, height: 80,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'vac_pressure', name: '绝对压力', value: 4.5, unit: 'kPa',  min: 0.5, max: 100, normalMin: 1.0, normalMax: 5.0, trend: [], tau: 5 },
      { id: 'vac_flow',     name: '抽气流量', value: 200, unit: 'm³/h', min: 0,   max: 400, normalMin: 150, normalMax: 250, trend: [], tau: 3 },
    ],
  },

  {
    id: 'CFG-701',
    name: '配料控制柜',
    type: 'pot-ctrl',
    x: 620, y: 380, width: 280, height: 80,
    status: 'normal', template: 'anode',
    parameters: [
      { id: 'coke_ratio', name: '石油焦粒度配比', value: 30, unit: 'wt%', min: 15, max: 50, normalMin: 28, normalMax: 32, trend: [], tau: 30 },
      { id: 'fine_ratio', name: '细粒配比',       value: 35, unit: 'wt%', min: 20, max: 50, normalMin: 33, normalMax: 37, trend: [], tau: 30 },
    ],
  },

  // ========== 行 3：控制层 (y=480~620) ==========

  {
    id: 'HMI-801',
    name: '糊料温控监控屏',
    type: 'exchanger',
    x: 60, y: 510, width: 320, height: 100,
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
    x: 420, y: 490, width: 580, height: 130,
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
// 物料/能流连接
// =============================================================
export const anodePipelines: Pipeline[] = [
  { id: 'AP-101', from: 'PASTE-101', to: 'FORM-201', fromPoint: 'right',  toPoint: 'left',   medium: '糊料',       flowRate: 0.6, color: '#f97316' },
  { id: 'AP-102', from: 'CFG-701',   to: 'PASTE-101',fromPoint: 'top',    toPoint: 'bottom', medium: '配比指令',   flowRate: 0.3, color: '#94a3b8' },
  { id: 'AP-103', from: 'VAC-601',   to: 'FORM-201', fromPoint: 'top',    toPoint: 'bottom', medium: '真空抽气',   flowRate: 0.5, color: '#22d3ee' },
  { id: 'AP-104', from: 'MHT-501',   to: 'FORM-201', fromPoint: 'right',  toPoint: 'left',   medium: '导热油',     flowRate: 0.4, color: '#dc2626' },
  { id: 'AP-105', from: 'WGT-401',   to: 'FORM-201', fromPoint: 'bottom', toPoint: 'top',    medium: '糊料计量',   flowRate: 0.5, color: '#fbbf24' },
  { id: 'AP-106', from: 'FORM-201',  to: 'COOL-301', fromPoint: 'right',  toPoint: 'left',   medium: '生阳极坯块', flowRate: 0.4, color: '#dc2626' },
];
