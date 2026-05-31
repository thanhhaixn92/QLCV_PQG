export type ArticleTextAlignment = "left" | "center" | "right" | "justify";

export interface ArticleStyleDefinition {
  styleId: string;
  label: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  alignment: ArticleTextAlignment;
  marginBefore: number;
  marginAfter: number;
  bold?: boolean;
  italic?: boolean;
  indent?: number;
}

export const ARTICLE_STYLE_REGISTRY = {
  "article.page.a4": {
    styleId: "article.page.a4",
    label: "Trang A4 bài viết",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13.5,
    lineHeight: 1.5,
    alignment: "left",
    marginBefore: 0,
    marginAfter: 0,
  },
  "article.title": {
    styleId: "article.title",
    label: "Tiêu đề bài viết",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 22,
    lineHeight: 1.25,
    alignment: "center",
    marginBefore: 0,
    marginAfter: 18,
    bold: true,
  },
  "article.sapo": {
    styleId: "article.sapo",
    label: "Sapo / Mở bài",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 14,
    lineHeight: 1.5,
    alignment: "justify",
    marginBefore: 0,
    marginAfter: 14,
    bold: true,
  },
  "article.heading2": {
    styleId: "article.heading2",
    label: "Đề mục cấp 2",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 16,
    lineHeight: 1.35,
    alignment: "left",
    marginBefore: 18,
    marginAfter: 10,
    bold: true,
  },
  "article.heading3": {
    styleId: "article.heading3",
    label: "Đề mục cấp 3",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 14.5,
    lineHeight: 1.4,
    alignment: "left",
    marginBefore: 14,
    marginAfter: 8,
    bold: true,
  },
  "article.body": {
    styleId: "article.body",
    label: "Thân bài",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13.5,
    lineHeight: 1.5,
    alignment: "justify",
    marginBefore: 0,
    marginAfter: 10,
    indent: 18,
  },
  "article.leadInLabel": {
    styleId: "article.leadInLabel",
    label: "Nhãn ý dẫn",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13.5,
    lineHeight: 1.5,
    alignment: "justify",
    marginBefore: 0,
    marginAfter: 8,
    bold: true,
  },
  "article.bullet": {
    styleId: "article.bullet",
    label: "Gạch đầu dòng",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13.5,
    lineHeight: 1.5,
    alignment: "justify",
    marginBefore: 0,
    marginAfter: 8,
  },
  "article.caption": {
    styleId: "article.caption",
    label: "Chú thích ảnh",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 12.5,
    lineHeight: 1.35,
    alignment: "center",
    marginBefore: 8,
    marginAfter: 10,
    italic: true,
  },
  "article.figurePlaceholder": {
    styleId: "article.figurePlaceholder",
    label: "Khung ảnh chờ",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13,
    lineHeight: 1.4,
    alignment: "center",
    marginBefore: 14,
    marginAfter: 12,
    italic: true,
  },
  "article.quote": {
    styleId: "article.quote",
    label: "Trích dẫn",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13.5,
    lineHeight: 1.5,
    alignment: "justify",
    marginBefore: 12,
    marginAfter: 12,
    italic: true,
  },
  "article.callout": {
    styleId: "article.callout",
    label: "Khối nhấn mạnh / fact box",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 13.5,
    lineHeight: 1.45,
    alignment: "left",
    marginBefore: 12,
    marginAfter: 12,
  },
  "article.table": {
    styleId: "article.table",
    label: "Bảng dữ liệu",
    fontFamily: "Times New Roman, Times, serif",
    fontSize: 12.5,
    lineHeight: 1.35,
    alignment: "left",
    marginBefore: 12,
    marginAfter: 12,
  },
} as const satisfies Record<string, ArticleStyleDefinition>;

export type ArticleStyleId = keyof typeof ARTICLE_STYLE_REGISTRY;

export function hasArticleStyle(styleId: string): styleId is ArticleStyleId {
  return Object.prototype.hasOwnProperty.call(ARTICLE_STYLE_REGISTRY, styleId);
}

// TODO: Add a renderer-specific fontResolver when PDF/DOCX generation is migrated to ArticleDocument.
