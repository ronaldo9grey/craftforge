// 用户认证路由
//   POST /api/auth/register        注册（管理员可注册任意角色；公开注册仅 student）
//   POST /api/auth/login           用户名密码登录，返回 JWT
//   POST /api/auth/logout          登出（吊销当前 token）
//   GET  /api/auth/me              获取当前用户信息（含 must_change_pw 标志）
//   POST /api/auth/change-password 修改自己的密码
//
// 设计：
// - 注册策略 Q1=A：仅管理员可创建账号 → /register 需要 admin 角色
// - 但为了首次开荒方便，再加一个 /api/auth/bootstrap：仅当 users 表只有 admin 一个种子账号时允许直接注册一个 teacher
//   （文档里会写明此口子在第一个教师创建后即自动关闭）

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, uuid } from '../db';
import type { UserRow } from '../db/types';
import { toPublicUser } from '../db/types';
import { signToken, requireAuth, requireRole, revokeToken } from '../middleware/jwtAuth';
import { writeEventLog } from '../utils/logger';

const router = Router();

// =============================================================
// 校验 schema
// =============================================================
const RegisterSchema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(6).max(80),
  display_name: z.string().min(1).max(40),
  student_no: z.string().max(40).optional().nullable(),
  role: z.enum(['student', 'teacher', 'admin']).default('student'),
  class_id: z.string().uuid().optional().nullable(),
});

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const ChangePwSchema = z.object({
  old_password: z.string().min(1),
  new_password: z.string().min(6).max(80),
});

// =============================================================
// POST /api/auth/login
// =============================================================
router.post('/login', (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const { username, password } = parsed.data;
  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as UserRow | undefined;
  if (!user) {
    writeEventLog('login_fail', { username, reason: 'user_not_found', ip: req.ip });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    writeEventLog('login_fail', { username, userId: user.id, reason: 'bad_password', ip: req.ip });
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  // 更新最后登录时间
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id);
  const token = signToken(user);
  writeEventLog('login_success', { userId: user.id, username, role: user.role, ip: req.ip });
  res.json({
    token,
    user: toPublicUser({ ...user, last_login_at: Date.now() }),
  });
});

// =============================================================
// POST /api/auth/register
// 仅 admin 可创建账号
// =============================================================
router.post('/register', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const { username, password, display_name, student_no, role, class_id } = parsed.data;

  // 检查用户名重复
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  // 学生必须有 class_id，校验班级存在
  if (role === 'student' && class_id) {
    const cls = db.prepare('SELECT id FROM classes WHERE id = ?').get(class_id);
    if (!cls) {
      res.status(400).json({ error: 'Class not found' });
      return;
    }
  }

  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, student_no, role, class_id, must_change_pw, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(id, username, passwordHash, display_name, student_no ?? null, role, class_id ?? null, now);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  res.status(201).json({ user: toPublicUser(newUser) });
});

// =============================================================
// POST /api/auth/bootstrap-teacher
// 首次开荒：当 users 表里只有种子 admin 时，允许公开创建一个 teacher 账号
// 之后此接口永远返回 403
// =============================================================
router.post('/bootstrap-teacher', (req: Request, res: Response) => {
  // 计数：是否只有 admin 1 个用户
  const cnt = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (cnt !== 1) {
    res.status(403).json({ error: 'Bootstrap is closed' });
    return;
  }
  const parsed = RegisterSchema.safeParse({ ...req.body, role: 'teacher' });
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const { username, password, display_name, student_no } = parsed.data;
  const id = uuid();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, student_no, role, must_change_pw, created_at)
     VALUES (?, ?, ?, ?, ?, 'teacher', 0, ?)`
  ).run(id, username, passwordHash, display_name, student_no ?? null, now);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  res.status(201).json({ user: toPublicUser(newUser) });
});

// =============================================================
// GET /api/auth/me
// =============================================================
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.authUser });
});

// =============================================================
// POST /api/auth/logout
// =============================================================
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  if (req.authJti && req.authUser && req.authExp) {
    revokeToken(req.authJti, req.authUser.id, req.authExp);
  }
  res.json({ ok: true });
});

// =============================================================
// POST /api/auth/change-password
// =============================================================
router.post('/change-password', requireAuth, (req: Request, res: Response) => {
  const parsed = ChangePwSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bad request', detail: parsed.error.flatten() });
    return;
  }
  const userId = req.authUser!.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (!bcrypt.compareSync(parsed.data.old_password, user.password_hash)) {
    res.status(401).json({ error: 'Old password is wrong' });
    return;
  }
  const newHash = bcrypt.hashSync(parsed.data.new_password, 10);
  db.prepare('UPDATE users SET password_hash = ?, must_change_pw = 0 WHERE id = ?').run(newHash, userId);
  res.json({ ok: true });
});

export default router;
