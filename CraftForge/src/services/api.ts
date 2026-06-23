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
  /** 申请加入班级（审批制）返回 status: 'pending' | 'already_member' */
  join: (joinCode: string) =>
    apiFetch<{ status: string; class: ClassRow; request_id?: string }>('/classes/join', {
      method: 'POST',
      body: { join_code: joinCode.toUpperCase() },
    }),
  /** 学生查我的最新申请状态 */
  myRequest: () =>
    apiFetch<{ request: null | { id: string; class_id: string; status: string; created_at: number; class_name: string; join_code: string } }>('/classes/my-request'),
  /** 教师查待审批列表 */
  pendingRequests: (classId: string, status: 'pending' | 'approved' | 'rejected' = 'pending') =>
    apiFetch<{ requests: Array<{ request_id: string; status: string; created_at: number; user_id: string; username: string; display_name: string; student_no: string | null }> }>(
      `/classes/${classId}/requests?status=${status}`,
    ),
  /** 教师批准 / 拒绝 */
  reviewRequest: (reqId: string, action: 'approve' | 'reject') =>
    apiFetch<{ ok: true; status: string }>(`/classes/requests/${reqId}/review`, {
      method: 'POST',
      body: { action },
    }),
  /** 把学生踢出班级 */
  kick: (classId: string, userId: string) =>
    apiFetch<{ ok: true }>(`/classes/${classId}/kick/${userId}`, { method: 'POST' }),
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

// =============================================================
// 错题本 API
// =============================================================
export interface Mistake {
  id: string;
  user_id: string;
  scene_id: string;
  fault_id: string;
  fault_name: string;
  fail_count: number;
  last_fail_at: number;
  last_score: number;
  last_grade: string;
  status: 'open' | 'mastered';
  mastered_at: number | null;
  created_at: number;
}

export const mistakeApi = {
  list: (status: 'open' | 'mastered' | 'all' = 'open') =>
    apiFetch<{ mistakes: Mistake[]; stats: Record<string, number> }>(
      `/mistakes${status === 'open' ? '' : '?status=' + status}`,
    ),
  master: (id: string) =>
    apiFetch<{ ok: true }>(`/mistakes/${id}/master`, { method: 'POST' }),
  add: (data: { scene_id: string; fault_id: string; fault_name: string; score?: number; grade?: 'S' | 'A' | 'B' | 'C' | 'D' }) =>
    apiFetch<{ ok: true; action: string; id: string }>('/mistakes', { method: 'POST', body: data }),
};

// =============================================================
// 排行榜 API
// =============================================================
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  class_id: string | null;
  class_name: string | null;
  total_drills: number;
  avg_score: number;
  s_count: number;
}

export const leaderboardApi = {
  query: (params: {
    scope?: 'class' | 'global';
    window?: '30d' | 'all';
    metric?: 'avg' | 'drill_count' | 's_count';
  }) => {
    const qs = new URLSearchParams();
    qs.set('scope',  params.scope  ?? 'class');
    qs.set('window', params.window ?? '30d');
    qs.set('metric', params.metric ?? 'avg');
    return apiFetch<{
      leaderboard: LeaderboardEntry[];
      my_rank: number | null;
      my_extra_row: LeaderboardEntry | null;
      total: number;
      scope: string;
      window: string;
      metric: string;
      note?: string;
    }>(`/leaderboard?${qs.toString()}`);
  },
};
