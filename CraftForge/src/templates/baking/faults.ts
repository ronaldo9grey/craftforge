import type { Fault } from '@/types';

// 阳极焙烧炉车间典型故障库（5 个 MVP）
// 涵盖：升温过快/温度梯度 / 燃料气波动 / 抽烟不畅 / 炉室漏气 / 焦床问题 — 涵盖焙烧 4 大调节维度
export const bakingFaults: Fault[] = [

  // ============ BK001 升温过快 / 温度梯度过大 ============
  {
    id: 'BK001',
    name: '升温过快·炉室温度梯度过大',
    description: '3 号炉室升温过快，左火道 1140°C / 右火道 1075°C，温差 65°C > 30°C 限制；阳极出现挥发分爆冲风险',
    affectedEquipments: ['BAKE-K3', 'GAS-701', 'FAN-401'],
    symptoms: [
      { equipmentId: 'BAKE-K3', param: 'flue_temp_l', paramName: '左火道温度', value: 1140, unit: '°C', normal: '1095-1125', trend: 'up' },
      { equipmentId: 'BAKE-K3', param: 'flue_temp_r', paramName: '右火道温度', value: 1075, unit: '°C', normal: '1095-1125', trend: 'down' },
      { equipmentId: 'BAKE-K3', param: 'gas_flow',    paramName: '燃料气流量', value: 165,  unit: 'm³/h', normal: '120-145', trend: 'up' },
      { equipmentId: 'HMI-902', param: 'max_dev',     paramName: '最大温差',   value: 65,   unit: '°C', normal: '0-20',     trend: 'up' },
    ],
    cause: '燃料气流量太大导致左火道过烧，同时抽烟不足右火道供气少温度低 → 温度梯度过大 → 阳极一边焦一边生 → 抗折强度差异 + 挥发分爆冲',
    steps: [
      { id: 's1', action: '把 3 号炉室燃料气流量从 165 降到 130 m³/h', correct: true, order: 1 },
      { id: 's2', action: '提高抽烟机转速到 1450 rpm 改善右火道供气', correct: true, order: 2 },
      { id: 's3', action: '继续加大燃料气把温度顶上去', correct: false, order: 3 },
      { id: 's4', action: '不管它，反正左边热右边凉差不多熟', correct: false, order: 4 },
    ],
    hints: [
      '左右火道温差 > 20°C 就是大问题，必须立刻干预',
      '燃料气大了反而温度梯度更大，要减小',
      '抽烟跟上才能让两侧气流均匀',
    ],
  },

  // ============ BK002 燃料气压力波动 ============
  {
    id: 'BK002',
    name: '燃料气压力波动·燃烧不稳',
    description: 'GAS-701 调压站输出压力在 6~15 kPa 之间波动（正常 8~12），波动幅度 50% > 30% 限制；3 号炉室温度上下波动 ±40°C',
    affectedEquipments: ['GAS-701', 'BAKE-K3'],
    symptoms: [
      { equipmentId: 'GAS-701', param: 'gas_pressure', paramName: '燃料气压力', value: 6.5,  unit: 'kPa',  normal: '8-12',     trend: 'down' },
      { equipmentId: 'BAKE-K3', param: 'room_temp',   paramName: '炉室温度',    value: 1050, unit: '°C', normal: '1085-1115', trend: 'down' },
      { equipmentId: 'BAKE-K3', param: 'gas_flow',    paramName: '燃料气流量',  value: 90,   unit: 'm³/h', normal: '120-145',  trend: 'down' },
    ],
    cause: '上游天然气母管压力波动 + 调压阀响应滞后 → 输出压力跟着波动 → 燃料气流量不稳 → 炉室温度跟着上下波动 → 焙烧曲线失控',
    steps: [
      { id: 's1', action: '把燃料气调压阀稳压到 10 kPa', correct: true, order: 1 },
      { id: 's2', action: '检查上游天然气母管压力 + 调度配气', correct: true, order: 2 },
      { id: 's3', action: '直接关闭燃料气避免波动', correct: false, order: 3 },
      { id: 's4', action: '加大流量到 200 m³/h 试试', correct: false, order: 4 },
    ],
    hints: [
      '调压阀稳压第一，压力稳了流量就稳',
      '关阀只能让炉室凉得更快，不解决问题',
      '上游压力波动要从调度配气解决',
    ],
  },

  // ============ BK003 抽烟不畅 / 黑烟外冒 ============
  {
    id: 'BK003',
    name: '抽烟不畅·烟道短路',
    description: 'FAN-401 转速正常 1380 rpm，但烟道负压只有 -120 Pa（正常 -300~-400）；2 号炉室盖周边冒黑烟，焙烧不充分',
    affectedEquipments: ['FAN-401', 'FLUE-301', 'BAKE-K2'],
    symptoms: [
      { equipmentId: 'FLUE-301', param: 'flue_pressure', paramName: '烟道负压',  value: -120, unit: 'Pa',   normal: '-400 ~ -200', trend: 'up' },
      { equipmentId: 'FAN-401',  param: 'suction_flow',  paramName: '抽气流量',  value: 5500, unit: 'm³/h', normal: '7500-9500',   trend: 'down' },
      { equipmentId: 'FAN-401',  param: 'fan_current',   paramName: '电机电流',  value: 70,   unit: 'A',    normal: '80-110',      trend: 'down' },
      { equipmentId: 'BAKE-K2',  param: 'room_temp',     paramName: '炉室温度',  value: 810,  unit: '°C',   normal: '830-920',     trend: 'down' },
    ],
    cause: '抽烟机入口烟道积焦 + 滤网堵塞 → 抽气流量上不去 → 炉室负压不足 → 燃烧产生的废气从炉盖缝隙外漏 → 黑烟外冒 + 炉室缺氧温度跌',
    steps: [
      { id: 's1', action: '提高抽烟机转速从 1380 到 1500 rpm', correct: true, order: 1 },
      { id: 's2', action: '清理抽烟机入口烟道积焦 + 更换滤网', correct: true, order: 2 },
      { id: 's3', action: '关小炉门让烟跑得更快', correct: false, order: 3 },
      { id: 's4', action: '加大燃料气燃烧把黑烟烧掉', correct: false, order: 4 },
    ],
    hints: [
      '负压不足首先想抽烟机，转速和管路两手抓',
      '关小炉门只会让里面更缺氧',
      '加大燃料气不解决根本，必须先恢复抽烟',
    ],
  },

  // ============ BK004 炉室漏气 / 保压失败 ============
  {
    id: 'BK004',
    name: '炉室漏气·保压失败',
    description: '1 号炉室保压试验显示泄漏率 8%/min > 5% 限制，怀疑炉门密封圈老化或耐火泥脱落；炉室温度爬升缓慢',
    affectedEquipments: ['BAKE-K1', 'FLUE-301'],
    symptoms: [
      { equipmentId: 'BAKE-K1',  param: 'room_temp',    paramName: '炉室温度', value: 450,  unit: '°C', normal: '480-560',     trend: 'down' },
      { equipmentId: 'BAKE-K1',  param: 'gas_flow',     paramName: '燃料气流量', value: 95, unit: 'm³/h', normal: '60-90',       trend: 'up' },
      { equipmentId: 'FLUE-301', param: 'flue_pressure',paramName: '烟道负压',  value: -180, unit: 'Pa', normal: '-400 ~ -200', trend: 'up' },
    ],
    cause: '1 号炉室炉门密封圈老化，热膨胀后留缝 → 冷空气吸入 → 炉室温度爬不上去 → 系统自动加大燃料气补偿 → 但漏气源不堵无济于事',
    steps: [
      { id: 's1', action: '紧固炉门密封圈 + 补涂耐火泥', correct: true, order: 1 },
      { id: 's2', action: '重新做保压试验确认泄漏率 < 5%/min', correct: true, order: 2 },
      { id: 's3', action: '直接加大燃料气到 150 m³/h 弥补', correct: false, order: 3 },
      { id: 's4', action: '提高烟道负压压住空气', correct: false, order: 4 },
    ],
    hints: [
      '漏气问题加大燃料气是耗能不解决根本',
      '密封圈老化必须更换或紧固',
      '保压试验是唯一标准',
    ],
  },

  // ============ BK005 焦床问题 / 阳极氧化 ============
  {
    id: 'BK005',
    name: '焦床塌陷·阳极局部氧化',
    description: 'COKE-801 焦床料位骤降到 30%，装炉时焦床厚度仅 60 mm < 80 mm 限制；2 号炉室出炉阳极发现表面 5 cm² 氧化区',
    affectedEquipments: ['COKE-801', 'BAKE-K2'],
    symptoms: [
      { equipmentId: 'COKE-801', param: 'coke_level',     paramName: '焦床料位',    value: 30, unit: '%',  normal: '50-90',  trend: 'down' },
      { equipmentId: 'COKE-801', param: 'coke_thickness', paramName: '装炉焦床厚度', value: 60, unit: 'mm', normal: '80-120', trend: 'down' },
      { equipmentId: 'HMI-903',  param: 'rejected',       paramName: '不合格数',    value: 6,  unit: '块', normal: '0-5',    trend: 'up' },
    ],
    cause: '焦床料仓供料不及时 + 装炉时焦床厚度不达标 → 焙烧过程中阳极顶部裸露 → 高温下与空气中 O₂ 反应 → 阳极表面被氧化 + 电阻率升高',
    steps: [
      { id: 's1', action: '把焦床料位补到 80% 以上', correct: true, order: 1 },
      { id: 's2', action: '装炉焦床厚度统一到 100 mm', correct: true, order: 2 },
      { id: 's3', action: '降低炉室温度避免氧化', correct: false, order: 3 },
      { id: 's4', action: '焦床薄就薄吧，反正都熟了', correct: false, order: 4 },
    ],
    hints: [
      '焦床是阳极的保护层，少一寸都不行',
      '降温会让阳极不熟，反而更糟',
      '焙烧好不好，三分靠工艺，七分靠焦床',
    ],
  },
];
