import type { EditorialTemplate, EditorialTemplateMatchInput, EditorialTemplateMatchResult } from "../types/editorialTemplate";
import { getEditorialTemplates } from "./editorialTemplateRegistry";
import { hasAnyKeyword, normalizeTemplateText, resolveMissingInputs } from "./editorialTemplateUtils";

interface TemplateKeywordRule {
  templateId: string;
  keywords: string[];
  reason: string;
  weight: number;
}

const TEMPLATE_KEYWORD_RULES: TemplateKeywordRule[] = [
  { templateId: "website_article_basic", keywords: ["bài website", "bai website", "đăng website", "dang website", "bài đăng", "bai dang"], reason: "Phù hợp yêu cầu bài đăng website.", weight: 42 },
  { templateId: "company_intro_article", keywords: ["giới thiệu công ty", "gioi thieu cong ty", "giới thiệu đơn vị", "hồ sơ năng lực"], reason: "Có tín hiệu giới thiệu công ty/đơn vị.", weight: 46 },
  { templateId: "news_article_basic", keywords: ["tin tức", "tin tuc", "sự kiện", "su kien", "đưa tin", "dua tin"], reason: "Có tín hiệu tin tức hoặc sự kiện.", weight: 44 },
  { templateId: "activity_report_article", keywords: ["hoạt động", "hoat dong", "phản ánh hoạt động", "tong thuat", "tổng thuật"], reason: "Có tín hiệu phản ánh/tổng thuật hoạt động.", weight: 40 },
  { templateId: "website_feature_article", keywords: ["chuyên đề", "chuyen de", "phân tích", "phan tich", "bài dài", "bai dai"], reason: "Phù hợp bài chuyên đề có luận điểm.", weight: 34 },
  { templateId: "internal_newsletter", keywords: ["bản tin", "ban tin", "thông báo nội bộ", "thong bao noi bo", "cập nhật", "cap nhat"], reason: "Phù hợp bản tin ngắn/thông báo nội bộ.", weight: 44 },
  { templateId: "formal_press_article", keywords: ["trang trọng", "trang trong", "thông cáo", "thong cao", "chính thức", "chinh thuc", "công bố", "cong bo"], reason: "Có tín hiệu bài trang trọng/thông cáo chính thức.", weight: 44 },
  { templateId: "kpi_data_report", keywords: ["số liệu", "so lieu", "kpi", "chỉ tiêu", "chi tieu", "doanh thu", "sản lượng", "san luong"], reason: "Có tín hiệu báo cáo số liệu/KPI hoặc chỉ tiêu.", weight: 54 },
  { templateId: "official_report_basic", keywords: ["báo cáo", "bao cao", "hành chính", "hanh chinh", "tổng kết", "tong ket", "sơ kết", "so ket", "nhiệm vụ", "nhiem vu"], reason: "Có tín hiệu báo cáo/hành chính/tổng kết.", weight: 48 },
  { templateId: "official_dispatch_basic", keywords: ["công văn", "cong van", "đề nghị", "de nghi", "kính gửi", "kinh gui"], reason: "Có tín hiệu công văn hoặc nội dung đề nghị.", weight: 48 },
  { templateId: "work_plan", keywords: ["kế hoạch", "ke hoach", "tiến độ", "tien do", "phân công", "phan cong"], reason: "Có tín hiệu kế hoạch và phân công.", weight: 46 },
  { templateId: "meeting_minutes", keywords: ["biên bản", "bien ban", "cuộc họp", "cuoc hop", "nội dung họp", "noi dung hop"], reason: "Có tín hiệu biên bản/cuộc họp.", weight: 46 },
  { templateId: "notice_basic", keywords: ["thông báo", "thong bao", "triển khai", "trien khai", "yêu cầu thực hiện"], reason: "Có tín hiệu thông báo triển khai.", weight: 38 },
  { templateId: "summary_sheet", keywords: ["phiếu tổng hợp", "phieu tong hop", "tóm tắt phục vụ", "tom tat phuc vu", "tổng hợp nguồn"], reason: "Có tín hiệu phiếu tổng hợp/tóm tắt nguồn.", weight: 38 },
  { templateId: "administrative_memo", keywords: ["ghi nhớ", "ghi nho", "memo", "tờ trình ngắn", "to trinh ngan"], reason: "Có tín hiệu ghi nhớ hành chính.", weight: 34 },
  { templateId: "language_review", keywords: ["rà soát chính tả", "ra soat chinh ta", "văn phong", "van phong", "sửa lỗi", "sua loi", "chính tả", "chinh ta"], reason: "Có tín hiệu rà soát chính tả/văn phong.", weight: 48 },
  { templateId: "argument_strengthening", keywords: ["củng cố lập luận", "cung co lap luan", "lập luận", "lap luan", "thuyết phục", "thuyet phuc"], reason: "Có tín hiệu củng cố lập luận.", weight: 40 },
  { templateId: "source_checking", keywords: ["kiểm tra nguồn", "kiem tra nguon", "căn cứ", "can cu", "xác minh", "xac minh"], reason: "Có tín hiệu kiểm tra nguồn/căn cứ.", weight: 40 },
  { templateId: "summary_rewrite", keywords: ["tóm tắt", "tom tat", "viết lại", "viet lai", "rút gọn", "rut gon"], reason: "Có tín hiệu tóm tắt hoặc viết lại.", weight: 38 },
  { templateId: "website_style_polish", keywords: ["làm mượt", "lam muot", "chỉnh văn", "chinh van", "phong cách website", "phong cach website"], reason: "Có tín hiệu chỉnh văn phong website.", weight: 34 },
];

