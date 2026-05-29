import React, { useRef, useEffect, useState } from 'react';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User, Loader2, Trash2, Copy, Check, Sparkles, ExternalLink, Calendar, Tag, CheckSquare, Plus, Paperclip, File, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { ChatMessage, ChatSuggestedAction, ChatAttachment } from '../types';
import { ProposalChatContext } from '../features/proposals/types';
import ReactMarkdown from 'react-markdown';
import { DraftImportPreviewCard } from './proposals/DraftImportPreviewCard';
import { DraftImportAllocation } from '../features/proposals/types';
import { getRenderKey, staticKey } from '../utils/listKeys';

interface FloatingChatboxProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  input: string;
  onInputChange: (val: string) => void;
  onSend: (attachments?: ChatAttachment[], chatMode?: string) => void;
  loading: boolean;
  isAiReady: boolean;
  disabled?: boolean;
  disabledReason?: string;
  currentModel?: string;
  onClear?: () => void;
  onExecuteAction?: (action: ChatSuggestedAction) => void;
  onApplyImport?: (allocations: DraftImportAllocation[]) => void;
  onCreateTasks?: (messageIndex: number) => void;
  onToggleTaskDraft?: (messageIndex: number, clientId: string) => void;
  activeTab?: string;
  onUploadAttachment?: (file: File, onStatusUpdate?: (status: any) => void) => Promise<ChatAttachment>;
  proposalContext?: ProposalChatContext | null;
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
  onApplyImport,
  onCreateTasks,
  onToggleTaskDraft,
  activeTab = 'home',
  onUploadAttachment,
  proposalContext
}) => {
  const [chatMode, setChatMode] = useState<string>('quick');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? []);
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
    if ((import.meta as any).env.DEV) {
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

  const hasPendingAttachment = attachments.some(a => 
    a.status === 'uploading' || a.contentStatus === 'pending' || a.contentStatus === 'extracting'
  );
  const hasUsableAttachment = attachments.some(a => 
    a.status === 'ready' && !['pending', 'extracting', 'error'].includes(a.contentStatus || '')
  );
  const hasText = input.trim().length > 0;
  const canSend = !loading && !hasPendingAttachment && (hasText || hasUsableAttachment);

  const handleSendWithAttachments = () => {
    if (!canSend || disabled) return;
    onSend(attachments.length > 0 ? attachments.filter(a => a.status !== 'error') : undefined, chatMode);
    setAttachments([]);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  interface QuickPrompt {
    label: string;
    prompt: string;
    mode?: string;
  }

  const getQuickPrompts = (): QuickPrompt[] => {
    if (activeTab === 'proposals' && proposalContext && FEATURE_FLAGS.PROPOSAL_CHAT_CONTEXT) {
      const prompts: QuickPrompt[] = [
        { label: 'Viết bản thảo mục này', prompt: 'Hãy viết bản thảo chi tiết cho mục đề cương đang chọn.', mode: 'write_draft' },
        { label: 'Biên tập văn phong', prompt: 'Hãy biên tập lại bản thảo này theo văn phong hành chính nghiệp vụ.', mode: 'improve_draft' },
        { label: 'Rà soát logic', prompt: 'Rà soát tính logic và sự mạch lạc của đoạn thảo này.', mode: 'review_logic' },
        { label: 'Tìm số liệu thiếu', prompt: 'Những số liệu, thông tin nào còn thiếu cần bổ sung cho phần này?', mode: 'missing_data' },
        { label: 'Tóm tắt cho lãnh đạo', prompt: 'Tạo bản tóm tắt súc tích cho mục này dành cho lãnh đạo.', mode: 'executive_summary' },
      ];

      if (attachments.length > 0) {
        prompts.unshift(
          { label: 'Thêm file vào mục này', prompt: 'Đọc file này và thêm nội dung vào mục đang chọn.', mode: 'import_file_current' },
          { label: 'Phân bổ file vào phần này', prompt: 'Phân bổ nội dung file này vào phần lớn đang chọn.', mode: 'import_file_section' },
          { label: 'Phân bổ toàn bộ đề án', prompt: 'Phân bổ toàn bộ nội dung file này theo toàn bộ đề cương đề án.', mode: 'import_file_whole' }
        );
      }

      return prompts;
    }

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
          { label: 'Tìm ý tưởng từ tư liệu', prompt: 'Dựa trên các tài liệu đã chọn, hãy gửi ý cho tôi vài ý tưởng mới.' }
        ];
      case 'editor':
        return [
          { label: 'Tạo dàn ý bài viết', prompt: 'Dựa vào thông tin này, hãy tạo cho tôi một dàn ý bài viết chi tiết.' },
          { label: 'Sửa lỗi diễn đạt', prompt: 'Hãy kiểm tra và sửa các lỗi diễn đạt trong đoạn văn này.' }
        ];
      case 'proposals':
        if (FEATURE_FLAGS.PROPOSAL_MODULE) {
          return [
            { label: 'AI hỗ trợ đề án', prompt: 'AI có thể hỗ trợ gì cho tôi trong việc lập đề án này?' },
            { label: 'Chuẩn hoá đề cương', prompt: 'Hãy gợi ý cách để tối ưu hoá đề cương đề án của tôi.' }
          ];
        }
        // fall through when disabled
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
        aria-label={isOpen ? "Đóng AI Chatbox" : "Mở AI Chatbox"}
        aria-expanded={isOpen}
        aria-controls="vms-chatbox-panel"
        className={cn(
          "fixed bottom-4 sm:bottom-6 right-4 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-sm flex items-center justify-center z-[100] transition-colors",
          isOpen ? "bg-slate-800 text-white" : "bg-[#002D56] text-white"
        )}
      >
        {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />}
        {!isOpen && (
          <>
            {isAiReady ? (
              messages.length === 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 sm:h-4 sm:w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-md bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-md h-3 w-3 sm:h-4 sm:w-4 bg-emerald-500 border border-white shadow-sm"></span>
                </span>
              )
            ) : (
              <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-rose-500 border border-white shadow-sm" />
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
            id="vms-chatbox-panel"
            role="dialog"
            aria-label="Khung Chat Hoa Tiêu AI"
            aria-modal="false"
            className="fixed bottom-[4.5rem] sm:bottom-[5.5rem] right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[calc(100dvh-6rem)] sm:h-[600px] max-h-[80vh] sm:max-h-[min(600px,calc(100dvh-4rem))] bg-white flex flex-col overflow-hidden shadow-xl border border-slate-200 z-[100] rounded-lg"
          >
            {/* Header */}
            <div className="p-5 bg-[#002D56] text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-md">
                  <Bot className={cn("w-5 h-5", isAiReady ? "text-emerald-400" : "text-rose-400")} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold tracking-tight">Trợ lý Hoa Tiêu MIỀN BẮC</h4>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      isAiReady ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                    )} />
                    <span className="text-[10px] font-bold text-white/50 tracking-normal leading-none">
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
                    aria-label="Xóa hội thoại"
                    className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={onToggle}
                  aria-label="Đóng Chat"
                  className="p-2 hover:bg-white/10 rounded-md transition-colors text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/50"
            >
              {proposalContext && FEATURE_FLAGS.PROPOSAL_CHAT_CONTEXT && (
                <div className="sticky top-0 z-10 p-3 bg-blue-50 border-b border-blue-100 flex items-start gap-3 backdrop-blur-sm">
                  <div className="p-1.5 bg-blue-600 rounded-md shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-tight">Chế độ Trợ lý Đề án</p>
                    <p className="text-[11px] font-semibold text-blue-900 truncate">
                      {proposalContext.proposalTitle}
                    </p>
                    {proposalContext.selectedOutlineItemTitle && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Tag className="w-2.5 h-2.5 text-blue-400" />
                        <span className="text-[10px] text-blue-700 font-medium truncate">
                          Mục: {proposalContext.selectedOutlineItemCode ? `[${proposalContext.selectedOutlineItemCode}] ` : ''} 
                          {proposalContext.selectedOutlineItemTitle}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-5 space-y-6">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
                    <div className="w-16 h-16 bg-[#002D56]/5 rounded-md flex items-center justify-center mb-4">
                      <Bot className="w-8 h-8 text-[#002D56]/20" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400 tracking-normal mb-2 font-mono">XIN CHÀO!</p>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                      {proposalContext && FEATURE_FLAGS.PROPOSAL_CHAT_CONTEXT
                        ? `Tôi đã sẵn sàng hỗ trợ bạn viết bản thảo cho mục ${proposalContext.selectedOutlineItemTitle || 'đang chọn'}. Hãy đặt câu hỏi hoặc chọn tác vụ nhanh bên dưới.`
                        : 'Tôi là Hoa Tiêu AI. Hãy hỏi tôi về công việc, tóm tắt tài liệu hoặc soạn thảo văn bản giúp bạn.'
                      }
                    </p>
                    {isAiReady && (
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {quickPrompts.map(qp => (
                          <button 
                            key={`chat-quick-prompt-${qp.label}`}
                            onClick={() => {
                              onInputChange(qp.prompt);
                              if (qp.mode) setChatMode(qp.mode);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-[#002D56] hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-1.5"
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
                  key={getRenderKey("chat-msg", msg, i)} 
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
                    <span className="text-[9px] font-semibold uppercase text-slate-400 tracking-wide">
                      {msg.role === 'user' ? 'Bạn' : 'Hoa Tiêu AI'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 max-w-[90%]">
                    <div className={cn(
                      "px-4 py-3 rounded-md font-medium shadow-sm break-words",
                      msg.role === 'user' 
                        ? "bg-[#002D56] text-white rounded-tr-none leading-[1.55] text-[14px] whitespace-pre-wrap" 
                        : "bg-white text-slate-700 rounded-tl-none border border-slate-100 leading-[1.65] text-[14px]"
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="text-[14px] prose-strong:text-[#002D56] text-slate-700">
                          {(() => {
                            let content = msg.content;
                            
                            // 1. Output Sanitizer - only attempt if it looks predominantly like a JSON dump
                            const tryParse = (str: string) => {
                              try {
                                const trimmed = str.trim();
                                if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
                                const parsed = JSON.parse(trimmed);
                                if (typeof parsed === 'object' && parsed !== null) {
                                  return (
                                    parsed.reply ||
                                    parsed.message ||
                                    parsed.data?.reply ||
                                    parsed.data?.message ||
                                    parsed.response ||
                                    parsed.answer ||
                                    parsed.messageToUser ||
                                    parsed.summary
                                  );
                                }
                              } catch (e) {}
                              return null;
                            };

                            // Only apply aggressive parsing if the message is almost entirely a JSON structure
                            const isJsonDump = content.trim().startsWith('{') && content.trim().endsWith('}');
                            
                            if (isJsonDump) {
                              const parsedReply = tryParse(content);
                              if (parsedReply && typeof parsedReply === 'string') {
                                content = parsedReply;
                              }
                            } else {
                              // If it's mixed content, we might want to just strip the specific block if it's redundant
                              // but for now, let's trust the backend already cleaned it up or keep it as is
                              // Avoid replacing the entire content with just a matching regex group
                            }

                            // If we still see a massive JSON block at the start or end, we carefully clean it
                            if (content.length > 50 && content.includes('"reply"') && content.includes('{')) {
                               // Heuristic: if it contains a large block that looks like our internal schema, 
                               // but it's not the ONLY thing, we let it be or just try to clean obvious dumps.
                               if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
                                   const cleaned = tryParse(content);
                                   if (cleaned && typeof cleaned === 'string') content = cleaned;
                               }
                            }

                            // 2. Response Presentation Engine & UI Typography
                            return (
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-[1.65] text-justify text-slate-700">{children}</p>,
                                  strong: ({ children }) => <strong className="font-semibold text-[#002D56]">{children}</strong>,
                                  ul: ({ children }) => <ul className="mb-3 mt-1 list-none pl-1 space-y-1.5 leading-[1.6]">{children}</ul>,
                                  ol: ({ children }) => <ol className="mb-3 mt-1 list-decimal pl-5 space-y-1.5 leading-[1.6] text-slate-700">{children}</ol>,
                                  li: ({ children, ...props }) => (
                                    <li className="leading-[1.6] relative pl-5 before:content-['•'] before:absolute before:left-1.5 before:text-[#002D56]/60 before:font-bold text-slate-700" {...props}>
                                      {children}
                                    </li>
                                  ),
                                  h1: ({ children }) => <h1 className="text-[16px] font-bold mt-4 mb-2 text-[#002D56] border-b border-slate-100 pb-1 uppercase tracking-wide">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-[15px] font-bold mt-4 mb-2 text-[#002D56] flex items-center gap-1.5 before:content-[''] before:w-1 before:h-4 before:bg-[#002D56] before:rounded-sm">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-[14px] font-bold mt-3 mb-1.5 text-[#002D56]">{children}</h3>,
                                  blockquote: ({ children }) => <blockquote className="border-l-4 border-emerald-400 bg-emerald-50/50 italic py-2 pl-3 pr-2 my-2.5 rounded-r-md text-slate-700">{children}</blockquote>,
                                  code: ({ children, ...props }: any) => {
                                    const match = /language-(\w+)/.exec(props.className || '');
                                    const isInline = !match && !props.node?.properties?.className?.includes('language-');
                                    if (isInline) {
                                      return <code className="rounded bg-[#002D56]/5 px-1.5 py-0.5 text-[13px] font-mono mx-0.5 text-[#002D56] font-semibold" {...props}>{children}</code>;
                                    }
                                    return <code className="text-[13px] font-mono leading-[1.6]" {...props}>{children}</code>;
                                  },
                                  pre: ({ children, ...props }: any) => {
                                    const codeContent = React.Children.toArray(children)
                                      .map((child: any) => child.props.children)
                                      .join('');
                                    return (
                                      <div className="relative group my-3">
                                        <pre className="overflow-x-auto rounded-lg bg-slate-800 p-3 pt-8 text-[13px] leading-[1.55] text-slate-100 shadow-sm border border-slate-700" {...props}>
                                          <div className="absolute top-0 left-0 w-full bg-slate-900 px-3 py-1.5 rounded-t-lg border-b border-slate-700 flex justify-between items-center">
                                              <span className="text-[10px] text-slate-400 font-mono">CODE</span>
                                              <button
                                                onClick={() => {
                                                  navigator.clipboard.writeText(codeContent);
                                                  toast.success('Đã sao chép!');
                                                }}
                                                aria-label="Sao chép mã code"
                                                className="p-1 text-slate-400 hover:text-white transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                                                title="Sao chép"
                                              >
                                                <Copy className="w-3 h-3" />
                                                <span className="text-[9px] uppercase font-bold">Copy</span>
                                              </button>
                                          </div>
                                          {children}
                                        </pre>
                                      </div>
                                    );
                                  }
                                }}
                              >
                                {content}
                              </ReactMarkdown>
                            );
                          })()}
                        </div>
                      ) : (
                        <>
                          {msg.content}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {msg.attachments.map((att, idx) => (
                                <div key={getRenderKey("msg-att", att, idx)} className="flex items-center gap-2 bg-blue-900/30 border border-blue-800/30 py-1.5 px-3 rounded-md max-w-full">
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
                        <div className="text-[10px] font-semibold tracking-normal text-slate-400 uppercase">
                          Công việc AI đề xuất - cần duyệt
                        </div>
                        {msg.taskDrafts.map((draft, dIdx) => (
                          <div key={`${draft.clientId}-${dIdx}`} className="bg-white border border-slate-200 rounded-md p-4 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={draft.selected !== false}
                                onChange={() => onToggleTaskDraft?.(i, draft.clientId)}
                                className="mt-1 w-4 h-4 rounded text-[#002D56] border-slate-300"
                              />
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-semibold text-[#002D56] leading-5">{draft.title}</h5>
                                <p className="text-[11px] text-slate-500 leading-normal mt-1">{draft.description}</p>

                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-[9px] font-semibold tracking-tight">
                                    <Tag className="w-2.5 h-2.5" />
                                    {draft.categoryName || draft.categoryCode}
                                  </span>
                                  <span className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold tracking-tight",
                                    draft.priority === 'urgent' ? "bg-rose-50 text-rose-700" :
                                    draft.priority === 'high' ? "bg-orange-50 text-orange-700" :
                                    "bg-slate-50 text-slate-600"
                                  )}>
                                    {draft.priority === 'urgent' ? 'Khẩn cấp' : draft.priority === 'high' ? 'Cao' : draft.priority === 'medium' ? 'Trung bình' : 'Thấp'}
                                  </span>
                                  {draft.dueDate && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-semibold tracking-tight">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {draft.dueDate}
                                    </span>
                                  )}
                                </div>

                                {draft.checklist && draft.checklist.length > 0 && (
                                  <div className="mt-4 bg-slate-50/80 rounded-md p-3 border border-slate-100">
                                    <p className="text-[9px] font-semibold tracking-normal text-[#002D56]/40 mb-2 flex items-center gap-1.5">
                                      <CheckSquare className="w-2.5 h-2.5" />
                                      Checklist chi tiết
                                    </p>
                                    <div className="space-y-1.5">
                                      {draft.checklist.map((item, itemIdx) => (
                                        <div key={getRenderKey("chat-check", item, itemIdx)} className="flex items-start gap-2.5">
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
                          className="w-full bg-[#002D56] text-white rounded-md py-3 text-[11px] font-semibold tracking-normal shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Tạo danh sách công việc này
                        </button>
                      </div>
                    )}

                    {/* Proposal Draft Assist Suggestions */}
                    {msg.role === 'assistant' && msg.importPreview && FEATURE_FLAGS.PROPOSAL_CHAT_CONTEXT && (
                      <div className="w-full">
                         <DraftImportPreviewCard 
                           preview={msg.importPreview}
                           onApply={(allocs) => onApplyImport?.(allocs)}
                           onCancel={() => {
                             toast.success('Đã bỏ qua bản phân bổ');
                           }}
                         />
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.draftSuggestion && FEATURE_FLAGS.PROPOSAL_CHAT_CONTEXT && (
                      <div className="mt-4 space-y-4 w-full animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-md p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4 text-emerald-600" />
                            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-tight">Đề xuất bản thảo</span>
                            <span className="ml-auto text-[9px] font-bold bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">
                              {msg.draftSuggestion.insertionMode === 'replace' ? 'THAY THẾ' : 
                                msg.draftSuggestion.insertionMode === 'append' ? 'CHÈN THÊM' : 'GỢI Ý'}
                            </span>
                          </div>
                          
                          <div className="max-h-[200px] overflow-y-auto mb-4 p-3 bg-white border border-emerald-200 rounded text-sm text-slate-700 custom-scrollbar whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
                            {msg.draftSuggestion.content}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button 
                              onClick={() => onExecuteAction?.({ 
                                type: msg.draftSuggestion!.insertionMode === 'replace' ? 'apply_to_draft' : 'append_to_draft', 
                                label: msg.draftSuggestion!.insertionMode === 'replace' ? 'Áp dụng thay thế' : 'Chèn vào bản thảo',
                                payload: { content: msg.draftSuggestion!.content, outlineItemId: proposalContext?.selectedOutlineItemId } 
                              })}
                              className="flex-1 bg-emerald-600 text-white rounded py-2 text-[10px] font-bold hover:bg-emerald-700 transition shadow-sm active:scale-95"
                            >
                              Sử dụng bản thảo này
                            </button>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(msg.draftSuggestion!.content);
                                toast.success('Đã sao chép');
                              }}
                              className="px-3 bg-white border border-emerald-200 text-emerald-700 rounded py-2 text-[10px] font-bold hover:bg-emerald-50 active:scale-95 transition"
                            >
                              Sao chép
                            </button>
                          </div>

                          {msg.missingData && msg.missingData.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-emerald-200/50">
                              <p className="text-[10px] font-bold text-emerald-800 uppercase mb-2 flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3" />
                                Cảnh báo số liệu còn thiếu
                              </p>
                              <ul className="space-y-1">
                                {msg.missingData.map((m: string, idx: number) => (
                                  <li key={`msg-${i}-missing-${idx}`} className="text-[11px] text-emerald-900 leading-tight flex items-start gap-1.5">
                                    <span className="text-emerald-500 mt-0.5">•</span>
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {msg.risks && msg.risks.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-rose-200/50">
                              <p className="text-[10px] font-bold text-rose-800 uppercase mb-2 flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3" />
                                Rủi ro & Lưu ý
                              </p>
                              <ul className="space-y-1">
                                {msg.risks.map((r: string, idx: number) => (
                                  <li key={`msg-${i}-risk-${idx}`} className="text-[11px] text-rose-900 leading-tight flex items-start gap-1.5">
                                    <span className="text-rose-500 mt-0.5">•</span>
                                    {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="flex flex-col gap-2 mt-1 px-1">
                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {msg.suggestedActions.map((action, actionIdx) => (
                              <button
                                key={staticKey("chat-action", action.id, actionIdx)}
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
                            className="p-1.5 text-slate-400 hover:text-[#002D56] transition-colors rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002D56]"
                            title="Sao chép tin nhắn"
                            aria-label="Sao chép tin nhắn"
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
                    <span className="text-[9px] font-semibold uppercase text-slate-400 tracking-wide">Hoa Tiêu AI</span>
                  </div>
                  <div className="bg-white px-4 py-3 rounded-md rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#002D56] animate-spin" />
                    <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wide">Đang suy nghĩ...</span>
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              {(disabledReason || !isAiReady) && (
                <div className={cn(
                  "mb-3 p-3 border rounded-md flex items-center gap-2",
                  disabledReason ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-rose-50 border-rose-100 text-rose-600"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", disabledReason ? "bg-amber-500" : "bg-rose-500")} />
                  <p className="text-[9px] font-bold tracking-tight leading-tight">
                    {disabledReason || 'AI đang ngoại tuyến. Hãy thiết lập Key cá nhân trong Cài đặt nếu cần.'}
                  </p>
                </div>
              )}

              {/* Chat mode selector */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 font-medium text-xs text-slate-500">Nguồn:</span>
                {[
                  { id: 'quick', label: 'Hỏi nhanh' },
                  { id: 'library', label: 'Kho tư liệu' },
                  { id: 'tasks', label: 'Công việc' },
                  { id: 'editor', label: 'Bài viết' }
                ].map(m => (
                  <button
                    key={`chat-mode-${m.id}`}
                    onClick={() => setChatMode(m.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide transition-all",
                      chatMode === m.id ? "bg-[#002D56] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((att, idx) => (
                    <div key={getRenderKey("compose-att", att, idx)} className="flex items-center gap-2 bg-blue-50 border border-blue-100 py-1.5 px-3 rounded-md max-w-full">
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
                      
                      <button 
                        onClick={() => removeAttachment(att.id)} 
                        aria-label={`Xóa tệp đính kèm ${att.name}`}
                        className={cn("p-0.5 rounded-md shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500", att.status === 'error' ? "hover:bg-red-200/50 text-red-400 hover:text-red-600" : "hover:bg-blue-200/50 text-blue-400 hover:text-blue-600")}>
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

              <div className="relative group flex items-end gap-2 mb-2">
                {onUploadAttachment && (
                  <>
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
                      aria-label="Đính kèm tệp"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={disabled || loading || hasPendingAttachment || attachments.length >= 3}
                      className="p-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0 mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002D56]"
                      title="Đính kèm tệp"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </>
                )}
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-md pl-4 pr-12 py-3 text-[14px] leading-[1.5] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10 transition-all disabled:opacity-50 resize-none max-h-[120px] custom-scrollbar min-h-[46px]"
                />
                <button 
                  onClick={handleSendWithAttachments}
                  aria-label="Gửi tin nhắn"
                  disabled={!canSend || !isAiReady}
                  className="absolute right-2 bottom-2 p-2 bg-[#002D56] text-white rounded-md hover:shadow-sm disabled:opacity-30 disabled:grayscale transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#002D56]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[8px] text-center text-slate-500 font-semibold uppercase tracking-[0.1em] mt-3">
                Đang dùng: {currentModel || 'Gemini'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
