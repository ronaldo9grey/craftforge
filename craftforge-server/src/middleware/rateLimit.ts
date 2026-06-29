// 内存版滑窗限流（IP + 用户双维度）
// - 默认 60 秒窗口、最多 60 次（提升上限，原 20 次太严苛）
// - 已登录用户用 userId 作为 key，匿名请求用 IP
// - 单进程内存 Map，重启即重置；多实例需替换为 Redis
// - 超限返回 429 { error: 'Too Many Requests', retryAfter: N }
import { Request, Response, NextFunction } from 'express';
import { writeEventLog } from '../utils/logger';

const WINDOW_MS = 60 * 1000;
// 普通接口 60 次 / 分钟
const MAX_HITS_DEFAULT = 60;
// AI 接口单独限流：30 次 / 分钟（防止刷 DeepSeek 配额）
const MAX_HITS_AI = 30;

/** key → 时间戳数组 */
const hits: Map<string, number[]> = new Map();

/** 取客户端 IP：优先 X-Forwarded-For 第一个，否则 req.ip */
function getClientIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] || '') as string;
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || 'unknown';
}

/** 取限流 key：优先 userId（更精准），其次 IP */
function getKey(req: Request): string {
  const uid = req.authUser?.id;
  if (uid) return `u:${uid}`;
  return `ip:${getClientIp(req)}`;
}

/** 通用限流（默认 60 次 / 分钟） */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  applyLimit(req, res, next, MAX_HITS_DEFAULT, 'general');
}

/** AI 接口限流（30 次 / 分钟，单独防止刷 DeepSeek 配额） */
export function rateLimitAI(req: Request, res: Response, next: NextFunction): void {
  applyLimit(req, res, next, MAX_HITS_AI, 'ai');
}

function applyLimit(
  req: Request,
  res: Response,
  next: NextFunction,
  maxHits: number,
  tag: string
): void {
  const key = `${tag}:${getKey(req)}`;
  const now = Date.now();
  const arr = hits.get(key) || [];
  const fresh = arr.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= maxHits) {
    const oldest = fresh[0]!;
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    // 关键事件埋点
    writeEventLog('rate_limit_hit', {
      key,
      maxHits,
      windowSec: WINDOW_MS / 1000,
      ip: getClientIp(req),
      userId: req.authUser?.id,
      path: req.originalUrl,
    });
    res.status(429).json({ error: 'Too Many Requests', retryAfter });
    return;
  }
  fresh.push(now);
  hits.set(key, fresh);
  next();
}

/** 周期性清理（避免长尾 Map 膨胀），每 5 分钟跑一次 */
setInterval(() => {
  const now = Date.now();
  for (const [key, arr] of hits) {
    const fresh = arr.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) hits.delete(key);
    else hits.set(key, fresh);
  }
}, 5 * 60 * 1000).unref();
