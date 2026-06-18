// APP_TOKEN 鉴权中间件
// - 校验 Authorization: Bearer <APP_TOKEN>
// - 不一致返回 401 { error: 'Unauthorized' }
// - APP_TOKEN 来自环境变量 process.env.APP_TOKEN
import { Request, Response, NextFunction } from 'express';

export function requireAppToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.APP_TOKEN || '';
  // 服务端未配置 APP_TOKEN 视为严重配置错误，直接 500
  if (!expected) {
    res.status(500).json({ error: 'Server APP_TOKEN not configured' });
    return;
  }
  const auth = req.header('authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m || m[1] !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
