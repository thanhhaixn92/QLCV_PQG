const EDITORIAL_BRIEF_PREFIX_PATTERN = /^\s*(?:Yêu\s*cầu\s*(?:chung\s*)?\/\s*Bối\s*cảnh\s*[:：]?|Yêu\s*cầu\s*\/\s*)\s*/iu;
const EDITORIAL_BRIEF_ONLY_PATTERN = /^(?=.*(?:Yêu\s*cầu|Bối\s*cảnh|chung))\s*(?:Yêu\s*cầu|Bối\s*cảnh|chung|\/|[:：]|[-–—]|\s)*\s*$/iu;

export function normalizeEditorialBriefInput(value: string): string {
  let cleaned = String(value || "").replace(/\u00a0/gu, " ").trim();

  while (EDITORIAL_BRIEF_PREFIX_PATTERN.test(cleaned)) {
    cleaned = cleaned.replace(EDITORIAL_BRIEF_PREFIX_PATTERN, "").trim();
  }

  if (!cleaned) return "";
  return EDITORIAL_BRIEF_ONLY_PATTERN.test(cleaned) ? "" : cleaned;
}

export function normalizeEditorialBriefContent(value: string): string {
  return String(value || "")
    .split(/\r?\n/u)
    .map((line) => ({ original: line, normalized: normalizeEditorialBriefInput(line) }))
    .filter(({ original, normalized }) => normalized.length > 0 || original.trim().length === 0)
    .map(({ normalized }) => normalized)
    .join("\n")
    .trim();
}
