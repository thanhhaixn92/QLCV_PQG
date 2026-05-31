import type { ArticleBlockType } from "./articleDocument";

export type ArticleLayoutDensity = "airy" | "balanced" | "dense" | "photo-led";
export type ArticleVisualDensity = ArticleLayoutDensity;
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
  name: string;
  label: string;
  description: string;
  suitableFor: string[];
  recommendedFor: string[];
  estimatedPages: number;
  density: ArticleLayoutDensity;
  visualDensity: ArticleVisualDensity;
  blockSequence: ArticleBlockType[];
  defaultBlockPlan: ArticleBlockType[];
  allowedBlocks: ArticleBlockType[];
  requiredBlocks: ArticleBlockType[];
  optionalBlocks: ArticleBlockType[];
  placeholderPolicy: ArticlePlaceholderPolicy;
  exportNotes: string[];
  pageBudget: ArticlePageBudget;
  stylePresetId: string;
}

const A4_ALLOWED_BLOCKS: ArticleBlockType[] = [
  "title",
  "sapo",
  "section-heading",
  "paragraph",
  "lead-in-list",
  "bullet-list",
  "ordered-list",
  "quote",
  "fact-box",
  "table",
  "figure-placeholder",
  "callout",
  "conclusion",
  "page-break",
];

const BASE_REQUIRED_BLOCKS: ArticleBlockType[] = ["title", "sapo", "paragraph"];
const BASE_OPTIONAL_BLOCKS = A4_ALLOWED_BLOCKS.filter((block) => !BASE_REQUIRED_BLOCKS.includes(block));

function pageBudget(
  minPages: number,
  targetPages: number,
  maxPages: number,
  wordsPerPage: number,
  minWords: number,
  targetWords: number,
  maxWords: number,
  minFigures: number,
  targetFigures: number,
  maxFigures: number,
): ArticlePageBudget {
  return {
    minPages,
    targetPages,
    maxPages,
    wordsPerPage,
    totalWords: { min: minWords, target: targetWords, max: maxWords },
    figureSlots: { min: minFigures, target: targetFigures, max: maxFigures },
  };
}

function defineLayout(config: Omit<ArticleLayoutDefinition, "label" | "recommendedFor" | "visualDensity" | "defaultBlockPlan" | "optionalBlocks" | "stylePresetId"> & { stylePresetId?: string }): ArticleLayoutDefinition {
  return {
    ...config,
    label: config.name,
    recommendedFor: config.suitableFor,
    visualDensity: config.density,
    defaultBlockPlan: config.blockSequence,
    optionalBlocks: BASE_OPTIONAL_BLOCKS,
    stylePresetId: config.stylePresetId || "hoa-tieu-a4-basic",
  };
}

