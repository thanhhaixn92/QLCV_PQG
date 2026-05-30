import type { ArticleBlockType } from "./articleDocument";

export type ArticleVisualDensity = "airy" | "balanced" | "dense" | "photo-led";
export type ArticlePlaceholderPolicy = "optional" | "recommended" | "required" | "photo-led";

export interface ArticlePageBudget {
  minPages: number;
  targetPages: number;
  maxPages: number;
  wordsPerPage: number;
  totalWords: {
    min: number;
    target: number;
    max: number;
  };
  figureSlots: {
    min: number;
    target: number;
    max: number;
  };
}

export interface ArticleLayoutDefinition {
  layoutId: string;
  layoutVersion: string;
  label: string;
  description: string;
  estimatedPages: number;
  pageBudget: ArticlePageBudget;
  allowedBlocks: ArticleBlockType[];
  defaultBlockPlan: ArticleBlockType[];
  recommendedFor: string[];
  visualDensity: ArticleVisualDensity;
  placeholderPolicy: ArticlePlaceholderPolicy;
  stylePresetId: string;
}

const A4_ALLOWED_BLOCKS: ArticleBlockType[] = [
  "title",
  "sapo",
  "section-heading",
  "paragraph",
  "lead-in-list",
  "bullet-list",
  "figure-placeholder",
  "conclusion",
  "page-break",
];

