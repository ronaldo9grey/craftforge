// 内存版 IP 滑窗限流
// - 60 秒窗口、最多 20 次
// - 单进程内存 Map，重启即重置；多实例需替换为 Redis
// - 超限返回 429 { error: 'Too Many Requests', retryAfter: N }
import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60 * 1000;
const MAX_HITS = 20;

/** 每个 IP 对应的访问时间戳数组（单调递增） */
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

/** 限流中间件 */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const arr = hits.get(ip) || [];
  // 丢弃窗口外
  const fresh = arr.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= MAX_HITS) {
    const oldest = fresh[0]!;
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too Many Requests', retryAfter });
    return;
  }
  fresh.push(now);
  hits.set(ip, fresh);
  next();
}

/** 周期性清理（避免长尾 Map 膨胀），每 5 分钟跑一次 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) {
    const fresh = arr.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) hits.delete(ip);
    else hits.set(ip, fresh);
  }
}, 5 * 60 * 1000).unref();
