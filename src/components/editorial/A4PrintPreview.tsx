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

function cleanPreviewText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => cleanTextForExport(line))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function getArticleBlockText(block: ArticleBlock, slot: keyof ArticleBlock["slots"] = "text"): string {
  return cleanPreviewText(block.slots?.[slot]);
}

function optionalStringSlot(block: ArticleBlock, slot: string): string {
  const slots = block.slots as Record<string, unknown> | undefined;
  return cleanPreviewText(slots?.[slot]);
}

function stringItems(block: ArticleBlock): string[] {
  return Array.isArray(block.slots?.items)
    ? block.slots.items
        .map((item) => cleanPreviewText(item))
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
          const label = cleanPreviewText((item as ArticleLeadInItem).label);
          const body = cleanPreviewText((item as ArticleLeadInItem).body);
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
                const text = cleanPreviewText(cell.text);
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
    "box-border min-h-[2.5rem] rounded-md bg-white/95 px-2 py-1 whitespace-pre-wrap outline outline-2 outline-offset-2 outline-[#002D56]/55 focus:outline-[#002D56]/70 shadow-[0_0_0_3px_rgba(0,45,86,0.08)] transition-[outline-color,box-shadow,background-color]",
  ].join(" ");
}

function cleanEditablePlainText(value: string): string {
  return String(value || "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/gu, "")
    .replace(/[ \t]+$/gmu, "")
    .replace(/\n{4,}/gu, "\n\n\n");
}

function convertEditableDomToPlainText(element: HTMLElement): string {
  const visualText = typeof element.innerText === "string" ? element.innerText : "";
  if (visualText) return cleanEditablePlainText(visualText);

  const lines: string[] = [];
  let currentLine = "";
  const pushLine = () => {
    lines.push(currentLine);
    currentLine = "";
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      currentLine += node.textContent || "";
      return;
    }
    if (!(node instanceof HTMLElement)) {
      node.childNodes.forEach(walk);
      return;
    }

    const tagName = node.tagName.toLowerCase();
    if (tagName === "br") {
      pushLine();
      return;
    }

    const isBlockLike = node !== element && /^(div|p|li|h[1-6])$/iu.test(tagName);
    if (isBlockLike && currentLine) pushLine();
    node.childNodes.forEach(walk);
    if (isBlockLike) pushLine();
  };

  element.childNodes.forEach(walk);
  if (currentLine || lines.length === 0) lines.push(currentLine);
  return cleanEditablePlainText(lines.join("\n"));
}

function renderMultilineText(text: string): React.ReactNode {
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  return lines.map((line, index) => (
    <React.Fragment key={`line-${index}`}>
      {index > 0 && <br />}
      {line}
    </React.Fragment>
  ));
}

