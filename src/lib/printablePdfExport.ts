/**
 * Printable PDF Export Utility using pdfmake/html-to-pdfmake.
 * Provides searchable, selectable, vector-grade high-quality printouts.
 */

import { normalizeExportDom, validateExportContent } from "./exportContentNormalizer";
import { buildExportArticleModel, exportArticleModelToPdfmake } from "./exportArticleModel";

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

  // Normalize DOM on a clone only.
  const normalizedClone = normalizeExportDom(element);

  const articleModel = buildExportArticleModel(normalizedClone);
  if (articleModel.length === 0) {
    throw new Error("Nội dung bài viết trống sau khi chuẩn hóa, không thể xuất PDF.");
  }
  const pdfmakeContent = exportArticleModelToPdfmake(articleModel);

  // Prepare document definition.
  const docDefinition = {
    content: pdfmakeContent,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 13,
      lineHeight: 1.45,
      color: '#000000',
    },
    pageSize: 'A4',
    pageMargins: [70, 56, 42, 56] as any, // [left, top, right, bottom]
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
      h1: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 12, 0, 16], color: '#002D56' },
      h2: { fontSize: 14, bold: true, alignment: 'left', margin: [0, 14, 0, 6], color: '#002D56' },
      h3: { fontSize: 13, bold: true, alignment: 'left', margin: [0, 10, 0, 5] },
      paragraph: { fontSize: 13, margin: [0, 4, 0, 14], alignment: 'justify', lineHeight: 1.45 },
      listItem: { fontSize: 13, margin: [0, 2, 0, 6], alignment: 'justify', lineHeight: 1.45 },
      caption: { fontSize: 10, italics: true, color: '#475569', alignment: 'center', margin: [0, 0, 0, 12] },
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
    console.error("pdfmake error:", err);
    throw new Error("Không thể khởi tạo trình xuất PDF. Vui lòng thử lại hoặc xuất Word.");
  }
}
