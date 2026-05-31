import type { ArticleBlock, ArticleBlockSlots, ArticleDocument, ArticleLeadInItem } from "./articleDocument";
import { normalizeEditorialBriefInput } from "../editorialBrief";
import type {
  ArticleExportBlock,
  ArticleExportFigure,
  ArticleExportLeadInItem,
  ArticleExportModel,
  ArticleExportTable,
  ArticleExportTableCell,
  ArticleExportWarning,
} from "./articleExportModel";

const DEFAULT_EXPORT_TITLE = "Bài viết A4";

// Nhãn kỹ thuật từ prompt/brief không được dùng làm metadata title
const TECHNICAL_LABEL_PATTERN = /^(?:Yêu cầu\s*(?:\/\s*Bối cảnh)?|Yêu cầu chung\s*(?:\/\s*Bối cảnh)?|Nội dung chính cần có|Thời gian\s*&\s*Địa điểm|Thành phần\s*\/\s*Nhân vật|Định dạng đầu ra)$/iu;

function isTechnicalLabel(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  return TECHNICAL_LABEL_PATTERN.test(normalized);
}

export function sanitizeExportTitle(value: string, fallback: string = DEFAULT_EXPORT_TITLE): string {
  const cleaned = cleanArticleExportText(value);
  if (!cleaned || isTechnicalLabel(cleaned)) return fallback;
  return cleaned;
}
const DEFAULT_LAYOUT_ID = "legacy-a4";
const DEFAULT_LAYOUT_VERSION = "legacy";

const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+[^\]]*|\s*PLACEHOLDER\b|\s*[—-]+\s*(?:ẢNH|PLACEHOLDER)\s*[—-]+\s*)[^\]]*\]/giu;
const RAW_PLACEHOLDER_LINE_PATTERN = /^(?:\d+[.)]\s*)?(?:Placehold|Placeholder|Vị trí chèn)\s+hình\s+minh\s+h[oọ][aạ]\s*[:：-]?.*$/gimu;
const RAW_SEPARATOR_LINE_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gmu;
const OBJECT_TEXT_PATTERN = /\[object Object\]/giu;
const UNSAFE_EXTENSION_PATTERN = /^\.*|[^a-z0-9]+/giu;

interface LooseArticleBlock {
  id?: unknown;
  type?: unknown;
  variant?: unknown;
  slots?: unknown;
}

interface LooseArticleDocument {
  id?: unknown;
  templateId?: unknown;
  templateVersion?: unknown;
  layoutId?: unknown;
  layoutVersion?: unknown;
  estimatedPages?: unknown;
  locale?: unknown;
  metadata?: unknown;
  blocks?: unknown;
}

interface LooseMetadata {
  title?: unknown;
  sapo?: unknown;
  authorName?: unknown;
  organization?: unknown;
  category?: unknown;
  createdAt?: unknown;
  status?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asLooseDocument(document: ArticleDocument): LooseArticleDocument {
  return document as LooseArticleDocument;
}

function asLooseBlock(block: ArticleBlock): LooseArticleBlock {
  return block as LooseArticleBlock;
}

function asSlots(value: unknown): Partial<ArticleBlockSlots> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function cleanScalarText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function cleanArticleExportText(value: unknown): string {
  const cleaned = cleanScalarText(value)
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/giu, "")
    .replace(DRAFT_MARKER_PATTERN, "")
    .replace(RAW_PLACEHOLDER_LINE_PATTERN, "")
    .replace(RAW_SEPARATOR_LINE_PATTERN, "")
    .replace(OBJECT_TEXT_PATTERN, "")
    .replace(/\b(?:undefined|null)\b/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return normalizeEditorialBriefInput(cleaned);
}

function cleanTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanArticleExportText(item)).filter((item) => item.length > 0);
}

