// 统一 API 客户端
// - 自动注入 Authorization: Bearer <token>
// - 自动 JSON 序列化 / 解析
// - 401 时自动清除本地 token 并触发跳转登录
// - 错误统一抛 ApiError，方便上层 catch

const API_BASE = '/api'; // 通过 vite 代理转发到后端 3001

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: any,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TOKEN_KEY = 'craftforge_token';

/** 获取/设置/清除 token */
export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** 401 时的全局回调（authStore 注册进来，避免循环依赖） */
let on401Handler: (() => void) | null = null;
export function registerOn401(handler: () => void): void {
  on401Handler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 该次请求是否需要鉴权（默认 true，登录/bootstrap 接口设为 false） */
  auth?: boolean;
  /** 自定义额外 headers */
  headers?: Record<string, string>;
}

/** 通用请求函数 */
export async function apiFetch<T = any>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers = {} } = opts;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (auth) {
    const token = tokenStorage.get();
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 处理：清除 token + 通知全局
  if (resp.status === 401 && auth) {
    tokenStorage.clear();
    if (on401Handler) on401Handler();
  }

  let respBody: any = null;
  const text = await resp.text();
  try {
    respBody = text ? JSON.parse(text) : null;
  } catch {
    respBody = text;
  }

  if (!resp.ok) {
    const msg =
      (respBody && (respBody.error || respBody.message)) ||
      `HTTP ${resp.status} ${resp.statusText}`;
    throw new ApiError(resp.status, respBody, msg);
  }
  return respBody as T;
}

// =============================================================
// Auth API
// =============================================================
export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  student_no: string | null;
  role: 'student' | 'teacher' | 'admin';
  class_id: string | null;
  must_change_pw: boolean;
  created_at: number;
  last_login_at: number | null;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    }),
  me: () => apiFetch<{ user: PublicUser }>('/auth/me'),
  logout: () => apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }),
  changePassword: (oldPw: string, newPw: string) =>
    apiFetch<{ ok: true }>('/auth/change-password', {
      method: 'POST',
      body: { old_password: oldPw, new_password: newPw },
    }),
  bootstrapTeacher: (data: {
    username: string;
    password: string;
    display_name: string;
    student_no?: string;
  }) => apiFetch<{ user: PublicUser }>('/auth/bootstrap-teacher', {
    method: 'POST',
    body: data,
    auth: false,
  }),
  /** 管理员创建账号 */
  register: (data: {
    username: string;
    password: string;
    display_name: string;
    student_no?: string;
    role: 'student' | 'teacher' | 'admin';
    class_id?: string;
  }) => apiFetch<{ user: PublicUser }>('/auth/register', { method: 'POST', body: data }),
};

// =============================================================
// 班级 API
// =============================================================
export interface ClassRow {
  id: string;
  name: string;
  teacher_id: string;
  join_code: string;
  created_at: number;
}

export const classApi = {
  create: (name: string) =>
    apiFetch<{ class: ClassRow }>('/classes', { method: 'POST', body: { name } }),
  mine: () => apiFetch<{ classes: ClassRow[] }>('/classes/mine'),
  detail: (id: string) =>
    apiFetch<{ class: ClassRow; member_count: number }>(`/classes/${id}`),
  members: (id: string) =>
    apiFetch<{ members: PublicUser[] }>(`/classes/${id}/members`),
  join: (joinCode: string) =>
    apiFetch<{ class: ClassRow }>('/classes/join', {
      method: 'POST',
      body: { join_code: joinCode.toUpperCase() },
    }),
  regenCode: (id: string) =>
    apiFetch<{ join_code: string }>(`/classes/${id}/regen-code`, { method: 'POST' }),
  remove: (id: string) =>
    apiFetch<{ ok: true }>(`/classes/${id}`, { method: 'DELETE' }),
};

// =============================================================
// 演练记录 API
// =============================================================
export interface DrillRecord {
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
  score_breakdown: any;
  operations: any;
  created_at: number;
}

export const drillApi = {
  submit: (data: {
    scene_id: string;
    fault_id: string;
    fault_name: string;
    start_time: number;
    end_time: number;
    duration_sec: number;
    score: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    difficulty?: string | null;
    score_breakdown?: any;
    operations?: any;
  }) =>
    apiFetch<{ id: string; new_achievements: string[] }>('/drill-records', {
      method: 'POST',
      body: data,
    }),
  list: (params: { scene_id?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.scene_id) qs.set('scene_id', params.scene_id);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    return apiFetch<{ records: DrillRecord[]; total: number; limit: number; offset: number }>(
      `/drill-records${qs.toString() ? '?' + qs.toString() : ''}`,
    );
  },
  detail: (id: string) => apiFetch<{ record: DrillRecord }>(`/drill-records/${id}`),
  mySummary: () =>
    apiFetch<{
      total: number;
      avg_score: number;
      best_score: number;
      grade_count: Record<string, number>;
      scene_stats: Record<string, { count: number; avg: number; best: number }>;
      recent_curve: Array<{ created_at: number; score: number; grade: string; scene_id: string }>;
    }>('/drill-records/me/summary'),
};

// =============================================================
// 成就 API
// =============================================================
export interface Achievement {
  key: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: number | null;
}

export const achievementApi = {
  list: () => apiFetch<{ achievements: Achievement[] }>('/achievements'),
};

// =============================================================
// 教师统计 API
// =============================================================
export interface ClassDashboard {
  class_id: string;
  class_name: string;
  join_code: string;
  student_count: number;
  active_student_count_7d: number;
  drill_total: number;
  avg_score: number;
  covered_scenes: string[];
}

export const teacherApi = {
  dashboard: () => apiFetch<{ dashboard: ClassDashboard[] }>('/teacher/dashboard'),
  studentDetail: (id: string) =>
    apiFetch<{
      student: PublicUser;
      total_drills: number;
      avg_score: number;
      recent_records: DrillRecord[];
    }>(`/teacher/student/${id}`),
};