export const ARTICLE_LAYOUT_REGISTRY = {
  "standard-news-a4@1.0.0": {
    layoutId: "standard-news-a4",
    layoutVersion: "1.0.0",
    label: "Tin tiêu chuẩn A4",
    description: "Layout A4 cân bằng cho tin/bài phản ánh 5 trang, ưu tiên diễn biến chính và kết quả nổi bật.",
    estimatedPages: 5,
    pageBudget: {
      minPages: 4,
      targetPages: 5,
      maxPages: 6,
      wordsPerPage: 520,
      totalWords: { min: 1_900, target: 2_600, max: 3_100 },
      figureSlots: { min: 1, target: 2, max: 3 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "paragraph",
      "figure-placeholder",
      "section-heading",
      "paragraph",
      "lead-in-list",
      "section-heading",
      "paragraph",
      "conclusion",
    ],
    recommendedFor: ["Tin tổng hợp", "Bài phản ánh hoạt động", "Thông tin nội bộ"],
    visualDensity: "balanced",
    placeholderPolicy: "recommended",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "feature-article-a4@1.0.0": {
    layoutId: "feature-article-a4",
    layoutVersion: "1.0.0",
    label: "Bài feature A4",
    description: "Layout dài 6–7 trang cho bài chuyên sâu, có nhiều đề mục và nhịp kể chuyện rõ.",
    estimatedPages: 6,
    pageBudget: {
      minPages: 5,
      targetPages: 6,
      maxPages: 7,
      wordsPerPage: 540,
      totalWords: { min: 2_600, target: 3_200, max: 3_800 },
      figureSlots: { min: 2, target: 3, max: 4 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "paragraph",
      "figure-placeholder",
      "section-heading",
      "paragraph",
      "section-heading",
      "lead-in-list",
      "paragraph",
      "figure-placeholder",
      "section-heading",
      "paragraph",
      "conclusion",
    ],
    recommendedFor: ["Bài chuyên sâu", "Chân dung tập thể", "Tường thuật dài"],
    visualDensity: "airy",
    placeholderPolicy: "recommended",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "event-recap-a4@1.0.0": {
    layoutId: "event-recap-a4",
    layoutVersion: "1.0.0",
    label: "Tổng thuật sự kiện A4",
    description: "Layout 5–6 trang cho bài tổng thuật sự kiện, nhấn mạnh bối cảnh, diễn biến, kết quả và ý nghĩa.",
    estimatedPages: 5,
    pageBudget: {
      minPages: 4,
      targetPages: 5,
      maxPages: 6,
      wordsPerPage: 520,
      totalWords: { min: 2_000, target: 2_700, max: 3_200 },
      figureSlots: { min: 2, target: 3, max: 4 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "section-heading",
      "paragraph",
      "figure-placeholder",
      "section-heading",
      "lead-in-list",
      "paragraph",
      "section-heading",
      "paragraph",
      "conclusion",
    ],
    recommendedFor: ["Hội nghị", "Lễ ký kết", "Hoạt động chính trị", "Sự kiện chuyên môn"],
    visualDensity: "balanced",
    placeholderPolicy: "required",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "data-achievement-a4@1.0.0": {
    layoutId: "data-achievement-a4",
    layoutVersion: "1.0.0",
    label: "Thành tựu - số liệu A4",
    description: "Layout 5 trang cho bài nhấn mạnh kết quả, chỉ tiêu, số liệu và các điểm nổi bật có thể liệt kê.",
    estimatedPages: 5,
    pageBudget: {
      minPages: 4,
      targetPages: 5,
      maxPages: 6,
      wordsPerPage: 500,
      totalWords: { min: 1_800, target: 2_500, max: 3_000 },
      figureSlots: { min: 1, target: 2, max: 3 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "paragraph",
      "section-heading",
      "lead-in-list",
      "section-heading",
      "bullet-list",
      "figure-placeholder",
      "paragraph",
      "conclusion",
    ],
    recommendedFor: ["Báo cáo thành tựu", "Tổng kết chỉ tiêu", "Bài viết có nhiều số liệu"],
    visualDensity: "dense",
    placeholderPolicy: "optional",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "explainer-a4@1.0.0": {
    layoutId: "explainer-a4",
    layoutVersion: "1.0.0",
    label: "Giải thích/chuyên đề A4",
    description: "Layout 5–6 trang cho bài giải thích chính sách, quy trình hoặc chủ đề chuyên môn theo từng ý rõ ràng.",
    estimatedPages: 6,
    pageBudget: {
      minPages: 5,
      targetPages: 6,
      maxPages: 7,
      wordsPerPage: 520,
      totalWords: { min: 2_400, target: 3_100, max: 3_600 },
      figureSlots: { min: 1, target: 2, max: 3 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "section-heading",
      "paragraph",
      "lead-in-list",
      "section-heading",
      "paragraph",
      "bullet-list",
      "section-heading",
      "paragraph",
      "conclusion",
    ],
    recommendedFor: ["Giải thích chính sách", "Hướng dẫn nghiệp vụ", "Chuyên đề kiến thức"],
    visualDensity: "balanced",
    placeholderPolicy: "optional",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "unit-profile-a4@1.0.0": {
    layoutId: "unit-profile-a4",
    layoutVersion: "1.0.0",
    label: "Hồ sơ đơn vị A4",
    description: "Layout 6 trang cho bài giới thiệu đơn vị, năng lực, truyền thống, thành tựu và định hướng.",
    estimatedPages: 6,
    pageBudget: {
      minPages: 5,
      targetPages: 6,
      maxPages: 7,
      wordsPerPage: 530,
      totalWords: { min: 2_500, target: 3_200, max: 3_700 },
      figureSlots: { min: 2, target: 3, max: 4 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "paragraph",
      "figure-placeholder",
      "section-heading",
      "paragraph",
      "bullet-list",
      "section-heading",
      "lead-in-list",
      "figure-placeholder",
      "conclusion",
    ],
    recommendedFor: ["Giới thiệu đơn vị", "Hồ sơ năng lực", "Truyền thống và thành tựu"],
    visualDensity: "balanced",
    placeholderPolicy: "recommended",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "policy-admin-a4@1.0.0": {
    layoutId: "policy-admin-a4",
    layoutVersion: "1.0.0",
    label: "Chính sách - hành chính A4",
    description: "Layout 5 trang cho bài hành chính/chính sách, ưu tiên cấu trúc rõ, ít ảnh, nhiều đoạn giải thích.",
    estimatedPages: 5,
    pageBudget: {
      minPages: 4,
      targetPages: 5,
      maxPages: 6,
      wordsPerPage: 560,
      totalWords: { min: 2_100, target: 2_800, max: 3_300 },
      figureSlots: { min: 0, target: 1, max: 2 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "section-heading",
      "paragraph",
      "section-heading",
      "lead-in-list",
      "paragraph",
      "section-heading",
      "bullet-list",
      "conclusion",
    ],
    recommendedFor: ["Bài chính sách", "Thông tin hành chính", "Nội dung quản trị"],
    visualDensity: "dense",
    placeholderPolicy: "optional",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "photo-led-a4@1.0.0": {
    layoutId: "photo-led-a4",
    layoutVersion: "1.0.0",
    label: "Ảnh dẫn dắt A4",
    description: "Layout 5–6 trang cho bài nhiều ảnh, trong đó ảnh và chú thích là nhịp nội dung chính.",
    estimatedPages: 5,
    pageBudget: {
      minPages: 4,
      targetPages: 5,
      maxPages: 6,
      wordsPerPage: 420,
      totalWords: { min: 1_500, target: 2_100, max: 2_700 },
      figureSlots: { min: 3, target: 5, max: 7 },
    },
    allowedBlocks: A4_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "figure-placeholder",
      "paragraph",
      "figure-placeholder",
      "section-heading",
      "paragraph",
      "figure-placeholder",
      "bullet-list",
      "figure-placeholder",
      "conclusion",
    ],
    recommendedFor: ["Bài ảnh", "Tường thuật có nhiều hình", "Phản ánh hoạt động trực quan"],
    visualDensity: "photo-led",
    placeholderPolicy: "photo-led",
    stylePresetId: "hoa-tieu-a4-basic",
  },
} as const satisfies Record<string, ArticleLayoutDefinition>;

export type ArticleLayoutKey = keyof typeof ARTICLE_LAYOUT_REGISTRY;

export function createArticleLayoutKey(layoutId: string, layoutVersion: string): string {
  return `${layoutId}@${layoutVersion}`;
}

export function getArticleLayout(layoutId: string, layoutVersion: string): ArticleLayoutDefinition | undefined {
  return ARTICLE_LAYOUT_REGISTRY[createArticleLayoutKey(layoutId, layoutVersion) as ArticleLayoutKey];
}

export function hasArticleLayout(layoutId: string, layoutVersion: string): boolean {
  return Boolean(getArticleLayout(layoutId, layoutVersion));
}

export function getDefaultArticleLayout(): ArticleLayoutDefinition {
  return ARTICLE_LAYOUT_REGISTRY["standard-news-a4@1.0.0"];
}

export function listArticleLayouts(): ArticleLayoutDefinition[] {
  return Object.values(ARTICLE_LAYOUT_REGISTRY);
}
