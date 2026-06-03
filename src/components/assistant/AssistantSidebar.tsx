import React from "react";
import { Bot, PanelLeftOpen, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface AssistantSidebarProps {
  isOpen: boolean;
  moduleStatus: string;
  contextPane: React.ReactNode;
  chatPane: React.ReactNode;
  onOpen: () => void;
  onClose: () => void;
}

export function AssistantSidebar({ isOpen, moduleStatus, contextPane, chatPane, onOpen, onClose }: AssistantSidebarProps) {
  return (
    <>
      {!isOpen && (
        <button
          type="button"
          data-export-exclude="true"
          data-assistant-sidebar-toggle="true"
          onClick={onOpen}
          className="absolute left-0 top-4 z-40 inline-flex min-h-11 items-center gap-2 border border-l-0 border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-[0.14em] text-[#002D56] shadow-sm hover:bg-blue-50"
          aria-label="Mở Trợ lý Hoa Tiêu"
        >
          <PanelLeftOpen className="h-4 w-4" />
          Trợ lý
        </button>
      )}

      {isOpen && (
        <button
          type="button"
          data-export-exclude="true"
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] sm:hidden"
          onClick={onClose}
          aria-label="Đóng nền Trợ lý Hoa Tiêu"
        />
      )}

      <aside
        data-export-exclude="true"
        data-assistant-sidebar="true"
        className={cn(
          "absolute bottom-0 left-0 top-0 z-40 flex w-[min(92vw,420px)] max-w-[440px] flex-col border-r border-slate-200 bg-slate-50 text-slate-800 transition-transform duration-200 ease-out sm:w-[400px] xl:w-[420px]",
          "shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+1rem)]",
          "max-sm:fixed max-sm:inset-y-0 max-sm:left-0 max-sm:w-[88vw] max-sm:max-w-none",
        )}
        aria-label="Trợ lý Hoa Tiêu"
        aria-hidden={!isOpen}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#002D56]">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-[#002D56]">Trợ lý Hoa Tiêu</h2>
              <p className="truncate text-xs font-semibold text-slate-500">{moduleStatus}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng Trợ lý Hoa Tiêu">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          {contextPane}
          {chatPane}
        </div>
      </aside>
    </>
  );
}
