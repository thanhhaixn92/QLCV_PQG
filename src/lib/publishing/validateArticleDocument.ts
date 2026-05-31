import {
  ARTICLE_DOCUMENT_SCHEMA_VERSION,
  SUPPORTED_ARTICLE_LOCALES,
  type ArticleBlock,
  type ArticleDocument,
  type ArticleLeadInItem,
  type ArticlePageBreakPolicy,
} from "./articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "./blockRegistry";
import { getDefaultArticleLayout, getArticleLayout, type ArticleLayoutDefinition } from "./layoutRegistry";
import { getArticleTemplate } from "./templateRegistry";
import { hasArticleStyle } from "./styleRegistry";
import {
  createPreflightIssue,
  dedupePreflightIssues,
  type PreflightIssue,
  type PreflightIssueSource,
} from "./preflightIssue";

export interface ArticleValidationIssue {
  path: string;
  message: string;
  detail?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ArticleValidationIssue[];
  warnings: ArticleValidationIssue[];
  preflightIssues: PreflightIssue[];
}

const VALID_PAGE_BREAK_POLICIES: ArticlePageBreakPolicy[] = ["auto", "avoid", "before", "after"];
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;
const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+(?:bổ sung|bổ sung\/kiểm chứng|kiểm chứng)\s*:?|\s*PLACEHOLDER\b|\s*[—-]+\s*(?:ẢNH|PLACEHOLDER)\s*[—-]+\s*)[^\]]*\]/i;
const DRAFT_MARKER_WARNING = "Bản thảo còn dữ liệu cần bổ sung/kiểm chứng trước khi xuất bản chính thức.";
const LONG_CAPTION_WARNING = "Chú thích ảnh hơi dài, nên rút gọn trước khi xuất bản chính thức.";

function hasHtml(value: string): boolean {
  return HTML_PATTERN.test(value);
}

function isLeadInItem(value: unknown): value is ArticleLeadInItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as ArticleLeadInItem).label === "string" &&
      typeof (value as ArticleLeadInItem).body === "string",
  );
}

function addDraftMarkerWarning(value: string, path: string, warnings: ArticleValidationIssue[]): void {
  DRAFT_MARKER_PATTERN.lastIndex = 0;
  if (!DRAFT_MARKER_PATTERN.test(value)) return;
  warnings.push({ path, message: DRAFT_MARKER_WARNING, detail: `Marker nằm tại ${path}.` });
}

function maxLengthWarning(path: string, maxChars: number): string {
  if (/\.caption$/u.test(path)) return LONG_CAPTION_WARNING;
  if (/lead-in-list|\.items\[\d+\]\.(?:label|body)$/u.test(path)) {
    return `Ý nhãn dẫn hơi dài, nên rút gọn trước khi xuất bản chính thức.`;
  }
  if (/paragraph|conclusion|bullet-list|\.items\[\d+\]$/u.test(path)) {
    return `Nội dung hơi dài, nên rà soát lại trước khi xuất bản chính thức.`;
  }
  return `Nội dung vượt khuyến nghị ${maxChars} ký tự, nên rút gọn trước khi xuất bản chính thức.`;
}

function validatePlainText(
  value: unknown,
  path: string,
  maxChars: number | undefined,
  errors: ArticleValidationIssue[],
  warnings: ArticleValidationIssue[],
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push({ path, message: "Slot plain text phải là chuỗi không rỗng." });
    return;
  }
  addDraftMarkerWarning(value, path, warnings);
  if (hasHtml(value)) {
    errors.push({ path, message: "Slot plain text không được chứa HTML." });
  }
  if (maxChars && value.length > maxChars) {
    warnings.push({
      path,
      message: maxLengthWarning(path, maxChars),
      detail: `Slot vượt quá giới hạn ${maxChars} ký tự.`,
    });
  }
}

