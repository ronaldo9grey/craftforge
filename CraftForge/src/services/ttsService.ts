// 前端 TTS 服务：与后端 /api/ai/tts 通信 + 音频播放 + 字级时间戳事件分发
// 用法：
//   const session = await ttsService.speak('老张要说的话');
//   session.on('boundary', (text) => { ... });   // 字级嘴型同步钩子
//   session.on('end', () => { ... });
//   session.stop();   // 中断
//
// 设计要点：
// - 仅暴露一个全局单例（同一时刻只允许老张说一句话，避免抢嘴）
// - 长文本由调用方按句切分；本服务一次只播放一段（≤150 字）
// - 监听 audio.currentTime + subtitles 数组实现字级 boundary 事件
// - 浏览器自动播放策略：首次需要由用户点击触发；本服务捕获 NotAllowedError 并向上抛出
import type { SubtitlePiece } from '@/types';

type SessionEvent = 'boundary' | 'end' | 'error' | 'start';
type EventHandler = (...args: unknown[]) => void;

export interface TtsSession {
  /** 立即停止当前会话 */
  stop(): void;
  /** 监听事件 */
  on(event: SessionEvent, handler: EventHandler): void;
  /** 当前 sessionId（用于去重/调试） */
  sessionId: string;
}

interface TtsResponse {
  audio: string;
  subtitles: SubtitlePiece[];
  sessionId: string;
}

/** 读取 Vite 环境变量 */
function readEnv() {
  const rawBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').toString();
  const appToken = (import.meta.env.VITE_APP_TOKEN ?? '').toString();
  return { baseUrl: rawBase.replace(/\/+$/, ''), appToken };
}

/** base64 -> Blob URL（释放由调用方 revokeObjectURL） */
function base64ToBlobUrl(base64: string, mime = 'audio/mpeg'): string {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** 全局当前会话（保证同一时间只播一段） */
let currentAudio: HTMLAudioElement | null = null;
let currentSession: InternalSession | null = null;

class InternalSession implements TtsSession {
  sessionId: string;
  private audio: HTMLAudioElement;
  private subtitles: SubtitlePiece[];
  private blobUrl: string;
  private handlers = new Map<SessionEvent, Set<EventHandler>>();
  private rafId: number | null = null;
  private nextSubtitleIndex = 0;
  private stopped = false;

  constructor(audio: HTMLAudioElement, subtitles: SubtitlePiece[], blobUrl: string, sessionId: string) {
    this.audio = audio;
    this.subtitles = subtitles;
    this.blobUrl = blobUrl;
    this.sessionId = sessionId;

    audio.addEventListener('play', () => this.emit('start'));
    audio.addEventListener('ended', () => this.handleEnd());
    audio.addEventListener('error', () => this.emit('error', '音频播放错误'));
  }

  /** 启动 rAF 循环，驱动字级 boundary 事件 */
  start() {
    this.tick();
  }

  private tick = () => {
    if (this.stopped) return;
    const tMs = this.audio.currentTime * 1000;
    // 推进 subtitle 指针，触发所有"已到达开始时间"的片段
    while (
      this.nextSubtitleIndex < this.subtitles.length &&
      this.subtitles[this.nextSubtitleIndex].BeginTime <= tMs
    ) {
      const piece = this.subtitles[this.nextSubtitleIndex];
      this.emit('boundary', piece.Text, piece.BeginTime, piece.EndTime);
      this.nextSubtitleIndex++;
    }
    if (!this.audio.ended) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private handleEnd() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    URL.revokeObjectURL(this.blobUrl);
    this.emit('end');
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    try {
      this.audio.pause();
      this.audio.src = '';
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(this.blobUrl);
    this.emit('end');
  }

  on(event: SessionEvent, handler: EventHandler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  private emit(event: SessionEvent, ...args: unknown[]) {
    const set = this.handlers.get(event);
    if (!set) return;
    set.forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error('[ttsService] handler error', e);
      }
    });
  }
}

/**
 * 合成并播放一段文本（≤150 字）
 * 若当前已有音频在播，会先 stop 掉再播新内容（避免抢嘴）
 */
async function speak(text: string): Promise<TtsSession> {
  // 停止上一段
  stopCurrent();

  const { baseUrl, appToken } = readEnv();
  const resp = await fetch(`${baseUrl}/ai/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${appToken}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`TTS 请求失败 (${resp.status}): ${t.slice(0, 120)}`);
  }
  const data = (await resp.json()) as TtsResponse;
  if (!data.audio) throw new Error('TTS 返回缺少音频');

  const blobUrl = base64ToBlobUrl(data.audio);
  const audio = new Audio(blobUrl);
  audio.preload = 'auto';

  const session = new InternalSession(audio, data.subtitles || [], blobUrl, data.sessionId);
  currentAudio = audio;
  currentSession = session;

  try {
    await audio.play(); // 可能因为自动播放策略抛 NotAllowedError
    session.start();
  } catch (e) {
    session.stop();
    throw e;
  }
  return session;
}

/** 停止当前正在播放的会话（如有） */
function stopCurrent() {
  if (currentSession) {
    currentSession.stop();
    currentSession = null;
    currentAudio = null;
  }
}

/** 是否正在播放 */
function isPlaying(): boolean {
  return !!currentAudio && !currentAudio.paused && !currentAudio.ended;
}

export const ttsService = {
  speak,
  stopCurrent,
  isPlaying,
};
