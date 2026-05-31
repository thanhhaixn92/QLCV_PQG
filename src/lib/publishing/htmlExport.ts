import type { ArticleBlock, ArticleDocument, ArticleLeadInItem } from "./articleDocument";

export interface ArticleHtmlExportOptions {
  title?: string;
  generatedAt?: Date;
}

const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+(?:bổ sung|bổ sung\/kiểm chứng|kiểm chứng)\s*:?|\s*PLACEHOLDER\b|\s*[—-]+\s*(?:ẢNH|PLACEHOLDER)\s*[—-]+\s*)[^\]]*\]/giu;

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

export function cleanTextForExport(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(DRAFT_MARKER_PATTERN, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function textSlot(block: ArticleBlock, slot: "text" | "title" | "caption" | "note" = "text"): string {
  return cleanTextForExport(block.slots?.[slot]);
}

function renderTextElement(tagName: string, className: string, text: string): string {
  if (!text) return "";
  return `<${tagName} class="${className}">${escapeHtml(text)}</${tagName}>`;
}

function stringItems(block: ArticleBlock): string[] {
  if (!Array.isArray(block.slots?.items)) return [];
  return block.slots.items
    .map((item) => cleanTextForExport(item))
    .filter((item) => item.length > 0);
}

function leadInItems(block: ArticleBlock): ArticleLeadInItem[] {
  if (!Array.isArray(block.slots?.items)) return [];
  return block.slots.items
    .map((item) => {
      if (!item || typeof item !== "object" || typeof item.label !== "string" || typeof item.body !== "string") {
        return undefined;
      }
      const label = cleanTextForExport(item.label);
      const body = cleanTextForExport(item.body);
      if (!label && !body) return undefined;
      return { label, body } satisfies ArticleLeadInItem;
    })
    .filter((item): item is ArticleLeadInItem => Boolean(item));
}

function renderListItems(items: string[]): string {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n");
}

function renderLeadInBlock(block: ArticleBlock): string {
  const items = leadInItems(block);
  if (items.length === 0) return "";

  if (block.variant === "paragraph") {
    return `<div class="lead-in-list lead-in-paragraphs">${items
      .map((item) => `<p><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.body)}</p>`)
      .join("\n")}</div>`;
  }

  return `<ul class="lead-in-list">${items
    .map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.body)}</li>`)
    .join("\n")}</ul>`;
}

function renderFigurePlaceholder(block: ArticleBlock): string {
  const title = textSlot(block, "title");
  const caption = textSlot(block, "caption");
  const note = textSlot(block, "note");
  const boxLabel = title && title !== caption ? title : "Vị trí chèn ảnh minh họa";

  return `<figure class="figure-placeholder">
  <div class="figure-placeholder-box">
    <span>${escapeHtml(boxLabel)}</span>
    ${note ? `<small>${escapeHtml(note)}</small>` : ""}
  </div>
  ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
</figure>`;
}

function renderArticleBlock(block: ArticleBlock): string {
  switch (block.type) {
    case "title":
      return renderTextElement("h1", "article-title", textSlot(block));
    case "sapo":
      return renderTextElement("p", "article-sapo", textSlot(block));
    case "section-heading":
      return renderTextElement("h2", "section-heading", textSlot(block));
    case "paragraph":
      return renderTextElement("p", "article-paragraph", textSlot(block));
    case "conclusion":
      return renderTextElement("p", "article-paragraph article-conclusion", textSlot(block));
    case "bullet-list": {
      const items = stringItems(block);
      return items.length > 0 ? `<ul class="bullet-list">${renderListItems(items)}</ul>` : "";
    }
    case "lead-in-list":
      return renderLeadInBlock(block);
    case "figure-placeholder":
      return renderFigurePlaceholder(block);
    case "page-break":
      return `<div class="page-break" aria-hidden="true"></div>`;
    default:
      return "";
  }
}

function findDocumentTitle(document: ArticleDocument, options: ArticleHtmlExportOptions): string {
  const explicitTitle = cleanTextForExport(options.title);
  if (explicitTitle) return explicitTitle;

  const metadataTitle = cleanTextForExport(document.metadata?.title);
  if (metadataTitle) return metadataTitle;

  const titleBlock = document.blocks.find((block) => block.type === "title");
  const blockTitle = titleBlock ? textSlot(titleBlock) : "";
  return blockTitle || "Bài viết A4";
}

function renderArticleBody(document: ArticleDocument): string {
  return document.blocks
    .map(renderArticleBlock)
    .filter((html) => html.trim().length > 0)
    .join("\n\n");
}

function buildA4Css(): string {
  return `
