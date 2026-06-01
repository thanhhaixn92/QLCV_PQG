export type EditorialExecutionSource = "rule" | "ai";

export type EditorialProposal =
  | {
      type: "replace_block";
      targetBlockId?: string;
      beforeText?: string;
      afterText: string;
      reason?: string;
    }
  | {
      type: "insert_before" | "insert_after";
      targetBlockId?: string;
      text: string;
      reason?: string;
    }
  | {
      type: "add_caption";
      targetBlockId?: string;
      caption: string;
      captionKind: "table" | "figure";
      reason?: string;
    }
  | {
      type: "review_report";
      title: string;
      issues: Array<{
        severity: "blocker" | "warning" | "info";
        message: string;
        targetBlockId?: string;
        suggestion?: string;
      }>;
    }
  | {
      type: "checklist";
      title: string;
      items: Array<{
        label: string;
        status: "pass" | "warning" | "fail" | "not_checked";
        note?: string;
      }>;
    }
  | {
      type: "message";
      title: string;
      message: string;
    };

export interface EditorialExecutionTelemetry {
  startedAt: number;
  finishedAt: number;
  durationMs: number;
}

export interface EditorialExecutionResult {
  ok: boolean;
  source: EditorialExecutionSource;
  commandId: string;
  proposal?: EditorialProposal;
  confidence?: number;
  ruleId?: string;
  ruleName?: string;
  ruleVersion?: string;
  model?: string;
  fallbackReason?: string;
  telemetry?: EditorialExecutionTelemetry;
  error?: {
    code: string;
    message: string;
  };
}