const DOCUMENT_KIND_TEMPLATE_HINTS: Record<string, string[]> = {
  [normalizeTemplateText("website_article")]: ["website_article_basic"],
  [normalizeTemplateText("news")]: ["news_article_basic"],
  [normalizeTemplateText("newsletter")]: ["internal_newsletter"],
  [normalizeTemplateText("press_release")]: ["formal_press_article"],
  [normalizeTemplateText("administrative_report")]: ["official_report_basic"],
  [normalizeTemplateText("kpi_data_report")]: ["kpi_data_report"],
  [normalizeTemplateText("official_letter")]: ["official_dispatch_basic"],
  [normalizeTemplateText("plan")]: ["work_plan"],
  [normalizeTemplateText("meeting_minutes")]: ["meeting_minutes"],
  [normalizeTemplateText("announcement")]: ["notice_basic"],
  [normalizeTemplateText("briefing_note")]: ["summary_sheet"],
  [normalizeTemplateText("summary_note")]: ["summary_sheet"],
};

const buildSearchText = (input: EditorialTemplateMatchInput): string =>
  [input.userBrief, input.documentKind, input.sourceSummary].filter(Boolean).join(" ");

const scoreTemplate = (
  template: EditorialTemplate,
  input: EditorialTemplateMatchInput,
  searchText: string,
): Omit<EditorialTemplateMatchResult, "missingInputs"> => {
  let score = Math.max(0, Math.round(template.priority / 10));
  const reasons: string[] = [];

  for (const rule of TEMPLATE_KEYWORD_RULES) {
    if (rule.templateId === template.id && hasAnyKeyword(searchText, rule.keywords)) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  const normalizedText = normalizeTemplateText(searchText);
  const matchingTags = template.tags.filter((tag) => normalizedText.includes(normalizeTemplateText(tag)));
  if (matchingTags.length > 0) {
    score += Math.min(18, matchingTags.length * 6);
    reasons.push(`Khớp tag: ${matchingTags.join(", ")}.`);
  }

  if (input.documentKind) {
    const hintedTemplateIds = DOCUMENT_KIND_TEMPLATE_HINTS[normalizeTemplateText(input.documentKind)] ?? [];
    if (hintedTemplateIds.includes(template.id)) {
      score += 24;
      reasons.push(`Khớp loại tài liệu: ${input.documentKind}.`);
    }
  }

  if (input.targetGroup === template.group) {
    score += 16;
    reasons.push(`Nằm trong nhóm mục tiêu: ${template.group}.`);
  }

  if (input.targetGroup && input.targetGroup !== template.group) {
    score -= 20;
  }

  if (reasons.length === 0) {
    reasons.push("Xếp hạng dự phòng theo priority của registry.");
  }

  return { templateId: template.id, score: Math.max(0, score), reasons };
};

export const matchEditorialTemplates = (input: EditorialTemplateMatchInput): EditorialTemplateMatchResult[] => {
  const searchText = buildSearchText(input);
  const candidateTemplates = getEditorialTemplates().filter((template) => !input.targetGroup || template.group === input.targetGroup);

  return candidateTemplates
    .map((template) => ({
      ...scoreTemplate(template, input, searchText),
      missingInputs: resolveMissingInputs(template.requiredInputs, input.providedInputs),
    }))
    .sort((left, right) => right.score - left.score || left.templateId.localeCompare(right.templateId))
    .slice(0, 3);
};
