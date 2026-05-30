import { normalizeVietnameseUnicode } from "./unicodeNormalizer";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, BorderStyle, WidthType, FileChild } from "docx";

export interface ExportTextRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

export interface ExportTableCell {
  runs: ExportTextRun[];
  header?: boolean;
}

export interface ExportLeadInItem {
  label: string;
  body: ExportTextRun[];
}

export type ExportArticleBlock =
  | { type: "heading"; level: 1 | 2 | 3; runs: ExportTextRun[] }
  | { type: "paragraph"; runs: ExportTextRun[] }
  | { type: "leadInList"; items: ExportLeadInItem[] }
  | { type: "figurePlaceholder"; label: string; caption?: string }
  | { type: "kpiTable"; rows: { label: string; value: string }[] }
  | { type: "list"; ordered: boolean; items: ExportTextRun[][] }
  | { type: "table"; rows: ExportTableCell[][] };

const KPI_LABEL_RE =
  /^(Sản lượng dẫn tàu|Tổng GTHL|Tổng doanh thu|Doanh thu|Sản lượng|GTHL|Kế hoạch|Kết quả|Chỉ tiêu)\b/iu;

function normalizeTextForRender(input: string): string {
  // Important: never trim render runs. Spaces at run boundaries separate inline text.
  return normalizeVietnameseUnicode(input || "")
    .replace(/Bản xem nhanh\s*\(Visual Snapshot\)/gi, "")
    .replace(/Visual Snapshot/gi, "")
    .replace(/Bản chụp nhanh PDF/gi, "");
}

function normalizeComparableText(input: string): string {
  return normalizeVietnameseUnicode(input || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDisplayText(input: string): string {
  return normalizeComparableText(input)
    .replace(/^\*\s*/, "")
    .replace(/\s*\*$/, "")
    .trim();
}

function sameDisplayText(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && normalizeComparableText(a) === normalizeComparableText(b));
}

export function runsToPlainText(runs: ExportTextRun[]): string {
  return normalizeComparableText(runs.map((run) => run.text).join(""));
}

function isEmptyRuns(runs: ExportTextRun[]): boolean {
  return runsToPlainText(runs).length === 0;
}

function renderRunsFromNode(
  node: Node,
  inherited: { bold?: boolean; italics?: boolean } = {},
): ExportTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeTextForRender(node.textContent || "");
    return text ? [{ text, ...inherited }] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") return [{ text: "\n", ...inherited }];

  const next = {
    bold: inherited.bold || tag === "strong" || tag === "b",
    italics: inherited.italics || tag === "em" || tag === "i",
  };

  return Array.from(el.childNodes).flatMap((child) => renderRunsFromNode(child, next));
}

function splitRunsByLine(runs: ExportTextRun[]): ExportTextRun[][] {
  const lines: ExportTextRun[][] = [[]];

  runs.forEach((run) => {
    const parts = run.text.split(/\n/);
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) {
        lines[lines.length - 1].push({ ...run, text: part });
      }
    });
  });

  return lines.filter((line) => !isEmptyRuns(line));
}

function normalizeRunsForRender(runs: ExportTextRun[]): ExportTextRun[] {
  return runs
    .map((run) => ({
      ...run,
      text: normalizeTextForRender(run.text),
    }))
    .filter((run) => run.text.length > 0);
}

export function isCaptionText(text: string): boolean {
  return /^(?:Chú thích ảnh|Ghi chú hình|Caption)\s*:|^\*\s*.+\s*\*$/iu.test(
    normalizeComparableText(text),
  );
}

