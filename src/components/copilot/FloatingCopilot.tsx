import React from "react";
import { 
  Bot, 
  Maximize2, 
  Minimize2, 
  X, 
  MessageCircle, 
  Send, 
  Loader2, 
  FileText, 
  Check, 
  RotateCcw, 
  Copy, 
  Paperclip, 
  BookOpen, 
  Link as LinkIcon, 
  FileUp, 
  Type, 
  Sparkles 
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SourceModeBar } from "../assistant/SourceModeBar";
import { AssistantMessageList } from "../assistant/AssistantMessageList";
import type { 
  AssistantMessage, 
  AssistantSourceMode 
} from "../assistant/assistantTypes";

// Exported types expected by other components in the workspace
export type CopilotViewMode = "collapsed" | "expanded" | "fullscreen";

export type CopilotCommandId = string;

export interface CopilotCommand {
  id: CopilotCommandId;
  label: string;
  description?: string;
  prompt?: string;
  disabled?: boolean;
  [key: string]: any;
}

export interface CopilotContextItem {
  id: string;
  type: any;
  content?: string;
  title: any;
  excerpt?: string;
  blockId?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface CopilotChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: number;
  isContextAdvice?: boolean;
}

export interface CopilotDraftFlowState {
  kind: string;
  kindOptions: Array<{ value: string; label: string }>;
  targetGroup?: "communication_content" | "review_improvement" | "administrative_document";
  brief: string;
  extraNotes: string;
  templates?: Array<{
    id: string;
    name: string;
    groupLabel?: string;
    nonAiLabel?: string;
    description?: string;
    reason?: string;
    missingInputs?: string[];
    previewLines?: string[];
  }>;
  selectedTemplateId?: string;
  sourceSummary?: string;
  error?: string | null;
}

export interface CopilotSourceFlowState {
  sourceSummary: string;
  selectedSources: Array<{ id: string; title: string; excerpt?: string }>;
  totalSelectedCount: number;
}

export interface CopilotProposal {
  id?: string;
  commandId?: string;
  title?: string;
  note?: string;
  currentText?: string;
  proposedText?: string;
  canApply?: boolean;
  executionResult?: any;
  [key: string]: any;
}

export interface FloatingCopilotProps {
  viewMode: CopilotViewMode;
  dockMode?: "floating" | "rail" | "sidebar";
  selectedContextItems: CopilotContextItem[];
  commands: CopilotCommand[];
  activeCommandId: CopilotCommandId | null;
  pendingProposal: CopilotProposal | null;
  statusMessage: string | null;
  inputValue: string;
  isBusy?: boolean;
  chatMessages?: CopilotChatMessage[];
  draftFlow: CopilotDraftFlowState | null;
  sourceFlow: CopilotSourceFlowState | null;
  sourceMode?: AssistantSourceMode;
  historyFlow?: {
    isOpen: boolean;
    versions: Array<{
      id: string;
      versionNumber: number;
      createdAt: number;
      note?: string;
      content?: string;
    }>;
    onRestoreVersion?: (version: any) => void;
    onClose: () => void;
  } | null;
  publishSettingsFlow?: {
    isOpen: boolean;
    onClose: () => void;
  } | null;
  onSourceModeChange?: (mode: AssistantSourceMode) => void;
  onDraftFlowChange?: (patch: Partial<CopilotDraftFlowState>) => void;
  onSubmitDraftFlow?: () => void;
  onGenerateTemplateSkeleton?: () => void;
  onCancelDraftFlow?: () => void;
  onOpenSourceWorkspace?: (tab: "library" | "text" | "link" | "upload") => void;
  onCancelSourceFlow?: () => void;
  onCopyProposal?: () => void;
  onOpen: () => void;
  onClose: () => void;
  onFullscreen: () => void;
  onReturnToCanvas: () => void;
  onRemoveContext?: (id: string) => void;
  onClearContext?: () => void;
  onRunCommand: (id: CopilotCommandId, prompt?: string) => void;
  onInputChange: (value: string) => void;
  onSubmitPrompt: () => void;
  onSubmitSuggestion?: (prompt: string) => void;
  onApplyProposal?: () => void;
  onCancelProposal?: () => void;
  onOpenHistory?: () => void;
  onChooseTemplate?: () => void;
}

