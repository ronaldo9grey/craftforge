// DeepSeek SSE 透传服务
// - 调用 DeepSeek /chat/completions（stream=true），逐 chunk 解析
// - 把 OpenAI 兼容的 delta.content 转换为本服务自定义 SSE：
//     data: {"delta":"xxx"}\n\n
//     ...
//     data: [DONE]\n\n
// - 所有错误以 throw Error 形式返回给上层，由路由层统一处理
import type { Response } from 'express';

/** 单条对话消息（OpenAI 兼容） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 调用参数 */
export interface DeepSeekStreamOptions {
  /** 用户传入的 messages */
  messages: ChatMessage[];
  /** 采样温度，默认 0.7 */
  temperature?: number;
  /** 最大输出 token，默认 400 */
  maxTokens?: number;
}

/** 流式调用结果统计（路由层拿来写日志） */
export interface StreamStats {
  /** 累计输出字符数 */
  charsOut: number;
}

/** 拼接 endpoint：base + /chat/completions（兼容已带或未带后缀两种写法） */
function buildEndpoint(rawBase: string): string {
  const trimmed = rawBase.replace(/\/+$/, '');
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

/**
 * 转发到 DeepSeek，并把 SSE 响应改写后写入 res
 * 调用方在调用前应已设置好 res 的 SSE 头并 flush
 */
export async function streamDeepSeek(
  res: Response,
  opts: DeepSeekStreamOptions,
): Promise<StreamStats> {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY 未配置');
  }
  const endpoint = buildEndpoint(baseUrl);

  // 调用 DeepSeek（启用流式）
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 400,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    throw new Error(`DeepSeek upstream HTTP ${upstream.status}: ${text.slice(0, 200)}`);
  }

  // Node 18+ 的 fetch body 是 Web ReadableStream
  const reader = (upstream.body as unknown as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let charsOut = 0;

  // 写入一行 SSE 事件
  const sendDelta = (delta: string) => {
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  };
  const sendDone = () => {
    res.write('data: [DONE]\n\n');
  };

  try {
    // 客户端断开则提前终止，避免无谓地继续读上游
    let aborted = false;
    res.on('close', () => {
      aborted = true;
      // 尝试取消上游读取
      reader.cancel().catch(() => {});
    });

    while (true) {
      if (aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按行解析（DeepSeek 上行 SSE 兼容 OpenAI）
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          sendDone();
          return { charsOut };
        }
        try {
          const obj = JSON.parse(payload);
          const delta: string | undefined = obj?.choices?.[0]?.delta?.content;
          if (delta) {
            charsOut += delta.length;
            sendDelta(delta);
          }
        } catch {
          // 心跳或非 JSON，忽略
        }
      }
    }

    // 正常读完但上游没发 [DONE]，补一个
    sendDone();
    return { charsOut };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
