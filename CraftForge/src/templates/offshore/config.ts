import type { Equipment, Pipeline } from '@/types';

// 海上钻井平台设备（12台）
export const offshoreEquipments: Equipment[] = [
  {
    id: 'RIG-DCR-101', name: '钻井绞车', type: 'monitor',
    x: 100, y: 50, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'hoist_load', name: '大钩载荷', value: 1200, unit: 'kN', min: 0, max: 4500, normalMin: 800, normalMax: 3000, trend: [], tau: 2 },
      { id: 'wob', name: '钻压', value: 150, unit: 'kN', min: 0, max: 500, normalMin: 80, normalMax: 300, trend: [], tau: 2 },
      { id: 'hoist_speed', name: '提升速度', value: 0.8, unit: 'm/s', min: 0, max: 2.5, normalMin: 0.3, normalMax: 1.5, trend: [], tau: 1.5 },
    ],
  },
  {
    id: 'RIG-RST-101', name: '转盘', type: 'monitor',
    x: 100, y: 150, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'rpm', name: '转速', value: 120, unit: 'rpm', min: 0, max: 300, normalMin: 60, normalMax: 200, trend: [], tau: 1.5 },
      { id: 'torque', name: '扭矩', value: 15, unit: 'kN·m', min: 0, max: 60, normalMin: 5, normalMax: 40, trend: [], tau: 3 },
      { id: 'temp', name: '轴承温度', value: 65, unit: '°C', min: 20, max: 150, normalMin: 30, normalMax: 90, trend: [], tau: 15 },
    ],
  },
  {
    id: 'RIG-MP-101', name: '泥浆泵', type: 'monitor',
    x: 250, y: 50, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'flow_rate', name: '流量', value: 2200, unit: 'L/min', min: 0, max: 5000, normalMin: 1000, normalMax: 3500, trend: [], tau: 2 },
      { id: 'pressure', name: '泵压', value: 18, unit: 'MPa', min: 0, max: 50, normalMin: 8, normalMax: 35, trend: [], tau: 2 },
      { id: 'stroke', name: '冲次', value: 95, unit: 'spm', min: 0, max: 160, normalMin: 40, normalMax: 120, trend: [], tau: 2 },
    ],
  },
  {
    id: 'RIG-BOP-101', name: '防喷器(BOP)', type: 'monitor',
    x: 250, y: 150, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'annular_pressure', name: '环空压力', value: 8, unit: 'MPa', min: 0, max: 70, normalMin: 3, normalMax: 25, trend: [], tau: 2 },
      { id: 'ram_status', name: '闸板密封', value: 100, unit: '%', min: 0, max: 100, normalMin: 80, normalMax: 100, trend: [], tau: 60 },
      { id: 'control_pressure', name: '控制液压', value: 21, unit: 'MPa', min: 0, max: 35, normalMin: 14, normalMax: 28, trend: [], tau: 1.5 },
    ],
  },
  {
    id: 'RIG-DER-101', name: '井架', type: 'monitor',
    x: 100, y: 250, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'derrick_load', name: '井架载荷', value: 1800, unit: 'kN', min: 0, max: 6500, normalMin: 500, normalMax: 4500, trend: [], tau: 3 },
      { id: 'wind_speed', name: '风载', value: 12, unit: 'm/s', min: 0, max: 60, normalMin: 0, normalMax: 35, trend: [], tau: 30 },
      { id: 'vibration', name: '振动值', value: 2.1, unit: 'mm/s', min: 0, max: 15, normalMin: 0, normalMax: 7.1, trend: [], tau: 3 },
    ],
  },
  {
    id: 'RIG-RIS-101', name: '隔水管', type: 'monitor',
    x: 250, y: 250, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'tension', name: '张力', value: 1400, unit: 'kN', min: 0, max: 3500, normalMin: 800, normalMax: 2500, trend: [], tau: 3 },
      { id: 'mud_return', name: '泥浆返出', value: 2100, unit: 'L/min', min: 0, max: 5000, normalMin: 900, normalMax: 3500, trend: [], tau: 5 },
      { id: 'angle', name: '偏角', value: 1.2, unit: '°', min: 0, max: 15, normalMin: 0, normalMax: 5, trend: [], tau: 10 },
    ],
  },
  {
    id: 'RIG-CS-101', name: '固井设备', type: 'monitor',
    x: 400, y: 50, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'cement_pressure', name: '固井泵压', value: 12, unit: 'MPa', min: 0, max: 60, normalMin: 5, normalMax: 40, trend: [], tau: 2 },
      { id: 'cement_flow', name: '固井流量', value: 800, unit: 'L/min', min: 0, max: 3000, normalMin: 300, normalMax: 2000, trend: [], tau: 2 },
      { id: 'density', name: '水泥浆密度', value: 1.90, unit: 'g/cm³', min: 1.0, max: 2.5, normalMin: 1.4, normalMax: 2.2, trend: [], tau: 5 },
    ],
  },
  {
    id: 'RIG-CK-101', name: '节流压井管汇', type: 'monitor',
    x: 400, y: 150, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'choke_pressure', name: '节流压力', value: 7, unit: 'MPa', min: 0, max: 70, normalMin: 2, normalMax: 25, trend: [], tau: 2 },
      { id: 'kill_flow', name: '压井流量', value: 0, unit: 'L/min', min: 0, max: 3000, normalMin: 0, normalMax: 2000, trend: [], tau: 2 },
      { id: 'valve_pos', name: '节流阀开度', value: 35, unit: '%', min: 0, max: 100, normalMin: 10, normalMax: 80, trend: [], tau: 1 },
    ],
  },
  {
    id: 'RIG-SH-101', name: '泥浆振动筛', type: 'monitor',
    x: 400, y: 250, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'throughput', name: '处理量', value: 2050, unit: 'L/min', min: 0, max: 5000, normalMin: 800, normalMax: 3500, trend: [], tau: 5 },
      { id: 'mesh_status', name: '筛网完好度', value: 95, unit: '%', min: 0, max: 100, normalMin: 70, normalMax: 100, trend: [], tau: 60 },
    ],
  },
  {
    id: 'RIG-FLR-101', name: '火炬塔', type: 'monitor',
    x: 550, y: 50, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'flare_rate', name: '燃烧量', value: 120, unit: 'm³/h', min: 0, max: 1000, normalMin: 0, normalMax: 500, trend: [], tau: 5 },
      { id: 'flare_temp', name: '火焰温度', value: 850, unit: '°C', min: 0, max: 1500, normalMin: 500, normalMax: 1200, trend: [], tau: 10 },
    ],
  },
  {
    id: 'RIG-PWR-101', name: '发电机组', type: 'monitor',
    x: 550, y: 150, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'power', name: '输出功率', value: 3200, unit: 'kW', min: 0, max: 8000, normalMin: 1500, normalMax: 6000, trend: [], tau: 5 },
      { id: 'voltage', name: '电压', value: 480, unit: 'V', min: 0, max: 600, normalMin: 440, normalMax: 520, trend: [], tau: 3 },
      { id: 'frequency', name: '频率', value: 60, unit: 'Hz', min: 0, max: 70, normalMin: 58, normalMax: 62, trend: [], tau: 3 },
    ],
  },
  {
    id: 'RIG-Heli-101', name: '直升机甲板', type: 'monitor',
    x: 550, y: 250, width: 80, height: 50,
    status: 'normal', template: 'offshore',
    parameters: [
      { id: 'wind_deck', name: '甲板风速', value: 10, unit: 'm/s', min: 0, max: 60, normalMin: 0, normalMax: 25, trend: [], tau: 30 },
      { id: 'visibility', name: '能见度', value: 8, unit: 'km', min: 0, max: 20, normalMin: 3, normalMax: 20, trend: [], tau: 60 },
    ],
  },
];