export function isFigurePlaceholderText(text: string): boolean {
  const value = normalizeComparableText(text);
  return /^KHUNG\s+(?:GIỮ\s+CHỖ\s+)?ẢNH(?:\s+\d+)?\b/iu.test(value)
    || /^\[\s*(?:PLACEHOLDER\s+)?(?:ẢNH|HÌNH)(?:\s*\d+)?\s*:/iu.test(value);
}

export function parseFigurePlaceholderText(text: string): { label: string; caption?: string } | null {
  const value = normalizeComparableText(text);
  if (!value) return null;

  const cleanBlock = value.match(
    /^(KHUNG\s+(?:GIỮ\s+CHỖ\s+)?ẢNH(?:\s+\d+)?\s*:?\s*.*?)(?:\s+(Chú thích ảnh|Ghi chú hình|Caption)\s*:?\s*(.+))?$/iu,
  );

  if (cleanBlock && /^KHUNG/iu.test(cleanBlock[1])) {
    return {
      label: cleanBlock[1].trim(),
      caption: cleanBlock[3]?.trim()
        ? `${cleanBlock[2] || "Chú thích ảnh"}: ${cleanBlock[3].trim()}`
        : undefined,
    };
  }

  const rawBlock = value.match(
    /^\[\s*(?:PLACEHOLDER\s+)?(ẢNH|HÌNH)\s*(\d+)?\s*:\s*([^\]]+?)\s*\]\s*(?:(Chú thích ảnh|Ghi chú hình|Caption)\s*:?\s*(.+))?$/iu,
  );

  if (!rawBlock) return null;

  const index = rawBlock[2]?.trim();
  const description = rawBlock[3].trim();
  const label = `KHUNG ẢNH${index ? ` ${index}` : ""}: ${description}`;

  return {
    label,
    caption: rawBlock[5]?.trim()
      ? `${rawBlock[4] || "Chú thích ảnh"}: ${rawBlock[5].trim()}`
      : undefined,
  };
}

function parseKpiCandidateFromText(text: string): { label: string; value: string } | null {
  const value = normalizeComparableText(text);
  const match = value.match(/^([^:\n]{3,90})\s*:\s*(.{2,})$/u);
  if (!match) return null;

  const label = normalizeDisplayText(match[1]);
  const result = normalizeDisplayText(match[2]);

  if (!label || !result) return null;
  if (!KPI_LABEL_RE.test(label)) return null;

  return { label, value: result };
}

function parseKpiCandidateFromRuns(runs: ExportTextRun[]): { label: string; value: string } | null {
  return parseKpiCandidateFromText(runsToPlainText(runs));
}

function tableFromElement(table: HTMLTableElement): ExportArticleBlock | null {
  const rows = Array.from(table.querySelectorAll("tr")).map((tr, rowIndex) =>
    Array.from(tr.querySelectorAll("th,td")).map((cell) => ({
      runs: normalizeRunsForRender(renderRunsFromNode(cell)),
      header: rowIndex === 0 || cell.tagName.toLowerCase() === "th",
    })),
  );

  return rows.length ? { type: "table", rows } : null;
}

function listFromElement(list: HTMLElement): ExportArticleBlock | null {
  const ordered = list.tagName.toLowerCase() === "ol";
  const items = Array.from(list.children)
    .filter((child) => child.tagName.toLowerCase() === "li")
    .map((li) => normalizeRunsForRender(renderRunsFromNode(li)))
    .filter((runs) => runsToPlainText(runs).length > 0);

  return items.length ? { type: "list", ordered, items } : null;
}

function contentRoot(root: HTMLElement): HTMLElement {
  if (root.matches("article.print-layout, .print-layout.a4-preview")) {
    return root;
  }

  return (
    root.querySelector("article.print-layout, .print-layout.a4-preview") as HTMLElement
  ) || root;
}

function pushPendingKpis(
  output: ExportArticleBlock[],
  pendingKpis: { label: string; value: string }[],
): void {
  if (!pendingKpis.length) return;

  if (pendingKpis.length >= 2) {
    output.push({ type: "kpiTable", rows: [...pendingKpis] });
  } else {
    pendingKpis.forEach((row) => {
      output.push({
        type: "paragraph",
        runs: [
          { text: `${row.label}: `, bold: true },
          { text: row.value },
        ],
      });
    });
  }

  pendingKpis.length = 0;
}

function leadInFromRuns(runs: ExportTextRun[]): ExportLeadInItem | null {
  const plain = runsToPlainText(runs).replace(/^\d+[.)]\s+/, "");
  const match = plain.match(/^([^:：]{3,90})[:：]\s*(.{2,})$/u);
  if (!match) return null;

  const label = normalizeDisplayText(match[1]);
  const bodyText = normalizeDisplayText(match[2]);
  if (!label || !bodyText || label.split(/\s+/).length > 12) return null;
  return { label, body: [{ text: bodyText }] };
}

function pushParagraphLines(
  output: ExportArticleBlock[],
  pendingKpis: { label: string; value: string }[],
  runs: ExportTextRun[],
): void {
  const lines = splitRunsByLine(runs);

  lines.forEach((lineRuns) => {
    const placeholder = parseFigurePlaceholderText(runsToPlainText(lineRuns));
    if (placeholder) {
      pushPendingKpis(output, pendingKpis);
      output.push({ type: "figurePlaceholder", ...placeholder });
      return;
    }

    const kpi = parseKpiCandidateFromRuns(lineRuns);
    if (kpi) {
      pendingKpis.push(kpi);
      return;
    }

    pushPendingKpis(output, pendingKpis);
    if (!isEmptyRuns(lineRuns)) {
      output.push({ type: "paragraph", runs: lineRuns });
    }
  });
}

