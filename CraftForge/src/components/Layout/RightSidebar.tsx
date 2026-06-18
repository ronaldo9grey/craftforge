import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Volume2, VolumeX, User, Bot, Sparkles } from 'lucide-react';
import { useAIStore } from '@/stores/aiStore';
import { useUIStore } from '@/stores/uiStore';
import { useEquipmentStore } from '@/stores/equipmentStore';

export const RightSidebar: React.FC = () => {
  const messages = useAIStore((state) => state.messages);
  const avatarMood = useAIStore((state) => state.avatarMood);
  const voiceEnabled = useAIStore((state) => state.voiceEnabled);
  const isProcessing = useAIStore((state) => state.isProcessing);
  const toggleVoice = useAIStore((state) => state.toggleVoice);
  const selectEquipment = useUIStore((state) => state.selectEquipment);
  const equipments = useEquipmentStore((state) => state.equipments);

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 上一帧 isProcessing 用于检测"true → false"的下降沿，触发语音合成
  const prevProcessingRef = useRef<boolean>(isProcessing);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 流式结束时（isProcessing 由 true 变 false）自动朗读最新一条 ai 消息
  useEffect(() => {
    if (prevProcessingRef.current && !isProcessing) {
      // 找到最后一条 ai 消息
      const latestAi = [...messages].reverse().find((m) => m.role === 'ai');
      if (voiceEnabled && latestAi?.content) {
        speak(latestAi.content);
      }
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing, messages, voiceEnabled]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    // 使用流式问答；askCoachAsync 内部完成 user 消息写入、占位 ai 消息、流式追加、降级
    void useAIStore.getState().askCoachAsync(userMessage);
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      speechSynthesis.speak(utterance);
    }
  };

  const handleEquipmentRef = (equipmentName: string) => {
    const equipment = equipments.find((e) => 
      e.name.includes(equipmentName) || equipmentName.includes(e.name)
    );
    if (equipment) {
      selectEquipment(equipment.id);
    }
  };

  const getAvatarColor = () => {
    switch (avatarMood) {
      case 'calm': return '#3b82f6';
      case 'thinking': return '#f59e0b';
      case 'alert': return '#ef4444';
      case 'guiding': return '#10b981';
      case 'praising': return '#10b981';
      default: return '#3b82f6';
    }
  };

  const getAvatarAnimation = () => {
    switch (avatarMood) {
      case 'calm': return 'animate-breathe';
      case 'alert': return 'animate-alert';
      default: return '';
    }
  };

  // 右侧边栏始终显示，不再支持关闭
  return (
    <div className="w-80 bg-bg-secondary border-l border-border flex flex-col h-full">
      {/* 数字人头像区域 */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${getAvatarAnimation()}`}
              style={{ backgroundColor: `${getAvatarColor()}30`, border: `2px solid ${getAvatarColor()}` }}
            >
              {avatarMood === 'alert' ? '◣◢' : '◠◠'}
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-bg-secondary"
              style={{ backgroundColor: getAvatarColor() }}
            />
          </div>
          <h3 className="mt-2 font-medium text-text-primary">王师傅</h3>
          <p className="text-xs text-text-secondary">高级工艺师</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={toggleVoice}
              className={`p-1.5 rounded-md transition-colors ${
                voiceEnabled ? 'bg-primary text-white' : 'bg-bg-tertiary text-text-muted'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <span className="text-xs text-text-muted">
              {voiceEnabled ? '语音开启' : '语音关闭'}
            </span>
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
