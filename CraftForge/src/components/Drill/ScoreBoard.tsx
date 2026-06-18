import { useMemo, useRef, useLayoutEffect } from 'react';
import { Trophy, Star, Clock, Target, Zap, TrendingUp, Activity, CheckCircle2, Sparkles, Sprout, Settings2, Target as TargetIcon } from 'lucide-react';
import { useDrillStore } from '@/stores/drillStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { useUIStore } from '@/stores/uiStore';
import { useAIStore } from '@/stores/aiStore';
import type { DrillDifficulty, Fault, Equipment } from '@/types';

// 难度徽章配置：图标 + 中文名 + 颜色（与 TopBar 保持一致）
const DIFFICULTY_BADGES: Record<DrillDifficulty, {
  label: string;
  icon: React.ReactNode;
  cls: string;            // 徽章背景/文字色
}> = {
  novice:   { label: '新手', icon: <Sprout className="w-3 h-3" />,    cls: 'bg-success/20 text-success border-success/40' },
  standard: { label: '进阶', icon: <Settings2 className="w-3 h-3" />, cls: 'bg-info/20 text-info border-info/40' },
  expert:   { label: '专家', icon: <TargetIcon className="w-3 h-3" />, cls: 'bg-warning/20 text-warning border-warning/40' },
};

// 给"建议步骤"找对应症状参数 normal 中点；与 TopBar 同源逻辑（避免循环依赖，这里复制一份）
const STEP_KEYWORD_BY_PARAM: Record<string, string[]> = {
  reactor_temp: ['反应温度', '急冷油', '反应器'],
  regenerator_temp: ['再生温度', '再生器'],
  air_flow: ['风量', '主风', '过滤器'],
  regenerator_pressure: ['再生压力', '催化剂循环'],
  tower_top_temp: ['塔顶温度', '回流'],
  tower_top_pressure: ['塔顶压力', '吹汽'],
  catalyst_circulation: ['催化剂循环', '滑阀'],
  valve_opening: ['滑阀', '塞阀'],
  pump_flow: ['流量'],
};

function findTargetMidForStep(
  stepAction: string,
  fault: Fault,
  equipments: Equipment[],
): string | null {
  for (const sym of fault.symptoms) {
    const keywords = STEP_KEYWORD_BY_PARAM[sym.param] ?? [];
    const allKw = sym.paramName ? [sym.paramName, ...keywords] : keywords;
    if (allKw.some((kw) => stepAction.includes(kw))) {
      const eq = equipments.find((e) => e.id === sym.equipmentId);
      const param = eq?.parameters.find((p) => p.id === sym.param);
      if (param) {
        const mid = Math.round(((param.normalMin + param.normalMax) / 2) * 100) / 100;
        const unit = sym.unit ?? param.unit ?? '';
        return `目标值约 ${mid}${unit}`;
      }
    }
  }
  return null;
}

