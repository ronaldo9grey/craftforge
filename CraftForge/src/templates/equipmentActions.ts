/**
 * 设备非参数化"操作动作"清单
 * 给每个设备类型/特定 ID 配一组按钮（如"检查阳极导电棒夹具"、"撕开壳料"、"清理碳渣"），
 * 让学员能执行那些"不是调参数"的工艺动作。
 *
 * 动作命中规则：
 *   - 当前故障的 step.action 中如果包含按钮 label 文字 → 记 isCorrect=true（+ 播放叮）
 *   - 否则记 isCorrect=false（+ 播放嗡）
 */

export interface EquipmentAction {
  id: string;          // 内部 id（保持稳定 key）
  label: string;       // 按钮文字（也用作 record.action 文本 → 用于命中匹配）
  desc?: string;       // 鼠标悬停说明
  category?: '检查' | '维护' | '应急' | '操作';
}

/**
 * 按 equipment.type 注册一组通用动作
 * Key 为 type
 */
const ACTIONS_BY_TYPE: Record<string, EquipmentAction[]> = {
  // ============ 电解铝场景 ============
  'cell-iso': [
    { id: 'check-anode-clamp', label: '检查阳极导电棒夹具',  desc: '逐根检查 22 根导电棒，松动的紧上', category: '检查' },
    { id: 'replace-anode',     label: '更换异常阳极',         desc: '用天车把脱底/电流偏低的阳极吊出，换新极', category: '维护' },
    { id: 'tear-crust',        label: '撕开壳料',             desc: '阳极效应/补料时撕开槽面氧化铝结壳', category: '应急' },
    { id: 'tap-metal',         label: '安排抬包出铝',         desc: '通知抬包工到位真空抽吸铝水', category: '操作' },
    { id: 'add-cryolite',      label: '加冰晶石',             desc: '调分子比偏酸时使用', category: '维护' },
    { id: 'add-alf3',          label: '加 AlF₃',              desc: '调分子比偏碱时使用', category: '维护' },
  ],
  'crane-iso': [
    { id: 'crane-anode-swap',  label: '换极作业',             desc: '指挥天车进行阳极更换', category: '操作' },
    { id: 'crane-tap-metal',   label: '抬包出铝作业',         desc: '指挥天车吊抬包真空抽吸', category: '操作' },
    { id: 'crane-hydraulic',   label: '检查液压油压力',       desc: '夹具不夹时优先检查', category: '检查' },
    { id: 'crane-rope',        label: '检查起升钢丝绳',       desc: '每班开机必检', category: '检查' },
  ],
  'pot-ctrl': [
    { id: 'manual-feed',       label: '手动下料一次',         desc: '紧急补料时使用', category: '应急' },
    { id: 'increase-strike',   label: '提高打壳频次',         desc: '氧化铝浓度下降前兆', category: '操作' },
    { id: 'reset-alarm',       label: '复位报警',             desc: '排除故障后复位 PLC 报警', category: '操作' },
  ],

  // ============ FCC 场景 ============
  'reactor': [
    { id: 'check-cyclone',     label: '检查旋分器',           desc: '提升管反应器顶部气固分离', category: '检查' },
    { id: 'emergency-stop',    label: '紧急停反',             desc: '反应器超温/失控时', category: '应急' },
  ],
  'regenerator': [
    { id: 'check-air-dist',    label: '检查空气分布器',       desc: '主风分布不均时', category: '检查' },
    { id: 'reduce-coke',       label: '降低焦炭循环量',       desc: '再生温度过高时', category: '操作' },
  ],

  // ============ 注塑 / 数控 / 焊装 通用动作（少量） ============
  'molder': [
    { id: 'check-mold',        label: '检查模具',             desc: '飞边/短射时检查模具配合', category: '检查' },
    { id: 'clean-runner',      label: '清理流道',             desc: '阻塞/烧焦料时', category: '维护' },
  ],
  'robot-arm': [
    { id: 'check-tcp',         label: '校准 TCP',             desc: '焊缝偏移时校准工具中心点', category: '检查' },
    { id: 'check-cable',       label: '检查焊枪电缆',         desc: '通讯失稳/电流不稳时', category: '检查' },
  ],
  'cnc': [
    { id: 'check-tool',        label: '检查刀具磨损',         desc: '表面粗糙度异常时', category: '检查' },
    { id: 'replace-tool',      label: '更换刀具',             desc: '刀具磨损到极限', category: '维护' },
    { id: 'check-spindle',     label: '检查主轴',             desc: '主轴抖动/异响时', category: '检查' },
  ],
};

/**
 * 按 equipment.id 注册特殊动作（覆盖/补充 by-type）
 */
const ACTIONS_BY_ID: Record<string, EquipmentAction[]> = {
  // ============ 阳极振压成型场景 ============
  'PASTE-101': [
    { id: 'an-raise-paste-temp', label: '提高糊料温度',     desc: '糊料温度 < 140°C 易开裂时升到 150°C', category: '操作' },
    { id: 'an-tune-pitch',       label: '调整沥青配比',     desc: '密度低/流动性差时微调沥青 14~16 wt%', category: '维护' },
    { id: 'an-check-mixer',      label: '检查搅拌器',       desc: '糊料结块/温度不均时检查搅拌叶片', category: '检查' },
  ],
  'FORM-201': [
    { id: 'an-spray-release',  label: '喷涂脱模剂',     desc: '粘模时大量补涂脱模剂', category: '维护' },
    { id: 'an-preheat-mold',   label: '预热模具',       desc: '冷开机/缺角故障时启动模具加热', category: '操作' },
    { id: 'an-force-eject',    label: '强制顶出',       desc: '脱模困难时打开液压顶出器（不当用会顶碎阳极）', category: '应急' },
    { id: 'an-reject-block',   label: '剔除不合格品',   desc: '裂纹/缺角/起鼓品不进入下游冷却台', category: '操作' },
    { id: 'an-check-mold',     label: '检查模具状态',   desc: '出现毛刺/异响时检查模具', category: '检查' },
  ],
  'VAC-601': [
    { id: 'an-vac-leak-check',   label: '检查真空管路泄漏', desc: '真空度上不去/绝压 > 5 kPa 时优先排查', category: '检查' },
    { id: 'an-vac-clean-filter', label: '清理真空过滤器',   desc: '抽气流量下降时清理积粉', category: '维护' },
  ],
  'MHT-501': [
    { id: 'an-mht-set-temp',     label: '调整预热温度',     desc: '缺角/裂纹时把模具温度调到 130~145°C', category: '操作' },
    { id: 'an-mht-check-element',label: '检查加热元件',     desc: '加热功率上不去时检查电热管', category: '检查' },
  ],
  'CFG-701': [
    { id: 'an-cfg-tune-coke',    label: '调整石油焦粒度配比', desc: '密度/抗折强度异常时调干料比例', category: '操作' },
    { id: 'an-cfg-calibrate',    label: '校准称量传感器',     desc: '单块加料量偏差 > 2% 时校准', category: '维护' },
  ],
};

/**
 * 获取某个设备的所有可执行动作
 */
export function getActionsForEquipment(eqType: string, eqId: string): EquipmentAction[] {
  const byType = ACTIONS_BY_TYPE[eqType] ?? [];
  const byId = ACTIONS_BY_ID[eqId] ?? [];
  return [...byType, ...byId];
}
