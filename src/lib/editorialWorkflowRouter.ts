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

function proposalFromAiText(input: EditorialWorkflowRouterInput, aiText: string): EditorialProposal {
  const context = selectedContext(input);
  if (["rewrite_selection", "shorten_selection", "fix_selection", "strengthen_argument", "more"].includes(input.commandId) && context?.excerpt) {
    return {
      type: "replace_block",
      targetBlockId: context.blockId,
      beforeText: context.excerpt,
      afterText: aiText,
      reason: "AI fallback tạo đề xuất thay thế cho ngữ cảnh đã chọn.",
    };
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

  return {
    ok: true,
    source: "ai",
    commandId: input.commandId,
    proposal: proposalFromAiText(input, aiText),
    model: AI_MODEL_LABEL,
    fallbackReason,
    telemetry: finishTelemetry(startedAt),
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
