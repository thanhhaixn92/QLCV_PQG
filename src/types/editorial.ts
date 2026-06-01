export type EditorialDocumentKind =
  | "website_article"
  | "news"
  | "press_release"
  | "administrative_report"
  | "announcement"
  | "official_letter"
  | "plan"
  | "meeting_minutes"
  | "speech_outline"
  | "briefing_note"
  | "summary_note"
  | "slide_outline";

export type EditorialStatus =
  | "draft"
  | "reviewing"
  | "approved"
  | "published"
  | "archived";

export interface EditorialExportModel {
  kind: EditorialDocumentKind;
  status?: EditorialStatus;

  title: string;
  subtitle?: string;
  dateline?: string;
  sapo?: string;
  summary?: string;

  issuingAgency?: string;
  parentAgency?: string;
  documentNumber?: string;
  documentSymbol?: string;
  placeAndDate?: string;
  recipients?: string[];
  legalBasis?: string[];

  sections: {
    heading?: string;
    level?: number;
    paragraphs: string[];
    bullets?: string[];
    table?: {
      title?: string;
      headers: string[];
      rows: string[][];
      note?: string;
    };
  }[];

  quotes?: {
    text: string;
    speaker?: string;
    title?: string;
  }[];

  tasks?: {
    title: string;
    assignee?: string;
    deadline?: string;
    priority?: "low" | "medium" | "high";
  }[];

  images?: {
    url: string;
    caption: string;
    alt: string;
    source?: string;
  }[];

  sourceDocuments?: {
    id: string;
    name: string;
    type?: string;
    url?: string;
  }[];

  sourceNote?: string;
  author?: string;
  reviewer?: string;
  signerTitle?: string;
  signerName?: string;
  conclusion?: string;

  createdAt?: number;
  updatedAt?: number;
}

export interface EditorialRevision {
  id: string;
  sessionId: string;
  version: number;
  title: string;
  content: string;
  structuredContent?: EditorialExportModel;
  note?: string;
  createdAt: number;
  createdBy?: string;
}

export interface SuggestedTask {
  title: string;
  description?: string;
  sourceSessionId?: string;
  sourceDocumentTitle?: string;
  categoryCode?: string;
  priority?: "low" | "medium" | "high";
  status?: "todo";
  dueDate?: string;
  assignee?: string;
}

export type EditorialWorkspaceMode =
  | "history"
  | "create"
  | "edit"
  | "review"
  | "summarize"
  | "sources";
