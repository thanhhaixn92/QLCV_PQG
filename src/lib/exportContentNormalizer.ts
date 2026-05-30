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

export interface ExportImagePlaceholderBlock {
  placeholder: string;
  caption?: string;
}

export function normalizeVietnameseText(input: string): string {
  let output = normalizeVietnameseUnicode(input)
    .replace(/Bản xem nhanh\s*\(Visual Snapshot\)/gi, '')
    .replace(/Visual Snapshot/gi, '')
    .replace(/Bản chụp nhanh PDF/gi, '');

  output = normalizeExportTextContent(output);

  return output
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripControlCharacters(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function normalizeVietnameseTextNode(input: string): string {
  // DOM text nodes must preserve leading/trailing whitespace around inline elements.
  let output = stripControlCharacters(normalizeVietnameseUnicode(input || ''))
    .replace(/Bản xem nhanh\s*\(Visual Snapshot\)/gi, '')
    .replace(/Visual Snapshot/gi, '')
    .replace(/Bản chụp nhanh PDF/gi, '');

  output = output.replace(/([A-Za-zÀ-ỹĐđ0-9\)])\s*:\s*([A-Za-zÀ-ỹĐđ])/gu, '$1: $2');
  output = output.replace(/(?<!\d):(?=[^\s\d/:])/gu, ': ');

  return output;
}

function protectUrls(input: string): { text: string; urls: string[] } {
  const urls: string[] = [];
  const text = input.replace(/https?:\/\/\S+/gi, (url) => {
    urls.push(url);
    return `__EXPORT_URL_${urls.length - 1}__`;
  });
  return { text, urls };
}

function restoreUrls(input: string, urls: string[]): string {
  return urls.reduce(
    (output, url, index) => output.replace(`__EXPORT_URL_${index}__`, url),
    input,
  );
}

function buildCleanPlaceholderLabel(index: string | undefined, description: string): string {
  const cleanIndex = (index || '').trim();
  const cleanDescription = description.trim().replace(/\s+/g, ' ');
  const label = cleanIndex ? `KHUNG ẢNH ${cleanIndex}` : 'KHUNG ẢNH';
  return cleanDescription ? `${label}: ${cleanDescription}` : label;
}

export function extractImagePlaceholderBlock(input: string): ExportImagePlaceholderBlock | null {
  const text = stripControlCharacters(input).trim();
  if (!text) return null;

  const bracketMatch = text.match(
    /^\s*\[\s*(?:PLACEHOLDER\s+)?(?:ẢNH|HÌNH)\s*(\d+)?\s*:\s*([^\]]+?)\s*\]\s*(?:(Chú thích ảnh|Ghi chú hình|Caption)\s*[:.：-]?\s*(.+))?\s*$/iu,
  );

  if (bracketMatch) {
    return {
      placeholder: buildCleanPlaceholderLabel(bracketMatch[1], bracketMatch[2]),
      caption: bracketMatch[4]?.trim()
        ? `${bracketMatch[3] || 'Chú thích ảnh'}: ${bracketMatch[4].trim()}`
        : undefined,
    };
  }

  const cleanMatch = text.match(
    /^(KHUNG\s+(?:GIỮ\s+CHỖ\s+)?ẢNH(?:\s+\d+)?\s*:?\s*.*?)(?:\s+(Chú thích ảnh|Ghi chú hình|Caption)\s*[:.：-]?\s*(.+))?$/iu,
  );

  if (cleanMatch && /^KHUNG/iu.test(cleanMatch[1])) {
    return {
      placeholder: cleanMatch[1].trim(),
      caption: cleanMatch[3]?.trim()
        ? `${cleanMatch[2] || 'Chú thích ảnh'}: ${cleanMatch[3].trim()}`
        : undefined,
    };
  }

  return null;
}

function removeDebugMarkers(input: string): string {
  return input
    .replace(/\[\s*[-–—]{1,3}\s*(?=[^\]]*(?:PLACEHOLDER|ẢNH|HÌNH))[^\]]*?[-–—]{1,3}\s*\]/giu, '')
    .replace(/^\s*[-–—]{1,3}\s*(?=.*(?:PLACEHOLDER|ẢNH|HÌNH)).*?[-–—]{1,3}\s*$/gimu, '');
}

function replaceBracketedPlaceholders(input: string): string {
  const attachedCaptionPattern =
    /\[\s*(?:PLACEHOLDER\s+)?(?:ẢNH|HÌNH)\s*(\d+)?\s*:\s*([^\]]+?)\s*\]\s*(Chú thích ảnh|Ghi chú hình|Caption)\s*[:.：-]?\s*([^\n]+)/giu;

  const standalonePattern =
    /\[\s*(?:PLACEHOLDER\s+)?(?:ẢNH|HÌNH)\s*(\d+)?\s*:\s*([^\]]+?)\s*\]/giu;

  const withCaptions = input.replace(
    attachedCaptionPattern,
    (match, index, description, captionPrefix, caption, offset) => {
      if (input[offset - 1] === '!') return match;
      return `${buildCleanPlaceholderLabel(index, description)}\n${captionPrefix}: ${caption.trim()}`;
    },
  );

  return withCaptions.replace(
    standalonePattern,
    (match, index, description, offset) => {
      if (withCaptions[offset - 1] === '!') return match;
      return buildCleanPlaceholderLabel(index, description);
    },
  );
}

