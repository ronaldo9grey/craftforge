import { Play, Pause, RotateCcw, Volume2, VolumeX, HelpCircle, User, Menu, X, AlertTriangle, Sprout, Settings2, Target } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useDrillStore } from '@/stores/drillStore';
import { useAIStore } from '@/stores/aiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { coachOpening } from '@/services/aiCoach';
import type { DrillDifficulty, Fault, Equipment } from '@/types';

// 根据 step.action 文本，从故障症状参数里反查"对应参数的 normal 区间中点"。
// 用于新手模式给每条建议处置补一个"目标值约 X 单位"的提示。
// 实现：把 step.action 与 fault.symptoms 中各参数的 paramName / 关键字做包含匹配，
// 找到第一个匹配的症状参数，然后从 equipments 里取该参数的 normalMin/normalMax 中点。
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

function findTargetHintForStep(
  stepAction: string,
  fault: Fault,
  equipments: Equipment[],
): string | null {
  // 先按 fault.symptoms 里的 paramName / 关键字匹配
  for (const sym of fault.symptoms) {
    const keywords = STEP_KEYWORD_BY_PARAM[sym.param] ?? [];
    const allKw = sym.paramName ? [sym.paramName, ...keywords] : keywords;
    if (allKw.some((kw) => stepAction.includes(kw))) {
      const eq = equipments.find((e) => e.id === sym.equipmentId);
      const param = eq?.parameters.find((p) => p.id === sym.param);
      if (param) {
        const mid = Math.round(((param.normalMin + param.normalMax) / 2) * 100) / 100;
        const unit = sym.unit ?? param.unit ?? '';
        return `→ 目标值约 ${mid}${unit}`;
      }
    }
  }
  return null;
}

