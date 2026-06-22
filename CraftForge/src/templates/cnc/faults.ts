import type { Fault } from '@/types';

// 数控加工车间故障库 v1：8 个典型场景，覆盖刀具/主轴/伺服/冷却/装夹/程序
// 每个故障字段保持与 FCC/焊装一致，便于通用评分引擎使用
export const cncFaults: Fault[] = [
  {
    id: 'CF001',
    name: '刀具异常磨损（崩刃风险）',
    description: '车床刀具切削过程出现异常振动，表面粗糙度恶化，疑似刀尖崩刃。',
    affectedEquipments: ['CNC-101'],
    symptoms: [
      { equipmentId: 'CNC-101',  param: 'tool_wear',  paramName: '刀具磨损',     value: 78,  unit: '%',    normal: '0-60',    trend: 'up' },
      { equipmentId: 'CNC-101',  param: 'vibration',  paramName: '振动值',       value: 4.8, unit: 'mm/s', normal: '0-2.5',   trend: 'up' },
      { equipmentId: 'INST-201', param: 'surface_ra', paramName: '表面粗糙度',   value: 5.2, unit: 'μm',   normal: '0.8-3.2', trend: 'up' },
    ],
    cause: '刀具达到寿命极限或加工参数过激（高转速+大进给）导致刀尖崩损，振动剧增使粗糙度恶化。',
    steps: [
      { id: 's1', order: 1, action: '降低主轴进给倍率到 50%', correct: true },
      { id: 's2', order: 2, action: '暂停加工，检查并更换刀片', correct: true },
      { id: 's3', order: 3, action: '继续加工只为完成节拍', correct: false },
    ],
    hints: ['振动 4.8 mm/s 已经超危险线', '别硬撑，崩刃可能损伤工件甚至主轴', '建议先减载再停机换刀'],
  },
  {
    id: 'CF002',
    name: '主轴温升异常',
    description: '铣床主轴温度持续上升，主轴负载偏高，疑似轴承润滑不良或冷却失效。',
    affectedEquipments: ['CNC-102'],
    symptoms: [
      { equipmentId: 'CNC-102', param: 'spindle_temp', paramName: '主轴温度', value: 78, unit: '°C', normal: '35-60', trend: 'up' },
      { equipmentId: 'CNC-102', param: 'spindle_load', paramName: '主轴负载', value: 88, unit: '%',  normal: '30-75', trend: 'up' },
    ],
    cause: '主轴轴承润滑不足或冷却液没有送到主轴箱，导致温升过快，进一步影响精度。',
    steps: [
      { id: 's1', order: 1, action: '检查冷却液泵是否正常', correct: true },
      { id: 's2', order: 2, action: '降低主轴转速到 60%', correct: true },
      { id: 's3', order: 3, action: '加大切深快速完工', correct: false },
    ],
    hints: ['主轴超 75°C 就要警觉', '先看冷却液送没送到', '硬干会烧主轴轴承'],
  },
  {
    id: 'CF003',
    name: '冷却液流量不足',
    description: '冷却液流量明显下降，可能堵塞或液位低，会引起刀具与工件双重过热。',
    affectedEquipments: ['PMP-201', 'CNC-101', 'CNC-102'],
    symptoms: [
      { equipmentId: 'PMP-201', param: 'coolant_flow',     paramName: '冷却液流量', value: 4,   unit: 'L/min', normal: '10-16', trend: 'down' },
      { equipmentId: 'PMP-201', param: 'coolant_pressure', paramName: '冷却压力',   value: 0.15, unit: 'MPa',  normal: '0.3-0.6', trend: 'down' },
    ],
    cause: '冷却液箱液位低、过滤器堵塞或泵故障，导致刀具切削区缺冷却。',
    steps: [
      { id: 's1', order: 1, action: '检查冷却液箱液位与过滤器', correct: true },
      { id: 's2', order: 2, action: '清理过滤器或补液后重启泵', correct: true },
      { id: 's3', order: 3, action: '继续高速加工等之后处理', correct: false },
    ],
    hints: ['流量已掉到 4 L/min，正常 10+', '冷却不到位刀具马上崩', '先停机查液位'],
  },
  {
    id: 'CF004',
    name: '夹具夹紧力不足',
    description: '工件夹紧力低于工艺要求，加工时可能发生工件松动甚至飞出。',
    affectedEquipments: ['FIX-201'],
    symptoms: [
      { equipmentId: 'FIX-201',  param: 'clamp_force',    paramName: '夹紧力',     value: 5500, unit: 'N',  normal: '7500-9500', trend: 'down' },
      { equipmentId: 'FIX-201',  param: 'concentricity',  paramName: '同心度',     value: 0.12, unit: 'mm', normal: '0-0.05',    trend: 'up' },
    ],
    cause: '液压夹紧系统压力不足或卡爪磨损，导致夹紧力下降，工件容易在切削力下偏移。',
    steps: [
      { id: 's1', order: 1, action: '立即停机检查液压夹紧压力', correct: true },
      { id: 's2', order: 2, action: '更换或调整夹具卡爪', correct: true },
      { id: 's3', order: 3, action: '直接降低进给继续干', correct: false },
    ],
    hints: ['夹紧 5500N 已低于工艺线', '工件飞出风险，必须停机', '同心度 0.12 已严重超差'],
  },
  {
    id: 'CF005',
    name: '伺服失步（位置偏差）',
    description: '车床切削过程中位置偏差报警，疑似伺服失步或机械干涉。',
    affectedEquipments: ['CNC-101', 'CTRL-201'],
    symptoms: [
      { equipmentId: 'CNC-101',  param: 'vibration',  paramName: '振动值',     value: 6.5, unit: 'mm/s', normal: '0-2.5', trend: 'up' },
      { equipmentId: 'CTRL-201', param: 'comm_status',paramName: '通讯状态',   value: 0,   unit: '',     normal: '1',     trend: 'down' },
    ],
    cause: '伺服驱动过载或编码器反馈丢失，导致实际位置与指令位置偏差超过容差。',
    steps: [
      { id: 's1', order: 1, action: '紧急停机，复位伺服报警', correct: true },
      { id: 's2', order: 2, action: '检查编码器线缆与机械限位', correct: true },
      { id: 's3', order: 3, action: '强行继续加工以免停产', correct: false },
    ],
    hints: ['通讯状态 0，已经断了', '振动 6.5 mm/s 极度危险', '先复位再排查'],
  },
  {
    id: 'CF006',
    name: '切削参数过激（飞屑/异响）',
    description: '加工参数过高引起主轴负载与振动同步飙升，伴随明显异响。',
    affectedEquipments: ['CNC-102'],
    symptoms: [
      { equipmentId: 'CNC-102', param: 'spindle_load', paramName: '主轴负载', value: 92,  unit: '%',    normal: '30-75', trend: 'up' },
      { equipmentId: 'CNC-102', param: 'vibration',    paramName: '振动值',   value: 5.5, unit: 'mm/s', normal: '0-2.5', trend: 'up' },
      { equipmentId: 'HMI-201', param: 'override',     paramName: '进给倍率', value: 170, unit: '%',    normal: '80-120', trend: 'up' },
    ],
    cause: '操作员手动把进给倍率拉到 170%，超出工艺设计余量，引起负载与振动急剧上升。',
    steps: [
      { id: 's1', order: 1, action: '将进给倍率回到 100%', correct: true },
      { id: 's2', order: 2, action: '观察振动与负载是否回稳', correct: true },
      { id: 's3', order: 3, action: '关闭振动监测继续加工', correct: false },
    ],
    hints: ['倍率 170% 太激进', '把倍率压回 100%', '别关报警，听机床'],
  },
  {
    id: 'CF007',
    name: '排屑器堵塞',
    description: '排屑器负载持续升高，速度下降，切屑可能堆积影响机床散热。',
    affectedEquipments: ['CONV-201'],
    symptoms: [
      { equipmentId: 'CONV-201', param: 'chip_load',  paramName: '切屑负载', value: 88, unit: '%',     normal: '0-70', trend: 'up' },
      { equipmentId: 'CONV-201', param: 'conv_speed', paramName: '排屑速度', value: 0.1, unit: 'm/min', normal: '0.3-1.0', trend: 'down' },
    ],
    cause: '长切屑或铝屑缠绕排屑器，导致传送负载剧增、速度下降甚至卡死。',
    steps: [
      { id: 's1', order: 1, action: '停止排屑器并清理切屑', correct: true },
      { id: 's2', order: 2, action: '检查切削参数，避免长屑', correct: true },
      { id: 's3', order: 3, action: '直接加速排屑器电机', correct: false },
    ],
    hints: ['速度都掉到 0.1 m/min', '硬转电机要烧', '人工清屑后再排查'],
  },
  {
    id: 'CF008',
    name: '加工尺寸超差',
    description: '在线测量显示工件尺寸偏差超出公差带，合格率下降。',
    affectedEquipments: ['INST-201', 'CNC-101'],
    symptoms: [
      { equipmentId: 'INST-201', param: 'dimension_error', paramName: '尺寸偏差', value: 0.12, unit: 'mm', normal: '-0.05~0.05', trend: 'up' },
      { equipmentId: 'INST-201', param: 'pass_rate',       paramName: '合格率',   value: 78,   unit: '%',  normal: '95-100',     trend: 'down' },
      { equipmentId: 'CNC-101',  param: 'tool_wear',       paramName: '刀具磨损', value: 65,   unit: '%',  normal: '0-60',       trend: 'up' },
    ],
    cause: '刀具达到寿命，磨损量增加，未及时刀补，导致工件尺寸单边偏大。',
    steps: [
      { id: 's1', order: 1, action: '查看刀具磨损值并执行刀补', correct: true },
      { id: 's2', order: 2, action: '更换新刀片重新对刀', correct: true },
      { id: 's3', order: 3, action: '继续生产，等合格率自然回升', correct: false },
    ],
    hints: ['合格率 78% 已是大事', '刀具磨损 65% 该刀补了', '靠"等"是修不好的'],
  },
];
