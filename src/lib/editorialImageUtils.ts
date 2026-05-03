import {
  EditorialImageAnalysis,
  EditorialIllustration,
  EditorialIllustrationPlan,
  ExistingMarkdownImage,
  IllustrationPlaceholder,
} from '../types';

const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMG_RE = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
const PLACEHOLDER_RE = /^\s*([*\-]\s*)?(hình minh họa|ảnh minh họa|chèn hình|cần ảnh|gợi ý hình|caption|ghi chú hình)\s*[:：\-–]?\s*(.+)$/i;

export function splitParagraphs(content: string): string[] {
  // Tách theo dòng mới đôi hoặc đơn lẻ nếu là danh sách/ghi chú
  return content
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
}

export function countWords(content: string): number {
  const words = content.replace(/[`*_#>\-]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function getParagraphIndexByCharIndex(content: string, charIndex: number): number {
  const before = content.slice(0, Math.max(0, charIndex));
  return Math.max(0, before.split(/\n{2,}/).length - 1);
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'data:';
  } catch {
    return false;
  }
}

export function extractMarkdownImages(content: string): ExistingMarkdownImage[] {
  const images: ExistingMarkdownImage[] = [];
  let match: RegExpExecArray | null;

  while ((match = IMAGE_MARKDOWN_RE.exec(content)) !== null) {
    const alt = match[1] || '';
    const url = match[2] || '';
    images.push({
      id: `md-${match.index}-${images.length}`,
      alt,
      url,
      raw: match[0],
      index: match.index,
      paragraphIndex: getParagraphIndexByCharIndex(content, match.index),
      isLikelyBroken: !isValidHttpUrl(url),
    });
  }

  while ((match = HTML_IMG_RE.exec(content)) !== null) {
    const url = match[1] || '';
    images.push({
      id: `html-${match.index}-${images.length}`,
      alt: 'Hình ảnh HTML',
      url,
      raw: match[0],
      index: match.index,
      paragraphIndex: getParagraphIndexByCharIndex(content, match.index),
      isLikelyBroken: !isValidHttpUrl(url),
    });
  }

  return images;
}

export function extractIllustrationPlaceholders(content: string): IllustrationPlaceholder[] {
  const lines = content.split('\n');
  const placeholders: IllustrationPlaceholder[] = [];
  let cursor = 0;

  lines.forEach((line, idx) => {
    // Trim to handle leading spaces/bullet points
    const trimmed = line.trim();
    const match = trimmed.match(PLACEHOLDER_RE);
    const currentIndex = cursor;
    cursor += line.length + 1;

    if (!match) return;

    const paragraphIndex = getParagraphIndexByCharIndex(content, currentIndex);
    const paragraphs = splitParagraphs(content);
    placeholders.push({
      id: `ph-${idx}-${currentIndex}`,
      raw: line,
      text: match[3].trim(),
      index: currentIndex,
      paragraphIndex,
      contextBefore: paragraphs[Math.max(0, paragraphIndex - 1)] || '',
      contextAfter: paragraphs[Math.min(paragraphs.length - 1, paragraphIndex + 1)] || '',
    });
  });

  return placeholders;
}

export function getTargetImageCount(wordCount: number, placeholderCount: number, validExistingImageCount: number): number {
  let target = 0;
  if (wordCount < 450) target = 1;
  else if (wordCount < 900) target = 1;
  else if (wordCount < 1500) target = 2;
  else target = 3;

  if (placeholderCount > target) target = Math.min(4, placeholderCount);
  return Math.max(0, Math.min(4, target - validExistingImageCount));
}

export function buildLocalImageAnalysis(content: string, illustrations: EditorialIllustration[] = []): EditorialImageAnalysis {
  const paragraphs = splitParagraphs(content);
  const wordCount = countWords(content);
  const existingImages = extractMarkdownImages(content);
  const placeholders = extractIllustrationPlaceholders(content);
  const brokenImageIds = existingImages.filter(img => img.isLikelyBroken).map(img => img.id);
  const validExistingImageCount = existingImages.filter(img => !img.isLikelyBroken).length + illustrations.filter(isPublishableIllustration).length;
  const neededImageCount = getTargetImageCount(wordCount, placeholders.length, validExistingImageCount);

  const plans: EditorialIllustrationPlan[] = placeholders.slice(0, neededImageCount || placeholders.length).slice(0, 4).map((ph, idx) => ({
    id: `plan-${Date.now()}-${idx}`,
    paragraphIndex: ph.paragraphIndex,
    insertAfter: ph.contextBefore || paragraphs[ph.paragraphIndex] || '',
    caption: ph.text,
    prompt: buildFallbackImagePrompt(ph.text, ph.contextBefore, ph.contextAfter),
    reason: 'Tạo hình từ ghi chú hình minh họa trong bài viết.',
    priority: 'high',
    sourcePlaceholderId: ph.id,
  }));

  return {
    paragraphs,
    wordCount,
    existingImages,
    placeholders,
    brokenImageIds,
    validExistingImageCount,
    targetImageCount: neededImageCount,
    neededImageCount,
    plans,
    notes: [],
  };
}

export function buildFallbackImagePrompt(description: string, before: string, after: string): string {
  const context = `${before}\n${after}`.slice(0, 700);
  return [
    'Professional editorial illustration for a Vietnamese maritime pilotage company website.',
    'Realistic documentary photography style, clean composition, no fake logos, no readable text.',
    `Main subject: ${description}.`,
    `Article context: ${context}`,
  ].join(' ');
}

export function isPublishableIllustration(img: EditorialIllustration): boolean {
  return img.status === 'ready' && img.reviewStatus === 'approved' && img.qualityStatus !== 'failed' && img.loadStatus !== 'error' && !!img.url;
}

export function isUsableSuggestedIllustration(img: EditorialIllustration): boolean {
  return img.status === 'ready' && img.reviewStatus !== 'rejected' && img.qualityStatus !== 'failed' && !!img.url;
}

export function removeBrokenMarkdownImages(content: string): string {
  return content
    .replace(IMAGE_MARKDOWN_RE, (raw, _alt, url) => (isValidHttpUrl(url) ? raw : ''))
    .replace(HTML_IMG_RE, (raw, url) => (isValidHttpUrl(url) ? raw : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function hasUnapprovedPlaceholders(content: string, approvedIllustrations: EditorialIllustration[]): boolean {
  const placeholders = extractIllustrationPlaceholders(content);
  const approvedParagraphs = new Set(approvedIllustrations.map(img => img.paragraphIndex));
  // If there's any placeholder that doesn't have an approved image in its paragraph, return true.
  return placeholders.some(ph => !approvedParagraphs.has(ph.paragraphIndex));
}

export function stripResolvedPlaceholders(content: string, illustrations: EditorialIllustration[], hideAll: boolean = false): string {
  const readyParagraphs = new Set(
    illustrations.filter(isPublishableIllustration).map(img => img.paragraphIndex)
  );
  
  // If not sanctioned, we might still want to hide if it's suggested in UI, 
  // but for export we strictly hide based on hideAll or matching approved image
  const lineToStrictlyHide = new Set(
    illustrations.filter(isUsableSuggestedIllustration).map(img => img.paragraphIndex)
  );

  const lines = content.split('\n');
  let cursor = 0;
  const kept: string[] = [];

  lines.forEach(line => {
    const currentIndex = cursor;
    cursor += line.length + 1;
    const isPlaceholder = PLACEHOLDER_RE.test(line);
    const paragraphIndex = getParagraphIndexByCharIndex(content, currentIndex);
    
    if (isPlaceholder) {
      if (hideAll) return; // Always hide in export
      if (readyParagraphs.has(paragraphIndex)) return; // Hide if approved image exists
      if (lineToStrictlyHide.has(paragraphIndex)) return; // Hide if suggested image exists (for preview)
    }
    
    kept.push(line);
  });

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function insertApprovedIllustrationsForPlainExport(content: string, illustrations: EditorialIllustration[]): string {
  const clean = stripResolvedPlaceholders(removeBrokenMarkdownImages(content), illustrations, true);
  const approved = illustrations.filter(isPublishableIllustration);
  if (!approved.length) return clean;

  const paragraphs = splitParagraphs(clean);
  const grouped = new Map<number, EditorialIllustration[]>();
  approved.forEach(img => {
    const arr = grouped.get(img.paragraphIndex) || [];
    arr.push(img);
    grouped.set(img.paragraphIndex, arr);
  });

  const out: string[] = [];
  paragraphs.forEach((p, idx) => {
    out.push(p);
    const imgs = grouped.get(idx) || [];
    imgs.forEach(img => {
      out.push(`![${img.caption || 'Hình minh họa'}](${img.url})`);
      if (img.caption) out.push(`*${img.caption}*`);
    });
  });

  return out.join('\n\n');
}
