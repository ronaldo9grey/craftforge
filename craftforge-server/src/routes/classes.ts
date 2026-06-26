// 班级管理路由
//   POST   /api/classes                 创建班级（教师 / 管理员）
//   GET    /api/classes/mine            获取"我"的班级
//                                       - 教师/管理员：自己管理的所有班级
//                                       - 学生：自己加入的那 1 个班级
//   GET    /api/classes/:id             单个班级详情
//   GET    /api/classes/:id/members     班级学生列表（教师 / 管理员）
//   POST   /api/classes/join            学生用 6 位 join_code 加入班级
//   DELETE /api/classes/:id             删除班级（仅班主任 / 管理员）
//   POST   /api/classes/:id/regen-code  重新生成 join_code（仅班主任 / 管理员）
//
// 设计要点：
// - join_code 创建时随机生成 6 位字母数字（去掉易混字符）
// - 学生加入会写入 users.class_id，离开班级 = 把 class_id 设为 null（暂不开放）
// - 教师只能看自己创建的班级；管理员可以看全部

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, uuid, generateJoinCode } from '../db';
import type { ClassRow, UserRow } from '../db/types';
import { toPublicUser } from '../db/types';
import { requireAuth, requireRole } from '../middleware/jwtAuth';

const router = Router();

const CreateClassSchema = z.object({
  name: z.string().min(1).max(60),
});

const JoinClassSchema = z.object({
  join_code: z.string().length(6),
});

// =============================================================
// POST /api/classes  创建班级
// =============================================================
router.post('/', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const parsed = CreateClassSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const teacherId = req.authUser!.id;
  const id = uuid();
  // 极小概率 join_code 重复，重试最多 5 次
  let joinCode = '';
  for (let i = 0; i < 5; i++) {
    const tryCode = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM classes WHERE join_code = ?').get(tryCode);
    if (!exists) {
      joinCode = tryCode;
      break;
    }
  }
  if (!joinCode) {
    res.status(500).json({ error: 'Failed to generate unique join code, please retry' });
    return;
  }
  const now = Date.now();
  db.prepare(
    `INSERT INTO classes (id, name, teacher_id, join_code, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, parsed.data.name, teacherId, joinCode, now);
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(id) as ClassRow;
  res.status(201).json({ class: cls });
});

// =============================================================
// GET /api/classes/mine  我的班级
// =============================================================
router.get('/mine', requireAuth, (req: Request, res: Response) => {
  const me = req.authUser!;
  if (me.role === 'student') {
    if (!me.class_id) {
      res.json({ classes: [] });
      return;
    }
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(me.class_id) as ClassRow | undefined;
    res.json({ classes: cls ? [cls] : [] });
    return;
  }
  // 教师/管理员
  let rows: ClassRow[];
  if (me.role === 'admin') {
    rows = db.prepare('SELECT * FROM classes ORDER BY created_at DESC').all() as ClassRow[];
  } else {
    rows = db
      .prepare('SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC')
      .all(me.id) as ClassRow[];
  }
  res.json({ classes: rows });
});

// =============================================================
// GET /api/classes/:id  班级详情
// =============================================================
// 注意：静态路由（/mine, /my-request）必须在动态路由（/:id）之前注册，
// 否则 Express 会把 "my-request" 当作 :id 参数匹配
router.get('/my-request', requireAuth, (req: Request, res: Response) => {
  const me = req.authUser!;
  if (me.role !== 'student') {
    res.json({ request: null });
    return;
  }
  const row = db
    .prepare(
      `SELECT r.id, r.user_id, r.class_id, r.status, r.created_at, r.reviewed_at, r.reviewed_by,
              c.name AS class_name, c.join_code
       FROM class_join_requests r
       JOIN classes c ON c.id = r.class_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC LIMIT 1`,
    )
    .get(me.id);
  res.json({ request: row ?? null });
});

router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id) as ClassRow | undefined;
  if (!cls) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }
  const me = req.authUser!;
  // 权限校验：班主任本人 / 管理员 / 该班学生才能看
  const isMember = me.class_id === cls.id;
  const isOwner = me.role === 'admin' || (me.role === 'teacher' && cls.teacher_id === me.id);
  if (!isMember && !isOwner) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  // 同时返回学生数量，方便前端展示
  const memberCount = (db
    .prepare('SELECT COUNT(*) AS c FROM users WHERE class_id = ? AND role = ?')
    .get(cls.id, 'student') as { c: number }).c;
  res.json({ class: cls, member_count: memberCount });
});

// =============================================================
// GET /api/classes/:id/members  班级学生列表
// =============================================================
router.get('/:id/members', requireAuth, (req: Request, res: Response) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id) as ClassRow | undefined;
  if (!cls) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }
  const me = req.authUser!;
  const isOwner = me.role === 'admin' || (me.role === 'teacher' && cls.teacher_id === me.id);
  if (!isOwner) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const rows = db
    .prepare(`SELECT * FROM users WHERE class_id = ? AND role = 'student' ORDER BY created_at DESC`)
    .all(cls.id) as UserRow[];
  res.json({ members: rows.map(toPublicUser) });
});

// =============================================================
// POST /api/classes/join  学生申请加入班级（审批制）
// - Q1 决策 A：已有 class_id 的学生（兼容老数据）直接拒绝，不重复申请
// - 同一学生对同一班级只允许 1 个 pending 申请
// - rejected 状态可以重新申请（Q2-A：拒后可再申）
// =============================================================
router.post('/join', requireAuth, (req: Request, res: Response) => {
  const me = req.authUser!;
  if (me.role !== 'student') {
    res.status(403).json({ error: 'Only students can join class' });
    return;
  }
  const parsed = JoinClassSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const cls = db
    .prepare('SELECT * FROM classes WHERE join_code = ?')
    .get(parsed.data.join_code.toUpperCase()) as ClassRow | undefined;
  if (!cls) {
    res.status(404).json({ error: 'Class not found with this join code' });
    return;
  }

  // 已经是该班学生 → 短路返回 OK
  if (me.class_id === cls.id) {
    res.json({ status: 'already_member', class: cls });
    return;
  }

  // 检查是否已有 pending 申请
  const existing = db
    .prepare(`SELECT * FROM class_join_requests WHERE user_id = ? AND class_id = ? AND status = 'pending'`)
    .get(me.id, cls.id);
  if (existing) {
    res.status(409).json({ error: 'Already have a pending request', class: cls });
    return;
  }

  const reqId = uuid();
  const now = Date.now();
  db.prepare(
    `INSERT INTO class_join_requests (id, user_id, class_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
  ).run(reqId, me.id, cls.id, now);
  res.status(201).json({ status: 'pending', class: cls, request_id: reqId });
});

