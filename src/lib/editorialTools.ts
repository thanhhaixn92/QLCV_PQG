import { TaskType, OutputFormat } from "../types";
import { EditorialDocumentKind } from "../types/editorial";

export type EditorialToolId =
  | "draft_new"
  | "edit_formal"
  | "edit_shorten"
  | "edit_political"
  | "create_titles"
  | "review_content"
  | "summary_card"
  | "summary_doc";

export type EditorialToolGroup =
  | "draft"
  | "edit"
  | "review"
  | "summary";

export interface EditorialToolConfig {
  id: EditorialToolId;
  group: EditorialToolGroup;
  label: string;
  description: string;
  taskType: TaskType;
  outputFormat: OutputFormat;
  requiresDocumentKind?: boolean;
  defaultDocumentKind?: EditorialDocumentKind;
  inputLabel: string;
  inputPlaceholder: string;
  resultLabel: string;
  allowImageTools: boolean;
  allowWordExport: boolean;
  allowPdfExport: boolean;
}

export const EDITORIAL_TOOLS: EditorialToolConfig[] = [
  {
    id: "draft_new",
    group: "draft",
    label: "Soạn mới văn bản",
    description: "Viết mới bài viết, tin tức, công văn, báo cáo, kế hoạch...",
    taskType: "WRITE_NEW",
    outputFormat: "ARTICLE",
    requiresDocumentKind: true,
    defaultDocumentKind: "website_article",
    inputLabel: "Thông tin cần đưa vào văn bản",
    inputPlaceholder: "Nhập bối cảnh, sự kiện, số liệu, yêu cầu, đối tượng nhận hoặc tài liệu nguồn...",
    resultLabel: "Bản thảo văn bản",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
  {
    id: "edit_formal",
    group: "edit",
    label: "Chuẩn hóa văn phong",
    description: "Sửa câu chữ, mạch văn, thuật ngữ, sắc thái hành chính.",
    taskType: "REVIEW",
    outputFormat: "ARTICLE",
    inputLabel: "Văn bản cần biên tập",
    inputPlaceholder: "Dán văn bản cần chuẩn hóa văn phong...",
    resultLabel: "Bản biên tập",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
  {
    id: "edit_shorten",
    group: "edit",
    label: "Rút gọn nội dung",
    description: "Cô đọng nội dung nhưng giữ ý chính.",
    taskType: "RESIZE",
    outputFormat: "ARTICLE",
    inputLabel: "Văn bản cần rút gọn",
    inputPlaceholder: "Dán nội dung cần rút gọn, có thể ghi rõ độ dài mong muốn...",
    resultLabel: "Bản rút gọn",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
  {
    id: "edit_political",
    group: "edit",
    label: "Nâng cấp lập luận",
    description: "Làm sâu sắc lập luận, tăng sắc thái trang trọng, thuyết phục.",
    taskType: "EDITORIAL_POLITICAL",
    outputFormat: "ARTICLE",
    inputLabel: "Văn bản cần nâng cấp",
    inputPlaceholder: "Dán đoạn/bài cần tăng tính chính luận, hành chính, thuyết phục...",
    resultLabel: "Bản nâng cấp",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
  {
    id: "create_titles",
    group: "edit",
    label: "Gợi ý tiêu đề & sapo",
    description: "Gợi ý tiêu đề, sapo, mô tả ngắn cho bài viết.",
    taskType: "CREATE_TITLES",
    outputFormat: "ARTICLE",
    inputLabel: "Nội dung nền",
    inputPlaceholder: "Dán nội dung chính hoặc mô tả bài viết cần đặt tiêu đề...",
    resultLabel: "Tiêu đề & sapo gợi ý",
    allowImageTools: false,
    allowWordExport: false,
    allowPdfExport: false,
  },
  {
    id: "review_content",
    group: "review",
    label: "Kiểm tra chất lượng văn bản",
    description: "Kiểm tra trùng lặp, thiếu ý, lỗi chính tả, cấu trúc và rủi ro dữ kiện.",
    taskType: "CONTENT_REVIEW",
    outputFormat: "JSON_CONTENT_REVIEW",
    inputLabel: "Nội dung cần đánh giá",
    inputPlaceholder: "Dán văn bản cần AI phân tích, phản biện và đề xuất sửa...",
    resultLabel: "Báo cáo rà soát",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
  {
    id: "summary_card",
    group: "summary",
    label: "Phiếu tóm tắt",
    description: "Tóm tắt nhanh phục vụ lãnh đạo xử lý.",
    taskType: "SUMMARY_CARD",
    outputFormat: "SUMMARY_CARD",
    inputLabel: "Nội dung/tài liệu cần tóm tắt",
    inputPlaceholder: "Dán nội dung hoặc chọn tài liệu nguồn để tạo phiếu tóm tắt...",
    resultLabel: "Phiếu tóm tắt",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
  {
    id: "summary_doc",
    group: "summary",
    label: "Tài liệu tổng hợp",
    description: "Tổng hợp nhiều nguồn thành văn bản mạch lạc.",
    taskType: "SUMMARY_DOC",
    outputFormat: "SUMMARY_DOC",
    inputLabel: "Yêu cầu tổng hợp",
    inputPlaceholder: "Nêu chủ đề tổng hợp, phạm vi, yêu cầu bố cục và chọn tài liệu nguồn...",
    resultLabel: "Tài liệu tổng hợp",
    allowImageTools: false,
    allowWordExport: true,
    allowPdfExport: true,
  },
];

export function getEditorialTool(id: EditorialToolId): EditorialToolConfig {
  return EDITORIAL_TOOLS.find((tool) => tool.id === id) || EDITORIAL_TOOLS[0];
}