function isWrapperElement(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  return ["div", "section", "article", "main", "span"].includes(tag);
}

function hasOnlyTextLikeContent(el: HTMLElement): boolean {
  return !Array.from(el.children).some((child) => {
    const tag = child.tagName.toLowerCase();
    return !["strong", "b", "em", "i", "u", "span", "br"].includes(tag);
  });
}

function appendElementToModel(
  el: HTMLElement,
  blocks: ExportArticleBlock[],
  pendingKpis: { label: string; value: string }[],
): void {
  const tag = el.tagName.toLowerCase();
  const text = normalizeComparableText(el.textContent || "");
  const className = el.className?.toString() || "";

  if (!text && tag !== "table" && tag !== "ul" && tag !== "ol") return;

  if (tag === "h1" || tag === "h2" || tag === "h3") {
    pushPendingKpis(blocks, pendingKpis);
    blocks.push({
      type: "heading",
      level: tag === "h1" ? 1 : tag === "h2" ? 2 : 3,
      runs: normalizeRunsForRender(renderRunsFromNode(el)),
    });
    return;
  }

  if (tag === "table") {
    pushPendingKpis(blocks, pendingKpis);
    const table = tableFromElement(el as HTMLTableElement);
    if (table) blocks.push(table);
    return;
  }

  if (tag === "figure") {
    pushPendingKpis(blocks, pendingKpis);
    const caption = normalizeDisplayText(el.querySelector("figcaption")?.textContent || "");
    const boxText = normalizeDisplayText(
      Array.from(el.children)
        .filter((child) => child.tagName.toLowerCase() !== "figcaption")
        .map((child) => child.textContent || "")
        .join(" "),
    );

    const label = boxText || "Vị trí chèn ảnh minh họa";
    blocks.push({
      type: "figurePlaceholder",
      label,
      caption: caption && !sameDisplayText(label, caption) ? caption : undefined,
    });
    return;
  }

  if (tag === "ul" || tag === "ol") {
    pushPendingKpis(blocks, pendingKpis);
    const list = listFromElement(el);
    if (list) blocks.push(list);
    return;
  }

  if (tag === "img") {
    // V4.2 intentionally does not embed real images. Placeholder boxes are the target.
    return;
  }

  if (className.includes("export-image-placeholder") || isFigurePlaceholderText(text)) {
    pushPendingKpis(blocks, pendingKpis);
    const parsed = parseFigurePlaceholderText(text);
    if (parsed) {
      blocks.push({
        type: "figurePlaceholder",
        label: parsed.label,
        caption: parsed.caption,
      });
    }
    return;
  }

  if (className.includes("export-image-caption") || isCaptionText(text)) {
    pushPendingKpis(blocks, pendingKpis);
    blocks.push({
      type: "paragraph",
      runs: [{ text: normalizeDisplayText(text), italics: true }],
    });
    return;
  }

  if (tag === "p" || tag === "li" || hasOnlyTextLikeContent(el)) {
    const runs = normalizeRunsForRender(renderRunsFromNode(el));
    if (runs.length) {
      pushParagraphLines(blocks, pendingKpis, runs);
      return;
    }
  }

  if (isWrapperElement(el) && el.children.length > 0) {
    Array.from(el.children).forEach((child) => {
      appendElementToModel(child as HTMLElement, blocks, pendingKpis);
    });
    return;
  }

  // Last-resort fallback for unknown text-bearing blocks.
  if (text) {
    pushPendingKpis(blocks, pendingKpis);
    blocks.push({ type: "paragraph", runs: [{ text }] });
  }
}

function attachCaptionsToPreviousFigures(blocks: ExportArticleBlock[]): ExportArticleBlock[] {
  const output: ExportArticleBlock[] = [];

  blocks.forEach((block) => {
    const previous = output[output.length - 1];

    if (block.type === "paragraph" && previous?.type === "figurePlaceholder") {
      const paragraphText = runsToPlainText(block.runs);
      const captionLike =
        block.runs.length > 0 &&
        block.runs.every((run) => run.italics) &&
        isCaptionText(paragraphText);

      if (!previous.caption && captionLike) {
        previous.caption = normalizeDisplayText(paragraphText);
        return;
      }

      if (sameDisplayText(previous.caption, paragraphText) || sameDisplayText(previous.label, paragraphText)) {
        return;
      }
    }

    output.push(block);
  });

  return output;
}

