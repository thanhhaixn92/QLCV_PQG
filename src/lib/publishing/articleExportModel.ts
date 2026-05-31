import type { ArticleLocale, ArticleStatus } from "./articleDocument";

export type ArticleExportBlockType =
  | "title"
  | "sapo"
  | "heading"
  | "paragraph"
  | "lead-in"
  | "bullet-list"
  | "numbered-list"
  | "quote"
  | "table"
  | "figure-placeholder"
  | "conclusion"
  | "page-break"
  | "unknown";

export interface ArticleExportMetadata {
  title: string;
  sapo?: string;
  authorName?: string;
  organization?: string;
  category?: string;
  createdAt?: string;
  status?: ArticleStatus;
  locale?: ArticleLocale | string;
}

export interface ArticleExportFigure {
  label: string;
  caption?: string;
  note?: string;
}

export interface ArticleExportTableCell {
  text: string;
  header?: boolean;
}

export interface ArticleExportTable {
  rows: ArticleExportTableCell[][];
  caption?: string;
}

export interface ArticleExportLeadInItem {
  label: string;
  body: string;
}

export interface ArticleExportWarning {
  code: string;
  message: string;
  blockId?: string;
  blockType?: string;
}

interface ArticleExportBlockBase {
  id: string;
  sourceType?: string;
  variant?: string;
}

export type ArticleExportBlock =
  | (ArticleExportBlockBase & { type: "title" | "sapo" | "heading" | "paragraph" | "quote" | "conclusion"; text: string; level?: 1 | 2 | 3 })
  | (ArticleExportBlockBase & { type: "lead-in"; items: ArticleExportLeadInItem[] })
  | (ArticleExportBlockBase & { type: "bullet-list" | "numbered-list"; items: string[] })
  | (ArticleExportBlockBase & { type: "table"; table: ArticleExportTable })
  | (ArticleExportBlockBase & { type: "figure-placeholder"; figure: ArticleExportFigure })
  | (ArticleExportBlockBase & { type: "page-break" })
  | (ArticleExportBlockBase & { type: "unknown"; text?: string; items?: string[] });

export interface ArticleExportModel {
  title: string;
  subtitle?: string;
  sapo?: string;
  metadata: ArticleExportMetadata;
  blocks: ArticleExportBlock[];
  layoutId: string;
  layoutVersion: string;
  estimatedPages?: number;
  exportWarnings: ArticleExportWarning[];
  sourceDocumentId?: string;
}
