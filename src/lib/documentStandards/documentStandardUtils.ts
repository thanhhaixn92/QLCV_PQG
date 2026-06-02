import type {
  DocumentCaptionPosition,
  DocumentPreflightFigure,
  DocumentPreflightParagraph,
  DocumentPreflightStructuredInput,
  DocumentPreflightTable,
} from "../../types/editorialDocumentStandards";

export interface TextRangeHint {
  text: string;
  index: number;
  targetHint: string;
}

export interface AdministrativeHeaderHints {
  hasOrganizationName: boolean;
  hasNationalHeader: boolean;
  hasMotto: boolean;
  hasDocumentNumberOrSymbol: boolean;
  hasPlaceDateLine: boolean;
  hasRecipientLine: boolean;
  hasSignatureBlock: boolean;
}

export interface CaptionHint {
  hasCaption: boolean;
  captionPosition: DocumentCaptionPosition;
  hasSourceOrNote: boolean;
}

const TECHNICAL_MARKER_PATTERNS: RegExp[] = [
  /\[(?:PLACEHOLDER|—\s*(?:ẢNH|PLACEHOLDER)\s*—|Bổ sung:).*?\]/giu,
  /(?:TODO|FIXME|XXX|lorem ipsum|placeholder|sample text|copy here)/giu,
  /(?:data-export-exclude|contenteditable|draggable=|aria-label=)/giu,
];