function insertPlainTextAtSelection(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

interface EditableArticleBlockProps {
  block: ArticleBlock;
  value: string;
  onValueChange?: (value: string) => void;
}

function EditableArticleBlock({ block, value, onValueChange }: EditableArticleBlockProps): React.ReactElement {
  const ref = React.useRef<HTMLElement | null>(null);
  const latestDomTextRef = React.useRef(cleanEditablePlainText(value));
  const isComposingRef = React.useRef(false);
  const Tag = block.type === "title" ? "h1" : block.type === "section-heading" ? "h2" : "div";

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node || isComposingRef.current) return;
    const normalizedValue = cleanEditablePlainText(value);
    if (latestDomTextRef.current === normalizedValue && document.activeElement === node) return;
    if (convertEditableDomToPlainText(node) !== normalizedValue) {
      node.textContent = normalizedValue;
    }
    latestDomTextRef.current = normalizedValue;
  }, [value, block.id]);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    window.setTimeout(() => {
      if (!ref.current) return;
      ref.current.focus({ preventScroll: true });
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }, 0);
    return undefined;
  }, [block.id]);

  const syncFromDom = React.useCallback((node: HTMLElement) => {
    const nextValue = convertEditableDomToPlainText(node);
    latestDomTextRef.current = nextValue;
    onValueChange?.(nextValue);
  }, [onValueChange]);

  const stopEditingEvent = React.useCallback((event: React.SyntheticEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <div className="relative" data-canvas-editing-wrapper="true" onClick={stopEditingEvent} onDoubleClick={stopEditingEvent} onPointerDown={stopEditingEvent}>
      <Tag
        ref={ref as React.RefObject<any>}
        className={editableBlockClass(block)}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-canvas-block-id={block.id}
        data-canvas-block-type={block.type}
        data-canvas-editing="true"
        onCompositionStart={(event) => {
          isComposingRef.current = true;
          event.stopPropagation();
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          event.stopPropagation();
          syncFromDom(event.currentTarget);
        }}
        onInput={(event) => {
          if (isComposingRef.current) return;
          syncFromDom(event.currentTarget);
        }}
        onBeforeInput={stopEditingEvent}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
        onClick={stopEditingEvent}
        onDoubleClick={stopEditingEvent}
        onMouseDown={stopEditingEvent}
        onPointerDown={stopEditingEvent}
        onPaste={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const text = cleanEditablePlainText(event.clipboardData.getData("text/plain"));
          insertPlainTextAtSelection(text);
          syncFromDom(event.currentTarget);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      {!cleanEditablePlainText(value) && (
        <span
          data-export-exclude="true"
          className="pointer-events-none absolute left-2 top-1 select-none text-sm font-semibold text-slate-400"
          aria-hidden="true"
        >
          Nhập nội dung…
        </span>
      )}
    </div>
  );
}

function renderEditableBlock(
  block: ArticleBlock,
  options?: { editingBlockId?: string | null; editingValue?: string; onEditingValueChange?: (value: string) => void },
): React.ReactNode | null {
  if (options?.editingBlockId !== block.id) return null;
  return <EditableArticleBlock block={block} value={options.editingValue || ""} onValueChange={options.onEditingValueChange} />;
}

function renderEmptyBlockPlaceholder(block: ArticleBlock): React.ReactNode {
  return (
    <div
      className={[blockStyleClass(block), "a4-canvas-empty-block rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-2 py-2 text-sm font-semibold text-slate-400"].join(" ")}
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
  const isEditing = options.editingBlockId === block.id;
  const className = [
    element.props.className,
    "a4-canvas-selectable box-border cursor-pointer rounded-sm outline-offset-2 transition-[outline-color,box-shadow,background-color] hover:outline hover:outline-1 hover:outline-blue-200 focus:outline focus:outline-1 focus:outline-blue-300",
    isSelected && !isEditing ? "a4-canvas-selected bg-blue-50/20 outline outline-1 outline-blue-300 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]" : "",
    isEditing ? "a4-canvas-editing outline outline-2 outline-[#002D56]/60 shadow-[0_0_0_3px_rgba(0,45,86,0.08)]" : "",
  ].filter(Boolean).join(" ");

  return React.cloneElement(element, {
    className,
    tabIndex: 0,
    role: element.props.role || "button",
    "data-canvas-block-id": block.id,
    "data-canvas-block-type": block.type,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      element.props.onClick?.(event);
      event.stopPropagation();
      if (options.editingBlockId === block.id) return;
      options.onBlockSelect?.(block, event);
    },
    onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
      element.props.onDoubleClick?.(event);
      event.preventDefault();
      event.stopPropagation();
      if (options.editingBlockId === block.id) return;
      options.onBlockOpen?.(block, event);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      element.props.onKeyDown?.(event);
      if (options.editingBlockId === block.id) return;
      if (event.key === "Enter") {
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
      return text ? <h1 className={className}>{renderMultilineText(text)}</h1> : null;
    }
    case "sapo": {
      const text = getArticleBlockText(block);
      return text ? <p className={className}>{renderMultilineText(text)}</p> : null;
    }
    case "section-heading": {
      const text = getArticleBlockText(block);
      return text ? <h2 className={className}>{renderMultilineText(text)}</h2> : null;
    }
    case "paragraph": {
      const text = getArticleBlockText(block);
      return text ? <p className={className}>{renderMultilineText(text)}</p> : null;
    }
    case "conclusion": {
      const text = getArticleBlockText(block);
      return text ? <p className={`${className} a4-conclusion`}>{renderMultilineText(text)}</p> : null;
    }
    case "bullet-list": {
      const items = stringItems(block);
      if (items.length === 0) return null;
      return (
        <ul className={className}>
          {items.map((item, index) => (
            <li key={`${block.id}-item-${index}`}>{renderMultilineText(item)}</li>
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
            <li key={`${block.id}-item-${index}`}>{renderMultilineText(item)}</li>
          ))}
        </ol>
      );
    }
    case "quote": {
      const text = getArticleBlockText(block);
      const caption = getArticleBlockText(block, "caption");
      return text ? <blockquote className={className}>{renderMultilineText(text)}{caption && <cite>{renderMultilineText(caption)}</cite>}</blockquote> : null;
    }
    case "callout": {
      const title = getArticleBlockText(block, "title");
      const text = getArticleBlockText(block);
      const note = getArticleBlockText(block, "note");
      return text ? <aside className={`${className} a4-callout`}>{title && <strong>{renderMultilineText(title)}</strong>}<p>{renderMultilineText(text)}</p>{note && <small>{renderMultilineText(note)}</small>}</aside> : null;
    }
    case "fact-box": {
      const title = getArticleBlockText(block, "title") || "Thông tin nổi bật";
      const items = stringItems(block);
      const note = getArticleBlockText(block, "note");
      return items.length > 0 ? (
        <aside className={`${className} a4-fact-box`}>
          <strong>{renderMultilineText(title)}</strong>
          <ul>{items.map((item, index) => <li key={`${block.id}-fact-${index}`}>{renderMultilineText(item)}</li>)}</ul>
          {note && <small>{renderMultilineText(note)}</small>}
        </aside>
      ) : null;
    }
    case "table": {
      const rows = tableRows(block);
      const caption = getArticleBlockText(block, "caption");
      if (rows.length === 0) return null;
      return (
        <figure className={`${className} a4-table-figure`}>
          {caption && <figcaption className="a4-table-caption-top">{renderMultilineText(caption)}</figcaption>}
          <div className="a4-table-scroll">
            <table className="a4-table">
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${block.id}-row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => {
                      const Tag = cell.header ? "th" : "td";
                      return <Tag key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>{renderMultilineText(cell.text)}</Tag>;
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
                <strong>{renderMultilineText(item.label)}: </strong>
                {renderMultilineText(item.body)}
              </p>
            ))}
          </div>
        );
      }
      return (
        <ul className={listClassName}>
          {items.map((item, index) => (
            <li key={`${block.id}-lead-${index}`}>
              <strong>{renderMultilineText(item.label)}: </strong>
              {renderMultilineText(item.body)}
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
            <span>{renderMultilineText(boxLabel)}</span>
            {description && description !== boxLabel && <small>{renderMultilineText(description)}</small>}
            {note && <small>{renderMultilineText(note)}</small>}
            {source && source !== note && <small>Nguồn: {renderMultilineText(source)}</small>}
          </div>
          {caption && <figcaption>{renderMultilineText(caption)}</figcaption>}
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
  showValidationSummary = false,
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
              ? "Bản thảo cần xử lý lỗi chặn trước khi xuất bản."
              : "Bản thảo còn cảnh báo trước khi xuất bản chính thức."}
          </strong>
          <p>
            Lỗi chặn: {validationCounts.blocker} · Cảnh báo: {validationCounts.warning} · Gợi ý: {validationCounts.info}
          </p>
        </aside>
      )}
      {/* MVP hiện là A4 styled continuous article; paginated preview sẽ làm sau. */}
      <article
        id={rootId}
        className={["print-layout", "a4-preview", className].filter(Boolean).join(" ")}
        data-template-id={document.templateId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      >
        {renderArticleDocumentToHtmlA4(document, { selectableBlocks, selectedBlockIds, onBlockSelect, onBlockOpen, editingBlockId, editingValue, onEditingValueChange, emptyBlockIds })}
      </article>
    </>
  );
};
