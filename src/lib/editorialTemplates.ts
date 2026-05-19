import { EditorialDocumentKind } from '../types/editorial';

export const EDITORIAL_KIND_CONFIG: Record<EditorialDocumentKind, {
  label: string;
  description: string;
  requiredFields: string[];
}> = {
  website_article: {
    label: "Bài viết website",
    description: "Dùng cho bài đăng website, truyền thông nội bộ hoặc giới thiệu hoạt động.",
    requiredFields: ["title", "sapo", "sections"],
  },
  news: {
    label: "Tin tức",
    description: "Dùng cho đưa tin sự kiện, hoạt động, thông tin thời sự của đơn vị.",
    requiredFields: ["title", "sapo", "dateline", "sections"],
  },
  press_release: {
    label: "Thông cáo báo chí",
    description: "Dùng cho thông tin chính thức gửi báo chí, đối tác, công chúng.",
    requiredFields: ["title", "dateline", "sections", "sourceNote"],
  },
  administrative_report: {
    label: "Báo cáo",
    description: "Dùng cho báo cáo công việc, báo cáo chuyên đề, báo cáo nội bộ/chính thức.",
    requiredFields: ["title", "sections", "recipients"],
  },
  announcement: {
    label: "Thông báo",
    description: "Dùng để thông tin, triển khai hoặc yêu cầu thực hiện một nội dung cụ thể.",
    requiredFields: ["title", "sections", "recipients"],
  },
  official_letter: {
    label: "Công văn",
    description: "Dùng cho trao đổi, đề nghị, chỉ đạo hoặc báo cáo bằng văn bản.",
    requiredFields: ["title", "recipients", "sections"],
  },
  plan: {
    label: "Kế hoạch",
    description: "Dùng cho phân công nhiệm vụ, tiến độ và tổ chức thực hiện.",
    requiredFields: ["title", "sections", "tasks"],
  },
  meeting_minutes: {
    label: "Biên bản họp",
    description: "Dùng ghi nhận nội dung họp, kết luận và nhiệm vụ được giao.",
    requiredFields: ["title", "sections", "tasks"],
  },
  speech_outline: {
    label: "Đề cương phát biểu",
    description: "Dùng cho bài phát biểu, thuyết trình, báo cáo miệng.",
    requiredFields: ["title", "sections", "conclusion"],
  },
  briefing_note: {
    label: "Phiếu tóm tắt",
    description: "Dùng để tóm tắt nhanh vấn đề phục vụ lãnh đạo xử lý.",
    requiredFields: ["title", "summary", "sections"],
  },
  summary_note: {
    label: "Tài liệu tổng hợp",
    description: "Dùng để tổng hợp nội dung ngắn gọn từ nhiều nguồn.",
    requiredFields: ["title", "summary", "sections"],
  },
  slide_outline: {
    label: "Phác thảo Slide",
    description: "Dùng để phác thảo cấu trúc bài chiếu PowerPoint.",
    requiredFields: ["title"],
  }
};
