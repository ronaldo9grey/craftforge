// /api/ai/chat 路由：APP_TOKEN 鉴权 + 限流 + SSE 流式转发到 DeepSeek
import { Router, Request, Response } from 'express';
import { requireAppToken } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { streamDeepSeek, ChatMessage } from '../services/deepseek';
import { writeAccessLog } from '../utils/logger';

const router = Router();

/** 请求 body 的最小校验 */
function validateBody(body: any): { ok: true; messages: ChatMessage[]; temperature?: number; maxTokens?: number } | { ok: false; reason: string } {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body 必须是 JSON 对象' };
  const { messages, temperature, maxTokens } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, reason: 'messages 必须是非空数组' };
  }
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { ok: false, reason: 'messages[*] 必须是对象' };
    if (m.role !== 'system' && m.role !== 'user' && m.role !== 'assistant') {
      return { ok: false, reason: 'messages[*].role 取值错误' };
    }
    if (typeof m.content !== 'string') return { ok: false, reason: 'messages[*].content 必须是字符串' };
  }
  const temp = temperature === undefined ? undefined : Number(temperature);
  const maxT = maxTokens === undefined ? undefined : Number(maxTokens);
  if (temp !== undefined && (Number.isNaN(temp) || temp < 0 || temp > 2)) {
    return { ok: false, reason: 'temperature 取值需在 [0,2]' };
  }
  if (maxT !== undefined && (Number.isNaN(maxT) || maxT < 1 || maxT > 4096)) {
    return { ok: false, reason: 'maxTokens 取值需在 [1,4096]' };
  }
  return { ok: true, messages: messages as ChatMessage[], temperature: temp, maxTokens: maxT };
}

/**
 * POST /api/ai/chat
 * Header: Authorization: Bearer <APP_TOKEN>
 * Body  : { messages, temperature?, maxTokens? }
 * Resp  : SSE，自定义协议
 *           data: {"delta":"..."}\n\n
 *           ...
 *           data: [DONE]\n\n
 */
router.post('/chat', requireAppToken, rateLimit, async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

  const validated = validateBody(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.reason });
    writeAccessLog({
      time: new Date().toISOString(),
      ip,
      method: req.method,
      path: req.originalUrl,
      status: 400,
      durationMs: Date.now() - startedAt,
      errorMsg: validated.reason,
    });
    return;
  }

  // 设置 SSE 头（在写第一字节前必须设好）
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 通知 nginx 不要缓冲
  // 立即把 header 发出去
  res.flushHeaders?.();

  let charsOut = 0;
  let errorMsg: string | undefined;
  let status = 200;

  try {
    const stats = await streamDeepSeek(res, {
      messages: validated.messages,
      temperature: validated.temperature,
      maxTokens: validated.maxTokens,
    });
    charsOut = stats.charsOut;
  } catch (e: unknown) {
    errorMsg = e instanceof Error ? e.message : String(e);
    status = 502;
    // 已经发出了 SSE 头，无法再改 status；用一条 error 事件兼容前端解析
    try {
      res.write(`data: ${JSON.stringify({ error: 'upstream_failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch {
      /* ignore */
    }
  } finally {
    try {
      res.end();
    } catch {
      /* ignore */
    }
    writeAccessLog({
      time: new Date(startedAt).toISOString(),
      ip,
      method: req.method,
      path: req.originalUrl,
      status,
      durationMs: Date.now() - startedAt,
      messagesIn: validated.ok ? validated.messages.length : undefined,
      charsOut,
      errorMsg,
    });
  }
});

export default router;
