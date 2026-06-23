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

  // ============================================================
  // v3 新增：4 个新设备故障（涵盖 ROB / MTC / CONV-201 / CONV-202）
  // ============================================================
  {
    id: 'IF009',
    name: '模温机失效（模具偏冷）',
    description: '模温机实际温度跌至 30°C 远低于设定 60°C，模具温度连锁降到 35°C，制品出现缩痕和欠注',
    affectedEquipments: ['MTC-301', 'MOLD-201', 'INST-201'],
    symptoms: [
      { equipmentId: 'MTC-301',  param: 'mtc_actual_temp', paramName: '模温机实际温度', value: 30, unit: '°C', normal: '45-80', trend: 'down' },
      { equipmentId: 'MTC-301',  param: 'mtc_flow',        paramName: '模温机循环流量', value: 5,  unit: 'L/min', normal: '10-16', trend: 'down' },
      { equipmentId: 'MOLD-201', param: 'mold_temp',       paramName: '模具温度',       value: 35, unit: '°C', normal: '45-75', trend: 'down' },
    ],
    cause: '模温机循环泵故障或加热器烧坏，模具温度无法维持设定值',
    steps: [
      { id: 's1', action: '检查模温机循环泵和加热器', correct: true, order: 1 },
      { id: 's2', action: '提高模温机设定温度到 70°C', correct: true, order: 2 },
      { id: 's3', action: '继续生产观察', correct: false, order: 3 },
    ],
    hints: ['模温只有 30°C 没法成型', '循环流量只有 5 L/min，泵肯定有问题', '光设高温没用，循环泵不动白搭'],
  },
  {
    id: 'IF010',
    name: '机械手吸盘真空不足（脱件/卡死）',
    description: '取件机械手真空度从 -85 升至 -40 kPa（真空度变弱），取件成功率从 99% 降到 75%，制品脱落造成模具堵',
    affectedEquipments: ['ROB-201', 'ST-202'],
    symptoms: [
      { equipmentId: 'ROB-201', param: 'vacuum_pressure', paramName: '吸盘真空度', value: -40, unit: 'kPa', normal: '-95~-70', trend: 'up' },
      { equipmentId: 'ROB-201', param: 'pick_success',   paramName: '取件成功率', value: 75,  unit: '%',   normal: '97-100', trend: 'down' },
      { equipmentId: 'ST-202',  param: 'pass_rate',      paramName: '合格率',     value: 88,  unit: '%',   normal: '95-100', trend: 'down' },
    ],
    cause: '吸盘老化漏气或真空泵故障，无法维持设定真空度，制品反复脱落',
    steps: [
      { id: 's1', action: '检查吸盘密封圈是否破损', correct: true, order: 1 },
      { id: 's2', action: '检查真空泵和真空管路', correct: true, order: 2 },
      { id: 's3', action: '加快机械手速度补偿', correct: false, order: 3 },
    ],
    hints: ['真空度 -40 kPa 根本吸不住', '十有八九是吸盘老化漏气', '速度快反而更容易脱'],
    // 正反馈发散：吸盘老化随时间加重，真空度继续走弱
    divergence: {
      drivers: [
        { equipmentId: 'ROB-201', param: 'vacuum_pressure', rate: 0.5, cap: -20, delaySec: 30 },
      ],
    },
  },
  {
    id: 'IF011',
    name: '上料输送带堵料（短射风险）',
    description: '上料带速度跌至 0.2 m/min，上料速率仅 3 kg/h 远低于正常 12，料斗料位缓慢下降，预警短射',
    affectedEquipments: ['CONV-201', 'HOP-201'],
    symptoms: [
      { equipmentId: 'CONV-201', param: 'conveyor_speed', paramName: '上料带速度', value: 0.2, unit: 'm/min', normal: '0.5-1.2', trend: 'down' },
      { equipmentId: 'CONV-201', param: 'feed_rate',      paramName: '上料速率',   value: 3,   unit: 'kg/h',  normal: '8-18', trend: 'down' },
      { equipmentId: 'HOP-201',  param: 'hopper_level',   paramName: '料斗料位',   value: 28,  unit: '%',    normal: '30-90', trend: 'down' },
    ],
    cause: '输送带颗粒卡死或电机过载，物料无法持续供给',
    steps: [
      { id: 's1', action: '停机清理输送带卡料', correct: true, order: 1 },
      { id: 's2', action: '检查电机电流和驱动器', correct: true, order: 2 },
      { id: 's3', action: '提高干燥温度补救', correct: false, order: 3 },
    ],
    hints: ['带速才 0.2，肯定卡料了', '上料 3 kg/h 一会就没料注射', '清完料再开机，别硬转'],
  },
  {
    id: 'IF012',
    name: '成品输送带停转（制品堆积）',
    description: '成品输送带速度降至 0.1 m/min（接近停止），在途制品堆积至 32 件超出 normal 30，机械手放件区拥堵',
    affectedEquipments: ['CONV-202', 'ROB-201'],
    symptoms: [
      { equipmentId: 'CONV-202', param: 'conveyor_speed', paramName: '成品带速度', value: 0.1, unit: 'm/min', normal: '0.4-1.0', trend: 'down' },
      { equipmentId: 'CONV-202', param: 'product_count',  paramName: '在途制品数', value: 32,  unit: '件',    normal: '0-30', trend: 'up' },
    ],
    cause: '输送带驱动电机故障或张紧轮卡死，制品无法及时下线导致堆积',
    steps: [
      { id: 's1', action: '检查驱动电机和张紧轮', correct: true, order: 1 },
      { id: 's2', action: '清理堆积制品', correct: true, order: 2 },
      { id: 's3', action: '加快机械手取件', correct: false, order: 3 },
    ],
    hints: ['带子不转才 0.1，电机十有八九坏了', '堆 32 件了机械手放不下来', '快取没用，下游卡了越堆越多'],
  },
];
