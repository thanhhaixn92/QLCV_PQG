export const ARTICLE_DOCUMENT_SCHEMA_VERSION = "article-document/v1" as const;
export const SUPPORTED_ARTICLE_LOCALES = ["vi-VN"] as const;

export type ArticleLocale = (typeof SUPPORTED_ARTICLE_LOCALES)[number];
export type ArticleStatus = "draft" | "reviewed" | "published";

export type ArticleBlockType =
  | "title"
  | "sapo"
  | "section-heading"
  | "paragraph"
  | "lead-in-list"
  | "bullet-list"
  | "ordered-list"
  | "quote"
  | "fact-box"
  | "table"
  | "figure-placeholder"
  | "callout"
  | "conclusion"
  | "page-break";

export type ArticlePageBreakPolicy = "auto" | "avoid" | "before" | "after";

export interface ArticleDocumentMetadata {
  title: string;
  sapo?: string;
  authorName?: string;
  organization?: string;
  category?: string;
  createdAt?: string;
  status: ArticleStatus;
}

export interface ArticleLeadInItem {
  label: string;
  body: string;
}

export interface ArticleTableCell {
  text: string;
  header?: boolean;
}

export interface ArticleBlockSlots {
  text?: string;
  title?: string;
  caption?: string;
  note?: string;
  description?: string;
  aspectRatio?: string;
  items?: string[] | ArticleLeadInItem[];
  rows?: ArticleTableCell[][];
}

export interface ArticleBlock {
  id: string;
  type: ArticleBlockType;
  variant?: string;
  slots: ArticleBlockSlots;
  styleId?: string;
  pageBreakPolicy?: ArticlePageBreakPolicy;
  repeatable?: boolean;
}

export interface ArticleDocument {
  id?: string;
  schemaVersion: typeof ARTICLE_DOCUMENT_SCHEMA_VERSION;
  documentVersion: number;
  templateId: string;
  templateVersion: string;
  layoutId?: string;
  layoutVersion?: string;
  estimatedPages?: number;
  locale: ArticleLocale;
  metadata: ArticleDocumentMetadata;
  blocks: ArticleBlock[];
}

export function createArticleBlockId(prefix: ArticleBlockType, index: number): string {
  return `${prefix}-${index + 1}`;
}