function cleanLeadInItems(value: unknown): ArticleExportLeadInItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return undefined;
      const label = cleanArticleExportText(item.label);
      const body = cleanArticleExportText(item.body);
      if (!label && !body) return undefined;
      return { label, body } satisfies ArticleLeadInItem;
    })
    .filter((item): item is ArticleExportLeadInItem => Boolean(item));
}

function cleanFigure(slots: Partial<ArticleBlockSlots>): ArticleExportFigure {
  const title = cleanArticleExportText(slots.title);
  const caption = cleanArticleExportText(slots.caption);
  const note = cleanArticleExportText(slots.note);
  const label = title && title !== caption ? title : "Vị trí chèn ảnh minh họa";
  return {
    label,
    caption: caption && caption !== label ? caption : undefined,
    note: note || undefined,
  };
}

function cleanTable(value: unknown, captionValue?: unknown): ArticleExportTable | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .map((row) => {
      if (!Array.isArray(row)) return [];
      return row
        .map((cell): ArticleExportTableCell | undefined => {
          if (isRecord(cell)) {
            const text = cleanArticleExportText(cell.text ?? cell.value ?? cell.label);
            return text ? { text, header: cell.header === true } : undefined;
          }
          const text = cleanArticleExportText(cell);
          return text ? { text } : undefined;
        })
        .filter((cell): cell is ArticleExportTableCell => Boolean(cell));
    })
    .filter((row) => row.length > 0);
  if (rows.length === 0) return undefined;
  const caption = cleanArticleExportText(captionValue);
  return caption ? { rows, caption } : { rows };
}

function blockId(block: LooseArticleBlock): string {
  const id = cleanArticleExportText(block.id);
  return id || `export-block-${Math.random().toString(36).slice(2, 8)}`;
}

function blockText(slots: Partial<ArticleBlockSlots>, slot: keyof ArticleBlockSlots = "text"): string {
  return cleanArticleExportText(slots[slot]);
}


type TextLikeExportBlock = Extract<ArticleExportBlock, { text: string }>;

function isTextLikeBlock(block: ArticleExportBlock): block is TextLikeExportBlock {
  return "text" in block && typeof block.text === "string";
}

function isMarkdownTableRow(value: string): boolean {
  const text = value.trim();
  return text.startsWith("|") && text.endsWith("|") && text.split("|").length >= 4;
}

function isMarkdownTableSeparator(value: string): boolean {
  if (!isMarkdownTableRow(value)) return false;
  const cells = value
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s+/gu, "")));
}

function splitMarkdownTableRow(value: string): string[] {
  return value
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cleanArticleExportText(cell))
    .filter((cell) => cell.length > 0);
}

function markdownTableFromBlocks(blocks: ArticleExportBlock[]): ArticleExportTable | undefined {
  if (blocks.length < 2 || !blocks.every(isTextLikeBlock)) return undefined;
  if (!isMarkdownTableSeparator(blocks[1].text)) return undefined;

  const headerCells = splitMarkdownTableRow(blocks[0].text);
  const bodyRows = blocks.slice(2).map((block) => splitMarkdownTableRow(block.text));
  const rows = [headerCells, ...bodyRows]
    .filter((row) => row.length > 0)
    .map((row, rowIndex) =>
      row.map((text) => ({ text, header: rowIndex === 0 }) satisfies ArticleExportTableCell),
    );

  return rows.length >= 2 ? { rows } : undefined;
}

function normalizeMarkdownTableBlocks(blocks: ArticleExportBlock[]): ArticleExportBlock[] {
  const normalized: ArticleExportBlock[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (!isTextLikeBlock(block) || !isMarkdownTableRow(block.text)) {
      normalized.push(block);
      index += 1;
      continue;
    }

    const tableCandidate: ArticleExportBlock[] = [];
    let cursor = index;
    while (cursor < blocks.length) {
      const candidate = blocks[cursor];
      if (!isTextLikeBlock(candidate) || !isMarkdownTableRow(candidate.text)) break;
      tableCandidate.push(candidate);
      cursor += 1;
    }

    const table = markdownTableFromBlocks(tableCandidate);
    if (!table) {
      normalized.push(block);
      index += 1;
      continue;
    }

    normalized.push({
      id: `${block.id}-markdown-table`,
      type: "table",
      table,
      sourceType: "markdown-table",
      variant: block.variant,
    });
    index = cursor;
  }

  return normalized;
}