export function buildExportArticleModel(root: HTMLElement): ExportArticleBlock[] {
  const blocks: ExportArticleBlock[] = [];
  const pendingKpis: { label: string; value: string }[] = [];
  const rootEl = contentRoot(root);

  Array.from(rootEl.children).forEach((child) => {
    appendElementToModel(child as HTMLElement, blocks, pendingKpis);
  });

  pushPendingKpis(blocks, pendingKpis);

  return normalizeArticleBlocks(attachCaptionsToPreviousFigures(blocks));
}

function normalizeArticleBlocks(blocks: ExportArticleBlock[]): ExportArticleBlock[] {
  const normalized: ExportArticleBlock[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type !== "paragraph") {
      normalized.push(block);
      continue;
    }

    const numberedItems: ExportTextRun[][] = [];
    let cursor = index;
    let expectedNumber = 1;

    while (cursor < blocks.length && blocks[cursor].type === "paragraph") {
      const current = blocks[cursor] as Extract<ExportArticleBlock, { type: "paragraph" }>;
      const plain = runsToPlainText(current.runs);
      const match = plain.match(/^(\d+)[.)]\s+(.+)$/u);
      if (!match || Number(match[1]) !== expectedNumber) break;

      const stripped = normalizeDisplayText(match[2]);
      if (!stripped) break;
      numberedItems.push([{ text: stripped }]);
      cursor += 1;
      expectedNumber += 1;
    }

    if (numberedItems.length >= 2) {
      const leadInItems = numberedItems
        .map((item) => leadInFromRuns(item))
        .filter(Boolean) as ExportLeadInItem[];

      if (leadInItems.length === numberedItems.length) {
        normalized.push({ type: "leadInList", items: leadInItems });
      } else {
        normalized.push({ type: "list", ordered: true, items: numberedItems });
      }
      index = cursor - 1;
      continue;
    }

    normalized.push(block);
  }

  return normalized;
}

function pdfRuns(runs: ExportTextRun[]): any[] {
  return runs.map((run) => ({
    text: run.text,
    bold: run.bold,
    italics: run.italics,
  }));
}

function pdfFigure(block: Extract<ExportArticleBlock, { type: "figurePlaceholder" }>): any[] {
  const content: any[] = [
    {
      table: {
        widths: ["*"],
        heights: [160],
        body: [
          [
            {
              text: block.label,
              alignment: "center",
              bold: true,
              color: "#334155",
              margin: [8, 64, 8, 0],
              fillColor: "#F8FAFC",
            },
          ],
        ],
      },
      layout: {
        hLineColor: () => "#94A3B8",
        vLineColor: () => "#94A3B8",
        hLineStyle: () => ({ dash: { length: 4, space: 3 } }),
        vLineStyle: () => ({ dash: { length: 4, space: 3 } }),
      },
      margin: [0, 10, 0, block.caption ? 4 : 12],
    },
  ];

  if (block.caption) {
    content.push({
      text: block.caption,
      style: "caption",
      alignment: "center",
      margin: [0, 0, 0, 12],
    });
  }

  return content;
}

