import {
  ARTICLE_DOCUMENT_SCHEMA_VERSION,
  createArticleBlockId,
  type ArticleBlock,
  type ArticleDocument,
  type ArticleLeadInItem,
  type ArticleTableCell,
} from "./articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "./blockRegistry";
import { getDefaultArticleLayout } from "./layoutRegistry";
import { getDefaultArticleTemplate } from "./templateRegistry";
import { normalizeEditorialBriefContent } from "../editorialBrief";

export interface CreateArticleDocumentOptions {
  id?: string;
  title?: string;
  sapo?: string;
  authorName?: string;
  organization?: string;
  category?: string;
  createdAt?: string;
  status?: "draft" | "reviewed" | "published";
  templateId?: string;
  templateVersion?: string;
  layoutId?: string;
  layoutVersion?: string;
  estimatedPages?: number;
}

interface ParsedLine {
  kind: "heading" | "paragraph" | "bullet" | "ordered" | "blank" | "figure" | "table" | "quote" | "callout";
  level?: number;
  number?: number;
  text: string;
  caption?: string;
  description?: string;
  aspectRatio?: string;
  tableCells?: string[];
  tableSeparator?: boolean;
}

const PLACEHOLDER_MARKER_PATTERN = /\[(?:\s*PLACEHOLDER[^\]]*|\s*[—-]+\s*(?:ẢNH|ANH|PLACEHOLDER)\s*[—-]+\s*)\]/gi;
// Nhận diện dòng caption bảng kiểu "Bảng 1: …", "Bảng 1. …", "Bảng 2.1. …", "Bảng: …"
// Hỗ trợ số thứ tự nhiều cấp (2.1, 3.1.2) và dấu phân cách: : . ： - – —
const TABLE_CAPTION_PATTERN = /^Bảng\s*(?:\d+(?:\.\d+)*\.?\s*)?[:.：\-–—]\s*(.{2,180})$/iu;
const DRAFT_MARKER_PATTERN = /\[\s*(?:Bổ sung|Bo sung|Cần bổ sung|Can bo sung|Cần kiểm chứng|Can kiem chung)\s*:\s*([^\]]+)\]/gi;
const SEPARATOR_LINE_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/u;
const TEXT_PLACEHOLDER_PATTERN = /^(?:\d+[.)]\s*)?(?:Placehold|Placeholder|Vị trí chèn)\s+hình\s+minh\s+h[oọ][aạ]\s*[:：-]?\s*(.*)$/iu;
const LEAD_IN_CONTEXT_PATTERN = /(?:bao gồm|gồm|các nội dung sau|những nội dung sau|các điểm sau|cụ thể như sau)[:：]?$/i;
const LEAD_IN_LINE_PATTERN = /^([^:：]{3,90})[:：]\s*(.{2,})$/;

