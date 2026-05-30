import {
  ARTICLE_DOCUMENT_SCHEMA_VERSION,
  createArticleBlockId,
  type ArticleBlock,
  type ArticleDocument,
  type ArticleLeadInItem,
} from "./articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "./blockRegistry";
import { getDefaultArticleTemplate } from "./templateRegistry";

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
}

interface ParsedLine {
  kind: "heading" | "paragraph" | "bullet" | "ordered" | "blank" | "figure";
  level?: number;
  number?: number;
  text: string;
  caption?: string;
}

const PLACEHOLDER_MARKER_PATTERN = /\[(?:\s*PLACEHOLDER[^\]]*|\s*[—-]+\s*(?:ẢNH|ANH|PLACEHOLDER)\s*[—-]+\s*)\]/gi;
const DRAFT_MARKER_PATTERN = /\[\s*(?:Bổ sung|Bo sung)\s*:\s*([^\]]+)\]/gi;
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
  const match = text.match(/^(Hình\s*\d*|Ảnh\s*\d*|Chú thích ảnh|Caption)\s*[:.：-]?\s+(.{2,})$/iu);
  if (!match) return undefined;

  return collapseDuplicatedCaption(`${match[1].trim()}: ${match[2].trim()}`);
}

function figureFromLine(line: string): { title: string; caption?: string } | null {
  const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]*)\)\s*$/);
  if (imageMatch) {
    const altText = stripInlineMarkdown(imageMatch[1] || "");
    return {
      title: "Vị trí chèn ảnh minh họa",
      caption: altText ? collapseDuplicatedCaption(altText) : undefined,
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
    };
  }

  return null;
}

function parseMarkdownLines(content: string): ParsedLine[] {
  return content.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return { kind: "blank", text: "" };

    const figure = figureFromLine(line);
    if (figure !== null) {
      return { kind: "figure", text: figure.title, caption: figure.caption };
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      return { kind: "heading", level: headingMatch[1].length, text: stripInlineMarkdown(headingMatch[2]) };
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

function isStrictIncreasingOrdered(lines: ParsedLine[]): boolean {
  if (lines.length === 0) return false;
  return lines.every((line, index) => line.number === index + 1);
}

function isDuplicateCaption(candidate: string, previousFigureCaption: string): boolean {
  return Boolean(previousFigureCaption && normalizeComparableText(candidate) === normalizeComparableText(previousFigureCaption));
}

function createFigureBlock(index: number, titleText: string, captionText?: string): ArticleBlock {
  const caption = captionText ? collapseDuplicatedCaption(captionText) : undefined;
  return createBlock("figure-placeholder", index, {
    title: titleText || "Vị trí chèn ảnh minh họa",
    ...(caption ? { caption } : {}),
  });
}

export function createArticleDocumentFromCurrentContent(
  content: string,
  options: CreateArticleDocumentOptions = {},
): ArticleDocument {
  const fallbackTemplate = getDefaultArticleTemplate();
  const templateId = options.templateId || fallbackTemplate.templateId;
  const templateVersion = options.templateVersion || fallbackTemplate.templateVersion;
  const parsedLines = parseMarkdownLines(content);
  const blocks: ArticleBlock[] = [];
  let blockIndex = 0;
  let resolvedTitle = options.title?.trim() || "Bài viết chưa có tiêu đề";
  let titleConsumed = Boolean(options.title?.trim());
  let sapoConsumed = Boolean(options.sapo?.trim());
  let previousText = "";
  let previousFigureCaption = "";
  const pendingBullets: string[] = [];
  const pendingOrdered: ParsedLine[] = [];

  const rememberText = (text: string) => {
    if (text.trim()) previousText = text.trim();
  };

  const flushBullets = () => {
    if (pendingBullets.length === 0) return;
    blocks.push(createBlock("bullet-list", blockIndex++, { items: [...pendingBullets] }));
    rememberText(pendingBullets[pendingBullets.length - 1] || "");
    pendingBullets.length = 0;
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

    // TODO: Add an ordered-list block only after template registry/export consumers allow it.
    // Until then, keep ordered source as paragraphs to avoid rendering numbered items as bullets.
    const strict = isStrictIncreasingOrdered(pendingOrdered);
    pendingOrdered.forEach((line, index) => {
      const prefix = strict ? `${index + 1}.` : `${line.number ?? index + 1}.`;
      const text = `${prefix} ${line.text}`.trim();
      blocks.push(createBlock("paragraph", blockIndex++, { text }));
      rememberText(text);
    });
    pendingOrdered.length = 0;
  };

  const flushLists = () => {
    flushBullets();
    flushOrdered();
  };

  if (options.title?.trim()) {
    blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
  }
  if (options.sapo?.trim()) {
    blocks.push(createBlock("sapo", blockIndex++, { text: options.sapo.trim() }));
  }

  parsedLines.forEach((line) => {
    if (line.kind === "blank") {
      flushLists();
      return;
    }

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

    if (line.kind === "figure") {
      blocks.push(createFigureBlock(blockIndex++, line.text, line.caption));
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

    blocks.push(createBlock("paragraph", blockIndex++, { text: line.text }));
    rememberText(line.text);
  });

  flushLists();

  if (!titleConsumed) {
    blocks.unshift(createBlock("title", 0, { text: resolvedTitle }));
  }

  if (blocks.length === 1) {
    blocks.push(createBlock("paragraph", 1, { text: "Nội dung bài viết sẽ được bổ sung trong bước biên tập tiếp theo." }));
  }

  return {
    id: options.id,
    schemaVersion: ARTICLE_DOCUMENT_SCHEMA_VERSION,
    documentVersion: 1,
    templateId,
    templateVersion,
    locale: "vi-VN",
    metadata: {
      title: resolvedTitle,
      sapo: options.sapo,
      authorName: options.authorName,
      organization: options.organization,
      category: options.category,
      createdAt: options.createdAt || new Date().toISOString(),
      status: options.status || "draft",
    },
    blocks,
  };
}
