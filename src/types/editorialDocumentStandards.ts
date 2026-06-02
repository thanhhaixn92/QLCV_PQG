export type DocumentStandardProfileId =
  | "website_article"
  | "news_article"
  | "company_intro_article"
  | "administrative_report"
  | "kpi_data_report"
  | "official_dispatch"
  | "meeting_minutes"
  | "work_plan"
  | "notice_basic"
  | "summary_sheet";

export type DocumentStandardRuleCategory =
  | "content_structure"
  | "language_quality"
  | "administrative_format"
  | "table_format"
  | "figure_format"
  | "source_evidence"
  | "export_safety";

export type DocumentPreflightSeverity = "blocker" | "warning" | "info";

export type DocumentCaptionPosition = "above" | "below" | "unknown";

export interface DocumentStandardSpacingHints {
  beforePt?: number;
  afterPt?: number;
}

export interface DocumentStandardMarginHints {
  topMm?: number;
  rightMm?: number;
  bottomMm?: number;
  leftMm?: number;
}

export interface DocumentStandardProfileMetadata {
  paper?: "A4";
  fontFamily?: string;
  bodyFontSize?: number;
  tableFontSize?: number;
  noteFontSize?: number;
  bodyLineHeight?: number;
  tableLineHeight?: number;
  noteItalic?: boolean;
  tableHeaderBold?: boolean;
  tableBorder?: "black" | "none" | "unknown";
  tableBackground?: "white" | "transparent" | "unknown";
  tableCaptionPosition?: DocumentCaptionPosition;
  figureCaptionPosition?: DocumentCaptionPosition;
  marginHints?: DocumentStandardMarginHints;
  firstLineIndentMm?: number;
  paragraphSpacingBeforePt?: number;
  paragraphSpacingAfterPt?: number;
}

export interface DocumentStandardProfile {
  id: DocumentStandardProfileId;
  label: string;
  description: string;
  metadata: DocumentStandardProfileMetadata;
  requiresSapo?: boolean;
  requiresConclusion?: boolean;
  requiresAdministrativeHeader?: boolean;
  requiresDocumentNumber?: boolean;
  requiresRecipientLine?: boolean;
  requiresSignatureBlock?: boolean;
  requiresResultsSection?: boolean;
  requiresAssessmentSection?: boolean;
  requiresDataSection?: boolean;
  requiresRecommendationSection?: boolean;
}

export interface DocumentPreflightParagraph {
  id?: string;
  text: string;
  role?: "title" | "sapo" | "heading" | "body" | "conclusion" | "caption" | "note";
  level?: number;
}

export interface DocumentPreflightTable {
  id?: string;
  caption?: string;
  captionPosition?: DocumentCaptionPosition;
  headers?: string[];
  rows?: string[][];
  note?: string;
  source?: string;
  isDataLike?: boolean;
  headerBold?: boolean;
  fontSize?: number;
  lineHeight?: number;
  borderColor?: string;
  backgroundColor?: string;
}

export interface DocumentPreflightFigure {
  id?: string;
  caption?: string;
  captionPosition?: DocumentCaptionPosition;
  source?: string;
  note?: string;
  placeholderText?: string;
  alt?: string;
}

export interface DocumentPreflightStructuredInput {
  profileId?: DocumentStandardProfileId;
  title?: string;
  sapo?: string;
  conclusion?: string;
  text?: string;
  paragraphs?: DocumentPreflightParagraph[];
  headings?: DocumentPreflightParagraph[];
  tables?: DocumentPreflightTable[];
  figures?: DocumentPreflightFigure[];
  metadata?: {
    organizationName?: string;
    hasNationalHeader?: boolean;
    hasMotto?: boolean;
    documentNumberOrSymbol?: string;
    placeDateLine?: string;
    recipientLine?: string;
    signatureBlock?: string;
  };
}

export type DocumentPreflightInput = string | DocumentPreflightStructuredInput;

export interface DocumentPreflightIssue {
  id: string;
  severity: DocumentPreflightSeverity;
  category: DocumentStandardRuleCategory;
  message: string;
  suggestion: string;
  targetHint: string;
  ruleId: string;
  profileId: DocumentStandardProfileId;
}

export interface DocumentPreflightContext {
  profile: DocumentStandardProfile;
  profileId: DocumentStandardProfileId;
  normalizedText: string;
  lines: string[];
  paragraphs: DocumentPreflightParagraph[];
  headings: DocumentPreflightParagraph[];
  tables: DocumentPreflightTable[];
  figures: DocumentPreflightFigure[];
  metadata: NonNullable<DocumentPreflightStructuredInput["metadata"]>;
  title?: string;
  sapo?: string;
  conclusion?: string;
}

export interface DocumentStandardRule {
  id: string;
  category: DocumentStandardRuleCategory;
  defaultSeverity: DocumentPreflightSeverity;
  description: string;
  run: (context: DocumentPreflightContext) => DocumentPreflightIssue[];
}

export interface DocumentPreflightRunnerOptions {
  profileId?: DocumentStandardProfileId;
  includeInfo?: boolean;
}
