import { create } from 'zustand';
import type { Message, KnowledgeItem } from '@/types';
import { fccKnowledge } from '@/templates/fcc/knowledge';
import { weldingKnowledge } from '@/templates/welding/knowledge';
import { askCoach } from '@/services/aiCoach';

interface AIState {
  messages: Message[];
  avatarMood: 'calm' | 'thinking' | 'alert' | 'guiding' | 'praising';
  voiceEnabled: boolean;
  knowledgeBase: KnowledgeItem[];
  isProcessing: boolean;

  // Actions
  sendMessage: (content: string, role: 'user' | 'ai', equipmentRefs?: string[]) => void;
  // 写入一条 user 消息并返回其 id（用于流式管道挂钩）
  appendUserMessage: (content: string) => string;
  // 给已存在的某条消息追加内容（流式逐 token 增长，含 16ms 节流）
  streamMessage: (prefixMessageId: string, chunk: string) => void;
  // 立即把流式缓冲 flush 到 messages（结束时使用）
  flushStream: (prefixMessageId: string) => void;
  setAvatarMood: (mood: AIState['avatarMood']) => void;
  toggleVoice: () => void;
  loadKnowledge: (template: 'fcc' | 'welding') => void;
  setProcessing: (processing: boolean) => void;
  clearMessages: () => void;
  findAnswer: (question: string) => KnowledgeItem | null;
  // 流式提问 AI 师傅；返回最终 ai 消息 id 便于外部完成态读取
  askCoachAsync: (userText: string) => Promise<string>;
}

// —— 流式渲染节流：按消息 id 维护未 flush 的 buffer 与上次 flush 时间戳 ——
// 任意一次 streamMessage 触发后，若距上次 flush ≥ 16ms 才真正 set state，
// 否则把 chunk 累积到 buffer，由 setTimeout 兜底刷新；避免高频 setState 导致渲染抖动。
const FLUSH_INTERVAL_MS = 16;
const streamBuffers = new Map<string, { pending: string; lastFlush: number; timer: number | null }>();

export const useAIStore = create<AIState>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'ai',
      content: '你好！我是 AI 师傅老张，干 FCC 二十年。有问题直接问，演练时也会盯你的操作给提示。',
      timestamp: Date.now(),
    },
  ],
  avatarMood: 'calm',
  voiceEnabled: true,
  knowledgeBase: [],
  isProcessing: false,

  sendMessage: (content, role, equipmentRefs) => {
    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      timestamp: Date.now(),
      equipmentRefs,
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  appendUserMessage: (content) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const message: Message = {
      id,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return id;
  },

  streamMessage: (prefixMessageId, chunk) => {
    if (!chunk) return;
    let buf = streamBuffers.get(prefixMessageId);
    if (!buf) {
      buf = { pending: '', lastFlush: 0, timer: null };
      streamBuffers.set(prefixMessageId, buf);
    }
    buf.pending += chunk;
    const now = Date.now();

    const flushNow = () => {
      const b = streamBuffers.get(prefixMessageId);
      if (!b || !b.pending) return;
      const append = b.pending;
      b.pending = '';
      b.lastFlush = Date.now();
      if (b.timer !== null) {
        clearTimeout(b.timer);
        b.timer = null;
      }
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === prefixMessageId ? { ...m, content: m.content + append } : m,
        ),
      }));
    };

    if (now - buf.lastFlush >= FLUSH_INTERVAL_MS) {
      flushNow();
    } else if (buf.timer === null) {
      // 兜底定时器：在 16ms 节流窗口结束后强制 flush，避免最后一段卡在缓冲里
      buf.timer = window.setTimeout(flushNow, FLUSH_INTERVAL_MS);
    }
  },

  flushStream: (prefixMessageId) => {
    const b = streamBuffers.get(prefixMessageId);
    if (!b) return;
    if (b.timer !== null) {
      clearTimeout(b.timer);
      b.timer = null;
    }
    if (b.pending) {
      const append = b.pending;
      b.pending = '';
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === prefixMessageId ? { ...m, content: m.content + append } : m,
        ),
      }));
    }
    streamBuffers.delete(prefixMessageId);
  },

  setAvatarMood: (mood) => set({ avatarMood: mood }),

  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),

  loadKnowledge: (template) => {
    if (template === 'fcc') {
      set({ knowledgeBase: fccKnowledge });
    } else if (template === 'welding') {
      set({ knowledgeBase: weldingKnowledge });
    }
  },

  setProcessing: (processing) => set({ isProcessing: processing }),

  clearMessages: () => set({
    messages: [{
      id: 'welcome',
      role: 'ai',
      content: '你好！我是 AI 师傅老张，干 FCC 二十年。有问题直接问，演练时也会盯你的操作给提示。',
      timestamp: Date.now(),
    }],
  }),

  findAnswer: (question) => {
    const knowledge = get().knowledgeBase;
    // 简单的关键词匹配
    const lowerQ = question.toLowerCase();
    return knowledge.find((item) =>
      item.question.toLowerCase().includes(lowerQ) ||
      item.tags.some((tag) => lowerQ.includes(tag.toLowerCase()))
    ) || null;
  },

  // 流式提问：写 user 消息 -> 创建占位 ai 消息 -> 流式 chunk 追加 -> 完成态切换
  // 失败链：DeepSeek 失败 -> 本地 KB -> 固定降级语
  askCoachAsync: async (userText) => {
    // 1. 写入 user 消息
    get().appendUserMessage(userText);

    // 2. 进入 thinking 态
    get().setProcessing(true);
    get().setAvatarMood('thinking');

    // 3. 创建占位 ai 消息
    const aiId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const placeholder: Message = {
      id: aiId,
      role: 'ai',
      content: '',
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, placeholder] }));

    let receivedAny = false;
    try {
      // 4. 调 askCoach 流式：askCoach 内部已带 KB 降级
      for await (const chunk of askCoach(userText)) {
        if (chunk) {
          receivedAny = true;
          get().streamMessage(aiId, chunk);
        }
      }
      get().flushStream(aiId);

      // 兜底：流没产出任何内容 → 用本地 KB 或固定语
      if (!receivedAny) {
        const kb = get().findAnswer(userText);
        const fallback = kb?.answer ?? '这个我也得看看运行参数再说，你先把异常参数面板拉出来对一下。';
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === aiId ? { ...m, content: fallback } : m,
          ),
        }));
      }
    } catch (err: unknown) {
      console.warn('[aiStore] askCoachAsync 异常，启用本地降级', err instanceof Error ? err.message : err);
      get().flushStream(aiId);
      const kb = get().findAnswer(userText);
      const fallback = kb?.answer ?? '这个我也得看看运行参数再说，你先把异常参数面板拉出来对一下。';
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === aiId ? { ...m, content: fallback } : m,
        ),
      }));
    } finally {
      // 5. 完成态：guiding，关闭 processing
      get().setProcessing(false);
      get().setAvatarMood('guiding');
    }

    return aiId;
  },
}));
