import React, { useEffect, useRef, useState, memo } from 'react';
import './avatar.css';

/* ===========================================================
 * 老张数字人 SVG 头像组件
 * - 5 种表情（calm / thinking / alert / guiding / praising）
 * - 自动眨眼（随机 3000-4500ms）
 * - 讲话口型动画（speaking=true 时 4 帧 150ms 循环）
 * - 呼吸 / 摇摆 / 光晕 全部 CSS 关键帧驱动
 * =========================================================== */

export type AvatarMood = 'calm' | 'thinking' | 'alert' | 'guiding' | 'praising';

export interface AvatarOldZhangProps {
  /** 心情，决定背景色、眉毛、嘴形等表情 */
  mood: AvatarMood;
  /** 是否讲话中（嘴巴动画） */
  speaking: boolean;
  /** 像素尺寸，默认 96 */
  size?: number;
  /**
   * 外部驱动的嘴型强度（0=闭，1=半开，2=全开）
   * 由 TTS 字级时间戳事件实时更新，未传时退回内部 4 帧 150ms 循环
   */
  mouthIntensity?: 0 | 1 | 2;
}

/* ---------------- 颜色常量（统一变量） ---------------- */
const COLOR = {
  skin: '#f4c4a3',
  skinDark: '#d99877',
  helmet: '#f5c518',
  helmetEdge: '#caa00f',
  jacketRed: '#d3473a',
  jacketBlue: '#2c4f8c',
  hair: '#4a3b32',
  stubble: '#6b5a4f',
  mouth: '#b54b4f',
  eyeWhite: '#ffffff',
  eyeBlack: '#1f2937',
  brow: '#3b2a23',
  sinopecGreen: '#0a8f4f',
  helmetInner: '#1a1a1a',
};

/* mood -> 背景圆颜色（与 ScoreBoard / Tailwind 主题色一致） */
const MOOD_BG: Record<AvatarMood, string> = {
  calm:     '#3b82f6',
  thinking: '#f59e0b',
  alert:    '#ef4444',
  guiding:  '#10b981',
  praising: '#fbbf24',
};

/* ---------------- 嘴巴 4 帧（讲话） ---------------- */
const MOUTH_FRAMES = [
  // 0 闭嘴：平直短线
  'M44 70 Q50 71 56 70',
  // 1 半开：椭圆半开
  'M44 69 Q50 73 56 69 Q50 72 44 69 Z',
  // 2 全开：O 形
  'M43 68 Q50 76 57 68 Q50 74 43 68 Z',
  // 3 半开
  'M44 69 Q50 73 56 69 Q50 72 44 69 Z',
];

/* ---------------- 静态嘴形（按 mood） ---------------- */
const MOUTH_STATIC: Record<AvatarMood, string> = {
  calm:     'M44 70 Q50 71.5 56 70',
  thinking: 'M45 71 Q50 70 55 71',
  alert:    'M45 71 Q50 73 55 71',
  guiding:  'M43 69 Q50 74 57 69',          // 微笑
  praising: 'M41 68 Q50 78 59 68 Q50 75 41 68 Z', // 大笑
};

/* ---------------- 眉毛（按 mood） ---------------- */
interface BrowSpec {
  left: string;
  right: string;
}
const BROWS: Record<AvatarMood, BrowSpec> = {
  calm:     { left: 'M37 50 Q41 48 45 50', right: 'M55 50 Q59 48 63 50' },
  // 中间靠近 + 浅皱
  thinking: { left: 'M38 51 Q42 49 46 51', right: 'M54 51 Q58 49 62 51' },
  // 压低 + 深皱
  alert:    { left: 'M37 53 Q41 50 46 53', right: 'M54 53 Q59 50 63 53' },
  guiding:  { left: 'M37 50 Q41 48 45 50', right: 'M55 50 Q59 48 63 50' },
  praising: { left: 'M37 50 Q41 48 45 50', right: 'M55 50 Q59 48 63 50' },
};

/* ---------------- 眼睛（按 mood + blink） ---------------- */
/** 是否闭眼成 ^^ */
function isEyeClosed(mood: AvatarMood, blink: boolean): boolean {
  if (mood === 'praising') return true; // 笑成 ^^
  if (mood === 'alert') return false;   // 瞪大不眨
  return blink;
}

/** 瞳孔半径（alert 放大） */
function pupilRadius(mood: AvatarMood): number {
  return mood === 'alert' ? 1.7 : 1.2;
}