export function exportArticleModelToPdfmake(blocks: ExportArticleBlock[]): any[] {
  const content: any[] = [];

  blocks.forEach((block) => {
    if (block.type === "heading") {
      content.push({
        text: pdfRuns(block.runs),
        style: `h${block.level}`,
      });
      return;
    }

    if (block.type === "paragraph") {
      const captionLike = block.runs.length > 0 && block.runs.every((run) => run.italics);
      content.push({
        text: pdfRuns(block.runs),
        style: captionLike ? "caption" : "paragraph",
      });
      return;
    }

    if (block.type === "leadInList") {
      block.items.forEach((item) => {
        content.push({
          text: [{ text: `${item.label}: `, bold: true }, ...pdfRuns(item.body)],
          style: "paragraph",
        });
      });
      return;
    }

    if (block.type === "figurePlaceholder") {
      content.push(...pdfFigure(block));
      return;
    }

    if (block.type === "kpiTable") {
      content.push({
        table: {
          widths: ["35%", "*"],
          body: [
            [
              { text: "Chỉ tiêu", bold: true, fillColor: "#E2E8F0" },
              { text: "Kết quả", bold: true, fillColor: "#E2E8F0" },
            ],
            ...block.rows.map((row) => [
              { text: row.label, bold: true },
              { text: row.value },
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        margin: [0, 6, 0, 12],
      });
      return;
    }

    if (block.type === "list") {
      content.push({
        [block.ordered ? "ol" : "ul"]: block.items.map((item) => ({
          text: pdfRuns(item),
          style: "listItem",
        })),
        margin: [16, 4, 0, 12],
      });
      return;
    }

    if (block.type === "table") {
      content.push({
        table: {
          widths: block.rows[0]?.map(() => "*") || ["*"],
          body: block.rows.map((row) =>
            row.map((cell) => ({
              text: pdfRuns(cell.runs),
              bold: cell.header,
              fillColor: cell.header ? "#E2E8F0" : undefined,
            })),
          ),
        },
        layout: "lightHorizontalLines",
        margin: [0, 6, 0, 12],
      });
    }
  });

  return content;
}

function docxRuns(runs: ExportTextRun[]): TextRun[] {
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italics,
        font: "Times New Roman",
        size: 28,
      }),
  );
}

export type ExportDocxBlock = FileChild;

export function exportArticleModelToDocx(blocks: ExportArticleBlock[]): ExportDocxBlock[] {
  const children: ExportDocxBlock[] = [];

  blocks.forEach((block) => {
    if (block.type === "heading") {
      children.push(
        new Paragraph({
          children: docxRuns(block.runs),
          heading:
            block.level === 1
              ? HeadingLevel.HEADING_1
              : block.level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          spacing: { before: 280, after: 240, line: 360 },
        }),
      );
      return;
    }

    if (block.type === "paragraph") {
      const isCaption = block.runs.length > 0 && block.runs.every((run) => run.italics);
      children.push(
        new Paragraph({
          children: docxRuns(block.runs),
          alignment: isCaption ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
          spacing: {
            line: 360,
            before: isCaption ? 60 : 0,
            after: isCaption ? 240 : 220,
          },
          indent: isCaption ? undefined : { firstLine: 567 },
        }),
      );
      return;
    }

    if (block.type === "leadInList") {
      block.items.forEach((item) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${item.label}: `,
                bold: true,
                font: "Times New Roman",
                size: 28,
              }),
              ...docxRuns(item.body),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { line: 360, after: 180 },
            indent: { firstLine: 567 },
          }),
        );
      });
      return;
    }

    if (block.type === "figurePlaceholder") {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: block.label,
              font: "Times New Roman",
              size: 26,
              bold: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 220, after: 120, line: 320 },
          border: {
            top: { style: BorderStyle.DASHED, size: 6, color: "94A3B8" },
            bottom: { style: BorderStyle.DASHED, size: 6, color: "94A3B8" },
            left: { style: BorderStyle.DASHED, size: 6, color: "94A3B8" },
            right: { style: BorderStyle.DASHED, size: 6, color: "94A3B8" },
          },
          shading: { fill: "F8FAFC" },
        } as any),
      );
      if (block.caption) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.caption,
                font: "Times New Roman",
                size: 22,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 240, line: 320 },
          }),
        );
      }
      return;
    }

    if (block.type === "kpiTable") {
      children.push(
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Chỉ tiêu", bold: true, font: "Times New Roman", size: 28 })] })],
                  shading: { fill: "E2E8F0" },
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: "Kết quả", bold: true, font: "Times New Roman", size: 28 })] })],
                  shading: { fill: "E2E8F0" },
                }),
              ],
            }),
            ...block.rows.map(
              (row) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.label, bold: true, font: "Times New Roman", size: 28 })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.value, font: "Times New Roman", size: 28 })] })] }),
                  ],
                }),
            ),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          },
        }),
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
      return;
    }

    if (block.type === "list") {
      block.items.forEach((item) => {
        children.push(
          new Paragraph({
            children: docxRuns(item),
            numbering: {
              reference: block.ordered ? "vms-numbered" : "vms-bullet",
              level: 0,
            },
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 100, line: 360 },
          }),
        );
      });
      return;
    }

    if (block.type === "table") {
      children.push(
        new Table({
          rows: block.rows.map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: cell.runs.length
                            ? docxRuns(cell.runs)
                            : [new TextRun({ text: "", font: "Times New Roman", size: 28 })],
                        }),
                      ],
                      shading: cell.header ? { fill: "E2E8F0" } : undefined,
                    }),
                ),
              }),
          ),
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          },
        }),
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }
  });

  return children;
}