:root {
  color: #111827;
  background: #f3f4f6;
  font-family: "Times New Roman", Times, serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f3f4f6;
}

.article-page {
  width: 210mm;
  min-height: 297mm;
  margin: 24px auto;
  padding: 22mm 20mm;
  background: #ffffff;
  color: #111827;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
}

.article-title {
  margin: 0 0 16px;
  color: #002d56;
  font-size: 28pt;
  line-height: 1.16;
  text-align: center;
  font-weight: 700;
}

.article-sapo {
  margin: 0 0 16px;
  font-size: 13.5pt;
  line-height: 1.65;
  font-weight: 700;
  text-align: justify;
}

.section-heading {
  margin: 22px 0 10px;
  color: #002d56;
  font-size: 17pt;
  line-height: 1.3;
  font-weight: 700;
  text-align: left;
  break-after: avoid;
}

.article-paragraph,
.lead-in-paragraphs p {
  margin: 0 0 12px;
  font-size: 13pt;
  line-height: 1.72;
  text-align: justify;
}

.article-conclusion {
  font-weight: 600;
}

.bullet-list,
.lead-in-list {
  margin: 0 0 14px 22px;
  padding: 0;
  font-size: 13pt;
  line-height: 1.65;
}

.bullet-list li,
.lead-in-list li {
  margin: 0 0 7px;
  padding-left: 4px;
  text-align: justify;
}

.figure-placeholder {
  margin: 18px 0;
  break-inside: avoid;
}

.figure-placeholder-box {
  min-height: 58mm;
  border: 1.5px dashed #7894ad;
  border-radius: 14px;
  background: #f8fbfd;
  color: #31506d;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20px;
  text-align: center;
}

.figure-placeholder-box span {
  font-size: 13pt;
  font-weight: 700;
}

.figure-placeholder-box small {
  font-size: 10.5pt;
  color: #64748b;
}

figcaption {
  margin-top: 8px;
  color: #334155;
  font-size: 11.5pt;
  font-style: italic;
  line-height: 1.45;
  text-align: center;
}

blockquote {
  margin: 16px 0;
  padding: 10px 16px;
  border-left: 4px solid #94a3b8;
  color: #334155;
  background: #f8fafc;
  font-size: 13pt;
  line-height: 1.65;
}

table {
  width: 100%;
  margin: 16px 0;
  border-collapse: collapse;
  font-size: 12pt;
}

th,
td {
  border: 1px solid #94a3b8;
  padding: 7px 9px;
  vertical-align: top;
}

th {
  background: #eaf1f8;
  color: #002d56;
  font-weight: 700;
}

.page-break {
  break-before: page;
  page-break-before: always;
  height: 0;
}

@page {
  size: A4;
  margin: 0;
}

@media print {
  :root,
  body {
    background: #ffffff;
  }

  .article-page {
    width: auto;
    min-height: auto;
    margin: 0;
    padding: 20mm 18mm;
    box-shadow: none;
  }
}
`.trim();
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildArticleHtmlFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  return `bai-viet-a4-${year}${month}${day}-${hours}${minutes}.html`;
}

export function buildArticleHtml(document: ArticleDocument, options: ArticleHtmlExportOptions = {}): string {
  const title = findDocumentTitle(document, options);
  const generatedAt = options.generatedAt || new Date();
  const bodyHtml = renderArticleBody(document);

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="VMS Navigator A4 ArticleDocument HTML Export">
  <meta name="created" content="${escapeHtml(generatedAt.toISOString())}">
  <title>${escapeHtml(title)}</title>
  <style>${buildA4Css()}</style>
</head>
<body>
  <main class="article-page" data-template-id="${escapeHtml(document.templateId)}" data-document-version="${escapeHtml(String(document.documentVersion))}">
${bodyHtml}
  </main>
</body>
</html>`;
}

export const exportArticleDocumentToHtml = buildArticleHtml;
