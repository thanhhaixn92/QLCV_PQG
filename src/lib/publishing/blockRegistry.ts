import type { ArticleBlockType, ArticlePageBreakPolicy } from "./articleDocument";
import type { ArticleStyleId } from "./styleRegistry";

export type ArticleSlotType = "plainText" | "plainTextArray" | "leadInItems";

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
  "figure-placeholder": {
    type: "figure-placeholder",
    label: "Khung ảnh chờ",
    requiredSlots: [],
    optionalSlots: ["title", "caption", "note"],
    slotTypes: { title: "plainText", caption: "plainText", note: "plainText" },
    maxChars: 240,
    contentHint: "Khung giữ chỗ cho ảnh; chưa yêu cầu ảnh thật trong MVP.",
    renderIntent: "Figure box chuyên nghiệp, caption tách riêng.",
    defaultStyleId: "article.figurePlaceholder",
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
