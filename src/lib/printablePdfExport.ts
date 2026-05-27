/**
 * Printable PDF Export Utility using browser native print engine (iframe)
 * Provides searchable, selectable, vector-grade high-quality printouts.
 */

export interface PrintPdfOptions {
  title?: string;
  profile?: 'article' | 'proposal' | 'official';
}

export function exportPrintablePdfFromElement(elementId: string, options: PrintPdfOptions = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Không tìm thấy vùng nội dung có ID: "${elementId}" để xuất.`);
  }

  // Create a deep clone
  const clone = element.cloneNode(true) as HTMLElement;

  // Clean up unwanted items for clean print (buttons, download actions, custom indicators, tooltips)
  const interactiveAndIcons = clone.querySelectorAll(
    "button, input, select, textarea, .no-print, [role='tooltip'], svg, .lucide"
  );
  interactiveAndIcons.forEach((el) => el.remove());

  // Also clean up background colors/actions that may show up incorrectly
  // For proposal content, we want it styled cleanly.
  
  // Create an iframe to hold the print view
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Không thể khởi chạy dịch vụ in ấn của trình duyệt.");
  }

  const title = options.title || "Tai_Lieu_Xuat_Ban";

  // Build printing styles targeting A4 specification
  const styles = `
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 25mm; /* Top, Right, Bottom, Left standard administrative spacing */
    }
    
    * {
      background: transparent !important;
      color: #000050 !important; /* Rich deep charcoal or blue for document quality */
      box-shadow: none !important;
      text-shadow: none !important;
    }
    
    body {
      font-family: "Times New Roman", Times, "Times New Roman (Vietnamese)", serif;
      font-size: 13pt;
      line-height: 1.45;
      color: #000000 !important;
      margin: 0;
      padding: 0;
    }

    h1, h2, h3, h4, h5, h6 {
      font-family: "Times New Roman", Times, serif;
      color: #000000 !important;
      font-weight: bold;
      line-height: 1.3;
      margin-top: 16pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }

    h1 {
      font-size: 16pt;
      text-align: center;
      text-transform: uppercase;
      margin-top: 10pt;
      margin-bottom: 18pt;
    }

    h2 {
      font-size: 14pt;
      border-bottom: none !important;
      padding-bottom: 0 !important;
    }

    h3 {
      font-size: 13pt;
    }

    p {
      text-align: justify;
      margin-top: 0;
      margin-bottom: 10pt;
      /* Indent paragraphs but not headings */
      text-indent: 1.25cm;
    }

    /* Paragraph indentation rules for subparts, lists or images */
    li p, .text-center p, p.text-center, p.caption, .image-caption, .no-indent p, p.no-indent {
      text-indent: 0 !important;
    }

    .text-center, p.text-center, div.text-center {
      text-align: center !important;
    }

    .text-right, p.text-right, div.text-right {
      text-align: right !important;
    }

    .text-justify {
      text-align: justify !important;
    }

    /* Lists */
    ul, ol {
      margin-top: 0;
      margin-bottom: 10pt;
      padding-left: 25pt;
    }

    li {
      margin-bottom: 4pt;
      text-align: justify;
    }

    /* Tables */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 12pt;
      margin-bottom: 14pt;
      page-break-inside: auto;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    th, td {
      border: 1px solid #000000 !important;
      padding: 6pt 8pt !important;
      font-size: 12pt !important;
      line-height: 1.3 !important;
      text-align: left;
    }

    th {
      font-weight: bold;
      background-color: #f5f5f5 !important;
      text-align: center;
    }

    /* Images and Captions */
    img {
      max-width: 80% !important;
      max-height: 12cm !important;
      object-fit: contain;
      display: block;
      margin: 14pt auto 6pt auto;
      page-break-inside: avoid;
    }

    figcaption, .image-caption, .caption {
      font-size: 11pt !important;
      font-style: italic !important;
      text-align: center !important;
      margin-top: 4pt;
      margin-bottom: 14pt;
      color: #333333 !important;
    }

    /* Keep page break items from being orphaned */
    .page-break {
      page-break-before: always;
    }

    /* Visual snapshot or metadata layout cleanup */
    .shadow-sm, .shadow, .shadow-md, .shadow-lg, .rounded-lg, .rounded-xl, .rounded-2xl {
      border: none !important;
      box-shadow: none !important;
      background: transparent !important;
    }

    /* Custom borders in UI that are non-standard */
    .border, .border-dashed, .border-slate-100 {
      border: none !important;
    }

    .flex, .grid {
      display: block !important;
    }

    /* Remove interactive/informational banners */
    .bg-amber-50, .bg-blue-50, .bg-red-50, .bg-slate-50 {
      background: transparent !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* Official document alignment/header templates helpers */
    .national-header {
      display: flex !important;
      flex-direction: row !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      width: 100% !important;
      margin-bottom: 24pt !important;
    }
    
    .national-header-left {
      width: 50% !important;
      text-align: center !important;
      font-size: 11pt !important;
      line-height: 1.3 !important;
    }
    
    .national-header-right {
      width: 50% !important;
      text-align: center !important;
      font-size: 11pt !important;
      line-height: 1.3 !important;
    }
  `;

  // Write content to the iframe document
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="vi">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          ${styles}
        </style>
      </head>
      <body>
        <div class="printable-article-root">
          ${clone.innerHTML}
        </div>
        <script>
          // Run print function after images and pages are resolved
          window.addEventListener('load', () => {
            setTimeout(() => {
              window.focus();
              window.print();
            }, 600);
          });
        </script>
      </body>
    </html>
  `);
  doc.close();

  // Keep a deferred queue for clearing standard iframes out of memory
  setTimeout(() => {
    try {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    } catch (e) {
      console.warn("Lỗi khi dọn dẹp môi trường in PDF:", e);
    }
  }, 60000);
}
