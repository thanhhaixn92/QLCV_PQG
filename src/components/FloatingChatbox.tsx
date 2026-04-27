import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, Loader2, Trash2, Copy, Check, Sparkles, ExternalLink, Calendar, Tag, CheckSquare, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { ChatMessage, ChatSuggestedAction } from '../types';
import ReactMarkdown from 'react-markdown';

interface FloatingChatboxProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  input: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  loading: boolean;
  isAiReady: boolean;
  disabled?: boolean;
  disabledReason?: string;
  currentModel?: string;
  onClear?: () => void;
  onExecuteAction?: (action: ChatSuggestedAction) => void;
  onCreateTasks?: (messageIndex: number) => void;
  onToggleTaskDraft?: (messageIndex: number, clientId: string) => void;
  activeTab?: string;
}

export const FloatingChatbox: React.FC<FloatingChatboxProps> = ({
  isOpen,
  onToggle,
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  isAiReady,
  disabled = false,
  disabledReason,
  currentModel,
  onClear,
  onExecuteAction,
  onCreateTasks,
  onToggleTaskDraft,
  activeTab = 'home'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const getQuickPrompts = () => {
    switch (activeTab) {
      case 'home':
        return [
          { label: 'Tóm tắt công việc hôm nay', prompt: 'Tóm tắt tình hình công việc ngày hôm nay giúp tôi.' },
          { label: 'Việc nào quá hạn?', prompt: 'Liệt kê các công việc đang bị quá hạn.' }
        ];
      case 'tasks':
        return [
          { label: 'Việc ưu tiên cao nhất?', prompt: 'Trong danh sách này, việc nào quan trọng nhất cần xử lý ngay?' },
          { label: 'Phân tích tiến độ', prompt: 'Dựa vào danh sách công việc hiện tại, hãy phân tích tiến độ thực hiện.' }
        ];
      case 'library':
        return [
          { label: 'Tóm tắt tài liệu này', prompt: 'Hãy tóm tắt nội dung chính của tài liệu tôi đang chọn.' },
          { label: 'Tìm ý tưởng từ tư liệu', prompt: 'Dựa trên các tài liệu đã chọn, hãy gợi ý cho tôi vài ý tưởng mới.' }
        ];
      case 'editor':
        return [
          { label: 'Tạo dàn ý bài viết', prompt: 'Dựa vào thông tin này, hãy tạo cho tôi một dàn ý bài viết chi tiết.' },
          { label: 'Sửa lỗi diễn đạt', prompt: 'Hãy kiểm tra và sửa các lỗi diễn đạt trong đoạn văn này.' }
        ];
      default:
        return [
          { label: 'Gợi ý kế hoạch công việc', prompt: 'Gợi ý cho tôi một kế hoạch công việc hiệu quả.' },
          { label: 'Hoa Tiêu AI có thể làm gì?', prompt: 'Hoa Tiêu AI có thể giúp tôi những gì trong công việc?' }
        ];
    }
  };

  const quickPrompts = getQuickPrompts();

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success('Đã sao chép nội dung');
    } catch {
      toast.error('Lỗi sao chép');
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        id="vms-chat-toggle"
        onClick={onToggle}
        className={cn(
          "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-[70] transition-colors",
          isOpen ? "bg-slate-800 text-white" : "bg-[#002D56] text-white"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && (
          <>
            {isAiReady ? (
              messages.length === 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-sm"></span>
                </span>
              )
            ) : (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-sm" />
            )}
          </>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 sm:right-6 w-[calc(100vw-40px)] sm:w-[400px] h-[500px] max-h-[calc(100dvh-7rem)] bg-white rounded-[32px] shadow-2xl z-[90] flex flex-col overflow-hidden border border-slate-200"
          >
            {/* Header */}
            <div className="p-5 bg-[#002D56] text-white flex items-center justify-between shrink-0 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Bot className={cn("w-5 h-5", isAiReady ? "text-emerald-400" : "text-rose-400")} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight">Trợ lý Hoa Tiêu MIỀN BẮC</h4>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isAiReady ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                    )} />
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none">
                      {isAiReady ? 'AI đang sẵn sàng' : 'AI ngoại tuyến'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                 {onClear && messages.length > 0 && (
                  <button 
                    onClick={onClear}
                    title="Xóa hội thoại"
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white disabled:opacity-30"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={onToggle}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar bg-slate-50/50"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 bg-[#002D56]/5 rounded-[24px] flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-[#002D56]/20" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 font-mono">XIN CHÀO!</p>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                    Tôi là Hoa Tiêu AI. Hãy hỏi tôi về công việc, tóm tắt tài liệu hoặc soạn thảo văn bản giúp bạn.
                  </p>
                  {isAiReady && (
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                       {quickPrompts.map(qp => (
                         <button 
                           key={qp.label}
                           onClick={() => onInputChange(qp.prompt)}
                           className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-[#002D56] hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-1.5"
                         >
                           <Sparkles className="w-3 h-3 text-emerald-500" />
                           {qp.label}
                         </button>
                       ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "flex items-center gap-2 mb-1",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}>
                    <div className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                      msg.role === 'user' ? "bg-slate-200" : "bg-[#002D56]"
                    )}>
                      {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-slate-500" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      {msg.role === 'user' ? 'Bạn' : 'Hoa Tiêu AI'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 max-w-[90%]">
                    <div className={cn(
                      "px-4 py-3 rounded-[20px] text-xs font-medium leading-relaxed shadow-sm whitespace-pre-wrap break-words",
                      msg.role === 'user' 
                        ? "bg-[#002D56] text-white rounded-tr-none" 
                        : "bg-white text-slate-700 rounded-tl-none border border-slate-100"
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-[#002D56]">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="text-xs leading-6 text-slate-700 mb-2">{children}</p>,
                              strong: ({ children }) => <strong className="font-black text-[#002D56]">{children}</strong>,
                              ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>,
                              li: ({ children }) => <li className="text-xs leading-5 text-slate-700">{children}</li>,
                              code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700">{children}</code>
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>

                    {msg.role === 'assistant' && msg.taskDrafts && msg.taskDrafts.length > 0 && (
                      <div className="mt-3 space-y-3 w-full animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Công việc AI đề xuất - cần duyệt
                        </div>
                        {msg.taskDrafts.map(draft => (
                          <div key={draft.clientId} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={draft.selected !== false}
                                onChange={() => onToggleTaskDraft?.(i, draft.clientId)}
                                className="mt-1 w-4 h-4 rounded text-[#002D56] border-slate-300"
                              />
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-black text-[#002D56] leading-5">{draft.title}</h5>
                                <p className="text-[11px] text-slate-500 leading-normal mt-1">{draft.description}</p>

                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[9px] font-black uppercase tracking-tight">
                                    <Tag className="w-2.5 h-2.5" />
                                    {draft.categoryName || draft.categoryCode}
                                  </span>
                                  <span className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight",
                                    draft.priority === 'urgent' ? "bg-rose-50 text-rose-700" :
                                    draft.priority === 'high' ? "bg-orange-50 text-orange-700" :
                                    "bg-slate-50 text-slate-600"
                                  )}>
                                    {draft.priority === 'urgent' ? 'Khẩn cấp' : draft.priority === 'high' ? 'Cao' : draft.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                                  </span>
                                  {draft.dueDate && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-tight">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {draft.dueDate}
                                    </span>
                                  )}
                                </div>

                                {draft.checklist && draft.checklist.length > 0 && (
                                  <div className="mt-4 bg-slate-50/80 rounded-xl p-3 border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-[#002D56]/40 mb-2 flex items-center gap-1.5">
                                      <CheckSquare className="w-2.5 h-2.5" />
                                      Checklist chi tiết
                                    </p>
                                    <div className="space-y-1.5">
                                      {draft.checklist.map(item => (
                                        <div key={item.id} className="flex items-start gap-2.5">
                                          <div className="w-3.5 h-3.5 rounded border border-slate-300 mt-0.5 shrink-0" />
                                          <span className="text-[10px] text-slate-600 font-bold leading-relaxed">{item.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => onCreateTasks?.(i)}
                          className="w-full bg-[#002D56] text-white rounded-2xl py-3 text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/10 hover:shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Tạo {msg.taskDrafts.filter(d => d.selected !== false).length} công việc đã chọn
                        </button>
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="flex flex-col gap-2 mt-1 px-1">
                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {msg.suggestedActions.map((action, actionIdx) => (
                              <button
                                key={actionIdx}
                                onClick={() => onExecuteAction?.(action)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
                              >
                                {action.label}
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-start">
                          <button 
                            onClick={() => handleCopy(msg.content, i)}
                            className="p-1.5 text-slate-400 hover:text-[#002D56] transition-colors rounded-lg hover:bg-slate-100"
                            title="Sao chép"
                          >
                            {copiedIndex === i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex flex-col items-start gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-[#002D56] flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Hoa Tiêu AI</span>
                  </div>
                  <div className="bg-white px-4 py-3 rounded-[20px] rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#002D56] animate-spin" />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Đang suy nghĩ...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              {(disabledReason || !isAiReady) && (
                <div className={cn(
                  "mb-3 p-3 border rounded-xl flex items-center gap-2",
                  disabledReason ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-rose-50 border-rose-100 text-rose-600"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", disabledReason ? "bg-amber-500" : "bg-rose-500")} />
                  <p className="text-[9px] font-bold uppercase tracking-tight leading-tight">
                    {disabledReason || 'AI đang ngoại tuyến. Hãy thiết lập Key cá nhân trong Cài đặt nếu cần.'}
                  </p>
                </div>
              )}
              <div className="relative group">
                <input 
                  type="text"
                  value={input}
                  onChange={e => onInputChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !disabled && isAiReady && !loading && input.trim()) {
                      onSend();
                    }
                  }}
                  disabled={disabled || loading}
                  placeholder={disabledReason ? disabledReason : (disabled || !isAiReady) ? "AI chưa sẵn sàng..." : loading ? "AI đang trả lời..." : "Hỏi Hoa Tiêu AI..."}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-5 pr-14 py-3.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10 transition-all disabled:opacity-50"
                />
                <button 
                  onClick={onSend}
                  disabled={disabled || !isAiReady || !input.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#002D56] text-white rounded-xl hover:shadow-lg disabled:opacity-30 disabled:grayscale transition-all active:scale-90"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[8px] text-center text-slate-400 font-bold uppercase tracking-[0.1em] mt-3">
                Đang dùng: {currentModel || 'Gemini'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
