import type { Fault } from '@/types';

// 阳极振压成型车间典型故障库（5 个 MVP）
// 涵盖：裂纹 / 起鼓 / 缺角 / 密度低 / 粘模 — 涵盖糊料温度/真空度/模具温度/振压参数 4 大调节维度
export const anodeFaults: Fault[] = [
  {
    id: 'AN001',
    name: '生阳极表面裂纹（糊料温度偏低）',
    description: 'FORM-201 出件后表面出现 5~15 mm 长裂纹，糊料温度仅 132°C，模具温度 115°C',
    affectedEquipments: ['FORM-201', 'PASTE-101', 'MHT-501'],
    symptoms: [
      { equipmentId: 'PASTE-101', param: 'paste_temp',     paramName: '糊料温度',     value: 132, unit: '°C', normal: '145-155', trend: 'down' },
      { equipmentId: 'FORM-201',  param: 'mold_temp',      paramName: '模具温度',     value: 115, unit: '°C', normal: '130-145', trend: 'down' },
      { equipmentId: 'MHT-501',   param: 'mold_pre_temp',  paramName: '模具预热温度', value: 115, unit: '°C', normal: '130-145', trend: 'down' },
      { equipmentId: 'HMI-802',   param: 'qc_ratio',       paramName: '合格率',       value: 72, unit: '%',  normal: '92-100',  trend: 'down' },
    ],
    cause: '糊料温度过低 → 沥青粘度大、流动性差 → 振压时颗粒间结合不充分 → 脱模后表面应力集中处开裂',
    steps: [
      { id: 's1', action: '把糊料温度从 132°C 升到 150°C', correct: true, order: 1 },
      { id: 's2', action: '模具预热到 135°C 以上', correct: true, order: 2 },
      { id: 's3', action: '继续加大振压压力到 1350 t 试试', correct: false, order: 3 },
      { id: 's4', action: '降低糊料温度避免起鼓', correct: false, order: 4 },
    ],
    hints: [
      '糊料温度低于 140°C 就是开裂高发区，先升温',
      '模具冷糊料骤冷一定裂，先把模具暖起来',
      '加大压力裂得更厉害',
    ],
  },
  {
    id: 'AN002',
    name: '阳极顶部起鼓（真空度不足）',
    description: 'FORM-201 出件后阳极顶部明显凸起 8 mm，内部检测发现大量气孔，真空泵绝压 12 kPa',
    affectedEquipments: ['FORM-201', 'VAC-601'],
    symptoms: [
      { equipmentId: 'VAC-601',   param: 'vac_pressure', paramName: '绝对压力',   value: 12, unit: 'kPa', normal: '1.0-5.0', trend: 'up' },
      { equipmentId: 'VAC-601',   param: 'vac_flow',     paramName: '抽气流量',   value: 90, unit: 'm³/h', normal: '150-250', trend: 'down' },
      { equipmentId: 'FORM-201',  param: 'press_time',   paramName: '振压时间',   value: 75, unit: 's', normal: '90-110', trend: 'down' },
      { equipmentId: 'FORM-201',  param: 'block_dens',   paramName: '生阳极密度', value: 1.51, unit: 'g/cm³', normal: '1.58-1.65', trend: 'down' },
    ],
    cause: '真空泵抽气不足，糊料内气体无法排出，振压时压缩气体在内部形成气泡，脱模后膨胀起鼓',
    steps: [
      { id: 's1', action: '检查真空管路有无泄漏，把绝压打到 3 kPa', correct: true, order: 1 },
      { id: 's2', action: '振压时间延长到 110 s 充分排气', correct: true, order: 2 },
      { id: 's3', action: '提高糊料温度让气泡更容易冒', correct: false, order: 3 },
      { id: 's4', action: '降低振压压力让气泡跑出来', correct: false, order: 4 },
    ],
    hints: [
      '绝压 12 kPa 远超 5 kPa 红线，先解决真空',
      '延长振压时间给气泡更多排出时间',
      '糊料温度升了气泡更多不是更少',
    ],
  },
  {
    id: 'AN003',
    name: '生阳极缺角（模具温度过低）',
    description: 'FORM-201 出件后阳极 4 个棱角中 2 个出现缺料/掉块，模具温度仅 95°C，脱模剂涂层不均',
    affectedEquipments: ['FORM-201', 'MHT-501'],
    symptoms: [
      { equipmentId: 'FORM-201',  param: 'mold_temp',     paramName: '模具温度',     value: 95,  unit: '°C', normal: '130-145', trend: 'down' },
      { equipmentId: 'MHT-501',   param: 'mold_pre_temp', paramName: '模具预热温度', value: 95,  unit: '°C', normal: '130-145', trend: 'down' },
      { equipmentId: 'MHT-501',   param: 'heat_power',    paramName: '加热功率',     value: 28,  unit: 'kW', normal: '50-80',   trend: 'down' },
      { equipmentId: 'HMI-802',   param: 'qc_ratio',      paramName: '合格率',       value: 80, unit: '%',  normal: '92-100',  trend: 'down' },
    ],
    cause: '模具温度过低导致接触模具棱角的糊料瞬间冷却硬化，强度不够，脱模时棱角碎裂',
    steps: [
      { id: 's1', action: '加热功率从 28 kW 提到 70 kW', correct: true, order: 1 },
      { id: 's2', action: '把模具预热温度提到 135°C', correct: true, order: 2 },
      { id: 's3', action: '脱模剂喷涂均匀（车间补这一步）', correct: true, order: 3 },
      { id: 's4', action: '增加振压压力让糊料填满棱角', correct: false, order: 4 },
    ],
    hints: [
      '95°C 模具碰糊料就硬，必然缺角',
      '加热功率压一下就上来了',
      '加大压力只会让脆性棱角崩得更狠',
    ],
  },
  {
    id: 'AN004',
    name: '生阳极密度偏低（振压不充分）',
    description: 'FORM-201 出件密度仅 1.48 g/cm³（标准 1.58-1.65），振压时间 60 s、压力 1100 t',
    affectedEquipments: ['FORM-201'],
    symptoms: [
      { equipmentId: 'FORM-201', param: 'block_dens',  paramName: '生阳极密度', value: 1.48, unit: 'g/cm³', normal: '1.58-1.65', trend: 'down' },
      { equipmentId: 'FORM-201', param: 'press_time',  paramName: '振压时间',   value: 60,   unit: 's', normal: '90-110', trend: 'down' },
      { equipmentId: 'FORM-201', param: 'press_force', paramName: '振压压力',   value: 1100, unit: 't', normal: '1250-1300', trend: 'down' },
      { equipmentId: 'FORM-201', param: 'vib_freq',    paramName: '振动频率',   value: 38,   unit: 'Hz', normal: '45-55',   trend: 'down' },
    ],
    cause: '振压时间不够、压力不足、振动能量低，糊料未充分振实，颗粒间残留空隙，密度低后续焙烧电阻率会偏高',
    steps: [
      { id: 's1', action: '振压时间提到 100 s', correct: true, order: 1 },
      { id: 's2', action: '振压压力提到 1280 t', correct: true, order: 2 },
      { id: 's3', action: '振动频率调到 50 Hz', correct: true, order: 3 },
      { id: 's4', action: '密度低就再加沥青比例', correct: false, order: 4 },
    ],
    hints: [
      '60 s 远不够振实，给到 100 s',
      '1100 t 振压力小了，提到 1280 t',
      '振动频率 38 Hz 是低频不来劲，给到 50',
    ],
  },
  {
    id: 'AN005',
    name: '阳极粘模脱模困难（模具温度过高 + 脱模剂不足）',
    description: 'FORM-201 振压结束后阳极粘在模具内壁拔不出来，模具温度 168°C 超标，脱模剂残量 5%',
    affectedEquipments: ['FORM-201', 'MHT-501'],
    symptoms: [
      { equipmentId: 'FORM-201',  param: 'mold_temp',     paramName: '模具温度',     value: 168, unit: '°C', normal: '130-145', trend: 'up' },
      { equipmentId: 'MHT-501',   param: 'mold_pre_temp', paramName: '模具预热温度', value: 168, unit: '°C', normal: '130-145', trend: 'up' },
      { equipmentId: 'MHT-501',   param: 'heat_power',    paramName: '加热功率',     value: 105, unit: 'kW', normal: '50-80',   trend: 'up' },
      { equipmentId: 'PASTE-101', param: 'paste_temp',    paramName: '糊料温度',     value: 162, unit: '°C', normal: '145-155', trend: 'up' },
    ],
    cause: '模具温度过高使糊料表面沥青熔融粘附内壁，加之脱模剂不足，脱模阻力剧增导致粘模',
    steps: [
      { id: 's1', action: '加热功率从 105 kW 降到 65 kW', correct: true, order: 1 },
      { id: 's2', action: '模具温度先冷却到 140°C 再压下一块', correct: true, order: 2 },
      { id: 's3', action: '补充脱模剂喷涂量 1.5 倍', correct: true, order: 3 },
      { id: 's4', action: '加大振压压力强行脱模', correct: false, order: 4 },
    ],
    hints: [
      '168°C 模具就跟糊料粘起来了，赶紧降温',
      '脱模剂喷涂量加大一倍',
      '加大压力会把阳极顶碎',
    ],
  },
];
