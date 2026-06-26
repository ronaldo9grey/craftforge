import type { Equipment, Pipeline } from '@/types';

// TBM 盾构机 3D 场景配置 v1
// 注：本场景为 3D 渲染，equipment 的 x/y/width/height 是为复用 2D 数据结构而保留的"逻辑坐标"，
// 3D 渲染层会用单独的 spatial 映射把这些设备摆到立体空间中。
// 真实 3D 摆位见 src/scenes/tbm/components/*.tsx

// 时间常数（秒）—— 大型机械响应慢，惯性大
const TAU_FAST = 1.2;     // 转速类（刀盘 RPM、螺旋输送机）
const TAU_TORQUE = 3.2;   // 扭矩
const TAU_PRESSURE = 2;   // 仓压、注浆压力
const TAU_FLOW = 5;       // 注浆流量
const TAU_TEMP = 15;      // 油温、刀具温度（热惯性大）
const TAU_WEAR = 60;      // 磨损（极慢，分钟级累积）
const TAU_ATTITUDE = 3;   // 姿态角度（液压响应）
const TAU_SETTLE = 8;     // 地表沉降（土体响应慢）

export const tbmEquipments: Equipment[] = [
  // ============= 1. 刀盘 — 切削核心 =============
  {
    id: 'TBM-CHE-101', name: '刀盘', type: 'cutter-head',
    x: 800, y: 380, width: 100, height: 100,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'rpm',    name: '刀盘转速',   value: 1.2,  unit: 'r/min', min: 0,  max: 3,    normalMin: 1,    normalMax: 1.8,  trend: [], tau: TAU_FAST },
      { id: 'torque', name: '刀盘扭矩',   value: 3200, unit: 'kN·m',  min: 0,  max: 8000, normalMin: 2500, normalMax: 4500, trend: [], tau: TAU_TORQUE },
      { id: 'wear',   name: '刀具磨损度', value: 12,   unit: '%',     min: 0,  max: 100,  normalMin: 0,    normalMax: 60,   trend: [], tau: TAU_WEAR },
      { id: 'temp',   name: '刀具温度',   value: 85,   unit: '°C',    min: 20, max: 200,  normalMin: 60,   normalMax: 120,  trend: [], tau: TAU_TEMP },
    ],
  },

  // ============= 2. 主驱动 =============
  {
    id: 'TBM-DRV-101', name: '主驱动', type: 'main-drive',
    x: 700, y: 380, width: 90, height: 100,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'output_torque', name: '输出扭矩', value: 3200, unit: 'kN·m', min: 0,  max: 8000, normalMin: 2500, normalMax: 4500, trend: [], tau: TAU_TORQUE },
      { id: 'oil_temp',      name: '齿轮油温', value: 55,   unit: '°C',   min: 20, max: 100,  normalMin: 40,   normalMax: 75,   trend: [], tau: TAU_TEMP },
      { id: 'vibration',     name: '振动值',   value: 2.1,  unit: 'mm/s', min: 0,  max: 10,   normalMin: 0,    normalMax: 4.5,  trend: [], tau: 2 },
    ],
  },

  // ============= 3. 盾体 + 推进油缸 =============
  {
    id: 'TBM-SHL-101', name: '盾体', type: 'shield-body',
    x: 600, y: 360, width: 90, height: 140,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'thrust',    name: '总推力',     value: 18000, unit: 'kN', min: 0,    max: 40000, normalMin: 12000, normalMax: 25000, trend: [], tau: 1 },
      { id: 'speed',     name: '推进速度',   value: 20,    unit: 'mm/min', min: 0, max: 80,    normalMin: 15,    normalMax: 35,    trend: [], tau: 2 },
      { id: 'roll',      name: '滚动角',     value: -0.3,  unit: '°',  min: -5,   max: 5,     normalMin: -1.5,  normalMax: 1.5,   trend: [], tau: TAU_ATTITUDE },
      { id: 'pitch',     name: '俯仰偏差',   value: 8,     unit: 'mm', min: -100, max: 100,   normalMin: -30,   normalMax: 30,    trend: [], tau: TAU_ATTITUDE },
      { id: 'yaw',       name: '水平偏差',   value: 5,     unit: 'mm', min: -100, max: 100,   normalMin: -30,   normalMax: 30,    trend: [], tau: TAU_ATTITUDE },
    ],
  },

  // ============= 4. 土仓 / 泥水仓 =============
  {
    id: 'TBM-CHB-101', name: '泥水仓', type: 'chamber',
    x: 720, y: 360, width: 80, height: 140,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'pressure',   name: '仓压',       value: 2.2, unit: 'bar',   min: 0,   max: 6,   normalMin: 1.5, normalMax: 3.5,  trend: [], tau: TAU_PRESSURE },
      { id: 'density',    name: '泥浆密度',   value: 1.25,unit: 'g/cm³', min: 1.0, max: 1.6, normalMin: 1.18,normalMax: 1.35, trend: [], tau: TAU_FLOW },
      { id: 'level',      name: '泥浆液位',   value: 75,  unit: '%',     min: 0,   max: 100, normalMin: 60,  normalMax: 90,   trend: [], tau: 3 },
    ],
  },

  // ============= 5. 螺旋输送机 =============
  {
    id: 'TBM-SCR-101', name: '螺旋输送机', type: 'screw-conveyor',
    x: 500, y: 460, width: 180, height: 50,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'screw_rpm',  name: '螺旋转速',   value: 8,   unit: 'r/min',  min: 0, max: 25,  normalMin: 5, normalMax: 15, trend: [], tau: TAU_FAST },
      { id: 'discharge',  name: '出土量',     value: 95,  unit: '%理论',  min: 0, max: 130, normalMin: 95,normalMax: 110,trend: [], tau: 8 },
      { id: 'screw_torque', name: '螺旋扭矩', value: 180, unit: 'kN·m',   min: 0, max: 500, normalMin: 100,normalMax:280, trend: [], tau: 1.5 },
    ],
  },

  // ============= 6. 管片拼装机 =============
  {
    id: 'TBM-ERE-101', name: '管片拼装机', type: 'erector',
    x: 380, y: 380, width: 100, height: 90,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'grip_force', name: '抓取力',     value: 320, unit: 'kN',  min: 0,   max: 600,  normalMin: 280, normalMax: 380, trend: [], tau: 0.5 },
      { id: 'precision',  name: '拼装精度',   value: 2.1, unit: 'mm',  min: 0,   max: 15,   normalMin: 0,   normalMax: 5,   trend: [], tau: 2 },
    ],
  },

  // ============= 7. 同步注浆系统 =============
  {
    id: 'TBM-INJ-101', name: '同步注浆系统', type: 'injection-pump',
    x: 250, y: 380, width: 100, height: 90,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'inject_pressure', name: '注浆压力', value: 0.32, unit: 'MPa', min: 0, max: 1.0, normalMin: 0.25, normalMax: 0.45, trend: [], tau: 1 },
      { id: 'inject_volume',   name: '注浆量',   value: 105,  unit: '%理论', min: 0, max: 200, normalMin: 100, normalMax: 130, trend: [], tau: TAU_FLOW },
    ],
  },

  // ============= 8. 盾尾密封 =============
  {
    id: 'TBM-SEAL-101', name: '盾尾密封', type: 'tail-seal',
    x: 470, y: 360, width: 50, height: 140,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'seal_pressure', name: '密封压力', value: 0.5,  unit: 'MPa', min: 0, max: 1.5, normalMin: 0.4, normalMax: 0.7,  trend: [], tau: 1 },
      { id: 'grease_use',    name: '油脂消耗', value: 4.5,  unit: 'kg/h', min: 0, max: 20,  normalMin: 3,   normalMax: 8,    trend: [], tau: TAU_FLOW },
    ],
  },

  // ============= 9. 导向系统 =============
  {
    id: 'TBM-NAV-101', name: '导向系统', type: 'guidance',
    x: 100, y: 200, width: 100, height: 70,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'x_deviation', name: 'X 水平偏差', value: 5,    unit: 'mm',  min: -100, max: 100, normalMin: -30, normalMax: 30,  trend: [], tau: TAU_ATTITUDE },
      { id: 'y_deviation', name: 'Y 垂直偏差', value: -8,   unit: 'mm',  min: -100, max: 100, normalMin: -30, normalMax: 30,  trend: [], tau: TAU_ATTITUDE },
      { id: 'slope',       name: '坡度',       value: 2.1,  unit: '‰',   min: -50,  max: 50,  normalMin: -5,  normalMax: 5,   trend: [], tau: TAU_ATTITUDE },
    ],
  },

  // ============= 10. 后配套台车 =============
  {
    id: 'TBM-BCK-101', name: '后配套台车', type: 'backup-system',
    x: 30, y: 380, width: 200, height: 100,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'voltage',       name: '主电压',     value: 10.5, unit: 'kV',  min: 0,  max: 12,  normalMin: 9.5, normalMax: 11,  trend: [], tau: 0.3 },
      { id: 'hyd_oil_temp',  name: '液压油温',   value: 52,   unit: '°C',  min: 20, max: 90,  normalMin: 35,  normalMax: 70,  trend: [], tau: TAU_TEMP },
    ],
  },

  // ============= 11. 地表沉降监测（虚拟设备）=============
  {
    id: 'TBM-MON-101', name: '地表沉降监测', type: 'monitor',
    x: 600, y: 50, width: 100, height: 70,
    status: 'normal', template: 'tbm',
    parameters: [
      { id: 'settlement_max', name: '最大沉降', value: 3.2,  unit: 'mm',  min: -20, max: 50,  normalMin: -10, normalMax: 10,  trend: [], tau: TAU_SETTLE },
      { id: 'monitor_count',  name: '监测点数',  value: 5,    unit: '个',  min: 0,   max: 20,  normalMin: 5,   normalMax: 10,  trend: [], inertia: false },
    ],
  },
];

