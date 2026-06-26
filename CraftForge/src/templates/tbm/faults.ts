import type { Fault } from '@/types';

// 盾构机 TBM 典型故障库
// 3 类核心故障：刀具磨损 / 地层涌水 / 姿态偏差
export const tbmFaults: Fault[] = [
  // ============= 故障 1：刀具磨损过快（硬岩段）=============
  {
    id: 'TBMF001',
    name: '刀具磨损过快（硬岩段切削效率下降）',
    description: '连续在风化岩中掘进，刀具磨损度突破 75%，扭矩飙升、推进速度骤降、振动加大',
    affectedEquipments: ['TBM-CHE-101', 'TBM-DRV-101'],
    symptoms: [
      { equipmentId: 'TBM-CHE-101', param: 'wear',           paramName: '刀具磨损度',   value: 78,   unit: '%',      normal: '0-60',     trend: 'up'   },
      { equipmentId: 'TBM-CHE-101', param: 'torque',         paramName: '刀盘扭矩',     value: 5800, unit: 'kN·m',   normal: '2500-4500', trend: 'up'   },
      { equipmentId: 'TBM-DRV-101', param: 'vibration',      paramName: '主驱动振动',   value: 6.2,  unit: 'mm/s',   normal: '0-4.5',    trend: 'up'   },
      { equipmentId: 'TBM-SHL-101', param: 'speed',          paramName: '推进速度',     value: 8,    unit: 'mm/min', normal: '15-35',    trend: 'down' },
    ],
    cause: '硬岩段切削刀具磨损加速，超过 75% 后切削效率急剧下降，扭矩与振动同时上升',
    steps: [
      { id: 's1', action: '立即降低推进速度到 5 mm/min',     correct: true,  order: 1 },
      { id: 's2', action: '降低刀盘转速减少冲击磨损',          correct: true,  order: 2 },
      { id: 's3', action: '进入泥水保压换刀模式',             correct: true,  order: 3 },
      { id: 's4', action: '强行提推力穿过岩层（错误）',        correct: false, order: 4 },
    ],
    hints: [
      '刀具磨损 78% 了，再硬推刀盘会损坏，先把推进速度压到 5 以下',
      '扭矩超过 5500 kN·m 是危险线，转速也要降',
      '硬岩段必须及时换刀，再撑下去就是事故',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'TBM-CHE-101', param: 'wear',   rate: 0.3, cap: 95, delaySec: 30 },
        { equipmentId: 'TBM-CHE-101', param: 'torque', rate: 50,  cap: 7500, delaySec: 20 },
      ],
    },
  },

  // ============= 故障 2：地层涌水（含水砂层失稳）=============
  {
    id: 'TBMF002',
    name: '土仓压力失稳（地层涌水风险）',
    description: '进入含水砂层后土仓压力低于地下水位 + 1.5 bar 安全余量，地表沉降快速增加，盾尾密封冒水',
    affectedEquipments: ['TBM-CHB-101', 'TBM-MON-101', 'TBM-SEAL-101'],
    symptoms: [
      { equipmentId: 'TBM-CHB-101', param: 'pressure',       paramName: '泥水仓压',      value: 1.2,  unit: 'bar',    normal: '1.5-3.5',  trend: 'down' },
      { equipmentId: 'TBM-CHB-101', param: 'density',        paramName: '泥浆密度',      value: 1.12, unit: 'g/cm³',  normal: '1.18-1.35',trend: 'down' },
      { equipmentId: 'TBM-MON-101', param: 'settlement_max', paramName: '地表最大沉降', value: 18,   unit: 'mm',     normal: '-10~10',   trend: 'up'   },
      { equipmentId: 'TBM-SEAL-101',param: 'seal_pressure',  paramName: '盾尾密封压力',  value: 0.25, unit: 'MPa',    normal: '0.4-0.7',  trend: 'down' },
    ],
    cause: '泥浆密度偏低导致仓压建立不起来，地下水反向进入土仓，地层流失引起地表沉降',
    steps: [
      { id: 's1', action: '紧急提高泥浆密度到 1.30',         correct: true,  order: 1 },
      { id: 's2', action: '加大同步注浆量到 130%',            correct: true,  order: 2 },
      { id: 's3', action: '降低推进速度避免扰动地层',          correct: true,  order: 3 },
      { id: 's4', action: '加大刀盘转速冲过砂层（错误）',      correct: false, order: 4 },
    ],
    hints: [
      '仓压只有 1.2 bar，地下水快进来了，先把泥浆密度提到 1.3',
      '盾尾密封压力也掉了，加大注浆量补上压',
      '这时候不能加速，越快地层流失越严重',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'TBM-MON-101', param: 'settlement_max', rate: 1.2, cap: 45,  delaySec: 25 },
        { equipmentId: 'TBM-CHB-101', param: 'pressure',       rate: -0.05, cap: 0.5, delaySec: 20 },
      ],
    },
  },

  // ============= 故障 3：盾构姿态偏差（推力不均）=============
  {
    id: 'TBMF003',
    name: '盾构姿态偏差（管片拼装不齐风险）',
    description: '16 组推进油缸压力不均导致盾体偏离设计轴线，X/Y 偏差均超过 ±50mm，激光靶板红点严重偏离中心',
    affectedEquipments: ['TBM-SHL-101', 'TBM-NAV-101', 'TBM-ERE-101'],
    symptoms: [
      { equipmentId: 'TBM-NAV-101', param: 'x_deviation', paramName: 'X 水平偏差',   value: 62,  unit: 'mm', normal: '-30~30', trend: 'up'   },
      { equipmentId: 'TBM-NAV-101', param: 'y_deviation', paramName: 'Y 垂直偏差',   value: -55, unit: 'mm', normal: '-30~30', trend: 'down' },
      { equipmentId: 'TBM-SHL-101', param: 'roll',        paramName: '滚动角',        value: 2.8, unit: '°',  normal: '-1.5~1.5', trend: 'up' },
      { equipmentId: 'TBM-ERE-101', param: 'precision',   paramName: '拼装精度',      value: 8.5, unit: 'mm', normal: '0-5',    trend: 'up'   },
    ],
    cause: '地层软硬不均导致左右推进阻力差异大，操作未及时分组调整油缸推力比例',
    steps: [
      { id: 's1', action: '减小推进速度，等姿态稳定再走',     correct: true,  order: 1 },
      { id: 's2', action: '分组调整推进油缸推力比例',          correct: true,  order: 2 },
      { id: 's3', action: '滚动角偏大时用纠偏千斤顶反向调',     correct: true,  order: 3 },
      { id: 's4', action: '加大总推力强行修正（错误）',         correct: false, order: 4 },
    ],
    hints: [
      'X 偏差 62mm 超规了，管片拼上去会错台',
      '先停推进，把油缸推力按组调一下，让盾体回到中心线',
      '滚动角也飘了，纠偏千斤顶反向给力',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'TBM-NAV-101', param: 'x_deviation', rate: 0.8,  cap: 95,   delaySec: 25 },
        { equipmentId: 'TBM-NAV-101', param: 'y_deviation', rate: -0.8, cap: -90,  delaySec: 25 },
        { equipmentId: 'TBM-SHL-101', param: 'roll',        rate: 0.05, cap: 4.5,  delaySec: 20 },
      ],
    },
  },
];
