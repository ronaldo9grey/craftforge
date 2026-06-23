// 演练记录路由 + 教师统计 + 成就接口
//
//   学生 / 任意已登录用户：
//     POST  /api/drill-records              提交一次演练
//     GET   /api/drill-records              查自己的（分页/筛选）
//     GET   /api/drill-records/:id          单条详情
//     GET   /api/drill-records/me/summary   我的成长概览（成绩曲线 + 各场景胜率 + 总数）
//     GET   /api/achievements               我的成就（含尚未解锁的）
//
//   教师 / 管理员：
//     GET   /api/teacher/dashboard          班级整体进度
//     GET   /api/teacher/student/:id        单个学生详细
//
// 路由划分：
//   /api/drill-records  → drillRecords
//   /api/achievements   → achievements
//   /api/teacher        → teacher
// 全部都在本文件，按 router.use 分挂

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, uuid } from '../db';
import type { DrillRecordRow, UserAchievementRow, UserRow, ClassRow } from '../db/types';
import { toPublicUser } from '../db/types';
import { requireAuth, requireRole } from '../middleware/jwtAuth';
import { ACHIEVEMENTS, evaluateAchievements } from '../db/achievements';
import { syncMistakeOnDrill } from './mistakes';

// =============================================================
// 演练记录
// =============================================================
export const drillRecordsRouter = Router();

const SubmitRecordSchema = z.object({
  scene_id: z.string().min(1),
  fault_id: z.string().min(1),
  fault_name: z.string().min(1),
  start_time: z.number(),
  end_time: z.number(),
  duration_sec: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(100),
  grade: z.enum(['S', 'A', 'B', 'C', 'D']),
  difficulty: z.enum(['novice', 'standard', 'expert']).optional().nullable(),
  score_breakdown: z.any().optional().nullable(),
  operations: z.any().optional().nullable(),
});

/** POST /api/drill-records  提交一次演练记录 */
drillRecordsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const parsed = SubmitRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;
  const id = uuid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO drill_records
       (id, user_id, scene_id, fault_id, fault_name, start_time, end_time, duration_sec,
        score, grade, difficulty, score_breakdown, operations, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    req.authUser!.id,
    d.scene_id,
    d.fault_id,
    d.fault_name,
    d.start_time,
    d.end_time,
    d.duration_sec,
    d.score,
    d.grade,
    d.difficulty ?? null,
    d.score_breakdown ? JSON.stringify(d.score_breakdown) : null,
    d.operations ? JSON.stringify(d.operations) : null,
    now,
  );

  // 自动评估新解锁的成就
  const newAchievements = evaluateAchievements(req.authUser!.id);

  // 自动维护错题本：C/D → 加入；S/A → 自动 mastered
  const mistakeAction = syncMistakeOnDrill({
    user_id: req.authUser!.id,
    scene_id: d.scene_id,
    fault_id: d.fault_id,
    fault_name: d.fault_name,
    score: d.score,
    grade: d.grade,
    end_time: d.end_time,
  });

  res.status(201).json({ id, new_achievements: newAchievements, mistake_action: mistakeAction.action });
});

/** GET /api/drill-records  查询自己的记录 */
drillRecordsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const sceneId = (req.query.scene_id as string) || '';
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  let sql = `SELECT * FROM drill_records WHERE user_id = ?`;
  const params: (string | number)[] = [req.authUser!.id];
  if (sceneId) {
    sql += ' AND scene_id = ?';
    params.push(sceneId);
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = db.prepare(sql).all(...params) as DrillRecordRow[];
  const total = (db
    .prepare(
      sceneId
        ? 'SELECT COUNT(*) AS c FROM drill_records WHERE user_id = ? AND scene_id = ?'
        : 'SELECT COUNT(*) AS c FROM drill_records WHERE user_id = ?',
    )
    .get(...(sceneId ? [req.authUser!.id, sceneId] : [req.authUser!.id])) as { c: number }).c;
  res.json({ records: rows.map(serializeRecord), total, limit, offset });
});

/** GET /api/drill-records/:id  单条详情 */
drillRecordsRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM drill_records WHERE id = ?').get(req.params.id) as
    | DrillRecordRow
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  // 权限：本人 / 该学生所在班级教师 / 管理员
  const me = req.authUser!;
  if (row.user_id !== me.id) {
    if (me.role === 'student') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (me.role === 'teacher') {
      const owner = db.prepare('SELECT class_id FROM users WHERE id = ?').get(row.user_id) as
        | { class_id: string | null }
        | undefined;
      if (!owner?.class_id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const cls = db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(owner.class_id) as
        | { teacher_id: string }
        | undefined;
      if (!cls || cls.teacher_id !== me.id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
  }
  res.json({ record: serializeRecord(row) });
});

/** GET /api/drill-records/me/summary  我的成长概览 */
drillRecordsRouter.get('/me/summary', requireAuth, (req: Request, res: Response) => {
  const userId = req.authUser!.id;
  const rows = db
    .prepare('SELECT * FROM drill_records WHERE user_id = ? ORDER BY created_at ASC')
    .all(userId) as DrillRecordRow[];
  const total = rows.length;
  const avgScore = total === 0 ? 0 : rows.reduce((s, r) => s + r.score, 0) / total;
  const bestScore = total === 0 ? 0 : Math.max(...rows.map((r) => r.score));
  const sceneStats: Record<string, { count: number; avg: number; best: number }> = {};
  for (const r of rows) {
    const s = (sceneStats[r.scene_id] ||= { count: 0, avg: 0, best: 0 });
    s.count++;
    s.avg += r.score;
    s.best = Math.max(s.best, r.score);
  }
  for (const k in sceneStats) sceneStats[k].avg = sceneStats[k].avg / sceneStats[k].count;

  // 最近 20 次成绩曲线
  const recentCurve = rows.slice(-20).map((r) => ({
    created_at: r.created_at,
    score: r.score,
    grade: r.grade,
    scene_id: r.scene_id,
  }));

  // 各等级数量
  const gradeCount: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const r of rows) gradeCount[r.grade]++;

  res.json({
    total,
    avg_score: Math.round(avgScore * 10) / 10,
    best_score: bestScore,
    grade_count: gradeCount,
    scene_stats: sceneStats,
    recent_curve: recentCurve,
  });
});