export const tbmPipelines: Pipeline[] = [
  { id: 'TP-001', from: 'TBM-BCK-101', to: 'TBM-CHB-101', fromPoint: 'right',  toPoint: 'left',   medium: '进浆',     flowRate: 1.0, color: '#3b82f6' },
  { id: 'TP-002', from: 'TBM-CHB-101', to: 'TBM-SCR-101', fromPoint: 'bottom', toPoint: 'top',    medium: '泥水排出', flowRate: 1.0, color: '#854d0e' },
  { id: 'TP-003', from: 'TBM-SCR-101', to: 'TBM-BCK-101', fromPoint: 'left',   toPoint: 'right',  medium: '渣土回流', flowRate: 0.8, color: '#78350f' },
  { id: 'TP-004', from: 'TBM-INJ-101', to: 'TBM-SEAL-101',fromPoint: 'right',  toPoint: 'left',   medium: '同步注浆', flowRate: 0.6, color: '#facc15' },
  { id: 'TP-005', from: 'TBM-NAV-101', to: 'TBM-SHL-101', fromPoint: 'bottom', toPoint: 'top',    medium: '导向信号', flowRate: 0.3, color: '#a855f7' },
  { id: 'TP-006', from: 'TBM-DRV-101', to: 'TBM-CHE-101', fromPoint: 'right',  toPoint: 'left',   medium: '主轴驱动', flowRate: 0.5, color: '#ef4444' },
];
