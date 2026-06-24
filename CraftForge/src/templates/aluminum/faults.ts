import type { Fault } from '@/types';

// 电解铝车间典型故障库（12 个）
// 涵盖：阳极效应 / 滚铝 / 热不平衡 / 分子比 / 氧化铝 / 极距 / 阳极电流 / 下料 / 整流 / 烟气 / 抬包 / 漏炉
// 3 个含正反馈发散：EF001 阳极效应 / EF002 滚铝 / EF005 氧化铝浓度
export const aluminumFaults: Fault[] = [
  {
    id: 'EF001',
    name: '阳极效应（电压突跳）',
    description: 'CELL-101 槽电压突跳至 28V 远超正常 4.2V，槽噪声升至 180 mV，氧化铝浓度跌至 1.0 wt%',
    affectedEquipments: ['CELL-101'],
    symptoms: [
      { equipmentId: 'CELL-101', param: 'cell_voltage', paramName: '槽电压',   value: 28,   unit: 'V',   normal: '4.0-4.3', trend: 'up' },
      { equipmentId: 'CELL-101', param: 'alumina_conc',paramName: '氧化铝浓度', value: 1.0, unit: 'wt%', normal: '1.8-3.5', trend: 'down' },
      { equipmentId: 'CELL-101', param: 'noise_level', paramName: '槽噪声',     value: 180, unit: 'mV',  normal: '0-50',    trend: 'up' },
    ],
    cause: '氧化铝浓度过低，碳阳极上发生 C+2F⁻ → CF₄+2e⁻ 副反应，气泡覆盖阳极导致欧姆压降剧增',
    steps: [
      { id: 's1', action: '立即下料！氧化铝浓度补到 3.0 wt%', correct: true, order: 1 },
      { id: 's2', action: '降低极距 0.5 cm 帮助熄灭', correct: true, order: 2 },
      { id: 's3', action: '吹氮气搅拌电解质', correct: true, order: 3 },
      { id: 's4', action: '加大系列电流提高温度', correct: false, order: 4 },
    ],
    hints: [
      '电压 28V 是典型阳极效应，立即下料',
      '极距压一下让铝水和阳极接触熄灭气膜',
      '电流加大只会让效应更猛，反向操作',
    ],
    // 发散：氧化铝浓度继续往下掉，电压会更高
    divergence: {
      drivers: [
        { equipmentId: 'CELL-101', param: 'cell_voltage', rate: 0.5, cap: 50, delaySec: 30 },
      ],
    },
  },
  {
    id: 'EF002',
    name: '滚铝（铝水液面剧烈波动）',
    description: 'CELL-102 铝水高度从 20 cm 波动到 28 cm，槽噪声升至 120 mV，磁流体不稳',
    affectedEquipments: ['CELL-102'],
    symptoms: [
      { equipmentId: 'CELL-102', param: 'al_height',    paramName: '铝水高度', value: 28,  unit: 'cm', normal: '18-22', trend: 'up' },
      { equipmentId: 'CELL-102', param: 'noise_level',  paramName: '槽噪声',   value: 120, unit: 'mV', normal: '0-50',  trend: 'up' },
      { equipmentId: 'CELL-102', param: 'current_eff',  paramName: '电流效率', value: 88,  unit: '%',  normal: '92-96', trend: 'down' },
    ],
    cause: '槽内磁场分布失衡，铝液面被电磁力推动晃动，电流效率掉，热平衡破坏',
    steps: [
      { id: 's1', action: '降低系列电流 10 kA 减小磁压力', correct: true, order: 1 },
      { id: 's2', action: '抬包抽出 0.5 t 铝水降液面', correct: true, order: 2 },
      { id: 's3', action: '加大下料补充电解质组分', correct: false, order: 3 },
    ],
    hints: [
      '滚铝是磁流体不稳，先降电流',
      '把多余的铝水抽出来，液面降下来就稳了',
      '加料只会让槽更不稳，反向操作',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'CELL-102', param: 'al_height', rate: 0.05, cap: 35, delaySec: 30 },
      ],
    },
  },
  {
    id: 'EF003',
    name: '热不平衡（电解质温度过低）',
    description: 'CELL-102 电解质温度跌至 925°C（正常 945-965），分子比偏酸 2.18，电流效率下降',
    affectedEquipments: ['CELL-102'],
    symptoms: [
      { equipmentId: 'CELL-102', param: 'bath_temp',   paramName: '电解质温度', value: 925, unit: '°C',  normal: '945-965', trend: 'down' },
      { equipmentId: 'CELL-102', param: 'mol_ratio',   paramName: '分子比',     value: 2.18, unit: '',    normal: '2.3-2.5', trend: 'down' },
      { equipmentId: 'CELL-102', param: 'current_eff', paramName: '电流效率',   value: 89,   unit: '%',   normal: '92-96',   trend: 'down' },
    ],
    cause: '分子比偏酸导致电导率下降，槽体散热超过焦耳热产生，温度持续下降，有冻槽风险',
    steps: [
      { id: 's1', action: '添加 NaF 调高分子比到 2.4', correct: true, order: 1 },
      { id: 's2', action: '提高系列电流 5 kA 增加焦耳热', correct: true, order: 2 },
      { id: 's3', action: '降低电流让槽冷却', correct: false, order: 3 },
    ],
    hints: ['925°C 太冷，再低要冻槽', '加点纯碱把比例拉回 2.4', '电流再降槽就死了'],
  },
  {
    id: 'EF004',
    name: '分子比失调（偏碱）',
    description: 'CELL-101 分子比 2.62 远超正常 2.5，电解质温度飙至 975°C',
    affectedEquipments: ['CELL-101'],
    symptoms: [
      { equipmentId: 'CELL-101', param: 'mol_ratio', paramName: '分子比',     value: 2.62, unit: '',   normal: '2.3-2.5', trend: 'up' },
      { equipmentId: 'CELL-101', param: 'bath_temp', paramName: '电解质温度', value: 975,  unit: '°C', normal: '945-965', trend: 'up' },
    ],
    cause: 'AlF₃ 加少了或 Na2CO3 加多了，电解质碱性偏高，电导率上升带来过热',
    steps: [
      { id: 's1', action: '添加 AlF₃ 调低分子比到 2.4', correct: true, order: 1 },
      { id: 's2', action: '减少打壳频次降低 NaF 引入', correct: true, order: 2 },
      { id: 's3', action: '提高系列电流补热', correct: false, order: 3 },
    ],
    hints: ['分子比 2.62 偏碱，加 AlF₃', '槽温 975 太高，加电流更糟', '少打几次壳少进点 NaF'],
  },
  {
    id: 'EF005',
    name: '氧化铝浓度过低（阳极效应前兆）',
    description: 'CELL-102 氧化铝浓度跌至 1.3 wt%，槽噪声升至 80 mV，电压略升 0.15V，如不补料会触发阳极效应',
    affectedEquipments: ['CELL-102', 'AL-201'],
    symptoms: [
      { equipmentId: 'CELL-102', param: 'alumina_conc', paramName: '氧化铝浓度', value: 1.3, unit: 'wt%', normal: '1.8-3.5', trend: 'down' },
      { equipmentId: 'CELL-102', param: 'noise_level',  paramName: '槽噪声',     value: 80,  unit: 'mV',  normal: '0-50',    trend: 'up' },
      { equipmentId: 'AL-201',   param: 'feed_flow',    paramName: '料仓下料速率', value: 1.0, unit: 'kg/min', normal: '1.5-2.4', trend: 'down' },
    ],
    cause: '下料系统流量不足或料仓料位低，氧化铝消耗速度大于补充速度',
    steps: [
      { id: 's1', action: '提高下料速率到 2.2 kg/min', correct: true, order: 1 },
      { id: 's2', action: '提高流化风压改善下料', correct: true, order: 2 },
      { id: 's3', action: '加大系列电流补偿', correct: false, order: 3 },
    ],
    hints: ['浓度才 1.3，再降就阳极效应', '风压上去料就下得快', '电流加大消耗更快越糟'],
    // 发散：氧化铝浓度继续往下走（如果不补料），直至触发阳极效应阈值
    divergence: {
      drivers: [
        { equipmentId: 'CELL-102', param: 'alumina_conc', rate: -0.02, cap: 0.3, delaySec: 30 },
      ],
    },
  },
  {
    id: 'EF006',
    name: '极距过短（短路风险）',
    description: 'CELL-101 极距降至 3.2 cm 远低于正常 4.0-5.0，槽电压跌至 3.7V，短路预警',
    affectedEquipments: ['CELL-101'],
    symptoms: [
      { equipmentId: 'CELL-101', param: 'anode_distance', paramName: '极距',   value: 3.2, unit: 'cm', normal: '4.0-5.0', trend: 'down' },
      { equipmentId: 'CELL-101', param: 'cell_voltage',   paramName: '槽电压', value: 3.7, unit: 'V',  normal: '4.0-4.3', trend: 'down' },
    ],
    cause: '阳极更换后下放过深或铝水液面升高导致极距压缩',
    steps: [
      { id: 's1', action: '上提阳极 1 cm 恢复极距', correct: true, order: 1 },
      { id: 's2', action: '抬包抽 0.3 t 铝水降液面', correct: true, order: 2 },
      { id: 's3', action: '降低系列电流避免短路', correct: true, order: 3 },
      { id: 's4', action: '继续生产观察', correct: false, order: 4 },
    ],
    hints: ['极距 3.2 太近，会烧穿阳极', '抬阳极是最直接的办法', '铝水高也会压缩极距，抽点出来'],
  },
  {
    id: 'EF007',
    name: '阳极电流不均（局部过热）',
    description: 'CELL-102 阳极电流分布偏差 +18%，槽内热点温度高，预警阳极烧损',
    affectedEquipments: ['CELL-102'],
    symptoms: [
      { equipmentId: 'CELL-102', param: 'cell_voltage', paramName: '槽电压', value: 4.42, unit: 'V', normal: '4.0-4.3', trend: 'up' },
      { equipmentId: 'CELL-102', param: 'bath_temp',   paramName: '电解质温度', value: 970, unit: '°C', normal: '945-965', trend: 'up' },
      { equipmentId: 'CELL-102', param: 'noise_level', paramName: '槽噪声', value: 70,  unit: 'mV', normal: '0-50', trend: 'up' },
    ],
    cause: '某块阳极导电棒接触不良或阳极底部脱落，电流被迫流向其他阳极造成不均',
    steps: [
      { id: 's1', action: '检查阳极导电棒夹具', correct: true, order: 1 },
      { id: 's2', action: '更换异常阳极', correct: true, order: 2 },
      { id: 's3', action: '加大系列电流均匀化', correct: false, order: 3 },
    ],
    hints: ['阳极电流偏 18% 一定有阳极脱底', '夹具紧没紧得查', '加大电流让差的更差，别这么干'],
  },
  {
    id: 'EF008',
    name: '下料堵塞（打壳气缸失灵）',
    description: 'FEED-201 打壳频次降至 1 次/h，气缸压力 0.3 MPa（正常 0.5-0.7），下料中断',
    affectedEquipments: ['FEED-201', 'CELL-101'],
    symptoms: [
      { equipmentId: 'FEED-201', param: 'break_freq', paramName: '打壳频次', value: 1, unit: '次/h', normal: '4-10', trend: 'down' },
      { equipmentId: 'FEED-201', param: 'cylinder_p', paramName: '气缸压力', value: 0.3, unit: 'MPa', normal: '0.5-0.7', trend: 'down' },
      { equipmentId: 'FEED-201', param: 'feed_amount',paramName: '下料量',   value: 1.2, unit: 'kg/次', normal: '2-3', trend: 'down' },
    ],
    cause: '气缸压缩空气压力不足或气缸卡涩，打壳锤不能正常落下',
    steps: [
      { id: 's1', action: '检查压缩空气供气管路', correct: true, order: 1 },
      { id: 's2', action: '提高气缸压力到 0.6 MPa', correct: true, order: 2 },
      { id: 's3', action: '人工打壳临时维持', correct: true, order: 3 },
    ],
    hints: ['气压不够锤砸不下去', '人工打壳先维持', '气路上要么漏要么堵'],
  },
  {
    id: 'EF009',
    name: '整流机组档位异常（电流波动）',
    description: 'TRA-301 调压档位被误调至 26，二次电压飙至 1740V，系列电流冲至 540 kA',
    affectedEquipments: ['TRA-301'],
    symptoms: [
      { equipmentId: 'TRA-301', param: 'tap_position', paramName: '调压档位', value: 26, unit: '挡', normal: '14-22', trend: 'up' },
      { equipmentId: 'TRA-301', param: 'secondary_dc_volt', paramName: '二次直流电压', value: 1740, unit: 'V', normal: '1620-1700', trend: 'up' },
      { equipmentId: 'TRA-301', param: 'bus_current',  paramName: '系列总电流', value: 540, unit: 'kA', normal: '470-500', trend: 'up' },
    ],
    cause: '操作员误操作或档位机构卡死在过高档位，二次电压超出工艺设定',
    steps: [
      { id: 's1', action: '档位手动调回 18 挡', correct: true, order: 1 },
      { id: 's2', action: '检查档位电机和限位', correct: true, order: 2 },
      { id: 's3', action: '继续生产观察', correct: false, order: 3 },
    ],
    hints: ['档位 26 太高，硬挤大电流要烧槽', '回 18 挡再说', '电流大不是好事，电耗惊人'],
  },
  {
    id: 'EF010',
    name: 'HF 排放超标（环保警报）',
    description: '烟气 HF 浓度升至 6.5 mg/m³ 远超 3 上限，引风机频率仅 35 Hz 散热不足',
    affectedEquipments: ['FGT-301', 'CELL-101'],
    symptoms: [
      { equipmentId: 'FGT-301', param: 'hf_conc',   paramName: 'HF 浓度',   value: 6.5, unit: 'mg/m³', normal: '0-3', trend: 'up' },
      { equipmentId: 'FGT-301', param: 'fan_freq',  paramName: '引风机频率', value: 35,  unit: 'Hz',    normal: '40-48', trend: 'down' },
      { equipmentId: 'CELL-101', param: 'bath_temp', paramName: '电解质温度', value: 972, unit: '°C',   normal: '945-965', trend: 'up' },
    ],
    cause: '电解槽温度偏高使氟挥发增多，同时引风机频率不足净化效率下降',
    steps: [
      { id: 's1', action: '提高引风机频率到 45 Hz', correct: true, order: 1 },
      { id: 's2', action: '降低电解质温度（调电流/分子比）', correct: true, order: 2 },
      { id: 's3', action: '加大分子比让温度升高', correct: false, order: 3 },
    ],
    hints: ['HF 6.5 环保要罚款，立即处理', '风机频率拉到 45', '温度降下来氟就不挥发了'],
  },
  {
    id: 'EF011',
    name: '抬包真空泄漏（铝水抽不上来）',
    description: 'POT-202 真空度仅 -45 kPa（正常 -90~-65），真空泵电流飙至 65 A，铝水量不增',
    affectedEquipments: ['POT-202'],
    symptoms: [
      { equipmentId: 'POT-202',   param: 'vacuum_pressure', paramName: '抬包真空度', value: -45, unit: 'kPa', normal: '-95~-65', trend: 'up' },
      { equipmentId: 'POT-202',   param: 'vacuum_motor_a',  paramName: '真空泵电流', value: 65, unit: 'A', normal: '25-50', trend: 'up' },
      { equipmentId: 'POT-202',   param: 'al_metal_qty',    paramName: '铝水量', value: 2.8, unit: 't', normal: '3.5-5.0', trend: 'down' },
    ],
    cause: '抬包密封圈老化漏气或真空管路接头松动，泵满负荷也抽不上真空',
    steps: [
      { id: 's1', action: '检查抬包密封圈', correct: true, order: 1 },
      { id: 's2', action: '检查真空管路所有接头', correct: true, order: 2 },
      { id: 's3', action: '强行加大泵频率', correct: false, order: 3 },
    ],
    hints: ['真空才 -45，肯定漏气', '密封圈老化或接头松', '泵已经满电流，再压只会烧'],
  },
  {
    id: 'EF012',
    name: '⚠️ 槽底漏炉（重大事故）',
    description: 'CELL-102 母线温度突升至 110°C，电解质温度暴跌至 905°C，槽底炉衬可能击穿，立即停槽！',
    affectedEquipments: ['CELL-102'],
    symptoms: [
      { equipmentId: 'CELL-102', param: 'bus_temp',  paramName: '阴极母线温度', value: 110, unit: '°C', normal: '50-80',   trend: 'up' },
      { equipmentId: 'CELL-102', param: 'bath_temp', paramName: '电解质温度', value: 905, unit: '°C', normal: '945-965', trend: 'down' },
      { equipmentId: 'CELL-102', param: 'cell_voltage', paramName: '槽电压',  value: 3.5, unit: 'V',  normal: '4.0-4.3', trend: 'down' },
    ],
    cause: '槽底炉衬被熔体击穿，铝水/电解质渗漏到槽壳，与母线接触造成短路升温，重大事故',
    steps: [
      { id: 's1', action: '立即停槽！系列电流降至 0', correct: true, order: 1 },
      { id: 's2', action: '隔离 CELL-102 至旁路', correct: true, order: 2 },
      { id: 's3', action: '通知应急班组撤离', correct: true, order: 3 },
      { id: 's4', action: '继续观察等等看', correct: false, order: 4 },
    ],
    hints: [
      '母线 110°C 在烧，槽底已经漏了',
      '立即停槽别犹豫，命比产量重要',
      '人撤出去，喊调度切系列电源',
    ],
  },
];
