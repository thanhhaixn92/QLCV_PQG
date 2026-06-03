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
}

export function AssistantMessageList({ messages, isLoading = false, emptyMessage, suggestions = [], onSuggestionSelect }: AssistantMessageListProps) {
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  return (
    <div className="space-y-3">
      {messages.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm leading-6 text-slate-600">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#002D56]">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="font-semibold">{emptyMessage}</p>
          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSuggestionSelect?.(suggestion)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-[#002D56]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
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
