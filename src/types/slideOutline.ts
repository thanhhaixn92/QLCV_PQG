export type SlideOutlineStyle =
  | "administrative"
  | "political_report"
  | "professional_briefing"
  | "training"
  | "corporate_communication";

export type SlideAudience =
  | "leaders"
  | "internal_staff"
  | "conference"
  | "contest_judges"
  | "training_class"
  | "public";

export interface SlideOutlineInput {
  sourceText: string;
  sourceDocumentIds?: string[];
  sources?: any[];
  titleHint?: string;
  slideCount?: number;
  durationMinutes?: number;
  audience: SlideAudience;
  style: SlideOutlineStyle;
  language?: "vi" | "en";
  includeSpeakerNotes?: boolean;
  includeVisualSuggestions?: boolean;
  includeTiming?: boolean;
}

export type SlideLayoutType = 
    | "title"
    | "agenda"
    | "section"
    | "content"
    | "two_columns"
    | "quote"
    | "chart_placeholder"
    | "timeline"
    | "comparison"
    | "table"
    | "closing";

export type SlideDeckTheme =
  | "vms_enterprise"
  | "navy_clean"
  | "technical_report"
  | "training_light"
  | "conference_formal";

export interface SlideDeckExportOptions {
  theme: SlideDeckTheme;
  includeSpeakerNotes: boolean;
  includeVisualSuggestions: boolean;
  includeSourceSummary: boolean;
  includeCautionNotes: boolean;
  format: "pptx" | "word_outline" | "pdf_outline" | "gamma_markdown";
}

export type SlideVisualType = 
    | "none"
    | "image"
    | "chart"
    | "diagram"
    | "table"
    | "timeline"
    | "map"
    | "icon_list";

export interface SlideOutlineItem {
  id?: string;
  slideNumber: number;
  title: string;
  objective?: string;
  keyMessage?: string;
  bullets: string[];
  speakerNotes?: string;
  visualSuggestion?: string;
  dataOrEvidence?: string[];
  estimatedTimeSeconds?: number;
  cautionNotes?: string[];
  layoutType?: SlideLayoutType;
  visualType?: SlideVisualType;
  status?: "draft" | "reviewed" | "needs_check";
}

export interface SlideOutlineResult {
  id?: string;
  title: string;
  subtitle?: string;
  audience: SlideAudience;
  style: SlideOutlineStyle;
  slideCount: number;
  durationMinutes?: number;
  mainMessage: string;
  openingSuggestion?: string;
  closingSuggestion?: string;
  slides: SlideOutlineItem[];
  sourceSummary?: string;
  missingInfoWarnings?: string[];
  handout?: string;
  expectedQA?: { question: string; answer: string }[];
  theme?: SlideDeckTheme;
  version?: number;
  createdAt?: number;
  updatedAt?: number;
}
