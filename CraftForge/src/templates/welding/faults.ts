import type { Fault } from '@/types';

// 汽车焊装车间典型故障库
// 每条 symptom 都关联到 weldingConfig 中的真实设备 + 参数 ID
// 参数 value 落在 min/max 内但超出 normalMin/normalMax，模拟"工艺异常但未停机"
export const weldingFaults: Fault[] = [
  {
    id: 'WF001',
    name: '焊接电流过大（烧穿风险）',
    description: '机器人1号焊接电流飙升至 235A，电极温度同步抬升，存在板材烧穿与电极烧损风险',
    affectedEquipments: ['ROB-101'],
    symptoms: [
      // 电流 235A：高于正常 160-200，落在 min 100 / max 300 之内
      { equipmentId: 'ROB-101', param: 'weld_current', paramName: '焊接电流', value: 235, unit: 'A', normal: '160-200', trend: 'up' },
      // 电极温度 460°C：高于正常 280-380
      { equipmentId: 'ROB-101', param: 'tip_temp', paramName: '电极温度', value: 460, unit: '°C', normal: '280-380', trend: 'up' },
    ],
    cause: '焊接电流设定偏高 + 电极冷却不足，热输入过大',
    steps: [
      { id: 's1', action: '降低焊接电流到正常范围', correct: true, order: 1 },
      { id: 's2', action: '增大冷却水流量', correct: true, order: 2 },
      { id: 's3', action: '检查焊枪电极是否磨损', correct: true, order: 3 },
      { id: 's4', action: '提高焊接电压补偿', correct: false, order: 4 },
    ],
    hints: [
      '电流冲到 235A 了，先把电流参数压回 180A 左右',
      '电极温度也跟着上来了，冷却水流量加加',
      '电压不能反向加，越加热量越大',
    ],
  },

  {
    id: 'WF002',
    name: '保护气流量不足（咬边/气孔）',
    description: '焊枪保护气流量跌至 8 L/min，焊缝氧化严重，检测仪缺陷计数上升',
    affectedEquipments: ['WG-101', 'INST-101'],
    symptoms: [
      { equipmentId: 'WG-101', param: 'gas_flow', paramName: '保护气流量', value: 8, unit: 'L/min', normal: '12-18', trend: 'down' },
      { equipmentId: 'INST-101', param: 'defect_count', paramName: '缺陷计数', value: 5, unit: '个', normal: '0-2', trend: 'up' },
      { equipmentId: 'INST-101', param: 'weld_quality', paramName: '焊缝质量', value: 78, unit: '%', normal: '90-100', trend: 'down' },
    ],
    cause: '保护气瓶压力下降或气路接头漏气，气体覆盖不充分',
    steps: [
      { id: 's1', action: '加大保护气流量到 15 L/min', correct: true, order: 1 },
      { id: 's2', action: '检查气路接头是否泄漏', correct: true, order: 2 },
      { id: 's3', action: '更换气瓶或切换备用气源', correct: true, order: 3 },
      { id: 's4', action: '提高焊接电流补偿', correct: false, order: 4 },
    ],
    hints: [
      '气流量只剩 8 L/min，先把它顶到 15 上下',
      '焊缝质量已经掉到 78%，再不处理废件就成批了',
      '硬加电流没用，根子是保护气没盖住焊池',
    ],
  },

  {
    id: 'WF003',
    name: '夹具夹紧力不足（定位偏差）',
    description: '定位夹具夹紧力跌至 3500N，板件松动导致定位误差超标，焊缝偏离设计位置',
    affectedEquipments: ['FIX-101'],
    symptoms: [
      { equipmentId: 'FIX-101', param: 'clamp_force', paramName: '夹紧力', value: 3500, unit: 'N', normal: '4500-5500', trend: 'down' },
      { equipmentId: 'FIX-101', param: 'position_error', paramName: '定位误差', value: 0.28, unit: 'mm', normal: '0-0.1', trend: 'up' },
    ],
    cause: '气路压力下降或夹紧油缸内漏，夹紧力衰减',
    steps: [
      { id: 's1', action: '提高夹紧力到 5000N', correct: true, order: 1 },
      { id: 's2', action: '检查气源压力', correct: true, order: 2 },
      { id: 's3', action: '复位定位销并复检', correct: true, order: 3 },
      { id: 's4', action: '提高输送带速度赶产量', correct: false, order: 4 },
    ],
    hints: [
      '夹紧力只有 3500N，板件压不住焊出来肯定偏',
      '定位误差 0.28mm 远超 0.1，得先把夹具搞稳再焊',
      '别想着赶产量，定位都不准焊出来全是废品',
    ],
  },

  {
    id: 'WF004',
    name: '输送带速度异常（节拍紊乱）',
    description: '输入输送带速度从 1.2 跌至 0.6 m/min，下件工位排队件数堆积',
    affectedEquipments: ['CONV-101', 'ST-102'],
    symptoms: [
      { equipmentId: 'CONV-101', param: 'conveyor_speed', paramName: '输送速度', value: 0.6, unit: 'm/min', normal: '1.0-1.5', trend: 'down' },
      { equipmentId: 'CONV-101', param: 'belt_tension', paramName: '皮带张力', value: 580, unit: 'N', normal: '700-900', trend: 'down' },
      { equipmentId: 'ST-102', param: 'queue_count', paramName: '排队数量', value: 4, unit: '件', normal: '0-2', trend: 'up' },
    ],
    cause: '驱动电机变频器降频运行 + 皮带松弛打滑',
    steps: [
      { id: 's1', action: '恢复输送带速度到 1.2 m/min', correct: true, order: 1 },
      { id: 's2', action: '调整皮带张力到 800N', correct: true, order: 2 },
      { id: 's3', action: '检查变频器报警代码', correct: true, order: 3 },
      { id: 's4', action: '加快下件工位人工节拍', correct: false, order: 4 },
    ],
    hints: [
      '输送带跑慢一半，先把速度恢复到 1.2',
      '皮带张力也不够，跟着调到 800 左右',
      '后端堆 4 件了，根子在前面输送，光催下件没用',
    ],
  },

  {
    id: 'WF005',
    name: '焊缝熔深不足（虚焊）',
    description: '检测仪熔深降至 1.4mm，焊缝强度不达标，机器人2号电流偏低同步异常',
    affectedEquipments: ['ROB-102', 'INST-101'],
    symptoms: [
      { equipmentId: 'ROB-102', param: 'weld_current', paramName: '焊接电流', value: 138, unit: 'A', normal: '160-200', trend: 'down' },
      { equipmentId: 'INST-101', param: 'penetration', paramName: '熔深', value: 1.4, unit: 'mm', normal: '2.0-3.0', trend: 'down' },
      { equipmentId: 'INST-101', param: 'weld_quality', paramName: '焊缝质量', value: 82, unit: '%', normal: '90-100', trend: 'down' },
    ],
    cause: '焊接参数衰减 + 送丝速度偏低，热输入不足',
    steps: [
      { id: 's1', action: '提高 2 号机器人焊接电流到 180A', correct: true, order: 1 },
      { id: 's2', action: '加大送丝速度', correct: true, order: 2 },
      { id: 's3', action: '降低机械臂行进速度', correct: true, order: 3 },
      { id: 's4', action: '降低保护气流量', correct: false, order: 4 },
    ],
    hints: [
      '熔深 1.4mm 远不达标，2 号机的电流先提到 180',
      '送丝跟不上的话，电流再高也熔不进去',
      '气流量不能降，反而要保住，不然氧化更严重',
    ],
  },

  {
    id: 'WF006',
    name: '送丝速度过快（焊瘤）',
    description: '焊枪送丝速度冲到 9 m/min，熔池堆积形成焊瘤，机器人3号电极温度同步异常',
    affectedEquipments: ['WG-101', 'ROB-103'],
    symptoms: [
      { equipmentId: 'WG-101', param: 'wire_feed_rate', paramName: '送丝速度', value: 9.0, unit: 'm/min', normal: '5-7', trend: 'up' },
      { equipmentId: 'ROB-103', param: 'tip_temp', paramName: '电极温度', value: 420, unit: '°C', normal: '280-380', trend: 'up' },
    ],
    cause: '送丝机构调节阀异常 + 焊接电压未同步调高',
    steps: [
      { id: 's1', action: '降低送丝速度到 6 m/min', correct: true, order: 1 },
      { id: 's2', action: '检查送丝轮压力', correct: true, order: 2 },
      { id: 's3', action: '加大冷却水流量', correct: true, order: 3 },
      { id: 's4', action: '继续提高焊接电流匹配', correct: false, order: 4 },
    ],
    hints: [
      '送丝 9 米/分太快，先压回 6 米',
      '送丝轮可能打滑，顺手摸一下压力',
      '电流再加更糟，焊瘤会鼓更大',
    ],
  },

  {
    id: 'WF007',
    name: '控制柜通讯中断',
    description: '产线控制柜与 1 号机器人通讯异常，系统负载飙升，机器人执行延迟显著',
    affectedEquipments: ['CTRL-101', 'ROB-101'],
    symptoms: [
      { equipmentId: 'CTRL-101', param: 'comm_status', paramName: '通讯状态', value: 0, unit: '', normal: '1-1', trend: 'down' },
      { equipmentId: 'CTRL-101', param: 'sys_load', paramName: '系统负载', value: 88, unit: '%', normal: '30-70', trend: 'up' },
      { equipmentId: 'ROB-101', param: 'arm_speed', paramName: '机械臂速度', value: 0.4, unit: 'm/min', normal: '0.6-1.0', trend: 'down' },
    ],
    cause: '现场总线被电磁干扰或网线松动，重发请求堆积',
    steps: [
      { id: 's1', action: '重启 1 号机器人通讯模块', correct: true, order: 1 },
      { id: 's2', action: '检查总线网线接头', correct: true, order: 2 },
      { id: 's3', action: '降低系统负载（暂停部分工位）', correct: true, order: 3 },
      { id: 's4', action: '直接重启整个控制柜', correct: false, order: 4 },
    ],
    hints: [
      '通讯掉了，1 号机基本动不了，先复位通讯模块',
      '网线接头看一下，振动一大就容易松',
      '别直接全重启，影响其他两台机的节拍',
    ],
  },

  {
    id: 'WF008',
    name: '冷却水流量异常（电极过热）',
    description: '冷却水流量跌至 2 L/min，三台机器人电极温度同时偏高，连续焊接面临停机风险',
    affectedEquipments: ['WG-101', 'ROB-101', 'ROB-102'],
    symptoms: [
      { equipmentId: 'WG-101', param: 'cooling_water', paramName: '冷却水流量', value: 2.0, unit: 'L/min', normal: '4-6', trend: 'down' },
      { equipmentId: 'ROB-101', param: 'tip_temp', paramName: '电极温度', value: 410, unit: '°C', normal: '280-380', trend: 'up' },
      { equipmentId: 'ROB-102', param: 'tip_temp', paramName: '电极温度', value: 395, unit: '°C', normal: '280-380', trend: 'up' },
    ],
    cause: '冷却水循环泵故障或过滤器堵塞，水量大幅下降',
    steps: [
      { id: 's1', action: '提高冷却水流量到 5 L/min', correct: true, order: 1 },
      { id: 's2', action: '检查冷却水过滤器是否堵塞', correct: true, order: 2 },
      { id: 's3', action: '暂时降低焊接电流', correct: true, order: 3 },
      { id: 's4', action: '继续焊接观察是否自行恢复', correct: false, order: 4 },
    ],
    hints: [
      '水只剩 2 L/min，电极烫成这样很快就要烧',
      '过滤器多半堵了，停下来清一下',
      '别硬撑，电极烧了换一套耽误一上午',
    ],
  },
];