export const offshorePipelines: Pipeline[] = [
  { id: 'PL-MUD-01', from: 'RIG-MP-101', to: 'RIG-DER-101', fromPoint: 'top', toPoint: 'bottom', medium: '高压泥浆', flowRate: 2200, color: '#3b82f6' },
  { id: 'PL-MUD-02', from: 'RIG-DER-101', to: 'RIG-RIS-101', fromPoint: 'bottom', toPoint: 'top', medium: '泥浆下注', flowRate: 2200, color: '#1d4ed8' },
  { id: 'PL-MUD-03', from: 'RIG-RIS-101', to: 'RIG-SH-101', fromPoint: 'bottom', toPoint: 'top', medium: '泥浆返出', flowRate: 2100, color: '#0891b2' },
  { id: 'PL-CK-01', from: 'RIG-CK-101', to: 'RIG-BOP-101', fromPoint: 'left', toPoint: 'right', medium: '压井液', flowRate: 0, color: '#dc2626' },
  { id: 'PL-CS-01', from: 'RIG-CS-101', to: 'RIG-BOP-101', fromPoint: 'left', toPoint: 'right', medium: '水泥浆', flowRate: 800, color: '#a16207' },
  { id: 'PL-GAS-01', from: 'RIG-CK-101', to: 'RIG-FLR-101', fromPoint: 'top', toPoint: 'bottom', medium: '伴生气', flowRate: 120, color: '#f59e0b' },
];
