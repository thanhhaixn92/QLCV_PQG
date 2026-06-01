import React from "react";
import {
  Bot,
  Check,
  Copy,
  Edit3,
  FileText,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { EditorialExecutionResult } from "../../types/editorialExecution";

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

export interface CopilotDraftFlowState {
  kind: string;
  kindOptions: Array<{ value: string; label: string }>;
  brief: string;
  extraNotes: string;
  sourceSummary: string;
  error?: string | null;
}

export interface CopilotManualEditState {
  contextTitle: string;
  currentText: string;
  value: string;
  error?: string | null;
}

export interface CopilotCommand {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface FloatingCopilotProps {
  viewMode: CopilotViewMode;
  selectedContextItems: CopilotContextItem[];
  commands: CopilotCommand[];
  activeCommandId?: string | null;
  pendingProposal?: CopilotProposal | null;
  statusMessage?: string | null;
  inputValue: string;
  isBusy?: boolean;
  draftFlow?: CopilotDraftFlowState | null;
  manualEdit?: CopilotManualEditState | null;
  autoOpenOnSelect: boolean;
  onToggleAutoOpenOnSelect: (value: boolean) => void;
  onDraftFlowChange?: (patch: Partial<CopilotDraftFlowState>) => void;
  onSubmitDraftFlow?: () => void;
  onStartManualEdit?: (contextId?: string) => void;
  onManualEditChange?: (value: string) => void;
  onApplyManualEdit?: () => void;
  onCancelManualEdit?: () => void;
  onCopyProposal?: () => void;
  onOpen: () => void;
  onClose: () => void;
  onFullscreen: () => void;
  onReturnToCanvas: () => void;
  onRemoveContext: (id: string) => void;
  onClearContext: () => void;
  onRunCommand: (id: string) => void;
  onInputChange: (value: string) => void;
  onSubmitPrompt: () => void;
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

function summarizeContext(items: CopilotContextItem[]): string {
  if (items.length === 0) return "Chưa chọn ngữ cảnh";
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const label = CONTEXT_LABELS[item.type] || "nội dung";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return `Đã chọn: ${Object.entries(counts).map(([label, count]) => `${count} ${label}`).join(", ")}`;
}

export function FloatingCopilot({
  viewMode,
  selectedContextItems,
  commands,
  activeCommandId,
  pendingProposal,
  statusMessage,
  inputValue,
  isBusy = false,
  draftFlow,
  manualEdit,
  autoOpenOnSelect,
  onToggleAutoOpenOnSelect,
  onDraftFlowChange,
  onSubmitDraftFlow,
  onStartManualEdit,
  onManualEditChange,
  onApplyManualEdit,
  onCancelManualEdit,
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
  onApplyProposal,
  onCancelProposal,
}: FloatingCopilotProps) {
  const contextSummary = summarizeContext(selectedContextItems);

  if (viewMode === "collapsed") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#002D56] text-white shadow-2xl shadow-slate-900/25 transition hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-200"
        aria-label="Mở Copilot biên tập"
      >
        <MessageCircle className="h-6 w-6" />
        {selectedContextItems.length > 0 && (
          <span className="absolute -top-2 -left-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-slate-900 shadow-sm">
            {selectedContextItems.length} nội dung
          </span>
        )}
      </button>
    );
  }

  const isFullscreen = viewMode === "fullscreen";

  return (
    <section
      className={cn(
        "fixed flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl shadow-slate-900/20",
        isFullscreen
          ? "inset-0 z-[70] h-[100dvh] w-screen max-w-none rounded-none"
          : "bottom-5 right-5 top-[92px] z-40 w-[min(420px,calc(100vw-2rem))] rounded-2xl",
      )}
      aria-label="Trợ lý Canvas thông minh"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#002D56]">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-black uppercase tracking-[0.16em] text-[#002D56]">Trợ lý biên tập</p>
              <p className="text-xs font-medium text-slate-500">Trợ lý Canvas thông minh</p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isFullscreen ? (
            <button type="button" onClick={onReturnToCanvas} className="rounded-lg px-3 py-2 text-xs font-bold text-[#002D56] hover:bg-blue-50">
              <Minimize2 className="mr-1 inline h-4 w-4" /> Quay về Canvas
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
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[#002D56]"><Paperclip className="mr-1 inline h-4 w-4" />{contextSummary}</p>
            {selectedContextItems.length > 0 && (
              <button type="button" onClick={onClearContext} className="text-[11px] font-bold text-slate-500 hover:text-red-600">Bỏ chọn</button>
            )}
          </div>
          <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={autoOpenOnSelect}
              onChange={(event) => onToggleAutoOpenOnSelect(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#002D56]"
            />
            Tự mở Copilot khi chọn nội dung
          </label>
          {selectedContextItems.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedContextItems.map((item) => (
                <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-blue-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">{CONTEXT_LABELS[item.type]}</p>
                      <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{item.title}</p>
                    </div>
                    <button type="button" onClick={() => onRemoveContext(item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Bỏ context">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {item.excerpt && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600">{item.excerpt}</p>}
                  {item.blockId && onStartManualEdit && (
                    <button
                      type="button"
                      onClick={() => onStartManualEdit(item.id)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-[#002D56] hover:bg-blue-100"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Sửa thủ công
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><Sparkles className="h-4 w-4" /> Lệnh nhanh</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {commands.map((command) => (
              <button
                type="button"
                key={command.id}
                disabled={command.disabled || isBusy}
                onClick={() => onRunCommand(command.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  activeCommandId === command.id ? "border-[#002D56] bg-blue-50 text-[#002D56]" : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50",
                )}
              >
                <span className="block text-sm font-bold">{command.label}</span>
                {command.description && <span className="mt-1 block text-[11px] text-slate-500">{command.description}</span>}
              </button>
            ))}
          </div>
        </div>

        {draftFlow && (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <span className="rounded-xl bg-blue-50 p-2 text-[#002D56]"><FileText className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-black text-slate-900">Soạn văn bản mới</p>
                <p className="text-xs text-slate-500">Nhập yêu cầu ngay trong Copilot; Canvas chỉ hiển thị bản thảo sau khi tạo.</p>
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
              <label className="block text-xs font-bold text-slate-600">Yêu cầu / bối cảnh
                <textarea
                  value={draftFlow.brief}
                  onChange={(event) => onDraftFlowChange?.({ brief: event.target.value })}
                  placeholder="VD: Soạn tin website về công tác bảo đảm an toàn hàng hải..."
                  rows={4}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#002D56] focus:bg-white"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">Ý chính hoặc nguồn bổ sung (tùy chọn)
                <textarea
                  value={draftFlow.extraNotes}
                  onChange={(event) => onDraftFlowChange?.({ extraNotes: event.target.value })}
                  placeholder="Gạch đầu dòng ý chính, số liệu, tên nguồn..."
                  rows={3}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#002D56] focus:bg-white"
                />
              </label>
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{draftFlow.sourceSummary}</p>
              {draftFlow.error && <p className="text-xs font-bold text-red-600">{draftFlow.error}</p>}
              <button
                type="button"
                onClick={onSubmitDraftFlow}
                disabled={isBusy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#002D56] px-4 py-2.5 text-sm font-black text-white hover:bg-slate-900 disabled:opacity-60"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Tạo bản thảo
              </button>
            </div>
          </div>
        )}

        {manualEdit && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
            <p className="text-sm font-black text-amber-900">Sửa thủ công</p>
            <p className="mt-1 text-xs font-medium text-amber-800">{manualEdit.contextTitle}</p>
            <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-amber-100">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Nội dung hiện tại</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{manualEdit.currentText}</p>
            </div>
            <textarea
              value={manualEdit.value}
              onChange={(event) => onManualEditChange?.(event.target.value)}
              rows={6}
              className="mt-3 w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-amber-500"
            />
            {manualEdit.error && <p className="mt-2 text-xs font-bold text-red-600">{manualEdit.error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={onApplyManualEdit} disabled={isBusy || manualEdit.value.trim() === manualEdit.currentText.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
                <Check className="h-4 w-4" /> Áp dụng sửa thủ công
              </button>
              <button type="button" onClick={onCancelManualEdit} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                <RotateCcw className="h-4 w-4" /> Hủy
              </button>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{statusMessage}</div>
        )}

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

      <footer className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-[#002D56] focus-within:bg-white">
          <textarea
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Nhập yêu cầu cho Copilot…"
            rows={2}
            className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-800 outline-none"
          />
          <button type="button" disabled={isBusy || !inputValue.trim()} onClick={onSubmitPrompt} className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-[#002D56] text-white hover:bg-slate-900 disabled:opacity-50" aria-label="Gửi yêu cầu">
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><Trash2 className="h-3.5 w-3.5" /> Copilot chỉ áp dụng sửa nội dung sau khi bạn bấm Áp dụng.</p>
      </footer>
    </section>
  );
}
