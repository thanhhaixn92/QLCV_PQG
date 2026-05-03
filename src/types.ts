
export type TaskType = 'WRITE_NEW' | 'REVIEW' | 'RESIZE' | 'SYNTHESIZE' | 'TASK_BUILDER';

export type ActivityModule =
  | "all"
  | "library"
  | "task"
  | "editorial"
  | "note"
  | "system";

export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "archived"
  | "restored"
  | "status_changed"
  | "synced"
  | "analyzed"
  | "summarized"
  | "linked"
  | "unlinked"
  | "exported"
  | "approved"
  | "sent_for_review"
  | "api_key_tested"
  | "settings_changed";

export interface ActivityLogEntry {
  id: string;
  userId: string;
  module: Exclude<ActivityModule, "all">;
  action: ActivityAction;
  entityType:
    | "document"
    | "task"
    | "editorial_session"
    | "article"
    | "note"
    | "drive_folder"
    | "drive_file"
    | "settings"
    | "system";
  entityId?: string;
  entityTitle?: string;
  title: string;
  summary: string;
  changedFields?: string[];
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  metadata?: {
    source?: "client" | "server" | "ai" | "drive_sync";
    statusFrom?: string;
    statusTo?: string;
    linkedEntityId?: string;
    linkedEntityTitle?: string;
    fileName?: string;
    fileMimeType?: string;
    exportFormat?: "docx" | "pdf" | "html" | "markdown";
    errorCode?: string;
    errorMessage?: string;
  };
  actor?: {
    uid?: string;
    displayName?: string;
    email?: string;
  };
  createdAt: number;
}


export type WritingStyle = 'FORMAL' | 'TECHNICAL' | 'EDITORIAL' | 'DYNAMISM';

export type OutputFormat = 'ARTICLE' | 'NEWS' | 'PRESS_RELEASE' | 'REPORT' | 'ANNOUNCEMENT';

export type LibrarySourceType =
  | 'upload'
  | 'web_link'
  | 'google_drive_folder'
  | 'google_drive_file'
  | 'google_docs'
  | 'google_sheets'
  | 'google_slides'
  | 'google_pdf'
  | 'text';

export type LibraryCollectionType = 'personal' | 'work' | 'editorial' | 'shared' | 'drive' | 'custom';

export interface LibraryCollection {
  id: string;
  name: string;
  description?: string;
  type: LibraryCollectionType;
  color?: string;
  icon?: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  archived?: boolean;
}

export interface DocumentSource {
  id: string;
  name: string;
  content: string;
  type: 'word' | 'pdf' | 'excel' | 'link' | 'text' | 'drive'; // 'drive' for unified drive items
  sourceType?: LibrarySourceType;
  category: 'GENERAL' | 'PROJECT';
  collectionId?: string;
  collectionType?: LibraryCollectionType;
  
  // Top-level Drive & Meta fields (Preferred)
  driveFileId?: string;
  driveMimeType?: string;
  driveIconUrl?: string;
  driveThumbnailUrl?: string;
  driveWebViewLink?: string;
  driveSize?: string;
  sourceLimitNote?: string;
  contentStatus?: 'metadata_only' | 'extracting' | 'extracted' | 'summary_only' | 'unavailable' | 'error' | 'too_large';
  
  // AI Classification & Summary
  documentKind?: 'van_ban_chi_dao' | 'quy_dinh_phap_ly' | 'bao_cao' | 'ke_hoach' | 'hop_dong' | 'tai_lieu_ky_thuat' | 'tai_lieu_an_toan' | 'tin_bai_truyen_thong' | 'tai_chinh_ke_toan' | 'nhan_su_lao_dong' | 'khac';
  taskCategoryCode?: string;
  summary?: {
    short: string;
    mainPoints: string[];
    keyPoints?: string[];
    keywords: string[];
    full?: string;
    entities: {
      people: string[];
      organizations: string[];
      locations: string[];
      vessels: string[];
      dates: string[];
    };
    actionItems?: string[];
    risks?: string[];
    sourceLimitNote?: string | null;
    generatedAt: number;
    model?: string;
  };

  metadata?: {
    title?: string;
    description?: string;
    favicon?: string;
    url?: string;
    size?: number;
    isGoogleDrive?: boolean;
    driveId?: string;
    parentDriveFolderId?: string;
    driveMimeType?: string;
    driveIconUrl?: string;
    driveThumbnailUrl?: string;
    driveWebViewLink?: string;
    driveDownloadUrl?: string;
    modifiedTime?: string;
    syncStatus?: 'manual' | 'synced' | 'archived' | 'missing' | 'error';
    lastSyncedAt?: number;
    openUrl?: string;
    previewUrl?: string;
    googleViewerUrl?: string;
  };
  linkedType?: 'article' | 'task' | 'general';
  linkedId?: string;
  ownerId?: string;
  createdAt?: number;
  updatedAt?: number;
  archived?: boolean;
}

export type IllustrationStatus = 'pending' | 'planning' | 'generating' | 'ready' | 'error';
export type IllustrationQualityStatus = 'unchecked' | 'passed' | 'warning' | 'failed';
export type IllustrationReviewStatus = 'suggested' | 'approved' | 'rejected';

export interface ExistingMarkdownImage {
  id: string;
  alt: string;
  url: string;
  raw: string;
  index: number;
  paragraphIndex: number;
  isLikelyBroken: boolean;
}

export interface IllustrationPlaceholder {
  id: string;
  raw: string;
  text: string;
  index: number;
  paragraphIndex: number;
  contextBefore: string;
  contextAfter: string;
}

