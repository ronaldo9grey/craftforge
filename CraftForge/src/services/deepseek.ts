// 前端 AI 客户端：从「直连 DeepSeek」改为「请求自家后端代理」
// - chatStream(messages, opts)：SSE 流式接口，async generator 逐 chunk yield 文本
// - chatOnce(messages, opts)：一次性请求（内部 collect chatStream），返回完整字符串
// 协议：
//   POST {VITE_API_BASE_URL}/ai/chat
//   Header: Authorization: Bearer {VITE_APP_TOKEN}
//   Body  : { messages, temperature?, maxTokens? }
//   Resp  : SSE 自定义协议
//             data: {"delta":"..."}\n\n
//             ...
//             data: [DONE]\n\n

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** 采样温度，默认 0.7 */
  temperature?: number;
  /** 最大 token 数，默认 400 */
  maxTokens?: number;
  /** 外部传入的取消信号；与内部 30s 超时合并使用 */
  signal?: AbortSignal;
}

// 默认 30 秒超时（流式响应整体上限，比直连略宽松）
const REQUEST_TIMEOUT_MS = 30000;

/** 读取 vite 注入的环境变量（构建时已被替换为字面量） */
function readEnv(): { baseUrl: string; appToken: string } {
  const rawBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').toString();
  const appToken = (import.meta.env.VITE_APP_TOKEN ?? '').toString();
  // 去掉末尾斜杠，保证拼接干净
  const baseUrl = rawBase.replace(/\/+$/, '');
  return { baseUrl, appToken };
}

/** 当外部 signal 与内部超时 controller 合并：任何一边触发都会 abort */
function linkAbort(external: AbortSignal | undefined, internal: AbortController): () => void {
  if (!external) return () => {};
  if (external.aborted) {
    internal.abort();
    return () => {};
  }
  const onAbort = () => internal.abort();
  external.addEventListener('abort', onAbort);
  return () => external.removeEventListener('abort', onAbort);
}

/**
 * 流式对话接口（SSE）：逐 chunk yield 文本片段
 * 调用方：const gen = chatStream(messages); for await (const text of gen) { ... }
 */
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): AsyncGenerator<string, void, unknown> {
  const { baseUrl, appToken } = readEnv();
  if (!appToken) {
    throw new Error('VITE_APP_TOKEN 未配置');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const unlink = linkAbort(opts.signal, controller);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appToken}`,
      },
      body: JSON.stringify({
        messages,
        temperature: opts.temperature ?? 0.7,
        maxTokens: opts.maxTokens ?? 400,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    unlink();
    const reason = err instanceof Error ? err.message : 'unknown';
    throw new Error(`AI 流式请求失败: ${reason}`);
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    unlink();
    throw new Error(`AI 流式请求失败: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 以空行分隔事件，每个事件可能含多行 data: 前缀
      const lines = buffer.split('\n');
      // 保留最后一行（可能被截断）
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const obj = JSON.parse(payload);
          // 服务端约定字段：{ delta: string }；如果上游报错则可能是 { error: 'xxx' }
          if (typeof obj?.delta === 'string' && obj.delta.length > 0) {
            yield obj.delta;
          } else if (typeof obj?.error === 'string') {
            throw new Error(`AI 上游错误: ${obj.error}`);
          }
        } catch (e) {
          // 仅在确实是我们抛的错误时再抛出，其他 JSON parse 失败属于心跳，忽略
          if (e instanceof Error && e.message.startsWith('AI 上游错误')) throw e;
        }
      }
    }
  } finally {
    clearTimeout(timer);
    unlink();
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

/** 非流式一次性请求：内部 collect chatStream，返回完整字符串 */
export async function chatOnce(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  let acc = '';
  for await (const chunk of chatStream(messages, opts)) {
    acc += chunk;
  }
  return acc;
}
