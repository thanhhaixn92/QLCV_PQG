export const SAFE_VIETNAMESE_FIXES: Array<[RegExp, string]> = [
  [/\bmiề\s+n\b/gi, 'miền'],
  [/\bBắ\s+c\b/g, 'Bắc'],
  [/\bbề\s+n\b/gi, 'bền'],
  [/\bvữ\s+ng\b/gi, 'vững'],
  [/\bnhiệ\s+m\b/gi, 'nhiệm'],
  [/\bchấ\s+t\b/gi, 'chất'],
  [/\bxuấ\s+t\b/gi, 'xuất'],
  [/\bsả\s+n\b/gi, 'sản'],
  [/\bđồ\s+ng\b/gi, 'đồng'],
  [/\bquyế\s+t\b/gi, 'quyết'],
  [/\bcấ\s+p\b/gi, 'cấp'],
  [/\bchố\s+ng\b/gi, 'chống'],
  [/\bphầ\s+n\b/gi, 'phần'],
  [/\bnguồ\s+n\b/gi, 'nguồn'],
  [/\btiế\s+p\b/gi, 'tiếp'],
  [/\bkiế\s+n\b/gi, 'kiến'],
  [/\bđoà\s+n\b/gi, 'đoàn'],
  [/\bcô\s+ng\b/gi, 'công'],
  [/\bhà\s+ng\b/gi, 'hàng'],
  [/\bhả\s+i\b/gi, 'hải'],
  [/\bdoanh\s+nghiệ\s+p\b/gi, 'doanh nghiệp'],
  [/\bngườ\s+i\s+lao\s+độ\s+ng\b/gi, 'người lao động'],
];

export function normalizeVietnameseUnicode(input: string): string {
  if (!input) return input;
  
  let output = input
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  for (const [pattern, replacement] of SAFE_VIETNAMESE_FIXES) {
    output = output.replace(pattern, replacement);
  }

  return output;
}

export function sanitizeEditorContent(content: string): string {
  if (!content) return content;
  return normalizeVietnameseUnicode(content);
}
