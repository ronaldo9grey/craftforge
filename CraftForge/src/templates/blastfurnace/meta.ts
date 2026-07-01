import type { SceneMeta } from '@/types';

// 高炉炼铁 3D 场景元数据 v1
// 场景定位：千吨钢铁产线的核心 —— 炉体温度控制 + 铁水质量把控
// 复用 SceneMeta 通用格式；is3D=true 由 FactoryCanvas 路由到 BlastFurnace3D 组件
export const blastfurnaceMeta: SceneMeta = {
  id: 'blastfurnace',
  name: '高炉炼铁',
  shortName: '高炉',
  icon: '⛰️',
  description: '千吨钢铁产线核心 · 铁水温度控制 · 炉温异常抢救',
  // 3D 场景：designSize 仅作为 UI 浮层布局参考，实际 3D 渲染填满父容器
  designSize: { width: 1280, height: 760 },
  primaryColor: '#f97316',  // 熔铁橙 —— 与铁水/焰心颜色一致
  difficulty: 'advanced',
  status: 'available',
  is3D: true,
};