// =============================================================
// GET /api/classes/:id/requests  教师查看待审批申请列表
// =============================================================
router.get('/:id/requests', requireAuth, (req: Request, res: Response) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id) as ClassRow | undefined;
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
  const me = req.authUser!;
  const isOwner = me.role === 'admin' || (me.role === 'teacher' && cls.teacher_id === me.id);
  if (!isOwner) { res.status(403).json({ error: 'Forbidden' }); return; }
  const status = (req.query.status as string) || 'pending';
  const rows = db
    .prepare(
      `SELECT r.id AS request_id, r.status, r.created_at, r.reviewed_at,
              u.id AS user_id, u.username, u.display_name, u.student_no
       FROM class_join_requests r
       JOIN users u ON u.id = r.user_id
       WHERE r.class_id = ? AND r.status = ?
       ORDER BY r.created_at DESC`,
    )
    .all(cls.id, status);
  res.json({ requests: rows });
});

// =============================================================
// POST /api/classes/requests/:reqId/review  教师批准 / 拒绝
// body: { action: 'approve' | 'reject' }
// 批准时：把学生的 class_id 设为该班级；同时把同学生对其它班级的 pending 全部 reject
// =============================================================
const ReviewSchema = z.object({ action: z.enum(['approve', 'reject']) });
router.post('/requests/:reqId/review', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Bad request' }); return; }
  const reqRow = db.prepare('SELECT * FROM class_join_requests WHERE id = ?').get(req.params.reqId) as
    | { id: string; user_id: string; class_id: string; status: string }
    | undefined;
  if (!reqRow) { res.status(404).json({ error: 'Request not found' }); return; }
  if (reqRow.status !== 'pending') { res.status(409).json({ error: 'Request already reviewed' }); return; }

  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(reqRow.class_id) as ClassRow | undefined;
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
  const me = req.authUser!;
  if (me.role !== 'admin' && cls.teacher_id !== me.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const now = Date.now();
  const newStatus = parsed.data.action === 'approve' ? 'approved' : 'rejected';
  db.prepare(`UPDATE class_join_requests SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`)
    .run(newStatus, now, me.id, reqRow.id);

  if (parsed.data.action === 'approve') {
    // 把学生加进班级
    db.prepare('UPDATE users SET class_id = ? WHERE id = ?').run(cls.id, reqRow.user_id);
    // 把该学生对其他班级的 pending 全部拒绝（避免脚踩两班船）
    db.prepare(
      `UPDATE class_join_requests SET status = 'rejected', reviewed_at = ?, reviewed_by = ?
       WHERE user_id = ? AND status = 'pending' AND id != ?`,
    ).run(now, me.id, reqRow.user_id, reqRow.id);
  }
  res.json({ ok: true, status: newStatus });
});

// =============================================================
// POST /api/classes/:id/kick/:userId  教师把学生踢出班级
// =============================================================
router.post('/:id/kick/:userId', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id) as ClassRow | undefined;
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
  const me = req.authUser!;
  if (me.role !== 'admin' && cls.teacher_id !== me.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  db.prepare(`UPDATE users SET class_id = NULL WHERE id = ? AND class_id = ?`).run(req.params.userId, cls.id);
  res.json({ ok: true });
});

// =============================================================
// POST /api/classes/:id/regen-code  重新生成 join_code
// =============================================================
router.post('/:id/regen-code', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id) as ClassRow | undefined;
  if (!cls) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }
  const me = req.authUser!;
  if (me.role !== 'admin' && cls.teacher_id !== me.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  let newCode = '';
  for (let i = 0; i < 5; i++) {
    const tryCode = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM classes WHERE join_code = ?').get(tryCode);
    if (!exists) {
      newCode = tryCode;
      break;
    }
  }
  if (!newCode) {
    res.status(500).json({ error: 'Failed to generate unique join code' });
    return;
  }
  db.prepare('UPDATE classes SET join_code = ? WHERE id = ?').run(newCode, cls.id);
  res.json({ join_code: newCode });
});

// =============================================================
// DELETE /api/classes/:id  删除班级
// 注意：FOREIGN KEY ON DELETE CASCADE 会自动把 users.class_id 设为 NULL（SET NULL）
// =============================================================
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), (req: Request, res: Response) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id) as ClassRow | undefined;
  if (!cls) {
    res.status(404).json({ error: 'Class not found' });
    return;
  }
  const me = req.authUser!;
  if (me.role !== 'admin' && cls.teacher_id !== me.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  db.prepare('DELETE FROM classes WHERE id = ?').run(cls.id);
  res.json({ ok: true });
});

export default router;
