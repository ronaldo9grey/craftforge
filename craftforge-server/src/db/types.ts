// 数据库实体的 TypeScript 类型（与 SQL schema 字段一一对应）

export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  student_no: string | null;
  role: UserRole;
  class_id: string | null;
  must_change_pw: number;  // 0 | 1
  created_at: number;
  last_login_at: number | null;
}

export interface ClassRow {
  id: string;
  name: string;
  teacher_id: string;
  join_code: string;
  created_at: number;
}

export interface DrillRecordRow {
  id: string;
  user_id: string;
  scene_id: string;
  fault_id: string;
  fault_name: string;
  start_time: number;
  end_time: number;
  duration_sec: number;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  difficulty: 'novice' | 'standard' | 'expert' | null;
  score_breakdown: string | null;  // JSON
  operations: string | null;       // JSON
  created_at: number;
}

export interface UserAchievementRow {
  id: string;
  user_id: string;
  achievement_key: string;
  unlocked_at: number;
}

// 暴露给前端的"公开用户信息"（去掉 password_hash 等敏感字段）
export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  student_no: string | null;
  role: UserRole;
  class_id: string | null;
  must_change_pw: boolean;
  created_at: number;
  last_login_at: number | null;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    student_no: u.student_no,
    role: u.role,
    class_id: u.class_id,
    must_change_pw: !!u.must_change_pw,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}
