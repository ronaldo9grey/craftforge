// 教师 / 管理员 Dashboard
// - 顶部：班级看板（多张卡片，每张含学生数/演练数/平均分/活跃数/覆盖场景 + join_code）
// - 中部：班级管理（创建新班级 + 复制 join_code + 重新生成 + 删除）
// - 选中班级后：右侧展开学生列表（点学生进入"学生详情抽屉"）
// 数据来自 /api/teacher/dashboard 与 /api/classes/* 接口

import { useEffect, useState } from 'react';
import { teacherApi, classApi, type ClassDashboard, type PublicUser } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { usePageStore } from '@/stores/pageStore';
import { Users, Trophy, BookOpenCheck, RefreshCw, Plus, Copy, Trash2, RotateCw, X, ChevronRight, Play } from 'lucide-react';

const SCENE_LABEL: Record<string, string> = {
  fcc: '催化裂化',
  welding: '汽车焊装',
  cnc: '数控加工',
};

export const TeacherDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setPage = usePageStore((s) => s.setPage);
  const [classes, setClasses] = useState<ClassDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [studentDetailId, setStudentDetailId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const { dashboard } = await teacherApi.dashboard();
      setClasses(dashboard);
      if (!selectedClassId && dashboard.length > 0) {
        setSelectedClassId(dashboard[0].class_id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (id: string) => {
    const { members } = await classApi.members(id);
    setMembers(members);
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (selectedClassId) void loadMembers(selectedClassId);
    else setMembers([]);
  }, [selectedClassId]);

  const selectedClass = classes.find((c) => c.class_id === selectedClassId);

  return (
    <div className="h-full overflow-y-auto bg-bg-primary text-text-primary">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {user?.role === 'admin' ? '管理员控制台' : '教学看板'}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {user?.display_name} · 管理你的班级与学员进度
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void loadDashboard()}
              className="px-3 py-2 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              刷新
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              新建班级
            </button>
            <button
              onClick={() => setPage('gallery')}
              className="px-4 py-2 text-sm bg-success/20 hover:bg-success/30 text-success border border-success/40 rounded-lg flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              进入工作台
            </button>
          </div>
        </div>

        {classes.length === 0 && !loading && (
          <div className="bg-bg-secondary border border-border rounded-lg p-12 text-center">
            <div className="text-4xl mb-3">📚</div>
            <h3 className="text-base font-semibold mb-1">还没有班级</h3>
            <p className="text-sm text-text-muted mb-4">
              创建你的第一个班级，把 6 位邀请码发给学生即可加入
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建班级
            </button>
          </div>
        )}

        {/* 班级卡片网格 */}
        {classes.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {classes.map((c) => (
              <ClassCard
                key={c.class_id}
                data={c}
                selected={c.class_id === selectedClassId}
                onSelect={() => setSelectedClassId(c.class_id)}
                onChanged={() => void loadDashboard()}
              />
            ))}
          </div>
        )}

        {/* 选中班级的成员列表 */}
        {selectedClass && (
          <div className="bg-bg-secondary border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>{selectedClass.class_name} · 学员列表 ({members.length})</span>
            </h3>
            {members.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-6">
                还没有学员加入。把邀请码{' '}
                <code className="px-1.5 py-0.5 bg-bg-tertiary rounded text-warning">
                  {selectedClass.join_code}
                </code>{' '}
                发给学生，让他们登录后在「我的班级」里输入即可加入
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setStudentDetailId(m.id)}
                    className="flex items-center justify-between p-3 bg-bg-tertiary hover:bg-bg-primary border border-border rounded-lg text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                        {m.display_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{m.display_name}</div>
                        <div className="text-[11px] text-text-muted">@{m.username}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 新建班级 */}
      {showCreate && (
        <CreateClassModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadDashboard();
          }}
        />
      )}

      {/* 学生详情抽屉 */}
      {studentDetailId && (
        <StudentDetailDrawer id={studentDetailId} onClose={() => setStudentDetailId(null)} />
      )}
    </div>
  );
};