const CONTEXT_TYPE_LABELS: Record<string, string> = {
  paragraph: "đoạn văn",
  heading: "tiêu đề bài",
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
  if (items.length === 1) return "Đang hỏi theo đoạn đã chọn";
  return `Đang hỏi theo ${items.length} đoạn đã chọn`;
}

function getSourceModeStatus(
  mode: AssistantSourceMode,
  items: CopilotContextItem[],
  draftFlow: any,
  sourceFlow: any,
  pendingProposal: any
): string {
  // First prioritize Action Flow
  if (pendingProposal) {
    return "Đề xuất đã sẵn sàng";
  }
  if (draftFlow) {
    if (draftFlow.selectedTemplateId) {
      return "Đang chọn mẫu bản thảo";
    }
    return "Đang soạn văn bản mới";
  }
  if (sourceFlow) {
    return "Đang thêm nguồn tư liệu";
  }

  // If no action flow, show source/context
  if (mode === "canvas" || mode === "quick") {
    if (items.length === 0) return "Đang hỏi chung về bản thảo";
    if (items.length === 1) return "Đang hỏi theo đoạn đã chọn";
    return `Đang hỏi theo ${items.length} đoạn đã chọn`;
  }
  if (mode === "articles") return "Đang hỏi theo Bài viết";
  if (mode === "library") return "Đang hỏi theo Kho tư liệu";
  if (mode === "tasks") return "Đang hỏi theo Công việc";

  return "Đang hỏi chung về bản thảo";
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

function splitDockCommands(commands: CopilotCommand[], selectedContextItems: CopilotContextItem[]): { primaryCommands: CopilotCommand[]; overflowCommands: CopilotCommand[] } {
  const hasBlockSelected = selectedContextItems.some(item => item.blockId || ["paragraph", "heading", "selection", "table", "figure"].includes(item.type));
  const isNoDraft = commands.some(c => c.id === "draft_new");

  let preferredOrder: string[] = [];
  if (hasBlockSelected) {
    // Đang chọn block
    const tableOrFigure = selectedContextItems.some(item => ["table", "figure"].includes(item.type));
    if (tableOrFigure) {
      preferredOrder = ["create_caption", "figure_caption", "normalize_caption_title", "check_table_numbers", "check_missing_source_or_caption"];
    } else {
      preferredOrder = ["rewrite_selection", "fix_selection", "shorten_selection"];
    }
  } else if (isNoDraft) {
    // Chưa có bản thảo
    preferredOrder = ["draft_new", "add_source", "choose_template"];
  } else {
    // Có bản thảo, chưa chọn block
    preferredOrder = ["review_current_draft", "check_missing_source_or_caption", "add_source"];
  }

  const primaryCommands: CopilotCommand[] = [];
  const overflowCommands: CopilotCommand[] = [];

  // Filter existing commands to fit preferred block list
  const primaryCandidates = preferredOrder.map(id => commands.find(c => c.id === id)).filter((c): c is CopilotCommand => Boolean(c));
  
  // We want to fill exactly up to 3 slots for primary from the candidates
  primaryCandidates.slice(0, 3).forEach(c => primaryCommands.push(c));

  // If primary has less than 3, we can fill with other random commands except "more"
  commands.forEach(command => {
    if (command.id === "more" || primaryCommands.some(pc => pc.id === command.id)) return;
    if (primaryCommands.length < 3) {
      primaryCommands.push(command);
    } else {
      overflowCommands.push(command);
    }
  });

  // Collect the rest into overflow
  commands.forEach(command => {
    if (command.id === "more") return;
    if (!primaryCommands.some(pc => pc.id === command.id) && !overflowCommands.some(oc => oc.id === command.id)) {
      overflowCommands.push(command);
    }
  });

  const moreCmd = commands.find(c => c.id === "more");
  if (moreCmd) {
    overflowCommands.push(moreCmd);
  }

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
  historyFlow,
  publishSettingsFlow,
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
  const sourceModeStatus = getSourceModeStatus(sourceMode, selectedContextItems, draftFlow, sourceFlow, pendingProposal);
  const isDraftBriefMissing = Boolean(draftFlow) && !draftFlow?.brief.trim();
  const { primaryCommands, overflowCommands } = splitDockCommands(commands, selectedContextItems);
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
          "z-50 flex items-center justify-center bg-[#002D56] text-white shadow-2xl shadow-slate-900/20 transition hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-200",
          dockMode === "rail"
            ? "h-full w-full rounded-none px-2 [writing-mode:vertical-rl]"
            : "fixed bottom-5 right-5 h-14 w-14 rounded-full",
        )}
        aria-label="Mở Copilot biên tập"
      >
        {dockMode === "rail" ? <span className="text-[11px] font-black uppercase tracking-[0.18em]">Trợ lý</span> : <MessageCircle className="h-6 w-6" />}
        {selectedContextItems.length > 0 && (
          <span className={cn(
            "absolute rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-slate-900 shadow-sm",
            dockMode === "rail" ? "left-1 top-2 [writing-mode:horizontal-tb]" : "-top-1 -left-1",
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

  const renderDraftFlowForm = () => {
    if (!draftFlow) return null;
    return (
      <div className="mt-2.5 rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
          <span className="text-[#002D56]"><FileText className="h-4.5 w-4.5" /></span>
          <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Soạn văn bản mới</p>
        </div>
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-slate-600">Loại văn bản
            <select
              value={draftFlow.kind}
              onChange={(event) => onDraftFlowChange?.({ kind: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#002D56] focus:bg-white"
            >
              {draftFlow.kindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          
          <div className="rounded-lg border border-slate-200 bg-slate-50/55 p-2">
            <p className="px-1 text-[9.5px] font-black uppercase tracking-[0.14em] text-slate-400">Chọn nhanh nhóm bài</p>
            <div className="mt-1.5 grid gap-1.5 grid-cols-3">
              {[
                { group: "communication_content" as const, label: "Truyền thông" },
                { group: "review_improvement" as const, label: "Rà soát" },
                { group: "administrative_document" as const, label: "Hành chính" },
              ].map((item) => (
                <button
                  key={item.group}
                  type="button"
                  onClick={() => onDraftFlowChange?.({ targetGroup: item.group })}
                  className={cn(
                    "rounded-lg border py-1.5 text-center transition hover:border-[#002D56] hover:bg-white focus:outline-none text-[11px]",
                    draftFlow.targetGroup === item.group ? "border-[#002D56] bg-white font-black text-[#002D56]" : "border-slate-250 bg-white/50 text-slate-700 font-semibold",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-bold text-slate-600">Yêu cầu / bối cảnh
            <textarea
              value={draftFlow.brief}
              onChange={(event) => onDraftFlowChange?.({ brief: event.target.value })}
              placeholder="VD: Soạn tin website về công tác bảo đảm an toàn hàng hải..."
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-850 outline-none focus:border-[#002D56] focus:bg-white leading-relaxed"
            />
          </label>
          
          <label className="block text-xs font-bold text-slate-600">Ý chính bổ sung (tùy chọn)
            <textarea
              value={draftFlow.extraNotes}
              onChange={(event) => onDraftFlowChange?.({ extraNotes: event.target.value })}
              placeholder="Gạch đầu dòng ý chính, số liệu..."
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-850 outline-none focus:border-[#002D56] focus:bg-white leading-relaxed"
            />
          </label>

          <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#002D56]">Tạo bằng AI</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">Dựng bản thảo chi tiết dựa trên bối cảnh và nguồn tư liệu đã chọn.</p>
            <button
              type="button"
              onClick={onSubmitDraftFlow}
              disabled={isBusy || isDraftBriefMissing}
              className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg bg-[#002D56] px-4 py-2 text-xs font-black text-white hover:bg-slate-900 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Bắt đầu tạo bằng AI
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Dựng theo mẫu có sẵn</p>
              {draftFlow.templates && draftFlow.templates.length > 0 && <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-500 ring-1 ring-slate-200">{draftFlow.templates.length} mẫu</span>}
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Không dùng AI, dựng khung sườn trực tiếp lên Canvas.</p>

            {draftFlow.templates && draftFlow.templates.length > 0 ? (
              <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                {draftFlow.templates.slice(0, 3).map((template) => (
                  <label
                    key={template.id}
                    className={cn(
                      "block cursor-pointer rounded-lg border p-2 shadow-xs transition hover:border-[#002D56]",
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
                    <div className="flex items-start gap-1.5">
                      <div className={cn(
                        "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                        draftFlow.selectedTemplateId === template.id ? "border-[#002D56] bg-[#002D56]" : "border-slate-300"
                      )}>
                        {draftFlow.selectedTemplateId === template.id && <div className="h-1 w-1 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[11.5px] font-black text-slate-900 leading-tight block">{template.name}</span>
                        <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-normal text-slate-500">{template.reason || template.description || "Phù hợp để dựng nhanh khung sườn."}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-lg bg-white px-2 py-1.5 text-[10.5px] font-semibold text-slate-500 ring-1 ring-slate-200/60">Nhập yêu cầu để nhận gợi ý mẫu tương thích.</p>
            )}

            {draftFlow.selectedTemplateId && onGenerateTemplateSkeleton && (
              <button
                type="button"
                onClick={onGenerateTemplateSkeleton}
                disabled={isBusy}
                className="mt-2.5 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border-2 border-[#002D56] bg-white px-4 py-2 text-xs font-black text-[#002D56] hover:bg-blue-50 transition"
              >
                Dựng khung theo mẫu này
              </button>
            )}
          </section>

          <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-slate-500 leading-normal">{draftFlow.sourceSummary}</p>
          {(draftFlow.error || isDraftBriefMissing) && (
            <p className={cn("text-[10.5px] font-bold leading-normal", draftFlow.error ? "text-red-600" : "text-amber-600")}>
              {draftFlow.error || "Vui lòng nhập bối cảnh / yêu cầu."}
            </p>
          )}

          <button
            type="button"
            onClick={onCancelDraftFlow}
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Quay lại hỏi nhanh / Hủy soạn mới
          </button>
        </div>
      </div>
    );
  };

  const renderSourceFlowForm = () => {
    if (!sourceFlow) return null;
    return (
      <div className="mt-2.5 rounded-xl border border-blue-155 bg-white p-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[#002D56]"><BookOpen className="h-4.5 w-4.5" /></span>
            <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Thêm nguồn tư liệu</p>
          </div>
          <button type="button" onClick={onCancelSourceFlow} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng luồng nguồn">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-600 leading-normal">{sourceFlow.sourceSummary}</p>
        
        {sourceFlow.selectedSources.length > 0 && (
          <div className="mt-2 space-y-1">
            {sourceFlow.selectedSources.slice(0, 2).map((source) => (
              <div key={source.id} className="rounded-lg border border-blue-50 bg-blue-50/20 px-2 py-1">
                <p className="truncate text-[11px] font-black text-slate-800">{source.title}</p>
              </div>
            ))}
            {(sourceFlow.totalSelectedCount || sourceFlow.selectedSources.length) > 2 && (
              <p className="text-[10px] font-bold text-slate-400 pl-1">+{(sourceFlow.totalSelectedCount || sourceFlow.selectedSources.length) - 2} nguồn khác đã chọn</p>
            )}
          </div>
        )}
        
        <div className="mt-3 grid grid-cols-2 gap-1.5">
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
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-2 py-1 text-[11px] font-bold text-slate-705 hover:border-[#002D56] hover:bg-blue-5/10 transition"
            >
              <option.icon className="h-3.5 w-3.5 text-[#002D56] shrink-0" />
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancelSourceFlow}
          className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Quay lại hỏi nhanh / Hủy thêm nguồn
        </button>
      </div>
    );
  };

  const renderProposalBlock = () => {
    if (!pendingProposal) return null;
    return (
      <div className={cn("mt-2 rounded-xl border p-3 shadow-xs", pendingProposal.canApply ? "border-emerald-100 bg-emerald-50/40" : "border-slate-205 bg-slate-50/50")}>
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-950 uppercase tracking-wide">{pendingProposal.title}</p>
            {pendingProposal.executionResult && (
              <p className="mt-0.5 text-[10.5px] font-bold text-emerald-850">
                {pendingProposal.executionResult.source === "rule"
                  ? "Đề xuất tự động bằng Rule"
                  : `Trợ lý AI${pendingProposal.executionResult.model ? ` · ${pendingProposal.executionResult.model}` : ""}`}
              </p>
            )}
          </div>
          <span className={cn(
            "rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
            pendingProposal.executionResult?.source === "ai" ? "bg-purple-100 text-purple-700" : "bg-emerald-100 text-emerald-700",
          )}>
            {pendingProposal.executionResult?.source === "ai" ? "Trợ lý AI" : "Tự động"}
          </span>
        </div>
        {!pendingProposal.canApply && <p className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">Đề xuất tham khảo</p>}
        {pendingProposal.note && <p className="mt-1.5 text-[11px] font-semibold text-emerald-800 leading-normal">{pendingProposal.note}</p>}
        
        {pendingProposal.currentText && (
          <div className="mt-2.5 rounded-lg bg-white p-2.5 border border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nội dung hiện tại</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-650">{pendingProposal.currentText}</p>
          </div>
        )}
        <div className="mt-2 rounded-lg bg-white p-2.5 border border-emerald-100/50">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{pendingProposal.canApply ? "Đề xuất thay thế mới" : "Nội dung phản hồi"}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800 font-medium">{pendingProposal.proposedText}</p>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pendingProposal.canApply ? (
            <>
              <button type="button" disabled={isBusy} onClick={onApplyProposal} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                <Check className="h-3 w-3" /> Áp dụng
              </button>
              <button type="button" onClick={onCancelProposal} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition">
                <RotateCcw className="h-3 w-3" /> Từ chối
              </button>
              <button type="button" onClick={onCopyProposal} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onCopyProposal} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition">
                <Copy className="h-3 w-3" /> Sao chép
              </button>
              <button type="button" onClick={onCancelProposal} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition">
                <RotateCcw className="h-3 w-3" /> Đã xem
              </button>
            </>
          )}
          <button type="button" onClick={() => onInputChange("Hãy điều chỉnh đề xuất này: ")} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-50 transition">
            Sửa tiếp
          </button>
        </div>
      </div>
    );
  };

  const renderHistoryFlowForm = () => {
    if (!historyFlow) return null;
    return (
      <div className="space-y-3 bg-white p-1" data-export-exclude="true">
        <div className="flex items-center justify-between gap-1.5 border-b border-slate-150 pb-2">
          <p className="text-xs font-black text-[#002D56] uppercase tracking-wider">Lịch sử phiên bản</p>
          <button
            type="button"
            onClick={historyFlow.onClose}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition"
          >
            Quay lại
          </button>
        </div>
        
        {historyFlow.versions && historyFlow.versions.length > 0 ? (
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5">
            {historyFlow.versions.map((ver, idx) => (
              <div
                key={ver.id || idx}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 shadow-2xs transition hover:border-[#002D56] hover:bg-white"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div>
                    <p className="text-xs font-black text-[#002D56] leading-tight">Phiên bản #{ver.versionNumber}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                      {new Date(ver.createdAt).toLocaleString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </p>
                  </div>
                  {historyFlow.onRestoreVersion && (
                    <button
                      type="button"
                      onClick={() => historyFlow.onRestoreVersion?.(ver)}
                      className="rounded-md bg-[#002D56] px-2 py-1 text-[10px] font-black text-white hover:bg-slate-900 transition"
                    >
                      Khôi phục
                    </button>
                  )}
                </div>
                {ver.note && (
                  <p className="mt-1.5 text-[10.5px] font-semibold text-slate-600 leading-normal bg-white border border-slate-100 rounded px-1.5 py-0.5 max-w-full truncate">
                    {ver.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs font-semibold text-slate-400 leading-relaxed">
            Chưa có phiên bản đã lưu cho bản thảo này.
          </div>
        )}

        <button
          type="button"
          onClick={historyFlow.onClose}
          className="inline-flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-4 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
        >
          Quay lại hỏi nhanh
        </button>
      </div>
    );
  };

  const renderPublishSettingsFlowForm = () => {
    if (!publishSettingsFlow) return null;
    return (
      <div className="space-y-3 bg-white p-1" data-export-exclude="true">
        <div className="flex items-center justify-between gap-1.5 border-b border-slate-150 pb-2">
          <p className="text-xs font-black text-[#002D56] uppercase tracking-wider">Cài đặt xuất bản</p>
          <button
            type="button"
            onClick={publishSettingsFlow.onClose}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition"
          >
            Quay lại
          </button>
        </div>
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/55 p-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tham số trình bày A4</p>
            <div className="space-y-1 text-[10.5px] font-semibold text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400">Khổ giấy:</span>
                <span className="font-extrabold text-[#002D56]">A4 Standard (210 x 297mm)</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400">Căn lề (Margins):</span>
                <span className="font-extrabold text-[#002D56]">Chuẩn Bộ Nội vụ (20mm - 25mm)</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400">Canh lề văn bản:</span>
                <span className="font-extrabold text-[#002D56]">Justified (Đều hai bên)</span>
              </div>
              <div className="flex justify-between pb-0.5">
                <span className="text-slate-400">Phân cấp đầu mục:</span>
                <span className="font-extrabold text-[#002D56]">Tự động chuẩn hóa</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#002D56]">Quy tắc biên tập kỹ thuật</p>
            <ul className="list-disc pl-4 text-[10.5px] font-semibold text-slate-600 space-y-1 leading-relaxed">
              <li>Tự động nhận diện và gán Caption cho bảng biểu và hình ảnh.</li>
              <li>Loại bỏ hoàn toàn các marker rác kỹ thuật như <code className="bg-slate-50 border border-slate-200 text-red-650 px-1 rounded font-mono text-[9px]">[PLACEHOLDER]</code>.</li>
              <li>Hỗ trợ phân trang thông minh (Page-break) linh hoạt khi in ấn.</li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={publishSettingsFlow.onClose}
          className="inline-flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-250 bg-white px-4 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50 transition"
        >
          Quay lại hỏi nhanh
        </button>
      </div>
    );
  };

  const renderActiveMainContentBlock = () => {
    if (pendingProposal) {
      return renderProposalBlock();
    }
    if (historyFlow && historyFlow.isOpen) {
      return renderHistoryFlowForm();
    }
    if (publishSettingsFlow && publishSettingsFlow.isOpen) {
      return renderPublishSettingsFlowForm();
    }
    if (draftFlow) {
      return renderDraftFlowForm();
    }
    if (sourceFlow) {
      return renderSourceFlowForm();
    }
    return (
      <AssistantMessageList
        messages={assistantMessages}
        isLoading={isBusy}
        emptyMessage={
          selectedContextItems.length > 0
            ? "Yêu cầu rà soát hoặc điều chỉnh đoạn đang chọn."
            : "Hãy nhập câu hỏi chung hoặc hành động nhanh:"
        }
        suggestions={["Tóm tắt", "Nhận xét", "Viết lại", "Kiểm tra lỗi"]}
        onSuggestionSelect={handleSuggestionSelect}
        compact={selectedContextItems.length > 0}
      />
    );
  };

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
      {!isSidebarDocked && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#002D56]">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[10.5px] font-black uppercase tracking-[0.12em] text-[#002D56]">Trợ lý biên tập</p>
                <p className="truncate text-[9.5px] font-semibold text-slate-400">Copilot thông minh</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {isFullscreen ? (
              <button type="button" onClick={onReturnToCanvas} className="rounded-md px-2 py-1.5 text-[10px] font-black text-[#002D56] hover:bg-blue-50 uppercase tracking-wider">
                <Minimize2 className="mr-1 inline h-3.5 w-3.5" /> Thu gọn
              </button>
            ) : (
              <button type="button" onClick={onFullscreen} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Mở toàn màn hình">
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label="Đóng Copilot">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}

      {onSourceModeChange && (
        <SourceModeBar value={sourceMode} onChange={onSourceModeChange} />
      )}

      {/* Conditionally hide the quick action bar if a dynamic flow is currently active to avoid user distraction */}
      {(!draftFlow && !sourceFlow && !pendingProposal && !historyFlow?.isOpen && !publishSettingsFlow?.isOpen) && (
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
                  "inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl border px-3 py-1.5 text-[11px] font-black transition touch-manipulation",
                  activeCommandId === command.id ? "border-[#002D56] bg-blue-50 text-[#002D56]" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-blue-50",
                  command.disabled && "cursor-not-[#002D56] border-slate-200 bg-slate-100 text-slate-400 opacity-70 hover:bg-slate-100",
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
                  "inline-flex min-h-10 min-w-0 items-center justify-center rounded-xl border px-3 py-1.5 text-[11px] font-black transition touch-manipulation",
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
                      command.disabled && "cursor-not-allowed bg-slate-50 text-slate-400 opacity-80 hover:bg-slate-55",
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
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 custom-scrollbar">
        {statusMessage && (
          <div className={cn(
            "rounded-xl border px-3 py-1.5 text-[11px] font-bold leading-relaxed shadow-2xs mb-2",
            /lỗi|không thể|không tìm|thất bại|error/u.test(statusMessage.toLowerCase())
              ? "border-red-200 bg-red-50 text-red-750"
              : /hãy|vui lòng|chưa|cần|thiếu/u.test(statusMessage.toLowerCase()) && !statusMessage.startsWith("Đã")
                ? "border-amber-250 bg-amber-50 text-amber-800"
                : statusMessage.startsWith("Đã")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-750"
                  : "border-slate-200 bg-slate-50 text-slate-700",
          )}>
            {statusMessage}
          </div>
        )}
        {renderActiveMainContentBlock()}
        {/* Helper bottom spacing to ensure scrolled flow contents are fully visible */}
        <div className="h-20" />
      </div>

      <footer className="shrink-0 border-t border-slate-100 bg-white p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {selectedContextItems.length > 0 && (
          <div className="mb-1 flex items-center justify-between gap-1.5 rounded-lg border border-blue-100/50 bg-blue-50/40 px-2 py-0.5">
            <p className="min-w-0 truncate text-[10px] font-bold text-[#002D56]">
              <Paperclip className="mr-1 inline h-2.5 w-2.5 shrink-0 opacity-70" />
              Đã chọn {selectedContextItems.length === 1 ? "1 đoạn" : `${selectedContextItems.length} đoạn`}
            </p>
            <button type="button" onClick={onClearContext} className="shrink-0 p-0.5 text-slate-400 hover:text-red-700 transition-colors" title="Bỏ chọn tất cả">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <div className="flex min-w-0 items-end gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1 focus-within:border-[#002D56] focus-within:bg-white transition-all shadow-3xs">
          <textarea
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Nhập câu hỏi hoặc yêu cầu biên tập…"
            rows={1}
            className="min-h-8 max-h-24 min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-xs text-slate-850 outline-none leading-relaxed"
          />
          <button 
            type="button" 
            disabled={isBusy || !inputValue.trim()} 
            onClick={onSubmitPrompt} 
            className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#002D56] text-white hover:bg-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm" 
            aria-label="Gửi câu hỏi hoặc yêu cầu biên tập"
          >
            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
        <p className="mt-1 text-center text-[9px] leading-tight text-slate-400 uppercase tracking-widest opacity-60">Nội dung chỉ thay đổi khi bạn bấm Áp dụng</p>
      </footer>
    </section>
  );
}