// 评分栏 / 演练面板：
// - 非演练态：保持 h-16 单行底栏，展示统计 / 历史 / 空状态
// - 演练态：自动撑开（min-h 64px / max-h 200px），分块展示 现象 / 根因 / 影响设备 / 建议步骤
// 通过 ResizeObserver 把自身高度同步到 CSS 变量 --bottom-bar-h，
// 左右栏底部 footer 读取这个变量，实现三栏底部高度始终对齐。
export const ScoreBoard: React.FC = () => {
  const history = useDrillStore((state) => state.history);
  const isRunning = useDrillStore((state) => state.isRunning);
  const currentFault = useDrillStore((state) => state.currentFault);
  const bypassByStabilize = useDrillStore((state) => state.bypassByStabilize);
  // 注意：必须取原始 state（records）再 useMemo 推导，避免每次渲染产生新数组导致无限循环
  const records = useDrillStore((state) => state.records);
  // 演练当前难度（演练开始时锁定到 activeDifficulty，不会因 UI 切换而变）
  const activeDifficulty = useDrillStore((state) => state.activeDifficulty);

  const getEquipmentById = useEquipmentStore((state) => state.getEquipmentById);
  const equipments = useEquipmentStore((state) => state.equipments);
  // 一键平稳工况：把所有 setpoint 重置为正常区间中点；value 由动力学引擎按 tau 滞后逼近
  const setSetpoint = useEquipmentStore((state) => state.setSetpoint);
  const setEquipmentStatus = useEquipmentStore((state) => state.setEquipmentStatus);
  const selectEquipment = useUIStore((state) => state.selectEquipment);
  const sendMessage = useAIStore((state) => state.sendMessage);
  const setAvatarMood = useAIStore((state) => state.setAvatarMood);

  const rootRef = useRef<HTMLDivElement>(null);

  // 把自身实际高度同步到 :root 的 CSS 变量，供左右栏底栏对齐使用
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty('--bottom-bar-h', `${el.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      // 卸载时清掉变量，避免影响其它页面
      document.documentElement.style.removeProperty('--bottom-bar-h');
    };
  }, []);

  // 当前已"做对"的步骤 action 集合 - 在组件内通过 useMemo 推导，保持引用稳定
  const completedSteps = useMemo<string[]>(() => {
    if (!currentFault) return [];
    const correctActions = currentFault.steps.filter((s) => s.correct).map((s) => s.action);
    const done = new Set<string>();
    records.forEach((rec) => {
      if (!rec.isCorrect) return;
      correctActions.forEach((act) => {
        if (rec.action.includes(act) || act.includes(rec.action)) {
          done.add(act);
        }
      });
    });
    return Array.from(done);
  }, [currentFault, records]);

  // 一键平稳工况：把所有参数 setpoint 改为 normal 区间中点 + 设备状态 normal + 标记 bypass + 结束演练
  // value 不再瞬间跳变，而是由动力学引擎按各参数 tau 平滑逼近，演练结束后还能继续看到"工艺收敛"的过程
  const handleStabilize = () => {
    equipments.forEach((eq) => {
      eq.parameters.forEach((p) => {
        const target = Math.round(((p.normalMin + p.normalMax) / 2) * 100) / 100;
        const curSp = p.setpoint ?? p.value;
        if (curSp !== target) {
          setSetpoint(eq.id, p.id, target);
        }
      });
      setEquipmentStatus(eq.id, 'normal');
    });
    if (isRunning) {
      // 通过 bypassByStabilize 触发：内部会标记 bypass 并 endDrill，让 calculateScore 走"基础工况分"分支
      bypassByStabilize();
    }
    setAvatarMood('calm');
    sendMessage(
      '✅ 工艺已下达"平稳工况"指令：所有关键参数 setpoint 已重置到正常区间中点，实际值正在按时间常数滞后逼近（温度类约 20s、压力 8s、流量 5s）。本次演练以"工况复位"结束，仅计基础分。',
      'ai',
    );
  };

  const latestRecord = history[history.length - 1];

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'S': return 'text-yellow-400';
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-orange-400';
      case 'D': return 'text-red-400';
      default: return 'text-text-muted';
    }
  };

  const getGradeBg = (grade: string) => {
    switch (grade) {
      case 'S': return 'bg-yellow-400/20 border-yellow-400/30';
      case 'A': return 'bg-green-400/20 border-green-400/30';
      case 'B': return 'bg-blue-400/20 border-blue-400/30';
      case 'C': return 'bg-orange-400/20 border-orange-400/30';
      case 'D': return 'bg-red-400/20 border-red-400/30';
      default: return 'bg-bg-tertiary border-border';
    }
  };

  // 统计数据（仅非演练态使用）
  const totalDrills = history.length;
  const avgScore = totalDrills > 0
    ? Math.round(history.reduce((sum, r) => sum + r.score, 0) / totalDrills)
    : 0;
  const bestGrade = totalDrills > 0
    ? history.reduce((best, r) => {
        const gradeOrder = ['D', 'C', 'B', 'A', 'S'];
        return gradeOrder.indexOf(r.grade) > gradeOrder.indexOf(best) ? r.grade : best;
      }, 'D')
    : '-';

  // ======== 演练态：完整故障简报面板 ========
  if (isRunning && currentFault) {
    // 推荐处置 = correct 为 true 的步骤
    const correctSteps = currentFault.steps.filter((s) => s.correct);
    // 当前难度对应的徽章配置
    const diffBadge = DIFFICULTY_BADGES[activeDifficulty];
    // 哪些块需要隐藏：expert 模式下隐藏 现象 / 根因 / 影响设备 / 建议步骤
    const hideDetailBlocks = activeDifficulty === 'expert';

    // expert 模式下，"建议步骤"块不显示，但"一键平稳"按钮也得保留——
    // 把它从原本嵌在【建议步骤】块里的位置抽出来，单独作为一个块渲染
    return (
      <div
        ref={rootRef}
        className="flex-shrink-0 bg-bg-secondary border-t border-border min-h-[64px] max-h-[200px] overflow-y-auto"
      >
        <div className="flex items-stretch gap-3 px-4 py-2 min-w-max">
          {/* 标题块：红色脉冲点 + 演练进行中 + 故障名 + 难度徽章 */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-danger/15 border border-danger/30 rounded-lg flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs text-danger font-medium leading-tight">演练进行中</span>
              <span className="text-sm text-text-primary font-bold leading-tight">{currentFault.name}</span>
            </div>
            {/* 难度徽章：与 TopBar 难度色一致；专家模式下尤其重要——这是用户唯一能看到的"当前难度"线索 */}
            <span
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${diffBadge.cls}`}
              title={`当前难度：${diffBadge.label}`}
            >
              {diffBadge.icon}
              <span>{diffBadge.label}</span>
            </span>
          </div>

          {/* 【现象】块：expert 隐藏 */}
          {!hideDetailBlocks && (
            <div className="flex flex-col gap-1 px-3 py-1.5 border border-border rounded-lg bg-bg-primary/40 flex-shrink-0 max-w-[320px]">
              <div className="text-[11px] text-text-muted font-medium">【现象】</div>
              <div className="flex flex-col gap-0.5">
                {currentFault.symptoms.map((s, idx) => {
                  const eqName = getEquipmentById(s.equipmentId)?.name ?? s.equipmentId;
                  const arrow = s.trend === 'up' ? '↑' : '↓';
                  const unit = s.unit ?? '';
                  const paramLabel = s.paramName ?? s.param;
                  return (
                    <div key={idx} className="text-xs text-text-secondary whitespace-nowrap">
                      <span className="text-text-primary">{eqName} {paramLabel}：</span>
                      <span className="text-danger font-mono">{s.value}{unit} {arrow}</span>
                      <span className="text-text-muted"> (正常 {s.normal})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 【根因】块：expert 隐藏 */}
          {!hideDetailBlocks && (
            <div className="flex flex-col gap-1 px-3 py-1.5 border border-border rounded-lg bg-bg-primary/40 flex-shrink-0 max-w-[280px]">
              <div className="text-[11px] text-text-muted font-medium">【根因】</div>
              <div className="text-xs text-text-secondary leading-snug">{currentFault.cause}</div>
            </div>
          )}

          {/* 【影响设备】块：expert 隐藏（不暴露受影响设备） */}
          {!hideDetailBlocks && (
            <div className="flex flex-col gap-1 px-3 py-1.5 border border-border rounded-lg bg-bg-primary/40 flex-shrink-0">
              <div className="text-[11px] text-text-muted font-medium">【影响设备】</div>
              <div className="flex flex-wrap gap-1">
                {currentFault.affectedEquipments.map((eqId) => {
                  const eqName = getEquipmentById(eqId)?.name ?? eqId;
                  return (
                    <button
                      key={eqId}
                      onClick={() => selectEquipment(eqId)}
                      className="px-2 py-0.5 text-xs rounded bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 transition-colors whitespace-nowrap"
                    >
                      {eqName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 【操作统计】块：所有难度都显示 */}
          <div className="flex flex-col gap-1 px-3 py-1.5 border border-border rounded-lg bg-bg-primary/40 flex-shrink-0">
            <div
              className="text-[11px] text-text-muted font-medium"
              title="操作命中：本次演练已操作的总次数中，符合该故障正确处置思路的次数；准确率 = 命中 / 总操作"
            >
              【操作统计】
            </div>
            <div className="flex flex-col gap-0.5 text-xs whitespace-nowrap">
              <span className="text-text-secondary">
                总操作：<span className="text-text-primary font-mono">{records.length}</span>
              </span>
              <span className="text-text-secondary">
                命中：
                <span className="text-success font-mono">
                  {records.filter((r) => r.isCorrect).length}
                </span>
                <span className="text-text-muted"> / {records.length}</span>
              </span>
              <span className="text-text-secondary">
                准确率：
                <span className={`font-mono ${
                  records.length === 0
                    ? 'text-text-muted'
                    : records.filter((r) => r.isCorrect).length / records.length >= 0.7
                    ? 'text-success'
                    : 'text-warning'
                }`}>
                  {records.length > 0
                    ? Math.round((records.filter((r) => r.isCorrect).length / records.length) * 100)
                    : 0}%
                </span>
              </span>
            </div>
          </div>

          {/* 【建议步骤】块：expert 隐藏；novice 在每条后括号显示目标值 */}
          {!hideDetailBlocks && (
            <div className="flex flex-col gap-1 px-3 py-1.5 border border-border rounded-lg bg-bg-primary/40 flex-shrink-0 max-w-[360px]">
              <div className="text-[11px] text-text-muted font-medium">【建议步骤】</div>
              <div className="flex flex-col gap-0.5">
                {correctSteps.map((step, idx) => {
                  const done = completedSteps.includes(step.action);
                  // novice 模式给每条建议追加"目标值约 X"
                  const targetHint =
                    activeDifficulty === 'novice'
                      ? findTargetMidForStep(step.action, currentFault, equipments)
                      : null;
                  return (
                    <div
                      key={step.id}
                      className={`text-xs whitespace-nowrap flex items-center gap-1.5 ${
                        done ? 'text-text-muted line-through' : 'text-text-secondary'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                      ) : (
                        <span className="w-3 h-3 inline-flex items-center justify-center text-[10px] text-primary shrink-0">
                          {idx + 1}
                        </span>
                      )}
                      <span>
                        {step.action}
                        {targetHint && (
                          <span className="ml-1 text-success">（{targetHint}）</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* 一键平稳工况按钮（建议步骤块里的按钮，仅在显示建议步骤时存在） */}
              <button
                onClick={handleStabilize}
                className="mt-1.5 flex items-center justify-center gap-1.5 px-2 py-1 bg-success/20 text-success border border-success/40 rounded text-xs font-medium hover:bg-success/30 transition-colors whitespace-nowrap"
                title="一键把所有参数恢复正常区间，结束当前演练"
              >
                <Sparkles className="w-3.5 h-3.5" />
                一键平稳工况
              </button>
            </div>
          )}

          {/* expert 模式：把"一键平稳"作为独立兜底按钮单独渲染 */}
          {hideDetailBlocks && (
            <div className="flex items-center px-3 py-1.5 flex-shrink-0">
              <button
                onClick={handleStabilize}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-success/20 text-success border border-success/40 rounded text-xs font-medium hover:bg-success/30 transition-colors whitespace-nowrap"
                title="一键把所有参数恢复正常区间，结束当前演练"
              >
                <Sparkles className="w-3.5 h-3.5" />
                一键平稳工况
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ======== 非演练态：保持原有底栏行为 ========
  return (
    <div
      ref={rootRef}
      className="h-16 flex-shrink-0 bg-bg-secondary border-t border-border flex items-center px-4 gap-4 overflow-x-auto"
    >
      {/* 最新评分 */}
      {latestRecord && (
        <>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border flex-shrink-0 ${getGradeBg(latestRecord.grade)}`}>
            <Trophy className="w-4 h-4 text-warning" />
            <span className={`text-lg font-bold ${getGradeColor(latestRecord.grade)}`}>
              {latestRecord.grade}
            </span>
            <span className="text-xs text-text-secondary">
              {latestRecord.score}分
            </span>
            {/* 历史记录里的难度标签：与讲评报告 / 演练态徽章一致 */}
            {latestRecord.difficulty && (() => {
              const b = DIFFICULTY_BADGES[latestRecord.difficulty];
              return (
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${b.cls}`}>
                  {b.icon}
                  <span>{b.label}</span>
                </span>
              );
            })()}
            {latestRecord.breakdown && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-score-report'))}
                className="ml-1 px-2 py-0.5 bg-primary/20 hover:bg-primary/30 text-primary text-[11px] rounded transition-colors whitespace-nowrap"
                title="查看本次演练的评分明细 / 强项 / 提升建议"
              >
                查看讲评
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-text-secondary flex-shrink-0">
            <span className="flex items-center gap-1" title="本次演练用时">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {Math.round((latestRecord.endTime - latestRecord.startTime) / 1000)}秒
            </span>
            <span
              className="flex items-center gap-1"
              title="操作命中 / 总操作：本次演练中符合该故障正确处置思路的操作次数 / 总操作次数"
            >
              <Target className="w-3.5 h-3.5 text-success" />
              命中 {latestRecord.steps.filter(s => s.isCorrect).length}/{latestRecord.steps.length}
            </span>
            <span
              className="flex items-center gap-1"
              title="准确率 = 命中操作数 / 总操作数 × 100%"
            >
              <Zap className="w-3.5 h-3.5 text-warning" />
              准确率 {latestRecord.steps.length > 0
                ? Math.round((latestRecord.steps.filter(s => s.isCorrect).length / latestRecord.steps.length) * 100)
                : 0}%
            </span>
          </div>
        </>
      )}

      {/* 历史统计 */}
      {totalDrills > 1 && (
        <div className="flex items-center gap-3 border-l border-border pl-4 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <TrendingUp className="w-3.5 h-3.5 text-info" />
            平均 {avgScore}分
          </span>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
            最佳 {bestGrade}
          </span>
          <span className="text-xs text-text-muted">共 {totalDrills} 次</span>
        </div>
      )}

      {/* 空闲状态提示（无演练且无历史） */}
      {!latestRecord && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Activity className="w-4 h-4" />
          <span>点击顶部"开始演练"按钮，进入故障排查实训</span>
        </div>
      )}
    </div>
  );
};
