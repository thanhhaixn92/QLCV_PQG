import React from "react";
import type { ArticleBlock, ArticleDocument, ArticleLeadInItem } from "../../lib/publishing/articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "../../lib/publishing/blockRegistry";
import { validateArticleDocument } from "../../lib/publishing/validateArticleDocument";

interface A4PrintPreviewProps {
  document: ArticleDocument;
  className?: string;
  showValidationSummary?: boolean;
}

function textSlot(block: ArticleBlock): string {
  return typeof block.slots.text === "string" ? block.slots.text : "";
}

function stringItems(block: ArticleBlock): string[] {
  return Array.isArray(block.slots.items)
    ? block.slots.items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function leadInItems(block: ArticleBlock): ArticleLeadInItem[] {
  return Array.isArray(block.slots.items)
    ? block.slots.items.filter(
        (item): item is ArticleLeadInItem =>
          Boolean(
            item &&
              typeof item === "object" &&
              typeof (item as ArticleLeadInItem).label === "string" &&
              typeof (item as ArticleLeadInItem).body === "string",
          ),
      )
    : [];
}

function blockStyleClass(block: ArticleBlock): string {
  const definition = ARTICLE_BLOCK_REGISTRY[block.type];
  const policy = block.pageBreakPolicy || definition?.defaultPageBreakPolicy || "auto";
  return [
    "a4-block",
    `a4-block-${block.type}`,
    block.variant ? `a4-variant-${block.variant}` : "",
    policy !== "auto" ? `a4-break-${policy}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderBlock(block: ArticleBlock): React.ReactNode {
  const className = blockStyleClass(block);

  switch (block.type) {
    case "title":
      return <h1 className={className}>{textSlot(block)}</h1>;
    case "sapo":
      return <p className={className}>{textSlot(block)}</p>;
    case "section-heading":
      return <h2 className={className}>{textSlot(block)}</h2>;
    case "paragraph":
      return <p className={className}>{textSlot(block)}</p>;
    case "conclusion":
      return <p className={`${className} a4-conclusion`}>{textSlot(block)}</p>;
    case "bullet-list":
      return (
        <ul className={className}>
          {stringItems(block).map((item, index) => (
            <li key={`${block.id}-item-${index}`}>{item}</li>
          ))}
        </ul>
      );
    case "lead-in-list": {
      const items = leadInItems(block);
      const listClassName = block.variant === "paragraph" ? `${className} a4-lead-in-paragraphs` : className;
      if (block.variant === "paragraph") {
        return (
          <div className={listClassName}>
            {items.map((item, index) => (
              <p key={`${block.id}-lead-${index}`}>
                <strong>{item.label}: </strong>
                {item.body}
              </p>
            ))}
          </div>
        );
      }
      return (
        <ul className={listClassName}>
          {items.map((item, index) => (
            <li key={`${block.id}-lead-${index}`}>
              <strong>{item.label}: </strong>
              {item.body}
            </li>
          ))}
        </ul>
      );
    }
    case "figure-placeholder": {
      const title = typeof block.slots.title === "string" ? block.slots.title : "Vị trí ảnh minh họa";
      const caption = typeof block.slots.caption === "string" ? block.slots.caption : "";
      const note = typeof block.slots.note === "string" ? block.slots.note : "";
      return (
        <figure className={className}>
          <div className="a4-figure-placeholder-box">
            <span>{title}</span>
            {note && <small>{note}</small>}
          </div>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case "page-break":
      return <div className={className} aria-hidden="true" />;
    default:
      return null;
  }
}

export function renderArticleDocumentToHtmlA4(document: ArticleDocument): React.ReactNode {
  return document.blocks.map((block) => <React.Fragment key={block.id}>{renderBlock(block)}</React.Fragment>);
}

export const A4PrintPreview = ({
  document,
  className = "",
  showValidationSummary = true,
}: A4PrintPreviewProps) => {
  const validation = React.useMemo(() => validateArticleDocument(document), [document]);

  return (
    <article className={["print-layout", "a4-preview", className].filter(Boolean).join(" ")} data-template-id={document.templateId}>
      {showValidationSummary && (!validation.valid || validation.warnings.length > 0) && (
        <aside className="a4-validation-summary" aria-label="Kiểm tra ArticleDocument">
          {!validation.valid && <strong>ArticleDocument cần kiểm tra trước khi xuất bản.</strong>}
          {validation.errors.map((error) => (
            <p key={`error-${error.path}`}>Lỗi {error.path}: {error.message}</p>
          ))}
          {validation.warnings.map((warning) => (
            <p key={`warning-${warning.path}`}>Cảnh báo {warning.path}: {warning.message}</p>
          ))}
        </aside>
      )}
      {renderArticleDocumentToHtmlA4(document)}
    </article>
  );
};