export interface EditorialIllustrationPlan {
  id: string;
  paragraphIndex: number;
  insertAfter?: string;
  caption: string;
  prompt: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  sourcePlaceholderId?: string;
}

export interface EditorialIllustration {
  id: string;
  planId: string;
  url: string;
  storagePath?: string;
  prompt: string;
  caption: string;
  paragraphIndex: number;
  insertAfter?: string;
  status: IllustrationStatus;
  qualityStatus: IllustrationQualityStatus;
  qualitySummary?: string;
  qualityWarnings?: string[];
  reviewStatus: IllustrationReviewStatus;
  loadStatus?: 'loading' | 'loaded' | 'error';
  error?: string;
  createdAt: number;
}

export interface EditorialImageAnalysis {
  paragraphs: string[];
  wordCount: number;
  existingImages: ExistingMarkdownImage[];
  placeholders: IllustrationPlaceholder[];
  brokenImageIds: string[];
  validExistingImageCount: number;
  targetImageCount: number;
  neededImageCount: number;
  plans: EditorialIllustrationPlan[];
  notes: string[];
}

export interface ChatAttachment {
  id: string;
  ownerId: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  storagePath: string;
  downloadUrl?: string;
  contentExcerpt?: string;
  contentStatus: 'pending' | 'extracting' | 'extracted' | 'error' | 'unavailable' | 'too_large';
  summary?: any;
  classification?: any;
  linkedDocumentId?: string;
  linkedTaskIds?: string[];
  linkedSessionIds?: string[];
  status: 'uploading' | 'ready' | 'error';
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export type WorkTaskStatus = 'todo' | 'doing' | 'review' | 'done' | 'blocked';
export type WorkTaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface WorkTaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface WorkTask {
  id: string;
  title: string;
  assignee: string;
  dueDate: string; // ISO format
  categoryCode: string;
  isDeputy?: boolean; // Chức danh kiêm nhiệm
  assignmentCode?: string; // Mã chức danh kiêm nhiệm
  assignmentName?: string; // Tên chức danh kiêm nhiệm
  description: string;
  status: WorkTaskStatus;
  priority: WorkTaskPriority;
  source: 'manual' | 'ai';
  ownerId?: string; // UID người tạo
  selected?: boolean; // UI selection logic
  linkedDocumentIds?: string[]; // IDs of documents from the library
  checklist?: WorkTaskChecklistItem[];
  parentGroupTitle?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface TaskCategory {
  code: string;
  name: string;
  description: string;
}

export const TASK_CATEGORIES: TaskCategory[] = [
  { code: 'LV_DH', name: 'Điều hành sản xuất', description: 'Hoạt động điều hành, dẫn tàu, trực ca' },
  { code: 'LV_AT', name: 'An toàn hàng hải', description: 'Kiểm tra an toàn, bảo hộ, phòng chống lụt bão' },
  { code: 'LV_KT', name: 'Kỹ thuật - Vật tư', description: 'Sửa chữa tàu, bảo trì thiết bị, cung ứng vật tư' },
  { code: 'LV_TC', name: 'Tài chính - Kế toán', description: 'Thanh quyết toán, báo cáo thuế, quản lý vốn' },
  { code: 'LV_TCCB', name: 'Tổ chức cán bộ - Lao động', description: 'Nhân sự, đào tạo, lương thưởng, bảo hiểm' },
  { code: 'LV_PCTTra', name: 'Pháp chế - Thanh tra', description: 'Hợp đồng, giải quyết khiếu nại, thanh tra nội bộ' },
  { code: 'LV_KHDN', name: 'Kế hoạch - Kinh doanh', description: 'Lập kế hoạch doanh thu, ký kết hợp đồng đại lý' },
  { code: 'LV_HTQT', name: 'Hợp tác quốc tế', description: 'Giao lưu quốc tế, đào tạo nước ngoài, đối ngoại' },
  { code: 'LV_VPDT', name: 'Văn phòng - Đoàn thể', description: 'Hành chính, văn thư, Đảng, Đoàn, Công đoàn' }
];

export interface ArticleVersion {
  id: string;
  content: string;
  timestamp: number;
  note: string;
  illustrations?: EditorialIllustration[];
}

export interface ProjectSession {
  id: string;
  title: string;
  taskType: TaskType;
  style: WritingStyle;
  documentIds: string[];
  currentOutput: string;
  format: OutputFormat;
  versions: ArticleVersion[];
  illustrations?: EditorialIllustration[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  displayName: string;
  title: string;
  department: string;
  phone: string;
  avatarText: string;
  defaultAssigneeName: string;
  defaultTaskCategoryCode: string;
  updatedAt: number;
  ownerId: string;
}

export interface ChatTaskDraft {
  clientId: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  categoryCode: string;
  categoryName?: string;
  priority: WorkTaskPriority;
  status: WorkTaskStatus;
  isDeputy: boolean;
  checklist: WorkTaskChecklistItem[];
  source: 'ai';
  selected?: boolean;
  reason?: string;
  confidence?: number;
}

export interface ChatSuggestedAction {
  type: 'review_task_drafts' | 'open_tasks' | 'open_library' | 'open_editor' | 'create_task' | 'search_library' | 'summarize' | 'create_tasks' | 'write_article' | 'save_document' | 'link_to_task' | 'ask_followup' | string;
  label: string;
  payload?: any;
  filter?: any;
  confidence?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  taskDrafts?: ChatTaskDraft[];
  suggestedActions?: ChatSuggestedAction[];
  attachments?: ChatAttachment[];
  status?: 'normal' | 'error' | 'task_review';
}

export interface AssistantResponse {
  output: string;
  analysis?: string;
  changes?: string[];
  groundingSources?: any[];
}
