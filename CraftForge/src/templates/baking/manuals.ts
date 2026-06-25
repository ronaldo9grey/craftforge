import type { EquipmentManual } from '@/types';

// 阳极焙烧炉车间设备操作手册库 v1
export const bakingManuals: Record<string, EquipmentManual> = {

  'BAKE-K3': {
    overview:
      '3 号焙烧炉室处于恒温阶段（1100°C ±15°C），是焙烧过程最关键的 3 天。' +
      '此阶段挥发分大部分排尽，碳骨架开始固化，电阻率从 80 μΩ·m 降到 55 μΩ·m。',
    operatingProcedure: [
      '每 2 小时记录炉室温度、左右火道温度',
      '左右火道温差 > 20°C 立即调整燃料气流量',
      '燃料气流量基准 130 m³/h，按温度反馈微调 ±10%',
      '每班巡检炉门密封情况',
    ],
    safetyNotes: [
      '炉室 1100°C 高温，禁止开盖',
      '燃料气泄漏报警必须立即停气检查',
      '巡检戴防火服 + 高温护目镜',
    ],
    troubleshooting: [
      { symptom: '左右火道温差 > 30°C', action: '降燃料气到 100 m³/h + 提高抽烟到 -350 Pa' },
      { symptom: '炉室温度跌 < 1080°C', action: '检查燃料气压力是否波动 + 适当加大流量' },
      { symptom: '炉门冒黑烟', action: '抽烟机转速提到 1500 rpm + 清理烟道' },
      { symptom: '保压试验 > 5%/min', action: '紧固密封圈 + 补涂耐火泥' },
    ],
  },

  'GAS-701': {
    overview:
      '燃料气调压站把上游 0.3 MPa 天然气稳压到 8~12 kPa 供 4 个炉室使用。' +
      '调压阀响应时间 < 2 秒是稳定燃烧的关键。',
    operatingProcedure: [
      '每班校验上游母管压力（应 > 0.25 MPa）',
      '调压阀目标输出 10 kPa',
      '每月清理燃料气过滤器',
      '每年检验调压阀响应时间',
    ],
    safetyNotes: [
      '天然气泄漏 → 立即停气 + 撤离 + 通风',
      '禁止用明火检漏，必须用气体检测仪',
      '调压间隔离接地装置 1 个月校验一次',
    ],
    troubleshooting: [
      { symptom: '输出压力波动 > 30%', action: '检查上游母管压力 + 调度配气' },
      { symptom: '热值跌到 < 8000 kJ/m³', action: '通知调度核对气源组分' },
      { symptom: '调压阀异响', action: '检查阀芯磨损 + 必要时更换' },
    ],
  },

  'FAN-401': {
    overview:
      '抽烟机组是一台 132 kW 变频引风机，把 4 个炉室的烟气负压抽出。' +
      '正常运行时转速 1380~1500 rpm，抽气流量 7500~9500 m³/h。',
    operatingProcedure: [
      '每班记录转速 + 电机电流 + 进出口温度',
      '每周清理叶轮积尘',
      '每月检查变频器和轴承温度',
      '每年大修一次',
    ],
    safetyNotes: [
      '叶轮高速旋转，检修前必须断电 + 验明无电压',
      '电机温度 > 95°C 立即停机检查',
      '变频器柜禁止潮湿环境长期运行',
    ],
    troubleshooting: [
      { symptom: '抽气流量 < 7000 m³/h', action: '提高转速 + 清理烟道积焦' },
      { symptom: '电机电流 > 120 A', action: '降低转速 + 排查叶轮卡阻' },
      { symptom: '异常振动', action: '停机检查轴承间隙 + 叶轮动平衡' },
    ],
  },

  'FLUE-301': {
    overview:
      '烟道汇流箱把 4 个炉室排出的烟气汇集后送往抽烟机。' +
      '烟道负压 -200~-400 Pa 是关键控制点。',
    operatingProcedure: [
      '每班记录汇流烟温和负压',
      '每月清理汇流箱底部积焦',
      '每 6 个月做密封性试验',
    ],
    safetyNotes: ['烟道内部 200°C 高温，检修前充分冷却'],
    troubleshooting: [
      { symptom: '负压 < -200 Pa（绝对值不够）', action: '提高抽烟机转速 + 清理烟道' },
      { symptom: '汇流温度异常高', action: '排查炉室温度 + 烟道二次燃烧' },
    ],
  },

  'PUR-501': {
    overview:
      '烟气净化器采用干法吸附（氧化铝吸附 HF），同时除尘。' +
      '入口含尘 200~350 mg/m³，出口要求 < 20 mg/m³，氟含量出口 < 5 mg/m³。',
    operatingProcedure: [
      '每班检查吸附剂料位（< 50% 通知补料）',
      '每天采样测出口氟含量',
      '每月反吹滤袋',
      '每年大修更换滤袋',
    ],
    safetyNotes: ['滤袋老化破损会导致氟泄漏，必须严格管控'],
    troubleshooting: [
      { symptom: '出口含尘 > 20 mg/m³', action: '检查滤袋是否破损 + 立即反吹' },
      { symptom: '出口氟 > 5 mg/m³', action: '检查吸附剂活性 + 加大投料量' },
    ],
  },

  'COKE-801': {
    overview:
      '焦床填料仓存焦炭粉，装炉时填到阳极顶部覆盖 100 mm。' +
      '焦床是阳极在 1100°C 焙烧时的保护层，没有它阳极会被氧化。',
    operatingProcedure: [
      '每班检查料位（< 30% 立即补料）',
      '装炉前检查焦床粒度（10~30 mm 最佳）',
      '焦床厚度统一 100 mm（± 10 mm）',
    ],
    safetyNotes: ['焦粉粉尘可燃，禁止明火 + 防尘措施'],
    troubleshooting: [
      { symptom: '料位 < 30%', action: '通知配料车间紧急补料' },
      { symptom: '焦床厚度不均', action: '装炉操作复核 + 重新摊平' },
    ],
  },

  'OUT-K5': {
    overview:
      '出炉位是 5 号炉室，存放已焙烧完成的熟阳极（210°C 余温）。' +
      '熟阳极电阻率 50~60 μΩ·m，叉车搬运到电解车间使用。',
    operatingProcedure: [
      '出炉温度 < 250°C 才能搬运',
      '每块阳极电阻率抽样检测',
      '不合格品分流单独存放',
    ],
    safetyNotes: ['熟阳极 200+°C 余温，搬运戴隔热手套'],
    troubleshooting: [
      { symptom: '电阻率 > 65 μΩ·m', action: '调整焙烧曲线 + 复检焦床覆盖' },
      { symptom: '出炉温度 > 250°C', action: '延长降温时间 + 加大冷风' },
    ],
  },

  'HMI-901': {
    overview: '炉室温度曲线监控屏，显示 4 个炉室的实时温度 + 目标曲线偏差。',
    operatingProcedure: ['每班监视曲线偏差（< 20°C）'],
    safetyNotes: ['屏幕清洁用干布'],
    troubleshooting: [
      { symptom: '曲线偏差 > 50°C', action: '通知主控调整燃料气 / 抽烟参数' },
    ],
  },

  'HMI-902': {
    overview: '火道温度对比看板，重点监控左右温差。',
    operatingProcedure: ['每 1 小时记录温差，> 30°C 报警'],
    safetyNotes: [],
    troubleshooting: [
      { symptom: '最大温差 > 30°C', action: '降燃料气 + 提抽烟' },
    ],
  },

  'HMI-903': {
    overview: '班组任务台，显示当班指标 / 已出炉 / 不合格 / 合格率。',
    operatingProcedure: ['每出炉 10 块更新数据'],
    safetyNotes: [],
    troubleshooting: [
      { symptom: '合格率 < 90%', action: '召开 QC 会议 + 排查焙烧曲线' },
    ],
  },

  'STACK-601': {
    overview: '排放烟囱，排放温度 140~200°C，氧含量 6~10%。监控末端排放是否合规。',
    operatingProcedure: ['每 4 小时记录温度 + 氧含量'],
    safetyNotes: ['登塔检修必须双保险 + 防坠器'],
    troubleshooting: [
      { symptom: '排放温度 > 250°C', action: '检查净化器和烟道二次燃烧' },
    ],
  },
};
