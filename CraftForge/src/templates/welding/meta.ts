import type { SceneMeta } from '@/types';

export const weldingMeta: SceneMeta = {
  id: 'welding',
  name: '汽车焊装车间',
  shortName: '焊装',
  icon: '🚗',
  description: '白车身机器人点焊产线，含上下件、定位夹具与焊缝检测',
  designSize: { width: 1280, height: 700 },
  primaryColor: '#22d3ee',  // 青蓝，象征焊接电弧
  difficulty: 'intermediate',
  status: 'available',
};
