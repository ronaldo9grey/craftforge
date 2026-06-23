import type { Fault } from '@/types';

// 注塑成型典型故障库（8 个）
// 涵盖：注射压力 / 模具温度 / 加热筒 / 冷却水 / 锁模力 / 物料含水 / 螺杆背压 / 干燥温度
// 3 个含正反馈发散（IF002 / IF003 / IF004）
export const injectionFaults: Fault[] = [
  {
    id: 'IF001',
    name: '注射压力不足（短射）',
    description: 'IMM-101 注射压力跌至 55 MPa，制品出现短射（充模不足），重量偏差变大',
    affectedEquipments: ['IMM-101', 'INST-201'],
    symptoms: [
      { equipmentId: 'IMM-101',  param: 'inject_pressure', paramName: '注射压力', value: 55,   unit: 'MPa', normal: '70-110', trend: 'down' },
      { equipmentId: 'INST-201', param: 'weight_dev',      paramName: '重量偏差', value: -0.8, unit: 'g',   normal: '-0.3~0.3', trend: 'down' },
    ],
    cause: '螺杆磨损或止逆阀失效，注射压力建立不充分，熔体未充满型腔',
    steps: [
      { id: 's1', action: '提高注射压力 setpoint 到 85 MPa', correct: true, order: 1 },
      { id: 's2', action: '检查止逆阀是否磨损', correct: true, order: 2 },
      { id: 's3', action: '降低螺杆转速', correct: false, order: 3 },
    ],
    hints: ['压力不够熔体进不去型腔', '止逆阀磨损是常见原因', '光提速没用，先把压力顶上来'],
  },
  {
    id: 'IF002',
    name: '模具温度过高（粘模/翘曲）',
    description: '模具温度升至 88°C 远超正常 45-75，制品脱模困难，翘曲严重',
    affectedEquipments: ['MOLD-201', 'CHILL-301'],
    symptoms: [
      { equipmentId: 'MOLD-201',  param: 'mold_temp',    paramName: '模具温度', value: 88, unit: '°C', normal: '45-75', trend: 'up' },
      { equipmentId: 'CHILL-301', param: 'chiller_flow', paramName: '冷却水流量', value: 9, unit: 'L/min', normal: '14-24', trend: 'down' },
    ],
    cause: '冷却水流量下降，模具散热不足，热量累积',
    steps: [
      { id: 's1', action: '提高冷却水流量到 20 L/min', correct: true, order: 1 },
      { id: 's2', action: '检查冷却水管路是否堵塞', correct: true, order: 2 },
      { id: 's3', action: '加大注射压力', correct: false, order: 3 },
    ],
    hints: ['冷却水才 9 L/min，正常要 14+', '模温超 80°C 就翘曲', '管路堵了清一下，光等没用'],
    // 正反馈发散：模具温度持续往上爬，30 秒后启动，加快恶化
    divergence: {
      drivers: [
        { equipmentId: 'MOLD-201', param: 'mold_temp', rate: 0.2, cap: 105, delaySec: 30 },
      ],
    },
  },
  {
    id: 'IF003',
    name: '加热筒过热（材料降解）',
    description: '加热筒计量段温度飙到 275°C 远超 220-250，物料降解变色，喷嘴出料发黑',
    affectedEquipments: ['HEAT-301'],
    symptoms: [
      { equipmentId: 'HEAT-301', param: 'zone3_temp',  paramName: '计量段温度', value: 275, unit: '°C', normal: '220-250', trend: 'up' },
      { equipmentId: 'HEAT-301', param: 'nozzle_temp', paramName: '喷嘴温度',   value: 282, unit: '°C', normal: '225-255', trend: 'up' },
    ],
    cause: '温控热电偶漂移或加热环控制故障，温度持续超调',
    steps: [
      { id: 's1', action: '降低计量段温度 setpoint 到 235°C', correct: true, order: 1 },
      { id: 's2', action: '降低喷嘴温度到 245°C', correct: true, order: 2 },
      { id: 's3', action: '检查热电偶', correct: true, order: 3 },
      { id: 's4', action: '提高螺杆转速', correct: false, order: 4 },
    ],
    hints: ['再烧下去料就降解了', '热电偶可能不准', '别提转速，越剪切越热'],
    // 正反馈发散：计量段温度继续飙
    divergence: {
      drivers: [
        { equipmentId: 'HEAT-301', param: 'zone3_temp', rate: 0.3, cap: 300, delaySec: 30 },
      ],
    },
  },
  {
    id: 'IF004',
    name: '冷却水流量严重不足',
    description: '冷却水流量跌至 6 L/min，模具与注塑机双重过热，制品收缩缺陷',
    affectedEquipments: ['CHILL-301', 'MOLD-201', 'IMM-101'],
    symptoms: [
      { equipmentId: 'CHILL-301', param: 'chiller_flow',   paramName: '冷却水流量', value: 6,  unit: 'L/min', normal: '14-24', trend: 'down' },
      { equipmentId: 'CHILL-301', param: 'water_out_temp', paramName: '出水温度',   value: 32, unit: '°C',    normal: '18-28', trend: 'up' },
      { equipmentId: 'MOLD-201',  param: 'mold_temp',      paramName: '模具温度',   value: 80, unit: '°C',    normal: '45-75', trend: 'up' },
    ],
    cause: '冷水机泵故障或过滤器堵塞，循环水量大幅下降',
    steps: [
      { id: 's1', action: '检查冷水机过滤器并清理', correct: true, order: 1 },
      { id: 's2', action: '提高冷却水流量 setpoint 到 20', correct: true, order: 2 },
      { id: 's3', action: '继续生产观察', correct: false, order: 3 },
    ],
    hints: ['流量才 6，模温肯定压不住', '先看过滤器堵没堵', '硬撑下去要么飞边要么粘模'],
    // 正反馈发散：流量继续往下掉
    divergence: {
      drivers: [
        { equipmentId: 'CHILL-301', param: 'chiller_flow', rate: -0.15, cap: 2, delaySec: 30 },
      ],
    },
  },
  {
    id: 'IF005',
    name: '锁模力不足（飞边）',
    description: 'IMM-102 锁模力降至 900 kN（正常 1100-1300），制品出现飞边毛刺',
    affectedEquipments: ['IMM-102', 'INST-201'],
    symptoms: [
      { equipmentId: 'IMM-102',  param: 'clamp_force',  paramName: '锁模力',     value: 900, unit: 'kN', normal: '1100-1300', trend: 'down' },
      { equipmentId: 'INST-201', param: 'defect_count', paramName: '外观缺陷数', value: 6,   unit: '个', normal: '0-3', trend: 'up' },
    ],
    cause: '锁模油路泄漏或液压油压力不足，无法建立设定锁模力',
    steps: [
      { id: 's1', action: '提高锁模力 setpoint 到 1200', correct: true, order: 1 },
      { id: 's2', action: '检查锁模油缸是否泄漏', correct: true, order: 2 },
      { id: 's3', action: '降低注射压力', correct: false, order: 3 },
    ],
    hints: ['压不住模，熔体从分型面溢出来就是飞边', '油路漏一定要查', '降压只会短射，根子不在那'],
  },
  {
    id: 'IF006',
    name: '物料含水超标（银纹/气泡）',
    description: '物料含水率 720 ppm 远超 400 上限，制品表面出现银纹和气泡',
    affectedEquipments: ['DRY-201', 'INST-201'],
    symptoms: [
      { equipmentId: 'DRY-201',  param: 'moisture_ppm', paramName: '含水率',     value: 720, unit: 'ppm', normal: '0-400', trend: 'up' },
      { equipmentId: 'INST-201', param: 'defect_count', paramName: '外观缺陷数', value: 8,   unit: '个',  normal: '0-3', trend: 'up' },
    ],
    cause: '干燥温度偏低或干燥时间不足，原料未充分脱水',
    steps: [
      { id: 's1', action: '提高干燥温度到 90°C', correct: true, order: 1 },
      { id: 's2', action: '延长干燥时间至 4 小时', correct: true, order: 2 },
      { id: 's3', action: '加大注射速度', correct: false, order: 3 },
    ],
    hints: ['含水 720 ppm 太高了，得干透', '料没干透加多少压都是白搭', '提速更糟，加剪切水分气化更剧烈'],
  },
  {
    id: 'IF007',
    name: '螺杆背压异常（计量不稳）',
    description: '螺杆转速波动剧烈，背压异常，导致计量不准、制品重量飘忽',
    affectedEquipments: ['IMM-101', 'INST-201'],
    symptoms: [
      { equipmentId: 'IMM-101',  param: 'screw_speed', paramName: '螺杆转速', value: 135, unit: 'rpm', normal: '60-100', trend: 'up' },
      { equipmentId: 'INST-201', param: 'weight_dev',  paramName: '重量偏差', value: 0.6, unit: 'g',   normal: '-0.3~0.3', trend: 'up' },
    ],
    cause: '背压阀卡涩或液压系统泄漏，螺杆无法稳定计量',
    steps: [
      { id: 's1', action: '降低螺杆转速到 80 rpm', correct: true, order: 1 },
      { id: 's2', action: '检查背压阀与液压油压', correct: true, order: 2 },
      { id: 's3', action: '加大注射压力补偿', correct: false, order: 3 },
    ],
    hints: ['转速冲到 135 太快了', '背压不稳要查液压', '光加注射压不解决计量问题'],
  },
  {
    id: 'IF008',
    name: '干燥温度偏低（残水）',
    description: '干燥机温度仅 60°C 远低于 75-95，物料未充分干燥，下游含水率升高',
    affectedEquipments: ['DRY-201'],
    symptoms: [
      { equipmentId: 'DRY-201', param: 'dry_temp',     paramName: '干燥温度', value: 60,  unit: '°C',  normal: '75-95', trend: 'down' },
      { equipmentId: 'DRY-201', param: 'moisture_ppm', paramName: '含水率',   value: 520, unit: 'ppm', normal: '0-400', trend: 'up' },
    ],
    cause: '干燥机加热器故障或风机风量不足，热风温度未达设定值',
    steps: [
      { id: 's1', action: '提高干燥温度到 85°C', correct: true, order: 1 },
      { id: 's2', action: '检查干燥机加热丝与风机', correct: true, order: 2 },
      { id: 's3', action: '直接开始注塑', correct: false, order: 3 },
    ],
    hints: ['干燥温度只有 60°C 显然不够', '加热丝坏了或风量不足', '不烘干直接干会出银纹'],
  },
];