export function mapArticleBlockToExportBlock(block: ArticleBlock): ArticleExportBlock {
  const looseBlock = asLooseBlock(block);
  const sourceType = cleanArticleExportText(looseBlock.type) || "unknown";
  const slots = asSlots(looseBlock.slots);
  const id = blockId(looseBlock);
  const variant = stringValue(looseBlock.variant);

  switch (sourceType) {
    case "title":
      return { id, type: "title", text: blockText(slots), sourceType, variant };
    case "sapo":
      return { id, type: "sapo", text: blockText(slots), sourceType, variant };
    case "section-heading":
    case "heading":
      return { id, type: "heading", text: blockText(slots), level: 2, sourceType, variant };
    case "paragraph":
      return { id, type: "paragraph", text: blockText(slots), sourceType, variant };
    case "conclusion":
      return { id, type: "conclusion", text: blockText(slots), sourceType, variant };
    case "quote":
      return { id, type: "quote", text: blockText(slots), sourceType, variant };
    case "callout":
      return { id, type: "quote", text: [blockText(slots, "title"), blockText(slots)].filter(Boolean).join(": "), sourceType, variant };
    case "fact-box": {
      const title = blockText(slots, "title");
      const items = cleanTextArray(slots.items);
      return { id, type: "lead-in", items: items.map((body, index) => ({ label: index === 0 && title ? title : `Điểm ${index + 1}`, body })), sourceType, variant };
    }
    case "bullet-list":
      return { id, type: "bullet-list", items: cleanTextArray(slots.items), sourceType, variant };
    case "numbered-list":
    case "ordered-list":
      return { id, type: "numbered-list", items: cleanTextArray(slots.items), sourceType, variant };
    case "lead-in-list":
    case "lead-in":
      return { id, type: "lead-in", items: cleanLeadInItems(slots.items), sourceType, variant };
    case "figure-placeholder":
      return { id, type: "figure-placeholder", figure: cleanFigure(slots), sourceType, variant };
    case "table": {
      const table = cleanTable((slots as Record<string, unknown>).rows ?? slots.items, slots.caption);
      return table
        ? { id, type: "table", table, sourceType, variant }
        : { id, type: "unknown", text: blockText(slots), sourceType, variant };
    }
    case "page-break":
      return { id, type: "page-break", sourceType, variant };
    default: {
      const text = blockText(slots) || blockText(slots, "title") || blockText(slots, "caption") || cleanTextArray(slots.items).join(" ");
      return { id, type: "unknown", text, sourceType, variant };
    }
  }
}

export function isEmptyExportBlock(block: ArticleExportBlock): boolean {
  switch (block.type) {
    case "title":
    case "sapo":
    case "heading":
    case "paragraph":
    case "quote":
    case "conclusion":
      return cleanArticleExportText(block.text).length === 0;
    case "lead-in":
      return block.items.length === 0;
    case "bullet-list":
    case "numbered-list":
      return block.items.length === 0;
    case "table":
      return block.table.rows.length === 0;
    case "unknown":
      return !block.text && (!block.items || block.items.length === 0);
    case "figure-placeholder":
    case "page-break":
      return false;
    default:
      return true;
  }
}