export function normalizeExportTextContent(input: string): string {
  const { text, urls } = protectUrls(stripControlCharacters(input));

  let output = removeDebugMarkers(text);
  output = replaceBracketedPlaceholders(output)
    .replace(/^(\s*\d+)[.)]([^\s\d])/gm, '$1. $2')
    .replace(/^(\s*[-*])([^\s])/gm, '$1 $2');

  output = output.replace(/([A-Za-zÀ-ỹĐđ0-9\)])\s*:\s*([A-Za-zÀ-ỹĐđ])/gu, '$1: $2');
  output = output.replace(/(?<!\d):(?=[^\s\d/:])/gu, ': ');

  return restoreUrls(output, urls);
}

export function stripExportArtifacts(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(
      [
        'button',
        'input',
        'select',
        'textarea',
        '[role="tooltip"]',
        '[data-export-exclude]',
        '[data-export-exclude="true"]',
        '.no-print',
        '.toast',
        '.spinner',
        '.loading',
        '.lucide',
        '.a4-validation-summary',
        '.editor-toolbar',
        '.toolbar',
      ].join(','),
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
    if (['hidden', 'auto', 'scroll'].includes(el.style.overflow)) {
      el.style.overflow = 'visible';
    }
  });

  return clone;
}

function normalizeImagePlaceholderElements(root: HTMLElement): void {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('p,li,div'));

  candidates.forEach((el) => {
    if (el.querySelector('img,table,ul,ol,h1,h2,h3')) return;

    if (el.dataset.exportPlaceholderNormalized === 'true') return;

    const text = (el.textContent || '').trim();
    const block = extractImagePlaceholderBlock(text);
    if (!block) return;

    el.dataset.exportPlaceholderNormalized = 'true';

    const fragment = document.createDocumentFragment();
    fragment.appendChild(
      createExportParagraph(
        document,
        block.placeholder,
        'export-image-placeholder',
        'text-align:center;font-weight:700;border:1px dashed #64748b;background:#f8fafc;padding:10px;margin:12px 0 4px 0;color:#334155;',
      ),
    );

    if (block.caption) {
      fragment.appendChild(
        createExportParagraph(
          document,
          block.caption,
          'export-image-caption',
          'text-align:center;font-style:italic;font-size:11px;margin:0 0 12px 0;color:#475569;',
        ),
      );
    }

    el.replaceWith(fragment);
  });
}

function fixColonSpacingAcrossDomBoundaries(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const current = nodes[i];
    const next = nodes[i + 1];
    const currentValue = current.nodeValue || '';
    const nextValue = next.nodeValue || '';

    if (/:$/.test(currentValue.trimEnd()) && /^[A-Za-zÀ-ỹĐđ]/u.test(nextValue.trimStart())) {
      current.nodeValue = `${currentValue.trimEnd()} `;
    }
  }
}

function createExportParagraph(
  documentRef: Document,
  text: string,
  className: string,
  cssText: string,
): HTMLParagraphElement {
  const p = documentRef.createElement('p');
  p.className = className;
  p.textContent = text;
  p.setAttribute('style', cssText);
  return p;
}

export function normalizeExportDom(root: HTMLElement): HTMLElement {
  const clone = stripExportArtifacts(root);

  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  nodes.forEach((node) => {
    node.nodeValue = normalizeVietnameseTextNode(node.nodeValue || '');
  });

  fixColonSpacingAcrossDomBoundaries(clone);
  normalizeImagePlaceholderElements(clone);

  clone.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const placeholder = createExportParagraph(
      document,
      img.getAttribute('alt') || img.getAttribute('title') || 'Vị trí chèn ảnh minh họa',
      'export-image-placeholder',
      'text-align:center;font-weight:700;border:1px dashed #64748b;background:#f8fafc;padding:10px;margin:12px 0 4px 0;color:#334155;',
    );
    img.replaceWith(placeholder);
  });

  return clone;
}

export function validateExportContent(root: HTMLElement): ExportValidationResult {
  const issues: ExportValidationIssue[] = [];
  const text = stripControlCharacters(root.innerText || root.textContent || '');

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



  const draftMarkers = text.match(/\[\s*(?:Cần bổ sung|Cần kiểm chứng|Bổ sung)\s*:[^\]]+\]|\[\s*(?:PLACEHOLDER|—\s*(?:ẢNH|PLACEHOLDER)\s*—)[^\]]*\]/giu) || [];
  if (draftMarkers.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'DRAFT_MARKERS_PRESENT',
      message: `Còn ${draftMarkers.length} marker bản nháp/cần bổ sung trong nội dung xuất. Chỉ nên xuất như bản nháp sau khi xác nhận.`,
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
