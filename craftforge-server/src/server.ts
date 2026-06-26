// CraftForge 后端入口
// - Express + cors + json
// - /api/health：健康检查
// - /api/ai/chat：DeepSeek SSE 代理（鉴权 + 限流）
// - 全局异常捕获，全部记录到日志
// 注意：dotenv 用 override:true 强制让 .env 覆盖系统环境变量
//       否则用户 Windows 系统环境变量里的 DEEPSEEK_API_KEY 会压住 .env 的值
import dotenv from 'dotenv';
dotenv.config({ override: true });
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import aiRouter from './routes/ai';
import authRouter from './routes/auth';
import classesRouter from './routes/classes';
import { drillRecordsRouter, achievementsRouter, teacherRouter } from './routes/drillRecords';
import mistakesRouter from './routes/mistakes';
import leaderboardRouter from './routes/leaderboard';
import { analyticsRouter } from './routes/analytics';
import { experienceRouter } from './routes/experience';
import './db';  // 触发 SQLite 初始化 + 种子 admin 账号
import { writeAccessLog, writeErrorLog } from './utils/logger';

const PORT = Number(process.env.PORT || 3001);

const app = express();

// CORS：开发用 *，生产可以填具体域名（多个用逗号分隔）
const corsOrigin = (process.env.CORS_ORIGIN || '*').trim();
if (corsOrigin === '*' || corsOrigin === '') {
  app.use(cors());
} else {
  const list = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: list, credentials: false }));
}

// 信任前置代理（拿到真实 IP 用于日志和限流）
app.set('trust proxy', true);

// JSON body（5mb 上限，足够容纳 1000+ 操作记录的演练 payload）
app.use(express.json({ limit: '5mb' }));

// 健康检查
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: Date.now() });
});

// AI 路由
app.use('/api/ai', aiRouter);

// 用户认证路由
app.use('/api/auth', authRouter);

// 班级管理路由
app.use('/api/classes', classesRouter);

// 演练记录 / 成就 / 教师统计
app.use('/api/drill-records', drillRecordsRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/teacher', teacherRouter);

// 错题本 / 排行榜
app.use('/api/mistakes', mistakesRouter);
app.use('/api/leaderboard', leaderboardRouter);

// 学习数据分析
app.use('/api/analytics', analyticsRouter);

// 专家经验蒸馏
app.use('/api/experience', experienceRouter);

// 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// 全局错误兜底（路由内部已经各自处理过的不会到这里）
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  writeErrorLog('express_error', { msg: err.message, stack: err.stack, path: req.originalUrl });
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
  // 同步写一条访问日志
  writeAccessLog({
    time: new Date().toISOString(),
    ip: req.ip || 'unknown',
    method: req.method,
    path: req.originalUrl,
    status: 500,
    durationMs: 0,
    errorMsg: err.message,
  });
});

// 进程级异常兜底
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[unhandledRejection]', msg);
  writeErrorLog('unhandledRejection', { msg });
});
process.on('uncaughtException', (err: Error) => {
  console.error('[uncaughtException]', err.message);
  writeErrorLog('uncaughtException', { msg: err.message, stack: err.stack });
});

app.listen(PORT, () => {
  // 启动日志直接打印到 stdout（PM2 会捕获到 pm2-out.log）
  console.log(`[craftforge-server] listening on :${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});