function validateBlock(
  block: ArticleBlock,
  index: number,
  document: ArticleDocument,
  result: ValidationResult,
  layout: ArticleLayoutDefinition | undefined,
): void {
  const path = `blocks[${index}]`;
  const definition = ARTICLE_BLOCK_REGISTRY[block.type];
  if (!definition) {
    result.errors.push({ path: `${path}.type`, message: `Block type không thuộc registry: ${block.type}` });
    return;
  }

  const template = getArticleTemplate(document.templateId, document.templateVersion);
  if (template && !template.allowedBlocks.includes(block.type)) {
    result.errors.push({ path: `${path}.type`, message: `Template không cho phép block type: ${block.type}` });
  }

  if (layout && !layout.allowedBlocks.includes(block.type)) {
    result.errors.push({ path: `${path}.type`, message: `Layout không cho phép block type: ${block.type}` });
  }

  if (!block.id || typeof block.id !== "string") {
    result.errors.push({ path: `${path}.id`, message: "Block id là bắt buộc." });
  }

  if (!block.slots || typeof block.slots !== "object") {
    result.errors.push({ path: `${path}.slots`, message: "Block slots là bắt buộc." });
    return;
  }

  definition.requiredSlots.forEach((slot) => {
    const value = block.slots[slot as keyof typeof block.slots];
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
      result.errors.push({ path: `${path}.slots.${slot}`, message: "Thiếu required slot." });
    }
  });

  Object.entries(definition.slotTypes).forEach(([slot, slotType]) => {
    const value = block.slots[slot as keyof typeof block.slots];
    if (value === undefined || value === null) return;

    if (slotType === "plainText") {
      validatePlainText(value, `${path}.slots.${slot}`, definition.maxChars, result.errors, result.warnings);
      return;
    }

    if (!Array.isArray(value)) {
      result.errors.push({ path: `${path}.slots.${slot}`, message: "Slot danh sách phải là array." });
      return;
    }

    if (value.length === 0) {
      result.errors.push({ path: `${path}.slots.${slot}`, message: "Danh sách không được rỗng." });
    }
    if (definition.maxItems && value.length > definition.maxItems) {
      result.errors.push({ path: `${path}.slots.${slot}`, message: `Danh sách vượt quá ${definition.maxItems} mục.` });
    }

    value.forEach((item, itemIndex) => {
      if (slotType === "plainTextArray") {
        validatePlainText(item, `${path}.slots.${slot}[${itemIndex}]`, definition.maxChars, result.errors, result.warnings);
        return;
      }
      if (!isLeadInItem(item)) {
        result.errors.push({ path: `${path}.slots.${slot}[${itemIndex}]`, message: "Lead-in item phải có label và body." });
        return;
      }
      validatePlainText(item.label, `${path}.slots.${slot}[${itemIndex}].label`, definition.maxChars, result.errors, result.warnings);
      validatePlainText(item.body, `${path}.slots.${slot}[${itemIndex}].body`, definition.maxChars, result.errors, result.warnings);
    });
  });

  if (block.pageBreakPolicy && !VALID_PAGE_BREAK_POLICIES.includes(block.pageBreakPolicy)) {
    result.errors.push({ path: `${path}.pageBreakPolicy`, message: "pageBreakPolicy không hợp lệ." });
  }

  if (block.styleId && !hasArticleStyle(block.styleId)) {
    result.errors.push({ path: `${path}.styleId`, message: "styleId không thuộc style registry." });
  }
}

function resolveDocumentLayout(document: ArticleDocument, result: ValidationResult): ArticleLayoutDefinition | undefined {
  const hasLayoutId = Boolean(document.layoutId);
  const hasLayoutVersion = Boolean(document.layoutVersion);

  if (!hasLayoutId && !hasLayoutVersion) {
    const fallbackLayout = getDefaultArticleLayout();
    result.warnings.push({
      path: "layoutId",
      message: "Tài liệu cũ chưa có layoutId/layoutVersion; validation dùng layout mặc định để tương thích ngược.",
      detail: `${fallbackLayout.layoutId}@${fallbackLayout.layoutVersion}`,
    });
    return fallbackLayout;
  }

  if (!hasLayoutId || !hasLayoutVersion) {
    result.errors.push({ path: "layoutId", message: "layoutId/layoutVersion phải được khai báo đầy đủ." });
    return undefined;
  }

  const layout = getArticleLayout(document.layoutId as string, document.layoutVersion as string);
  if (!layout) {
    result.errors.push({ path: "layoutId", message: "layoutId/layoutVersion không tồn tại trong layout registry." });
  }
  return layout;
}

