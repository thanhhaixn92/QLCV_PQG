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

 export function SourceModeBar({ value, onChange }: SourceModeBarProps) {
  return (
    <div className="border-b border-slate-100 bg-white px-2 py-1.5" data-assistant-source-mode="true" data-export-exclude="true">
      <div className="flex w-full rounded-md bg-slate-100/60 p-0.5">
        {ASSISTANT_SOURCE_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={cn(
              "flex-1 rounded py-1 px-0.5 text-center text-[10px] font-black uppercase tracking-wider transition-all",
              value === mode.id
                ? "bg-white text-[#002D56] shadow-3xs ring-1 ring-black/5"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-200/40",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
