// 专家经验蒸馏页 (Experience Distillation)
// - 教师录入老专家口述实录，LLM 自动蒸馏为结构化教学经验
// - 左栏：采集表单（场景/故障/标题/专家/口述记录）
// - 右栏：最新蒸馏结果预览 + 经验库列表（可展开/归档/重新蒸馏/删除/改标题）

import { useEffect, useState } from 'react';
import { experienceApi, type ExperienceRule, type DistilledExperience, type CollectResponse } from '@/services/api';
import { usePageStore } from '@/stores/pageStore';
import { useUIStore } from '@/stores/uiStore';
import { useToastStore } from '@/components/Toast';
import { SCENES } from '@/templates';
import {
  ArrowLeft, Plus, RefreshCw, Loader2, BookOpen, Lightbulb, AlertTriangle,
  Target, Clock, Zap, User, ChevronDown, ChevronUp, Trash2, Edit3, Save, X, Sparkles,
} from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmDialog';

// =============================================================
// 常量
// =============================================================

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'think_aloud', label: '口述实录' },
  { value: 'interview', label: '事后访谈' },
  { value: 'observation', label: '操作观察' },
];

// 蒸馏过程中的轮播提示（约 10-15s，缓解等待焦虑）
const DISTILL_TIPS = [
  '正在分析专家口述内容…',
  '提取关键操作决策…',
  '识别参数敏感区间…',
  '总结经验直觉与常见错误…',
  '凝练核心经验洞察…',
];

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/40',
  recommended: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
};
const PRIORITY_LABEL: Record<string, string> = {
  critical: '关键',
  recommended: '建议',
};

const fmtTime = (ts: number) =>
  new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 场景下拉选项（按注册顺序） */
const sceneOptions = Object.entries(SCENES).map(([id, pack]) => ({ id, name: pack.meta.name }));
/** 根据 scene_id 取场景中文名 */
const sceneName = (id: string) => SCENES[id]?.meta.name ?? id;

// 复用样式
const inputCls =
  'w-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/60 transition-colors';
const labelCls = 'block text-xs font-medium text-text-secondary mb-1.5';

