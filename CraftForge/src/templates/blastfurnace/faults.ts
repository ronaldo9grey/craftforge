import type { Fault } from '@/types';

// 高炉炼铁 3 类核心故障
// 严格按已批准的时间轴 SOP 编排；expertPath 通过 hints[] 落地为可读的"专家路径"
// 易错点检测通过 hints 里"⚠️" 前缀 + steps 中 correct=false 的错误动作实现

export const blastfurnaceFaults: Fault[] = [
  // ============= 故障 1：炉凉（cold-furnace）=============
  // 场景：铁水温度骤降到 1440，如果不及时增加焦比 + 加大风量，炉子会越走越凉
  // 专家 S 级路径 7 步 4 分钟：
  //   T=0s   view TAP-HOLE
  //   T=5s   pause 25s（观察走势）
  //   T=30s  action COKE-RATIO 0.42 → 0.48（加焦增热）
  //   T=31s  pause 60s（等焦炭下到风口区）
  //   T=91s  action MAF 3200 → 3600（加风助燃）
  //   T=92s  pause 90s
  //   T=182s 通关（T-tap 回到 1480）
  {
    id: 'BFF001',
    name: '炉凉（cold-furnace）',
    description:
      '铁水温度骤降到 1440°C，炉腹温度也开始往下滑。原因通常是焦炭下料不足或原料水分骤增，' +
      '若不及时加焦提热、加风助燃，炉子会越走越凉，最终导致铁水冻堵出铁口。',
    cause: '焦比连续几炉偏低 + 原料含水量偏高，风口燃烧强度下降，热量不够。',
    affectedEquipments: ['TAP-HOLE', 'BF-BODY', 'CHARGE', 'BLOWER'],
    symptoms: [
      { equipmentId: 'TAP-HOLE', param: 'T-tap',      paramName: '铁水温度',   value: 1440, unit: '°C', normal: '1450-1510', trend: 'down' },
      { equipmentId: 'BF-BODY',  param: 'T-body',     paramName: '炉腹温度',   value: 1455, unit: '°C', normal: '1450-1520', trend: 'down' },
      { equipmentId: 'CHARGE',   param: 'COKE-RATIO', paramName: '焦比',       value: 0.40, unit: '',   normal: '0.35-0.55', trend: 'down' },
    ],
    steps: [
      // 专家 S 级路径 —— 严格按时间轴顺序
      { id: 's1', action: '观察出铁口铁水温度走势 25 秒',                 correct: true,  order: 1 },
      { id: 's2', action: '把焦比 COKE-RATIO 从 0.42 提到 0.48',           correct: true,  order: 2 },
      { id: 's3', action: '等 60 秒让焦炭下到风口区起效',                  correct: true,  order: 3 },
      { id: 's4', action: '把风量 MAF 从 3200 加到 3600 Nm³/min',          correct: true,  order: 4 },
      // 易错动作 —— skip_observe：焦炭还没下到风口就急着加风，冷炉再灌冷空气
      { id: 's5', action: '不等观察直接加大风量（错误：给冷炉灌冷空气）', correct: false, order: 5 },
      { id: 's6', action: '强行开出铁口继续放铁（错误：越放越凉）',        correct: false, order: 6 },
    ],
    hints: [
      // hints 承担"专家路径 + 易错点提示"两个职责
      '专家 S 级路径：view TAP-HOLE(0s) → 观察 25s → 加焦到 0.48(30s) → 等 60s → 加风到 3600(91s) → 观察 90s → 通关(182s)',
      '炉凉抢救原则：先加焦增热，再加风助燃 —— 顺序不能反',
      '⚠️ 易错点(skip_observe)：焦炭没下到底就加风等于给冷炉子灌冷空气',
    ],
    divergence: {
      drivers: [
        // 不干预时铁水温度继续下滑；炉腹也跟着凉
        { equipmentId: 'TAP-HOLE', param: 'T-tap',  rate: -0.25, cap: 1380, delaySec: 20 },
        { equipmentId: 'BF-BODY',  param: 'T-body', rate: -0.15, cap: 1400, delaySec: 25 },
      ],
    },
  },

  // ============= 故障 2：悬料（hanging-furnace）=============
  // 场景：料线卡在 1.2m 不动，炉腹温度反常上升 —— 高危故障
  // 专家 S 级路径 5 步 2.5 分钟：
  //   T=0s   view PROBE-1
  //   T=3s   action MAF 3800 → 2800（立即降风）
  //   T=4s   pause 45s
  //   T=49s  action STACK 打开泄压
  //   T=50s  pause 60s
  //   T=110s view PROBE-1
  //   T=140s 通关
  // 惩罚：若 60s 内没有降风 → critical missing → "你差点把老三高炉给炸了！"
  {
    id: 'BFF002',
    name: '悬料（hanging-furnace）',
    description:
      '⚠️ 高危故障：探尺显示料线卡在 1.2m 不再下降，同时炉腹温度反常上升。' +
      '这是炉料在炉喉部位"结拱"支撑住了，下方风口继续燃烧却没有新料补充，' +
      '如果不立即降风+泄压，压力憋高后极易发生"崩料"事故，甚至炸炉。',
    cause: '入炉料水分偏高结成料块 + 布料不均，在炉喉形成机械支撑（悬料结拱）。',
    affectedEquipments: ['PROBE-1', 'BF-BODY', 'BLOWER', 'STACK'],
    symptoms: [
      { equipmentId: 'PROBE-1', param: 'STOCK-LINE', paramName: '料线',       value: 1.2,  unit: 'm',       normal: '0.5-2.5', trend: 'up' },
      { equipmentId: 'BF-BODY', param: 'T-body',    paramName: '炉腹温度',   value: 1545, unit: '°C',      normal: '1450-1520', trend: 'up' },
      { equipmentId: 'BF-BODY', param: 'P-top',     paramName: '炉顶压力',   value: 280,  unit: 'kPa',     normal: '180-260', trend: 'up' },
      { equipmentId: 'BLOWER',  param: 'MAF',      paramName: '风量',       value: 3800, unit: 'Nm³/min', normal: '3000-4200', trend: 'up' },
    ],
    steps: [
      // 专家 S 级路径 —— 5 步紧急处置
      { id: 's1', action: '立即观察探尺料线情况',                          correct: true,  order: 1 },
      { id: 's2', action: '立即把风量 MAF 从 3800 降到 2800 Nm³/min',      correct: true,  order: 2 },
      { id: 's3', action: '等 45 秒让炉内压力回落',                        correct: true,  order: 3 },
      { id: 's4', action: '打开排烟囱泄压阀释放炉顶压力',                  correct: true,  order: 4 },
      { id: 's5', action: '再观察料线是否恢复下降',                        correct: true,  order: 5 },
      // 易错动作 —— critical_missing：不降风继续硬吹
      { id: 's6', action: '不降风继续加大风量强行吹通（致命错误）',        correct: false, order: 6 },
      { id: 's7', action: '继续加大装料量堆料（错误：越堆越死）',          correct: false, order: 7 },
    ],
    hints: [
      '专家 S 级路径：view PROBE-1(0s) → 降风到 2800(3s) → 等 45s → 打开泄压(49s) → 等 60s → 观察料线(110s) → 通关(140s)',
      '悬料铁律：先降风，再泄压，绝不能硬吹！',
      '⚠️ 易错点(critical_missing)：悬料未降风 → 崩料事故 → "你差点把老三高炉给炸了！"',
    ],
    divergence: {
      drivers: [
        // 不降风的话炉腹温度和压力都会失控上升
        { equipmentId: 'BF-BODY', param: 'T-body', rate: 0.4,  cap: 1650, delaySec: 15 },
        { equipmentId: 'BF-BODY', param: 'P-top',  rate: 1.2,  cap: 340,  delaySec: 10 },
      ],
    },
  },

  // ============= 故障 3：出铁口结瘤（tap-hole-cake）=============
  // 场景：出铁口冷铁瘤堵住半截，装载速率降 50%
  // 专家 S 级路径 6 步 5.5 分钟：
  //   T=0s   view TAP-HOLE
  //   T=8s   action T-blast 1050 → 1150（提高送风温度）
  //   T=9s   pause 120s
  //   T=129s view T-tap（确认铁水温度）
  //   T=135s action 泥炮打开 TAP-HOLE（工艺按钮，学员在参数面板执行）
  //   T=136s pause 60s
  //   T=196s view
  //   T=330s 通关
  // 惩罚：铁水温度不到 1450 就敲炮 → wrong_order → "1380 度你敲什么！凉铁堵得更死"
  {
    id: 'BFF003',
    name: '出铁口结瘤（tap-hole-cake）',
    description:
      '出铁口内壁积起了一层冷铁瘤，铁水流量降到平时的一半，鱼雷罐车装载速率明显变慢。' +
      '正确做法是先把送风温度提上来让铁水回热，等铁水温度确认高于 1450°C 后再用泥炮把结瘤打开，' +
      '温度不够就贸然敲炮只会让凉铁堵得更死。',
    cause: '上一炉出铁口封堵时泥炮打入偏少，加上上炉铁水温度偏低，出铁口沿凝了一层结瘤。',
    affectedEquipments: ['TAP-HOLE', 'STOVE', 'TORPEDO'],
    symptoms: [
      { equipmentId: 'TAP-HOLE', param: 'tap-flow',   paramName: '铁水流量',   value: 2.8,  unit: 't/min', normal: '4.0-8.5',   trend: 'down' },
      { equipmentId: 'TAP-HOLE', param: 'T-tap',      paramName: '铁水温度',   value: 1435, unit: '°C',    normal: '1450-1510', trend: 'down' },
      { equipmentId: 'STOVE',    param: 'T-blast',    paramName: '送风温度',   value: 1050, unit: '°C',    normal: '1000-1250', trend: 'down' },
      { equipmentId: 'TORPEDO',  param: 'LOAD',       paramName: '装载量',     value: 60,   unit: 't',     normal: '0-350',     trend: 'down' },
    ],
    steps: [
      // 专家 S 级路径
      { id: 's1', action: '观察出铁口铁水流量情况',                        correct: true,  order: 1 },
      { id: 's2', action: '把送风温度 T-blast 从 1050 提到 1150 °C',       correct: true,  order: 2 },
      { id: 's3', action: '等 120 秒让炉腹热量传到出铁口',                 correct: true,  order: 3 },
      { id: 's4', action: '观察铁水温度 T-tap，确认已回升到 1450 以上',    correct: true,  order: 4 },
      { id: 's5', action: '用泥炮打开出铁口（TAP-HOLE 工艺按钮）',         correct: true,  order: 5 },
      { id: 's6', action: '再观察装载速率是否恢复',                        correct: true,  order: 6 },
      // 易错动作 —— wrong_order：温度不到 1450 就敲炮
      { id: 's7', action: '铁水温度不到 1450 就直接用泥炮敲开（错误）',    correct: false, order: 7 },
      { id: 's8', action: '不加热直接加大风量强推（错误：会崩料）',        correct: false, order: 8 },
    ],
    hints: [
      '专家 S 级路径：view TAP-HOLE(0s) → 提送风温到 1150(8s) → 等 120s → 观察铁水温(129s) → 敲炮(135s) → 等 60s → 通关(330s)',
      '结瘤处置铁律：先热后敲 —— 铁水温度必须 ≥ 1450°C 再动泥炮',
      '⚠️ 易错点(wrong_order)：温度不到 1450 就敲炮 → "1380 度你敲什么！凉铁堵得更死"',
    ],
    divergence: {
      drivers: [
        // 不加热的话铁水温度继续下降，装载速率继续变差
        { equipmentId: 'TAP-HOLE', param: 'T-tap',    rate: -0.15, cap: 1360, delaySec: 20 },
        { equipmentId: 'TAP-HOLE', param: 'tap-flow', rate: -0.02, cap: 1.0,  delaySec: 25 },
      ],
    },
  },
];
