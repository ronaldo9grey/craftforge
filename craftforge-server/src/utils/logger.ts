// 按日期切分的 JSONL 日志工具
// - 单进程内异步追加写，文件名 logs/YYYY-MM-DD.jsonl
// - 每条日志独占一行 JSON，便于 ELK/grep 分析
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

/** 取当日日志文件路径 */
function dailyFilePath(): string {
  const dir = ensureLogDir();
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return path.join(dir, `${yyyy}-${mm}-${dd}.jsonl`);
}

/** 写一条访问日志（异步、追加）；失败不抛错，避免影响主流程 */
export function writeAccessLog(entry: AccessLogEntry): void {
  try {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFile(dailyFilePath(), line, (err) => {
      if (err) {
        // 仅打印到 stderr，避免递归
        console.error('[logger] 写日志失败:', err.message);
      }
    });
  } catch (e) {
    console.error('[logger] 序列化日志失败:', e);
  }
}

/** 写一条普通文本日志（独立级别），用于全局异常捕获 */
export function writeErrorLog(msg: string, extra?: Record<string, unknown>): void {
  const entry = {
    time: new Date().toISOString(),
    level: 'error',
    msg,
    ...extra,
  };
  try {
    fs.appendFile(dailyFilePath(), JSON.stringify(entry) + '\n', () => {});
  } catch {
    /* ignore */
  }
}
