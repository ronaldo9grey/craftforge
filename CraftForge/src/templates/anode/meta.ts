import type { SceneMeta } from '@/types';

export const anodeMeta: SceneMeta = {
  id: 'anode',
  name: '阳极振压成型车间',
  shortName: '阳极成型',
  icon: '🧱',
  description: '电解铝上游 — 预焙阳极生产线振压成型工序。涵盖糊料温度控制、振压压力、模具温度、真空脱气、生阳极冷却 5 大节点；学员练成型工艺操作 + 5 类典型缺陷应对（裂纹/起鼓/缺角/密度低/粘模）',
  designSize: { width: 1280, height: 700 },
  primaryColor: '#f97316',  // 橘色，象征加热糊料
  difficulty: 'intermediate',
  status: 'available',
};
