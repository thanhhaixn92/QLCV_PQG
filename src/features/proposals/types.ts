import { WorkTaskStatus, WorkTaskPriority } from "../../types";

export type ProposalStatus = 'draft' | 'reviewing' | 'completed' | 'archived';

/**
 * Proposal document (Parent)
 * Contains light metadata as requested.
 */
export interface Proposal {
  id: string;
  name: string;
  description: string;
  category: string;
  department?: string;
  dueDate?: string;
  progressPercent?: number;
  status: ProposalStatus;
  ownerId: string;
  collaborators?: string[];
  currentVersionId?: string;
  sourceCount: number;
  draftCount: number;
  taskCount: number;
  createdAt: number;
  updatedAt: number;
}

export type ProposalSourceType = 'legal' | 'data' | 'report' | 'draft' | 'other';

/**
 * Proposal Sources (Subcollection: sources)
 */
export interface ProposalSource {
  id: string;
  proposalId: string;
  name: string;
  type: 'word' | 'pdf' | 'excel' | 'link' | 'text' | 'image';
  sourceType: ProposalSourceType;
  documentId?: string; // Reference to global library document
  content?: string; 
  storagePath?: string;
  downloadUrl?: string;
  tags?: string[];
  linkedOutlineItemIds?: string[];
  summary?: string;
  order: number;
  createdAt: number;
}

/**
 * Proposal Outline (Subcollection: outlineItems)
 */
export interface ProposalOutlineItem {
  id: string;
  proposalId: string;
  templateItemId?: string;
  parentTemplateId?: string;
  parentId?: string;
  code?: string;
  title: string;
  level: number;
  order: number;
  itemType?: "section" | "content" | "appendix" | "table" | "attachment";
  isContainer?: boolean;
  canHaveDraft?: boolean;
  countInProgress?: boolean;
  guidance?: string;
  rationale?: string; // Keep if currently used for AI rationale
  requiredSources?: string[];
  requiredData?: string[];
  contentId?: string; 
  status: 'not_started' | 'writing' | 'needs_data' | 'needs_review' | 'completed';
  createdAt: number;
  updatedAt?: number;
}

/**
 * Proposal Drafts (Subcollection: drafts)
 * Contains the long content as requested.
 */
export interface ProposalDraft {
  id: string;
  proposalId: string;
  outlineItemId?: string;
  outlineCode?: string;
  title?: string;
  content: string; 
  status: 'empty' | 'drafting' | 'needs_data' | 'needs_review' | 'completed';
  wordCount: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  updatedBy?: string;
}

/**
 * Proposal Tasks (Subcollection: tasks)
 * Specific tasks for the proposal lifecycle.
 */
export interface ProposalTask {
  id: string;
  proposalId: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  status: WorkTaskStatus;
  priority: WorkTaskPriority;
  sourceType?: 'data_requirement' | 'checklist_item' | 'draft' | 'source' | 'other';
  sourceId?: string;
  sourceLabel?: string;
  linkedOutlineCodes?: string[];
  responsibleUnit?: string;
  progressNote?: string;
  order: number;
  createdAt: number;
  updatedAt?: number;
}

/**
 * Proposal Data Tables (Subcollection: dataTables)
 * For structured data within the proposal.
 */
export interface ProposalDataTable {
  id: string;
  proposalId: string;
  title: string;
  headers: string[];
  rows: any[][];
  description?: string;
  order: number;
  createdAt: number;
}

/**
 * Proposal Exports (Subcollection: exports)
 */
export type ProposalExportStatus = 'previewed' | 'downloaded' | 'failed';

