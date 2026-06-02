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
  selectableBlocks?: boolean;
  selectedBlockIds?: string[];
  onBlockSelect?: (block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => void;
  onBlockOpen?: (block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => void;
  editingBlockId?: string | null;
  editingValue?: string;
  onEditingValueChange?: (value: string) => void;
  emptyBlockIds?: string[];
}

export function getArticleBlockText(block: ArticleBlock, slot: keyof ArticleBlock["slots"] = "text"): string {
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

export function getArticleBlockExcerpt(block: ArticleBlock): string {
  const directText = getArticleBlockText(block) || getArticleBlockText(block, "caption") || getArticleBlockText(block, "title");
  if (directText) return directText;

  const items = stringItems(block);
  if (items.length > 0) return items.slice(0, 2).join(" • ");

  const rows = tableRows(block);
  if (rows.length > 0) return rows.slice(0, 2).map((row) => row.map((cell) => cell.text).join(" | ")).join(" / ");

  const leadItems = leadInItems(block);
  if (leadItems.length > 0) return leadItems.slice(0, 2).map((item) => `${item.label}: ${item.body}`).join(" • ");

  return block.type;
}

function editableBlockClass(block: ArticleBlock): string {
  return [
    blockStyleClass(block),
    "a4-canvas-block-editor",
    "min-h-[2.5rem] rounded-md bg-white/95 px-2 py-1 outline-none ring-2 ring-amber-400 focus:ring-amber-500 whitespace-pre-wrap",
  ].join(" ");
}

function renderEditableBlock(
  block: ArticleBlock,
  options?: { editingBlockId?: string | null; editingValue?: string; onEditingValueChange?: (value: string) => void },
): React.ReactNode | null {
  if (options?.editingBlockId !== block.id) return null;

  const value = options.editingValue || "";
  const Tag = block.type === "title" ? "h1" : block.type === "section-heading" ? "h2" : "div";

  return (
    <Tag
      className={editableBlockClass(block)}
      contentEditable
      suppressContentEditableWarning
      data-canvas-block-id={block.id}
      data-canvas-block-type={block.type}
      data-canvas-editing="true"
      onInput={(event) => options.onEditingValueChange?.((event.currentTarget.textContent || "").replace(/\u200B/gu, ""))}
    >
      {value || <span data-export-exclude="true" className="text-slate-400">Nhập nội dung…</span>}
    </Tag>
  );
}

function renderEmptyBlockPlaceholder(block: ArticleBlock): React.ReactNode {
  return (
    <div
      className={[blockStyleClass(block), "a4-canvas-empty-block rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-2 py-2 text-sm font-semibold text-slate-400"].join(" ")}
      data-canvas-block-id={block.id}
      data-canvas-block-type={block.type}
      data-export-exclude="true"
      aria-label="Block trống trong phiên chỉnh sửa"
    >
      Nhập nội dung…
    </div>
  );
}

function withSelectableBlock(
  node: React.ReactNode,
  block: ArticleBlock,
  options?: {
    selectableBlocks?: boolean;
    selectedBlockIds?: string[];
    onBlockSelect?: (block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => void;
    onBlockOpen?: (block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => void;
    editingBlockId?: string | null;
    editingValue?: string;
    onEditingValueChange?: (value: string) => void;
    emptyBlockIds?: string[];
  },
): React.ReactNode {
  if (!options?.selectableBlocks || !React.isValidElement(node)) return node;

  const element = node as React.ReactElement<any>;
  const isSelected = options.selectedBlockIds?.includes(block.id) === true;
  const className = [element.props.className, "a4-canvas-selectable cursor-pointer rounded-sm transition-shadow hover:ring-2 hover:ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300", isSelected ? "a4-canvas-selected ring-2 ring-blue-400 bg-blue-50/30" : ""].filter(Boolean).join(" ");

  return React.cloneElement(element, {
    className,
    tabIndex: 0,
    role: element.props.role || "button",
    "data-canvas-block-id": block.id,
    "data-canvas-block-type": block.type,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      element.props.onClick?.(event);
      event.stopPropagation();
      options.onBlockSelect?.(block, event);
    },
    onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
      element.props.onDoubleClick?.(event);
      event.stopPropagation();
      options.onBlockOpen?.(block, event);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      element.props.onKeyDown?.(event);
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        options.onBlockOpen?.(block, event as unknown as React.MouseEvent<HTMLElement>);
      }
    },
  });
}

function renderBlock(block: ArticleBlock): React.ReactNode {
  const className = blockStyleClass(block);

  switch (block.type) {
    case "title": {
      const text = getArticleBlockText(block);
      return text ? <h1 className={className}>{text}</h1> : null;
    }
    case "sapo": {
      const text = getArticleBlockText(block);
      return text ? <p className={className}>{text}</p> : null;
    }
    case "section-heading": {
      const text = getArticleBlockText(block);
      return text ? <h2 className={className}>{text}</h2> : null;
    }
    case "paragraph": {
      const text = getArticleBlockText(block);
      return text ? <p className={className}>{text}</p> : null;
    }
    case "conclusion": {
      const text = getArticleBlockText(block);
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
      const text = getArticleBlockText(block);
      const caption = getArticleBlockText(block, "caption");
      return text ? <blockquote className={className}>{text}{caption && <cite>{caption}</cite>}</blockquote> : null;
    }
    case "callout": {
      const title = getArticleBlockText(block, "title");
      const text = getArticleBlockText(block);
      const note = getArticleBlockText(block, "note");
      return text ? <aside className={`${className} a4-callout`}>{title && <strong>{title}</strong>}<p>{text}</p>{note && <small>{note}</small>}</aside> : null;
    }
    case "fact-box": {
      const title = getArticleBlockText(block, "title") || "Thông tin nổi bật";
      const items = stringItems(block);
      const note = getArticleBlockText(block, "note");
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
      const caption = getArticleBlockText(block, "caption");
      if (rows.length === 0) return null;
      return (
        <figure className={`${className} a4-table-figure`}>
          {caption && <figcaption className="a4-table-caption-top">{caption}</figcaption>}
          <div className="a4-table-scroll">
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
          </div>
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
      const title = getArticleBlockText(block, "title");
      const caption = getArticleBlockText(block, "caption");
      const note = getArticleBlockText(block, "note");
      const description = getArticleBlockText(block, "description");
      const aspectRatio = getArticleBlockText(block, "aspectRatio") || "16:9";
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

export function renderArticleDocumentToHtmlA4(
  document: ArticleDocument,
  options?: {
    selectableBlocks?: boolean;
    selectedBlockIds?: string[];
    onBlockSelect?: (block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => void;
    onBlockOpen?: (block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => void;
    editingBlockId?: string | null;
    editingValue?: string;
    onEditingValueChange?: (value: string) => void;
    emptyBlockIds?: string[];
  },
): React.ReactNode {
  return document.blocks.map((block) => {
    const editable = renderEditableBlock(block, options);
    const rendered = editable || (options?.emptyBlockIds?.includes(block.id) ? renderEmptyBlockPlaceholder(block) : renderBlock(block));
    return (
      <React.Fragment key={block.id}>
        {withSelectableBlock(rendered, block, options)}
      </React.Fragment>
    );
  });
}

export const A4PrintPreview = ({
  document,
  className = "",
  rootId,
  showValidationSummary = true,
  selectableBlocks = false,
  selectedBlockIds = [],
  onBlockSelect,
  onBlockOpen,
  editingBlockId,
  editingValue,
  onEditingValueChange,
  emptyBlockIds = [],
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
        {renderArticleDocumentToHtmlA4(document, { selectableBlocks, selectedBlockIds, onBlockSelect, onBlockOpen, editingBlockId, editingValue, onEditingValueChange, emptyBlockIds })}
      </article>
    </>
  );
};
