import type { SceneMeta } from '@/types';

export const tbmMeta: SceneMeta = {
  id: 'tbm',
  name: '盾构机隧道掘进',
  shortName: '盾构机',
  icon: '🛞',
  description: '泥水平衡盾构机城市轨道掘进，3D 全立体场景，含刀盘切削/管片拼装/姿态控制/同步注浆',
  // 3D 场景：designSize 仅作为 UI 浮层布局参考，实际 3D 渲染填满父容器
  designSize: { width: 1280, height: 760 },
  primaryColor: '#f59e0b',  // 工程黄（盾构机经典涂装）
  difficulty: 'advanced',
  status: 'available',
  // 标识为 3D 场景，FactoryCanvas/SceneGalleryPage 可据此切换渲染器
  is3D: true,
};