// =============================================================
// 班级卡片
// =============================================================
const ClassCard: React.FC<{
  data: ClassDashboard;
  selected: boolean;
  onSelect: () => void;
  onChanged: () => void;
}> = ({ data, selected, onSelect, onChanged }) => {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(data.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const regen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('重新生成邀请码？旧码立即失效，已加入的学生不受影响。')) return;
    setBusy(true);
    try {
      await classApi.regenCode(data.class_id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确认删除班级"${data.class_name}"？所有班级关联数据将清除，无法撤销。`)) return;
    setBusy(true);
    try {
      await classApi.remove(data.class_id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg p-4 cursor-pointer transition-all border ${
        selected
          ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20'
          : 'bg-bg-secondary border-border hover:border-primary/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-base font-semibold truncate">{data.class_name}</div>
        <div className="flex gap-1">
          <button
            onClick={regen}
            disabled={busy}
            title="重新生成邀请码"
            className="p-1 text-text-muted hover:text-warning rounded"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={remove}
            disabled={busy}
            title="删除班级"
            className="p-1 text-text-muted hover:text-danger rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 邀请码 */}
      <div
        onClick={copyCode}
        title="点击复制邀请码"
        className="mb-3 px-2 py-1.5 bg-bg-tertiary border border-border rounded flex items-center justify-between hover:bg-warning/10"
      >
        <span className="font-mono text-warning text-lg tracking-widest">{data.join_code}</span>
        <span className="text-xs text-text-muted flex items-center gap-1">
          <Copy className="w-3 h-3" />
          {copied ? '已复制' : '点击复制'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Cell icon={<Users className="w-3.5 h-3.5" />} label="学员" value={data.student_count} />
        <Cell
          icon={<BookOpenCheck className="w-3.5 h-3.5" />}
          label="演练数"
          value={data.drill_total}
        />
        <Cell icon={<Trophy className="w-3.5 h-3.5" />} label="均分" value={data.avg_score} />
        <Cell label="7日活跃" value={data.active_student_count_7d} />
      </div>

      {data.covered_scenes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {data.covered_scenes.map((s) => (
            <span
              key={s}
              className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-secondary"
            >
              {SCENE_LABEL[s] ?? s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const Cell: React.FC<{ icon?: React.ReactNode; label: string; value: number | string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex items-center gap-1.5 text-text-muted">
    {icon}
    <span>{label}:</span>
    <span className="text-text-primary font-medium">{value}</span>
  </div>
);

// =============================================================
// 创建班级 Modal
// =============================================================
const CreateClassModal: React.FC<{
  onClose: () => void;
  onCreated: () => void;
}> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await classApi.create(name.trim());
      onCreated();
    } catch (e: any) {
      setErr(e?.message ?? '创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="w-[400px] bg-bg-secondary border border-border rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">新建班级</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <input
            type="text"
            autoFocus
            placeholder="班级名称（如：机电2024-1班）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded text-sm"
          />
          {err && (
            <div className="px-2 py-1.5 bg-danger/15 border border-danger/40 rounded text-xs text-danger">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="px-3 py-1.5 bg-primary text-white text-xs rounded disabled:opacity-50"
            >
              {busy ? '创建中...' : '创建并生成邀请码'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================
// 学生详情抽屉
// =============================================================
const StudentDetailDrawer: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const [data, setData] = useState<{
    student: PublicUser;
    total_drills: number;
    avg_score: number;
    recent_records: any[];
  } | null>(null);

  useEffect(() => {
    void teacherApi.studentDetail(id).then((d) => setData(d));
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-[420px] bg-bg-secondary border-l border-border overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">学员详情</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
        {!data ? (
          <div className="p-6 text-center text-sm text-text-muted">加载中...</div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold">
                {data.student.display_name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="text-base font-semibold">{data.student.display_name}</div>
                <div className="text-xs text-text-muted">
                  @{data.student.username}
                  {data.student.student_no ? ` · 学号 ${data.student.student_no}` : ''}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-tertiary rounded p-3">
                <div className="text-xs text-text-muted">总演练数</div>
                <div className="text-2xl font-bold mt-1">{data.total_drills}</div>
              </div>
              <div className="bg-bg-tertiary rounded p-3">
                <div className="text-xs text-text-muted">平均得分</div>
                <div className="text-2xl font-bold mt-1">{data.avg_score}</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold mb-2 text-text-secondary">最近演练记录</h4>
              {data.recent_records.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">尚无演练记录</p>
              ) : (
                <div className="space-y-1.5">
                  {data.recent_records.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-xs bg-bg-tertiary px-3 py-2 rounded"
                    >
                      <div className="truncate">
                        <span className="font-medium">
                          {SCENE_LABEL[r.scene_id] ?? r.scene_id}
                        </span>
                        <span className="text-text-muted"> · {r.fault_name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono">{r.score}</span>
                        <span
                          className={`px-1.5 rounded font-bold ${
                            r.grade === 'S'
                              ? 'bg-yellow-400/30 text-yellow-400'
                              : r.grade === 'A'
                              ? 'bg-green-400/20 text-green-400'
                              : r.grade === 'B'
                              ? 'bg-blue-400/20 text-blue-400'
                              : r.grade === 'C'
                              ? 'bg-orange-400/20 text-orange-400'
                              : 'bg-red-400/20 text-red-400'
                          }`}
                        >
                          {r.grade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