function normalizeComparableText(value: string): string {
  return stripPlaceholderMarkers(value)
    .toLocaleLowerCase("vi-VN")
    .replace(/[“”"'.,;:()\[\]{}\-–—_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDraftMarkers(value: string): string {
  return value.replace(DRAFT_MARKER_PATTERN, (_match, description: string) => {
    const cleanDescription = String(description || "").replace(/\s+/g, " ").trim();
    return cleanDescription ? `[Cần bổ sung: ${cleanDescription}]` : "[Cần bổ sung: dữ liệu]";
  });
}

function stripPlaceholderMarkers(value: string): string {
  return normalizeDraftMarkers(value).replace(PLACEHOLDER_MARKER_PATTERN, " ").replace(/\s+/g, " ").trim();
}

function collapseDuplicatedCaption(value: string): string {
  const cleaned = stripPlaceholderMarkers(value);
  const compact = cleaned.replace(/\s+/g, "").toLocaleLowerCase("vi-VN");
  if (compact.length < 8 || compact.length % 2 !== 0) return cleaned;

  const midpoint = compact.length / 2;
  if (compact.slice(0, midpoint) !== compact.slice(midpoint)) return cleaned;

  const originalMidpoint = Math.floor(cleaned.length / 2);
  return cleaned.slice(0, originalMidpoint).trim();
}

function stripInlineMarkdown(value: string): string {
  return stripPlaceholderMarkers(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function explicitCaptionFromText(value: string): string | undefined {
  const text = stripInlineMarkdown(value);
  const match = text.match(/^(Hình\s*\d*|Ảnh\s*\d*|Chú thích ảnh|Caption)\s*[:.：-]?\s*(.{2,})$/iu);
  if (!match) return undefined;

  return collapseDuplicatedCaption(`${match[1].trim()}: ${match[2].trim()}`);
}

function figureFromLine(line: string): { title: string; caption?: string; description?: string; aspectRatio?: string } | null {
  const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]*)\)\s*$/);
  if (imageMatch) {
    const altText = stripInlineMarkdown(imageMatch[1] || "");
    return {
      title: "Vị trí chèn ảnh minh họa",
      caption: altText ? collapseDuplicatedCaption(altText) : undefined,
      description: "Ảnh minh họa sẽ được bổ sung ở bước xuất bản.",
      aspectRatio: "16:9",
    };
  }

  const textualPlaceholder = line.match(TEXT_PLACEHOLDER_PATTERN);
  if (textualPlaceholder) {
    const detail = stripInlineMarkdown(textualPlaceholder[1] || "");
    const caption = explicitCaptionFromText(detail) || (detail && detail.length <= 180 ? collapseDuplicatedCaption(detail) : undefined);
    return {
      title: "Vị trí chèn ảnh minh họa",
      caption,
      description: detail && detail !== caption ? detail : "Ảnh minh họa dạng placeholder shape trong bản A4.",
      aspectRatio: "16:9",
    };
  }

  const placeholderMatch = line.match(/\[([^\]]*(?:PLACEHOLDER|ẢNH|ANH|HÌNH)[^\]]*)\]/i);
  if (placeholderMatch) {
    const markerTitle = placeholderMatch[1]
      .replace(/PLACEHOLDER|ẢNH|ANH|HÌNH|MINH HỌA|[—-]/gi, " ")
      .replace(/[:：]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const afterMarker = line.slice((placeholderMatch.index || 0) + placeholderMatch[0].length).trim();

    return {
      title: markerTitle || "Vị trí chèn ảnh minh họa",
      caption: explicitCaptionFromText(afterMarker),
      description: "Ảnh minh họa dạng placeholder shape trong bản A4.",
      aspectRatio: "16:9",
    };
  }

  return null;
}

function isMarkdownTableRow(line: string): boolean {
  const text = line.trim();
  return text.startsWith("|") && text.endsWith("|") && text.split("|").length >= 4;
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => stripInlineMarkdown(cell))
    .filter((cell) => cell.length > 0);
}

function isMarkdownTableSeparator(line: string): boolean {
  if (!isMarkdownTableRow(line)) return false;
  const cells = line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s+/gu, "")));
}


function parseMarkdownLines(content: string): ParsedLine[] {
  return content.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return { kind: "blank", text: "" };
    if (SEPARATOR_LINE_PATTERN.test(line)) return { kind: "blank", text: "" };
    if (isMarkdownTableRow(line)) {
      return { kind: "table", text: stripInlineMarkdown(line), tableCells: splitMarkdownTableRow(line), tableSeparator: isMarkdownTableSeparator(line) };
    }

    const figure = figureFromLine(line);
    if (figure !== null) {
      return { kind: "figure", text: figure.title, caption: figure.caption, description: figure.description, aspectRatio: figure.aspectRatio };
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      return { kind: "heading", level: headingMatch[1].length, text: stripInlineMarkdown(headingMatch[2]) };
    }

    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      return { kind: "quote", text: stripInlineMarkdown(quoteMatch[1]) };
    }

    const calloutMatch = line.match(/^\s*(?:Ghi chú|Lưu ý|Thông điệp chính|Điểm nhấn)\s*[:：]\s+(.+)$/iu);
    if (calloutMatch) {
      return { kind: "callout", text: stripInlineMarkdown(calloutMatch[1]) };
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      return { kind: "bullet", text: stripInlineMarkdown(bulletMatch[1]) };
    }

    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      return { kind: "ordered", number: Number(orderedMatch[1]), text: stripInlineMarkdown(orderedMatch[2]) };
    }

    return { kind: "paragraph", text: stripInlineMarkdown(line) };
  });
}

