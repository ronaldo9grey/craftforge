import type { Equipment, Pipeline } from '@/types';

export const weldingEquipments: Equipment[] = [
  {
    id: 'ROB-101',
    name: '焊接机器人1号',
    type: 'robot',
    x: 200,
    y: 200,
    width: 80,
    height: 100,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流', value: 180, unit: 'A', min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [] },
      { id: 'weld_voltage', name: '焊接电压', value: 22, unit: 'V', min: 15, max: 35, normalMin: 20, normalMax: 25, trend: [] },
      { id: 'robot_speed', name: '运行速度', value: 0.8, unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [] },
    ],
  },
  {
    id: 'ROB-102',
    name: '焊接机器人2号',
    type: 'robot',
    x: 400,
    y: 200,
    width: 80,
    height: 100,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_current', name: '焊接电流', value: 175, unit: 'A', min: 100, max: 300, normalMin: 160, normalMax: 200, trend: [] },
      { id: 'weld_voltage', name: '焊接电压', value: 21, unit: 'V', min: 15, max: 35, normalMin: 20, normalMax: 25, trend: [] },
      { id: 'robot_speed', name: '运行速度', value: 0.75, unit: 'm/min', min: 0.3, max: 1.5, normalMin: 0.6, normalMax: 1.0, trend: [] },
    ],
  },
  {
    id: 'CONV-101',
    name: '车身传送带',
    type: 'conveyor',
    x: 100,
    y: 350,
    width: 500,
    height: 40,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'conveyor_speed', name: '传送速度', value: 1.2, unit: 'm/min', min: 0.5, max: 2.0, normalMin: 1.0, normalMax: 1.5, trend: [] },
      { id: 'position_accuracy', name: '定位精度', value: 0.05, unit: 'mm', min: 0, max: 0.2, normalMin: 0, normalMax: 0.1, trend: [] },
    ],
  },
  {
    id: 'FIX-101',
    name: '车身夹具1号',
    type: 'fixture',
    x: 180,
    y: 320,
    width: 60,
    height: 40,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'clamp_force', name: '夹紧力', value: 5000, unit: 'N', min: 3000, max: 8000, normalMin: 4000, normalMax: 6000, trend: [] },
      { id: 'clamp_status', name: '夹紧状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [] },
    ],
  },
  {
    id: 'FIX-102',
    name: '车身夹具2号',
    type: 'fixture',
    x: 380,
    y: 320,
    width: 60,
    height: 40,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'clamp_force', name: '夹紧力', value: 5200, unit: 'N', min: 3000, max: 8000, normalMin: 4000, normalMax: 6000, trend: [] },
      { id: 'clamp_status', name: '夹紧状态', value: 1, unit: '', min: 0, max: 1, normalMin: 1, normalMax: 1, trend: [] },
    ],
  },
  {
    id: 'INST-101',
    name: '焊缝检测仪',
    type: 'instrument',
    x: 550,
    y: 200,
    width: 50,
    height: 50,
    status: 'normal',
    template: 'welding',
    parameters: [
      { id: 'weld_quality', name: '焊缝质量', value: 95, unit: '%', min: 0, max: 100, normalMin: 90, normalMax: 100, trend: [] },
      { id: 'defect_count', name: '缺陷数量', value: 0, unit: '个', min: 0, max: 10, normalMin: 0, normalMax: 2, trend: [] },
    ],
  },
];

export const weldingPipelines: Pipeline[] = [
  { id: 'WP-001', from: 'CONV-101', to: 'FIX-101', fromPoint: 'top', toPoint: 'bottom', medium: '车身', flowRate: 1.2, color: '#C0C0C0' },
  { id: 'WP-002', from: 'CONV-101', to: 'FIX-102', fromPoint: 'top', toPoint: 'bottom', medium: '车身', flowRate: 1.2, color: '#C0C0C0' },
];

export const weldingConfig = {
  equipments: weldingEquipments,
  pipelines: weldingPipelines,
};
