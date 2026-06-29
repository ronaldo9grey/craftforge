// 按日期切分的 JSONL 日志工具（分级 + 事件埋点）
// - 单进程内异步追加写
// - 文件命名：
//     logs/access-YYYY-MM-DD.jsonl   访问日志
//     logs/error-YYYY-MM-DD.jsonl    错误日志
//     logs/event-YYYY-MM-DD.jsonl    业务事件（埋点）
// - 每条日志独占一行 JSON，便于 grep / ELK
import fs from 'fs';
import path from 'path';

/** 单条访问日志结构 */
export interface AccessLogEntry {
  /** ISO8601 时间戳 */
  time: string;
  /** 客户端 IP */
  ip: string;
  /** 请求路径 */
  path: string;
  /** HTTP 方法 */
  method: string;
  /** 状态码 */
  status: number;
  /** 处理耗时（毫秒） */
  durationMs: number;
  /** 输入消息条数（可选） */
  messagesIn?: number;
  /** 流式输出累计字符数（可选） */
  charsOut?: number;
  /** 错误信息（可选） */
  errorMsg?: string;
  /** 当前登录用户（可选） */
  userId?: string;
}

/** 日志目录，从环境变量 LOG_DIR 读取，默认 logs */
const LOG_DIR = process.env.LOG_DIR || 'logs';

/** 确保日志目录存在 */
function ensureLogDir(): string {
  const abs = path.resolve(process.cwd(), LOG_DIR);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(abs, { recursive: true });
  }
  return abs;
}

/** 取当日日志文件路径（按 prefix 分文件） */
function dailyFilePath(prefix: 'access' | 'error' | 'event'): string {
  const dir = ensureLogDir();
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return path.join(dir, `${prefix}-${yyyy}-${mm}-${dd}.jsonl`);
}

/** 安全的异步追加，吞掉错误避免影响主流程 */
function appendLine(file: string, obj: unknown): void {
  try {
    const line = JSON.stringify(obj) + '\n';
    fs.appendFile(file, line, (err) => {
      if (err) console.error('[logger] 写日志失败:', err.message);
    });
  } catch (e) {
    console.error('[logger] 序列化日志失败:', e);
  }
}

/** 写一条访问日志（异步、追加） */
export function writeAccessLog(entry: AccessLogEntry): void {
  appendLine(dailyFilePath('access'), entry);
}

/** 写一条错误日志（独立级别），用于全局异常 / 上游失败 */
export function writeErrorLog(msg: string, extra?: Record<string, unknown>): void {
  appendLine(dailyFilePath('error'), {
    time: new Date().toISOString(),
    level: 'error',
    msg,
    ...extra,
  });
}

/**
 * 写一条业务事件日志（埋点）
 * 例如：login_success / login_fail / drill_complete / experience_distilled
 *       rate_limit_hit / jwt_invalid / admin_action
 */
export function writeEventLog(event: string, extra?: Record<string, unknown>): void {
  appendLine(dailyFilePath('event'), {
    time: new Date().toISOString(),
    level: 'event',
    event,
    ...extra,
  });
}

/**
 * 简化 API：根据级别一次性记日志
 *   logger.info('xxx', {a:1}) → event
 *   logger.error('xxx', {a:1}) → error
 */
export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => writeEventLog(msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) =>
    writeEventLog(msg, { level: 'warn', ...extra }),
  error: (msg: string, extra?: Record<string, unknown>) => writeErrorLog(msg, extra),
};
