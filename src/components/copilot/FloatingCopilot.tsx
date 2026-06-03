import React from "react";
import {
  Bot,
  Check,
  Copy,
  FileText,
  FileUp,
  Loader2,
  Link as LinkIcon,
  Maximize2,
  MessageCircle,
  Minimize2,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { EditorialExecutionResult } from "../../types/editorialExecution";
import type { EditorialTemplateGroup } from "../../types/editorialTemplate";
import { AssistantMessageList } from "../assistant/AssistantMessageList";
import { SourceModeBar } from "../assistant/SourceModeBar";
import type { AssistantMessage, AssistantSourceMode } from "../assistant/assistantTypes";

export type CopilotViewMode = "collapsed" | "expanded" | "fullscreen";

export type CopilotContextType =
  | "paragraph"
  | "heading"
  | "table"
  | "figure"
  | "source"
  | "history_session"
  | "preflight_issue"
  | "draft"
  | "selection";

export interface CopilotContextItem {
  id: string;
  type: CopilotContextType;
  title: string;
  excerpt?: string;
  fullText?: string;
  sourceId?: string;
  blockId?: string;
}

export interface CopilotProposal {
  id: string;
  commandId: string;
  title: string;
  targetContextId?: string;
  currentText?: string;
  proposedText: string;
  note?: string;
  canApply: boolean;
  executionResult?: EditorialExecutionResult;
}

export interface CopilotTemplateRecommendation {
  id: string;
  name: string;
  description: string;
  score: number;
  groupLabel?: string;
  reason?: string;
  missingInputs?: string[];
  previewLines?: string[];
  nonAiLabel?: string;
}

export interface CopilotDraftFlowState {
  kind: string;
  kindOptions: Array<{ value: string; label: string }>;
  brief: string;
  extraNotes: string;
  sourceSummary: string;
  error?: string | null;
  templates?: CopilotTemplateRecommendation[];
  selectedTemplateId?: string | null;
  targetGroup?: EditorialTemplateGroup;
}

export interface CopilotSourceFlowState {
  sourceSummary: string;
  selectedSources: Array<{ id: string; title: string; excerpt?: string }>;
  totalSelectedCount?: number;
}

export interface CopilotCommand {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  prompt?: string;
}

export interface CopilotChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  isContextAdvice?: boolean; // advisory reply, no proposal generated
}

interface FloatingCopilotProps {
  viewMode: CopilotViewMode;
  dockMode?: "floating" | "rail" | "sidebar";
  selectedContextItems: CopilotContextItem[];
  commands: CopilotCommand[];
  activeCommandId?: string | null;
  pendingProposal?: CopilotProposal | null;
  statusMessage?: string | null;
  inputValue: string;
  isBusy?: boolean;
  chatMessages?: CopilotChatMessage[];
  draftFlow?: CopilotDraftFlowState | null;
  sourceFlow?: CopilotSourceFlowState | null;
  sourceMode?: AssistantSourceMode;
  onSourceModeChange?: (mode: AssistantSourceMode) => void;
  onDraftFlowChange?: (patch: Partial<CopilotDraftFlowState>) => void;
  onSubmitDraftFlow?: () => void;
  onGenerateTemplateSkeleton?: () => void;
  onCancelDraftFlow?: () => void;
  onOpenSourceWorkspace?: (tab?: "library" | "text" | "link" | "upload") => void;
  onCancelSourceFlow?: () => void;
  onOpenHistory?: () => void;
  onChooseTemplate?: () => void;
  onCopyProposal?: () => void;
  onOpen: () => void;
  onClose: () => void;
  onFullscreen: () => void;
  onReturnToCanvas: () => void;
  onRemoveContext: (id: string) => void;
  onClearContext: () => void;
  onRunCommand: (id: string, prompt?: string) => void;
  onInputChange: (value: string) => void;
  onSubmitPrompt: () => void;
  onSubmitSuggestion?: (prompt: string) => void;
  onApplyProposal: () => void;
  onCancelProposal: () => void;
}

