import { normalizeVietnameseUnicode, SAFE_VIETNAMESE_FIXES } from './unicodeNormalizer';

export type ExportSeverity = 'error' | 'warning';

export interface ExportValidationIssue {
  severity: ExportSeverity;
  code: string;
  message: string;
}

export interface ExportValidationResult {
  ok: boolean;
  issues: ExportValidationIssue[];
}

export function normalizeVietnameseText(input: string): string {
  let output = normalizeVietnameseUnicode(input)
    .replace(/Bản xem nhanh\s*\(Visual Snapshot\)/gi, '')
    .replace(/Visual Snapshot/gi, '')
    .replace(/Bản chụp nhanh PDF/gi, '');

  return output
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripExportArtifacts(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(
      'button,input,select,textarea,[role="tooltip"],.no-print,.toast,.spinner,.loading,.lucide'
    )
    .forEach((el) => el.remove());

  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    if (/Visual Snapshot|Bản xem nhanh/i.test(node.nodeValue || '')) {
      node.nodeValue = '';
    }
  });

  clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.position = el.style.position === 'fixed' || el.style.position === 'sticky' ? 'static' : el.style.position;
    el.style.transform = 'none';
    el.style.animation = 'none';
    el.style.overflow = el.style.overflow === 'hidden' ? 'visible' : el.style.overflow;
  });

  return clone;
}

export function normalizeExportDom(root: HTMLElement): HTMLElement {
  const clone = stripExportArtifacts(root);

  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  nodes.forEach((node) => {
    node.nodeValue = normalizeVietnameseText(node.nodeValue || '');
  });

  return clone;
}

export function validateExportContent(root: HTMLElement): ExportValidationResult {
  const issues: ExportValidationIssue[] = [];
  const text = root.innerText || '';

  if (!text.trim()) {
    issues.push({
      severity: 'error',
      code: 'EMPTY_CONTENT',
      message: 'Nội dung chính trống, không thể xuất file.',
    });
  }

  if (/Visual Snapshot|Bản xem nhanh/i.test(text)) {
    issues.push({
      severity: 'error',
      code: 'VISUAL_SNAPSHOT_WATERMARK',
      message: 'Nội dung còn watermark Visual Snapshot. Cần loại bỏ trước khi xuất.',
    });
  }

  const textLength = text.trim().length;
  const largeMediaCount = root.querySelectorAll('canvas,img').length;
  const paragraphCount = root.querySelectorAll('p,h1,h2,h3,h4,li,td,th').length;

  if (textLength < 100 && largeMediaCount > 0 && paragraphCount < 3) {
    issues.push({
      severity: 'error',
      code: 'IMAGE_ONLY_EXPORT',
      message: 'Vùng xuất có dấu hiệu là ảnh chụp, không phải nội dung văn bản thật.',
    });
  }

  if (/\b(miề\s+n|Bắ\s+c|nhiệ\s+m|chấ\s+t|xuấ\s+t|đồ\s+ng)\b/i.test(text)) {
    issues.push({
      severity: 'warning',
      code: 'BROKEN_VIETNAMESE_SPACING',
      message: 'Có dấu hiệu lỗi tách chữ tiếng Việt. Hệ thống sẽ chuẩn hóa trước khi xuất.',
    });
  }

  root.querySelectorAll('table').forEach((table) => {
    if ((table as HTMLElement).scrollWidth > root.clientWidth) {
      issues.push({
        severity: 'warning',
        code: 'WIDE_TABLE',
        message: 'Có bảng rộng hơn vùng A4, cần kiểm tra bản xuất.',
      });
    }
  });

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
  };
}
