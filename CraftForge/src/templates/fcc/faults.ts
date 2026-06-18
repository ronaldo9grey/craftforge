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
];
