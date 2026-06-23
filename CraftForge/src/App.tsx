import { useEffect, useRef } from 'react';
import { TopBar } from '@/components/Layout/TopBar';
import { LeftSidebar } from '@/components/Layout/LeftSidebar';
import { RightSidebar } from '@/components/Layout/RightSidebar';
import { FactoryCanvas } from '@/components/Canvas/FactoryCanvas';
import { ParameterPanel } from '@/components/Equipment/ParameterPanel';
import { ScoreBoard } from '@/components/Drill/ScoreBoard';
import { ScoreReportContainer } from '@/components/Drill/ScoreReport';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useAIStore } from '@/stores/aiStore';
import { useDrillStore } from '@/stores/drillStore';
import { DynamicsEngine } from '@/engine/dynamics';
import { fccCouplings } from '@/templates/fcc/dynamics';
import { weldingCouplings } from '@/templates/welding/dynamics';
import { cncCouplings } from '@/templates/cnc/dynamics';
import { injectionCouplings } from '@/templates/injection/dynamics';
import { useDivergenceStore } from '@/stores/divergenceStore';

function App() {
  const activeTemplate = useUIStore((state) => state.activeTemplate);
  const loadTemplate = useEquipmentStore((state) => state.loadTemplate);
  const loadKnowledge = useAIStore((state) => state.loadKnowledge);
  const equipments = useEquipmentStore((state) => state.equipments);

  // 动力学引擎实例（生命周期与模板绑定，切换模板时停旧起新）
  const engineRef = useRef<DynamicsEngine | null>(null);

  // 默认加载催化裂化模板
  useEffect(() => {
    if (!activeTemplate) {
      loadTemplate('fcc');
      loadKnowledge('fcc');
    }
  }, []);

  // 模板切换：根据 activeTemplate 启停动力学引擎
  useEffect(() => {
    // 先停掉旧的引擎，避免重复 tick
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }

    if (activeTemplate === 'fcc') {
      const engine = new DynamicsEngine(useEquipmentStore, useDrillStore, fccCouplings);
      engine.onDivergenceUpdate = (keys) => useDivergenceStore.getState().setDivergingKeys(keys);
      engine.start();
      engineRef.current = engine;
    } else if (activeTemplate === 'welding') {
      const engine = new DynamicsEngine(useEquipmentStore, useDrillStore, weldingCouplings);
      engine.onDivergenceUpdate = (keys) => useDivergenceStore.getState().setDivergingKeys(keys);
      engine.start();
      engineRef.current = engine;
    } else if (activeTemplate === 'cnc') {
      const engine = new DynamicsEngine(useEquipmentStore, useDrillStore, cncCouplings);
      engine.onDivergenceUpdate = (keys) => useDivergenceStore.getState().setDivergingKeys(keys);
      engine.start();
      engineRef.current = engine;
    } else if (activeTemplate === 'injection') {
      // 注塑模板：螺杆→压力 / 模温→周期 / 冷却水→模温 / 含水→缺陷 等约 15 条耦合
      const engine = new DynamicsEngine(useEquipmentStore, useDrillStore, injectionCouplings);
      engine.onDivergenceUpdate = (keys) => useDivergenceStore.getState().setDivergingKeys(keys);
      engine.start();
      engineRef.current = engine;
    }

    // 组件卸载或 activeTemplate 变化时停止旧引擎
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [activeTemplate]);

  return (
    <div className="h-screen w-screen bg-bg-primary flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <TopBar />

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧边栏 */}
        <LeftSidebar />

        {/* 中央内容区：上方画布 + 下方评分栏，整体与左右栏底部对齐 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 画布区域 */}
          <div className="flex-1 relative overflow-hidden">
            <FactoryCanvas />

            {/* 参数面板（浮在画布上） */}
            <ParameterPanel />

            {/* 空状态提示 - 只在无设备时显示 */}
            {(!activeTemplate || equipments.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-primary z-10">
                <div className="text-center">
                  <div className="w-20 h-20 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">🏭</span>
                  </div>
                  <h2 className="text-xl font-semibold text-text-primary mb-2">
                    欢迎使用匠魂实训引擎
                  </h2>
                  <p className="text-text-secondary mb-4">
                    请从左侧选择工业场景开始实训
                  </p>
                  <div className="flex gap-4 justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-primary text-xl">⚗️</span>
                      </div>
                      <p className="text-xs text-text-muted">催化裂化</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-success/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <span className="text-success text-xl">🔧</span>
                      </div>
                      <p className="text-xs text-text-muted">焊装车间</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 评分栏 - 固定底部，与左右栏 footer 对齐 */}
          <ScoreBoard />
        </div>

        {/* 右侧边栏 */}
        <RightSidebar />
      </div>

      {/* 演练讲评报告（演练结束自动弹出） */}
      <ScoreReportContainer />
    </div>
  );
}

export default App;
