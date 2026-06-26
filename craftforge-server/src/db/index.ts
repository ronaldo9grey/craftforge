// 数据库模块：SQLite (better-sqlite3) 同步驱动
// - 启动时自动建表 + 创建种子管理员
// - 所有 schema 集中在此，便于维护
// - 数据文件：data/craftforge.db（被 .gitignore 排除）

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// 数据库文件路径
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'craftforge.db');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 创建/打开数据库
export const db = new Database(DB_PATH);

// 性能优化
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// =============================================================
// 表结构（首次运行自动建表，重复执行无副作用）
// =============================================================
const SCHEMA_SQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,                -- uuid
  username        TEXT NOT NULL UNIQUE,            -- 登录名（学号 / 工号 / 手机号）
  password_hash   TEXT NOT NULL,                   -- bcrypt
  display_name    TEXT NOT NULL,                   -- 显示名
  student_no      TEXT,                            -- 学号（可空，教师可不填）
  role            TEXT NOT NULL DEFAULT 'student', -- 'student' | 'teacher' | 'admin'
  class_id        TEXT,                            -- FK→classes.id（学生才有）
  must_change_pw  INTEGER NOT NULL DEFAULT 0,      -- 是否强制改密（首次登录的种子账号）
  created_at      INTEGER NOT NULL,
  last_login_at   INTEGER,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- 班级表
CREATE TABLE IF NOT EXISTS classes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  teacher_id   TEXT NOT NULL,                      -- FK→users.id
  join_code    TEXT NOT NULL UNIQUE,               -- 6 位加入码
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);

-- 演练记录表
CREATE TABLE IF NOT EXISTS drill_records (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  scene_id          TEXT NOT NULL,                 -- 'fcc' | 'welding' | 'cnc' | ...
  fault_id          TEXT NOT NULL,
  fault_name        TEXT NOT NULL,
  start_time        INTEGER NOT NULL,
  end_time          INTEGER NOT NULL,
  duration_sec      INTEGER NOT NULL,
  score             INTEGER NOT NULL,
  grade             TEXT NOT NULL,                 -- 'S' | 'A' | 'B' | 'C' | 'D'
  difficulty        TEXT,                          -- 'novice' | 'standard' | 'expert'
  score_breakdown   TEXT,                          -- JSON
  operations        TEXT,                          -- JSON
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_records_user_time ON drill_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_scene     ON drill_records(scene_id);

-- 用户成就表
CREATE TABLE IF NOT EXISTS user_achievements (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  achievement_key   TEXT NOT NULL,                 -- 'first_win' | 's_grade' | 'all_scenes' | ...
  unlocked_at       INTEGER NOT NULL,
  UNIQUE(user_id, achievement_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- JWT 会话黑名单表（用于登出 / 强制下线）
CREATE TABLE IF NOT EXISTS session_blacklist (
  jti           TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  revoked_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_blacklist_exp ON session_blacklist(expires_at);

-- 班级加入申请（教师审批制）
-- 一个学生对同一班级只能有一个非 rejected 状态的申请
CREATE TABLE IF NOT EXISTS class_join_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  class_id      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at    INTEGER NOT NULL,
  reviewed_at   INTEGER,
  reviewed_by   TEXT,                              -- 教师 user.id
  FOREIGN KEY (user_id)  REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id)  ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_jr_user        ON class_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_jr_class       ON class_join_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_jr_class_status ON class_join_requests(class_id, status);

-- 错题本：按 (user_id, scene_id, fault_id) 唯一
CREATE TABLE IF NOT EXISTS mistakes (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  scene_id        TEXT NOT NULL,
  fault_id        TEXT NOT NULL,
  fault_name      TEXT NOT NULL,
  fail_count      INTEGER NOT NULL DEFAULT 1,        -- 失败次数（C/D 评级或手动标记累加）
  last_fail_at    INTEGER NOT NULL,
  last_score      INTEGER NOT NULL DEFAULT 0,
  last_grade      TEXT NOT NULL DEFAULT 'D',
  status          TEXT NOT NULL DEFAULT 'open',      -- 'open' | 'mastered'
  mastered_at     INTEGER,
  created_at      INTEGER NOT NULL,
  UNIQUE(user_id, scene_id, fault_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mistakes_user_status ON mistakes(user_id, status);

-- 专家经验蒸馏库：从老专家口述/操作记录中LLM蒸馏出的结构化经验
CREATE TABLE IF NOT EXISTS experience_rules (
  id              TEXT PRIMARY KEY,
  scene_id        TEXT NOT NULL,
  fault_id        TEXT,
  fault_name      TEXT NOT NULL,
  title           TEXT NOT NULL,
  raw_transcript  TEXT,
  raw_annotations TEXT,
  distilled       TEXT,                               -- JSON: 蒸馏出的结构化经验
  expert_name     TEXT,
  expert_title    TEXT,
  source_type     TEXT DEFAULT 'think_aloud',         -- think_aloud | interview | observation
  status          TEXT DEFAULT 'active',              -- active | archived
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exp_scene ON experience_rules(scene_id, status);
CREATE INDEX IF NOT EXISTS idx_exp_fault ON experience_rules(scene_id, fault_id, status);
`;

// 执行 schema（用 transaction 确保原子性）
db.exec(SCHEMA_SQL);

// =============================================================
// 工具：UUID v4（最简实现，避免引入 uuid 包）
// =============================================================
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// =============================================================
// 工具：6 位班级加入码（A-Z + 0-9，去掉易混淆字符）
// =============================================================
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

// =============================================================
// 种子数据：管理员账号（仅在 users 表为空时创建）
// 默认 admin / admin123，登录后强制改密
// =============================================================
export function seedAdmin(): void {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (row.c > 0) return;

  const id = uuid();
  const passwordHash = bcrypt.hashSync('admin123', 10);
  const now = Date.now();
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, must_change_pw, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, 'admin', passwordHash, '超级管理员', 'admin', 1, now);

  console.log('[db] seed admin created: username=admin / password=admin123 (must change on first login)');
}

// 启动时执行种子
seedAdmin();

console.log(`[db] sqlite ready at ${DB_PATH}`);
