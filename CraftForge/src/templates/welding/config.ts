import type { Equipment, Pipeline } from '@/types';

// 汽车焊装车间布局 v3：扩宽布局 + 真实产线流向
// 流程：上件工位 → 输入输送带 → 定位夹具 → 三机器人协同点焊 → 焊缝检测 → 输出输送带 → 下件工位
// 控制柜独立放下方，统管整线
// 布局原则：相邻设备水平间距 ≥ 70px，机器人与夹具垂直间距 ≥ 100px，避免文字与设备图形重叠
export const weldingEquipments: Equipment[] = [
  // 1. 上件工位
  {
    id: 'ST-101',
    name: '上件工位',
    type: 'station',
    x: 40,
    y: 280,
    width: 80,
    height: 80,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'feed_rate', name: '上件节拍', value: 60, unit: 's/件', min: 30, max: 120, normalMin: 50, normalMax: 70, trend: [] },
      { id: 'ready_status', name: '就位状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [] },
    ],
  },
  // 2. 输入段输送带
  {
    id: 'CONV-101',
    name: '输入输送带',
    type: 'conveyor',
    x: 160,
    y: 295,
    width: 220,
    height: 50,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'conveyor_speed', name: '输送速度', value: 1.2, unit: 'm/min', min: 0.5, max: 2.0, normalMin: 1.0, normalMax: 1.5, trend: [] },
      { id: 'belt_tension', name: '皮带张力', value: 800, unit: 'N', min: 500, max: 1200, normalMin: 700, normalMax: 900, trend: [] },
    ],
  },
  // 3. 定位夹紧夹具
  {
    id: 'FIX-101',
    name: '定位夹具',
    type: 'fixture',
    x: 420,
    y: 290,
    width: 70,
    height: 60,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'clamp_force', name: '夹紧力', value: 5000, unit: 'N', min: 3000, max: 8000, normalMin: 4500, normalMax: 5500, trend: [] },
      { id: 'position_error', name: '定位误差', value: 0.05, unit: 'mm', min: 0, max: 0.5, normalMin: 0, normalMax: 0.1, trend: [] },
      { id: 'clamp_status', name: '夹紧状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [] },
    ],
  },
  // 4-6. 三台焊接机器人协同（上、中、下三个方位，围绕夹具）
  {
    id: 'ROB-101',
    name: '机器人1号',
    type: 'robot',
    x: 530,
    y: 100,
    width: 90,
    height: 110,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流', value: 180, unit: 'A', min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [] },
      { id: 'weld_voltage', name: '焊接电压', value: 22, unit: 'V', min: 15, max: 35, normalMin: 20, normalMax: 25, trend: [] },
      { id: 'arm_speed', name: '机械臂速度', value: 0.8, unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [] },
      { id: 'tip_temp', name: '电极温度', value: 320, unit: '°C', min: 100, max: 600, normalMin: 280, normalMax: 380, trend: [] },
    ],
  },
  {
    id: 'ROB-102',
    name: '机器人2号',
    type: 'robot',
    x: 680,
    y: 100,
    width: 90,
    height: 110,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流', value: 175, unit: 'A', min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [] },
      { id: 'weld_voltage', name: '焊接电压', value: 21, unit: 'V', min: 15, max: 35, normalMin: 20, normalMax: 25, trend: [] },
      { id: 'arm_speed', name: '机械臂速度', value: 0.75, unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [] },
      { id: 'tip_temp', name: '电极温度', value: 305, unit: '°C', min: 100, max: 600, normalMin: 280, normalMax: 380, trend: [] },
    ],
  },
  {
    id: 'ROB-103',
    name: '机器人3号',
    type: 'robot',
    x: 530,
    y: 430,
    width: 90,
    height: 110,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流', value: 185, unit: 'A', min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [] },
      { id: 'weld_voltage', name: '焊接电压', value: 23, unit: 'V', min: 15, max: 35, normalMin: 20, normalMax: 25, trend: [] },
      { id: 'arm_speed', name: '机械臂速度', value: 0.85, unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [] },
      { id: 'tip_temp', name: '电极温度', value: 340, unit: '°C', min: 100, max: 600, normalMin: 280, normalMax: 380, trend: [] },
    ],
  },
  // 7. 公共焊枪（气路 / 水路 / 送丝接入）
  {
    id: 'WG-101',
    name: '焊枪总成',
    type: 'weld_gun',
    x: 690,
    y: 460,
    width: 60,
    height: 80,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'gas_flow', name: '保护气流量', value: 15, unit: 'L/min', min: 5, max: 30, normalMin: 12, normalMax: 18, trend: [] },
      { id: 'cooling_water', name: '冷却水流量', value: 4.5, unit: 'L/min', min: 1, max: 10, normalMin: 4, normalMax: 6, trend: [] },
      { id: 'wire_feed_rate', name: '送丝速度', value: 6.0, unit: 'm/min', min: 2, max: 12, normalMin: 5, normalMax: 7, trend: [] },
    ],
  },
  // 8. 焊缝检测仪（视觉 + 超声）
  {
    id: 'INST-101',
    name: '焊缝检测仪',
    type: 'instrument',
    x: 810,
    y: 290,
    width: 70,
    height: 70,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_quality', name: '焊缝质量', value: 95, unit: '%', min: 0, max: 100, normalMin: 90, normalMax: 100, trend: [] },
      { id: 'defect_count', name: '缺陷计数', value: 0, unit: '个', min: 0, max: 10, normalMin: 0, normalMax: 2, trend: [] },
      { id: 'penetration', name: '熔深', value: 2.5, unit: 'mm', min: 1, max: 5, normalMin: 2.0, normalMax: 3.0, trend: [] },
    ],
  },
  // 9. 输出段输送带
  {
    id: 'CONV-102',
    name: '输出输送带',
    type: 'conveyor',
    x: 910,
    y: 295,
    width: 200,
    height: 50,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'conveyor_speed', name: '输送速度', value: 1.2, unit: 'm/min', min: 0.5, max: 2.0, normalMin: 1.0, normalMax: 1.5, trend: [] },
      { id: 'belt_tension', name: '皮带张力', value: 820, unit: 'N', min: 500, max: 1200, normalMin: 700, normalMax: 900, trend: [] },
    ],
  },
  // 10. 下件工位
  {
    id: 'ST-102',
    name: '下件工位',
    type: 'station',
    x: 1140,
    y: 280,
    width: 80,
    height: 80,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'output_rate', name: '下件节拍', value: 60, unit: 's/件', min: 30, max: 120, normalMin: 50, normalMax: 70, trend: [] },
      { id: 'queue_count', name: '排队数量', value: 1, unit: '件', min: 0, max: 5, normalMin: 0, normalMax: 2, trend: [] },
    ],
  },
  // 11. 产线控制柜（独立放下方）
  {
    id: 'CTRL-101',
    name: '产线控制柜',
    type: 'control_box',
    x: 580,
    y: 620,
    width: 110,
    height: 70,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'main_voltage', name: '主电压', value: 380, unit: 'V', min: 360, max: 400, normalMin: 375, normalMax: 385, trend: [] },
      { id: 'comm_status', name: '通讯状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [] },
      { id: 'sys_load', name: '系统负载', value: 45, unit: '%', min: 0, max: 100, normalMin: 30, normalMax: 70, trend: [] },
    ],
  },
];

