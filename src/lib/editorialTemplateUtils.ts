import type { EditorialTemplate, EditorialTemplateInputSpec } from "../types/editorialTemplate";

export const USER_FACING_PLACEHOLDERS = {
  data: "[Cần bổ sung số liệu]",
  legalBasis: "[Cần bổ sung căn cứ pháp lý]",
  source: "[Cần ghi nguồn]",
  verify: "[Cần xác minh]",
  title: "[Cần bổ sung tiêu đề]",
  recipient: "[Cần bổ sung nơi nhận]",
  conclusion: "[Cần bổ sung kết luận]",
  time: "[Cần bổ sung thời gian]",
  responsibleUnit: "[Cần bổ sung đơn vị thực hiện]",
} as const;

export const normalizeTemplateText = (value: string): string =>
  value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const hasAnyKeyword = (haystack: string, keywords: string[]): boolean => {
  const normalizedHaystack = normalizeTemplateText(haystack);
  return keywords.some((keyword) => normalizedHaystack.includes(normalizeTemplateText(keyword)));
};

export const uniqueValues = <T>(values: T[]): T[] => Array.from(new Set(values));

export const resolveMissingInputs = (
  requiredInputs: EditorialTemplateInputSpec[],
  providedInputs?: Record<string, string | undefined>,
): string[] => {
  if (!providedInputs) {
    return requiredInputs.map((input) => input.label);
  }

  return requiredInputs
    .filter((input) => !providedInputs[input.key]?.trim())
    .map((input) => input.label);
};

export const sortTemplatesByPriority = (templates: readonly EditorialTemplate[]): EditorialTemplate[] =>
  [...templates].sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name, "vi"));