function collectWarnings(blocks: ArticleExportBlock[], document: LooseArticleDocument): ArticleExportWarning[] {
  const warnings: ArticleExportWarning[] = [];
  if (!cleanArticleExportText(document.layoutId)) {
    warnings.push({ code: "missing-layout", message: "Tài liệu chưa có layoutId; export dùng fallback A4 an toàn." });
  }
  blocks.forEach((block) => {
    if (block.type === "unknown") {
      warnings.push({ code: "unknown-block", message: "Block không xác định được giữ dưới dạng fallback để tránh mất nội dung.", blockId: block.id, blockType: block.sourceType });
    }
    if (block.type === "table" && block.sourceType === "markdown-table") {
      warnings.push({ code: "markdown-table-normalized", message: "Bảng markdown đã được chuyển sang block bảng khi xuất file.", blockId: block.id, blockType: block.sourceType });
    }
  });
  return warnings;
}

export function normalizeArticleDocumentForExport(articleDocument: ArticleDocument): ArticleExportModel {
  const document = asLooseDocument(articleDocument);
  const metadata = isRecord(document.metadata) ? (document.metadata as LooseMetadata) : {};
  const mappedBlocks = normalizeMarkdownTableBlocks(
    (Array.isArray(document.blocks) ? document.blocks : [])
      .map((block) => mapArticleBlockToExportBlock(block as ArticleBlock))
      .filter((block) => !isEmptyExportBlock(block)),
  );

  const metadataTitle = cleanArticleExportText(metadata.title);
  const metadataSapo = cleanArticleExportText(metadata.sapo);
  // Bỏ qua metadata title nếu là nhãn kỹ thuật prompt/brief hoặc là markdown table row
  const titleFromMetadata = (!isMarkdownTableRow(metadataTitle) && !isTechnicalLabel(metadataTitle)) ? metadataTitle : "";
  const titleFromBlock = mappedBlocks.reduce((value, block) => (value || (block.type === "title" && !isMarkdownTableRow(block.text) ? block.text : "")), "");
  const sapoFromBlock = mappedBlocks.reduce((value, block) => (value || (block.type === "sapo" && !isMarkdownTableRow(block.text) ? block.text : "")), "");
  // Ưu tiên: tiêu đề từ block document > metadata sạch > fallback an toàn
  const title = sanitizeExportTitle(titleFromBlock || titleFromMetadata, DEFAULT_EXPORT_TITLE);
  const sapo = metadataSapo && !isMarkdownTableRow(metadataSapo) ? metadataSapo : sapoFromBlock || undefined;
  const layoutId = cleanArticleExportText(document.layoutId) || cleanArticleExportText(document.templateId) || DEFAULT_LAYOUT_ID;
  const layoutVersion = cleanArticleExportText(document.layoutVersion) || cleanArticleExportText(document.templateVersion) || DEFAULT_LAYOUT_VERSION;
  const estimatedPages = typeof document.estimatedPages === "number" && Number.isFinite(document.estimatedPages) ? document.estimatedPages : undefined;

  return {
    title,
    subtitle: sapo,
    sapo,
    metadata: {
      title,
      sapo,
      authorName: cleanArticleExportText(metadata.authorName) || undefined,
      organization: cleanArticleExportText(metadata.organization) || undefined,
      category: cleanArticleExportText(metadata.category) || undefined,
      createdAt: cleanArticleExportText(metadata.createdAt) || undefined,
      status: stringValue(metadata.status) as ArticleExportModel["metadata"]["status"],
      locale: cleanArticleExportText(document.locale) || undefined,
    },
    blocks: mappedBlocks,
    layoutId,
    layoutVersion,
    estimatedPages,
    exportWarnings: collectWarnings(mappedBlocks, document),
    sourceDocumentId: cleanArticleExportText(document.id) || undefined,
  };
}

function slugifyFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/giu, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

export function createArticleExportFilename(baseTitle: string, extension: string): string {
  const safeBase = slugifyFilename(cleanArticleExportText(baseTitle)) || "bai-viet-a4";
  const safeExtension = extension.replace(UNSAFE_EXTENSION_PATTERN, "").toLowerCase() || "html";
  return `${safeBase}.${safeExtension}`;
}