export interface ProposalExport {
  id: string;
  proposalId: string;
  exportType: 'full_draft' | 'outline' | 'data_requirements' | 'checklist' | 'progress_report';
  fileType: 'docx' | 'pdf';
  title: string;
  fileName: string;
  status: ProposalExportStatus;
  exportUrl?: string;
  storagePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProposalExportPreviewContent {
  title: string;
  projectName: string;
  exportType: 'full_draft' | 'outline' | 'data_requirements' | 'checklist' | 'progress_report';
  sections: {
    id?: string;
    title: string;
    level: number;
    code?: string;
    type: 'section' | 'content' | 'appendix';
    content?: string;
    isMissing?: boolean;
    metadata?: any;
  }[];
  summary?: {
    totalItems: number;
    completedItems: number;
    missingItems: number;
    completionRate: number;
  };
  appendices?: {
    title: string;
    content: any[];
    type: 'sources' | 'checklist' | 'data_requirements';
  }[];
}

/**
 * Proposal Activity Logs (Subcollection: activityLogs)
 */
export interface ProposalActivityLog {
  id: string;
  proposalId: string;
  userId: string;
  action: string;
  summary: string;
  metadata?: any;
  createdAt: number;
}

/**
 * Proposal Checklist Items (Subcollection: checklistItems)
 */
export interface ProposalChecklistItem {
  id: string;
  proposalId: string;
  outlineItemId?: string;
  linkedOutlineCodes?: string[];
  linkedDataRequirementIds?: string[];
  linkedDraftId?: string;
  group: string;
  title: string;
  description?: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  priority?: 'very_high' | 'high' | 'medium' | 'low'; // Keep for compat if needed, but severity is primary now
  status: 'pass' | 'fail' | 'needs_review' | 'waived' | 'blocker';
  evidenceIds?: string[];
  evidenceNote?: string;
  ownerUnit?: string;
  taskId?: string;
  taskStatus?: WorkTaskStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * Proposal Data Requirements (Subcollection: dataRequirements)
 */
export interface ProposalDataRequirement {
  id: string;
  proposalId: string;
  group: string;
  title: string;
  purpose: string;
  suggestedSource?: string;
  responsibleUnit?: string;
  periodRequired?: string;
  breakdownRequired?: string;
  status: 'requested' | 'collected' | 'verified' | 'missing' | 'needs_verification' | 'needs_update' | 'not_applicable';
  statusDetail?: 'available' | 'partial' | 'missing' | 'needs_verification' | 'needs_update';
  valueText?: string;
  verificationNote?: string;
  priority?: 'very_high' | 'high' | 'medium' | 'low';
  linkedOutlineItemIds?: string[];
  linkedOutlineCodes?: string[];
  evidenceIds?: string[];
  source?: string;
  taskId?: string;
  taskStatus?: WorkTaskStatus;
  createdAt: number;
  updatedAt: number;
}

/**
 * AI Data Analysis Types
 */
export interface DetectedDataPoint {
  group: string;
  title: string;
  valueText: string;
  status: 'available' | 'partial' | 'missing' | 'needs_verification' | 'needs_update';
  priority: 'very_high' | 'high' | 'medium' | 'low';
  purpose: string;
  suggestedSource: string;
  responsibleUnit: string;
  periodRequired: string;
  breakdownRequired: string;
  verificationNote: string;
  linkedOutlineCodes: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface MissingDataPoint {
  group: string;
  title: string;
  reason: string;
  priority: 'very_high' | 'high' | 'medium' | 'low';
  suggestedSource: string;
  responsibleUnit: string;
  linkedOutlineCodes: string[];
}

export interface SuggestedTask {
  title: string;
  assigneeSuggestion: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ProposalDataAnalysisResponse {
  summary: string;
  detectedData: DetectedDataPoint[];
  missingData: MissingDataPoint[];
  risks: string[];
  suggestedTasks: SuggestedTask[];
  conclusion: string;
}

/**
 * Proposal Evidence Links (Subcollection: evidenceLinks)
 */
export interface ProposalEvidenceLink {
  id: string;
  proposalId: string;
  sourceId: string;
  targetType: 'outlineItem' | 'draft' | 'checklistItem' | 'dataRequirement';
  targetId: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * AI Context for Proposal Chat Assistant
 */
export interface ProposalChatContext {
  proposalId: string;
  proposalTitle: string;
  activeTab: string;
  selectedOutlineItemId?: string;
  selectedOutlineItemTitle?: string;
  selectedOutlineItemCode?: string;
  selectedDraftId?: string;
  currentDraftContent?: string;
  selectedSourceIds?: string[];
  checklistCount?: number;
  dataRequirementCount?: number;
}

/**
 * AI Response from Proposal Chat Assistant
 */
export interface ProposalDraftAssistantResponse {
  intent: 'write_draft' | 'improve_draft' | 'review_logic' | 'missing_data' | 'executive_summary' | 'general_answer';
  reply: string;
  draftSuggestion?: {
    title?: string;
    content: string;
    insertionMode: 'replace' | 'append' | 'insert_after_cursor' | 'note_only';
  };
  comments?: string[];
  missingData?: string[];
  suggestedSources?: string[];
  risks?: string[];
  suggestedActions?: {
    type: 'apply_to_draft' | 'append_to_draft' | 'copy' | 'mark_needs_data' | 'create_data_requirement' | 'create_task';
    label: string;
  }[];
}

/**
 * Draft Import from File Types
 */
export interface DraftImportAllocation {
  outlineItemId: string;
  outlineCode: string;
  outlineTitle: string;
  action: 'append' | 'replace' | 'note_only' | 'skip';
  content: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  warnings?: string[];
  sourceExcerpt?: string;
}

export interface UnmappedDraftContent {
  content: string;
  reason: string;
  suggestedAction: 'manual_review' | 'create_new_outline_item' | 'ignore';
}

export interface DraftImportPreviewResponse {
  success: boolean;
  mode: 'current_item' | 'target_section' | 'whole_proposal';
  summary: string;
  targetScope: {
    proposalId: string;
    targetOutlineItemId: string | null;
    targetOutlineCode: string | null;
    targetLabel: string;
  };
  allocations: DraftImportAllocation[];
  unmappedContent: UnmappedDraftContent[];
  missingData: string[];
  risks: string[];
  messageToUser: string;
}