// =============================================================
// 成就路由
// =============================================================
export const achievementsRouter = Router();

/** GET /api/achievements  我的成就（含已解锁和未解锁定义） */
achievementsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const userId = req.authUser!.id;
  const unlocked = db
    .prepare('SELECT * FROM user_achievements WHERE user_id = ?')
    .all(userId) as UserAchievementRow[];
  const unlockedMap = new Map(unlocked.map((u) => [u.achievement_key, u.unlocked_at]));
  const list = ACHIEVEMENTS.map((def) => ({
    key: def.key,
    name: def.name,
    description: def.description,
    icon: def.icon,
    unlocked: unlockedMap.has(def.key),
    unlocked_at: unlockedMap.get(def.key) ?? null,
  }));
  res.json({ achievements: list });
});

// =============================================================
// 教师统计路由
// =============================================================
export const teacherRouter = Router();

/** GET /api/teacher/dashboard  教师班级看板 */
teacherRouter.get(
  '/dashboard',
  requireAuth,
  requireRole('teacher', 'admin'),
  (req: Request, res: Response) => {
    const me = req.authUser!;
    // 教师只能看自己的班级；管理员看全部
    const classes =
      me.role === 'admin'
        ? (db.prepare('SELECT * FROM classes').all() as ClassRow[])
        : (db.prepare('SELECT * FROM classes WHERE teacher_id = ?').all(me.id) as ClassRow[]);

    const dashboard = classes.map((cls) => {
      const students = db
        .prepare(`SELECT * FROM users WHERE class_id = ? AND role = 'student'`)
        .all(cls.id) as UserRow[];
      const studentIds = students.map((s) => s.id);
      let drillTotal = 0;
      let scoreSum = 0;
      const scenes = new Set<string>();
      let activeCount = 0;
      if (studentIds.length > 0) {
        const placeholders = studentIds.map(() => '?').join(',');
        const records = db
          .prepare(`SELECT * FROM drill_records WHERE user_id IN (${placeholders})`)
          .all(...studentIds) as DrillRecordRow[];
        drillTotal = records.length;
        scoreSum = records.reduce((s, r) => s + r.score, 0);
        records.forEach((r) => scenes.add(r.scene_id));
        // 7 天内有演练记录的学生数
        const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
        const activeStudents = new Set(
          records.filter((r) => r.created_at >= cutoff).map((r) => r.user_id),
        );
        activeCount = activeStudents.size;
      }
      return {
        class_id: cls.id,
        class_name: cls.name,
        join_code: cls.join_code,
        student_count: students.length,
        active_student_count_7d: activeCount,
        drill_total: drillTotal,
        avg_score: drillTotal === 0 ? 0 : Math.round((scoreSum / drillTotal) * 10) / 10,
        covered_scenes: Array.from(scenes),
      };
    });

    res.json({ dashboard });
  },
);

/** GET /api/teacher/student/:id  单个学生详情（含统计 + 最近记录） */
teacherRouter.get(
  '/student/:id',
  requireAuth,
  requireRole('teacher', 'admin'),
  (req: Request, res: Response) => {
    const stu = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | UserRow
      | undefined;
    if (!stu || stu.role !== 'student') {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    const me = req.authUser!;
    if (me.role === 'teacher') {
      // 教师只能查看自己班级学生
      const cls = stu.class_id
        ? (db.prepare('SELECT teacher_id FROM classes WHERE id = ?').get(stu.class_id) as
            | { teacher_id: string }
            | undefined)
        : undefined;
      if (!cls || cls.teacher_id !== me.id) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
    const records = db
      .prepare('SELECT * FROM drill_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
      .all(stu.id) as DrillRecordRow[];
    const all = db
      .prepare('SELECT score, grade, scene_id FROM drill_records WHERE user_id = ?')
      .all(stu.id) as { score: number; grade: string; scene_id: string }[];
    const total = all.length;
    const avgScore = total === 0 ? 0 : all.reduce((s, r) => s + r.score, 0) / total;
    res.json({
      student: toPublicUser(stu),
      total_drills: total,
      avg_score: Math.round(avgScore * 10) / 10,
      recent_records: records.map(serializeRecord),
    });
  },
);

// =============================================================
// 辅助：把 DB row 转成 API 友好格式（JSON 反序列化）
// =============================================================
function serializeRecord(row: DrillRecordRow) {
  return {
    ...row,
    score_breakdown: row.score_breakdown ? safeJsonParse(row.score_breakdown) : null,
    operations: row.operations ? safeJsonParse(row.operations) : null,
  };
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
