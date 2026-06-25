// =============================================================
// 场景注册中心 (Scene Registry) v1
// 所有场景包在此集中注册。新增场景只需：
//   1. 在 src/templates/<id>/ 下创建 meta.ts + (已有 config.ts + faults.ts)
//   2. 在此文件 import + 注册一行
// 其他模块（LeftSidebar / aiCoach / FactoryCanvas 等）自动识别
// =============================================================
import type { ScenePack, SceneMeta, SceneCoach } from '@/types';

// —— FCC 催化裂化 ——
import { fccEquipments, fccPipelines } from './fcc/config';
import { fccFaults } from './fcc/faults';
import { fccMeta } from './fcc/meta';
import { fccCoach } from './fcc/coach';

// —— 汽车焊装 ——
import { weldingEquipments, weldingPipelines } from './welding/config';
import { weldingFaults } from './welding/faults';
import { weldingMeta } from './welding/meta';
import { weldingCoach } from './welding/coach';

// —— 数控加工 ——
import { cncEquipments, cncPipelines } from './cnc/config';
import { cncFaults } from './cnc/faults';
import { cncMeta } from './cnc/meta';
import { cncCoach } from './cnc/coach';

// —— 注塑成型 ——
import { injectionEquipments, injectionPipelines } from './injection/config';
import { injectionFaults } from './injection/faults';
import { injectionMeta } from './injection/meta';
import { injectionCoach } from './injection/coach';

// —— 电解铝车间 ——
import { aluminumEquipments, aluminumPipelines } from './aluminum/config';
import { aluminumFaults } from './aluminum/faults';
import { aluminumMeta } from './aluminum/meta';
import { aluminumCoach } from './aluminum/coach';

// —— 阳极振压成型（电解铝上游）——
import { anodeEquipments, anodePipelines } from './anode/config';
import { anodeFaults } from './anode/faults';
import { anodeMeta } from './anode/meta';
import { anodeCoach } from './anode/coach';

// =============================================================
// 场景注册表
// =============================================================
export const SCENES: Record<string, ScenePack> = {
  fcc: {
    meta: fccMeta,
    coach: fccCoach,
    equipments: fccEquipments,
    pipelines: fccPipelines,
    faults: fccFaults,
  },
  welding: {
    meta: weldingMeta,
    coach: weldingCoach,
    equipments: weldingEquipments,
    pipelines: weldingPipelines,
    faults: weldingFaults,
  },
  cnc: {
    meta: cncMeta,
    coach: cncCoach,
    equipments: cncEquipments,
    pipelines: cncPipelines,
    faults: cncFaults,
  },
  injection: {
    meta: injectionMeta,
    coach: injectionCoach,
    equipments: injectionEquipments,
    pipelines: injectionPipelines,
    faults: injectionFaults,
  },
  aluminum: {
    meta: aluminumMeta,
    coach: aluminumCoach,
    equipments: aluminumEquipments,
    pipelines: aluminumPipelines,
    faults: aluminumFaults,
  },
  anode: {
    meta: anodeMeta,
    coach: anodeCoach,
    equipments: anodeEquipments,
    pipelines: anodePipelines,
    faults: anodeFaults,
  },
};

/** 已注册的场景 ID 列表（用于自动生成选择器等） */
export const SCENE_IDS = Object.keys(SCENES);

/** 根据 ID 获取场景包 */
export function getScenePack(id: string): ScenePack | undefined {
  return SCENES[id];
}

/** 获取所有可选用的场景 pack 数组（按原始注册顺序） */
export function getAvailableScenes(): ScenePack[] {
  return SCENE_IDS.map((id) => SCENES[id]).filter((s) => s.meta.status === 'available');
}

/** 获取场景元数据 */
export function getSceneMeta(id: string): SceneMeta | undefined {
  return SCENES[id]?.meta;
}

/** 获取场景师傅人设 */
export function getSceneCoach(id: string): SceneCoach | undefined {
  return SCENES[id]?.coach;
}