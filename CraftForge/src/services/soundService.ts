// 前端音效服务：用 Web Audio API 实时合成工厂现场音效，零资源依赖
//
// 设计要点：
// 1. 单例 AudioContext，首次播放时懒初始化（满足浏览器自动播放策略）
// 2. 所有声音都是用 OscillatorNode + 滤波器 + 噪声生成器实时合成，无需音频文件
// 3. 提供 setMasterVolume / mute / unmute 接口供 UI 控制
// 4. 环境底噪可循环播放；其他音效都是一次性
//
// 音效类型：
//   - ambient   : 工厂环境底噪（粉红噪声 + 低频嗡鸣），可循环
//   - startup   : 设备启动（频率上扫 100→400Hz，含轻微噪声）
//   - shutdown  : 设备停机（频率下扫 + 减振）
//   - alarmL1   : 警告（单次 880Hz 短鸣 200ms）
//   - alarmL2   : 严重（双声 880→1320Hz，类似"叮咚"）
//   - alarmL3   : 紧急（连续脉冲，类似消防铃）
//   - correct   : 操作正确（C5→E5 上行 150ms）
//   - wrong     : 操作错误（短促低频"嗡"200ms）
//   - slider    : 拖动反馈（极短 30ms 高频"嗒"）

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterVolume = 0.4; // 0~1，主音量
let muted = false;

// 环境音相关：循环节点引用，便于停止
interface AmbientHandle {
  noiseSrc: AudioBufferSourceNode;
  hum: OscillatorNode;
  gain: GainNode;
}
let ambientHandle: AmbientHandle | null = null;

/** 懒加载 AudioContext + 主音量节点（首次播放时由用户手势触发） */
function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : masterVolume;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn('[sound] AudioContext init failed', e);
      return null;
    }
  }
  // 浏览器可能因为自动播放策略把 ctx 置为 suspended，恢复一下
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
  return ctx;
}

/** 生成一段白噪声 AudioBuffer，时长 seconds 秒，单声道 */
function makeNoiseBuffer(seconds: number): AudioBuffer | null {
  const c = ensureCtx();
  if (!c) return null;
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // 粉红噪声近似：白噪声 + 低通滤波感，这里简化用白噪声后再交给 BiquadFilter
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** 设置主音量 0~1 */
function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  if (masterGain && !muted) {
    masterGain.gain.value = masterVolume;
  }
}

/** 静音（不停止音源，只把音量归零） */
function mute(): void {
  muted = true;
  if (masterGain) masterGain.gain.value = 0;
}

/** 取消静音 */
function unmute(): void {
  muted = false;
  if (masterGain) masterGain.gain.value = masterVolume;
}

function isMuted(): boolean {
  return muted;
}

/* ============================================================
 * 1. 工厂环境底噪（循环）
 * 粉红噪声 + 60Hz 低频嗡鸣 + 200Hz 共鸣，模拟大型机组运转
 * ========================================================= */
function playAmbient(): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  stopAmbient(); // 防止重复
  // 持续 4 秒的噪声循环源
  const buf = makeNoiseBuffer(4);
  if (!buf) return;
  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = buf;
  noiseSrc.loop = true;

  // 用低通过滤掉高频，听起来像远处机器声
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  lp.Q.value = 1.2;

  // 60Hz 电力嗡鸣
  const hum = c.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 60;

  // 整体环境音音量较低
  const ambGain = c.createGain();
  ambGain.gain.value = 0.18; // 占主音量的 18%

  noiseSrc.connect(lp).connect(ambGain);
  hum.connect(ambGain);
  ambGain.connect(masterGain);

  noiseSrc.start();
  hum.start();

  ambientHandle = { noiseSrc, hum, gain: ambGain };
}

function stopAmbient(): void {
  if (!ambientHandle) return;
  try {
    // 0.3s 渐弱，避免咔嚓
    const c = ensureCtx();
    if (c) {
      ambientHandle.gain.gain.setTargetAtTime(0, c.currentTime, 0.1);
    }
    setTimeout(() => {
      try {
        ambientHandle?.noiseSrc.stop();
        ambientHandle?.hum.stop();
      } catch {
        /* ignore */
      }
      ambientHandle = null;
    }, 400);
  } catch {
    ambientHandle = null;
  }
}

/* ============================================================
 * 2. 设备启动（频率上扫 + 噪声起步）
 * ========================================================= */
function playStartup(): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const dur = 1.6;
  // 主音：100Hz 缓慢爬升到 380Hz，模拟电机加速
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, now);
  lp.frequency.linearRampToValueAtTime(1500, now + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.35, now + 0.15);
  g.gain.setValueAtTime(0.35, now + dur - 0.2);
  g.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(lp).connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + dur);
}

/* ============================================================
 * 3. 设备停机（频率下扫）
 * ========================================================= */
function playShutdown(): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const dur = 1.4;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1500, now);
  lp.frequency.linearRampToValueAtTime(200, now + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, now);
  g.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(lp).connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + dur);
}

/* ============================================================
 * 4. 报警声：三档
 *    L1 警告 — 单次 880Hz 短鸣
 *    L2 严重 — 双声"叮咚" 880→1320Hz
 *    L3 紧急 — 连续 4 次 1000Hz 脉冲，类似消防铃
 * ========================================================= */
function beep(freq: number, startOffset: number, dur: number, vol = 0.5): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + startOffset;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;
  const g = c.createGain();
  // 短促包络：5ms 起音、保持、20ms 衰减，避免咔嚓
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
  g.gain.setValueAtTime(vol, t0 + dur - 0.02);
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(g).connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playAlarm(level: 1 | 2 | 3): void {
  if (level === 1) {
    beep(880, 0, 0.2, 0.45);
  } else if (level === 2) {
    beep(880, 0, 0.18, 0.5);
    beep(1320, 0.22, 0.22, 0.5);
  } else {
    // L3：4 次脉冲
    for (let i = 0; i < 4; i++) {
      beep(1000, i * 0.18, 0.12, 0.55);
    }
  }
}

/* ============================================================
 * 5. 操作反馈
 *    correct: C5 → E5 上行（523 → 659Hz）
 *    wrong:   180Hz 短促"嗡"
 *    slider:  4kHz 极短"嗒"
 * ========================================================= */
function playCorrect(): void {
  beep(523, 0, 0.08, 0.35);
  beep(659, 0.09, 0.14, 0.35);
}

function playWrong(): void {
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.linearRampToValueAtTime(140, now + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.35, now + 0.01);
  g.gain.linearRampToValueAtTime(0, now + 0.2);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.22);
}

function playSlider(): void {
  // 极轻"嗒"声，反馈拖动节奏
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 4000;
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.08, now + 0.002);
  g.gain.linearRampToValueAtTime(0, now + 0.03);
  osc.connect(g).connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.04);
}

export const soundService = {
  // 主控
  setMasterVolume,
  mute,
  unmute,
  isMuted,
  // 环境
  playAmbient,
  stopAmbient,
  // 设备
  playStartup,
  playShutdown,
  // 报警
  playAlarm,
  // 操作反馈
  playCorrect,
  playWrong,
  playSlider,
};
