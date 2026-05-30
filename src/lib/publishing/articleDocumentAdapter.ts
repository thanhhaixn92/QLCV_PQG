import {
  ARTICLE_DOCUMENT_SCHEMA_VERSION,
  createArticleBlockId,
  type ArticleBlock,
  type ArticleDocument,
} from "./articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "./blockRegistry";
import { getDefaultArticleTemplate } from "./templateRegistry";

export interface CreateArticleDocumentOptions {
  id?: string;
  title?: string;
  sapo?: string;
  authorName?: string;
  organization?: string;
  category?: string;
  createdAt?: string;
  status?: "draft" | "reviewed" | "published";
  templateId?: string;
  templateVersion?: string;
}

interface ParsedLine {
  kind: "heading" | "paragraph" | "bullet" | "blank" | "figure";
  level?: number;
  text: string;
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMarkdownLines(content: string): ParsedLine[] {
  return content.split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return { kind: "blank", text: "" };

    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]*)\)/);
    if (imageMatch) {
      return { kind: "figure", text: stripInlineMarkdown(imageMatch[1] || "Hình minh họa") };
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      return { kind: "heading", level: headingMatch[1].length, text: stripInlineMarkdown(headingMatch[2]) };
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      return { kind: "bullet", text: stripInlineMarkdown(bulletMatch[1]) };
    }

    return { kind: "paragraph", text: stripInlineMarkdown(line) };
  });
}

function createBlock(type: ArticleBlock["type"], index: number, slots: ArticleBlock["slots"]): ArticleBlock {
  const definition = ARTICLE_BLOCK_REGISTRY[type];
  return {
    id: createArticleBlockId(type, index),
    type,
    slots,
    styleId: definition.defaultStyleId,
    pageBreakPolicy: definition.defaultPageBreakPolicy,
  };
}

export function createArticleDocumentFromCurrentContent(
  content: string,
  options: CreateArticleDocumentOptions = {},
): ArticleDocument {
  const fallbackTemplate = getDefaultArticleTemplate();
  const templateId = options.templateId || fallbackTemplate.templateId;
  const templateVersion = options.templateVersion || fallbackTemplate.templateVersion;
  const parsedLines = parseMarkdownLines(content);
  const blocks: ArticleBlock[] = [];
  let blockIndex = 0;
  let resolvedTitle = options.title?.trim() || "Bài viết chưa có tiêu đề";
  let titleConsumed = Boolean(options.title?.trim());
  let sapoConsumed = Boolean(options.sapo?.trim());
  const pendingBullets: string[] = [];

  const flushBullets = () => {
    if (pendingBullets.length === 0) return;
    blocks.push(createBlock("bullet-list", blockIndex++, { items: [...pendingBullets] }));
    pendingBullets.length = 0;
  };

  if (options.title?.trim()) {
    blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
  }
  if (options.sapo?.trim()) {
    blocks.push(createBlock("sapo", blockIndex++, { text: options.sapo.trim() }));
  }

  parsedLines.forEach((line) => {
    if (line.kind === "blank") {
      flushBullets();
      return;
    }

    if (line.kind !== "bullet") {
      flushBullets();
    }

    if (line.kind === "heading") {
      if (!titleConsumed && line.level === 1) {
        resolvedTitle = line.text || resolvedTitle;
        blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
        titleConsumed = true;
      } else {
        blocks.push(createBlock("section-heading", blockIndex++, { text: line.text }));
      }
      return;
    }

    if (line.kind === "bullet") {
      if (line.text) pendingBullets.push(line.text);
      return;
    }

    if (line.kind === "figure") {
      blocks.push(createBlock("figure-placeholder", blockIndex++, { title: line.text, caption: line.text }));
      return;
    }

    if (!titleConsumed) {
      resolvedTitle = line.text.slice(0, 180) || resolvedTitle;
      blocks.push(createBlock("title", blockIndex++, { text: resolvedTitle }));
      titleConsumed = true;
      return;
    }

    if (!sapoConsumed && line.text.length <= 450) {
      blocks.push(createBlock("sapo", blockIndex++, { text: line.text }));
      sapoConsumed = true;
      return;
    }

    blocks.push(createBlock("paragraph", blockIndex++, { text: line.text }));
  });

  flushBullets();

  if (!titleConsumed) {
    blocks.unshift(createBlock("title", 0, { text: resolvedTitle }));
  }

  if (blocks.length === 1) {
    blocks.push(createBlock("paragraph", 1, { text: "Nội dung bài viết sẽ được bổ sung trong bước biên tập tiếp theo." }));
  }

  return {
    id: options.id,
    schemaVersion: ARTICLE_DOCUMENT_SCHEMA_VERSION,
    documentVersion: 1,
    templateId,
    templateVersion,
    locale: "vi-VN",
    metadata: {
      title: resolvedTitle,
      sapo: options.sapo,
      authorName: options.authorName,
      organization: options.organization,
      category: options.category,
      createdAt: options.createdAt || new Date().toISOString(),
      status: options.status || "draft",
    },
    blocks,
  };
}
