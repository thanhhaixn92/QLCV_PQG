import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, Loader2, Trash2, Copy, Check, Sparkles, ExternalLink, Calendar, Tag, CheckSquare, Plus, Paperclip, File, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { ChatMessage, ChatSuggestedAction, ChatAttachment } from '../types';
import ReactMarkdown from 'react-markdown';

interface FloatingChatboxProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  input: string;
  onInputChange: (val: string) => void;
  onSend: (attachments?: ChatAttachment[]) => void;
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
  onUploadAttachment?: (file: File, onStatusUpdate?: (status: any) => void) => Promise<ChatAttachment>;
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
  activeTab = 'home',
  onUploadAttachment
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    if (attachments.length + files.length > 3) {
      toast.error('Chỉ được đính kèm tối đa 3 tệp mỗi lượt.');
      return;
    }

    if (!onUploadAttachment) {
      toast.error('Chức năng đính kèm chưa sẵn sàng.');
      return;
    }

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Tệp ${file.name} vượt quá 10MB.`);
        continue;
      }
      
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newAtt = {
        id: tempId,
        name: file.name,
        originalName: file.name,
        status: 'uploading',
        contentStatus: 'pending',
        mimeType: file.type || 'application/octet-stream',
        extension: file.name.split('.').pop()?.toLowerCase() || '',
        size: file.size,
        ownerId: '',
        storagePath: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      } as ChatAttachment;

      setAttachments(prev => [...prev, newAtt]);

      try {
        const att = await onUploadAttachment(file, (status) => {
          setAttachments(prev => prev.map(a => 
            a.id === tempId ? { ...a, status } : a
          ));
        });
        setAttachments(prev => prev.map(a => 
          a.id === tempId ? { ...att, status: att.status === 'error' ? 'error' : 'ready' } : a
        ));
      } catch (err: any) {
        setAttachments(prev => prev.map(a => 
          a.id === tempId ? { ...a, status: 'error', errorMessage: err.message, contentStatus: 'error' } : a
        ));
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Chat Attachments]', attachments.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        contentStatus: a.contentStatus
      })));
    }
  }, [attachments]);

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const hasPendingAttachment = attachments.some(a => ['uploading', 'uploaded', 'extracting', 'analyzing'].includes(a.status));
  const hasUsableAttachment = attachments.some(a => ['ready', 'extracted', 'summary_only', 'metadata_only'].includes(a.status));
  const hasText = input.trim().length > 0;
  const canSend = !loading && !hasPendingAttachment && (hasText || hasUsableAttachment);

  const handleSendWithAttachments = () => {
    if (!canSend || disabled) return;
    onSend(attachments.length > 0 ? attachments.filter(a => a.status !== 'error') : undefined);
    setAttachments([]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

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
                      "px-4 py-3 rounded-[20px] font-medium shadow-sm whitespace-pre-wrap break-words",
                      msg.role === 'user' 
                        ? "bg-[#002D56] text-white rounded-tr-none leading-[1.55] text-[14px]" 
                        : "bg-white text-slate-700 rounded-tl-none border border-slate-100 leading-[1.65] text-[14px] space-y-2"
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-strong:text-[#002D56]">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0 leading-[1.65] text-[14px]">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-[#002D56]">{children}</strong>,
                              ul: ({ children }) => <ul className="my-2 list-disc pl-5 space-y-1 text-[14px] leading-[1.6]">{children}</ul>,
                              ol: ({ children }) => <ol className="my-2 list-decimal pl-5 space-y-1 text-[14px] leading-[1.6]">{children}</ol>,
                              li: ({ children, ...props }) => (
                                <li className="leading-[1.6] pl-1 marker:text-slate-400" {...props}>
                                  {children}
                                </li>
                              ),
                              code: ({ children, ...props }: any) => {
                                const match = /language-(\w+)/.exec(props.className || '');
                                const isInline = !match && !props.node?.properties?.className?.includes('language-');
                                if (isInline) {
                                  return <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px] font-mono mx-0.5 text-slate-800" {...props}>{children}</code>;
                                }
                                return <code className="text-[13px] font-mono leading-[1.6]" {...props}>{children}</code>;
                              },
                              pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[13px] leading-[1.6] text-white shadow-sm">{children}</pre>
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <>
                          {msg.content}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {msg.attachments.map(att => (
                                <div key={att.id} className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/30 py-1.5 px-3 rounded-xl max-w-full">
                                  <File className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                                  <span className="text-[11px] font-bold text-blue-100 truncate">{att.originalName || att.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {msg.role === 'assistant' && msg.taskDrafts && msg.taskDrafts.length > 0 && (
                      <div className="mt-3 space-y-3 w-full animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Công việc AI đề xuất - cần duyệt
                        </div>
                        {msg.taskDrafts.map((draft, dIdx) => (
                          <div key={`${draft.clientId}-${dIdx}`} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
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
                                      {draft.checklist.map((item, itemIdx) => (
                                        <div key={`${item.id}-${itemIdx}`} className="flex items-start gap-2.5">
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

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 bg-blue-50 border border-blue-100 py-1.5 px-3 rounded-xl max-w-full">
                      {(att.status === 'uploading' || att.contentStatus === 'pending' || att.contentStatus === 'extracting') ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                      ) : (att.status === 'error' || att.contentStatus === 'error') ? (
                        <span title={att.errorMessage || 'Lỗi đính kèm'} className="flex items-center shrink-0">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        </span>
                      ) : (
                        <File className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      )}
                      
                      <span className={cn("text-[11px] font-bold truncate max-w-[150px]", att.status === 'error' ? 'text-red-600' : 'text-blue-700')}>
                        {att.originalName || att.name}
                      </span>
                      
                      <button onClick={() => removeAttachment(att.id)} className={cn("p-0.5 rounded-md shrink-0", att.status === 'error' ? "hover:bg-red-200/50 text-red-400 hover:text-red-600" : "hover:bg-blue-200/50 text-blue-400 hover:text-blue-600")}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {hasPendingAttachment && (
                    <div className="flex items-center gap-2 px-3 py-1.5">
                       <Loader2 className="w-3.5 h-3.5 text-[#002D56] animate-spin" />
                       <span className="text-[11px] font-bold text-slate-500 uppercase">Đang xử lý tệp...</span>
                    </div>
                  )}
                </div>
              )}

              <div className="relative group flex items-end gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple 
                  accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || loading || hasPendingAttachment || attachments.length >= 3}
                  className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0 mb-0.5"
                  title="Đính kèm tệp"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea 
                  ref={textareaRef}
                  value={input}
                  onChange={e => onInputChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && canSend && isAiReady) {
                      e.preventDefault();
                      handleSendWithAttachments();
                    }
                  }}
                  rows={1}
                  disabled={disabled || loading || hasPendingAttachment}
                  placeholder={
                    disabledReason ? disabledReason : 
                    (disabled || !isAiReady) ? "AI chưa sẵn sàng..." : 
                    loading ? "AI đang trả lời..." : 
                    hasPendingAttachment ? "Đang đọc tệp đính kèm..." : 
                    attachments.some(a => a.status === 'error') ? "Tệp lỗi, bạn có thể xóa tệp hoặc gửi câu hỏi khác..." : 
                    "Hỏi Hoa Tiêu AI..."
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-[14px] leading-[1.5] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10 transition-all disabled:opacity-50 resize-none max-h-[120px] custom-scrollbar min-h-[46px]"
                />
                <button 
                  onClick={handleSendWithAttachments}
                  disabled={!canSend || !isAiReady}
                  className="absolute right-2 bottom-2 p-2 bg-[#002D56] text-white rounded-xl hover:shadow-lg disabled:opacity-30 disabled:grayscale transition-all active:scale-90"
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