// =============================================================
// 主页面
// =============================================================
export const ExperienceCollectPage: React.FC = () => {
  const setPage = usePageStore((s) => s.setPage);
  const activeTemplate = useUIStore((s) => s.activeTemplate);
  const pushToast = useToastStore((s) => s.push);

  // 表单状态（默认场景跟随当前激活的模板，便于教师从工作台跳入）
  const [form, setForm] = useState({
    scene_id: activeTemplate ?? sceneOptions[0]?.id ?? '',
    fault_name: '',
    title: '',
    expert_name: '',
    expert_title: '',
    source_type: 'think_aloud',
    raw_transcript: '',
  });

  const [distilling, setDistilling] = useState(false);
  const [tipIdx, setTipIdx] = useState(0);

  // 最新蒸馏结果（右侧 Section A）
  const [latestResult, setLatestResult] = useState<CollectResponse | null>(null);

  // 经验库列表（右侧 Section B）
  const [experiences, setExperiences] = useState<ExperienceRule[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [redistillingId, setRedistillingId] = useState<string | null>(null);

  // 蒸馏轮播提示
  useEffect(() => {
    if (!distilling) {
      setTipIdx(0);
      return;
    }
    const t = setInterval(() => setTipIdx((i) => (i + 1) % DISTILL_TIPS.length), 2600);
    return () => clearInterval(t);
  }, [distilling]);

  const loadList = async () => {
    setListLoading(true);
    try {
      const r = await experienceApi.list();
      setExperiences(r.experiences);
    } catch (e: any) {
      pushToast({ type: 'warning', title: '加载经验库失败', description: e?.message ?? '请稍后重试' });
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 提交采集 ——
  const handleCollect = async () => {
    if (!form.scene_id || !form.fault_name.trim() || !form.title.trim() || !form.raw_transcript.trim()) {
      pushToast({
        type: 'warning',
        title: '请填写完整信息',
        description: '场景、故障名称、经验标题与专家口述记录为必填项',
      });
      return;
    }
    setDistilling(true);
    try {
      const resp = await experienceApi.collect({
        scene_id: form.scene_id,
        fault_name: form.fault_name.trim(),
        title: form.title.trim(),
        raw_transcript: form.raw_transcript.trim(),
        expert_name: form.expert_name.trim() || undefined,
        expert_title: form.expert_title.trim() || undefined,
        source_type: form.source_type,
      });
      setLatestResult(resp);
      if (resp.distill_error) {
        pushToast({ type: 'warning', title: '蒸馏未成功', description: resp.distill_error });
      } else if (resp.distilled) {
        pushToast({ type: 'success', title: '蒸馏完成', description: '专家经验已提炼为结构化教学知识' });
      } else {
        pushToast({ type: 'info', title: '已保存', description: resp.message ?? '经验记录已入库' });
      }
      // 清空表单（保留场景与采集方式选择）
      setForm((f) => ({ ...f, fault_name: '', title: '', expert_name: '', expert_title: '', raw_transcript: '' }));
      await loadList();
    } catch (e: any) {
      pushToast({ type: 'warning', title: '采集失败', description: e?.message ?? '请稍后重试' });
    } finally {
      setDistilling(false);
    }
  };

  // —— 重新蒸馏（列表项 & 最新结果重试共用）——
  const handleRedistill = async (id: string) => {
    setRedistillingId(id);
    try {
      const r = await experienceApi.redistill(id);
      pushToast({ type: 'success', title: '重新蒸馏完成', description: r.message ?? '已更新结构化经验' });
      setLatestResult((cur) =>
        cur && cur.id === id ? { ...cur, distilled: r.distilled, distill_error: null } : cur,
      );
      await loadList();
    } catch (e: any) {
      pushToast({ type: 'warning', title: '重新蒸馏失败', description: e?.message ?? '请稍后重试' });
    } finally {
      setRedistillingId(null);
    }
  };

  // —— 归档 ——
  const handleArchive = async (exp: ExperienceRule) => {
    const ok = await confirmDialog({
      title: `确认归档"${exp.title}"？`,
      description: '归档后该经验将不再出现在默认列表中，可由管理员恢复。',
      icon: 'question',
      confirmText: '归档',
    });
    if (!ok) return;
    try {
      await experienceApi.update(exp.id, { status: 'archived' });
      pushToast({ type: 'success', title: '已归档', description: exp.title });
      await loadList();
    } catch (e: any) {
      pushToast({ type: 'warning', title: '归档失败', description: e?.message ?? '请稍后重试' });
    }
  };

  // —— 删除 ——
  const handleDelete = async (exp: ExperienceRule) => {
    const ok = await confirmDialog({
      title: `确认删除"${exp.title}"？`,
      description: '此操作不可撤销，该经验记录将被永久删除。',
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    try {
      await experienceApi.remove(exp.id);
      pushToast({ type: 'success', title: '已删除', description: exp.title });
      if (expandedId === exp.id) setExpandedId(null);
      await loadList();
    } catch (e: any) {
      pushToast({ type: 'warning', title: '删除失败', description: e?.message ?? '请稍后重试' });
    }
  };

  // —— 改标题 ——
  const handleRename = async (exp: ExperienceRule, title: string) => {
    try {
      await experienceApi.update(exp.id, { title });
      pushToast({ type: 'success', title: '已更新标题' });
      await loadList();
    } catch (e: any) {
      pushToast({ type: 'warning', title: '更新失败', description: e?.message ?? '请稍后重试' });
      throw e;
    }
  };

  const canSubmit =
    !distilling &&
    !!form.scene_id &&
    form.fault_name.trim().length > 0 &&
    form.title.trim().length > 0 &&
    form.raw_transcript.trim().length > 0;

  return (
    <div className="h-screen overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-5xl mx-auto p-6 pb-20 space-y-6">
        {/* —— 顶部 —— */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage('dashboard')}
              className="p-2 text-text-muted hover:text-text-primary"
              title="返回 Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                专家经验蒸馏
              </h1>
              <p className="text-sm text-text-muted">采集老专家经验，AI自动提炼结构化教学知识</p>
            </div>
          </div>
          <button
            onClick={() => void loadList()}
            className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>

        {/* —— 双栏 —— */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ============ 左栏：采集表单 ============ */}
          <div className="rounded-xl border border-border bg-bg-secondary p-6 space-y-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              新建经验采集
            </h2>

            {/* 场景 */}
            <div>
              <label className={labelCls}>场景</label>
              <select
                value={form.scene_id}
                onChange={(e) => setForm((f) => ({ ...f, scene_id: e.target.value }))}
                className={inputCls}
                disabled={distilling}
              >
                {sceneOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 故障名称 */}
            <div>
              <label className={labelCls}>
                故障名称 <span className="text-red-400">*</span>
              </label>
              <input
                value={form.fault_name}
                onChange={(e) => setForm((f) => ({ ...f, fault_name: e.target.value }))}
                placeholder="如：再生器温度异常升高"
                className={inputCls}
                disabled={distilling}
              />
            </div>

            {/* 经验标题 */}
            <div>
              <label className={labelCls}>
                经验标题 <span className="text-red-400">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="如：再生器超温的先兆判断与处置节奏"
                className={inputCls}
                disabled={distilling}
              />
            </div>

            {/* 专家姓名 + 职称/工龄 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" />
                    专家姓名
                  </span>
                </label>
                <input
                  value={form.expert_name}
                  onChange={(e) => setForm((f) => ({ ...f, expert_name: e.target.value }))}
                  placeholder="选填"
                  className={inputCls}
                  disabled={distilling}
                />
              </div>
              <div>
                <label className={labelCls}>专家职称/工龄</label>
                <input
                  value={form.expert_title}
                  onChange={(e) => setForm((f) => ({ ...f, expert_title: e.target.value }))}
                  placeholder="选填，如 高级技师·25年"
                  className={inputCls}
                  disabled={distilling}
                />
              </div>
            </div>

            {/* 采集方式 */}
            <div>
              <label className={labelCls}>采集方式</label>
              <select
                value={form.source_type}
                onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}
                className={inputCls}
                disabled={distilling}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 专家口述记录 */}
            <div>
              <label className={labelCls}>
                专家口述记录 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.raw_transcript}
                onChange={(e) => setForm((f) => ({ ...f, raw_transcript: e.target.value }))}
                placeholder="粘贴专家口述录音转文字内容。例如：'再生器温度往上跑，第一反应不是去降温，是先看进料量...'"
                className={`${inputCls} min-h-[200px] resize-y leading-relaxed`}
                disabled={distilling}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-text-muted">
                  {form.raw_transcript.length} 字
                </span>
                <span className="text-[10px] text-text-muted">AI 蒸馏约需 10-15 秒</span>
              </div>
            </div>

            {/* 提交按钮 / 蒸馏中状态 */}
            {distilling ? (
              <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/5 p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-cyan-400 font-medium">AI正在蒸馏专家经验...</div>
                  <div className="text-xs text-text-secondary mt-0.5 transition-all">
                    {DISTILL_TIPS[tipIdx]}
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => void handleCollect()}
                disabled={!canSubmit}
                className="w-full px-4 py-2.5 text-sm bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                开始蒸馏
              </button>
            )}
          </div>

          {/* ============ 右栏：蒸馏结果 + 经验库 ============ */}
          <div className="space-y-6">
            {/* Section A：最新蒸馏结果 */}
            {latestResult && (
              <div className="rounded-xl border border-border bg-bg-secondary p-5 space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  蒸馏结果
                </h3>

                {latestResult.distill_error ? (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-red-400 font-medium">蒸馏失败</div>
                      <p className="text-xs text-text-secondary mt-1 break-words">{latestResult.distill_error}</p>
                      <button
                        onClick={() => void handleRedistill(latestResult.id)}
                        disabled={redistillingId === latestResult.id}
                        className="mt-2 px-3 py-1.5 text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 rounded hover:bg-cyan-500/25 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {redistillingId === latestResult.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        重试蒸馏
                      </button>
                    </div>
                  </div>
                ) : latestResult.distilled ? (
                  <DistilledView data={latestResult.distilled} />
                ) : (
                  <div className="text-xs text-text-muted text-center py-4">暂无蒸馏结果</div>
                )}
              </div>
            )}

            {/* Section B：经验库列表 */}
            <div className="rounded-xl border border-border bg-bg-secondary p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  经验库
                  <span className="text-xs font-normal text-text-muted">({experiences.length})</span>
                </h3>
              </div>

              {listLoading ? (
                <div className="py-10 text-center text-sm text-text-muted flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载中...
                </div>
              ) : experiences.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-text-muted">暂无经验记录，请在左侧采集</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {experiences.map((exp) => (
                    <ExperienceCard
                      key={exp.id}
                      exp={exp}
                      expanded={expandedId === exp.id}
                      redistilling={redistillingId === exp.id}
                      onToggle={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                      onArchive={() => void handleArchive(exp)}
                      onRedistill={() => void handleRedistill(exp.id)}
                      onDelete={() => void handleDelete(exp)}
                      onRename={(title) => handleRename(exp, title)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================
// 蒸馏结果渲染（Section A 与列表展开共用）
// =============================================================
const DistilledView: React.FC<{ data: DistilledExperience }> = ({ data }) => {
  return (
    <div className="space-y-4">
      {/* 核心经验 */}
      {data.master_insight && (
        <div className="p-3 rounded-lg border border-cyan-500/40 bg-cyan-500/5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 mb-1.5">
            <Target className="w-3.5 h-3.5" />
            核心经验
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{data.master_insight}</p>
        </div>
      )}

      {/* 关键操作决策 */}
      {data.key_decisions && data.key_decisions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            关键操作决策
          </div>
          <ol className="space-y-2">
            {data.key_decisions.map((d, i) => (
              <li key={i} className="p-2.5 rounded-lg bg-bg-tertiary/50 border border-border">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                    {d.step ?? i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-text-primary">{d.action}</span>
                      {d.priority && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            PRIORITY_STYLE[d.priority] ?? ''
                          }`}
                        >
                          {PRIORITY_LABEL[d.priority] ?? d.priority}
                        </span>
                      )}
                      {d.timing && (
                        <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {d.timing}
                        </span>
                      )}
                    </div>
                    {d.reasoning && (
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{d.reasoning}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 参数敏感区间 */}
      {data.param_thresholds && data.param_thresholds.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            参数敏感区间
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium">参数</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium">危险区间</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium">专家处置</th>
                  <th className="px-2 py-1.5 text-left text-text-muted font-medium">正常范围</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.param_thresholds.map((p, i) => (
                  <tr key={i} className="bg-bg-secondary">
                    <td className="px-2 py-1.5 text-text-primary font-medium whitespace-nowrap">{p.param}</td>
                    <td className="px-2 py-1.5 text-red-400">{p.danger_zone}</td>
                    <td className="px-2 py-1.5 text-text-secondary">{p.expert_action}</td>
                    <td className="px-2 py-1.5 text-green-400 whitespace-nowrap">{p.normal_range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 操作节奏 */}
      {data.rhythm && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-bg-tertiary/50 border border-border">
          <Clock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-blue-400 mb-0.5">操作节奏</div>
            <p className="text-sm text-text-secondary leading-relaxed">{data.rhythm}</p>
          </div>
        </div>
      )}

      {/* 经验直觉 */}
      {data.intuition_rules && data.intuition_rules.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            经验直觉
          </div>
          <ul className="space-y-1">
            {data.intuition_rules.map((r, i) => (
              <li
                key={i}
                className="text-xs text-text-secondary flex items-start gap-1.5 p-1.5 rounded bg-bg-tertiary/30"
              >
                <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 新手常见错误 */}
      {data.common_mistakes && data.common_mistakes.length > 0 && (
        <div>
          <div className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            新手常见错误
          </div>
          <div className="space-y-2">
            {data.common_mistakes.map((m, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="text-sm text-red-400 font-medium">{m.mistake}</div>
                <div className="text-xs text-text-muted mt-1">
                  <span className="text-text-secondary">原因：</span>
                  {m.why_wrong}
                </div>
                <div className="text-xs text-green-400 mt-0.5">
                  <span className="text-text-secondary">正确做法：</span>
                  {m.correct_alternative}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================
// 经验库卡片（可展开）
// =============================================================
const ExperienceCard: React.FC<{
  exp: ExperienceRule;
  expanded: boolean;
  redistilling: boolean;
  onToggle: () => void;
  onArchive: () => void;
  onRedistill: () => void;
  onDelete: () => void;
  onRename: (title: string) => Promise<void>;
}> = ({ exp, expanded, redistilling, onToggle, onArchive, onRedistill, onDelete, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(exp.title);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(exp.title);
  }, [exp.title]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setDraft(exp.title);
  };
  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
    setDraft(exp.title);
  };
  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!draft.trim() || draft.trim() === exp.title) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(draft.trim());
      setEditing(false);
    } catch {
      /* 错误已在上层 toast 提示 */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg-secondary overflow-hidden transition-all">
      {/* 头部 */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-bg-tertiary/50"
        onClick={onToggle}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveEdit(e as any);
                  if (e.key === 'Escape') void cancelEdit(e as any);
                }}
                className="flex-1 px-2 py-1 text-sm bg-bg-tertiary border border-primary/50 rounded text-text-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveEdit}
                disabled={saving}
                title="保存"
                className="p-1 text-green-400 hover:bg-green-400/10 rounded disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={cancelEdit}
                title="取消"
                className="p-1 text-text-muted hover:text-text-primary rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-text-primary truncate">{exp.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">
                  {sceneName(exp.scene_id)}
                </span>
                {exp.status && exp.status !== 'active' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary rounded text-text-muted">
                    {exp.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-text-muted mt-0.5 flex-wrap">
                <span className="truncate max-w-[160px]">{exp.fault_name}</span>
                {exp.expert_name && (
                  <span className="flex items-center gap-0.5">
                    <User className="w-3 h-3" />
                    {exp.expert_name}
                    {exp.expert_title ? ` · ${exp.expert_title}` : ''}
                  </span>
                )}
                <span>{fmtTime(exp.created_at)}</span>
              </div>
            </>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={startEdit}
            title="编辑标题"
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedistill}
            disabled={redistilling}
            title="重新蒸馏"
            className="p-1.5 text-cyan-400 hover:bg-cyan-400/10 rounded disabled:opacity-50"
          >
            {redistilling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onArchive}
            title="归档"
            className="px-2 py-1 text-[10px] text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10 rounded border border-border"
          >
            归档
          </button>
          <button
            onClick={onDelete}
            title="删除"
            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onToggle} className="p-1 text-text-muted hover:text-text-primary">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-border p-3 bg-bg-tertiary/30 space-y-3">
          {exp.distill_error ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-red-400 font-medium">蒸馏失败</div>
                <p className="text-xs text-text-secondary mt-1 break-words">{exp.distill_error}</p>
                <button
                  onClick={onRedistill}
                  disabled={redistilling}
                  className="mt-2 px-3 py-1.5 text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 rounded hover:bg-cyan-500/25 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {redistilling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  重新蒸馏
                </button>
              </div>
            </div>
          ) : exp.distilled ? (
            <DistilledView data={exp.distilled} />
          ) : (
            <div className="text-xs text-text-muted text-center py-4">暂无蒸馏结果</div>
          )}

          {/* 原始口述记录 */}
          {exp.raw_transcript && (
            <details className="text-xs">
              <summary className="text-text-muted cursor-pointer hover:text-text-secondary select-none">
                查看原始口述记录
              </summary>
              <p className="text-text-secondary mt-2 p-2 bg-bg-secondary rounded border border-border whitespace-pre-wrap leading-relaxed">
                {exp.raw_transcript}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
