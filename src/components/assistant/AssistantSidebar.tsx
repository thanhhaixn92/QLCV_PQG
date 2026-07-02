import React from "react";
import { Bot, PanelRightOpen, X } from "lucide-react";
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
          className="fixed right-0 top-1/2 z-50 inline-flex h-32 w-11 -translate-y-1/2 flex-col items-center justify-center gap-2 border-y border-l border-slate-200 bg-white text-[11px] font-black uppercase tracking-[0.12em] text-[#002D56] shadow-none transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
          aria-label="Mở Trợ lý Hoa Tiêu"
        >
          <PanelRightOpen className="h-4 w-4" />
          <span className="[writing-mode:vertical-rl]">Trợ lý</span>
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
          "fixed bottom-0 right-0 top-14 lg:top-0 z-40 flex flex-col border-l border-slate-200 bg-slate-50 text-slate-800 transition-transform duration-200 ease-out",
          "w-[90vw] sm:w-[380px] lg:w-[390px] xl:w-[400px] rounded-none shadow-sm",
          isOpen ? "translate-x-0" : "translate-x-[calc(100%+1rem)]",
        )}
        aria-label="Trợ lý Hoa Tiêu"
        aria-hidden={!isOpen}
      >
        <header className="flex h-12 min-h-[48px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#002D56]">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[11px] font-black text-[#002D56] uppercase tracking-wide">Trợ lý Hoa Tiêu MB</h2>
              <p className="truncate text-[10px] font-bold text-slate-400 opacity-80 leading-none">{moduleStatus}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors" aria-label="Đóng Trợ lý Hoa Tiêu">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col relative">
          {contextPane}
          {chatPane}
        </div>
      </aside>
    </>
  );
}
