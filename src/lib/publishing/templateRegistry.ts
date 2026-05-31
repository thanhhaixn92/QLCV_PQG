import type { ArticleBlockType } from "./articleDocument";
import type { ArticleStyleId } from "./styleRegistry";

export interface ArticleTemplateDefinition {
  templateId: string;
  templateVersion: string;
  label: string;
  description: string;
  recommendedLength: string;
  allowedBlocks: ArticleBlockType[];
  defaultBlockPlan: ArticleBlockType[];
  pageStyleId: ArticleStyleId;
  stylePresetId: string;
}

const COMMON_ALLOWED_BLOCKS: ArticleBlockType[] = [
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

export const ARTICLE_TEMPLATE_REGISTRY = {
  "news-short@1.0.0": {
    templateId: "news-short",
    templateVersion: "1.0.0",
    label: "Tin ngắn",
    description: "Mẫu bài tin ngắn, tập trung vào thông tin chính và kết quả nổi bật.",
    recommendedLength: "450–700 chữ",
    allowedBlocks: COMMON_ALLOWED_BLOCKS,
    defaultBlockPlan: ["title", "sapo", "paragraph", "paragraph", "figure-placeholder", "conclusion"],
    pageStyleId: "article.page.a4",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "activity-report@1.0.0": {
    templateId: "activity-report",
    templateVersion: "1.0.0",
    label: "Phản ánh hoạt động/sự kiện",
    description: "Mẫu bài phản ánh diễn biến, nội dung, kết quả và ý nghĩa của hoạt động/sự kiện.",
    recommendedLength: "800–1.200 chữ",
    allowedBlocks: COMMON_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "section-heading",
      "paragraph",
      "lead-in-list",
      "figure-placeholder",
      "section-heading",
      "paragraph",
      "conclusion",
    ],
    pageStyleId: "article.page.a4",
    stylePresetId: "hoa-tieu-a4-basic",
  },
  "unit-introduction@1.0.0": {
    templateId: "unit-introduction",
    templateVersion: "1.0.0",
    label: "Giới thiệu đơn vị/chuyên đề",
    description: "Mẫu bài giới thiệu đơn vị, chức năng, năng lực, thành tựu hoặc một chuyên đề trọng tâm.",
    recommendedLength: "900–1.500 chữ",
    allowedBlocks: COMMON_ALLOWED_BLOCKS,
    defaultBlockPlan: [
      "title",
      "sapo",
      "section-heading",
      "paragraph",
      "bullet-list",
      "section-heading",
      "paragraph",
      "figure-placeholder",
      "conclusion",
    ],
    pageStyleId: "article.page.a4",
    stylePresetId: "hoa-tieu-a4-basic",
  },
} as const satisfies Record<string, ArticleTemplateDefinition>;

export type ArticleTemplateKey = keyof typeof ARTICLE_TEMPLATE_REGISTRY;

export function createArticleTemplateKey(templateId: string, templateVersion: string): string {
  return `${templateId}@${templateVersion}`;
}

export function getArticleTemplate(
  templateId: string,
  templateVersion: string,
): ArticleTemplateDefinition | undefined {
  return ARTICLE_TEMPLATE_REGISTRY[createArticleTemplateKey(templateId, templateVersion) as ArticleTemplateKey];
}

export function getDefaultArticleTemplate(): ArticleTemplateDefinition {
  return ARTICLE_TEMPLATE_REGISTRY["news-short@1.0.0"];
}
