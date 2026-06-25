import type { SceneMeta } from '@/types';

export const bakingMeta: SceneMeta = {
  id: 'baking',
  name: '阳极焙烧炉车间',
  shortName: '焙烧炉',
  icon: '🔥',
  description: '阳极生产第二工序 — 32 室环式焙烧炉。生阳极在 1100°C 下连续焙烧 25~30 天，挥发分排出+碳骨架固化。学员练升温曲线管控 + 5 类典型故障应对（温度梯度过大/燃料压力波动/抽烟不畅/炉室漏气/焦床问题）',
  designSize: { width: 1280, height: 700 },
  primaryColor: '#dc2626',  // 深红色，象征炽热焙烧炉膛
  difficulty: 'advanced',
  status: 'available',
};
