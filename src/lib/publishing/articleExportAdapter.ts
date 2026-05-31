import type { ArticleBlock, ArticleBlockSlots, ArticleDocument, ArticleLeadInItem } from "./articleDocument";
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
const DEFAULT_LAYOUT_ID = "legacy-a4";
const DEFAULT_LAYOUT_VERSION = "legacy";

const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+[^\]]*|\s*PLACEHOLDER\b|\s*[—-]+\s*(?:ẢNH|PLACEHOLDER)\s*[—-]+\s*)[^\]]*\]/giu;
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
  return cleanScalarText(value)
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/giu, "")
    .replace(DRAFT_MARKER_PATTERN, "")
    .replace(OBJECT_TEXT_PATTERN, "")
    .replace(/\b(?:undefined|null)\b/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
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

function cleanTable(value: unknown): ArticleExportTable | undefined {
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
  return rows.length > 0 ? { rows } : undefined;
}

function blockId(block: LooseArticleBlock): string {
  const id = cleanArticleExportText(block.id);
  return id || `export-block-${Math.random().toString(36).slice(2, 8)}`;
}

function blockText(slots: Partial<ArticleBlockSlots>, slot: keyof ArticleBlockSlots = "text"): string {
  return cleanArticleExportText(slots[slot]);
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
      const table = cleanTable(slots.items ?? (slots as Record<string, unknown>).rows);
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
  });
  return warnings;
}

export function normalizeArticleDocumentForExport(articleDocument: ArticleDocument): ArticleExportModel {
  const document = asLooseDocument(articleDocument);
  const metadata = isRecord(document.metadata) ? (document.metadata as LooseMetadata) : {};
  const mappedBlocks = (Array.isArray(document.blocks) ? document.blocks : [])
    .map((block) => mapArticleBlockToExportBlock(block as ArticleBlock))
    .filter((block) => !isEmptyExportBlock(block));

  const titleFromMetadata = cleanArticleExportText(metadata.title);
  const titleFromBlock = mappedBlocks.reduce((value, block) => (value || (block.type === "title" ? block.text : "")), "");
  const sapoFromBlock = mappedBlocks.reduce((value, block) => (value || (block.type === "sapo" ? block.text : "")), "");
  const title = titleFromMetadata || titleFromBlock || DEFAULT_EXPORT_TITLE;
  const sapo = cleanArticleExportText(metadata.sapo) || sapoFromBlock || undefined;
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
