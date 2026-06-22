import type { Fault } from '@/types';

// FCC 装置典型故障演练库——参数值均为数值型，落在设备 min/max 之内但超出 normalMin/normalMax，模拟真实异常工况
// 每条 symptom 都带 equipmentId，让"症状—设备"精确归属，避免出现"设备标红但参数正常"的误导
export const fccFaults: Fault[] = [
  {
    id: 'F001',
    name: '反应温度异常升高',
    description: '提升管反应器出口温度超过 520°C，再生温度同步上行，触发高温联锁报警',
    affectedEquipments: ['R-101', 'REG-101'],
    symptoms: [
      // 反应温度 535°C：高于正常 480-520，落在 min 400 / max 600 之内
      { equipmentId: 'R-101', param: 'reactor_temp', paramName: '反应温度', value: 535, unit: '°C', normal: '480-520', trend: 'up' },
      // 再生温度 720°C：高于正常 680-700，落在 min 600 / max 800 之内
      { equipmentId: 'REG-101', param: 'regenerator_temp', paramName: '再生温度', value: 720, unit: '°C', normal: '680-700', trend: 'up' },
    ],
    cause: '再生滑阀开度过大，再生剂带入热量过多，反应温度失控',
    steps: [
      { id: 's1', action: '检查再生滑阀开度', correct: true, order: 1 },
      { id: 's2', action: '适当关小再生滑阀', correct: true, order: 2 },
      { id: 's3', action: '投用反应急冷油', correct: true, order: 3 },
      { id: 's4', action: '提高原料预热温度', correct: false, order: 4 },
    ],
    hints: [
      '小伙子，先盯一下再生滑阀开度，是不是开大了？',
      '再生剂热得很，循环量一上来反应温度肯定压不住',
      '要是温度还压不住，赶紧把急冷油投上，先保设备',
    ],
  },
  {
    id: 'F002',
    name: '主风出口流量下降',
    description: '主风机出口风量明显下滑，再生器藏量与压力同步下降，烧焦能力受限',
    affectedEquipments: ['K-101', 'REG-101'],
    symptoms: [
      // 主风量 1350 Nm³/min：低于正常 1500-1800，落在 min 1000 / max 2500 之内
      { equipmentId: 'K-101', param: 'air_flow', paramName: '风量', value: 1350, unit: 'Nm³/min', normal: '1500-1800', trend: 'down' },
      // 再生压力 0.19 MPa：低于正常 0.22-0.25，落在 min 0.1 / max 0.4 之内
      { equipmentId: 'REG-101', param: 'regenerator_pressure', paramName: '再生压力', value: 0.19, unit: 'MPa', normal: '0.22-0.25', trend: 'down' },
    ],
    cause: '主风机入口过滤器压差升高（堵塞），导致进风量下降',
    steps: [
      { id: 's1', action: '检查入口过滤器压差', correct: true, order: 1 },
      { id: 's2', action: '切换备用过滤器', correct: true, order: 2 },
      { id: 's3', action: '适当降低催化剂循环量', correct: true, order: 3 },
      { id: 's4', action: '紧急停机', correct: false, order: 4 },
    ],
    hints: [
      '风量掉了？先看看入口过滤器压差，多半是堵了',
      '别急着停机，有备用过滤器先切过去保产',
      '风量跟不上，循环量也得相应往下压一压',
    ],
  },
  {
    id: 'F003',
    name: '分馏塔冲塔',
    description: '分馏塔顶温度与塔顶压力同步上行，气相负荷骤增，存在液泛冲塔风险',
    // 仅把分馏塔标红；原料油换热器无对应症状参数，移除以避免误导
    affectedEquipments: ['T-101'],
    symptoms: [
      // 塔顶温度 148°C：高于正常 120-130，落在 min 80 / max 180 之内
      { equipmentId: 'T-101', param: 'tower_top_temp', paramName: '塔顶温度', value: 148, unit: '°C', normal: '120-130', trend: 'up' },
      // 塔顶压力 0.18 MPa：高于正常 0.10-0.15，落在 min 0.05 / max 0.3 之内
      { equipmentId: 'T-101', param: 'tower_top_pressure', paramName: '塔顶压力', value: 0.18, unit: 'MPa', normal: '0.10-0.15', trend: 'up' },
    ],
    cause: '分馏塔底液位偏高+塔底蒸汽量过大，塔内气相负荷骤增',
    steps: [
      { id: 's1', action: '降低塔底液位', correct: true, order: 1 },
      { id: 's2', action: '减少塔底吹汽量', correct: true, order: 2 },
      { id: 's3', action: '加大顶循回流量', correct: true, order: 3 },
      { id: 's4', action: '提高反应苛刻度', correct: false, order: 4 },
    ],
    hints: [
      '塔顶温度往上窜，先看看塔底液位是不是高了',
      '吹汽量大了气相负荷压不住，赶紧把吹汽往下收一收',
      '顶循回流量打上去，把塔顶温度先稳住',
    ],
  },

  /* ============ 以下 F004-F015 为扩展故障库（v2 新增） ============ */

  {
    id: 'F004',
    name: '再生器超温',
    description: '再生温度连续上行突破 740°C，烧焦放热失控，再生剂热量过剩，再生器材质长期承压风险加剧',
    affectedEquipments: ['REG-101'],
    symptoms: [
      // 再生温度 745°C：高于正常 680-700，落在 min 600 / max 800 之内
      { equipmentId: 'REG-101', param: 'regenerator_temp', paramName: '再生温度', value: 745, unit: '°C', normal: '680-700', trend: 'up' },
      // 烧焦量 4.8 t/h：高于正常 2.5-4，落在 min 1 / max 6 之内
      { equipmentId: 'REG-101', param: 'coke_burning', paramName: '烧焦量', value: 4.8, unit: 't/h', normal: '2.5-4', trend: 'up' },
    ],
    cause: '原料偏重 + 反应苛刻度偏高，待生剂含碳量上来了，烧焦放热集中',
    steps: [
      { id: 's1', action: '降低反应苛刻度', correct: true, order: 1 },
      { id: 's2', action: '加大稀相取热', correct: true, order: 2 },
      { id: 's3', action: '适当减小主风量', correct: true, order: 3 },
      { id: 's4', action: '提高再生滑阀开度', correct: false, order: 4 },
    ],
    hints: [
      '再生温度奔 750 去了，先把反应苛刻度压一压',
      '稀相取热打开点，把多余热量带走',
      '主风别一直猛吹，烧焦速度跟着降一点',
    ],
  },

  {
    id: 'F005',
    name: '反应温度偏低',
    description: '提升管出口反应温度跌至 460°C，转化率明显下行，干气产率上升，原料利用率下降',
    affectedEquipments: ['R-101'],
    symptoms: [
      // 反应温度 462°C：低于正常 480-520，落在 min 400 / max 600 之内
      { equipmentId: 'R-101', param: 'reactor_temp', paramName: '反应温度', value: 462, unit: '°C', normal: '480-520', trend: 'down' },
      // 油气比 4.8：低于正常 5-8，落在 min 4 / max 10 之内
      { equipmentId: 'R-101', param: 'oil_ratio', paramName: '油气比', value: 4.8, unit: '', normal: '5-8', trend: 'down' },
    ],
    cause: '再生剂温度不够或催化剂循环量不足，热量带入提升管偏少',
    steps: [
      { id: 's1', action: '适当开大再生滑阀', correct: true, order: 1 },
      { id: 's2', action: '提高原料预热温度', correct: true, order: 2 },
      { id: 's3', action: '降低进料量', correct: true, order: 3 },
      { id: 's4', action: '投用反应急冷油', correct: false, order: 4 },
    ],
    hints: [
      '反应温度起不来，先看再生剂带过来的热量够不够',
      '原料预热打高点，让进提升管的油气热一点',
      '一时调不上来，进料先压一压，避免转化率继续掉',
    ],
  },

  {
    id: 'F006',
    name: '主风机喘振预警',
    description: '主风机出口压力剧烈波动，进风量短时跌至危险区间，风机喘振风险升高，再生床烧焦能力随之波动',
    affectedEquipments: ['K-101', 'REG-101'],
    symptoms: [
      // 风量 1180 Nm³/min：低于正常 1500-1800，远低于 min 1000，留点余量给恢复
      { equipmentId: 'K-101', param: 'air_flow', paramName: '风量', value: 1180, unit: 'Nm³/min', normal: '1500-1800', trend: 'down' },
      // 风压 0.32 MPa：高于正常 0.22-0.28，落在 min 0.15 / max 0.4 之内
      { equipmentId: 'K-101', param: 'air_pressure', paramName: '风压', value: 0.32, unit: 'MPa', normal: '0.22-0.28', trend: 'up' },
      // 再生压力 0.20 MPa：低于正常 0.22-0.25
      { equipmentId: 'REG-101', param: 'regenerator_pressure', paramName: '再生压力', value: 0.20, unit: 'MPa', normal: '0.22-0.25', trend: 'down' },
    ],
    cause: '再生系统阻力升高（如旋分压差大），导致风机工况点向喘振线靠近',
    steps: [
      { id: 's1', action: '打开防喘振回流阀', correct: true, order: 1 },
      { id: 's2', action: '降低再生压力设定', correct: true, order: 2 },
      { id: 's3', action: '协调降低进料量', correct: true, order: 3 },
      { id: 's4', action: '继续提高风机转速', correct: false, order: 4 },
    ],
    hints: [
      '风压跳上去风量却下来了，典型的工况点往喘振线走',
      '先把防喘振回流阀打开，让风机有个回流稳定一下',
      '硬撑提转速只会进喘振区，得反过来降压、降负荷',
    ],
  },

  {
    id: 'F007',
    name: '加热炉超温',
    description: '加热炉炉膛温度突破 850°C，炉管局部过热，预热段出口超规，存在炉管烧损风险',
    affectedEquipments: ['F-101'],
    symptoms: [
      // 炉膛温度 855°C：高于正常 700-800，落在 min 500 / max 900 之内
      { equipmentId: 'F-101', param: 'furnace_temp', paramName: '炉膛温度', value: 855, unit: '°C', normal: '700-800', trend: 'up' },
      // 燃料气流量 1050 Nm³/h：高于正常 700-900，落在 min 400 / max 1200 之内
      { equipmentId: 'F-101', param: 'fuel_gas_flow', paramName: '燃料气流量', value: 1050, unit: 'Nm³/h', normal: '700-900', trend: 'up' },
    ],
    cause: '燃料气调节阀失灵或定值偏高，燃烧负荷与吸热不匹配',
    steps: [
      { id: 's1', action: '关小燃料气调节阀', correct: true, order: 1 },
      { id: 's2', action: '加大进料量提升吸热', correct: true, order: 2 },
      { id: 's3', action: '检查燃料气调节阀阀位反馈', correct: true, order: 3 },
      { id: 's4', action: '提高炉膛温度设定', correct: false, order: 4 },
    ],
    hints: [
      '炉膛 855℃了，赶紧把燃料气往下压',
      '吸热那头跟不上，进料量适当加一点把热带走',
      '阀位反馈值看一下，怀疑卡死了还得切手动',
    ],
  },

  {
    id: 'F008',
    name: '原料泵流量波动',
    description: '原料油泵出口流量在 90~155 t/h 之间剧烈波动，下游进料不稳，反应转化率随之波动',
    affectedEquipments: ['P-101'],
    symptoms: [
      // 流量 92 t/h：低于正常 100-140，落在 min 50 / max 200 之内
      { equipmentId: 'P-101', param: 'pump_flow', paramName: '流量', value: 92, unit: 't/h', normal: '100-140', trend: 'down' },
      // 转速 3050 rpm：高于正常 2800-3000，落在 min 1000 / max 3500 之内
      { equipmentId: 'P-101', param: 'pump_speed', paramName: '转速', value: 3050, unit: 'rpm', normal: '2800-3000', trend: 'up' },
    ],
    cause: '原料油带水或入口过滤器局部堵塞，泵汽蚀导致流量周期性波动',
    steps: [
      { id: 's1', action: '检查入口过滤器压差', correct: true, order: 1 },
      { id: 's2', action: '切换备用过滤器', correct: true, order: 2 },
      { id: 's3', action: '排查原料罐脱水阀状态', correct: true, order: 3 },
      { id: 's4', action: '继续提高泵转速强行提流量', correct: false, order: 4 },
    ],
    hints: [
      '流量跳一下跌一下，多半是泵入口出了汽蚀',
      '先看进口过滤器压差，堵了就切备用',
      '硬提转速没用，汽蚀更狠，先把原料水赶干净',
    ],
  },

  {
    id: 'F009',
    name: '反应压力高',
    description: '提升管反应压力升至 0.33 MPa，超压联锁前 0.02 MPa 余量，需立即介入',
    affectedEquipments: ['R-101', 'PI-101'],
    symptoms: [
      // 反应压力 0.33 MPa：高于正常 0.22-0.28，落在 min 0.1 / max 0.5 之内
      { equipmentId: 'R-101', param: 'reactor_pressure', paramName: '反应压力', value: 0.33, unit: 'MPa', normal: '0.22-0.28', trend: 'up' },
      // 压力指示同步 0.33
      { equipmentId: 'PI-101', param: 'pressure_indication', paramName: '压力指示', value: 0.33, unit: 'MPa', normal: '0.22-0.28', trend: 'up' },
    ],
    cause: '油气线背压升高（分馏塔顶或气压机入口堵塞），反应段无法顺畅排出',
    steps: [
      { id: 's1', action: '加大分馏塔顶冷却负荷', correct: true, order: 1 },
      { id: 's2', action: '检查气压机入口分液罐液位', correct: true, order: 2 },
      { id: 's3', action: '适当降低进料量', correct: true, order: 3 },
      { id: 's4', action: '提高反应温度逼出更多气体', correct: false, order: 4 },
    ],
    hints: [
      '反应压力快到联锁，先看油气线背压',
      '塔顶冷却给足，把气相负荷降下来',
      '别想着烧得更狠把压力顶回去，那是反向操作',
    ],
  },

  {
    id: 'F010',
    name: '催化剂循环量偏低',
    description: '催化剂循环量跌至 16 t/h，提升管进料无法充分接触再生剂，反应转化率持续下降',
    affectedEquipments: ['REG-101', 'V-101'],
    symptoms: [
      // 催化剂循环量 16 t/h：低于正常 20-30，落在 min 10 / max 40 之内
      { equipmentId: 'REG-101', param: 'catalyst_circulation', paramName: '催化剂循环量', value: 16, unit: 't/h', normal: '20-30', trend: 'down' },
      // 塞阀开度 38%：低于正常 50-80
      { equipmentId: 'V-101', param: 'valve_opening', paramName: '开度', value: 38, unit: '%', normal: '50-80', trend: 'down' },
    ],
    cause: '塞阀开度偏小或催化剂藏量不足，剂油比掉下来',
    steps: [
      { id: 's1', action: '加大塞阀开度', correct: true, order: 1 },
      { id: 's2', action: '补充新鲜催化剂', correct: true, order: 2 },
      { id: 's3', action: '适当降低原料预热温度', correct: true, order: 3 },
      { id: 's4', action: '降低再生温度', correct: false, order: 4 },
    ],
    hints: [
      '剂油比掉了，先看塞阀是不是关小了',
      '藏量也得盯一下，少了就补点新鲜剂',
      '再生温度别动，温度一动反应那头更乱',
    ],
  },

  {
    id: 'F011',
    name: '塞阀卡涩',
    description: '塞阀阀位反馈僵在 72%，催化剂循环量异常稳定，但与反应负荷需求不匹配',
    affectedEquipments: ['V-101', 'R-101'],
    symptoms: [
      // 塞阀开度 45%：指令本想给到 65% 但卡涩响应不到位，实际开度偏低，落在 min 0 / max 100 之内
      { equipmentId: 'V-101', param: 'valve_opening', paramName: '开度', value: 45, unit: '%', normal: '50-80', trend: 'down' },
      // 反应温度 472°C：低于正常 480-520
      { equipmentId: 'R-101', param: 'reactor_temp', paramName: '反应温度', value: 472, unit: '°C', normal: '480-520', trend: 'down' },
    ],
    cause: '塞阀阀杆磨损或催化剂磨蚀，机械卡涩导致开度调不动',
    steps: [
      { id: 's1', action: '切手动检查塞阀响应', correct: true, order: 1 },
      { id: 's2', action: '联系仪表班现场确认', correct: true, order: 2 },
      { id: 's3', action: '暂时降低进料保平稳', correct: true, order: 3 },
      { id: 's4', action: '继续给塞阀加大开度指令', correct: false, order: 4 },
    ],
    hints: [
      '塞阀指令给了开度不动，先切手动看反应',
      '叫仪表班来摸一下阀杆，多半是卡了',
      '硬给指令没用，先把进料降一点稳工况',
    ],
  },

  {
    id: 'F012',
    name: '分馏塔塔底温度过高',
    description: '分馏塔塔底温度升至 365°C，重组分变轻，柴油闪点下降，塔底再沸器负荷异常',
    affectedEquipments: ['T-101'],
    symptoms: [
      // 塔底温度 365°C：高于正常 330-350，落在 min 280 / max 400 之内
      { equipmentId: 'T-101', param: 'tower_bottom_temp', paramName: '塔底温度', value: 365, unit: '°C', normal: '330-350', trend: 'up' },
      // 回流比 1.6：低于正常 2-3
      { equipmentId: 'T-101', param: 'reflux_ratio', paramName: '回流比', value: 1.6, unit: '', normal: '2-3', trend: 'down' },
    ],
    cause: '中段回流量减少 + 再沸器热负荷偏高，塔底过热',
    steps: [
      { id: 's1', action: '加大中段回流量', correct: true, order: 1 },
      { id: 's2', action: '适当降低再沸器热负荷', correct: true, order: 2 },
      { id: 's3', action: '复查塔底油浆采出温度', correct: true, order: 3 },
      { id: 's4', action: '提高塔顶冷凝器负荷', correct: false, order: 4 },
    ],
    hints: [
      '塔底烫得不行，先把中段回流量提起来',
      '再沸器加热别打太满，柴油闪点要保',
      '光动塔顶冷却没用，问题在塔下半段',
    ],
  },

  {
    id: 'F013',
    name: '加热炉燃料气压力不足',
    description: '燃料气流量跌至 580 Nm³/h，炉膛温度同步下行，原料预热不足影响反应苛刻度',
    affectedEquipments: ['F-101'],
    symptoms: [
      // 燃料气流量 580 Nm³/h：低于正常 700-900
      { equipmentId: 'F-101', param: 'fuel_gas_flow', paramName: '燃料气流量', value: 580, unit: 'Nm³/h', normal: '700-900', trend: 'down' },
      // 炉膛温度 670°C：低于正常 700-800
      { equipmentId: 'F-101', param: 'furnace_temp', paramName: '炉膛温度', value: 670, unit: '°C', normal: '700-800', trend: 'down' },
    ],
    cause: '燃料气总管压力下降，调节阀全开仍供量不足',
    steps: [
      { id: 's1', action: '联系燃料气分厂确认外供压力', correct: true, order: 1 },
      { id: 's2', action: '切换备用燃料气源', correct: true, order: 2 },
      { id: 's3', action: '降低进料量保炉膛温度', correct: true, order: 3 },
      { id: 's4', action: '强行开大主燃料气阀', correct: false, order: 4 },
    ],
    hints: [
      '炉子凉了，先确认外供燃料气压力是不是掉了',
      '有备用源赶紧切，别等到反应那头出问题',
      '阀已经全开了，硬撑没用，得从源头找',
    ],
  },

  {
    id: 'F014',
    name: '油气比偏低（轻进料偏多）',
    description: '油气比降至 4.5，反应转化深度不够，汽油辛烷值下降，回炼油增多',
    affectedEquipments: ['R-101'],
    symptoms: [
      // 油气比 4.5：低于正常 5-8，落在 min 4 / max 10 之内
      { equipmentId: 'R-101', param: 'oil_ratio', paramName: '油气比', value: 4.5, unit: '', normal: '5-8', trend: 'down' },
      // 反应温度 478°C：略低于正常 480-520
      { equipmentId: 'R-101', param: 'reactor_temp', paramName: '反应温度', value: 478, unit: '°C', normal: '480-520', trend: 'down' },
    ],
    cause: '原料偏轻 + 剂油比下降，分子扩散好但反应深度不够',
    steps: [
      { id: 's1', action: '提高反应温度', correct: true, order: 1 },
      { id: 's2', action: '加大催化剂循环量', correct: true, order: 2 },
      { id: 's3', action: '调整原料配比掺重', correct: true, order: 3 },
      { id: 's4', action: '增加雾化蒸汽', correct: false, order: 4 },
    ],
    hints: [
      '油气比上不来，先把反应温度往上提两度',
      '剂油比再加加，催化剂循环量打上去',
      '原料能掺点重就掺一点，深度才提得起来',
    ],
  },

  {
    id: 'F015',
    name: '再生不彻底（待生剂积碳）',
    description: '催化剂循环量正常，但反应温度持续下行，再生器烧焦量低于设计值，催化剂活性明显衰减',
    affectedEquipments: ['REG-101', 'R-101'],
    symptoms: [
      // 烧焦量 2.0 t/h：低于正常 2.5-4，落在 min 1 / max 6 之内
      { equipmentId: 'REG-101', param: 'coke_burning', paramName: '烧焦量', value: 2.0, unit: 't/h', normal: '2.5-4', trend: 'down' },
      // 再生温度 668°C：低于正常 680-700
      { equipmentId: 'REG-101', param: 'regenerator_temp', paramName: '再生温度', value: 668, unit: '°C', normal: '680-700', trend: 'down' },
      // 反应温度 470°C
      { equipmentId: 'R-101', param: 'reactor_temp', paramName: '反应温度', value: 470, unit: '°C', normal: '480-520', trend: 'down' },
    ],
    cause: '主风量不足或再生器藏量低，烧焦不彻底导致再生剂活性下降',
    steps: [
      { id: 's1', action: '加大主风量', correct: true, order: 1 },
      { id: 's2', action: '提高再生器藏量', correct: true, order: 2 },
      { id: 's3', action: '延长烧焦停留时间（降进料）', correct: true, order: 3 },
      { id: 's4', action: '继续加大催化剂循环量', correct: false, order: 4 },
    ],
    hints: [
      '反应温度起不来根子在再生不干净，主风量给够',
      '藏量低了烧焦就不充分，把藏量补一补',
      '光使劲循环没用，剂没烧透越循环越糟',
    ],
  },
];
