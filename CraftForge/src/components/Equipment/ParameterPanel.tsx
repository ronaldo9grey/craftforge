import { useState } from 'react';
import { X, BookOpen, History, Sliders, Check, AlertTriangle, TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useDrillStore } from '@/stores/drillStore';
import { useDivergenceStore } from '@/stores/divergenceStore';
import { fccManuals } from '@/templates/fcc/manuals';

// 弹窗内三种视图：参数 / 操作手册 / 历史记录
type ViewMode = 'params' | 'manual' | 'history';

export const ParameterPanel: React.FC = () => {
  const selectedEquipmentId = useUIStore((state) => state.selectedEquipmentId);
  const showParameterPanel = useUIStore((state) => state.showParameterPanel);
  const divergingKeys = useDivergenceStore((s) => s.divergingKeys);
  const selectEquipment = useUIStore((state) => state.selectEquipment);
  const getEquipmentById = useEquipmentStore((state) => state.getEquipmentById);
  // setSetpoint：学员调滑块只改"目标值"，由动力学引擎驱动实际 value 逐步逼近
  const setSetpoint = useEquipmentStore((state) => state.setSetpoint);
  const operationHistory = useEquipmentStore((state) => state.operationHistory);

  // 演练态相关：用于在头部下方插入"当前故障"横幅
  const isDrillRunning = useDrillStore((state) => state.isRunning);
  const currentFault = useDrillStore((state) => state.currentFault);
  const recordParameterAdjustment = useDrillStore((state) => state.recordParameterAdjustment);
  // 当前演练锁定难度：expert 模式下需要隐藏故障横幅与异常方向三角标记，
  // 让学员只能从"实际值偏离 normal 区间"以及双值显示自行感知异常
  const activeDifficulty = useDrillStore((state) => state.activeDifficulty);
  const isExpertDrill = isDrillRunning && activeDifficulty === 'expert';

  // 当前激活视图，默认显示参数面板
  const [activeView, setActiveView] = useState<ViewMode>('params');

  const equipment = selectedEquipmentId ? getEquipmentById(selectedEquipmentId) : null;

  if (!showParameterPanel || !equipment) return null;

  // 该设备是否处于"故障演练影响范围"中（用于决定是否显示故障关联横幅）
  // expert 模式下强制为 false：横幅、症状细节都不展示
  const isAffected =
    isDrillRunning && !isExpertDrill && !!currentFault && currentFault.affectedEquipments.includes(equipment.id);
  // 当前设备相关的症状列表（仅展示属于本设备的）
  const equipmentSymptoms = isAffected && currentFault
    ? currentFault.symptoms.filter((s) => s.equipmentId === equipment.id)
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-success';
      case 'warning': return 'text-warning';
      case 'danger': return 'text-danger';
      case 'offline': return 'text-text-muted';
      default: return 'text-success';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '正常运行';
      case 'warning': return '警告';
      case 'danger': return '危险';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  const handleParameterChange = (paramId: string, value: number) => {
    // 取调参前的旧 setpoint 与中文名，演练中需用于评分判定（评分基于 setpoint 变化方向）
    const oldParam = equipment.parameters.find((p) => p.id === paramId);
    const oldSetpoint = oldParam?.setpoint ?? oldParam?.value ?? value;
    const paramName = oldParam?.name ?? paramId;

    // 学员调的是 setpoint（目标值），实际 value 由动力学引擎按一阶滞后逐步逼近
    setSetpoint(equipment.id, paramId, value);

    // 演练进行中且 setpoint 实际变化时，把调参动作记入演练记录
    // 注意：oldValue / newValue 都传 setpoint，让评分逻辑判断的是"目标值朝 normal 方向移动"
    if (isDrillRunning && oldSetpoint !== value) {
      recordParameterAdjustment(equipment.id, paramId, paramName, Number(oldSetpoint), value);
    }
  };

  // 仅 FCC 模板下查询手册；其它模板暂未提供
  const manual = equipment.template === 'fcc' ? fccManuals[equipment.id] : undefined;
  // 当前设备的历史记录（最近 20 条，倒序）
  const history = (operationHistory[equipment.id] ?? []).slice(-20).reverse();

  // 通用按钮样式：图标 + 文字横排紧凑显示，不允许换行；激活时高亮
  const tabBtnClass = (mode: ViewMode) =>
    `flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md transition-colors text-xs whitespace-nowrap ${
      activeView === mode
        ? 'bg-primary text-white'
        : 'bg-bg-tertiary text-text-secondary hover:bg-border'
    }`;

  return (
    <div className="absolute top-16 right-4 w-80 bg-bg-secondary border border-border rounded-lg shadow-xl z-50">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <span className="text-primary font-bold text-lg">
              {equipment.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-medium text-text-primary">{equipment.name}</h3>
            <p className="text-xs text-text-muted">{equipment.id}</p>
          </div>
        </div>
        <button
          onClick={() => selectEquipment(null)}
          className="p-1 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 故障关联横幅：仅在该设备属于当前故障 affectedEquipments 时显示 */}
      {isAffected && currentFault && (
        <div className="px-4 py-2 bg-danger/15 border-b border-danger/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="text-danger font-medium">当前故障：{currentFault.name}</div>
            <div className="text-text-secondary mt-0.5 space-y-0.5">
              {equipmentSymptoms.length === 0 && (
                <div className="text-text-muted">本设备已被标红，但故障症状落在其它关联设备上</div>
              )}
              {equipmentSymptoms.map((s, idx) => {
                const arrow = s.trend === 'up' ? '↑' : '↓';
                const unit = s.unit ?? '';
                const label = s.paramName ?? s.param;
                return (
                  <div key={idx}>
                    <span>{label}: </span>
                    <span className="text-danger font-mono">{s.value}{unit} {arrow}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 状态 */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor(equipment.status)}`} />
          <span className={`text-sm ${getStatusColor(equipment.status)}`}>
            {getStatusText(equipment.status)}
          </span>
        </div>
      </div>

      {/* 视图切换 Tab */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
        <button onClick={() => setActiveView('params')} className={tabBtnClass('params')}>
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          参数
        </button>
        <button onClick={() => setActiveView('manual')} className={tabBtnClass('manual')}>
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          手册
        </button>
        <button onClick={() => setActiveView('history')} className={tabBtnClass('history')}>
          <History className="w-3.5 h-3.5 shrink-0" />
          记录
        </button>
      </div>

      {/* 参数视图 */}
      {activeView === 'params' && (
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {equipment.parameters.map((param) => {
            const isNormal = param.value >= param.normalMin && param.value <= param.normalMax;
            // 滑块对应的是"目标值 setpoint"，未配置时退化为 value（保持兼容）
            const setpoint = param.setpoint ?? param.value;
            // 进度条按 setpoint 显示，体现"用户拨到的目标位置"
            const percentage = ((setpoint - param.min) / (param.max - param.min)) * 100;
            // 异常方向：高于正常上限为 up，低于正常下限为 down（按实际 value 判断）
            const isHigh = param.value > param.normalMax;
            const isLow = param.value < param.normalMin;

            // 是否处于"逼近中"：实际 value 与 setpoint 差异超过量程的 1%
            const tolerance = (param.max - param.min) * 0.01;
            const isApproaching = Math.abs(param.value - setpoint) > tolerance;

            return (
              <div
                key={param.id}
                className={`space-y-2 ${
                  isNormal ? '' : 'border-l-2 border-danger pl-2'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary flex items-center gap-1">
                    {param.name}
                    {/* 异常方向三角标记：根据 value 是否 > normalMax 或 < normalMin
                        expert 模式下隐藏（学员需要自己看实际值与 normal 区间判断方向） */}
                    {!isExpertDrill && isHigh && <TrendingUp className="w-3.5 h-3.5 text-danger" />}
                    {!isExpertDrill && isLow && <TrendingDown className="w-3.5 h-3.5 text-danger" />}
                    {/* P2+ 发散标记：该参数正在被正反馈发散驱动持续恶化 */}
                    {divergingKeys.has(`${equipment.id}::${param.id}`) && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                        <Flame className="w-3 h-3" />
                        持续恶化中
                      </span>
                    )}
                  </span>
                  {/* 头部数值：显示"目标 setpoint"（学员调到的位置） */}
                  <span className="text-sm font-mono font-medium text-text-primary">
                    {Number(setpoint).toFixed(2)} {param.unit}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={(param.max - param.min) / 100}
                    value={setpoint}
                    onChange={(e) => handleParameterChange(param.id, parseFloat(e.target.value))}
                    className="w-full"
                    style={{
                      background: `linear-gradient(to right, ${isNormal ? '#3b82f6' : '#ef4444'} 0%, ${isNormal ? '#3b82f6' : '#ef4444'} ${percentage}%, #334155 ${percentage}%, #334155 100%)`
                    }}
                  />
                </div>

                {/* 双值显示：目标值 / 实际值 */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    目标 / setpoint：
                    <span className="font-mono text-text-primary ml-1">
                      {Number(setpoint).toFixed(2)}{param.unit}
                    </span>
                  </span>
                  <span className={`font-mono ${isNormal ? 'text-text-muted' : 'text-danger'}`}>
                    实际 / value：
                    <span className="ml-1">{Number(param.value).toFixed(2)}{param.unit}</span>
                    {isApproaching && (
                      <span className="ml-1 text-warning">逼近中…</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{param.min}{param.unit}</span>
                  <span className={isNormal ? 'text-success' : 'text-danger'}>
                    正常范围: {param.normalMin}-{param.normalMax}{param.unit}
                  </span>
                  <span>{param.max}{param.unit}</span>
                </div>

                {/* 趋势微图 */}
                {param.trend.length > 1 && (
                  <div className="h-8 bg-bg-tertiary rounded overflow-hidden">
                    <svg className="w-full h-full" viewBox={`0 0 ${param.trend.length} 50`} preserveAspectRatio="none">
                      <polyline
                        fill="none"
                        stroke={isNormal ? '#3b82f6' : '#ef4444'}
                        strokeWidth="2"
                        points={param.trend.map((v, i) => {
                          const normalizedValue = ((v - param.min) / (param.max - param.min)) * 50;
                          return `${i},${50 - normalizedValue}`;
                        }).join(' ')}
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 操作手册视图 */}
      {activeView === 'manual' && (
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto text-sm">
          {!manual && (
            <div className="text-center text-text-muted py-8">暂无手册</div>
          )}
          {manual && (
            <>
              {/* 设备概述 */}
              <section>
                <h4 className="font-medium text-text-primary mb-2">设备概述</h4>
                <p className="text-text-secondary leading-relaxed">{manual.overview}</p>
              </section>
              {/* 标准操作步骤 */}
              <section>
                <h4 className="font-medium text-text-primary mb-2">标准操作步骤</h4>
                <ol className="list-decimal list-inside space-y-1 text-text-secondary">
                  {manual.operatingProcedure.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </section>
              {/* 安全注意事项 */}
              <section>
                <h4 className="font-medium text-text-primary mb-2">安全注意事项</h4>
                <ul className="space-y-1">
                  {manual.safetyNotes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-text-secondary">
                      <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {/* 常见故障处理 */}
              <section>
                <h4 className="font-medium text-text-primary mb-2">常见故障处理</h4>
                <div className="space-y-2">
                  {manual.troubleshooting.map((item, idx) => (
                    <div key={idx} className="bg-bg-tertiary rounded p-2">
                      <div className="text-text-primary">{item.symptom}</div>
                      <div className="text-text-muted text-xs mt-1">→ {item.action}</div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* 历史记录视图 */}
      {activeView === 'history' && (
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto text-sm">
          {history.length === 0 && (
            <div className="text-center text-text-muted py-8">暂无操作记录</div>
          )}
          {history.map((rec, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-bg-tertiary rounded p-2">
              {rec.isCorrect ? (
                <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-text-muted text-xs">
                  {new Date(rec.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-text-primary break-words">{rec.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
