import type { ArticleBlockType, ArticlePageBreakPolicy } from "./articleDocument";
import type { ArticleStyleId } from "./styleRegistry";

export type ArticleSlotType = "plainText" | "plainTextArray" | "leadInItems" | "tableRows";

export interface ArticleBlockDefinition {
  type: ArticleBlockType;
  label: string;
  requiredSlots: string[];
  optionalSlots: string[];
  slotTypes: Record<string, ArticleSlotType>;
  maxChars?: number;
  maxItems?: number;
  contentHint: string;
  renderIntent: string;
  defaultStyleId: ArticleStyleId;
  defaultPageBreakPolicy: ArticlePageBreakPolicy;
}

export const ARTICLE_BLOCK_REGISTRY: Record<ArticleBlockType, ArticleBlockDefinition> = {
  title: {
    type: "title",
    label: "Tiêu đề",
    requiredSlots: ["text"],
    optionalSlots: [],
    slotTypes: { text: "plainText" },
    maxChars: 180,
    contentHint: "Tiêu đề ngắn, rõ ý, không HTML.",
    renderIntent: "h1 chính giữa, nổi bật.",
    defaultStyleId: "article.title",
    defaultPageBreakPolicy: "avoid",
  },
  sapo: {
    type: "sapo",
    label: "Sapo",
    requiredSlots: ["text"],
    optionalSlots: [],
    slotTypes: { text: "plainText" },
    maxChars: 450,
    contentHint: "Đoạn mở đầu cô đọng, không bullet, không HTML.",
    renderIntent: "Đoạn in đậm, căn đều.",
    defaultStyleId: "article.sapo",
    defaultPageBreakPolicy: "avoid",
  },
  "section-heading": {
    type: "section-heading",
    label: "Đề mục",
    requiredSlots: ["text"],
    optionalSlots: [],
    slotTypes: { text: "plainText" },
    maxChars: 140,
    contentHint: "Đề mục ngắn, không HTML.",
    renderIntent: "Heading không căn đều, tránh bị tách khỏi đoạn sau.",
    defaultStyleId: "article.heading2",
    defaultPageBreakPolicy: "avoid",
  },
  paragraph: {
    type: "paragraph",
    label: "Đoạn văn",
    requiredSlots: ["text"],
    optionalSlots: [],
    slotTypes: { text: "plainText" },
    maxChars: 1200,
    contentHint: "Một đoạn văn hoàn chỉnh, không bullet, không HTML.",
    renderIntent: "Đoạn văn thân bài căn đều.",
    defaultStyleId: "article.body",
    defaultPageBreakPolicy: "auto",
  },
  "lead-in-list": {
    type: "lead-in-list",
    label: "Danh sách nhãn dẫn",
    requiredSlots: ["items"],
    optionalSlots: [],
    slotTypes: { items: "leadInItems" },
    maxItems: 8,
    maxChars: 280,
    contentHint: "Mỗi ý gồm nhãn và nội dung: Nhãn: nội dung. Không HTML.",
    renderIntent: "Danh sách các ý có nhãn in đậm; variant quyết định bullet hay đoạn.",
    defaultStyleId: "article.leadInLabel",
    defaultPageBreakPolicy: "avoid",
  },
  "bullet-list": {
    type: "bullet-list",
    label: "Danh sách gạch đầu dòng",
    requiredSlots: ["items"],
    optionalSlots: [],
    slotTypes: { items: "plainTextArray" },
    maxItems: 12,
    maxChars: 280,
    contentHint: "Danh sách các ý ngắn, không HTML.",
    renderIntent: "ul/li semantic.",
    defaultStyleId: "article.bullet",
    defaultPageBreakPolicy: "avoid",
  },
  "ordered-list": {
    type: "ordered-list",
    label: "Danh sách đánh số",
    requiredSlots: ["items"],
    optionalSlots: [],
    slotTypes: { items: "plainTextArray" },
    maxItems: 12,
    maxChars: 280,
    contentHint: "Danh sách các bước/ý theo thứ tự, không HTML.",
    renderIntent: "ol/li semantic.",
    defaultStyleId: "article.bullet",
    defaultPageBreakPolicy: "avoid",
  },
  quote: {
    type: "quote",
    label: "Trích dẫn",
    requiredSlots: ["text"],
    optionalSlots: ["caption", "note"],
    slotTypes: { text: "plainText", caption: "plainText", note: "plainText" },
    maxChars: 700,
    contentHint: "Trích dẫn hoặc phát biểu ngắn, không HTML.",
    renderIntent: "Blockquote nổi bật, có thể có nguồn/chú thích.",
    defaultStyleId: "article.quote",
    defaultPageBreakPolicy: "avoid",
  },
  "fact-box": {
    type: "fact-box",
    label: "Hộp số liệu/thông tin",
    requiredSlots: ["title", "items"],
    optionalSlots: ["note"],
    slotTypes: { title: "plainText", items: "plainTextArray", note: "plainText" },
    maxItems: 8,
    maxChars: 260,
    contentHint: "Các con số, mốc chính hoặc dữ kiện cần nhấn mạnh.",
    renderIntent: "Hộp thông tin có nền nhẹ, tách khỏi thân bài.",
    defaultStyleId: "article.callout",
    defaultPageBreakPolicy: "avoid",
  },
  table: {
    type: "table",
    label: "Bảng",
    requiredSlots: ["rows"],
    optionalSlots: ["title", "caption", "note"],
    slotTypes: { rows: "tableRows", title: "plainText", caption: "plainText", note: "plainText" },
    maxItems: 12,
    maxChars: 240,
    contentHint: "Bảng nhỏ, số cột vừa phải, không HTML.",
    renderIntent: "Table semantic dùng cho HTML/DOCX/PDF.",
    defaultStyleId: "article.table",
    defaultPageBreakPolicy: "avoid",
  },
  "figure-placeholder": {
    type: "figure-placeholder",
    label: "Khung ảnh chờ",
    requiredSlots: [],
    optionalSlots: ["title", "description", "aspectRatio", "caption", "note"],
    slotTypes: { title: "plainText", description: "plainText", aspectRatio: "plainText", caption: "plainText", note: "plainText" },
    maxChars: 240,
    contentHint: "Khung giữ chỗ cho ảnh; chỉ là shape/box trong MVP, không upload/generate ảnh.",
    renderIntent: "Figure box chuyên nghiệp, caption tách riêng.",
    defaultStyleId: "article.figurePlaceholder",
    defaultPageBreakPolicy: "avoid",
  },
  callout: {
    type: "callout",
    label: "Khối nhấn mạnh",
    requiredSlots: ["text"],
    optionalSlots: ["title", "note"],
    slotTypes: { text: "plainText", title: "plainText", note: "plainText" },
    maxChars: 700,
    contentHint: "Một thông điệp hoặc ghi chú cần làm nổi bật.",
    renderIntent: "Callout box nền nhẹ.",
    defaultStyleId: "article.callout",
    defaultPageBreakPolicy: "avoid",
  },
  conclusion: {
    type: "conclusion",
    label: "Kết luận",
    requiredSlots: ["text"],
    optionalSlots: [],
    slotTypes: { text: "plainText" },
    maxChars: 900,
    contentHint: "Đoạn kết luận/chốt thông điệp, không HTML.",
    renderIntent: "Đoạn văn thân bài có sắc thái kết luận.",
    defaultStyleId: "article.body",
    defaultPageBreakPolicy: "auto",
  },
  "page-break": {
    type: "page-break",
    label: "Ngắt trang",
    requiredSlots: [],
    optionalSlots: [],
    slotTypes: {},
    contentHint: "Ngắt trang có chủ đích.",
    renderIntent: "CSS break-before: page.",
    defaultStyleId: "article.body",
    defaultPageBreakPolicy: "before",
  },
};

export function getArticleBlockDefinition(type: ArticleBlockType): ArticleBlockDefinition {
  return ARTICLE_BLOCK_REGISTRY[type];
}