/* ---------------- 主组件 ---------------- */
const AvatarOldZhangInner: React.FC<AvatarOldZhangProps> = ({
  mood,
  speaking,
  size = 96,
  mouthIntensity,
}) => {
  // 眨眼 / 闭眼相位
  const [blink, setBlink] = useState(false);
  // 讲话口型帧 0~3
  const [mouthFrame, setMouthFrame] = useState(0);
  const blinkTimer = useRef<number | null>(null);
  const speakTimer = useRef<number | null>(null);

  /* 眨眼：随机 3000-4500ms 触发，alert/praising 暂停 */
  useEffect(() => {
    if (mood === 'alert' || mood === 'praising') {
      setBlink(false);
      return;
    }
    let cancelled = false;
    const schedule = () => {
      const delay = 3000 + Math.random() * 1500;
      blinkTimer.current = window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        window.setTimeout(() => {
          if (cancelled) return;
          setBlink(false);
          schedule();
        }, 120);
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (blinkTimer.current !== null) {
        clearTimeout(blinkTimer.current);
        blinkTimer.current = null;
      }
    };
  }, [mood]);

  /* 讲话口型 4 帧 150ms 循环（仅当外部未提供 mouthIntensity 时启用） */
  useEffect(() => {
    if (!speaking || mouthIntensity !== undefined) {
      setMouthFrame(0);
      return;
    }
    let frame = 0;
    speakTimer.current = window.setInterval(() => {
      frame = (frame + 1) % MOUTH_FRAMES.length;
      setMouthFrame(frame);
    }, 150);
    return () => {
      if (speakTimer.current !== null) {
        clearInterval(speakTimer.current);
        speakTimer.current = null;
      }
    };
  }, [speaking, mouthIntensity]);

  const bgColor = MOOD_BG[mood];
  // 嘴形优先级：1. 外部 mouthIntensity（TTS 驱动，最精确）
  //             2. speaking 时内部循环帧
  //             3. 静态表情嘴形
  let mouthD: string;
  if (speaking && mouthIntensity !== undefined) {
    // 0=闭嘴帧0，1=半开帧1，2=全开帧2
    mouthD = MOUTH_FRAMES[mouthIntensity === 0 ? 0 : mouthIntensity === 1 ? 1 : 2];
  } else if (speaking) {
    mouthD = MOUTH_FRAMES[mouthFrame];
  } else {
    mouthD = MOUTH_STATIC[mood];
  }
  const eyesClosed = isEyeClosed(mood, blink);
  const pupilR = pupilRadius(mood);
  const brow = BROWS[mood];

  /* 背景圆透明度 30% / 外环 60% */
  const bgFill = bgColor + '4D';   // 30%
  const ringStroke = bgColor + '99'; // 60%

  return (
    <div
      className={`oz-breathe-${mood}`}
      style={{ width: size, height: size, lineHeight: 0 }}
      aria-label="数字人老张"
      role="img"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 1. 背景圆 + 外环 */}
        <circle cx="50" cy="50" r="44" fill={bgFill} />
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={ringStroke}
          strokeWidth="1.5"
          className={`oz-ring-${mood}`}
        />

        {/* 表扬态：4 颗闪烁星点 */}
        {mood === 'praising' && (
          <g fill="#ffffff" stroke="#fbbf24" strokeWidth="0.4">
            <polygon className="oz-star oz-star-1" points="18,22 19.2,25 22.4,25 19.8,27 20.8,30 18,28.2 15.2,30 16.2,27 13.6,25 16.8,25" />
            <polygon className="oz-star oz-star-2" points="82,24 83,26.4 85.6,26.4 83.5,28 84.4,30.4 82,28.9 79.6,30.4 80.5,28 78.4,26.4 81,26.4" />
            <polygon className="oz-star oz-star-3" points="14,62 15,64 17,64 15.5,65.4 16,67.4 14,66.2 12,67.4 12.5,65.4 11,64 13,64" />
            <polygon className="oz-star oz-star-4" points="86,64 87,66 89,66 87.5,67.4 88,69.4 86,68.2 84,69.4 84.5,67.4 83,66 85,66" />
          </g>
        )}

        {/* 2. 工装上衣（红蓝拼色，靠下） */}
        <g>
          {/* 蓝色主体 */}
          <path
            d="M22 92 Q22 78 38 74 L62 74 Q78 78 78 92 L78 100 L22 100 Z"
            fill={COLOR.jacketBlue}
          />
          {/* 红色肩部点缀（左） */}
          <path
            d="M22 92 Q22 80 32 76 L38 78 L34 90 Z"
            fill={COLOR.jacketRed}
          />
          {/* 红色肩部点缀（右） */}
          <path
            d="M78 92 Q78 80 68 76 L62 78 L66 90 Z"
            fill={COLOR.jacketRed}
          />
          {/* 领口暗影 */}
          <path d="M42 74 Q50 80 58 74 L58 78 Q50 82 42 78 Z" fill="#1c3a6c" />
        </g>

        {/* 3-11. 头部组（受 mood 摇摆） */}
        <g className={`oz-head ${mood}`}>
          {/* 3. 颈部 */}
          <rect x="44" y="70" width="12" height="8" fill={COLOR.skinDark} />
          <rect x="44" y="70" width="12" height="3" fill={COLOR.skin} />

          {/* 5. 耳朵（先画在脸下层） */}
          <ellipse cx="29" cy="55" rx="2.5" ry="4" fill={COLOR.skin} />
          <ellipse cx="71" cy="55" rx="2.5" ry="4" fill={COLOR.skin} />

          {/* 4. 头部脸蛋（圆角矩形） */}
          <rect
            x="30"
            y="38"
            width="40"
            height="36"
            rx="14"
            ry="14"
            fill={COLOR.skin}
          />

          {/* 6. 头发（露在帽檐下方） */}
          <path
            d="M30 48 Q33 44 38 44 L62 44 Q67 44 70 48 L70 50 Q60 47 50 47 Q40 47 30 50 Z"
            fill={COLOR.hair}
          />
          {/* 鬓角 */}
          <path d="M30 50 Q31 56 33 58 L33 52 Z" fill={COLOR.hair} />
          <path d="M70 50 Q69 56 67 58 L67 52 Z" fill={COLOR.hair} />

          {/* 7. 眉毛 */}
          <path
            d={brow.left}
            stroke={COLOR.brow}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={brow.right}
            stroke={COLOR.brow}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* 8. 眼睛 */}
          {eyesClosed ? (
            // 闭眼 ^^（praising）或眨眼横线
            mood === 'praising' ? (
              <g stroke={COLOR.eyeBlack} strokeWidth="1.6" strokeLinecap="round" fill="none">
                <path d="M37 57 Q41 54 45 57" />
                <path d="M55 57 Q59 54 63 57" />
              </g>
            ) : (
              <g stroke={COLOR.eyeBlack} strokeWidth="1.6" strokeLinecap="round">
                <line x1="37" y1="57" x2="45" y2="57" />
                <line x1="55" y1="57" x2="63" y2="57" />
              </g>
            )
          ) : (
            <g>
              {/* 眼白 */}
              <ellipse cx="41" cy="57" rx="3.2" ry="2.4" fill={COLOR.eyeWhite} />
              <ellipse cx="59" cy="57" rx="3.2" ry="2.4" fill={COLOR.eyeWhite} />
              {/* 瞳孔 */}
              <circle cx="41" cy="57" r={pupilR} fill={COLOR.eyeBlack} />
              <circle cx="59" cy="57" r={pupilR} fill={COLOR.eyeBlack} />
              {/* 高光 */}
              <circle cx="42" cy="56.2" r="0.5" fill="#ffffff" />
              <circle cx="60" cy="56.2" r="0.5" fill="#ffffff" />
            </g>
          )}

          {/* 9. 鼻子（简笔） */}
          <path
            d="M50 60 Q49 64 50 66 Q51 64 50 60"
            fill={COLOR.skinDark}
            opacity="0.7"
          />
          <path
            d="M48 66 Q50 67 52 66"
            stroke={COLOR.skinDark}
            strokeWidth="0.6"
            fill="none"
          />

          {/* 10. 嘴巴 */}
          <path
            d={mouthD}
            stroke={COLOR.mouth}
            strokeWidth="1.6"
            strokeLinecap="round"
            fill={mouthD.endsWith('Z') ? COLOR.mouth : 'none'}
          />

          {/* 11. 胡茬（点状灰，下巴一片） */}
          <g fill={COLOR.stubble} opacity="0.55">
            <circle cx="42" cy="70" r="0.45" />
            <circle cx="45" cy="71.5" r="0.45" />
            <circle cx="48" cy="72" r="0.45" />
            <circle cx="51" cy="72.2" r="0.45" />
            <circle cx="54" cy="71.8" r="0.45" />
            <circle cx="57" cy="71" r="0.45" />
            <circle cx="44" cy="68.5" r="0.4" />
            <circle cx="50" cy="69" r="0.4" />
            <circle cx="56" cy="68.5" r="0.4" />
          </g>

          {/* 12. 安全帽（最上层） */}
          <g>
            {/* 帽内黑边 */}
            <path
              d="M27 44 Q27 27 50 27 Q73 27 73 44 L73 46 L27 46 Z"
              fill={COLOR.helmetInner}
            />
            {/* 黄色半圆主体 */}
            <path
              d="M28 43 Q28 28 50 28 Q72 28 72 43 Z"
              fill={COLOR.helmet}
            />
            {/* 帽檐 */}
            <rect x="24" y="43" width="52" height="3.2" rx="1.2" fill={COLOR.helmet} />
            <rect x="24" y="45" width="52" height="1.2" fill={COLOR.helmetEdge} />
            {/* 中石化绿色 logo 圆点 */}
            <circle cx="50" cy="36" r="3" fill={COLOR.sinopecGreen} />
            <circle cx="50" cy="36" r="1.2" fill="#ffffff" />
          </g>
        </g>
      </svg>
    </div>
  );
};

/** memo 化，避免 RightSidebar 其它 state 变化引起重渲 */
export const AvatarOldZhang = memo(AvatarOldZhangInner);
AvatarOldZhang.displayName = 'AvatarOldZhang';

export default AvatarOldZhang;