// 流程管线：表示物料/电气流向
// 配色：白车身（银白） / 焊接件（青蓝） / 点焊（橙） / 保护气（绿） / 控制信号（紫）
export const weldingPipelines: Pipeline[] = [
  // 主线（水平方向，从左到右）
  { id: 'WP-001', from: 'ST-101',   to: 'CONV-101', fromPoint: 'right', toPoint: 'left', medium: '白车身', flowRate: 1.0, color: '#94a3b8' },
  { id: 'WP-002', from: 'CONV-101', to: 'FIX-101',  fromPoint: 'right', toPoint: 'left', medium: '白车身', flowRate: 1.0, color: '#94a3b8' },
  { id: 'WP-003', from: 'FIX-101',  to: 'INST-101', fromPoint: 'right', toPoint: 'left', medium: '焊接件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'WP-004', from: 'INST-101', to: 'CONV-102', fromPoint: 'right', toPoint: 'left', medium: '检测件', flowRate: 1.0, color: '#22d3ee' },
  { id: 'WP-005', from: 'CONV-102', to: 'ST-102',   fromPoint: 'right', toPoint: 'left', medium: '合格件', flowRate: 1.0, color: '#22d3ee' },

  // 机器人作业到夹具（点焊轨迹）
  { id: 'WP-101', from: 'ROB-101', to: 'FIX-101', fromPoint: 'bottom', toPoint: 'top',    medium: '点焊', flowRate: 0.6, color: '#f97316' },
  { id: 'WP-102', from: 'ROB-102', to: 'FIX-101', fromPoint: 'bottom', toPoint: 'top',    medium: '点焊', flowRate: 0.6, color: '#f97316' },
  { id: 'WP-103', from: 'ROB-103', to: 'FIX-101', fromPoint: 'top',    toPoint: 'bottom', medium: '点焊', flowRate: 0.6, color: '#f97316' },

  // 焊枪 → 机器人 3 号（公共气路示意）
  { id: 'WP-201', from: 'WG-101', to: 'ROB-103', fromPoint: 'top', toPoint: 'bottom', medium: '保护气', flowRate: 0.5, color: '#84cc16' },

  // 控制柜 → 所有机器人 / 夹具（控制信号）
  { id: 'WP-301', from: 'CTRL-101', to: 'ROB-101', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'WP-302', from: 'CTRL-101', to: 'ROB-102', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'WP-303', from: 'CTRL-101', to: 'ROB-103', fromPoint: 'top', toPoint: 'top',    medium: '控制', flowRate: 0.4, color: '#a855f7' },
  { id: 'WP-304', from: 'CTRL-101', to: 'FIX-101', fromPoint: 'top', toPoint: 'bottom', medium: '控制', flowRate: 0.4, color: '#a855f7' },
];

export const weldingConfig = {
  equipments: weldingEquipments,
  pipelines: weldingPipelines,
};
