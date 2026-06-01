import { DocumentSource, LibraryCollection } from "../../types";

export const DEFAULT_LIBRARY_COLLECTIONS: LibraryCollection[] = [
  {
    id: "lib-personal",
    name: "Cá nhân",
    type: "personal",
    icon: "User",
    color: "blue",
    ownerId: "default",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "lib-work",
    name: "Công việc",
    type: "work",
    icon: "Briefcase",
    color: "indigo",
    ownerId: "default",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "lib-editorial",
    name: "Viết báo / Biên tập",
    type: "editorial",
    icon: "Edit3",
    color: "emerald",
    ownerId: "default",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "lib-shared",
    name: "Dùng chung",
    type: "shared",
    icon: "Users",
    color: "purple",
    ownerId: "default",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "lib-drive",
    name: "Google Drive",
    type: "drive",
    icon: "Database",
    color: "amber",
    ownerId: "default",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  van_ban_chi_dao: "Văn bản chỉ đạo",
  quy_dinh_phap_ly: "Quy định pháp lý",
  bao_cao: "Báo cáo",
  ke_hoach: "Kế hoạch",
  hop_dong: "Hợp đồng",
  tai_lieu_ky_thuat: "Tài liệu kỹ thuật",
  tai_lieu_an_toan: "Tài liệu an toàn",
  tin_bai_truyen_thong: "Tin bài truyền thông",
  tai_chinh_ke_toan: "Tài chính - Kế toán",
  nhan_su_lao_dong: "Nhân sự - Lao động",
  khac: "Khác",
};

export const matchesSearch = (
  d: DocumentSource,
  query: string,
  filters?: { kind?: string; status?: string },
) => {
  if (filters) {
    if (
      filters.kind &&
      filters.kind !== "all" &&
      d.documentKind !== filters.kind
    )
      return false;
    if (
      filters.status &&
      filters.status !== "all" &&
      d.contentStatus !== filters.status
    )
      return false;
  }

  const q = query.toLowerCase().trim();
  if (!q) return true;

  const summary: any = d.summary || {};
  const mainPoints = Array.isArray(summary.mainPoints)
    ? summary.mainPoints.join(" ")
    : "";
  const keyPoints = Array.isArray(summary.keyPoints)
    ? summary.keyPoints.join(" ")
    : "";
  const keywords = Array.isArray(summary.keywords)
    ? summary.keywords.join(" ")
    : "";
  const entities = summary.entities ? JSON.stringify(summary.entities) : "";
  const metadataDesc = d.metadata?.description || "";

  const searchText = [
    d.name,
    d.content,
    summary.short || "",
    mainPoints,
    keyPoints,
    keywords,
    entities,
    d.documentKind,
    DOCUMENT_KIND_LABELS[d.documentKind || ""] || "",
    d.taskCategoryCode,
    metadataDesc,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchText.includes(q);
};

export const TYPE_MAPPING: Record<string, string> = {
  drive: "Google Drive",
  pdf: "PDF",
  word: "Bản Word",
  excel: "Bảng tính",
  text: "Văn bản thô",
  link: "Liên kết Web",
};

export const SOURCE_TYPE_MAPPING: Record<string, string> = {
  upload: "Tải lên",
  drive: "Drive",
  text: "Ghi chú",
  web_extraction: "Trích xuất Web",
};

export function getDocTypeLabel(type?: string) {
  if (!type) return "Văn bản";
  return TYPE_MAPPING[type.toLowerCase()] || type.toUpperCase();
}

export function getSourceTypeLabel(sourceType?: string) {
  if (!sourceType) return "Nội bộ";
  return (
    SOURCE_TYPE_MAPPING[sourceType.toLowerCase()] || sourceType.toUpperCase()
  );
}

export function getDocumentPreviewUrl(d: DocumentSource): string {
  return (
    d.metadata?.previewUrl ||
    d.metadata?.googleViewerUrl ||
    d.driveWebViewLink?.replace("/view", "/preview") ||
    d.driveWebViewLink ||
    d.metadata?.driveWebViewLink ||
    d.metadata?.openUrl ||
    d.metadata?.url ||
    ""
  );
}

export function getDocumentOpenUrl(d: DocumentSource): string {
  return (
    d.driveWebViewLink ||
    d.metadata?.driveWebViewLink ||
    d.metadata?.openUrl ||
    d.metadata?.url ||
    ""
  );
}

export function cleanDisplayTitle(value?: string): string {
  if (!value) return "Bài viết không tiêu đề";
  return (
    value
      .replace(/^#{1,6}\s*/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || "Bài viết không tiêu đề"
  );
}

export const DIRTY_EDITORIAL_TITLE_PATTERNS = [
  /^yêu cầu\s*\/\s*bối cảnh/i,
  /^thông tin cần đưa vào văn bản/i,
  /^nội dung chính cần có/i,
  /^thời gian\s*&\s*địa điểm/i,
  /^thành phần\s*\/\s*nhân vật/i,
  /^đối tượng tiếp nhận/i,
  /^nguồn tư liệu/i,
  /^yêu cầu\s*[:：]/i,
  /^bối cảnh\s*[:：]/i,
];

export function isDirtyEditorialTitle(value?: string): boolean {
  const title = cleanDisplayTitle(value).trim();
  return !title || title === "Bài viết không tiêu đề" || DIRTY_EDITORIAL_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function firstMeaningfulEditorialLine(value?: string): string {
  if (!value) return "";
  const lines = value
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\r?\n/)
    .map((line) => cleanDisplayTitle(line.replace(/^[-*•\d.)\s]+/, "")))
    .map((line) => line.replace(/[:：]\s*$/, "").trim())
    .filter((line) => line && !isDirtyEditorialTitle(line) && line.length > 2);
  return lines[0] || "";
}

export function deriveEditorialSessionTitle(options: {
  output?: string;
  currentTitle?: string;
  latestPreview?: string;
  input?: string;
}): string {
  const outputTitle = firstMeaningfulEditorialLine(options.output);
  if (outputTitle) return outputTitle;

  const currentTitle = cleanDisplayTitle(options.currentTitle);
  if (!isDirtyEditorialTitle(currentTitle)) return currentTitle;

  const previewTitle = firstMeaningfulEditorialLine(options.latestPreview);
  if (previewTitle) return previewTitle;

  const inputTitle = firstMeaningfulEditorialLine(options.input);
  if (inputTitle) return inputTitle;

  return "Bài viết chưa đặt tiêu đề";
}