function extractBlockIndex(path: string): number | undefined {
  const match = path.match(/^blocks\[(\d+)\]/u);
  return match ? Number(match[1]) : undefined;
}

function extractField(path: string): string | undefined {
  const slotMatch = path.match(/\.slots\.([^.[\]]+)/u);
  if (slotMatch) return slotMatch[1];
  const parts = path.split(".");
  return parts[parts.length - 1] || path;
}

function sourceForIssue(path: string, message: string): PreflightIssueSource {
  if (path.startsWith("layout") || message.toLowerCase().includes("layout")) return "layout-validation";
  return "article-validation";
}

function suggestionForIssue(issue: ArticleValidationIssue): string | undefined {
  if (issue.path.includes("metadata.title") || issue.path.includes(".slots.text")) {
    if (issue.message.toLowerCase().includes("title") || issue.path.includes("metadata.title")) {
      return "Bổ sung tiêu đề rõ ràng trước khi xuất bản.";
    }
  }
  if (issue.path.includes("layout")) return "Chọn lại layout từ bước gợi ý hoặc dùng layout mặc định hợp lệ.";
  if (issue.message.includes("HTML")) return "Chuyển nội dung về plain text, không dán thẻ HTML vào block.";
  if (issue.message.includes("không cho phép block type")) return "Đổi layout phù hợp hoặc chuyển block sang loại được layout cho phép.";
  if (issue.message.includes("Thiếu required slot") || issue.message.includes("không rỗng")) {
    return "Điền đủ nội dung bắt buộc cho block này.";
  }
  if (issue.message.includes("hơi dài") || issue.message.includes("vượt khuyến nghị")) {
    return "Rút gọn nội dung hoặc tách thành block ngắn hơn để dễ đọc trên A4.";
  }
  if (issue.message.includes("bổ sung/kiểm chứng")) {
    return "Rà soát marker nháp và bổ sung dữ liệu hoặc nguồn kiểm chứng.";
  }
  return undefined;
}

function toPreflightIssue(
  issue: ArticleValidationIssue,
  severity: "blocker" | "warning",
  document: ArticleDocument,
): PreflightIssue {
  const blockIndex = extractBlockIndex(issue.path);
  const block = blockIndex === undefined ? undefined : document.blocks?.[blockIndex];
  const shouldCollapseRepeatedLengthWarning = severity === "warning" && /hơi dài|vượt khuyến nghị/u.test(issue.message);

  return createPreflightIssue({
    severity,
    message: issue.message,
    blockId: shouldCollapseRepeatedLengthWarning ? undefined : block?.id,
    blockType: block?.type,
    field: shouldCollapseRepeatedLengthWarning ? "content-length" : extractField(issue.path),
    suggestion: suggestionForIssue(issue),
    source: sourceForIssue(issue.path, issue.message),
  });
}

function hasBlockType(document: ArticleDocument, type: ArticleBlock["type"]): boolean {
  return Array.isArray(document.blocks) && document.blocks.some((block) => block.type === type);
}

function blockText(block: ArticleBlock): string {
  const parts: string[] = [];
  Object.values(block.slots || {}).forEach((value) => {
    if (typeof value === "string") parts.push(value);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string") parts.push(item);
        else if (item && typeof item === "object") parts.push(...Object.values(item).filter((part): part is string => typeof part === "string"));
      });
    }
  });
  return parts.join(" ");
}

