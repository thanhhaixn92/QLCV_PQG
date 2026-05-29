/**
 * Printable PDF Export Utility using browser native print engine (iframe)
 * Provides searchable, selectable, vector-grade high-quality printouts.
 */

import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import htmlToPdfmake from "html-to-pdfmake";
import { normalizeExportDom, validateExportContent } from "./exportContentNormalizer";

// Initialize vfs for pdfMake
(pdfMake as any).vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

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

  // Normalize DOM (strips artifacts, fixes Vietnamese text, removes Visual Snapshot text)
  const normalizedClone = normalizeExportDom(element);

  // Convert HTML to pdfmake format!
  // Note: html-to-pdfmake needs window object in browser environment
  const htmlContent = normalizedClone.outerHTML;
  let pdfmakeContent;
  try {
    pdfmakeContent = htmlToPdfmake(htmlContent, {
      window: window,
      defaultStyles: {
        b: { bold: true },
        strong: { bold: true },
        u: { decoration: 'underline' },
        i: { italics: true },
        em: { italics: true },
        h1: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 10, 0, 15] },
        h2: { fontSize: 14, bold: true, margin: [0, 10, 0, 8] },
        h3: { fontSize: 13, bold: true, margin: [0, 10, 0, 8] },
        p: { fontSize: 13, margin: [0, 0, 0, 10], alignment: 'justify' },
        table: { margin: [0, 5, 0, 15] }
      }
    });
  } catch (err) {
    console.error("htmlToPdfmake error:", err);
    throw new Error("Lỗi chuyển đổi HTML sang cấu trúc PDF.");
  }

  // Prepare document definition
  const docDefinition = {
    content: pdfmakeContent as any,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 13,
      lineHeight: 1.45,
      color: '#000000',
    },
    pageSize: 'A4',
    pageMargins: [70, 56, 42, 56] as any, // [left, top, right, bottom]
    info: {
      title: options.title || 'Tai_Lieu_Xuat_Ban'
    }
  };

  // Generate and download
  try {
    pdfMake.createPdf(docDefinition).download(`${options.title || 'Tai_Lieu_Xuat_Ban'}.pdf`);
  } catch (err) {
    console.error("pdfmake error:", err);
    throw new Error("Lỗi khi tạo và tải xuống file PDF.");
  }
}