export const TopBar: React.FC = () => {
  const activeTemplate = useUIStore((state) => state.activeTemplate);
  const systemStatus = useUIStore((state) => state.systemStatus);
  const sidebarLeftOpen = useUIStore((state) => state.sidebarLeftOpen);
  const toggleSidebarLeft = useUIStore((state) => state.toggleSidebarLeft);
  const isDrillRunning = useDrillStore((state) => state.isRunning);
  const currentFault = useDrillStore((state) => state.currentFault);
  const startDrill = useDrillStore((state) => state.startDrill);
  const endDrill = useDrillStore((state) => state.endDrill);
  // 难度相关：选中难度 + 切换函数
  const difficulty = useDrillStore((state) => state.difficulty);
  const setDifficulty = useDrillStore((state) => state.setDifficulty);
  
  const voiceEnabled = useAIStore((state) => state.voiceEnabled);
  const toggleVoice = useAIStore((state) => state.toggleVoice);
  const sendMessage = useAIStore((state) => state.sendMessage);
  const setAvatarMood = useAIStore((state) => state.setAvatarMood);
  
  const setEquipmentStatus = useEquipmentStore((state) => state.setEquipmentStatus);
  // 故障注入走 setpoint：把症状 value 写到对应参数的 setpoint，
  // 让动力学引擎按 tau 把 value 自然滞后逼近，体现"看着参数慢慢恶化"
  const setSetpoint = useEquipmentStore((state) => state.setSetpoint);
  const equipments = useEquipmentStore((state) => state.equipments);

  const handleStartDrill = () => {
    if (isDrillRunning) {
      // 结束演练，计算评分
      endDrill();
      setAvatarMood('calm');
      
      // 重置设备状态
      equipments.forEach((eq) => {
        setEquipmentStatus(eq.id, 'normal');
      });
      
      // 评分面板自动显示在底部
    } else {
      // 开始演练
      startDrill();
      
      // 获取当前故障（startDrill后currentFault已更新），同时锁定本次演练难度
      setTimeout(() => {
        const drillState = useDrillStore.getState();
        const fault = drillState.currentFault;
        const activeDifficulty = drillState.activeDifficulty;
        if (!fault) return;

        // —— 任务 5：故障注入是否标红设备 ——
        // novice / standard：照旧把 affectedEquipments 标红
        // expert：跳过标红，让学员只能从参数偏离感知（不调用 setEquipmentStatus）
        if (activeDifficulty !== 'expert') {
          fault.affectedEquipments.forEach((eqId: string) => {
            setEquipmentStatus(eqId, 'danger');
          });
        }

        // 按 symptom.equipmentId 精确改对应设备的 setpoint，避免所有症状都堆到第一个设备
        // 注意：写 setpoint 而不是 value——让动力学引擎驱动 value 按 τ 滞后逼近，
        // 25-30 秒内"滑动到位"，演练才有"看着参数慢慢恶化"的真实感。
        // 该逻辑不受难度影响，动力学引擎始终工作。
        fault.symptoms.forEach((symptom) => {
          setSetpoint(symptom.equipmentId, symptom.param, symptom.value);
        });

        // —— 任务 4：按难度分级故障注入消息 ——
        const equipmentsSnapshot = useEquipmentStore.getState().equipments;
        const getEqName = (eqId: string) =>
          equipmentsSnapshot.find((e) => e.id === eqId)?.name ?? eqId;

        let briefing: string;

        if (activeDifficulty === 'expert') {
          // 专家：仅一句简短提示，不暴露任何故障信息
          briefing = '⚠️ 工况异常，请自行排查参数面板，注意观察异常项。';
        } else {
          // novice / standard 共用现象列表
          const symptomLines = fault.symptoms
            .map((s) => {
              const eqName = getEqName(s.equipmentId);
              const arrow = s.trend === 'up' ? '↑' : '↓';
              const unit = s.unit ?? '';
              const paramLabel = s.paramName ?? s.param;
              return `- ${eqName} · ${paramLabel}：${s.value}${unit}（正常 ${s.normal}）${arrow}`;
            })
            .join('\n');

          if (activeDifficulty === 'standard') {
            // 进阶：现象 + 根因，去掉建议处置
            briefing =
              `⚠️ 故障演练开始：${fault.name}\n` +
              `${fault.description}\n\n` +
              `【现象】\n${symptomLines}\n\n` +
              `【根因】${fault.cause}\n\n` +
              `请根据现象与根因自行制定处置方案。`;
          } else {
            // novice：完整简报 + 每条建议处置后追加目标值提示
            const correctSteps = fault.steps.filter((s) => s.correct);
            const stepLines = correctSteps
              .map((s, idx) => {
                const hint = findTargetHintForStep(s.action, fault, equipmentsSnapshot);
                return hint
                  ? `${idx + 1}. ${s.action}  ${hint}`
                  : `${idx + 1}. ${s.action}`;
              })
              .join('\n');

            briefing =
              `⚠️ 故障演练开始：${fault.name}\n` +
              `${fault.description}\n\n` +
              `【现象】\n${symptomLines}\n\n` +
              `【根因】${fault.cause}\n\n` +
              `【建议处置】\n${stepLines}\n\n` +
              `请按上述步骤排查并执行。`;
          }
        }

        // AI 师傅消息推送：expert 用 calm 心情避免被人当成"AI 已经把答案给了"
        sendMessage(briefing, 'ai');
        setAvatarMood(activeDifficulty === 'expert' ? 'calm' : 'alert');

        // 任务 5：在简报后追加一条由大模型生成的"老张师傅开场白"
        // 非阻塞：失败直接吞掉（不发任何东西），不影响演练主流程
        const symptomTexts = fault.symptoms.map((s) => {
          const eqName = equipmentsSnapshot.find((e) => e.id === s.equipmentId)?.name ?? s.equipmentId;
          const arrow = s.trend === 'up' ? '↑' : '↓';
          return `${eqName}·${s.paramName ?? s.param} ${s.value}${s.unit ?? ''}${arrow}`;
        });
        coachOpening({
          faultName: fault.name,
          difficulty: activeDifficulty,
          symptoms: symptomTexts,
        })
          .then((opening) => {
            const text = opening?.trim();
            if (text) {
              useAIStore.getState().sendMessage(text, 'ai');
              // 触发 TTS 朗读演练开场白
              useAIStore.getState().requestSpeak(text);
            }
          })
          .catch((err) => {
            console.warn('[TopBar] coachOpening 失败，跳过开场白', err instanceof Error ? err.message : err);
          });
      }, 100);
    }
  };

  const handleReset = () => {
    if (isDrillRunning) {
      endDrill();
    }
    // 重置所有设备状态
    equipments.forEach((eq) => {
      setEquipmentStatus(eq.id, 'normal');
    });
    setAvatarMood('calm');
  };

  const getStatusColor = () => {
    switch (systemStatus) {
      case 'normal': return 'bg-success';
      case 'warning': return 'bg-warning';
      case 'danger': return 'bg-danger';
      default: return 'bg-success';
    }
  };

  const getTemplateName = () => {
    switch (activeTemplate) {
      case 'fcc': return '催化裂化装置';
      case 'welding': return '汽车焊装车间';
      default: return '未选择模板';
    }
  };

  // —— 难度三段按钮配置 ——
  // 颜色按需求映射：novice=success / standard=info / expert=warning
  const difficultyOptions: Array<{
    key: DrillDifficulty;
    label: string;
    icon: React.ReactNode;
    activeClass: string;   // 激活态背景与文字色
    title: string;          // hover 提示
  }> = [
    {
      key: 'novice',
      label: '新手',
      icon: <Sprout className="w-3.5 h-3.5" />,
      activeClass: 'bg-success/20 text-success border-success/40',
      title: '新手模式：完整简报含目标值；错误轻扣；分数封顶 80（A 级）',
    },
    {
      key: 'standard',
      label: '进阶',
      icon: <Settings2 className="w-3.5 h-3.5" />,
      activeClass: 'bg-info/20 text-info border-info/40',
      title: '进阶模式：仅给现象+根因；不告诉具体处置；标准评分',
    },
    {
      key: 'expert',
      label: '专家',
      icon: <Target className="w-3.5 h-3.5" />,
      activeClass: 'bg-warning/20 text-warning border-warning/40',
      title: '专家模式：仅短提示；不标红设备；基础工况分 ×1.2；错误重扣',
    },
  ];

  return (
    <div className="h-14 bg-bg-secondary border-b border-border flex items-center justify-between px-4">
      {/* 左侧 */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebarLeft}
          className="p-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {sidebarLeftOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">匠</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text-primary">匠魂实训引擎</h1>
            <p className="text-xs text-text-muted">{getTemplateName()}</p>
          </div>
        </div>
      </div>

      {/* 中间 - 控制按钮 */}
      <div className="flex items-center gap-3">
        {/* 难度三段按钮组：放在"开始演练"左侧；演练运行中禁用切换 */}
        <div
          className="flex items-center gap-0.5 p-0.5 bg-bg-tertiary rounded-lg border border-border"
          title={isDrillRunning ? '演练进行中，无法切换难度' : '选择演练难度'}
        >
          {difficultyOptions.map((opt) => {
            const isActive = difficulty === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setDifficulty(opt.key)}
                disabled={isDrillRunning}
                title={opt.title}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-all ${
                  isActive
                    ? opt.activeClass
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-primary/40'
                } ${isDrillRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleStartDrill}
          disabled={!activeTemplate}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isDrillRunning
              ? 'bg-danger text-white hover:bg-danger/80'
              : 'bg-primary text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isDrillRunning ? (
            <>
              <Pause className="w-4 h-4" />
              结束演练
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              开始演练
            </>
          )}
        </button>
        
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
        

        
        {isDrillRunning && currentFault && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/20 text-danger rounded-lg text-sm animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            <span>{currentFault.name}</span>
          </div>
        )}
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary rounded-lg">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${systemStatus !== 'normal' ? 'animate-pulse' : ''}`} />
          <span className="text-xs text-text-secondary">
            {systemStatus === 'normal' ? '系统正常' : systemStatus === 'warning' ? '系统警告' : '系统危险'}
          </span>
        </div>
        
        <button
          onClick={toggleVoice}
          className={`p-2 rounded-lg transition-colors ${
            voiceEnabled ? 'text-primary bg-primary/20' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
        
        <button className="p-2 text-text-muted hover:text-text-secondary transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary rounded-lg">
          <User className="w-4 h-4 text-text-secondary" />
          <span className="text-xs text-text-secondary">学员</span>
        </div>
      </div>
    </div>
  );
};