function addEditorialPreflightChecks(document: ArticleDocument, issues: PreflightIssue[]): void {
  if (!hasBlockType(document, "sapo") && !document.metadata?.sapo) {
    issues.push(createPreflightIssue({
      severity: "warning",
      message: "Bài viết chưa có sapo/lead mở đầu.",
      field: "sapo",
      suggestion: "Bổ sung một đoạn sapo ngắn để định hướng người đọc trước phần thân bài.",
      source: "editorial-check",
    }));
  }

  if (Array.isArray(document.blocks)) {
    document.blocks.forEach((block) => {
      if (block.type !== "figure-placeholder") return;
      const caption = typeof block.slots.caption === "string" ? block.slots.caption.trim() : "";
      if (!caption) {
        issues.push(createPreflightIssue({
          severity: "warning",
          message: "Khung ảnh placeholder chưa có chú thích.",
          blockId: block.id,
          blockType: block.type,
          field: "caption",
          suggestion: "Thêm chú thích ngắn mô tả ảnh dự kiến hoặc ý nghĩa minh họa.",
          source: "editorial-check",
        }));
      }
    });
  }

  const fullText = Array.isArray(document.blocks) ? document.blocks.map(blockText).join(" ") : "";
  const numericMatches = fullText.match(/(?:\d+[.,]?\d*|\d+%)/gu) || [];
  const hasSourceCue = /(?:nguồn|theo|trích|dẫn|số liệu|báo cáo|thống kê|kiểm chứng)/iu.test(fullText);
  if (numericMatches.length >= 8 && !hasSourceCue) {
    issues.push(createPreflightIssue({
      severity: "warning",
      message: "Bài có nhiều số liệu nhưng chưa thấy dữ liệu nguồn/kiểm chứng rõ ràng.",
      field: "sources",
      suggestion: "Bổ sung nguồn số liệu, mốc thời gian hoặc ghi chú kiểm chứng trước khi phát hành chính thức.",
      source: "editorial-check",
    }));
  }
}

function buildPreflightIssues(document: ArticleDocument, result: ValidationResult): PreflightIssue[] {
  const issues = [
    ...result.errors.map((issue) => toPreflightIssue(issue, "blocker", document)),
    ...result.warnings.map((issue) => toPreflightIssue(issue, "warning", document)),
  ];
  addEditorialPreflightChecks(document, issues);
  return dedupePreflightIssues(issues);
}

function validateEstimatedPages(document: ArticleDocument, result: ValidationResult): void {
  if (document.estimatedPages === undefined) return;
  if (!Number.isFinite(document.estimatedPages) || document.estimatedPages < 1 || document.estimatedPages > 10) {
    result.warnings.push({ path: "estimatedPages", message: "estimatedPages nên nằm trong khoảng 1–10 trang A4." });
  }
}

export function validateArticleDocument(document: ArticleDocument): ValidationResult {
  const result: ValidationResult = { valid: false, errors: [], warnings: [], preflightIssues: [] };

  if (document.schemaVersion !== ARTICLE_DOCUMENT_SCHEMA_VERSION) {
    result.errors.push({ path: "schemaVersion", message: "schemaVersion chưa được hỗ trợ." });
  }

  if (!getArticleTemplate(document.templateId, document.templateVersion)) {
    result.errors.push({ path: "templateId", message: "templateId/templateVersion không tồn tại trong registry." });
  }

  const layout = resolveDocumentLayout(document, result);
  validateEstimatedPages(document, result);

  if (!SUPPORTED_ARTICLE_LOCALES.includes(document.locale)) {
    result.errors.push({ path: "locale", message: "locale không hợp lệ." });
  }

  if (!document.metadata?.title) {
    result.errors.push({ path: "metadata.title", message: "metadata.title là bắt buộc." });
  } else {
    addDraftMarkerWarning(document.metadata.title, "metadata.title", result.warnings);
  }

  if (document.metadata?.sapo) {
    addDraftMarkerWarning(document.metadata.sapo, "metadata.sapo", result.warnings);
  }

  if (!Array.isArray(document.blocks)) {
    result.errors.push({ path: "blocks", message: "blocks phải là array." });
  } else {
    if (document.blocks.length === 0) {
      result.errors.push({ path: "blocks", message: "Tài liệu chưa có nội dung chính." });
    }
    document.blocks.forEach((block, index) => validateBlock(block, index, document, result, layout));

    const hasMainContent = document.blocks.some((block) =>
      ["sapo", "paragraph", "lead-in-list", "bullet-list", "conclusion"].includes(block.type),
    );
    if (!hasMainContent) {
      result.errors.push({ path: "blocks", message: "Tài liệu chưa có nội dung chính." });
    }
  }

  result.valid = result.errors.length === 0;
  result.preflightIssues = buildPreflightIssues(document, result);
  return result;
}

export function getArticleDocumentPreflightIssues(document: ArticleDocument): PreflightIssue[] {
  return validateArticleDocument(document).preflightIssues;
}
