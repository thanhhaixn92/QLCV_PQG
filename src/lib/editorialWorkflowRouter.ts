import type { OutputFormat } from "../types";
import type { ArticleBlock, ArticleDocument } from "./publishing/articleDocument";
import {
  EDITORIAL_STATIC_RULES,
  type EditorialRouterContextItem,
  type EditorialRouterContextType,
  type EditorialRuleDefinition,
} from "./editorialRuleRegistry";
import { withRuleMetadata } from "./editorialRuleRegistry";
import type { EditorialExecutionResult, EditorialProposal } from "../types/editorialExecution";

export const DEFAULT_RULE_CONFIDENCE_THRESHOLD = 0.85;
const EXACT_RULE_CONFIDENCE = 1;
const ALIAS_RULE_CONFIDENCE = 1;
const AI_MODEL_LABEL = "backend-selected-model";

export interface EditorialWorkflowRouterInput {
  commandId: string;
  prompt?: string;
  contexts: EditorialRouterContextItem[];
  selectedBlock?: ArticleBlock;
  articleDocument: ArticleDocument;
  draftText: string;
  outputFormat: OutputFormat;
  getAuthToken?: () => Promise<string | undefined>;
  runAi: (content: string, token?: string) => Promise<string>;
}

interface RuleMatch {
  rule: EditorialRuleDefinition;
  confidence: number;
  reason: "exact_commandId" | "alias" | "keyword_context";
}

function finishTelemetry(startedAt: number): EditorialExecutionResult["telemetry"] {
  const finishedAt = Date.now();
  return { startedAt, finishedAt, durationMs: finishedAt - startedAt };
}

function contextTypes(contexts: EditorialRouterContextItem[]): EditorialRouterContextType[] {
  return Array.from(new Set(contexts.map((context) => context.type)));
}

function isContextCompatible(rule: EditorialRuleDefinition, contexts: EditorialRouterContextItem[]): boolean {
  if (rule.contextTypes.includes("draft")) return true;
  const types = contextTypes(contexts);
  return types.some((type) => rule.contextTypes.includes(type));
}

