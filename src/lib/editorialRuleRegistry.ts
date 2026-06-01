import type { ArticleBlock, ArticleDocument } from "./publishing/articleDocument";
import type { EditorialExecutionResult, EditorialProposal } from "../types/editorialExecution";

export type EditorialRouterContextType =
  | "paragraph"
  | "heading"
  | "table"
  | "figure"
  | "source"
  | "history_session"
  | "preflight_issue"
  | "draft"
  | "selection";

export interface EditorialRouterContextItem {
  id: string;
  type: EditorialRouterContextType;
  title: string;
  excerpt?: string;
  sourceId?: string;
  blockId?: string;
}

export interface EditorialRuleExecutionInput {
  commandId: string;
  prompt?: string;
  contexts: EditorialRouterContextItem[];
  selectedBlock?: ArticleBlock;
  articleDocument: ArticleDocument;
  draftText: string;
}

export interface EditorialRuleDefinition {
  ruleId: string;
  ruleName: string;
  ruleVersion: string;
  commandIds: string[];
  aliases: string[];
  keywords: string[];
  contextTypes: EditorialRouterContextType[];
  run: (input: EditorialRuleExecutionInput) => EditorialProposal | undefined;
}

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function blockText(block?: ArticleBlock, slot: keyof ArticleBlock["slots"] = "text"): string {
  if (!block) return "";
  return cleanText(block.slots?.[slot]);
}

function tableExcerpt(block?: ArticleBlock): string {
  if (!block || block.type !== "table" || !Array.isArray(block.slots.rows)) return "";
  return block.slots.rows
    .slice(0, 3)
    .map((row) => Array.isArray(row) ? row.map((cell) => cleanText(cell?.text)).filter(Boolean).join(" | ") : "")
    .filter(Boolean)
    .join(" / ");
}

function selectedOrDraftContext(input: EditorialRuleExecutionInput): EditorialRouterContextItem | undefined {
  return input.contexts.find((context) => context.blockId) || input.contexts[0];
}

function makeCaption(prefix: "Bảng" | "Hình", seed: string): string {
  const compact = cleanText(seed)
    .replace(/^bảng\s*\d*\s*[:.\-–—]?\s*/iu, "")
    .replace(/^hình\s*\d*\s*[:.\-–—]?\s*/iu, "")
    .slice(0, 110)
    .trim();
  return `${prefix}: ${compact || (prefix === "Bảng" ? "Tổng hợp thông tin chính" : "Minh họa nội dung chính")}`;
}

function hasCaption(block?: ArticleBlock): boolean {
  return Boolean(blockText(block, "caption"));
}

function findBadMarkers(text: string): string[] {
  const markers = [
    /\[object Object\]/i,
    /\bundefined\b/i,
    /\bnull\b/i,
    /\[\s*(?:PLACEHOLDER[^\]]*|[—-]+\s*(?:ẢNH|ANH|PLACEHOLDER)\s*[—-]+)\]/i,
    /^(?:yêu cầu|bối cảnh|prompt|instruction)\s*[:：]/iu,
  ];
  return markers.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function normalizeCaption(value: string, kind: "table" | "figure"): string {
  const prefix = kind === "table" ? "Bảng" : "Hình";
  const withoutPrefix = cleanText(value)
    .replace(/^(?:bảng|hình|ảnh)\s*\d*(?:\.\d+)*\s*[:.\-–—]?\s*/iu, "")
    .replace(/[.。]+$/u, "");
  return `${prefix}: ${withoutPrefix || (kind === "table" ? "Tổng hợp thông tin chính" : "Minh họa nội dung chính")}`;
}

function draftBlocks(input: EditorialRuleExecutionInput): ArticleBlock[] {
  return input.articleDocument.blocks || [];
}

