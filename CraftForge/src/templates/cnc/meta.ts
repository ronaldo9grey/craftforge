import type { SceneMeta } from '@/types';

export const cncMeta: SceneMeta = {
  id: 'cnc',
  name: '数控加工车间',
  shortName: 'CNC',
  icon: '🔧',
  description: '车铣复合数控机床产线，含主轴、刀塔、工件装夹与切削冷却',
  designSize: { width: 1280, height: 700 },
  primaryColor: '#a78bfa',  // 紫色，象征精密加工
  difficulty: 'intermediate',
  status: 'available',
};
