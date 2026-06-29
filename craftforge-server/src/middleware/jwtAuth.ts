// JWT 工具 + 用户认证中间件
// - signToken(payload) 生成 JWT（默认 7 天有效期）
// - verifyToken(token) 校验 + 解析（会查黑名单）
// - requireAuth 中间件：解析 Authorization: Bearer <jwt>，未通过返回 401
// - requireRole(...roles) 中间件：必须在 requireAuth 之后，校验角色
//
// JWT_SECRET 来自 .env，未配置时使用默认值并打 warn（生产必须设置）

import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db, uuid } from '../db';
import type { UserRole, UserRow, PublicUser } from '../db/types';
import { toPublicUser } from '../db/types';
import { writeEventLog } from '../utils/logger';

const JWT_SECRET = (() => {
  const env = process.env.JWT_SECRET;
  // 生产环境强制要求强 secret（>= 32 字符）
  if (process.env.NODE_ENV === 'production') {
    if (!env || env.length < 32) {
      console.error(
        '[auth] ❌ JWT_SECRET 未配置或长度 < 32 字符，生产环境拒绝启动。\n' +
          '          请在 .env 中设置 JWT_SECRET=<64 字节随机串>'
      );
      process.exit(1);
    }
    return env;
  }
  if (!env) {
    console.warn('[auth] ⚠️  JWT_SECRET 未配置，使用默认开发值');
    return 'craftforge-dev-secret-CHANGE-ME-IN-PROD';
  }
  return env;
})();
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

// JWT payload 结构
export interface JwtPayload {
  jti: string;        // token id（用于黑名单）
  sub: string;        // user id
  role: UserRole;
  iat?: number;
  exp?: number;
}

/** 生成 JWT */
export function signToken(user: UserRow): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    jti: uuid(),
    sub: user.id,
    role: user.role,
  };
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, JWT_SECRET, options);
}

/** 校验 JWT（含黑名单查询） */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    // 黑名单检查
    const blackRow = db
      .prepare('SELECT 1 FROM session_blacklist WHERE jti = ?')
      .get(decoded.jti);
    if (blackRow) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** 把 jti 加入黑名单（登出 / 强制下线） */
export function revokeToken(jti: string, userId: string, expSeconds: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO session_blacklist (jti, user_id, revoked_at, expires_at) VALUES (?, ?, ?, ?)`
  ).run(jti, userId, Date.now(), expSeconds * 1000);
}

// Express Request 扩展
declare global {
  namespace Express {
    interface Request {
      authUser?: PublicUser;
      authJti?: string;
      authExp?: number;
    }
  }
}

/** 用户认证中间件：解析 JWT 并把用户挂到 req.authUser */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.header('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }
  const payload = verifyToken(m[1]);
  if (!payload) {
    writeEventLog('jwt_invalid', {
      ip: req.ip,
      path: req.originalUrl,
    });
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  const userRow = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(payload.sub) as UserRow | undefined;
  if (!userRow) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  req.authUser = toPublicUser(userRow);
  req.authJti = payload.jti;
  req.authExp = payload.exp;
  next();
}

/** 角色守卫：必须在 requireAuth 之后使用 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      writeEventLog('role_denied', {
        userId: req.authUser.id,
        role: req.authUser.role,
        need: roles,
        path: req.originalUrl,
      });
      res.status(403).json({ error: 'Forbidden', need: roles });
      return;
    }
    next();
  };
}

// 重新导出 APP_TOKEN 中间件（保持向后兼容）
export { requireAppToken } from './auth';