function createBlock(type: ArticleBlock["type"], index: number, slots: ArticleBlock["slots"], variant?: string): ArticleBlock {
  const definition = ARTICLE_BLOCK_REGISTRY[type];
  return {
    id: createArticleBlockId(type, index),
    type,
    variant,
    slots,
    styleId: definition.defaultStyleId,
    pageBreakPolicy: definition.defaultPageBreakPolicy,
  };
}

function parseLeadInItem(text: string): ArticleLeadInItem | null {
  const cleaned = text.replace(/^\d+[.)]\s+/, "").trim();
  const match = cleaned.match(LEAD_IN_LINE_PATTERN);
  if (!match) return null;

  const label = match[1].trim();
  const body = match[2].trim();
  if (!label || !body || label.split(/\s+/).length > 12) return null;
  return { label, body };
}

function shouldFlushOrderedAsLeadIn(lines: ParsedLine[], previousText: string): boolean {
  if (lines.length < 2 && !LEAD_IN_CONTEXT_PATTERN.test(previousText.trim())) return false;
  return lines.every((line) => Boolean(parseLeadInItem(line.text)));
}

function isDuplicateCaption(candidate: string, previousFigureCaption: string): boolean {
  return Boolean(previousFigureCaption && normalizeComparableText(candidate) === normalizeComparableText(previousFigureCaption));
}

function createFigureBlock(index: number, titleText: string, captionText?: string, descriptionText?: string, aspectRatio?: string): ArticleBlock {
  const caption = captionText ? collapseDuplicatedCaption(captionText) : undefined;
  return createBlock("figure-placeholder", index, {
    title: titleText || "Vị trí chèn ảnh minh họa",
    description: descriptionText || "Ảnh minh họa dạng placeholder shape trong bản A4.",
    aspectRatio: aspectRatio || "16:9",
    ...(caption ? { caption } : {}),
  });
}

