import type {
  DocumentStandardProfile,
  DocumentStandardProfileId,
  DocumentStandardProfileMetadata,
} from "../../types/editorialDocumentStandards";

const A4_EDITORIAL_METADATA: DocumentStandardProfileMetadata = {
  paper: "A4",
  bodyFontSize: 14,
  tableFontSize: 13,
  noteFontSize: 12,
  bodyLineHeight: 1.5,
  tableLineHeight: 1.15,
  noteItalic: true,
  tableHeaderBold: true,
  tableBorder: "black",
  tableBackground: "white",
  tableCaptionPosition: "above",
  figureCaptionPosition: "below",
  marginHints: {
    topMm: 20,
    rightMm: 20,
    bottomMm: 20,
    leftMm: 25,
  },
  firstLineIndentMm: 10,
  paragraphSpacingBeforePt: 0,
  paragraphSpacingAfterPt: 6,
};

const ADMINISTRATIVE_METADATA: DocumentStandardProfileMetadata = {
  ...A4_EDITORIAL_METADATA,
  fontFamily: "Times New Roman",
  marginHints: {
    topMm: 20,
    rightMm: 15,
    bottomMm: 20,
    leftMm: 30,
  },
  firstLineIndentMm: 12.7,
  paragraphSpacingBeforePt: 0,
  paragraphSpacingAfterPt: 0,
};

export const DOCUMENT_STANDARD_PROFILES: Record<DocumentStandardProfileId, DocumentStandardProfile> = {
  website_article: {
    id: "website_article",
    label: "Bài viết website",
    description: "Chuẩn kiểm tra nội dung bài viết website có tiêu đề, sapo, thân bài và kết luận khi cần.",
    metadata: {
      ...A4_EDITORIAL_METADATA,
      marginHints: {
        topMm: 18,
        rightMm: 18,
        bottomMm: 18,
        leftMm: 18,
      },
      firstLineIndentMm: 0,
      paragraphSpacingAfterPt: 8,
    },
    requiresSapo: true,
  },
  news_article: {
    id: "news_article",
    label: "Tin bài",
    description: "Chuẩn kiểm tra tin/bài ngắn theo cấu trúc tiêu đề, sapo và thông tin nguồn.",
    metadata: {
      ...A4_EDITORIAL_METADATA,
      firstLineIndentMm: 0,
      paragraphSpacingAfterPt: 8,
    },
    requiresSapo: true,
  },
  company_intro_article: {
    id: "company_intro_article",
    label: "Bài giới thiệu công ty",
    description: "Chuẩn kiểm tra bài giới thiệu công ty, yêu cầu mở bài rõ và đoạn kết/định vị thông điệp.",
    metadata: {
      ...A4_EDITORIAL_METADATA,
      firstLineIndentMm: 0,
      paragraphSpacingAfterPt: 8,
    },
    requiresSapo: true,
    requiresConclusion: true,
  },
  administrative_report: {
    id: "administrative_report",
    label: "Báo cáo hành chính",
    description: "Chuẩn kiểm tra thể thức báo cáo hành chính A4, Times New Roman và phần ký ban hành.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
    requiresDocumentNumber: true,
    requiresSignatureBlock: true,
    requiresConclusion: true,
    requiresResultsSection: true,
    requiresAssessmentSection: true,
    requiresRecommendationSection: true,
  },
  kpi_data_report: {
    id: "kpi_data_report",
    label: "Báo cáo số liệu/KPI",
    description: "Chuẩn kiểm tra báo cáo số liệu/KPI có bảng chỉ tiêu, nguồn số liệu, đánh giá và kiến nghị.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
    requiresDocumentNumber: true,
    requiresSignatureBlock: true,
    requiresResultsSection: true,
    requiresAssessmentSection: true,
    requiresDataSection: true,
    requiresRecommendationSection: true,
  },
  official_dispatch: {
    id: "official_dispatch",
    label: "Công văn",
    description: "Chuẩn kiểm tra công văn có quốc hiệu, tiêu ngữ, số ký hiệu, nơi nhận và chữ ký.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
    requiresDocumentNumber: true,
    requiresRecipientLine: true,
    requiresSignatureBlock: true,
  },
  meeting_minutes: {
    id: "meeting_minutes",
    label: "Biên bản họp",
    description: "Chuẩn kiểm tra biên bản họp với bố cục hành chính và nội dung kết luận cuộc họp.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
    requiresSignatureBlock: true,
    requiresConclusion: true,
  },
  work_plan: {
    id: "work_plan",
    label: "Kế hoạch công tác",
    description: "Chuẩn kiểm tra kế hoạch công tác A4 có bảng nhiệm vụ rõ nguồn, mốc thời gian và phần tổ chức thực hiện.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
    requiresSignatureBlock: true,
  },
  notice_basic: {
    id: "notice_basic",
    label: "Thông báo cơ bản",
    description: "Chuẩn kiểm tra thông báo ngắn, rõ đối tượng, thời gian và phần ký ban hành nếu dùng thể thức hành chính.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
    requiresSignatureBlock: true,
  },
  summary_sheet: {
    id: "summary_sheet",
    label: "Phiếu tổng hợp",
    description: "Chuẩn kiểm tra phiếu tổng hợp có bảng/số liệu, ghi chú nguồn và định dạng A4.",
    metadata: ADMINISTRATIVE_METADATA,
    requiresAdministrativeHeader: true,
  },
};

export const DEFAULT_DOCUMENT_STANDARD_PROFILE_ID: DocumentStandardProfileId = "website_article";

export function getDocumentStandardProfile(profileId?: string): DocumentStandardProfile {
  const idToUse = (profileId && DOCUMENT_STANDARD_PROFILES[profileId as DocumentStandardProfileId]) 
    ? (profileId as DocumentStandardProfileId) 
    : DEFAULT_DOCUMENT_STANDARD_PROFILE_ID;
  return DOCUMENT_STANDARD_PROFILES[idToUse];
}

export const DOCUMENT_STANDARD_PROFILE_IDS = Object.keys(
  DOCUMENT_STANDARD_PROFILES,
) as DocumentStandardProfileId[];
