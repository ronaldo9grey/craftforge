import type { Fault } from '@/types';

export const offshoreFaults: Fault[] = [
  {
    id: 'RIGF001',
    name: '井涌',
    description: '钻遇高压地层，地层流体侵入井筒，环空压力持续上升，泥浆池体积增大，如不及时处理将发展为井喷。',
    cause: '泥浆密度不足以平衡地层孔隙压力，加上节流阀开度过大导致环空背压不足。',
    affectedEquipments: ['RIG-BOP-101', 'RIG-CK-101', 'RIG-MP-101', 'RIG-RIS-101'],
    symptoms: [
      { equipmentId: 'RIG-BOP-101', param: 'annular_pressure', paramName: '环空压力', value: 15, unit: 'MPa', normal: '3-25', trend: 'up' },
      { equipmentId: 'RIG-RIS-101', param: 'mud_return', paramName: '泥浆返出', value: 2800, unit: 'L/min', normal: '900-3500', trend: 'up' },
      { equipmentId: 'RIG-MP-101', param: 'pressure', paramName: '泵压', value: 22, unit: 'MPa', normal: '8-35', trend: 'up' },
    ],
    steps: [
      { id: 's1', action: '关闭节流阀增加环空背压', correct: true, order: 1 },
      { id: 's2', action: '提高泥浆泵流量循环排气', correct: true, order: 2 },
      { id: 's3', action: '提高泥浆密度压住地层流体', correct: true, order: 3 },
      { id: 's4', action: '降低泥浆密度', correct: false, order: 4 },
      { id: 's5', action: '增大节流阀开度', correct: false, order: 5 },
      { id: 's6', action: '停止泥浆泵', correct: false, order: 6 },
    ],
    hints: [
      '井涌三步：关节流→循环排气→加重泥浆',
      '环空压力上升说明地层流体在侵入，必须增加背压',
      'BOP闸板是最后防线，平时要保证密封完好',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'RIG-BOP-101', param: 'annular_pressure', rate: 0.3, cap: 45, delaySec: 5 },
        { equipmentId: 'RIG-RIS-101', param: 'mud_return', rate: 8, cap: 3500, delaySec: 3 },
      ],
    },
  },
  {
    id: 'RIGF002',
    name: '卡钻',
    description: '钻具在井内被卡住无法转动或上下活动，扭矩急剧上升，大钩载荷异常增大，可能由压差粘附、键槽或井壁坍塌引起。',
    cause: '泥浆性能变差导致井壁不稳定，加上钻压过大、转速偏低，钻具贴壁时间过长形成压差粘附。',
    affectedEquipments: ['RIG-DCR-101', 'RIG-RST-101', 'RIG-MP-101'],
    symptoms: [
      { equipmentId: 'RIG-RST-101', param: 'torque', paramName: '扭矩', value: 45, unit: 'kN·m', normal: '5-40', trend: 'up' },
      { equipmentId: 'RIG-DCR-101', param: 'hoist_load', paramName: '大钩载荷', value: 2800, unit: 'kN', normal: '800-3000', trend: 'up' },
      { equipmentId: 'RIG-DCR-101', param: 'wob', paramName: '钻压', value: 350, unit: 'kN', normal: '80-300', trend: 'up' },
    ],
    steps: [
      { id: 's1', action: '降低钻压减少摩擦', correct: true, order: 1 },
      { id: 's2', action: '提高泥浆泵流量改善井底清洁', correct: true, order: 2 },
      { id: 's3', action: '活动钻具上下提拉', correct: true, order: 3 },
      { id: 's4', action: '增大钻压强行钻进', correct: false, order: 4 },
      { id: 's5', action: '停止泥浆循环', correct: false, order: 5 },
      { id: 's6', action: '降低转速', correct: false, order: 6 },
    ],
    hints: [
      '卡钻处理：降钻压→大排量洗井→活动钻具',
      '扭矩飙升说明阻力在增大，不能硬来',
      '保持泥浆循环是解卡的关键',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'RIG-RST-101', param: 'torque', rate: 0.5, cap: 50, delaySec: 5 },
        { equipmentId: 'RIG-DCR-101', param: 'hoist_load', rate: 15, cap: 3500, delaySec: 8 },
      ],
    },
  },
  {
    id: 'RIGF003',
    name: '泥浆漏失',
    description: '泥浆大量漏入地层，泵压上升但返出量骤降，泥浆池液面下降，严重时导致井壁失稳和井涌。',
    cause: '泥浆密度过高超过地层破裂压力，或钻遇天然裂缝/溶洞地层。',
    affectedEquipments: ['RIG-MP-101', 'RIG-SH-101', 'RIG-RIS-101'],
    symptoms: [
      { equipmentId: 'RIG-MP-101', param: 'pressure', paramName: '泵压', value: 28, unit: 'MPa', normal: '8-35', trend: 'up' },
      { equipmentId: 'RIG-RIS-101', param: 'mud_return', paramName: '泥浆返出', value: 800, unit: 'L/min', normal: '900-3500', trend: 'down' },
      { equipmentId: 'RIG-SH-101', param: 'throughput', paramName: '处理量', value: 600, unit: 'L/min', normal: '800-3500', trend: 'down' },
    ],
    steps: [
      { id: 's1', action: '降低泥浆密度减轻液柱压力', correct: true, order: 1 },
      { id: 's2', action: '降低泥浆泵排量减少漏失', correct: true, order: 2 },
      { id: 's3', action: '加入堵漏材料封堵裂缝', correct: true, order: 3 },
      { id: 's4', action: '增大泥浆泵排量', correct: false, order: 4 },
      { id: 's5', action: '提高泥浆密度', correct: false, order: 5 },
      { id: 's6', action: '全开节流阀', correct: false, order: 6 },
    ],
    hints: [
      '漏失三步：降密度→降排量→加堵漏材料',
      '泵压涨但返出掉，典型漏失征兆',
      '堵漏材料用核桃壳、云母片等颗粒材料',
    ],
    divergence: {
      drivers: [
        { equipmentId: 'RIG-RIS-101', param: 'mud_return', rate: -12, cap: 200, delaySec: 3 },
        { equipmentId: 'RIG-MP-101', param: 'pressure', rate: 0.2, cap: 45, delaySec: 5 },
      ],
    },
  },
];
