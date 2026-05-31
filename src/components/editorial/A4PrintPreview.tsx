import React from "react";
import type { ArticleBlock, ArticleDocument, ArticleLeadInItem } from "../../lib/publishing/articleDocument";
import { ARTICLE_BLOCK_REGISTRY } from "../../lib/publishing/blockRegistry";
import { validateArticleDocument } from "../../lib/publishing/validateArticleDocument";
import { countPreflightIssuesBySeverity } from "../../lib/publishing/preflightIssue";
import { cleanTextForExport } from "../../lib/publishing/htmlExport";

interface A4PrintPreviewProps {
  document: ArticleDocument;
  className?: string;
  rootId?: string;
  showValidationSummary?: boolean;
}

function textSlot(block: ArticleBlock, slot: keyof ArticleBlock["slots"] = "text"): string {
  return cleanTextForExport(block.slots?.[slot]);
}

function optionalStringSlot(block: ArticleBlock, slot: string): string {
  const slots = block.slots as Record<string, unknown> | undefined;
  return cleanTextForExport(slots?.[slot]);
}

function stringItems(block: ArticleBlock): string[] {
  return Array.isArray(block.slots?.items)
    ? block.slots.items
        .map((item) => cleanTextForExport(item))
        .filter((item) => item.length > 0)
    : [];
}

function leadInItems(block: ArticleBlock): ArticleLeadInItem[] {
  return Array.isArray(block.slots?.items)
    ? block.slots.items
        .map((item) => {
          if (
            !item ||
            typeof item !== "object" ||
            typeof (item as ArticleLeadInItem).label !== "string" ||
            typeof (item as ArticleLeadInItem).body !== "string"
          ) {
            return undefined;
          }
          const label = cleanTextForExport((item as ArticleLeadInItem).label);
          const body = cleanTextForExport((item as ArticleLeadInItem).body);
          if (!label && !body) return undefined;
          return { label, body } satisfies ArticleLeadInItem;
        })
        .filter((item): item is ArticleLeadInItem => Boolean(item))
    : [];
}

interface PreviewTableCell {
  text: string;
  header?: boolean;
}

function isPreviewTableCell(cell: PreviewTableCell | undefined): cell is PreviewTableCell {
  return Boolean(cell);
}

function tableRows(block: ArticleBlock): PreviewTableCell[][] {
  return Array.isArray(block.slots?.rows)
    ? block.slots.rows
        .map((row) => Array.isArray(row)
          ? row
              .map((cell): PreviewTableCell | undefined => {
                if (!cell || typeof cell !== "object" || typeof cell.text !== "string") return undefined;
                const text = cleanTextForExport(cell.text);
                return text ? { text, header: cell.header === true } : undefined;
              })
              .filter(isPreviewTableCell)
          : [])
        .filter((row) => row.length > 0)
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
    case "title": {
      const text = textSlot(block);
      return text ? <h1 className={className}>{text}</h1> : null;
    }
    case "sapo": {
      const text = textSlot(block);
      return text ? <p className={className}>{text}</p> : null;
    }
    case "section-heading": {
      const text = textSlot(block);
      return text ? <h2 className={className}>{text}</h2> : null;
    }
    case "paragraph": {
      const text = textSlot(block);
      return text ? <p className={className}>{text}</p> : null;
    }
    case "conclusion": {
      const text = textSlot(block);
      return text ? <p className={`${className} a4-conclusion`}>{text}</p> : null;
    }
    case "bullet-list": {
      const items = stringItems(block);
      if (items.length === 0) return null;
      return (
        <ul className={className}>
          {items.map((item, index) => (
            <li key={`${block.id}-item-${index}`}>{item}</li>
          ))}
        </ul>
      );
    }
    case "ordered-list": {
      const items = stringItems(block);
      if (items.length === 0) return null;
      return (
        <ol className={className}>
          {items.map((item, index) => (
            <li key={`${block.id}-item-${index}`}>{item}</li>
          ))}
        </ol>
      );
    }
    case "quote": {
      const text = textSlot(block);
      const caption = textSlot(block, "caption");
      return text ? <blockquote className={className}>{text}{caption && <cite>{caption}</cite>}</blockquote> : null;
    }
    case "callout": {
      const title = textSlot(block, "title");
      const text = textSlot(block);
      const note = textSlot(block, "note");
      return text ? <aside className={`${className} a4-callout`}>{title && <strong>{title}</strong>}<p>{text}</p>{note && <small>{note}</small>}</aside> : null;
    }
    case "fact-box": {
      const title = textSlot(block, "title") || "Thông tin nổi bật";
      const items = stringItems(block);
      const note = textSlot(block, "note");
      return items.length > 0 ? (
        <aside className={`${className} a4-fact-box`}>
          <strong>{title}</strong>
          <ul>{items.map((item, index) => <li key={`${block.id}-fact-${index}`}>{item}</li>)}</ul>
          {note && <small>{note}</small>}
        </aside>
      ) : null;
    }
    case "table": {
      const rows = tableRows(block);
      const caption = textSlot(block, "caption");
      if (rows.length === 0) return null;
      return (
        <figure className={`${className} a4-table-figure`}>
          <table className="a4-table">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${block.id}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => {
                    const Tag = cell.header ? "th" : "td";
                    return <Tag key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>{cell.text}</Tag>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    case "lead-in-list": {
      const items = leadInItems(block);
      if (items.length === 0) return null;
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
      const title = textSlot(block, "title");
      const caption = textSlot(block, "caption");
      const note = textSlot(block, "note");
      const description = textSlot(block, "description");
      const aspectRatio = textSlot(block, "aspectRatio") || "16:9";
      const source = optionalStringSlot(block, "source");
      const boxLabel = title && title !== caption ? title : "Vị trí chèn ảnh minh họa";
      return (
        <figure className={className} data-aspect-ratio={aspectRatio}>
          <div className="a4-figure-placeholder-box" role="img" aria-label={caption || boxLabel}>
            <span>{boxLabel}</span>
            {description && description !== boxLabel && <small>{description}</small>}
            {note && <small>{note}</small>}
            {source && source !== note && <small>Nguồn: {source}</small>}
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
  rootId,
  showValidationSummary = true,
}: A4PrintPreviewProps) => {
  const validation = React.useMemo(() => validateArticleDocument(document), [document]);
  const validationCounts = React.useMemo(
    () => countPreflightIssuesBySeverity(validation.preflightIssues),
    [validation.preflightIssues],
  );

  return (
    <>
      {showValidationSummary && validation.preflightIssues.length > 0 && (
        <aside
          className="a4-validation-summary"
          aria-label="Tóm tắt kiểm tra ArticleDocument"
          data-export-exclude="true"
        >
          <strong>
            {validationCounts.blocker > 0
              ? "ArticleDocument cần xử lý blocker trước khi xuất bản."
              : "Bản thảo còn cảnh báo trước khi xuất bản chính thức."}
          </strong>
          <p>
            Blocker: {validationCounts.blocker} · Warning: {validationCounts.warning} · Info: {validationCounts.info}
          </p>
        </aside>
      )}
      {/* MVP hiện là A4 styled continuous article; paginated preview sẽ làm sau. */}
      <article
        id={rootId}
        className={["print-layout", "a4-preview", className].filter(Boolean).join(" ")}
        data-template-id={document.templateId}
      >
        {renderArticleDocumentToHtmlA4(document)}
      </article>
    </>
  );
};
