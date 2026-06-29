// /api/admin/*  管理员专用：日志查询 / 系统健康
// 仅 admin 角色可访问
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole } from '../middleware/jwtAuth';
import { writeEventLog } from '../utils/logger';

const router = Router();

router.use(requireAuth, requireRole('admin'));

const LOG_DIR = process.env.LOG_DIR || 'logs';

/** 把 YYYY-MM-DD 拼成日志文件路径 */
function logFile(kind: 'access' | 'error' | 'event', date: string): string {
  return path.resolve(process.cwd(), LOG_DIR, `${kind}-${date}.jsonl`);
}

/** 默认日期 = 今天（本地时区） */
function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * GET /api/admin/logs/:kind?date=YYYY-MM-DD&q=keyword&limit=200
 * kind: access | error | event
 * 返回：{ date, kind, total, lines: [{...}] }（最近 N 条，倒序）
 */
router.get('/logs/:kind', (req: Request, res: Response) => {
  const kind = req.params.kind;
  if (kind !== 'access' && kind !== 'error' && kind !== 'event') {
    res.status(400).json({ error: 'kind must be access|error|event' });
    return;
  }
  const date = (req.query.date as string) || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    return;
  }
  const q = ((req.query.q as string) || '').trim();
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  const file = logFile(kind, date);
  if (!fs.existsSync(file)) {
    res.json({ date, kind, total: 0, lines: [] });
    return;
  }
  // 简单读取整文件再过滤；如果未来日志体量大，再换为流式 / tail
  const raw = fs.readFileSync(file, 'utf-8');
  const allLines = raw.split('\n').filter((l) => l.trim());
  // 关键词过滤
  const filtered = q ? allLines.filter((l) => l.includes(q)) : allLines;
  // 倒序取最近 N 条
  const slice = filtered.slice(-limit).reverse();
  const parsed = slice.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return { _raw: l, _parseError: true };
    }
  });
  writeEventLog('admin_action', {
    userId: req.authUser!.id,
    action: 'view_logs',
    kind,
    date,
    q,
  });
  res.json({ date, kind, total: filtered.length, lines: parsed });
});

/**
 * GET /api/admin/logs
 * 返回 logs 目录下所有日志文件清单（按日期 / kind 分组）
 */
router.get('/logs', (_req: Request, res: Response) => {
  const dir = path.resolve(process.cwd(), LOG_DIR);
  if (!fs.existsSync(dir)) {
    res.json({ files: [] });
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return { name: f, sizeBytes: stat.size, mtime: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1));
  res.json({ files });
});

/**
 * GET /api/admin/health
 * 详细健康检查（仅管理员可见，含 DB 大小、磁盘占用、进程内存）
 */
router.get('/health', (_req: Request, res: Response) => {
  const dataDir = path.resolve(process.cwd(), 'data');
  const dbPath = path.join(dataDir, 'craftforge.db');
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    time: Date.now(),
    nodeVersion: process.version,
    uptimeSec: Math.round(process.uptime()),
    dbSizeBytes: dbSize,
    memory: {
      rssMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    },
  });
});

export const adminRouter = router;
