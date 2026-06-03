import type React from "react";

export type AssistantSourceMode = "quick" | "canvas" | "library" | "tasks" | "articles";

export interface AssistantSourceModeOption {
  id: AssistantSourceMode;
  label: string;
  description?: string;
}

export type AssistantMessageRole = "user" | "assistant" | "system";

export interface AssistantMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
  createdAt?: number;
  isAdvisory?: boolean;
}

export interface AssistantContextSummaryItem {
  id: string;
  label: string;
  value: string;
  details?: string[];
  tone?: "neutral" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}
