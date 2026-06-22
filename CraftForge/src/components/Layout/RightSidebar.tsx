import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Volume2, VolumeX, User, Bot, Sparkles } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';
import { AvatarOldZhang } from '@/components/AI/AvatarOldZhang';
import { ttsService } from '@/services/ttsService';
import { getCoachName, getCoachTitle, getCoachGreeting } from '@/services/aiCoach';

/** 把长文本按中文句号 / 问号 / 感叹号切句；过长再按逗号细切，确保 ≤140 字 */
function splitToSentences(text: string, maxLen = 140): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const raw = cleaned.match(/[^。！？\n.!?]+[。！？.!?]?/g) || [cleaned];
  const out: string[] = [];
  for (const s of raw) {
    const t = s.trim();
    if (!t) continue;
    if (t.length <= maxLen) {
      out.push(t);
    } else {
      // 再按逗号切
      const sub = t.split(/[，,；;]/).map((x) => x.trim()).filter(Boolean);
      let buf = '';
      for (const piece of sub) {
        if ((buf + piece).length > maxLen) {
          if (buf) out.push(buf);
          buf = piece;
        } else {
          buf = buf ? `${buf}，${piece}` : piece;
        }
      }
      if (buf) out.push(buf);
    }
  }
  return out;
}

export const RightSidebar: React.FC = () => {
  const messages = useAIStore((state) => state.messages);
  const avatarMood = useAIStore((state) => state.avatarMood);
  const voiceEnabled = useAIStore((state) => state.voiceEnabled);
  const isProcessing = useAIStore((state) => state.isProcessing);
  const ttsRequest = useAIStore((state) => state.ttsRequest);
  const toggleVoice = useAIStore((state) => state.toggleVoice);
  const selectEquipment = useUIStore((state) => state.selectEquipment);
  const equipments = useEquipmentStore((state) => state.equipments);

  const [inputValue, setInputValue] = useState('');
  // 老张是否正在朗读（独立于 isProcessing；流式结束后才开始朗读）
  const [isSpeaking, setIsSpeaking] = useState(false);
  // 嘴型强度：由 TTS 字级时间戳事件实时更新
  const [mouthIntensity, setMouthIntensity] = useState<0 | 1 | 2>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 记录已处理过的 ttsRequest.seq，避免重复朗读（同一 seq 只播一次）
  const lastSeqRef = useRef<number>(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * 朗读一整段文本（自动切句，逐句排队入 ttsService.enqueue）
   * 多次调用会按调用顺序串行播放，绝不抢嘴
   * 字级时间戳 -> mouthIntensity；任何一段开始时 isSpeaking=true，全部播完才 false
   */
  const speak = (text: string) => {
    const sentences = splitToSentences(text);
    if (sentences.length === 0) return;
    sentences.forEach((sentence, idx) => {
      const isLast = idx === sentences.length - 1;
      let openIdx = 0;
      ttsService.enqueue({
        text: sentence,
        onStart: () => setIsSpeaking(true),
        onBoundary: () => {
          // 0、1、2 三档循环：闭 → 半 → 全 → 半 → 闭…
          const seq: (0 | 1 | 2)[] = [1, 2, 1, 0];
          setMouthIntensity(seq[openIdx % seq.length]);
          openIdx++;
        },
        onEnd: () => {
          setMouthIntensity(0);
          // 队列里还有内容时不要把 isSpeaking 设回 false，避免头像闪烁
          if (isLast && !ttsService.isBusy()) {
            setIsSpeaking(false);
          }
        },
        onError: (msg) => {
          console.warn('[TTS] enqueue failed', msg);
          setMouthIntensity(0);
          if (isLast && !ttsService.isBusy()) {
            setIsSpeaking(false);
          }
        },
      });
    });
  };

  // 监听 ttsRequest：seq 变更即触发朗读，覆盖所有场景（聊天回复、演练开场白、讲评、点拨等）
  useEffect(() => {
    if (!voiceEnabled) return;
    if (!ttsRequest) return;
    if (ttsRequest.seq <= lastSeqRef.current) return;
    lastSeqRef.current = ttsRequest.seq;
    void speak(ttsRequest.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsRequest, voiceEnabled]);

  // 关闭语音开关时，立即清空队列并停止当前正在播放的会话
  useEffect(() => {
    if (!voiceEnabled) {
      ttsService.clearQueue();
      setIsSpeaking(false);
      setMouthIntensity(0);
    }
  }, [voiceEnabled]);

  // 组件卸载时清空队列
  useEffect(() => {
    return () => {
      ttsService.clearQueue();
    };
  }, []);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    // 使用流式问答；askCoachAsync 内部完成 user 消息写入、占位 ai 消息、流式追加、降级
    void useAIStore.getState().askCoachAsync(userMessage);
  };

  const handleEquipmentRef = (equipmentName: string) => {
    const equipment = equipments.find((e) => 
      e.name.includes(equipmentName) || equipmentName.includes(e.name)
    );
    if (equipment) {
      selectEquipment(equipment.id);
    }
  };

  // 数字人头像：流式中显示"思考态"循环嘴型，朗读中显示精确字级嘴型
  const speakingForAvatar = isSpeaking || isProcessing;

  // 右侧边栏始终显示，不再支持关闭
  return (
    <div className="w-80 bg-bg-secondary border-l border-border flex flex-col h-full">
      {/* 数字人头像区域 - 老张 SVG 形象 */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-col items-center">
          <AvatarOldZhang
            mood={avatarMood}
            speaking={speakingForAvatar}
            size={96}
            mouthIntensity={isSpeaking ? mouthIntensity : undefined}
          />
          <h3 className="mt-2 font-medium text-text-primary">{getCoachName()}</h3>
          <p className="text-xs text-text-secondary">{getCoachTitle()}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={toggleVoice}
              className={`p-1.5 rounded-md transition-colors ${
                voiceEnabled ? 'bg-primary text-white' : 'bg-bg-tertiary text-text-muted'
              }`}
              title={voiceEnabled ? '点击关闭语音' : '点击开启语音'}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <span className="text-xs text-text-muted">
              {voiceEnabled ? '语音开启' : '语音关闭'}
            </span>
            {/* 试听按钮：方便用户主动触发，同时满足浏览器自动播放策略 */}
            <button
              onClick={() => {
                void speak(getCoachGreeting());
              }}
              disabled={!voiceEnabled || isSpeaking}
              className="px-2 py-1 text-xs rounded-md bg-bg-tertiary hover:bg-primary/20 text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="点击试听师傅的声音"
            >
              试听
            </button>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.role === 'user' ? 'bg-bg-tertiary' : 'bg-primary/20'
            }`}>
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-text-secondary" />
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              message.role === 'user'
                ? 'bg-primary text-white'
                : 'bg-bg-tertiary text-text-primary'
            }`}>
              {message.content}
              {message.equipmentRefs && message.equipmentRefs.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {message.equipmentRefs.map((ref) => (
                    <button
                      key={ref}
                      onClick={() => handleEquipmentRef(ref)}
                      className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {ref}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div className="bg-bg-tertiary p-3 rounded-lg">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 - 高度跟随中央演练面板（CSS 变量 --bottom-bar-h），保持三栏底部对齐 */}
      <div
        className="flex-shrink-0 px-3 flex items-center gap-2 border-t border-border"
        style={{ height: 'var(--bottom-bar-h, 64px)' }}
      >
        <button
          className="p-2 text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
          title="上传工艺文档"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入工艺问题..."
          className="flex-1 min-w-0 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || isProcessing}
          className="p-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