function normalizedWords(value: string): string[] {
  return value
    .toLocaleLowerCase("vi-VN")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function matchRule(input: EditorialWorkflowRouterInput): RuleMatch | undefined {
  const normalizedCommand = input.commandId.trim().toLocaleLowerCase("vi-VN");
  const exact = EDITORIAL_STATIC_RULES.find((rule) => rule.commandIds.some((commandId) => commandId.toLocaleLowerCase("vi-VN") === normalizedCommand));
  if (exact && isContextCompatible(exact, input.contexts)) {
    return { rule: exact, confidence: EXACT_RULE_CONFIDENCE, reason: "exact_commandId" };
  }

  const alias = EDITORIAL_STATIC_RULES.find((rule) => rule.aliases.some((item) => item.toLocaleLowerCase("vi-VN") === normalizedCommand));
  if (alias && isContextCompatible(alias, input.contexts)) {
    return { rule: alias, confidence: ALIAS_RULE_CONFIDENCE, reason: "alias" };
  }

  const haystack = normalizedWords(`${input.commandId} ${input.prompt || ""}`);
  const keyword = EDITORIAL_STATIC_RULES.find((rule) => {
    if (!isContextCompatible(rule, input.contexts)) return false;
    return rule.keywords.some((item) => haystack.includes(item.toLocaleLowerCase("vi-VN")));
  });

  if (keyword) {
    return { rule: keyword, confidence: DEFAULT_RULE_CONFIDENCE_THRESHOLD, reason: "keyword_context" };
  }

  return undefined;
}

function selectedContext(input: EditorialWorkflowRouterInput): EditorialRouterContextItem | undefined {
  return input.contexts.find((context) => context.blockId) || input.contexts[0];
}

function isSemanticCommand(commandId: string): boolean {
  return [
    "rewrite_selection",
    "shorten_selection",
    "fix_selection",
    "strengthen_argument",
    "summarize_selected_source",
    "use_source_to_update_draft",
    "compare_source_with_draft",
    "draft_new",
    "suggest_title_sapo",
    "more",
  ].includes(commandId);
}

function semanticInstruction(commandId: string, prompt?: string): string {
  if (commandId === "shorten_selection") return "Rút gọn nội dung đã chọn nhưng giữ ý chính, số liệu, tên riêng và sắc thái văn bản.";
  if (commandId === "fix_selection") return "Sửa lỗi chính tả, ngữ pháp, thuật ngữ và làm câu rõ hơn; không đổi ý chính.";
  if (commandId === "strengthen_argument") return "Tăng sức thuyết phục và lập luận cho nội dung đã chọn; không bịa số liệu hoặc nguồn mới.";
  if (commandId === "summarize_selected_source") return "Tóm tắt nguồn tư liệu đã chọn thành các ý chính có thể dùng cho bài viết; không bịa thêm ngoài nguồn.";
  if (commandId === "suggest_title_sapo") return "Gợi ý tiêu đề và sapo ngắn cho bản thảo hiện tại.";
  if (commandId === "use_source_to_update_draft") return "Đề xuất cách dùng nguồn đã chọn để cập nhật bản thảo, không tự ghi đè nội dung.";
  if (commandId === "compare_source_with_draft") return "So sánh nguồn đã chọn với bản thảo và nêu điểm cần kiểm chứng/cập nhật.";
  if (commandId === "more" && prompt) return prompt;
  return "Viết lại nội dung đã chọn theo văn phong mạch lạc, chuyên nghiệp, phù hợp bối cảnh Hoa Tiêu Miền Bắc.";
}

function buildAiContext(input: EditorialWorkflowRouterInput): string {
  const contextText = input.contexts
    .map((context) => [`[${context.type}] ${context.title}`, context.excerpt || ""].filter(Boolean).join("\n"))
    .join("\n\n")
    .trim();
  return contextText || input.draftText.trim();
}

const TARGET_SCOPED_COMMANDS = ["rewrite_selection", "shorten_selection", "fix_selection", "strengthen_argument"];
const MARKDOWN_LINE_PREFIX = /^(?:#{1,6}|[-*+]\s+|\d+[.)]\s+|>\s*)+/u;
const MARKDOWN_EMPHASIS = /(?:\*\*|__|`)/g;
const SECTION_HEADING_PATTERN = /^(?:tiêu đề|sapo|sa-pô|thân bài|mở bài|kết luận|nội dung|heading|title)\s*[:：]/imu;

function stripMarkdownMarkers(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(MARKDOWN_LINE_PREFIX, "").replace(MARKDOWN_EMPHASIS, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeReplacementForTarget(value: string, targetType?: EditorialRouterContextType): string {
  const cleaned = stripMarkdownMarkers(value);
  if (targetType === "heading") {
    return cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0]?.replace(SECTION_HEADING_PATTERN, "").trim() || "";
  }
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

function replacementOutOfScope(value: string, targetType?: EditorialRouterContextType): boolean {
  const cleaned = value.trim();
  if (!cleaned) return true;
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (SECTION_HEADING_PATTERN.test(cleaned)) return true;
  if (targetType === "heading") return lines.length > 1 || cleaned.length > 180;
  if (targetType === "paragraph") return lines.length > 1 && lines.some((line) => SECTION_HEADING_PATTERN.test(line) || MARKDOWN_LINE_PREFIX.test(line));
  return false;
}

function advisoryProposal(title: string, message: string): EditorialProposal {
  return { type: "message", title, message };
}

function proposalFromAiText(input: EditorialWorkflowRouterInput, aiText: string): EditorialProposal {
  const context = selectedContext(input);
  if (TARGET_SCOPED_COMMANDS.includes(input.commandId) && context?.excerpt) {
    if (!context.blockId) {
      return advisoryProposal("Không xác định được block để áp dụng", aiText);
    }
    if (replacementOutOfScope(aiText, context.type)) {
      return advisoryProposal("Đề xuất tham khảo ngoài phạm vi block", aiText);
    }
    const normalized = normalizeReplacementForTarget(aiText, context.type);
    if (replacementOutOfScope(normalized, context.type)) {
      return advisoryProposal("Đề xuất tham khảo ngoài phạm vi block", aiText);
    }
    return {
      type: "replace_block",
      targetBlockId: context.blockId,
      beforeText: context.excerpt,
      afterText: normalized,
      reason: "AI fallback tạo đề xuất thay thế đúng block đã chọn.",
    };
  }

  if (input.commandId === "more" && context?.excerpt && context.blockId) {
    const normalized = normalizeReplacementForTarget(aiText, context.type);
    if (!replacementOutOfScope(aiText, context.type) && !replacementOutOfScope(normalized, context.type)) {
      return {
        type: "replace_block",
        targetBlockId: context.blockId,
        beforeText: context.excerpt,
        afterText: normalized,
        reason: "AI fallback tạo đề xuất thay thế đúng block đã chọn.",
      };
    }
    return advisoryProposal("Đề xuất tham khảo", aiText);
  }

  if (input.commandId === "suggest_title_sapo") {
    return {
      type: "message",
      title: "Gợi ý tiêu đề & sapo",
      message: aiText,
    };
  }

  return {
    type: "review_report",
    title: input.commandId === "summarize_selected_source" ? "Tóm tắt nguồn tư liệu" : "Kết quả AI fallback",
    issues: [{ severity: "info", message: aiText }],
  };
}

function missingDataResult(commandId: string, message: string, startedAt: number): EditorialExecutionResult {
  return {
    ok: false,
    source: "ai",
    commandId,
    proposal: { type: "message", title: "Thiếu dữ liệu", message },
    fallbackReason: "missing_context",
    telemetry: finishTelemetry(startedAt),
    error: { code: "missing_context", message },
  };
}

async function runAiFallback(input: EditorialWorkflowRouterInput, startedAt: number, fallbackReason: string): Promise<EditorialExecutionResult> {
  if (input.commandId === "summarize_selected_source" && !input.contexts.some((context) => context.type === "source" && context.excerpt?.trim())) {
    return missingDataResult(input.commandId, "Hãy chọn một nguồn tư liệu có nội dung trước khi tóm tắt bằng AI.", startedAt);
  }

  const context = buildAiContext(input);
  if (!context) {
    return missingDataResult(input.commandId, "Copilot cần bản thảo hoặc ngữ cảnh đã chọn trước khi gọi AI.", startedAt);
  }

  const instruction = semanticInstruction(input.commandId, input.prompt);
  const token = await input.getAuthToken?.();
  const aiText = await input.runAi([
    instruction,
    "Trả về nội dung đề xuất an toàn để hiển thị trong Proposal Preview. Không tự áp dụng vào bản thảo.",
    "Nếu thiếu dữ kiện, nói rõ cần kiểm chứng; không bịa nguồn hoặc số liệu.",
    "Ngữ cảnh:",
    context,
  ].join("\n\n"), token);

  const proposal = proposalFromAiText(input, aiText);
  const cannotApplyTargetScopedMutation = TARGET_SCOPED_COMMANDS.includes(input.commandId) && proposal.type !== "replace_block";

  return {
    ok: !cannotApplyTargetScopedMutation,
    source: "ai",
    commandId: input.commandId,
    proposal,
    model: AI_MODEL_LABEL,
    fallbackReason: cannotApplyTargetScopedMutation ? "out_of_scope_target" : fallbackReason,
    telemetry: finishTelemetry(startedAt),
    error: cannotApplyTargetScopedMutation
      ? { code: "out_of_scope_target", message: "AI trả về nội dung vượt phạm vi block đã chọn nên chỉ hiển thị như đề xuất tham khảo." }
      : undefined,
  };
}

export async function executeEditorialWorkflowCommand(input: EditorialWorkflowRouterInput): Promise<EditorialExecutionResult> {
  const startedAt = Date.now();
  const match = matchRule(input);

  if (match) {
    const proposal = match.rule.run({
      commandId: input.commandId,
      prompt: input.prompt,
      contexts: input.contexts,
      selectedBlock: input.selectedBlock,
      articleDocument: input.articleDocument,
      draftText: input.draftText,
    });

    if (proposal) {
      return withRuleMetadata(input.commandId, match.rule, proposal, match.confidence, finishTelemetry(startedAt));
    }
  }

  if (!isSemanticCommand(input.commandId)) {
    return {
      ok: false,
      source: "rule",
      commandId: input.commandId,
      proposal: {
        type: "message",
        title: "Chưa có rule an toàn",
        message: "Lệnh này chưa có rule deterministic phù hợp trong Editorial Workflow Router MVP.",
      },
      fallbackReason: match ? `rule_${match.rule.ruleId}_returned_no_proposal` : "no_rule_match",
      telemetry: finishTelemetry(startedAt),
      error: {
        code: "no_rule_match",
        message: "Không tìm thấy rule an toàn và lệnh không thuộc nhóm semantic AI fallback trong PR này.",
      },
    };
  }

  try {
    return await runAiFallback(input, startedAt, match ? `rule_${match.rule.ruleId}_returned_no_proposal` : "semantic_command");
  } catch (error: any) {
    const message = error?.message || "Không chạy được AI fallback.";
    return {
      ok: false,
      source: "ai",
      commandId: input.commandId,
      model: AI_MODEL_LABEL,
      fallbackReason: match ? `rule_${match.rule.ruleId}_returned_no_proposal` : "semantic_command",
      telemetry: finishTelemetry(startedAt),
      error: { code: error?.isQuota ? "quota_exceeded" : "ai_fallback_error", message },
      proposal: { type: "message", title: "AI fallback chưa hoàn tất", message },
    };
  }
}

export function getEditorialWorkflowTelemetry(result: EditorialExecutionResult, contexts: EditorialRouterContextItem[], applied = false) {
  return {
    commandId: result.commandId,
    source: result.source,
    ruleId: result.ruleId,
    model: result.model,
    contextTypes: contextTypes(contexts),
    durationMs: result.telemetry?.durationMs,
    ok: result.ok,
    errorCode: result.error?.code,
    applied,
  };
}