export function createArticleDocumentFromCurrentContent(
  content: string,
  options: CreateArticleDocumentOptions = {},
): ArticleDocument {
  const fallbackTemplate = getDefaultArticleTemplate();
  const fallbackLayout = getDefaultArticleLayout();
  const templateId = options.templateId || fallbackTemplate.templateId;
  const templateVersion = options.templateVersion || fallbackTemplate.templateVersion;
  const layoutId = options.layoutId || fallbackLayout.layoutId;
  const layoutVersion = options.layoutVersion || fallbackLayout.layoutVersion;
  const estimatedPages = options.estimatedPages ?? fallbackLayout.estimatedPages;
  const parsedLines = parseMarkdownLines(normalizeEditorialBriefContent(content));
  const blocks: ArticleBlock[] = [];
  let blockIndex = 0;

  // Use provided options as fallback, but content remains primary
  let resolvedTitle = options.title?.trim() || "";
  let resolvedSapo = options.sapo?.trim() || "";
  
  // Strategy: If title/sapo are provided in options, we'll try to find them in content first.
  // If found/parsed from content, we use content version.
  // If NOT found in content, we push them from options ONLY if they are substantial.
  
  let titleConsumed = false;
  let sapoConsumed = false;

  // Pre-parse check for title to avoid duplication if it's the very first heading
  const firstHeadingLine = parsedLines.find(l => l.kind === "heading" && l.level === 1);
  if (firstHeadingLine && resolvedTitle && normalizeComparableText(firstHeadingLine.text) === normalizeComparableText(resolvedTitle)) {
    // If first # Heading matches options.title, we skip pushing it from options and let it be consumed by parser
  } else if (resolvedTitle) {
    // If no match but title exists in options, push it now as a block
    blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
    titleConsumed = true;
  }

  // Similar for sapo - if options.sapo matches a paragraph at the start, skip pushing from options
  const firstSignificantPara = parsedLines.find(l => l.kind === "paragraph" && l.text.length > 5);
  if (firstSignificantPara && resolvedSapo && normalizeComparableText(firstSignificantPara.text) === normalizeComparableText(resolvedSapo)) {
    // If first para matches sapo, skip pushing header-input sapo from options
  } else if (resolvedSapo) {
    blocks.push(createBlock("sapo", blockIndex++, { text: resolvedSapo }));
    sapoConsumed = true;
  }

  let previousText = "";
  let previousFigureCaption = "";
  const pendingBullets: string[] = [];
  const pendingOrdered: ParsedLine[] = [];
  const pendingTableRows: string[][] = [];
  let pendingTableCaption: string | undefined = undefined;
  let pendingCaptionParagraphText: string | undefined = undefined;

  const rememberText = (text: string) => {
    if (text.trim()) previousText = text.trim();
  };

  const flushBullets = () => {
    if (pendingBullets.length === 0) return;
    blocks.push(createBlock("bullet-list", blockIndex++, { items: [...pendingBullets] }));
    rememberText(pendingBullets[pendingBullets.length - 1] || "");
    pendingBullets.length = 0;
  };

  const flushTable = () => {
    if (pendingTableRows.length === 0) {
      // Nếu có caption đang chờ nhưng không có bảng đến → push lại như paragraph bình thường
      if (pendingCaptionParagraphText) {
        blocks.push(createBlock("paragraph", blockIndex++, { text: pendingCaptionParagraphText }));
      }
      pendingTableCaption = undefined;
      pendingCaptionParagraphText = undefined;
      return;
    }
    const rows: ArticleTableCell[][] = pendingTableRows.map((row, rowIndex) =>
      row.map((text) => ({ text, header: rowIndex === 0 })),
    );
    const captionSlot = pendingTableCaption ? { caption: pendingTableCaption } : {};
    blocks.push(createBlock("table", blockIndex++, { rows, ...captionSlot }));
    rememberText(pendingTableRows[pendingTableRows.length - 1]?.join(" ") || "");
    pendingTableRows.length = 0;
    pendingTableCaption = undefined;
    pendingCaptionParagraphText = undefined;
  };

  const flushOrdered = () => {
    if (pendingOrdered.length === 0) return;

    if (shouldFlushOrderedAsLeadIn(pendingOrdered, previousText)) {
      const items = pendingOrdered.map((line) => parseLeadInItem(line.text)).filter(Boolean) as ArticleLeadInItem[];
      blocks.push(createBlock("lead-in-list", blockIndex++, { items }, "paragraph"));
      rememberText(items[items.length - 1]?.body || "");
      pendingOrdered.length = 0;
      return;
    }

    const items = pendingOrdered.map((line) => line.text).filter(Boolean);
    if (items.length > 0) {
      blocks.push(createBlock("ordered-list", blockIndex++, { items }));
      rememberText(items[items.length - 1] || "");
    }
    pendingOrdered.length = 0;
  };

  const flushLists = () => {
    flushBullets();
    flushOrdered();
    flushTable();
  };

  parsedLines.forEach((line) => {
    if (line.kind === "blank") {
      flushLists();
      return;
    }

    if (line.kind !== "table") flushTable();
    if (line.kind !== "bullet") flushBullets();
    if (line.kind !== "ordered") flushOrdered();

    if (line.kind === "heading") {
      previousFigureCaption = "";
      if (!titleConsumed && line.level === 1) {
        resolvedTitle = line.text || resolvedTitle;
        blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
        titleConsumed = true;
      } else {
        blocks.push(createBlock("section-heading", blockIndex++, { text: line.text }));
      }
      rememberText(line.text);
      return;
    }

    if (line.kind === "bullet") {
      previousFigureCaption = "";
      if (line.text) pendingBullets.push(line.text);
      return;
    }

    if (line.kind === "ordered") {
      previousFigureCaption = "";
      if (line.text) pendingOrdered.push(line);
      return;
    }

    if (line.kind === "table") {
      previousFigureCaption = "";
      if (!line.tableSeparator && line.tableCells && line.tableCells.length > 0) pendingTableRows.push(line.tableCells);
      return;
    }

    if (line.kind === "quote") {
      previousFigureCaption = "";
      blocks.push(createBlock("quote", blockIndex++, { text: line.text }));
      rememberText(line.text);
      return;
    }

    if (line.kind === "callout") {
      previousFigureCaption = "";
      blocks.push(createBlock("callout", blockIndex++, { text: line.text }));
      rememberText(line.text);
      return;
    }

    if (line.kind === "figure") {
      blocks.push(createFigureBlock(blockIndex++, line.text, line.caption, line.description, line.aspectRatio));
      previousFigureCaption = line.caption || "";
      return;
    }

    if (previousFigureCaption && isDuplicateCaption(line.text, previousFigureCaption)) {
      return;
    }
    previousFigureCaption = "";

    if (!titleConsumed) {
      resolvedTitle = line.text.slice(0, 180) || resolvedTitle;
      blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
      titleConsumed = true;
      rememberText(line.text);
      return;
    }

    if (!sapoConsumed && line.text.length <= 450) {
      blocks.push(createBlock("sapo", blockIndex++, { text: line.text }));
      sapoConsumed = true;
      rememberText(line.text);
      return;
    }

    // Kiểm tra nếu dòng paragraph này là caption bảng (sẽ dùng nếu block tiếp theo là bảng)
    const captionMatch = line.text.match(TABLE_CAPTION_PATTERN);
    if (captionMatch) {
      // Đánh dấu caption tạm thời; block sẽ được tạo nếu không có bảng theo sau
      pendingTableCaption = captionMatch[1].trim();
      pendingCaptionParagraphText = line.text;
      // Không push paragraph ngay — sẽ push lại trong flushTable nếu bảng không đến
    } else {
      // Caption mới không phải bảng → flush caption cũ nếu còn đang chờ
      if (pendingCaptionParagraphText) {
        blocks.push(createBlock("paragraph", blockIndex++, { text: pendingCaptionParagraphText }));
        pendingTableCaption = undefined;
        pendingCaptionParagraphText = undefined;
      }
      blocks.push(createBlock("paragraph", blockIndex++, { text: line.text }));
    }
    rememberText(line.text);
  });

  flushLists();

  if (blocks.length === 0 && !titleConsumed) {
    blocks.push(createBlock("title", 0, { text: resolvedTitle }));
  }

  if (blocks.length <= 1 && !blocks.find(b => b.type === "paragraph")) {
    blocks.push(createBlock("paragraph", blockIndex++, { text: "Nội dung bài viết sẽ được bổ sung trong bước biên tập tiếp theo." }));
  }

  return {
    id: options.id,
    schemaVersion: ARTICLE_DOCUMENT_SCHEMA_VERSION,
    documentVersion: 1,
    templateId,
    templateVersion,
    layoutId,
    layoutVersion,
    estimatedPages,
    locale: "vi-VN",
    metadata: {
      title: resolvedTitle,
      sapo: resolvedSapo || options.sapo,
      authorName: options.authorName,
      organization: options.organization,
      category: options.category,
      createdAt: options.createdAt || new Date().toISOString(),
      status: options.status || "draft",
    },
    blocks,
  };
}
