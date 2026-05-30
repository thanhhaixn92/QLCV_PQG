import {
  ARTICLE_DOCUMENT_SCHEMA_VERSION,
  SUPPORTED_ARTICLE_LOCALES,
  type ArticleBlock,
  type ArticleDocument,
  type ArticleLeadInItem,
  type ArticlePageBreakPolicy,
} from "./articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "./blockRegistry";
import { getArticleTemplate } from "./templateRegistry";
import { hasArticleStyle } from "./styleRegistry";

export interface ArticleValidationIssue {
  path: string;
  message: string;
  detail?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ArticleValidationIssue[];
  warnings: ArticleValidationIssue[];
}

const VALID_PAGE_BREAK_POLICIES: ArticlePageBreakPolicy[] = ["auto", "avoid", "before", "after"];
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;
const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+(?:bổ sung|bổ sung\/kiểm chứng|kiểm chứng)\s*:?|\s*PLACEHOLDER\b|\s*[—-]+\s*(?:ẢNH|PLACEHOLDER)\s*[—-]+\s*)[^\]]*\]/i;
const DRAFT_MARKER_WARNING = "Bản thảo còn dữ liệu cần bổ sung trước khi xuất bản chính thức.";
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
  if (!DRAFT_MARKER_PATTERN.test(value)) return;
  if (warnings.some((warning) => warning.message === DRAFT_MARKER_WARNING)) return;
  warnings.push({ path, message: DRAFT_MARKER_WARNING });
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

function validateBlock(block: ArticleBlock, index: number, document: ArticleDocument, result: ValidationResult): void {
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

export function validateArticleDocument(document: ArticleDocument): ValidationResult {
  const result: ValidationResult = { valid: false, errors: [], warnings: [] };

  if (document.schemaVersion !== ARTICLE_DOCUMENT_SCHEMA_VERSION) {
    result.errors.push({ path: "schemaVersion", message: "schemaVersion chưa được hỗ trợ." });
  }

  if (!getArticleTemplate(document.templateId, document.templateVersion)) {
    result.errors.push({ path: "templateId", message: "templateId/templateVersion không tồn tại trong registry." });
  }

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
    document.blocks.forEach((block, index) => validateBlock(block, index, document, result));

    const hasMainContent = document.blocks.some((block) =>
      ["sapo", "paragraph", "lead-in-list", "bullet-list", "conclusion"].includes(block.type),
    );
    if (!hasMainContent) {
      result.errors.push({ path: "blocks", message: "Tài liệu chưa có nội dung chính." });
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}
