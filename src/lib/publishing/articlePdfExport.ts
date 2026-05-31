import type { ArticleExportBlock, ArticleExportModel, ArticleExportTableCell } from "./articleExportModel";
import type { ExportArticleBlock, ExportListItem, ExportTextRun } from "../exportArticleModel";

function textRun(text: string, options: Omit<ExportTextRun, "text"> = {}): ExportTextRun {
  return { text, ...options };
}

function plainRuns(text: string): ExportTextRun[] {
  return text ? [textRun(text)] : [];
}

function tableCellToPdfCell(cell: ArticleExportTableCell): { runs: ExportTextRun[]; header?: boolean } {
  return {
    runs: plainRuns(cell.text),
    header: cell.header,
  };
}

function mapArticleExportBlockToPdfBlocks(block: ArticleExportBlock): ExportArticleBlock[] {
  switch (block.type) {
    case "title":
      return [{ type: "heading", level: 1, runs: [textRun(block.text, { bold: true })] }];
    case "sapo":
      return [{ type: "paragraph", runs: [textRun(block.text, { bold: true })] }];
    case "heading":
      return [{ type: "heading", level: block.level ?? 2, runs: [textRun(block.text, { bold: true })] }];
    case "paragraph":
      return [{ type: "paragraph", runs: plainRuns(block.text) }];
    case "quote":
      return [{ type: "paragraph", runs: [textRun(block.text, { italics: true })] }];
    case "conclusion":
      return [{ type: "paragraph", runs: [textRun(block.text, { bold: true })] }];
    case "lead-in":
      return [{
        type: "leadInList",
        items: block.items.map((item) => ({ label: item.label, body: plainRuns(item.body) })),
      }];
    case "bullet-list":
    case "numbered-list": {
      const items: ExportListItem[] = block.items.map((item) => ({ runs: plainRuns(item), level: 0 }));
      return [{ type: "list", ordered: block.type === "numbered-list", items }];
    }
    case "figure-placeholder":
      return [{
        type: "figurePlaceholder",
        label: block.figure.label,
        caption: block.figure.caption,
        note: block.figure.note,
      }];
    case "table":
      return [{
        type: "table",
        rows: block.table.rows.map((row) => row.map(tableCellToPdfCell)),
        ...(block.table.caption ? { caption: block.table.caption } : {}),
      }];
    case "page-break":
      return [{ type: "pageBreak" }];
    case "unknown":
      return block.text ? [{ type: "paragraph", runs: plainRuns(block.text) }] : [];
    default:
      return [];
  }
}

export function mapArticleExportModelToPdfBlocks(model: ArticleExportModel): ExportArticleBlock[] {
  return model.blocks.flatMap(mapArticleExportBlockToPdfBlocks);
}

export function hasPdfExportableContent(model: ArticleExportModel): boolean {
  return mapArticleExportModelToPdfBlocks(model).length > 0;
}
