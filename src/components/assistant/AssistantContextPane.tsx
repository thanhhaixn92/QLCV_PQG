import React from "react";
import { Activity, ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AssistantContextSummaryItem } from "./assistantTypes";

interface AssistantContextPaneProps {
  title?: string;
  items: AssistantContextSummaryItem[];
  children?: React.ReactNode;
}

const toneClassName: Record<NonNullable<AssistantContextSummaryItem["tone"]>, string> = {
  neutral: "border-slate-200 bg-white/80 text-slate-700",
  success: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  warning: "border-amber-200 bg-amber-50/80 text-amber-800",
  danger: "border-red-200 bg-red-50/80 text-red-700",
};

const fallbackIcons = [ShieldCheck, FileText, Activity, ClipboardCheck];

export function AssistantContextPane({ title = "Trung tâm hỗ trợ", items, children }: AssistantContextPaneProps) {
  return (
    <section className="min-h-0 flex-[1_1_0%] overflow-y-auto border-b border-slate-200 bg-slate-50 px-3 py-2.5 custom-scrollbar" aria-label={title}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-white/80 px-3 py-2.5 text-xs font-semibold leading-5 text-slate-500">
            Chưa có thông tin hỗ trợ trong phiên này.
          </div>
        ) : (
          items.map((item, index) => {
            const FallbackIcon = fallbackIcons[index % fallbackIcons.length];
            return (
              <div key={item.id} className={cn("rounded-md border px-2.5 py-2", toneClassName[item.tone || "neutral"])}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/70 text-current ring-1 ring-black/5">
                    {item.icon || <FallbackIcon className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-70">{item.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4">{item.value}</p>
                    {item.details && item.details.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-[10px] font-semibold leading-4 opacity-80">
                        {item.details.slice(0, 5).map((detail) => (
                          <li key={`${item.id}:${detail}`} className="truncate">• {detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
