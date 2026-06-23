import type { SceneMeta } from '@/types';

export const injectionMeta: SceneMeta = {
  id: 'injection',
  name: '注塑成型车间',
  shortName: '注塑',
  icon: '🧴',
  description: '塑料注塑成型生产线，含双工位注塑机、取件机械手、模具、模温机、加热筒、冷却水回路、双输送带与在线检测',
  designSize: { width: 1280, height: 700 },
  primaryColor: '#f59e0b',  // 琥珀橙，象征熔融塑料
  difficulty: 'intermediate',
  status: 'available',
};
