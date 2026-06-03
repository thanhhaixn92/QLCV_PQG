import React from "react";
import { cn } from "../../lib/utils";
import type { AssistantSourceMode, AssistantSourceModeOption } from "./assistantTypes";

export const ASSISTANT_SOURCE_MODES: AssistantSourceModeOption[] = [
  { id: "quick", label: "Hỏi nhanh" },
  { id: "canvas", label: "Canvas" },
  { id: "library", label: "Kho tư liệu" },
  { id: "tasks", label: "Công việc" },
  { id: "articles", label: "Bài viết" },
];

interface SourceModeBarProps {
  value: AssistantSourceMode;
  onChange: (mode: AssistantSourceMode) => void;
  statusText?: string;
}

export function SourceModeBar({ value, onChange, statusText }: SourceModeBarProps) {
  return (
    <div className="space-y-2 border-b border-slate-100 bg-white px-3 py-2" data-assistant-source-mode="true">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {ASSISTANT_SOURCE_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={cn(
              "min-h-8 rounded-lg border px-2 py-1.5 text-[11px] font-black transition",
              value === mode.id
                ? "border-[#002D56] bg-blue-50 text-[#002D56]"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      {statusText && <p className="truncate text-xs font-semibold leading-5 text-slate-500" title={statusText}>{statusText}</p>}
    </div>
  );
}
