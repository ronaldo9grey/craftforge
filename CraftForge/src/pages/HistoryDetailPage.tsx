// 演练详情页：从 pageStore.detailRecordId 读 ID，调 /api/drill-records/:id
// 展示：基本信息 / 得分拆解 / 师傅评语 / 操作流水

import { useEffect, useState } from 'react';
import { drillApi, mistakeApi, type DrillRecord } from '@/services/api';
import { usePageStore } from '@/stores/pageStore';
import { ArrowLeft, FileText, Award, Activity, CheckCircle2, XCircle, Printer, BookmarkPlus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const SCENE_LABEL: Record<string, string> = {
  fcc: '催化裂化',
  welding: '汽车焊装',
  cnc: '数控加工',
};

const GRADE_BADGE: Record<string, string> = {
  S: 'bg-yellow-400/25 text-yellow-400 border-yellow-400/50',
  A: 'bg-green-400/20 text-green-400 border-green-400/40',
  B: 'bg-blue-400/20 text-blue-400 border-blue-400/40',
  C: 'bg-orange-400/20 text-orange-400 border-orange-400/40',
  D: 'bg-red-400/20 text-red-400 border-red-400/40',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  novice: '新手',
  standard: '标准',
  expert: '专家',
};

export const HistoryDetailPage: React.FC = () => {
  const detailRecordId = usePageStore((s) => s.detailRecordId);
  const setPage = usePageStore((s) => s.setPage);
  const user = useAuthStore((s) => s.user);
  const [record, setRecord] = useState<DrillRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!detailRecordId) return;
    setLoading(true);
    drillApi
      .detail(detailRecordId)
      .then((r) => setRecord(r.record))
      .finally(() => setLoading(false));
  }, [detailRecordId]);

  /** 导出 PDF：用 window.print()，配合下面 .printable-report 区域的打印样式 */
  const handleExport = () => {
    // 改标题，浏览器"另存为 PDF"的默认文件名会跟这个走
    const oldTitle = document.title;
    const safeName = record
      ? `实训报告_${SCENE_LABEL[record.scene_id] ?? record.scene_id}_${formatTime(record.created_at).replace(/[ :]/g, '_')}`
      : '实训报告';
    document.title = safeName;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = oldTitle;
      }, 300);
    }, 80);
  };

  if (!detailRecordId) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted">
        没有指定记录 ID
        <button onClick={() => setPage('history')} className="ml-3 text-primary">
          返回列表
        </button>
      </div>
    );
  }

  if (loading || !record) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted">
        加载中...
      </div>
    );
  }

  const sb: any = record.score_breakdown ?? {};
  const operations: any[] = Array.isArray(record.operations) ? record.operations : [];

  // 得分维度（FCC 的 breakdown 有 dimensions: 数组）
  const dimensions: any[] = Array.isArray(sb.dimensions) ? sb.dimensions : [];
  const coachComment: string = sb.coachComment || '';

  return (
    <div className="h-full overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-4xl mx-auto p-6 space-y-4 printable-report">
        {/* 仅打印时显示的报告页头 */}
        <div className="print-only border-b-2 border-black pb-3 mb-3">
          <div className="text-xl font-bold text-black">匠魂实训引擎 · 实训报告</div>
          <div className="text-xs text-gray-600 mt-1">
            学员：{user?.display_name ?? '-'}（@{user?.username ?? '-'}）
            {user?.student_no ? ` · 学号 ${user.student_no}` : ''}
            <span className="ml-3">导出时间：{formatTime(Date.now())}</span>
          </div>
        </div>

        {/* 顶部 */}
        <div className="flex items-center gap-3 no-print">
          <button
            onClick={() => setPage('history')}
            className="p-2 text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="text-xs text-text-muted">
              {SCENE_LABEL[record.scene_id] ?? record.scene_id} ·{' '}
              {record.difficulty ? DIFFICULTY_LABEL[record.difficulty] : '-'} ·{' '}
              {formatTime(record.created_at)}
            </div>
            <h1 className="text-xl font-bold mt-0.5">{record.fault_name}</h1>
          </div>
          <button
            onClick={async () => {
              if (!record) return;
              try {
                await mistakeApi.add({
                  scene_id: record.scene_id,
                  fault_id: record.fault_id,
                  fault_name: record.fault_name,
                  score: record.score,
                  grade: record.grade,
                });
                alert('已加入错题本，前往「错题本」可重练此故障');
              } catch (e: any) {
                alert('加入错题本失败：' + (e?.message ?? ''));
              }
            }}
            title="把本次演练加入错题本（即使评分较高也可手动标记）"
            className="px-3 py-2 text-sm bg-bg-tertiary hover:bg-bg-secondary border border-border text-text-primary rounded-lg flex items-center gap-2"
          >
            <BookmarkPlus className="w-4 h-4" />
            标错题
          </button>
          <button
            onClick={handleExport}
            title="导出为 PDF（浏览器打印 → 另存为 PDF）"
            className="px-3 py-2 text-sm bg-warning hover:bg-warning/90 text-white rounded-lg flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            导出 PDF
          </button>
          <div
            className={`px-4 py-2 rounded-lg border-2 text-center ${
              GRADE_BADGE[record.grade] ?? ''
            }`}
          >
            <div className="text-3xl font-bold">{record.grade}</div>
            <div className="text-xs">{record.score} 分</div>
          </div>
        </div>

        {/* 打印版的标题+成绩（替代上面那行） */}
        <div className="print-only">
          <div className="text-base font-bold text-black">
            场景：{SCENE_LABEL[record.scene_id] ?? record.scene_id}
            {record.difficulty ? ` · 难度：${DIFFICULTY_LABEL[record.difficulty]}` : ''}
          </div>
          <div className="text-sm text-black mt-1">
            故障：{record.fault_name}（编号 {record.fault_id}）
          </div>
          <div className="text-sm text-black mt-2">
            最终评定：<strong>{record.grade} 级</strong> · <strong>{record.score} 分</strong>
            <span className="ml-3">演练时间：{formatTime(record.created_at)}</span>
          </div>
        </div>

        {/* 概览四宫格 */}
        <div className="grid grid-cols-4 gap-3">
          <InfoCell label="用时" value={formatDuration(record.duration_sec)} />
          <InfoCell label="操作次数" value={`${operations.length} 步`} />
          <InfoCell
            label="正确率"
            value={
              operations.length === 0
                ? '-'
                : `${Math.round(
                    (operations.filter((o) => o.isCorrect).length / operations.length) * 100,
                  )}%`
            }
          />
          <InfoCell label="故障 ID" value={record.fault_id} />
        </div>

        {/* 得分拆解 */}
        {dimensions.length > 0 && (
          <div className="bg-bg-secondary border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              得分拆解
            </h3>
            <div className="space-y-2">
              {dimensions.map((d, i) => (
                <DimensionRow key={i} dim={d} />
              ))}
            </div>
          </div>
        )}

        {/* 师傅讲评 */}
        {coachComment && (
          <div className="bg-bg-secondary border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-warning" />
              师傅讲评
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {coachComment}
            </p>
          </div>
        )}

        {/* 操作流水 */}
        <div className="bg-bg-secondary border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            操作流水 ({operations.length} 条)
          </h3>
          {operations.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-3">无操作记录</p>
          ) : (
            <div className="space-y-1.5">
              {operations.map((op, i) => (
                <OperationItem key={i} op={op} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="bg-bg-secondary border border-border rounded p-3">
    <div className="text-xs text-text-muted">{label}</div>
    <div className="text-base font-medium mt-0.5 truncate">{value}</div>
  </div>
);

const DimensionRow: React.FC<{ dim: any }> = ({ dim }) => {
  const score = typeof dim.score === 'number' ? dim.score : 0;
  const weight = typeof dim.weight === 'number' ? dim.weight : 0;
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <div>
          <span className="font-medium">{dim.name ?? dim.key ?? '指标'}</span>
          {weight > 0 && (
            <span className="ml-1.5 text-text-muted">权重 {Math.round(weight * 100)}%</span>
          )}
        </div>
        <span className="font-mono font-medium">{Math.round(score)} / 100</span>
      </div>
      <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {dim.note && (
        <div className="text-[11px] text-text-muted mt-1">{dim.note}</div>
      )}
    </div>
  );
};

const OperationItem: React.FC<{ op: any; index: number }> = ({ op, index }) => {
  const correct = op.isCorrect === true;
  return (
    <div className="flex items-start gap-2 text-xs px-2 py-1.5 bg-bg-tertiary rounded">
      <span className="text-text-muted shrink-0">#{index}</span>
      {correct ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="truncate">{op.action ?? '未知操作'}</div>
        {op.aiFeedback && (
          <div className="text-[11px] text-text-muted mt-0.5">{op.aiFeedback}</div>
        )}
      </div>
      {op.timestamp && (
        <span className="text-[10px] text-text-muted shrink-0">
          {new Date(op.timestamp).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${String(s).padStart(2, '0')}s`;
}