const RAW_MARKDOWN_PATTERNS: RegExp[] = [
  /^#{1,6}\s+/gmu,
  /\*\*[^*]+\*\*/gu,
  /__(?:[^_]+)__/gu,
  /`{1,3}[^`]+`{1,3}/gu,
  /^[-*+]\s+/gmu,
];

const AI_SUGGESTION_PATTERNS: RegExp[] = [
  /\b(?:gợi ý của AI|AI suggests|suggested by AI|đề xuất AI|phương án AI)\b/giu,
  /\[(?:AI|Copilot|Gemini)\s*(?:suggestion|draft|đề xuất).*?\]/giu,
];

export function normalizeTextForPreflight(text: string): string {
  return text
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v]+/gu, " ")
    .replace(/[ \u00a0]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function splitParagraphs(text: string): DocumentPreflightParagraph[] {
  return normalizeTextForPreflight(text)
    .split(/\n{2,}|\n(?=\S)/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({ id: `paragraph-${index + 1}`, text: paragraph, role: "body" }));
}

export function detectLongParagraphs(paragraphs: DocumentPreflightParagraph[], maxWords = 130): TextRangeHint[] {
  return paragraphs
    .map((paragraph, index) => ({ paragraph, index, wordCount: countWords(paragraph.text) }))
    .filter(({ wordCount }) => wordCount > maxWords)
    .map(({ paragraph, index, wordCount }) => ({
      text: paragraph.text,
      index,
      targetHint: `${paragraph.id ?? `paragraph-${index + 1}`} (${wordCount} words)`,
    }));
}

export function detectTechnicalMarkers(text: string): TextRangeHint[] {
  return collectPatternMatches(text, TECHNICAL_MARKER_PATTERNS, "technical-marker");
}

export function detectRawMarkdownMarkers(text: string): TextRangeHint[] {
  return collectPatternMatches(text, RAW_MARKDOWN_PATTERNS, "raw-markdown");
}

export function detectAiSuggestionMarkers(text: string): TextRangeHint[] {
  return collectPatternMatches(text, AI_SUGGESTION_PATTERNS, "ai-suggestion-marker");
}

export function detectAdministrativeHeaderHints(
  text: string,
  metadata?: DocumentPreflightStructuredInput["metadata"],
): AdministrativeHeaderHints {
  const normalized = normalizeTextForPreflight(text).toLocaleLowerCase("vi-VN");
  return {
    hasOrganizationName: Boolean(metadata?.organizationName) || /(?:công ty|tổng công ty|ủy ban|ban quản lý|cục|sở|bộ)\b/iu.test(text),
    hasNationalHeader: Boolean(metadata?.hasNationalHeader) || /cộng hòa xã hội chủ nghĩa việt nam/iu.test(normalized),
    hasMotto: Boolean(metadata?.hasMotto) || /độc lập\s*[-–—]\s*tự do\s*[-–—]\s*hạnh phúc/iu.test(normalized),
    hasDocumentNumberOrSymbol:
      Boolean(metadata?.documentNumberOrSymbol) || /\b(?:số|no\.)\s*[:：]?\s*\d+[\w/.-]*/iu.test(text),
    hasPlaceDateLine:
      Boolean(metadata?.placeDateLine) || /(?:ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}|,\s*ngày\s+\d{1,2})/iu.test(text),
    hasRecipientLine: Boolean(metadata?.recipientLine) || /\b(?:kính gửi|nơi nhận)\s*[:：]/iu.test(text),
    hasSignatureBlock:
      Boolean(metadata?.signatureBlock) || /\b(?:người ký|ký tên|thủ trưởng|giám đốc|trưởng ban|tm\.|kt\.)\b/iu.test(text),
  };
}

export function detectTableCaptionHints(table: DocumentPreflightTable, surroundingText = ""): CaptionHint {
  const inferredCaption = table.caption || matchNearbyCaption(surroundingText, /(?:^|\n)\s*(?:bảng|table)\s+\d*[:.\-–]?\s+.+/iu);
  return {
    hasCaption: Boolean(inferredCaption?.trim()),
    captionPosition: table.captionPosition ?? (inferredCaption ? "above" : "unknown"),
    hasSourceOrNote: Boolean(table.source?.trim() || table.note?.trim() || /\b(?:nguồn|ghi chú|source|note)\s*[:：]/iu.test(surroundingText)),
  };
}

export function detectFigureCaptionHints(figure: DocumentPreflightFigure, surroundingText = ""): CaptionHint {
  const inferredCaption = figure.caption || matchNearbyCaption(surroundingText, /(?:^|\n)\s*(?:hình|ảnh|figure)\s+\d*[:.\-–]?\s+.+/iu);
  return {
    hasCaption: Boolean(inferredCaption?.trim()),
    captionPosition: figure.captionPosition ?? (inferredCaption ? "below" : "unknown"),
    hasSourceOrNote: Boolean(figure.source?.trim() || figure.note?.trim() || /\b(?:nguồn|ghi chú|source|note)\s*[:：]/iu.test(surroundingText)),
  };
}

export function detectPossibleNumericClaims(text: string): TextRangeHint[] {
  const pattern = /(?:\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:%|tỷ|triệu|nghìn|km|m2|ha|USD|VND|đồng)?\b|\b(?:năm|tháng|ngày)\s+\d{4}\b)/giu;
  return collectPatternMatches(text, [pattern], "numeric-claim").filter((match) => !hasSourceHintNear(text, match.index));
}

export function detectStandaloneGarbageText(paragraphs: DocumentPreflightParagraph[]): TextRangeHint[] {
  return paragraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => /^(?:bb|aa|xx|yy|zz|test|draft|temp)$/iu.test(paragraph.text.trim()))
    .map(({ paragraph, index }) => ({
      text: paragraph.text,
      index,
      targetHint: paragraph.id ?? `paragraph-${index + 1}`,
    }));
}

export function countWords(text: string): number {
  return normalizeTextForPreflight(text).split(/\s+/u).filter(Boolean).length;
}

export function hasSourceHintNear(text: string, index: number, radius = 180): boolean {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return /\b(?:nguồn|theo|trích|căn cứ|source|reference|ref\.|dẫn chứng)\b/iu.test(text.slice(start, end));
}

export function hasLegalOrPolicyClaim(text: string): boolean {
  return /\b(?:luật|nghị định|thông tư|quyết định|công văn|quy định|chính sách|điều\s+\d+)\b/iu.test(text);
}

export function isHeadingCapitalizationInconsistent(heading: string): boolean {
  const lettersOnly = heading.replace(/[^\p{L}\s]/gu, "").trim();
  if (!lettersOnly) return false;
  const words = lettersOnly.split(/\s+/u).filter((word) => word.length > 2);
  if (words.length < 3) return false;
  const allUpper = words.every((word) => word === word.toLocaleUpperCase("vi-VN"));
  const titleCaseCount = words.filter((word) => /^\p{Lu}/u.test(word)).length;
  const mixedUpperCount = words.filter((word) => /\p{Lu}/u.test(word.slice(1))).length;
  return !allUpper && titleCaseCount > 0 && titleCaseCount < words.length && mixedUpperCount > 0;
}

export function looksLikeConclusion(text: string): boolean {
  return /\b(?:kết luận|tóm lại|nhìn chung|trên đây|kiến nghị|đề xuất|tổ chức thực hiện)\b/iu.test(text);
}

export function looksLikeDataTable(table: DocumentPreflightTable): boolean {
  return Boolean(
    table.isDataLike ||
      table.rows?.some((row) => row.some((cell) => /\d/.test(cell))) ||
      table.headers?.some((header) => /(?:số lượng|tỷ lệ|giá trị|năm|tháng|kết quả)/iu.test(header)),
  );
}

function collectPatternMatches(text: string, patterns: RegExp[], prefix: string): TextRangeHint[] {
  const matches: TextRangeHint[] = [];
  patterns.forEach((pattern) => {
    const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        index: match.index,
        targetHint: `${prefix}@${match.index}`,
      });
      if (match[0].length === 0) regex.lastIndex += 1;
    }
  });
  return matches;
}

function matchNearbyCaption(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[0]?.trim();
}
