/**
 * Printable PDF Export Utility using pdfmake/html-to-pdfmake.
 * Provides searchable, selectable, vector-grade high-quality printouts.
 */

import { normalizeExportDom, validateExportContent } from "./exportContentNormalizer";
import { ARTICLE_EXPORT_STYLE, buildExportArticleModel, cmToPt, exportArticleModelToPdfmake } from "./exportArticleModel";

async function getPdfMakeClient() {
  const pdfMakeModule = await import("pdfmake/build/pdfmake");
  const pdfFontsModule = await import("pdfmake/build/vfs_fonts");

  const pdfMakeCandidate: any =
    (pdfMakeModule as any).default ??
    (pdfMakeModule as any);

  const pdfFontsCandidate: any =
    (pdfFontsModule as any).default ??
    (pdfFontsModule as any);

  const vfs =
    pdfFontsCandidate?.pdfMake?.vfs ??
    pdfFontsCandidate?.vfs ??
    pdfFontsCandidate?.default?.vfs;

  if (vfs && !pdfMakeCandidate.vfs) {
    pdfMakeCandidate.vfs = vfs;
  }

  const createPdf =
    pdfMakeCandidate?.createPdf ??
    pdfMakeCandidate?.default?.createPdf;

  if (typeof createPdf !== "function") {
    throw new Error("Không thể khởi tạo trình xuất PDF (pdfMake.createPdf unavailable).");
  }

  return {
    pdfMake: pdfMakeCandidate,
    createPdf: createPdf.bind(pdfMakeCandidate),
  };
}

export interface PrintPdfOptions {
  title?: string;
  profile?: 'article' | 'proposal' | 'official';
  onValidationError?: (message: string) => void;
  onValidationWarning?: (message: string) => void;
}

export async function exportPrintablePdfFromElement(elementId: string, options: PrintPdfOptions = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    if (options.onValidationError) options.onValidationError(`Không tìm thấy vùng nội dung có ID: "${elementId}" để xuất.`);
    throw new Error(`Không tìm thấy vùng nội dung có ID: "${elementId}" để xuất.`);
  }

  // Preflight validation
  const validation = validateExportContent(element);
  if (!validation.ok) {
    const errorMsg = validation.issues.find(i => i.severity === 'error')?.message || 'Lỗi kiểm tra nội dung.';
    if (options.onValidationError) options.onValidationError(errorMsg);
    throw new Error(errorMsg);
  }

  const warnings = validation.issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0 && options.onValidationWarning) {
    options.onValidationWarning(warnings[0].message);
  }

  let pdfmakeContent;
  try {
    // Normalize DOM on a clone only.
    const normalizedClone = normalizeExportDom(element);

    const articleModel = buildExportArticleModel(normalizedClone);
    if (articleModel.length === 0) {
      throw new Error("Nội dung bài viết trống sau khi chuẩn hóa, không thể xuất PDF.");
    }
    pdfmakeContent = exportArticleModelToPdfmake(articleModel);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Không thể chuẩn hóa nội dung để xuất PDF.";
    if (options.onValidationError) options.onValidationError(message);
    throw new Error(message);
  }

  // Prepare document definition.
  const docDefinition = {
    content: pdfmakeContent,
    defaultStyle: {
      font: ARTICLE_EXPORT_STYLE.font.pdfFallback,
      fontSize: ARTICLE_EXPORT_STYLE.sizePt.body,
      lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.body,
      color: '#000000',
    },
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [
      cmToPt(ARTICLE_EXPORT_STYLE.page.marginsCm.left),
      cmToPt(ARTICLE_EXPORT_STYLE.page.marginsCm.top),
      cmToPt(ARTICLE_EXPORT_STYLE.page.marginsCm.right),
      cmToPt(ARTICLE_EXPORT_STYLE.page.marginsCm.bottom),
    ] as any, // [left, top, right, bottom]
    footer: function(currentPage: number, pageCount: number) {
      return {
        text: `Trang ${currentPage} / ${pageCount}`,
        alignment: 'center',
        fontSize: 10,
        margin: [0, 20, 0, 0],
        color: '#94a3b8'
      };
    },
    styles: {
      h1: { fontSize: ARTICLE_EXPORT_STYLE.sizePt.h1, bold: true, alignment: 'center', margin: [0, 12, 0, 16], color: '#0F172A', lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.heading },
      h2: { fontSize: ARTICLE_EXPORT_STYLE.sizePt.h2, bold: true, alignment: 'left', margin: [0, 14, 0, 6], color: '#0F172A', lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.heading },
      h3: { fontSize: ARTICLE_EXPORT_STYLE.sizePt.h3, bold: true, alignment: 'left', margin: [0, 10, 0, 5], color: '#0F172A', lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.heading },
      paragraph: { fontSize: ARTICLE_EXPORT_STYLE.sizePt.body, margin: [0, 4, 0, 12], alignment: 'justify', lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.body },
      listItem: { fontSize: ARTICLE_EXPORT_STYLE.sizePt.body, margin: [0, 2, 0, 6], alignment: 'justify', lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.body },
      caption: { fontSize: ARTICLE_EXPORT_STYLE.sizePt.caption, italics: true, color: '#475569', alignment: 'center', margin: [0, 0, 0, 12], lineHeight: ARTICLE_EXPORT_STYLE.lineHeight.caption },
    },
    pageBreakBefore: function(currentNode: any, followingNodesOnPage: any[]) {
      const styles = Array.isArray(currentNode?.style) ? currentNode.style : [currentNode?.style].filter(Boolean);
      const isHeading = Boolean(currentNode?.headlineLevel) || styles.some((style: string) => /^h[1-3]$/.test(style));
      return isHeading && followingNodesOnPage.length === 0;
    },
    info: {
      title: options.title || 'Tai_Lieu_Xuat_Ban'
    }
  };

  // Generate and download
  try {
    const { createPdf } = await getPdfMakeClient();
    createPdf(docDefinition).download(`${options.title || 'Tai_Lieu_Xuat_Ban'}.pdf`);
  } catch (err) {
    throw new Error("Không thể khởi tạo trình xuất PDF. Vui lòng thử lại hoặc xuất Word.");
  }
}