export const ARTICLE_LAYOUT_REGISTRY = {
  "standard-news-a4@1.0.0": defineLayout({
    layoutId: "standard-news-a4",
    layoutVersion: "1.0.0",
    name: "Tin tiêu chuẩn A4",
    description: "Layout A4 cân bằng cho tin/bài website 5 trang, ưu tiên thông tin chính, diễn biến và kết quả.",
    suitableFor: ["Tin tổng hợp", "Bài website", "Bài phản ánh hoạt động", "Truyền thông nội bộ"],
    estimatedPages: 5,
    density: "balanced",
    blockSequence: ["title", "sapo", "paragraph", "figure-placeholder", "section-heading", "paragraph", "lead-in-list", "section-heading", "paragraph", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "recommended",
    exportNotes: ["Phù hợp HTML/DOCX/PDF A4", "Khuyến nghị 1–2 placeholder ảnh có caption."],
    pageBudget: pageBudget(4, 5, 6, 520, 1900, 2600, 3100, 1, 2, 3),
  }),
  "feature-article-a4@1.0.0": defineLayout({
    layoutId: "feature-article-a4",
    layoutVersion: "1.0.0",
    name: "Bài feature A4",
    description: "Layout dài 6–7 trang cho bài chuyên sâu, nhiều đề mục, quote/callout và nhịp kể chuyện rõ.",
    suitableFor: ["Bài chuyên sâu", "Chân dung tập thể", "Tường thuật dài"],
    estimatedPages: 6,
    density: "airy",
    blockSequence: ["title", "sapo", "paragraph", "quote", "figure-placeholder", "section-heading", "paragraph", "section-heading", "lead-in-list", "paragraph", "figure-placeholder", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "recommended",
    exportNotes: ["Có thể dùng quote/callout để tăng nhịp đọc.", "Giữ mỗi đoạn dưới 1.200 ký tự."],
    pageBudget: pageBudget(5, 6, 7, 540, 2600, 3200, 3800, 2, 3, 4),
  }),
  "event-recap-a4@1.0.0": defineLayout({
    layoutId: "event-recap-a4",
    layoutVersion: "1.0.0",
    name: "Tổng thuật sự kiện A4",
    description: "Layout cho hội nghị/sự kiện, nhấn mạnh bối cảnh, diễn biến, kết quả và ý nghĩa.",
    suitableFor: ["Hội nghị", "Lễ ký kết", "Hoạt động chính trị", "Sự kiện chuyên môn"],
    estimatedPages: 5,
    density: "balanced",
    blockSequence: ["title", "sapo", "section-heading", "paragraph", "figure-placeholder", "section-heading", "lead-in-list", "paragraph", "section-heading", "paragraph", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "required",
    exportNotes: ["Cần caption rõ cho ảnh sự kiện.", "Nên có kết luận/ý nghĩa sau sự kiện."],
    pageBudget: pageBudget(4, 5, 6, 520, 2000, 2700, 3200, 2, 3, 4),
  }),
  "data-achievement-a4@1.0.0": defineLayout({
    layoutId: "data-achievement-a4",
    layoutVersion: "1.0.0",
    name: "Thành tựu - số liệu A4",
    description: "Layout cho bài có số liệu/kết quả, hỗ trợ fact-box, bảng nhỏ và danh sách điểm nổi bật.",
    suitableFor: ["Báo cáo thành tựu", "Tổng kết chỉ tiêu", "Bài viết có nhiều số liệu"],
    estimatedPages: 5,
    density: "dense",
    blockSequence: ["title", "sapo", "paragraph", "fact-box", "section-heading", "lead-in-list", "table", "section-heading", "bullet-list", "paragraph", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "optional",
    exportNotes: ["Bảng nên nhỏ, dễ đọc trên A4.", "Số liệu nên có nguồn/điểm kiểm chứng."],
    pageBudget: pageBudget(4, 5, 6, 500, 1800, 2500, 3000, 1, 2, 3),
  }),
  "explainer-a4@1.0.0": defineLayout({
    layoutId: "explainer-a4",
    layoutVersion: "1.0.0",
    name: "Giải thích/chuyên đề A4",
    description: "Layout giải thích chính sách, quy trình hoặc chủ đề chuyên môn theo các khối dễ đọc.",
    suitableFor: ["Giải thích chính sách", "Hướng dẫn nghiệp vụ", "Chuyên đề kiến thức"],
    estimatedPages: 6,
    density: "balanced",
    blockSequence: ["title", "sapo", "section-heading", "paragraph", "callout", "lead-in-list", "section-heading", "paragraph", "ordered-list", "section-heading", "paragraph", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "optional",
    exportNotes: ["Ưu tiên heading rõ và ordered-list khi có quy trình.", "Callout dùng cho thông điệp chính."],
    pageBudget: pageBudget(5, 6, 7, 520, 2400, 3100, 3600, 1, 2, 3),
  }),
  "unit-profile-a4@1.0.0": defineLayout({
    layoutId: "unit-profile-a4",
    layoutVersion: "1.0.0",
    name: "Hồ sơ đơn vị A4",
    description: "Layout giới thiệu đơn vị, năng lực, truyền thống, thành tựu và định hướng.",
    suitableFor: ["Giới thiệu đơn vị", "Hồ sơ năng lực", "Truyền thống và thành tựu"],
    estimatedPages: 6,
    density: "balanced",
    blockSequence: ["title", "sapo", "paragraph", "figure-placeholder", "section-heading", "paragraph", "bullet-list", "section-heading", "lead-in-list", "figure-placeholder", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "recommended",
    exportNotes: ["Nên có 2–3 vị trí ảnh về con người/đơn vị.", "Phù hợp bài 5–7 trang A4."],
    pageBudget: pageBudget(5, 6, 7, 530, 2500, 3200, 3700, 2, 3, 4),
  }),
  "policy-admin-a4@1.0.0": defineLayout({
    layoutId: "policy-admin-a4",
    layoutVersion: "1.0.0",
    name: "Chính sách - hành chính A4",
    description: "Layout hành chính/chính sách, ưu tiên cấu trúc rõ, căn cứ, ít ảnh và nhiều đoạn giải thích.",
    suitableFor: ["Bài chính sách", "Thông tin hành chính", "Nội dung quản trị"],
    estimatedPages: 5,
    density: "dense",
    blockSequence: ["title", "sapo", "section-heading", "paragraph", "section-heading", "lead-in-list", "paragraph", "section-heading", "ordered-list", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "optional",
    exportNotes: ["Ít ảnh, ưu tiên tính rõ ràng và kiểm chứng.", "Có thể dùng ordered-list cho căn cứ/quy trình."],
    pageBudget: pageBudget(4, 5, 6, 560, 2100, 2800, 3300, 0, 1, 2),
  }),
  "photo-led-placeholder-a4@1.0.0": defineLayout({
    layoutId: "photo-led-placeholder-a4",
    layoutVersion: "1.0.0",
    name: "Ảnh dẫn dắt A4 (placeholder)",
    description: "Layout bài nhiều ảnh nhưng chỉ dùng placeholder shape trong MVP, không upload/sinh ảnh thật.",
    suitableFor: ["Bài ảnh", "Tường thuật nhiều hình", "Phản ánh hoạt động trực quan"],
    estimatedPages: 5,
    density: "photo-led",
    blockSequence: ["title", "sapo", "figure-placeholder", "paragraph", "figure-placeholder", "section-heading", "paragraph", "figure-placeholder", "bullet-list", "figure-placeholder", "conclusion"],
    allowedBlocks: A4_ALLOWED_BLOCKS,
    requiredBlocks: BASE_REQUIRED_BLOCKS,
    placeholderPolicy: "photo-led",
    exportNotes: ["Placeholder là shape/box, không ảnh thật.", "Caption cần tách riêng khỏi paragraph."],
    pageBudget: pageBudget(4, 5, 6, 420, 1500, 2100, 2700, 3, 5, 7),
  }),
} as const satisfies Record<string, ArticleLayoutDefinition>;

export type ArticleLayoutKey = keyof typeof ARTICLE_LAYOUT_REGISTRY;

export function createArticleLayoutKey(layoutId: string, layoutVersion: string): string {
  return `${layoutId}@${layoutVersion}`;
}

function normalizeLegacyLayoutId(layoutId: string): string {
  return layoutId === "photo-led-a4" ? "photo-led-placeholder-a4" : layoutId;
}

export function getArticleLayout(layoutId: string, layoutVersion: string): ArticleLayoutDefinition | undefined {
  const normalizedLayoutId = normalizeLegacyLayoutId(layoutId);
  return ARTICLE_LAYOUT_REGISTRY[createArticleLayoutKey(normalizedLayoutId, layoutVersion) as ArticleLayoutKey];
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