export const EDITORIAL_STATIC_RULES: EditorialRuleDefinition[] = [
  {
    ruleId: "create_table_caption",
    ruleName: "Create table caption",
    ruleVersion: "1.0.0",
    commandIds: ["create_caption"],
    aliases: ["caption_table", "table_caption"],
    keywords: ["caption", "bảng", "tiêu đề bảng"],
    contextTypes: ["table"],
    run: (input) => {
      const block = input.selectedBlock;
      if (!block || block.type !== "table") return undefined;
      const currentCaption = blockText(block, "caption");
      const seed = currentCaption || tableExcerpt(block);
      return {
        type: "add_caption",
        targetBlockId: block.id,
        caption: normalizeCaption(seed, "table"),
        captionKind: "table",
        reason: currentCaption ? "Chuẩn hóa caption bảng hiện có." : "Bảng chưa có caption rõ ràng.",
      };
    },
  },
  {
    ruleId: "create_figure_caption",
    ruleName: "Create figure caption",
    ruleVersion: "1.0.0",
    commandIds: ["figure_caption"],
    aliases: ["create_caption_figure", "image_caption"],
    keywords: ["caption", "hình", "ảnh", "placeholder"],
    contextTypes: ["figure"],
    run: (input) => {
      const block = input.selectedBlock;
      if (!block || block.type !== "figure-placeholder") return undefined;
      const currentCaption = blockText(block, "caption");
      const seed = currentCaption || blockText(block, "title") || blockText(block, "description") || selectedOrDraftContext(input)?.excerpt || "";
      return {
        type: "add_caption",
        targetBlockId: block.id,
        caption: normalizeCaption(seed, "figure"),
        captionKind: "figure",
        reason: currentCaption ? "Chuẩn hóa caption hình hiện có." : "Hình/placeholder chưa có caption rõ ràng.",
      };
    },
  },
  {
    ruleId: "normalize_caption_title",
    ruleName: "Normalize caption title",
    ruleVersion: "1.0.0",
    commandIds: ["normalize_caption_title"],
    aliases: ["normalize_caption", "caption_title"],
    keywords: ["chuẩn hóa", "caption", "tiêu đề bảng", "tiêu đề hình"],
    contextTypes: ["table", "figure", "selection"],
    run: (input) => {
      const block = input.selectedBlock;
      if (!block || (block.type !== "table" && block.type !== "figure-placeholder")) return undefined;
      const kind = block.type === "table" ? "table" : "figure";
      const current = blockText(block, "caption") || selectedOrDraftContext(input)?.excerpt || "";
      if (!current) return undefined;
      return {
        type: "add_caption",
        targetBlockId: block.id,
        caption: normalizeCaption(current, kind),
        captionKind: kind,
        reason: "Chuẩn hóa caption theo nhãn Bảng/Hình cho bản A4.",
      };
    },
  },
  {
    ruleId: "check_missing_source_or_caption",
    ruleName: "Check missing source or caption",
    ruleVersion: "1.0.0",
    commandIds: ["check_missing_source_or_caption", "check_table_numbers", "check_figure_position"],
    aliases: ["missing_caption", "missing_source"],
    keywords: ["thiếu", "nguồn", "caption", "chú thích"],
    contextTypes: ["draft", "table", "figure"],
    run: (input) => {
      const issues = draftBlocks(input)
        .filter((block) => block.type === "table" || block.type === "figure-placeholder")
        .flatMap((block) => {
          const blockIssues = [];
          if (!hasCaption(block)) {
            blockIssues.push({
              severity: "warning" as const,
              message: block.type === "table" ? "Bảng chưa có caption." : "Hình/placeholder chưa có caption.",
              targetBlockId: block.id,
              suggestion: "Tạo caption trước khi xuất bản.",
            });
          }
          if (block.type === "figure-placeholder" && !blockText(block, "source" as keyof ArticleBlock["slots"])) {
            blockIssues.push({
              severity: "info" as const,
              message: "Hình/placeholder chưa có nguồn ảnh.",
              targetBlockId: block.id,
              suggestion: "Bổ sung nguồn nếu ảnh không phải tư liệu nội bộ.",
            });
          }
          return blockIssues;
        });
      return {
        type: "review_report",
        title: "Kiểm tra nguồn và caption",
        issues: issues.length > 0 ? issues : [{ severity: "info", message: "Chưa phát hiện bảng/hình thiếu caption cơ bản." }],
      };
    },
  },
  {
    ruleId: "remove_bad_technical_markers",
    ruleName: "Remove bad technical markers",
    ruleVersion: "1.0.0",
    commandIds: ["remove_bad_technical_markers", "fix_preflight_issue"],
    aliases: ["remove_markers", "clean_technical_markers"],
    keywords: ["marker", "placeholder", "object object", "undefined", "kỹ thuật"],
    contextTypes: ["draft", "paragraph"],
    run: (input) => {
      const context = selectedOrDraftContext(input);
      const text = context?.excerpt || input.draftText;
      const markers = findBadMarkers(text);
      if (markers.length === 0) {
        return { type: "message", title: "Kiểm tra marker kỹ thuật", message: "Chưa phát hiện marker kỹ thuật xấu trong ngữ cảnh đã chọn." };
      }
      if (input.selectedBlock && context?.excerpt) {
        const afterText = context.excerpt
          .replace(/\[object Object\]/gi, "")
          .replace(/\bundefined\b/gi, "")
          .replace(/\bnull\b/gi, "")
          .replace(/^(?:yêu cầu|bối cảnh|prompt|instruction)\s*[:：]\s*/iu, "")
          .replace(/\s+/g, " ")
          .trim();
        return {
          type: "replace_block",
          targetBlockId: input.selectedBlock.id,
          beforeText: context.excerpt,
          afterText,
          reason: "Xóa marker kỹ thuật xấu khỏi block đã chọn.",
        };
      }
      return {
        type: "review_report",
        title: "Marker kỹ thuật cần xử lý",
        issues: markers.map((marker) => ({ severity: "warning", message: `Phát hiện marker kỹ thuật: ${marker}`, suggestion: "Chọn block cụ thể để tạo proposal sửa an toàn." })),
      };
    },
  },
  {
    ruleId: "create_a4_review_checklist",
    ruleName: "Create A4 review checklist",
    ruleVersion: "1.0.0",
    commandIds: ["review_current_draft", "create_a4_review_checklist"],
    aliases: ["a4_checklist", "review_draft"],
    keywords: ["rà soát", "checklist", "a4", "xuất bản"],
    contextTypes: ["draft"],
    run: (input) => {
      const blocks = draftBlocks(input);
      const hasTitle = blocks.some((block) => block.type === "title" && blockText(block));
      const hasSapo = blocks.some((block) => block.type === "sapo" && blockText(block));
      const headings = blocks.filter((block) => block.type === "section-heading");
      const tables = blocks.filter((block) => block.type === "table");
      const figures = blocks.filter((block) => block.type === "figure-placeholder");
      const missingTableCaptions = tables.filter((block) => !hasCaption(block)).length;
      const missingFigureCaptions = figures.filter((block) => !hasCaption(block)).length;
      return {
        type: "checklist",
        title: "Checklist rà soát A4",
        items: [
          { label: "Title", status: hasTitle ? "pass" : "fail", note: hasTitle ? "Đã có tiêu đề." : "Thiếu tiêu đề bài viết." },
          { label: "Sapo", status: hasSapo ? "pass" : "warning", note: hasSapo ? "Đã có sapo." : "Nên bổ sung sapo ngắn." },
          { label: "Heading", status: headings.length > 0 ? "pass" : "warning", note: headings.length > 0 ? `${headings.length} heading.` : "Chưa có heading phân đoạn." },
          { label: "Bảng", status: missingTableCaptions === 0 ? "pass" : "warning", note: tables.length === 0 ? "Không có bảng." : `${missingTableCaptions}/${tables.length} bảng thiếu caption.` },
          { label: "Hình", status: missingFigureCaptions === 0 ? "pass" : "warning", note: figures.length === 0 ? "Không có hình/placeholder." : `${missingFigureCaptions}/${figures.length} hình thiếu caption.` },
          { label: "Nguồn", status: input.articleDocument.metadata?.authorName ? "pass" : "not_checked", note: "Kiểm tra nguồn chi tiết cần đối chiếu tài liệu gốc." },
          { label: "Export readiness", status: hasTitle && missingTableCaptions === 0 && missingFigureCaptions === 0 ? "pass" : "warning", note: "Chạy Preflight/export runtime trước khi phát hành." },
        ],
      };
    },
  },
  {
    ruleId: "check_long_paragraph",
    ruleName: "Check long paragraph",
    ruleVersion: "1.0.0",
    commandIds: ["check_long_paragraph"],
    aliases: ["long_paragraph", "split_paragraph"],
    keywords: ["đoạn dài", "câu dài", "chia đoạn"],
    contextTypes: ["paragraph", "draft"],
    run: (input) => {
      const paragraphBlocks = input.selectedBlock?.type === "paragraph" ? [input.selectedBlock] : draftBlocks(input).filter((block) => block.type === "paragraph");
      const issues = paragraphBlocks.flatMap((block) => {
        const text = blockText(block);
        const longSentence = text.split(/[.!?。]+/u).some((sentence) => sentence.trim().length > 220);
        if (text.length <= 450 && !longSentence) return [];
        return [{
          severity: "warning" as const,
          message: "Đoạn/câu quá dài, có thể khó đọc trên A4.",
          targetBlockId: block.id,
          suggestion: "Chia thành 2 đoạn hoặc rút ngắn câu trước khi xuất bản.",
        }];
      });
      return {
        type: "review_report",
        title: "Kiểm tra đoạn dài",
        issues: issues.length > 0 ? issues : [{ severity: "info", message: "Chưa phát hiện đoạn quá dài trong phạm vi kiểm tra." }],
      };
    },
  },
  {
    ruleId: "normalize_basic_heading",
    ruleName: "Normalize basic heading",
    ruleVersion: "1.0.0",
    commandIds: ["normalize_basic_heading"],
    aliases: ["normalize_heading", "heading"],
    keywords: ["heading", "tiêu đề mục", "chuẩn hóa tiêu đề"],
    contextTypes: ["heading", "draft"],
    run: (input) => {
      const block = input.selectedBlock;
      if (block && (block.type === "section-heading" || block.type === "title" || block.type === "sapo")) {
        const beforeText = blockText(block);
        const afterText = beforeText.replace(/^#+\s*/u, "").replace(/[.;:：]+$/u, "").replace(/\s+/g, " ").trim();
        if (afterText && afterText !== beforeText) {
          return { type: "replace_block", targetBlockId: block.id, beforeText, afterText, reason: "Chuẩn hóa heading cơ bản." };
        }
      }
      return {
        type: "review_report",
        title: "Chuẩn hóa heading cơ bản",
        issues: [{ severity: "info", message: "Chưa có heading được chọn cần chuẩn hóa cơ bản." }],
      };
    },
  },
];

export function withRuleMetadata(
  commandId: string,
  rule: EditorialRuleDefinition,
  proposal: EditorialProposal,
  confidence: number,
  telemetry: EditorialExecutionResult["telemetry"],
): EditorialExecutionResult {
  return {
    ok: true,
    source: "rule",
    commandId,
    proposal,
    confidence,
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    ruleVersion: rule.ruleVersion,
    telemetry,
  };
}