const CONTEXT_LABELS: Record<CopilotContextType, string> = {
  paragraph: "đoạn văn",
  heading: "tiêu đề",
  table: "bảng",
  figure: "hình/placeholder",
  source: "nguồn tư liệu",
  history_session: "phiên bản lịch sử",
  preflight_issue: "cảnh báo",
  draft: "bản thảo",
  selection: "vùng chọn",
};

function truncateOneLine(value: string, maxLength = 96): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trim()}…`;
}

function summarizeContext(items: CopilotContextItem[]): string {
  if (items.length === 0) return "Đang hỏi chung về bản thảo";
  if (items.length > 1) return `Đang hỏi theo ${items.length} đoạn đã chọn`;

  const [item] = items;
  const excerpt = truncateOneLine(item.excerpt || item.fullText || "");
  return `Đang hỏi theo đoạn đã chọn${excerpt ? ` • ${excerpt}` : ""}`;
}


function getSourceModeStatus(mode: AssistantSourceMode, items: CopilotContextItem[]): string {
  if (mode === "canvas") return summarizeContext(items);
  if (mode === "articles") return "Bài viết cần được gắn dữ liệu trước khi tổng hợp.";
  if (mode === "library") return "Kho tư liệu chỉ dùng khi nguồn đã được gắn vào phiên.";
  if (mode === "tasks") return "Công việc cần adapter riêng ở PR sau.";
  return "Hỏi nhanh về thao tác chung.";
}

function isAdvisorySuggestion(prompt: string): boolean {
  return /đoạn\s+này\s+ổn\s+không|nhận\s+xét\s+đoạn\s+này/iu.test(prompt);
}

function isEditSuggestion(prompt: string): boolean {
  return /viết\s+lại|rút\s+gọn|sửa\s+đoạn/iu.test(prompt);
}

const EDITOR_EMPTY_MESSAGE = "Bạn có thể hỏi chung, chọn đoạn trên Canvas để hỏi theo ngữ cảnh, hoặc yêu cầu rà soát bản thảo.";
const EDITOR_SUGGESTIONS = [
  "Tóm tắt bản thảo này",
  "Đoạn này ổn không?",
  "Viết lại đoạn đang chọn",
  "Kiểm tra lỗi trước khi xuất",
];

function toAssistantMessages(messages: CopilotChatMessage[]): AssistantMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    isAdvisory: message.isContextAdvice,
  }));
}

function splitDockCommands(commands: CopilotCommand[]): { primaryCommands: CopilotCommand[]; overflowCommands: CopilotCommand[] } {
  const fallbackCommand = commands.find((command) => command.id === "more");
  const nonFallbackCommands = commands.filter((command) => command.id !== "more");
  const findFirst = (ids: string[]) => nonFallbackCommands.find((command) => ids.includes(command.id));
  const preferredCommands = [
    findFirst(["review_current_draft"]),
    findFirst(["check_missing_source_or_caption", "fix_selection", "check_table_numbers", "check_long_paragraph"]),
    findFirst(["add_source"]),
  ].filter((command): command is CopilotCommand => Boolean(command));

  const primaryCommands = [
    ...preferredCommands,
    ...nonFallbackCommands.filter((command) => !preferredCommands.some((preferred) => preferred.id === command.id)),
  ].slice(0, 3);

  const primaryIds = new Set(primaryCommands.map((command) => command.id));
  const overflowCommands = nonFallbackCommands.filter((command) => !primaryIds.has(command.id));

  if (fallbackCommand) overflowCommands.push(fallbackCommand);
  return { primaryCommands, overflowCommands };
}

function commandDisabledTitle(command: CopilotCommand): string | undefined {
  if (!command.disabled) return undefined;
  return command.description || "Chức năng này sẽ hoàn thiện ở bước sau.";
}

export function FloatingCopilot({
  viewMode,
  dockMode = "floating",
  selectedContextItems,
  commands,
  activeCommandId,
  pendingProposal,
  statusMessage,
  inputValue,
  isBusy = false,
  chatMessages = [],
  draftFlow,
  sourceFlow,
  sourceMode = "canvas",
  onSourceModeChange,
  onDraftFlowChange,
  onSubmitDraftFlow,
  onGenerateTemplateSkeleton,
  onCancelDraftFlow,
  onOpenSourceWorkspace,
  onCancelSourceFlow,
  onCopyProposal,
  onOpen,
  onClose,
  onFullscreen,
  onReturnToCanvas,
  onRemoveContext,
  onClearContext,
  onRunCommand,
  onInputChange,
  onSubmitPrompt,
  onSubmitSuggestion,
  onApplyProposal,
  onCancelProposal,
}: FloatingCopilotProps) {
  const contextSummary = summarizeContext(selectedContextItems);
  const sourceModeStatus = getSourceModeStatus(sourceMode, selectedContextItems);
  const isDraftBriefMissing = Boolean(draftFlow) && !draftFlow?.brief.trim();
  const { primaryCommands, overflowCommands } = splitDockCommands(commands);
  const [isOverflowOpen, setIsOverflowOpen] = React.useState(false);
  const overflowRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    setIsOverflowOpen(false);
  }, [commands, viewMode]);

  React.useEffect(() => {
    if (!isOverflowOpen) return undefined;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!overflowRef.current?.contains(event.target as Node)) {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  }, [isOverflowOpen]);

  const runDockCommand = React.useCallback((command: CopilotCommand) => {
    if (command.disabled) return;
    setIsOverflowOpen(false);
    onRunCommand(command.id, command.prompt);
  }, [onRunCommand]);

  const handleSuggestionSelect = React.useCallback((suggestion: string) => {
    if (isAdvisorySuggestion(suggestion) || (isEditSuggestion(suggestion) && selectedContextItems.length === 0)) {
      onSubmitSuggestion?.(suggestion);
      return;
    }
    onInputChange(suggestion);
  }, [onInputChange, onSubmitSuggestion, selectedContextItems.length]);

  if (viewMode === "collapsed") {
    return (
      <button
        type="button"
        data-copilot-root="true"
        data-export-exclude="true"
        onClick={onOpen}
        className={cn(
          "z-40 flex items-center justify-center bg-[#002D56] text-white shadow-2xl shadow-slate-900/20 transition hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-200",
          dockMode === "rail"
            ? "h-full w-full rounded-none px-2 [writing-mode:vertical-rl]"
            : "fixed bottom-5 right-5 h-14 w-14 rounded-full",
        )}
        aria-label="Mở Copilot biên tập"
      >
        {dockMode === "rail" ? <span className="text-[11px] font-black uppercase tracking-[0.18em]">Trợ lý</span> : <MessageCircle className="h-6 w-6" />}
        {selectedContextItems.length > 0 && (
          <span className={cn(
            "absolute rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-slate-900 shadow-sm",
            dockMode === "rail" ? "left-1 top-2 [writing-mode:horizontal-tb]" : "-top-2 -left-2",
          )}>
            {selectedContextItems.length}
          </span>
        )}
      </button>
    );
  }

  const isFullscreen = viewMode === "fullscreen";
  const isRailDocked = dockMode === "rail" && !isFullscreen;
  const isSidebarDocked = dockMode === "sidebar" && !isFullscreen;
  const assistantMessages = toAssistantMessages(chatMessages);

  return (
    <section
      data-copilot-root="true"
      data-export-exclude="true"
      className={cn(
        "flex flex-col overflow-hidden border border-slate-200 bg-white",
        isFullscreen
          ? "fixed inset-0 z-[70] h-[100dvh] w-screen max-w-none rounded-none shadow-2xl shadow-slate-900/20"
          : isSidebarDocked
            ? "relative h-full min-h-0 w-full rounded-none border-0 bg-transparent shadow-none"
            : isRailDocked
              ? "relative h-full min-h-[420px] w-full rounded-none shadow-none"
              : "fixed bottom-5 right-5 top-[92px] z-40 w-[min(420px,calc(100vw-2rem))] rounded-2xl shadow-2xl shadow-slate-900/20",
      )}
      aria-label="Trợ lý Canvas thông minh"
    >
      {!isSidebarDocked && <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#002D56]">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black uppercase tracking-[0.14em] text-[#002D56]">Trợ lý biên tập</p>
              <p className="truncate text-xs font-medium text-slate-500">Copilot điều phối theo context Canvas</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isFullscreen ? (
            <button type="button" onClick={onReturnToCanvas} className="rounded-lg px-2.5 py-2 text-xs font-bold text-[#002D56] hover:bg-blue-50">
              <Minimize2 className="mr-1 inline h-4 w-4" /> Thu gọn
            </button>
          ) : (
            <button type="button" onClick={onFullscreen} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Mở toàn màn hình">
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng Copilot">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>}

      {onSourceModeChange && (
        <SourceModeBar value={sourceMode} onChange={onSourceModeChange} statusText={sourceModeStatus} />
      )}

      <nav className="relative shrink-0 border-b border-slate-100 bg-white px-2 py-1.5" aria-label="Command Dock" ref={overflowRef}>
        <div className="grid grid-cols-4 gap-1">
          {primaryCommands.map((command) => (
            <button
              type="button"
              key={`${command.id}:${command.label}`}
              disabled={command.disabled || isBusy}
              title={commandDisabledTitle(command)}
              onClick={() => runDockCommand(command)}
              className={cn(
                "inline-flex min-h-7 min-w-0 items-center justify-center rounded-md border px-1.5 py-1 text-[11px] font-black transition",
                activeCommandId === command.id ? "border-[#002D56] bg-blue-50 text-[#002D56]" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50",
                command.disabled && "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70 hover:bg-slate-100",
              )}
            >
              <span className="whitespace-normal text-center leading-tight">{command.label}</span>
            </button>
          ))}
          {overflowCommands.length > 0 && (
            <button
              type="button"
              onClick={() => setIsOverflowOpen((current) => !current)}
              className={cn(
                "inline-flex min-h-7 min-w-0 items-center justify-center rounded-md border px-1.5 py-1 text-[11px] font-black transition",
                isOverflowOpen ? "border-[#002D56] bg-blue-50 text-[#002D56]" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50",
              )}
              aria-expanded={isOverflowOpen}
              aria-haspopup="menu"
            >
              Thêm
            </button>
          )}
        </div>
        {isOverflowOpen && overflowCommands.length > 0 && (
          <div className="absolute left-3 right-3 top-[calc(100%-0.25rem)] z-50 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/15 custom-scrollbar" role="menu" aria-label="Lệnh khác">
            <div className="space-y-1">
              {overflowCommands.map((command) => (
                <button
                  type="button"
                  key={`overflow:${command.id}:${command.label}`}
                  disabled={command.disabled || isBusy}
                  title={commandDisabledTitle(command)}
                  onClick={() => runDockCommand(command)}
                  className={cn(
                    "flex w-full min-w-0 items-start justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition",
                    activeCommandId === command.id ? "bg-blue-50 text-[#002D56]" : "text-slate-700 hover:bg-slate-50",
                    command.disabled && "cursor-not-allowed bg-slate-50 text-slate-400 opacity-80 hover:bg-slate-50",
                  )}
                  role="menuitem"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black">{command.id === "more" ? "Yêu cầu khác" : command.label}</span>
                    {command.description && <span className="mt-0.5 line-clamp-2 block font-semibold text-slate-500">{command.description}</span>}
                  </span>
                  {command.disabled && <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-500">Sắp có</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
        <AssistantMessageList
          messages={assistantMessages}
          isLoading={isBusy}
          emptyMessage={EDITOR_EMPTY_MESSAGE}
          suggestions={EDITOR_SUGGESTIONS}
          onSuggestionSelect={handleSuggestionSelect}
        />

        {draftFlow && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <span className="rounded-xl bg-blue-50 p-2 text-[#002D56]"><FileText className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-black text-slate-900">Soạn văn bản mới</p>
                <p className="text-xs text-slate-500">Chọn tạo bằng AI hoặc dựng khung theo mẫu có sẵn rồi chỉnh trên Canvas.</p>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-bold text-slate-600">Loại văn bản
                <select
                  value={draftFlow.kind}
                  onChange={(event) => onDraftFlowChange?.({ kind: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#002D56] focus:bg-white"
                >
                  {draftFlow.kindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                <p className="px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Chọn nhanh theo nhu cầu</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[
                    { group: "communication_content" as const, label: "Soạn truyền thông", hint: "Website, tin tức, giới thiệu" },
                    { group: "review_improvement" as const, label: "Rà soát bản thảo", hint: "Văn phong, nguồn, lập luận" },
                    { group: "administrative_document" as const, label: "Chuẩn hành chính", hint: "Báo cáo, công văn, biên bản" },
                  ].map((item) => (
                    <button
                      key={item.group}
                      type="button"
                      onClick={() => onDraftFlowChange?.({ targetGroup: item.group })}
                      className={cn(
                        "rounded-xl border px-2.5 py-2 text-left transition hover:border-blue-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200",
                        draftFlow.targetGroup === item.group ? "border-[#002D56] bg-white text-[#002D56]" : "border-slate-200 bg-white/70 text-slate-700",
                      )}
                    >
                      <span className="block text-xs font-black">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-bold text-slate-600">Yêu cầu / bối cảnh
                <textarea
                  value={draftFlow.brief}
                  onChange={(event) => onDraftFlowChange?.({ brief: event.target.value })}
                  placeholder="VD: Soạn tin website về công tác bảo đảm an toàn hàng hải..."
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#002D56] focus:bg-white"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">Ý chính hoặc nguồn bổ sung (tùy chọn)
                <textarea
                  value={draftFlow.extraNotes}
                  onChange={(event) => onDraftFlowChange?.({ extraNotes: event.target.value })}
                  placeholder="Gạch đầu dòng ý chính, số liệu, tên nguồn..."
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#002D56] focus:bg-white"
                />
              </label>

              <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#002D56]">Tạo bằng AI</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">Gọi AI để viết bản thảo đầy đủ từ yêu cầu, ý chính và nguồn đã chọn.</p>
                <button
                  type="button"
                  onClick={onSubmitDraftFlow}
                  disabled={isBusy || isDraftBriefMissing}
                  className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#002D56] px-4 py-2.5 text-sm font-black text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Tạo bằng AI
                </button>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Dựng theo mẫu có sẵn</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">Không dùng AI, chỉ dựng khung để bạn chỉnh trên Canvas.</p>
                  </div>
                  {draftFlow.templates && draftFlow.templates.length > 0 && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{draftFlow.templates.length} mẫu</span>}
                </div>

                {draftFlow.templates && draftFlow.templates.length > 0 ? (
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                    {draftFlow.templates.slice(0, 3).map((template) => (
                      <label
                        key={template.id}
                        className={cn(
                          "block cursor-pointer rounded-xl border p-3 shadow-sm transition hover:border-blue-300",
                          draftFlow.selectedTemplateId === template.id ? "border-[#002D56] bg-white ring-1 ring-[#002D56]" : "border-slate-200 bg-white"
                        )}
                      >
                        <input
                          type="radio"
                          name="templateSelection"
                          value={template.id}
                          checked={draftFlow.selectedTemplateId === template.id}
                          onChange={() => onDraftFlowChange?.({ selectedTemplateId: template.id })}
                          className="sr-only"
                        />
                        <div className="flex items-start gap-2">
                          <div className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            draftFlow.selectedTemplateId === template.id ? "border-[#002D56] bg-[#002D56]" : "border-slate-300"
                          )}>
                            {draftFlow.selectedTemplateId === template.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[13px] font-black text-slate-900">{template.name}</span>
                              {template.groupLabel && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{template.groupLabel}</span>}
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-100">{template.nonAiLabel || "Không dùng AI"}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{template.reason || template.description || "Phù hợp để dựng nhanh khung bản thảo."}</p>
                            {template.missingInputs && template.missingInputs.length > 0 && (
                              <p className="mt-1 text-[11px] font-semibold text-amber-700">Thiếu: {template.missingInputs.slice(0, 2).join(", ")}{template.missingInputs.length > 2 ? ` +${template.missingInputs.length - 2}` : ""}</p>
                            )}
                            {template.previewLines && template.previewLines.length > 0 && (
                              <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] leading-5 text-slate-600 ring-1 ring-slate-100">
                                {template.previewLines.slice(0, 5).map((line) => <p key={`${template.id}:${line}`} className="truncate">• {line}</p>)}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-100">Nhập yêu cầu hoặc chọn nguồn để gợi ý mẫu phù hợp.</p>
                )}

                {draftFlow.selectedTemplateId && onGenerateTemplateSkeleton && (
                  <button
                    type="button"
                    onClick={onGenerateTemplateSkeleton}
                    disabled={isBusy}
                    className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#002D56] bg-white px-4 py-2.5 text-sm font-black text-[#002D56] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Dựng bản thảo theo mẫu
                  </button>
                )}
              </section>

              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{draftFlow.sourceSummary}</p>
              {(draftFlow.error || isDraftBriefMissing) && (
                <p className={cn("text-xs font-bold", draftFlow.error ? "text-red-600" : "text-amber-600")}>
                  {draftFlow.error || "Vui lòng nhập yêu cầu hoặc bối cảnh để tạo bản thảo bằng AI."}
                </p>
              )}
              <button
                type="button"
                onClick={onCancelDraftFlow}
                className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" /> Hủy
              </button>
            </div>
          </div>
        )}


        {sourceFlow && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">Thêm nguồn tư liệu</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">Nguồn giúp AI bám căn cứ khi tạo hoặc chỉnh sửa bản thảo.</p>
              </div>
              <button type="button" onClick={onCancelSourceFlow} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng luồng nguồn">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 line-clamp-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{sourceFlow.sourceSummary}</p>
            {sourceFlow.selectedSources.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {sourceFlow.selectedSources.slice(0, 3).map((source) => (
                  <div key={source.id} className="rounded-xl border border-blue-100 bg-blue-50/40 px-2.5 py-2">
                    <p className="truncate text-xs font-black text-slate-800">{source.title}</p>
                    {source.excerpt && <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-slate-600">{source.excerpt}</p>}
                  </div>
                ))}
                {(sourceFlow.totalSelectedCount || sourceFlow.selectedSources.length) > sourceFlow.selectedSources.slice(0, 3).length && (
                  <p className="text-[11px] font-bold text-slate-500">+{(sourceFlow.totalSelectedCount || sourceFlow.selectedSources.length) - sourceFlow.selectedSources.slice(0, 3).length} nguồn khác</p>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { id: "library" as const, label: "Kho tư liệu", icon: FileText },
                { id: "text" as const, label: "Dán văn bản", icon: Type },
                { id: "link" as const, label: "Thêm liên kết", icon: LinkIcon },
                { id: "upload" as const, label: "Tải tệp lên", icon: FileUp },
              ].map((option) => (
                <button
                  type="button"
                  key={option.id}
                  onClick={() => onOpenSourceWorkspace?.(option.id)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                >
                  <option.icon className="h-3.5 w-3.5 text-[#002D56]" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}


        {statusMessage && (() => {
          const normalizedStatus = statusMessage.toLowerCase();
          const isErrorStatus = /lỗi|không thể|không tìm|thất bại|error/u.test(normalizedStatus);
          const isWarningStatus = /hãy|vui lòng|chưa|cần|thiếu/u.test(normalizedStatus) && !statusMessage.startsWith("Đã");
          const isSuccessStatus = statusMessage.startsWith("Đã");
          return (
            <div className={cn(
              "mt-4 rounded-xl border px-3 py-2 text-sm font-medium",
              isErrorStatus
                ? "border-red-200 bg-red-50 text-red-700"
                : isWarningStatus
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : isSuccessStatus
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700",
            )}>{statusMessage}</div>
          );
        })()}

        {pendingProposal && (
          <div className={cn("mt-4 rounded-2xl border p-3", pendingProposal.canApply ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-emerald-900">{pendingProposal.title}</p>
                {pendingProposal.executionResult && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-800">
                    {pendingProposal.executionResult.source === "rule"
                      ? `Rule · ${pendingProposal.executionResult.ruleName || pendingProposal.executionResult.ruleId || "Static rule"}${pendingProposal.executionResult.ruleVersion ? ` v${pendingProposal.executionResult.ruleVersion}` : ""}`
                      : `AI${pendingProposal.executionResult.model ? ` · ${pendingProposal.executionResult.model}` : ""}`}
                  </p>
                )}
              </div>
              <span className={cn(
                "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider",
                pendingProposal.executionResult?.source === "ai" ? "bg-purple-100 text-purple-700" : "bg-white text-emerald-700",
              )}>
                {pendingProposal.executionResult?.source === "ai" ? "AI" : pendingProposal.executionResult?.source === "rule" ? "Rule" : "Preview"}
              </span>
            </div>
            {!pendingProposal.canApply && <p className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Đề xuất tham khảo</p>}
            {pendingProposal.note && <p className="mt-2 text-xs font-medium text-emerald-800">{pendingProposal.note}</p>}
            {pendingProposal.currentText && (
              <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-emerald-100">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Nội dung hiện tại</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{pendingProposal.currentText}</p>
              </div>
            )}
            <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-emerald-100">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">{pendingProposal.canApply ? "Đề xuất mới" : "Nội dung tham khảo"}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{pendingProposal.proposedText}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingProposal.canApply ? (
                <button type="button" disabled={isBusy} onClick={onApplyProposal} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                  <Check className="h-4 w-4" /> Áp dụng
                </button>
              ) : pendingProposal.executionResult?.error || pendingProposal.note ? (
                <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-300 px-3 py-2 text-xs font-bold text-slate-600">
                  <X className="h-4 w-4" /> Không thể áp dụng
                </button>
              ) : null}
              {!pendingProposal.canApply && (
                <button type="button" onClick={onCopyProposal} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Copy className="h-4 w-4" /> Sao chép
                </button>
              )}
              <button type="button" onClick={onCancelProposal} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                <RotateCcw className="h-4 w-4" /> Hủy
              </button>
              <button type="button" onClick={() => onInputChange("Hãy sửa tiếp đề xuất này theo hướng: ")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                Yêu cầu sửa tiếp
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-slate-100 bg-white p-2.5">
        <div className="mb-1.5 max-h-14 overflow-hidden rounded-md border border-blue-100 bg-blue-50/70 px-2.5 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-black text-[#002D56]"><Paperclip className="mr-1 inline h-3.5 w-3.5" />{contextSummary}</p>
            <button type="button" onClick={onClearContext} disabled={selectedContextItems.length === 0} className="shrink-0 text-[11px] font-bold text-slate-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">Xóa tất cả</button>
          </div>
          {selectedContextItems.length > 0 && (
            <div className="mt-1 flex max-h-8 min-w-0 items-center gap-1.5 overflow-hidden">
              {selectedContextItems.slice(0, 2).map((item) => (
                <span key={item.id} className="inline-flex min-w-0 max-w-[170px] items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-blue-100">
                  <span className="truncate">{item.title || CONTEXT_LABELS[item.type]}</span>
                  <button type="button" onClick={() => onRemoveContext(item.id)} className="shrink-0 rounded-full text-slate-400 hover:text-red-600" aria-label="Bỏ context">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {selectedContextItems.length > 2 && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-600 ring-1 ring-blue-100">+{selectedContextItems.length - 2}</span>}
            </div>
          )}
        </div>
        <div className="flex min-w-0 items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 focus-within:border-[#002D56] focus-within:bg-white">
          <textarea
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Nhập câu hỏi hoặc yêu cầu biên tập…"
            rows={2}
            className="min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none"
          />
          <button type="button" disabled={isBusy || !inputValue.trim()} onClick={onSubmitPrompt} className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#002D56] text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:opacity-70" aria-label="Gửi câu hỏi hoặc yêu cầu biên tập">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Nội dung chỉ thay đổi khi bạn bấm Áp dụng.</p>
      </footer>
    </section>
  );
}
