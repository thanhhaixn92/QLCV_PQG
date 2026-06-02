export type EditorialTemplateGroup =
  | "communication_content"
  | "review_improvement"
  | "administrative_document";

export type EditorialTemplateCategory =
  | "website_article"
  | "news_article"
  | "intro_article"
  | "activity_report"
  | "feature_article"
  | "review"
  | "improvement"
  | "source_check"
  | "rewrite"
  | "official_report"
  | "memo"
  | "official_dispatch"
  | "work_plan"
  | "meeting_minutes"
  | "notice"
  | "summary_sheet"
  | "data_report"
  | "press_release"
  | "newsletter";

export type EditorialLayoutBlockType =
  | "title"
  | "subtitle"
  | "metadata"
  | "lead"
  | "paragraph"
  | "heading"
  | "section"
  | "list"
  | "table"
  | "figure_placeholder"
  | "quote"
  | "checklist"
  | "review_note"
  | "legal_basis"
  | "recipients"
  | "signature"
  | "source_note";

export interface EditorialTemplateInputSpec {
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
}

export interface EditorialLayoutBlock {
  id: string;
  type: EditorialLayoutBlockType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  contentHint?: string;
  minItems?: number;
  maxItems?: number;
}

export interface EditorialTemplateFormatProfile {
  paper?: "A4";
  fontFamily?: string;
  bodyFontSize?: number;
  tableFontSize?: number;
  noteFontSize?: number;
  bodyLineHeight?: number;
  tableLineHeight?: number;
  noteItalic?: boolean;
  tableHeaderBold?: boolean;
  tableBorder?: "black" | "gray" | "none";
  tableBackground?: "white" | "transparent";
  tableCaptionPosition?: "above" | "below";
  figureCaptionPosition?: "above" | "below";
  firstLineIndent?: string;
  paragraphSpacingBefore?: string;
  paragraphSpacingAfter?: string;
  margins?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  notes?: string[];
}

export interface EditorialTemplateMiniPreviewBlock {
  label: string;
  hint?: string;
}

export interface EditorialTemplate {
  id: string;
  name: string;
  group: EditorialTemplateGroup;
  category: EditorialTemplateCategory;
  description: string;
  useCases: string[];
  requiredInputs: EditorialTemplateInputSpec[];
  optionalInputs: EditorialTemplateInputSpec[];
  layoutBlocks: EditorialLayoutBlock[];
  miniPreviewBlocks?: EditorialTemplateMiniPreviewBlock[];
  preflightHints: string[];
  formatProfile?: EditorialTemplateFormatProfile;
  tags: string[];
  priority: number;
  isOfficialStyleSupported: boolean;
}

export interface EditorialTemplateMatchInput {
  userBrief: string;
  documentKind?: string;
  sourceSummary?: string;
  targetGroup?: EditorialTemplateGroup;
  providedInputs?: Record<string, string | undefined>;
}

export interface EditorialTemplateMatchResult {
  templateId: string;
  score: number;
  reasons: string[];
  missingInputs: string[];
}

export interface EditorialTemplateDraftInput {
  templateId?: string;
  userBrief: string;
  documentKind?: string;
  sourceSummary?: string;
  targetGroup?: EditorialTemplateGroup;
  providedInputs?: Record<string, string | undefined>;
}

export interface EditorialTemplateDraftBlock {
  id: string;
  templateBlockId: string;
  type: EditorialLayoutBlockType;
  label: string;
  placeholder?: string;
  content?: string;
  contentHint?: string;
  required: boolean;
  status: "provided" | "placeholder" | "empty";
}

export interface EditorialTemplateDraft {
  templateId: string;
  templateName: string;
  group: EditorialTemplateGroup;
  category: EditorialTemplateCategory;
  formatProfile?: EditorialTemplateFormatProfile;
  missingInputs: string[];
  preflightHints: string[];
  blocks: EditorialTemplateDraftBlock[];
}
