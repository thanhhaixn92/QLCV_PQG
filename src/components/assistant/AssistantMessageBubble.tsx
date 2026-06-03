import React from "react";
import { Bot, Info, User } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AssistantMessage } from "./assistantTypes";
import { sanitizeAssistantMessageText } from "./assistantMessageUtils";

interface AssistantMessageBubbleProps {
  message: AssistantMessage;
}

export function AssistantMessageBubble({ message }: AssistantMessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const content = sanitizeAssistantMessageText(message.content);

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[92%] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-relaxed text-slate-600">
          <Info className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#002D56]">
          <Bot className="h-4 w-4" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[84%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-[#002D56] text-white"
            : message.isAdvisory
              ? "border border-amber-100 bg-amber-50 text-amber-900"
              : "border border-slate-100 bg-white text-slate-800",
        )}
      >
        {message.isAdvisory && !isUser && (
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-600">Tư vấn</p>
        )}
        <p className="whitespace-pre-wrap font-medium">{content}</p>
        {message.createdAt && (
          <p className={cn("mt-1 text-[10px] font-black opacity-60", isUser ? "text-right text-blue-200" : "text-slate-400")}>
            {new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      {isUser && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <User className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}
