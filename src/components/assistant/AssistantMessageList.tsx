import React from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { AssistantMessage } from "./assistantTypes";
import { AssistantMessageBubble } from "./AssistantMessageBubble";

interface AssistantMessageListProps {
  messages: AssistantMessage[];
  isLoading?: boolean;
  emptyMessage: string;
  suggestions?: string[];
  onSuggestionSelect?: (value: string) => void;
  compact?: boolean;
}

export function AssistantMessageList({ 
  messages, 
  isLoading = false, 
  emptyMessage, 
  suggestions = [], 
  onSuggestionSelect,
  compact = false
}: AssistantMessageListProps) {
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  return (
    <div className="space-y-3">
      {messages.length === 0 && !isLoading ? (
        compact ? (
          <div className="rounded-lg bg-slate-50 border border-slate-150 p-2 text-center text-[10.5px] font-bold text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-150 bg-white/50 p-2.5 text-xs text-slate-500 shadow-3xs">
            <p className="font-semibold text-slate-500 mb-1.5 leading-relaxed">{emptyMessage}</p>
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1 bg-transparent">
                <p className="text-[9px] uppercase font-black tracking-wider text-slate-400">Gợi ý nhanh:</p>
                <div className="grid grid-cols-2 gap-1 bg-transparent">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSuggestionSelect?.(suggestion)}
                      className="w-full text-left rounded-lg border border-slate-205 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50/50 hover:text-[#002D56] transition min-h-7 inline-flex items-center touch-manipulation shadow-3xs truncate"
                      title={suggestion}
                    >
                      ✦ {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        messages.map((message) => <AssistantMessageBubble key={message.id} message={message} />)
      )}
      {isLoading && (
        <div className="flex justify-start gap-2">
          <div className="flex max-w-[84%] items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-[#002D56]" />
            Đang suy nghĩ…
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
