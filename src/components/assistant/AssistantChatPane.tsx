import React from "react";

interface AssistantChatPaneProps {
  children: React.ReactNode;
}

export function AssistantChatPane({ children }: AssistantChatPaneProps) {
  return (
    <section className="flex-1 min-h-0 overflow-hidden bg-slate-50/40" aria-label="Chat hỗ trợ" data-export-exclude="true">
      {children}
    </section>
  );
}
