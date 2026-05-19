import { useState, useRef, useEffect, useMemo } from "react";
import {
  FileText,
  Search,
  Maximize2,
  Image as ImageIcon,
  Anchor,
  Ship,
  Edit3,
  Check,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Activity,
  Copy,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
  FileUp,
  Files,
  Link as LinkIcon,
  BookOpen,
  Settings2,
  ExternalLink,
  Plus,
  Sparkles,
  X,
  Target,
  Database,
  Type,
  History,
  Save,
  Globe,
  Clock,
  ArrowLeft,
  Download,
  FileDown,
  LogOut,
  User,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  ListTodo,
  Filter,
  Calendar,
  AlertTriangle,
  CheckSquare,
  Square,
  Menu,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  RefreshCw,
  Layers,
  Briefcase,
  Users,
  ArrowRight,
  EyeOff,
  MessageCircle,
  Shield,
  Phone,
  Tag,
  Bot,
  Home,
  MessageSquare,
  Archive,
  MoreHorizontal,
  FileCode,
  Monitor,
  Cpu,
  Fingerprint,
  Eye,
  FilePlus,
  HardDrive,
  FileType,
  Code,
  FolderOpen,
  Folder,
  Presentation,
  ListTree,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import React, { Suspense } from "react";
import { UserProfile } from "./types";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const TaskEditModal = React.lazy(() =>
  import("./components/TaskEditModal").then((m) => ({
    default: m.TaskEditModal,
  })),
);
const UserProfileSection = React.lazy(() =>
  import("./components/UserProfileSection").then((m) => ({
    default: m.UserProfileSection,
  })),
);
const DriveFolderBrowser = React.lazy(() =>
  import("./components/DriveFolderBrowser").then((m) => ({
    default: m.DriveFolderBrowser,
  })),
);
const FloatingChatbox = React.lazy(() =>
  import("./components/FloatingChatbox").then((m) => ({
    default: m.FloatingChatbox,
  })),
);
const SlideOutlineGenerator = React.lazy(() =>
  import("./components/editorial/SlideOutlineGenerator").then((m) => ({
    default: m.SlideOutlineGenerator,
  })),
);
const ActivityLogView = React.lazy(() =>
  import("./components/activity/ActivityLogView").then((m) => ({
    default: m.ActivityLogView,
  })),
);

import { cn } from "./lib/utils";
import {
  processTask,
  searchWebSources,
  checkHealth,
  planEditorialImages,
} from "./services/geminiService";
import { waitForBackendReady, apiFetchJson } from "./services/apiClient";
import {
  TaskType,
  WritingStyle,
  OutputFormat,
  DocumentSource,
  ProjectSession,
  ArticleVersion,
  WorkTask,
  TASK_CATEGORIES,
  EditorialImageAnalysis,
  EditorialIllustration,
  EditorialIllustrationPlan,
  ContentReview,
  IllustrationReviewStatus,
  LibraryCollection,
  LibraryCollectionType,
  ChatMessage,
  ChatSuggestedAction as SuggestedAction,
  ChatTaskDraft,
  ChatAttachment,
} from "./types";
import { parseFile } from "./lib/fileParser";
import { storage, auth, db, handleFirestoreError } from "./lib/firebase";
import {
  ref,
  getDownloadURL,
  uploadBytes,
  uploadString,
} from "firebase/storage";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import {
  buildLocalImageAnalysis,
  isUsableSuggestedIllustration,
  removeBrokenMarkdownImages,
  stripResolvedPlaceholders,
  isPublishableIllustration,
  insertApprovedIllustrationsForPlainExport,
} from "./lib/editorialImageUtils";
import { auditEditorialPublish } from "./lib/editorialPublishUtils";
import { buildEditorialPrompt } from "./lib/editorialPrompts";
import { EditorialKindSelector } from "./components/editorial/EditorialKindSelector";
import { EditorialInputForm } from "./components/editorial/EditorialInputForm";
import { type SlideOutlineResult } from "./types/slideOutline";
import { EditorialPreflightPanel } from "./components/editorial/EditorialPreflightPanel";
import { logActivity } from "./lib/activityLog";

const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "Cần làm",
  doing: "Đang làm",
  review: "Chờ rà soát",
  done: "Hoàn thành",
  blocked: "Đang vướng",
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

const HIGH_PRIORITY_FILTER = "high_urgent";

function getCategoryName(code: string) {
  const cat = TASK_CATEGORIES.find((c) => c.code === code);
  return cat ? cat.name : code;
}

const localizeTaskForAI = (t: WorkTask) => ({
  title: t.title,
  status: t.status,
  statusLabel: TASK_STATUS_LABELS[t.status] || t.status,
  priority: t.priority,
  priorityLabel: TASK_PRIORITY_LABELS[t.priority] || t.priority,
  assignee: t.assignee || "Chưa phân công",
  dueDate: t.dueDate || "Chưa có hạn",
  categoryCode: t.categoryCode,
  categoryName: getCategoryName(t.categoryCode),
  description: String(t.description || "").slice(0, 800),
  checklist: (t.checklist || []).slice(0, 10).map((item) => ({
    title: item.title,
    done: item.done,
  })),
});

function getTaskDueEndTime(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  try {
    const date = new Date(dueDate);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  } catch (e) {
    return null;
  }
}

function isTaskOverdue(task: WorkTask): boolean {
  if (task.status === "done") return false;
  const endTime = getTaskDueEndTime(task.dueDate);
  return !!(endTime && endTime < Date.now());
}

function isTaskUpcoming(task: WorkTask, days: number = 3): boolean {
  if (task.status === "done" || isTaskOverdue(task)) return false;
  const endTime = getTaskDueEndTime(task.dueDate);
  if (!endTime) return false;
  const now = Date.now();
  return endTime > now && endTime < now + days * 24 * 60 * 60 * 1000;
}

function getUserDisplayName(user: FirebaseUser | null, profile?: any) {
  if (profile?.displayName) return profile.displayName;
  if (!user) return "Khách";
  if (user.displayName?.trim()) return user.displayName.trim();
  const emailPrefix = user.email?.split("@")[0] || "Người dùng";
  return emailPrefix
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- HELPERS ---
function safeParseSlideOutline(value?: string): SlideOutlineResult | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || !Array.isArray(parsed.slides)) return undefined;
    return parsed as SlideOutlineResult;
  } catch {
    return undefined;
  }
}

// --- TASK HELPER COMPONENTS ---

function NoTasksMessage({
  setTaskFilters,
}: {
  setTaskFilters: (f: any) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 w-full">
      <div className="p-4 bg-slate-50 rounded-md">
        <ListTodo className="w-10 h-10 text-slate-200" />
      </div>
      <p className="text-slate-400 font-bold text-sm">
        Chưa có công việc nào thỏa mãn điều kiện lọc.
      </p>
      <button
        onClick={() =>
          setTaskFilters((prev: any) => ({
            ...prev,
            status: "all",
            priority: "all",
            category: "all",
            search: "",
          }))
        }
        className="text-[#002D56] text-xs font-semibold hover:underline"
      >
        Xóa bộ lọc để xem lại →
      </button>
    </div>
  );
}

function TaskTitleCell({ task, documents }: { task: any; documents: any[] }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-sm font-bold text-slate-800 mb-1 leading-tight line-clamp-2">
        {task.title}
      </span>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {task.isDeputy && (
            <span className="text-[8px] font-semibold uppercase text-amber-600 bg-amber-50 px-1 rounded-sm border border-amber-100">
              Kiêm nhiệm
            </span>
          )}
          <span className="text-[10px] text-slate-400 line-clamp-1 truncate">
            {task.description}
          </span>
        </div>
        {task.linkedDocumentIds && task.linkedDocumentIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.linkedDocumentIds
              .slice(0, 3)
              .map((docId: string, idx: number) => {
                const doc = documents.find((d) => d.id === docId);
                if (!doc) return null;
                return (
                  <div
                    key={`${docId}-${idx}`}
                    className="flex items-center gap-1 bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[8px] font-semibold uppercase border border-slate-200"
                  >
                    <FileText className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[80px]">{doc.name}</span>
                  </div>
                );
              })}
            {task.linkedDocumentIds.length > 3 && (
              <span className="text-[8px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                +{task.linkedDocumentIds.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskAssigneeCell({ task }: { task: any }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-500 uppercase shrink-0">
        {(task.assignee || "UV").slice(0, 2)}
      </div>
      <span className="text-xs font-bold text-slate-600 truncate">
        {task.assignee || "Chưa định danh"}
      </span>
    </div>
  );
}

function TaskPriorityCell({ task }: { task: any }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] font-semibold uppercase shrink-0",
        task.priority === "urgent"
          ? "text-red-600"
          : task.priority === "high"
            ? "text-orange-600"
            : task.priority === "medium"
              ? "text-blue-600"
              : "text-slate-400",
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          task.priority === "urgent"
            ? "bg-red-500"
            : task.priority === "high"
              ? "bg-orange-500"
              : task.priority === "medium"
                ? "bg-blue-500"
                : "bg-slate-300",
        )}
      />
      {task.priority === "urgent"
        ? "Khẩn"
        : task.priority === "high"
          ? "Cao"
          : task.priority === "medium"
            ? "Vừa"
            : "Thấp"}
    </div>
  );
}

function TaskStatusCell({
  task,
  updateTaskStatus,
}: {
  task: any;
  updateTaskStatus: any;
}) {
  return (
    <div className="flex justify-center shrink-0">
      <select
        value={task.status}
        onChange={(e) => updateTaskStatus(task.id, e.target.value as any)}
        className={cn(
          "px-3 py-1.5 rounded-md text-[10px] font-semibold tracking-wide border-2 transition-all cursor-pointer",
          task.status === "done"
            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
            : task.status === "doing"
              ? "bg-blue-50 border-blue-200 text-blue-600"
              : task.status === "blocked"
                ? "bg-red-50 border-red-200 text-red-600"
                : task.status === "review"
                  ? "bg-amber-50 border-amber-200 text-amber-600"
                  : "bg-slate-50 border-slate-200 text-slate-400",
        )}
      >
        <option value="todo">Cần làm</option>
        <option value="doing">Đang làm</option>
        <option value="review">Duyệt</option>
        <option value="done">Xong</option>
        <option value="blocked">Vướng</option>
      </select>
    </div>
  );
}

function TaskActionsCell({
  task,
  onDelete,
}: {
  task: any;
  onDelete: (id: string) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete(task.id);
      }}
      className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

const DEFAULT_LIBRARY_COLLECTIONS: LibraryCollection[] = [
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

const DOCUMENT_KIND_LABELS: Record<string, string> = {
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

const matchesSearch = (
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

const TYPE_MAPPING: Record<string, string> = {
  drive: "Google Drive",
  pdf: "PDF",
  word: "Bản Word",
  excel: "Bảng tính",
  text: "Văn bản thô",
  link: "Liên kết Web",
};

const SOURCE_TYPE_MAPPING: Record<string, string> = {
  upload: "Tải lên",
  drive: "Drive",
  text: "Ghi chú",
  web_extraction: "Trích xuất Web",
};

function getDocTypeLabel(type?: string) {
  if (!type) return "Văn bản";
  return TYPE_MAPPING[type.toLowerCase()] || type.toUpperCase();
}

function getSourceTypeLabel(sourceType?: string) {
  if (!sourceType) return "Nội bộ";
  return (
    SOURCE_TYPE_MAPPING[sourceType.toLowerCase()] || sourceType.toUpperCase()
  );
}

function getDocumentPreviewUrl(d: DocumentSource): string {
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

function getDocumentOpenUrl(d: DocumentSource): string {
  return (
    d.driveWebViewLink ||
    d.metadata?.driveWebViewLink ||
    d.metadata?.openUrl ||
    d.metadata?.url ||
    ""
  );
}

function cleanDisplayTitle(value?: string): string {
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

export type BackgroundTask = {
  id: string;
  url: string;
  title?: string;
  type: "link" | "drive" | "file";
  status: "processing" | "success" | "error";
  startedAt: number;
  message?: string;
};

const ManualSummaryTab = ({
  docObj,
  onSave,
}: {
  docObj: any;
  onSave: (content: string, summary: string) => Promise<void>;
}) => {
  const [content, setContent] = useState(docObj.content || "");
  const [summary, setSummary] = useState(
    typeof docObj.summary === "string"
      ? docObj.summary
      : docObj.summary?.short || docObj.summary?.full || "",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContent(docObj.content || "");
    setSummary(
      typeof docObj.summary === "string"
        ? docObj.summary
        : docObj.summary?.short || docObj.summary?.full || "",
    );
  }, [docObj]);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(content, summary);
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-md border border-slate-100 shadow-sm">
        <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal mb-4">
          Nội dung thô
        </h5>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nội dung tài liệu..."
          className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-md text-sm font-mono focus:border-blue-500 transition-colors mb-6 text-slate-700 custom-scrollbar"
        />
        <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal mb-4">
          Tóm tắt thủ công
        </h5>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Tóm tắt tài liệu..."
          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-md text-sm focus:border-blue-500 transition-colors mb-6 text-slate-700 custom-scrollbar"
        />
        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#002D56] text-white rounded-md text-[10px] font-semibold tracking-normal flex items-center gap-2 hover:bg-blue-900 transition-colors disabled:opacity-50"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};

import { AdminWorkspace } from "./components/admin/AdminWorkspace";

const ContentReviewDisplay = ({ review }: { review: ContentReview }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl border-2 border-[#002D56]/10 shadow-xl overflow-hidden mb-12 no-print"
    >
      <div className="bg-[#002D56] p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-tight">
              Kế hoạch Chẩn đoán & Đánh giá
            </h3>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
              Phân tích bởi AI Ban Biên tập VMS Hoa Tiêu Miền Bắc
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
            Điểm nội bộ
          </span>
          <span className="text-4xl font-bold tracking-tight">
            {review.qualityScore}
            <span className="text-lg opacity-40 ml-1">/100</span>
          </span>
        </div>
      </div>

      <div className="p-8 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 h-full">
              <h4 className="text-[11px] font-bold text-[#002D56] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Tóm lược AI
              </h4>
              <p className="text-sm font-semibold text-slate-800 leading-relaxed text-justify mb-4">
                {review.summary}
              </p>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2 italic">
                  Mục đích chính:
                </p>
                <p className="text-xs font-bold text-slate-600">
                  {review.purpose}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Điểm mạnh
                </h5>
                <ul className="space-y-2">
                  {review.strengths.map((s, idx) => (
                    <li
                      key={idx}
                      className="text-xs font-semibold text-emerald-900 leading-tight flex gap-2"
                    >
                      <span className="shrink-0">•</span> {s}
                    </li>
                  ))}
                  {review.strengths.length === 0 && (
                    <li className="text-[10px] text-emerald-400 italic">
                      Không có dữ liệu
                    </li>
                  )}
                </ul>
              </div>
              <div className="p-5 bg-rose-50 border border-rose-100 rounded-lg">
                <h5 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Hạn chế
                </h5>
                <ul className="space-y-2">
                  {review.weaknesses.map((w, idx) => (
                    <li
                      key={idx}
                      className="text-xs font-semibold text-rose-900 leading-tight flex gap-2"
                    >
                      <span className="shrink-0">•</span> {w}
                    </li>
                  ))}
                  {review.weaknesses.length === 0 && (
                    <li className="text-[10px] text-rose-400 italic">
                      Không phát hiện
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              id: "spelling",
              label: "Lỗi chính tả / dùng từ",
              data: review.spellingIssues,
              icon: Type,
              color: "rose",
            },
            {
              id: "structure",
              label: "Bố cục / Sắp xếp",
              data: review.structureIssues,
              icon: ListTree,
              color: "amber",
            },
            {
              id: "style",
              label: "Văn phong / Sắc thái",
              data: review.styleIssues,
              icon: Edit3,
              color: "blue",
            },
            {
              id: "duplication",
              label: "Trùng lặp nội dung",
              data: review.duplicationIssues,
              icon: Files,
              color: "slate",
            },
            {
              id: "missing",
              label: "Thiếu sót nội dung",
              data: review.missingContent,
              icon: Target,
              color: "indigo",
            },
            {
              id: "factual",
              label: "Rủi ro dữ kiện",
              data: review.factualWarnings,
              icon: ShieldAlert,
              color: "orange",
            },
          ].map((group) => (
            <div
              key={group.id}
              className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm hover:border-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    group.color === "rose"
                      ? "bg-rose-100 text-rose-600"
                      : group.color === "amber"
                        ? "bg-amber-100 text-amber-600"
                        : group.color === "blue"
                          ? "bg-blue-100 text-blue-600"
                          : group.color === "indigo"
                            ? "bg-indigo-100 text-indigo-600"
                            : group.color === "orange"
                              ? "bg-orange-100 text-orange-600"
                              : "bg-slate-100 text-slate-600",
                  )}
                >
                  <group.icon className="w-4 h-4" />
                </div>
                <h5 className="text-[10px] font-bold text-slate-800 tracking-tight uppercase">
                  {group.label}
                </h5>
              </div>
              <div className="space-y-2">
                {group.data && group.data.length > 0 ? (
                  group.data.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="text-slate-300 mt-0.5 shrink-0">•</span>
                      <p className="text-xs font-medium text-slate-600 leading-tight">
                        {item}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-300 font-bold italic tracking-tight">
                    Tất cả đều ổn
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-emerald-50/50 p-6 rounded-lg border border-emerald-100">
            <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Đề xuất nâng cấp
            </h4>
            <div className="space-y-3">
              {review.improvementSuggestions &&
                review.improvementSuggestions.map((s, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-tight">
                      {s}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-inner relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5">
              <Bot className="w-32 h-32 text-white" />
            </div>
            <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Prompt gợi ý tối ưu
            </h4>
            <div className="bg-white/10 rounded border border-white/10 p-4 text-xs font-mono text-emerald-400 leading-relaxed italic">
              "{review.rewrittenPrompt}"
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(review.rewrittenPrompt);
                  toast.success("Đã sao chép prompt!");
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white text-white hover:text-slate-900 rounded text-[9px] font-bold uppercase transition-all flex items-center gap-2"
              >
                <Copy className="w-3 h-3" /> Sao chép prompt
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function StartupOverlay({
  state,
}: {
  state: "booting" | "ready" | "degraded" | "failed";
}) {
  const isVisible = state === "booting";
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50 font-sans p-6 transition-opacity duration-500 ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center animate-bounce duration-1000">
          <Ship className="w-8 h-8 text-[#002D56]" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 animate-pulse">
          Đang khởi tạo hệ thống...
        </h2>
        <p className="text-slate-500 text-sm">Vui lòng đợi giây lát</p>
      </div>
    </div>
  );
}

function DegradedBanner({
  state,
  error,
  onRetry,
}: {
  state: "booting" | "ready" | "degraded" | "failed";
  error: string | null;
  onRetry: () => void;
}) {
  if (state !== "degraded" && state !== "failed") return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9990] bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-4 shadow-md">
      <AlertTriangle className="w-4 h-4" />
      <span>Một số dịch vụ đang ngoại tuyến ${error ? `(${error})` : ""}</span>
      <button
        onClick={onRetry}
        className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-xs font-bold transition-colors"
      >
        Thử lại
      </button>
    </div>
  );
}

function App() {
  const [inactiveTime, setInactiveTime] = useState(0);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [taskType, setTaskType] = useState<TaskType>("WRITE_NEW");
  const [style, setStyle] = useState<WritingStyle>("FORMAL");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("ARTICLE");
  const [input, setInput] = useState("");
  const [editorialKind, setEditorialKind] =
    useState<import("./types/editorial").EditorialDocumentKind>(
      "website_article",
    );
  const [output, setOutput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "home"
    | "tasks"
    | "editor"
    | "library"
    | "history"
    | "settings"
    | "activity"
    | "admin"
  >("home");
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );

  const [startupState, setStartupState] = useState<
    "booting" | "ready" | "degraded" | "failed"
  >("booting");
  const [appInitialized, setAppInitialized] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Authentication & Global User State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeModal, setActiveModal] = useState<
    "auth" | "account" | "settings" | "task-edit" | null
  >(null);

  // Document & Library State
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [libraryCollections, setLibraryCollections] = useState<
    LibraryCollection[]
  >(DEFAULT_LIBRARY_COLLECTIONS);
  const [activeLibraryId, setActiveLibraryId] =
    useState<string>("lib-personal");
  const [selectedSourceDocIds, setSelectedSourceDocIds] = useState<string[]>(
    [],
  );
  const [bulkSelectedDocIds, setBulkSelectedDocIds] = useState<string[]>([]);
  const [documentMenuDocId, setDocumentMenuDocId] = useState<string | null>(
    null,
  );
  const [previewDocument, setPreviewDocument] = useState<DocumentSource | null>(
    null,
  );
  const [documentDetailTab, setDocumentDetailTab] = useState<
    "overview" | "preview" | "ai" | "metadata" | "manual"
  >("overview");
  const [isSyncingDrive, setIsSyncingDrive] = useState<string | null>(null);
  const [isExtractingScan, setIsExtractingScan] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);

  // Task & Work Management State
  const [allTasks, setAllTasks] = useState<WorkTask[]>([]);
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);
  const [taskFilters, setTaskFilters] = useState({
    status: "all",
    priority: "all",
    category: "all",
    search: "",
  });
  const [builtTasks, setBuiltTasks] = useState<WorkTask[]>([]);
  const [isBuildingTasks, setIsBuildingTasks] = useState(false);

  // Chat/AI State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(
        `vms_chat_messages_${auth.currentUser?.uid || "temp"}`,
      );
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Persistence for chat
  useEffect(() => {
    if (user) {
      const key = `vms_chat_messages_${user.uid}`;
      localStorage.setItem(key, JSON.stringify(chatMessages.slice(-50)));
    }
  }, [chatMessages, user]);

  // Auto-close chat when modal opens
  useEffect(() => {
    if (activeModal && isChatOpen) {
      setIsChatOpen(false);
    }
  }, [activeModal]);

  useEffect(() => {
    let activityTimer: NodeJS.Timeout;
    const resetActivity = () => {
      setInactiveTime(0);
      clearTimeout(activityTimer);
      activityTimer = setTimeout(
        () => setInactiveTime((prev) => prev + 1),
        5000,
      );
    };
    window.addEventListener("mousemove", resetActivity);
    window.addEventListener("keydown", resetActivity);
    document.addEventListener("touchstart", resetActivity);
    return () => {
      window.removeEventListener("mousemove", resetActivity);
      window.removeEventListener("keydown", resetActivity);
      document.removeEventListener("touchstart", resetActivity);
      clearTimeout(activityTimer);
    };
  }, []);

  const closeMobileDrawer = () => {
    setIsSidebarOpen(false);
  };

  const openTaskOverview = (filters?: Partial<typeof taskFilters>) => {
    setTaskFilters({
      status: "all",
      priority: "all",
      category: "all",
      search: "",
      ...filters,
    });
    setActiveTab("tasks");
    closeMobileDrawer();
  };
  const repairLegacyDriveLinks = async () => {
    if (!user) return;
    const legacyDocs = documents.filter(
      (d) =>
        (d.type as string) === "link" &&
        (d.metadata?.url?.includes("drive.google.com") ||
          d.metadata?.url?.includes("docs.google.com")),
    );

    if (legacyDocs.length === 0) {
      toast.success("Không tìm thấy link Drive cũ cần sửa.");
      return;
    }

    const confirmed = await requestConfirmAsync(
      `Tìm thấy ${legacyDocs.length} link Drive cũ. Bạn có muốn nâng cấp toàn bộ sang định dạng tài liệu chuẩn để AI có thể đọc nội dung?`,
    );
    if (!confirmed) return;

    setIsParsing(true);
    let successCount = 0;
    try {
      const token = await user.getIdToken();
      for (const docObj of legacyDocs) {
        try {
          const response = await fetch("/api/drive/import-public-link", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              url: docObj.metadata?.url,
              collectionId: docObj.collectionId || "lib-personal",
              legacyId: docObj.id,
            }),
          });
          if (response.ok) successCount++;
        } catch (e) {
          console.error(`Repair error for ${docObj.id}:`, e);
        }
      }
      toast.success(
        `Đã nâng cấp xong ${successCount}/${legacyDocs.length} tài liệu.`,
      );
    } catch (err: any) {
      toast.error(err.message || "Lỗi hệ thống");
    } finally {
      setIsParsing(false);
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showMobileHeader, setShowMobileHeader] = useState(true);
  const lastScrollY = useRef(0);

  const handleImportDriveLink = async (url: string) => {
    if (!user) return;
    try {
      setIsParsing(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/drive/import-public-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, collectionId: activeLibraryId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      toast.success("Đã nhập thành công từ Google Drive");
      if (data.document) {
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi nhập liên kết Drive");
    } finally {
      setIsParsing(false);
    }
  };

  const openDocumentPreview = (doc: DocumentSource) => {
    setPreviewDocument(doc);
    setDocumentDetailTab("overview");
  };

  const isPotentialScannedDocument = (doc: DocumentSource | null) => {
    if (!doc) return false;
    if ((doc.type as any) === "image") return true;
    if (doc.type === "pdf") {
      return (
        doc.contentStatus === "needs_ocr" ||
        (!doc.content && doc.contentStatus !== "extracted")
      );
    }
    return false;
  };

  const handleSaveManualSummary = async (docId: string, summary: string) => {
    try {
      // Basic update to UI state
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, content: summary, contentStatus: "extracted" }
            : d,
        ),
      );
      setPreviewDocument((prev) =>
        prev?.id === docId
          ? { ...prev, content: summary, contentStatus: "extracted" }
          : prev,
      );
      toast.success("Đã lưu nội dung");
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu dữ liệu");
    }
  };

  // Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setAuthReady(true);
        console.log("[BOOT] auth ready");
      },
      (error) => {
        console.error("[BOOT] auth error", error);
        setAuthReady(true);
      },
    );
    return () => unsubscribe();
  }, []);

  // Backend Readiness
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        console.log("[BOOT] app init start");
        setStartupState("booting");
        setBackendLoading(true);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch("/api/health", {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("health_failed");

        const data = await response.json();
        if (cancelled) return;

        console.log("[BOOT] health success", data);
        setHealth(data);
        setBackendReady(true);
        setFirestoreReady(data.firestoreReady === true);
        setAiReady(!!data.hasSystemGeminiKey);
        setBackendError(null);
        setStartupState("ready");
      } catch (err: any) {
        if (cancelled) return;
        console.error("[BOOT] health failed", err);
        setBackendReady(false);
        if (err.name === "AbortError") {
          setBackendError("health_timeout: Máy chủ không phản hồi sau 8 giây.");
        } else {
          setBackendError(err?.message || "Backend chưa sẵn sàng.");
        }
        setStartupState("degraded");
      } finally {
        if (!cancelled) {
          setBackendLoading(false);
          setAppInitialized(true);
        }
      }
    };

    bootstrap();

    // Fallback timeout
    const fallbackTimer = setTimeout(() => {
      setStartupState((prev) => {
        if (prev === "booting") {
          console.warn("[BOOT] timeout, forcing degraded mode");
          setBackendReady(false);
          setBackendError("system_timeout: Quá thời gian khởi tạo.");
          return "degraded";
        }
        return prev;
      });
    }, 10000);

    return () => {
      cancelled = true;

      clearTimeout(fallbackTimer);
    };
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1180) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [selectingParagraphForImage, setSelectingParagraphForImage] = useState<{
    file: File;
  } | null>(null);

  // Auth State

  // --- PROFILE LOGIC ---
  const fetchProfile = async () => {
    const currentUser = auth.currentUser || user;
    if (!backendReady || !firestoreReady || !authReady || !currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const data = await apiFetchJson("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
        retries: 5,
        retryDelayMs: 1500,
        allowHtmlRetry: true,
      });

      if (data.success) {
        setProfile(data.profile as UserProfile | null);
      }
    } catch (err: any) {
      if (
        err?.errorType === "firestore_database_not_found" ||
        err?.errorType === "firestore_unavailable" ||
        err?.errorType === "firestore_init_failed"
      ) {
        console.warn("[Profile] Firestore chưa sẵn sàng:", err.message);
        setProfile(null);
        return;
      }
      console.error("[Profile] Failed:", err);
    }
  };

  const handleSaveProfile = async (data: Partial<UserProfile>) => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để thực hiện.");
      return;
    }
    try {
      const token = await currentUser.getIdToken(true);
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Cập nhật thất bại");
      await fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu hồ sơ");
    }
  };

  useEffect(() => {
    if (backendReady && firestoreReady && authReady && user) {
      fetchProfile();
    }
  }, [backendReady, firestoreReady, authReady, user?.uid]);

  // --- FLOATING CHAT LOGIC ---
  const getChatAuthToken = async () => {
    if (!authReady) {
      throw new Error(
        "Đang kiểm tra trạng thái đăng nhập. Vui lòng thử lại sau vài giây.",
      );
    }
    const currentUser = auth.currentUser || user;
    if (!currentUser) {
      throw new Error(
        "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
      );
    }
    try {
      return await currentUser.getIdToken(false);
    } catch (err) {
      throw new Error(
        "Không thể xác thực người dùng. Vui lòng thử đăng nhập lại.",
      );
    }
  };

  const toggleChatTaskDraft = (messageIndex: number, clientId: string) => {
    setChatMessages((prev) =>
      prev.map((m, idx) => {
        if (idx !== messageIndex) return m;
        const updatedDrafts = (m.taskDrafts || []).map((d) =>
          d.clientId === clientId
            ? { ...d, selected: !(d.selected !== false) }
            : d,
        );
        return {
          ...m,
          taskDrafts: updatedDrafts,
        };
      }),
    );
  };

  const normalizeChatTaskDraft = (draft: any): ChatTaskDraft => {
    const now = Date.now();
    const categoryCode = TASK_CATEGORIES.some(
      (c) => c.code === draft.categoryCode,
    )
      ? draft.categoryCode
      : profile?.defaultTaskCategoryCode || "LV_DH";

    return {
      clientId: `chat-task-${now}-${Math.random().toString(36).slice(2)}`,
      title: String(draft.title || "Công việc mới").trim(),
      description: String(draft.description || "").trim(),
      assignee: String(
        draft.assignee ||
          profile?.defaultAssigneeName ||
          user?.displayName ||
          user?.email ||
          "Người dùng",
      ).trim(),
      dueDate: String(draft.dueDate || "").trim(),
      categoryCode,
      categoryName: getCategoryName(categoryCode),
      priority: ["low", "medium", "high", "urgent"].includes(draft.priority)
        ? draft.priority
        : "medium",
      status: "todo",
      isDeputy: !!draft.isDeputy,
      source: "ai",
      selected: true,
      checklist: Array.isArray(draft.checklist)
        ? draft.checklist
            .slice(0, 20)
            .map((item: any, idx: number) => ({
              id: item.id || `check-${now}-${idx}`,
              title: String(item.title || item || "").trim(),
              done: !!item.done,
              createdAt: now,
            }))
            .filter((item: any) => item.title)
        : [],
      reason: String(draft.reason || "").slice(0, 500),
      confidence:
        typeof draft.confidence === "number" ? draft.confidence : undefined,
    };
  };

  async function createTasksFromChatDrafts(
    messageIndex: number,
    selectedOnly = true,
  ) {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tạo công việc.");
      return;
    }

    const msg = chatMessages[messageIndex];
    const drafts = (msg?.taskDrafts || []).filter(
      (d) => !selectedOnly || d.selected !== false,
    );

    if (!drafts.length) {
      toast.error("Chưa có công việc nào được chọn.");
      return;
    }

    setIsChatLoading(true);
    try {
      let savedCount = 0;

      for (const draft of drafts) {
        const taskToSave: Partial<WorkTask> = {
          ...draft,
          assignee: draft.assignee,
          linkedDocumentIds: selectedSourceDocIds,
          parentGroupTitle: draft.categoryName || "",
        };

        const docId = await persistTask(taskToSave);
        if (docId) savedCount++;
      }

      toast.success(`Đã tạo ${savedCount} công việc từ chat AI.`);

      setChatMessages((prev) =>
        prev.map((m, idx) => {
          if (idx !== messageIndex) return m;
          return {
            ...m,
            content: `${m.content}\n\n✅ Đã tạo ${savedCount} công việc vào Bảng công việc.`,
            taskDrafts: [],
            status: "normal",
          };
        }),
      );

      setActiveTab("tasks");
    } catch (err: any) {
      toast.error(
        "Không thể tạo công việc: " + (err.message || "Lỗi không xác định"),
      );
    } finally {
      setIsChatLoading(false);
    }
  }

  const handleSendChat = async (
    retryMessage?: string,
    attachments?: ChatAttachment[],
    chatMode?: string,
  ) => {
    let message = retryMessage || chatInput.trim();
    if (
      (!message && (!attachments || attachments.length === 0)) ||
      isChatLoading
    )
      return;

    if (!message && attachments && attachments.length > 0) {
      message =
        "Hãy đọc, tóm tắt và cho tôi biết nội dung chính của tệp đính kèm này.";
    }

    if (!backendReady) {
      toast.error("Máy chủ đang khởi động. Vui lòng thử lại sau vài giây.");
      return;
    }

    if (!isAiCoreActive) {
      toast.error(
        "AI chưa sẵn sàng. Vui lòng kiểm tra API key trong Cài đặt/Tài khoản.",
      );
      return;
    }

    let token = "";
    try {
      token = await getChatAuthToken();
    } catch (err: any) {
      toast.error(err.message || "Vui lòng đăng nhập để sử dụng chat AI.");
      setActiveModal("auth");
      return;
    }

    if (!retryMessage) {
      const userMsg: ChatMessage = {
        role: "user",
        content: message,
        attachments: attachments,
        createdAt: Date.now(),
      };
      setChatMessages((prev) => [...prev, userMsg]);
      setChatInput("");
    }

    setIsChatLoading(true);

    const callChatApi = async (authToken: string): Promise<any> => {
      const historyForRequest = chatMessages.slice(-12).map((m) => ({
        role: m.role,
        content: String(m.content || "").slice(0, 4000),
      }));

      const context = {
        activeTab,
        previewingDocument: previewDocument
          ? { id: previewDocument.id, name: previewDocument.name }
          : null,
      };

      try {
        if (attachments && attachments.length > 0) {
          const endpoint = "/api/chat/with-attachments";
          return await apiFetchJson(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              message,
              attachmentIds: attachments.map((a) => a.id),
              context,
              mode: chatMode || "quick",
            }),
            retries: 0,
            timeoutMs: 120000,
          });
        }

        return await apiFetchJson("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            message,
            history: historyForRequest,
            context,
            mode: chatMode || "quick",
          }),
          retries: 2,
          timeoutMs: 60000,
        });
      } catch (err: any) {
        throw err;
      }
    };

    try {
      let aiResponse: any;

      try {
        aiResponse = await callChatApi(token);
      } catch (err: any) {
        if (err.status === 401 && user) {
          token = await user.getIdToken(true);
          aiResponse = await callChatApi(token);
        } else {
          throw err;
        }
      }

      let aiContent =
        aiResponse.reply ||
        aiResponse.answer ||
        "AI không có nội dung phản hồi.";
      if (aiResponse.warnings && aiResponse.warnings.length > 0) {
        aiContent +=
          "\n\n**Cảnh báo:**\n" +
          aiResponse.warnings.map((w: string) => "- " + w).join("\n");
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: aiContent,
        taskDrafts: Array.isArray(aiResponse.taskDrafts)
          ? aiResponse.taskDrafts.map(normalizeChatTaskDraft)
          : [],
        suggestedActions: Array.isArray(aiResponse.actions)
          ? aiResponse.actions
          : Array.isArray(aiResponse.suggestedActions)
            ? aiResponse.suggestedActions
            : [],
        status: aiResponse.taskDrafts?.length > 0 ? "task_review" : "normal",
        createdAt: Date.now(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      const msg =
        err?.name === "AbortError"
          ? "AI phản hồi quá lâu (hết thời gian chờ). Vui lòng thử lại."
          : err?.message || "Không thể kết nối với máy chủ AI.";

      const isKeyMissing =
        msg.toLowerCase().includes("api key") ||
        msg.toLowerCase().includes("key") ||
        msg.toLowerCase().includes("cấu hình");
      const isQuota =
        msg.toLowerCase().includes("quota") ||
        msg.toLowerCase().includes("429") ||
        msg.toLowerCase().includes("hạn mức");

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isKeyMissing
            ? `⚠️ **Lỗi Cấu hình:** Bạn chưa cấu hình AI Key hoặc Key đã hết hạn. Vui lòng vào **Cài đặt > Tài khoản** để thiết lập.\n\n*Chi tiết: ${msg}*`
            : isQuota
              ? `⚠️ **Hạn mức Tạm thời:** Hệ thống AI đang hết hạn mức xử lý. Vui lòng thử lại sau 1-2 phút.\n\n*Chi tiết: ${msg}*`
              : `⚠️ **Lỗi:** ${msg}`,
          createdAt: Date.now(),
        },
      ]);

      toast.error(msg);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExecuteAction = async (action: SuggestedAction) => {
    switch (action.type) {
      case "open_tasks":
        if (action.filter) {
          setTaskFilters((prev) => ({ ...prev, ...action.filter }));
        }
        setActiveTab("tasks");
        break;
      case "create_task":
        setEditingTask({
          id: "",
          title: action.payload?.title || "Công việc mới từ Chat",
          description: action.payload?.description || "",
          assignee: profile?.displayName || "",
          dueDate: new Date().toISOString().split("T")[0],
          categoryCode: profile?.defaultTaskCategoryCode || "LV_DH",
          status: "todo",
          priority: "medium",
          source: "manual",
          checklist: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        setActiveModal("task-edit");
        break;
      case "open_library":
        setActiveTab("library");
        break;
      case "open_editor":
        setActiveTab("editor");
        break;
      case "search_library":
        setActiveTab("library");
        break;
      case "save_document":
      case "create_tasks":
        // Handle server-side execution
        try {
          if (!user) throw new Error("Vui lòng đăng nhập.");

          let attachmentIds: string[] = [];
          for (let i = chatMessages.length - 1; i >= 0; i--) {
            if (
              chatMessages[i].role === "user" &&
              chatMessages[i].attachments &&
              chatMessages[i].attachments!.length > 0
            ) {
              attachmentIds = chatMessages[i].attachments!.map((a) => a.id);
              break;
            }
          }

          const token = await user.getIdToken();
          const targetIsSave = action.type === "save_document";
          const loadingMsg = targetIsSave
            ? "Đang lưu tài liệu..."
            : "Đang xử lý...";
          const successMsg = targetIsSave
            ? "Lưu tài liệu thành công!"
            : "Thao tác thành công!";

          const tId = toast.loading(loadingMsg);
          const res = await apiFetchJson("/api/chat/actions/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action,
              attachmentIds,
            }),
          });

          toast.dismiss(tId);
          if (res.success) {
            toast.success(successMsg);
          } else {
            toast.error(res.message || "Có lỗi xảy ra.");
          }
        } catch (err: any) {
          toast.error(err.message || "Lỗi server.");
        }
        break;
      default:
        toast(action.label, { icon: "ℹ️" });
    }
    if (
      ["open_tasks", "open_library", "open_editor", "search_library"].includes(
        action.type,
      )
    ) {
      setIsChatOpen(false);
    }
  };
  const [isAddingLibrary, setIsAddingLibrary] = useState(false);
  const [editingCollection, setEditingCollection] =
    useState<LibraryCollection | null>(null);
  const [newLibName, setNewLibName] = useState("");
  const [newLibType, setNewLibType] = useState<LibraryCollectionType>("custom");

  const [isPickingFromLibrary, setIsPickingFromLibrary] = useState(false);
  const [pickingMode, setPickingMode] = useState<"ai" | "task">("ai");
  const [isPickingTaskForDoc, setIsPickingTaskForDoc] =
    useState<DocumentSource | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryFilters, setLibraryFilters] = useState<{
    kind: string;
    status: string;
  }>({ kind: "all", status: "all" });
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    text: string;
    groundingMetadata?: any;
  } | null>(null);

  const setIsPickingFromLibraryForTask = (val: boolean) => {
    setPickingMode("task");
    setIsPickingFromLibrary(val);
  };

  // Text/Link adding state
  const [isAddingText, setIsAddingText] = useState(false);
  const [newTextName, setNewTextName] = useState("");
  const [newTextContent, setNewTextContent] = useState("");
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [sourceActiveTab, setSourceActiveTab] = useState<
    "library" | "web" | "text" | "link" | "upload" | null
  >(null);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [contentReview, setContentReview] = useState<ContentReview | null>(
    null,
  );

  // Illustration Management State
  const [illustrations, setIllustrations] = useState<EditorialIllustration[]>(
    [],
  );
  const [imageAnalysis, setImageAnalysis] =
    useState<EditorialImageAnalysis | null>(null);
  const [imagePlans, setImagePlans] = useState<EditorialIllustrationPlan[]>([]);
  const [isPlanningImages, setIsPlanningImages] = useState(false);
  const [lastAiInput, setLastAiInput] = useState<string>("");
  const [lastAiOutput, setLastAiOutput] = useState<string>("");

  const limitSourceContent = (sources: DocumentSource[]) => {
    const expanded: DocumentSource[] = [];
    for (const s of sources) {
      if (s.driveMimeType === "application/vnd.google-apps.folder") {
        const children = documents.filter(
          (d) =>
            (d.parentDriveFolderId === s.driveFileId ||
              d.metadata?.parentDriveFolderId === s.driveFileId) &&
            d.driveMimeType !== "application/vnd.google-apps.folder",
        );
        if (children.length > 0) {
          expanded.push(...children);
        } else {
          toast.error(
            `Thư mục "${s.name}" đang rỗng hoặc chưa đồng bộ nội dung. Cần Đồng bộ thư mục trước khi dùng chức năng AI.`,
          );
        }
      } else {
        expanded.push(s);
      }
    }

    return expanded.map((s) => {
      const hasRealContent = s.content && s.content.trim().length > 50;
      let displayContent = s.content;

      if (!hasRealContent) {
        displayContent = `[CẢNH BÁO: Tài liệu này hiện chỉ có metadata. KHÔNG ĐƯỢC BỊA ĐẶT NỘI DUNG NẾU KHÔNG CÓ TRONG THÔNG TIN DƯỚI ĐÂY]
        - Tên: ${s.name}
        - Loại: ${s.type}
        - Nguồn: ${s.sourceType || "Không xác định"}
        - Mô tả: ${s.metadata?.description || "Không có mô tả"}`;
      } else if (s.content && s.content.length > 6000) {
        displayContent =
          s.content.substring(0, 6000) +
          "... (Nội dung đã được thu gọn để tối ưu hạn mức AI)";
      }

      return {
        ...s,
        content: displayContent,
      };
    });
  };

  // Session & History Management
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const taskStats = useMemo(() => {
    return {
      total: allTasks.length,
      todo: allTasks.filter((t) => t.status === "todo").length,
      doing: allTasks.filter((t) => t.status === "doing").length,
      review: allTasks.filter((t) => t.status === "review").length,
      blocked: allTasks.filter((t) => t.status === "blocked").length,
      done: allTasks.filter((t) => t.status === "done").length,
      overdue: allTasks.filter((t) => isTaskOverdue(t)).length,
      upcoming: allTasks.filter((t) => isTaskUpcoming(t)).length,
      highPriority: allTasks.filter(
        (t) => t.priority === "urgent" || t.priority === "high",
      ).length,
    };
  }, [allTasks]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      const isSearchMatched =
        !taskFilters.search ||
        t.title.toLowerCase().includes(taskFilters.search.toLowerCase()) ||
        t.description
          .toLowerCase()
          .includes(taskFilters.search.toLowerCase()) ||
        t.assignee.toLowerCase().includes(taskFilters.search.toLowerCase());

      let matchesStatus =
        taskFilters.status === "all" || t.status === taskFilters.status;

      const priorityFilterValue = taskFilters.priority;
      let matchesPriority = true;
      if (priorityFilterValue === "all") {
        matchesPriority = true;
      } else if (priorityFilterValue === HIGH_PRIORITY_FILTER) {
        matchesPriority = t.priority === "urgent" || t.priority === "high";
      } else {
        matchesPriority = t.priority === priorityFilterValue;
      }

      const matchesCategory =
        taskFilters.category === "all" ||
        t.categoryCode === taskFilters.category;

      if (taskFilters.status === "overdue") matchesStatus = isTaskOverdue(t);
      if (taskFilters.status === "upcoming") matchesStatus = isTaskUpcoming(t);

      return (
        isSearchMatched && matchesStatus && matchesPriority && matchesCategory
      );
    });
  }, [allTasks, taskFilters]);

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (d.archived) return false;
      const matchesCollection =
        d.collectionId === activeLibraryId ||
        (!d.collectionId && activeLibraryId === "lib-personal");
      return (
        matchesCollection &&
        matchesSearch(d, librarySearchQuery, libraryFilters)
      );
    });
  }, [documents, activeLibraryId, librarySearchQuery, libraryFilters]);

  // Personal AI Key State
  const [personalAIStatus, setPersonalAIStatus] = useState<{
    hasKey: boolean;
    provider?: string;
    model?: string;
    keyLast4?: string;
    status?: string;
    lastTestedAt?: number;
    useSystem: boolean;
  }>({ hasKey: false, useSystem: true });

  const [editingDocument, setEditingDocument] = useState<DocumentSource | null>(
    null,
  );
  const [isEditingDocModalOpen, setIsEditingDocModalOpen] = useState(false);
  const [docEditForm, setDocEditForm] = useState<{
    name: string;
    description: string;
    collectionId?: string;
    documentKind?: string;
    taskCategoryCode?: string;
  }>({ name: "", description: "" });

  const [documentExplorerFolder, setDocumentExplorerFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [explorerFiles, setExplorerFiles] = useState<any[]>([]);
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);

  const [aiKeyForm, setAiKeyForm] = useState({
    provider: "gemini",
    apiKey: "",
    modelPreset: "gemini-2.5-flash",
    customModel: "",
  });
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState<{
    success: boolean;
    message: string;
    errorType?: string;
  } | null>(null);
  const [showAiKeyForm, setShowAiKeyForm] = useState(false);

  const getEffectiveModel = () => {
    return aiKeyForm.modelPreset === "custom"
      ? aiKeyForm.customModel
      : aiKeyForm.modelPreset;
  };

  const resetTestResultIfFormChanged = (newForm: any) => {
    setAiKeyForm(newForm);
    setKeyTestResult(null);
  };

  const fetchAIKeyStatus = async () => {
    const currentUser = auth.currentUser || user;
    if (!backendReady || !firestoreReady || !authReady || !currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const data = await apiFetchJson("/api/user-ai-key/status", {
        headers: { Authorization: `Bearer ${token}` },
        retries: 5,
        retryDelayMs: 1500,
        allowHtmlRetry: true,
      });

      setPersonalAIStatus(data);
    } catch (err: any) {
      if (
        err?.errorType === "firestore_database_not_found" ||
        err?.errorType === "firestore_unavailable" ||
        err?.errorType === "firestore_init_failed"
      ) {
        console.warn("[AI Key Status] Firestore chưa sẵn sàng:", err.message);
        setPersonalAIStatus({
          hasKey: false,
          useSystem: true,
          status: "none",
        } as any);
        return;
      }
      console.error("[AI Key Status] Failed:", err);
      setPersonalAIStatus({ hasKey: false, useSystem: true } as any);
    }
  };

  useEffect(() => {
    if (backendReady && firestoreReady && authReady && user) {
      fetchAIKeyStatus();
    }
  }, [backendReady, firestoreReady, authReady, user?.uid]);

  const testPersonalKey = async () => {
    if (!aiKeyForm.apiKey) {
      toast.error("Vui lòng nhập API Key");
      return;
    }
    const model = getEffectiveModel();
    if (!model) {
      toast.error("Vui lòng chọn hoặc nhập Model");
      return;
    }

    const currentUser = auth.currentUser || user;
    if (!currentUser) {
      toast.error(
        "Không xác định được người dùng. Vui lòng thử đăng nhập lại.",
      );
      setActiveModal("auth");
      return;
    }

    setIsTestingKey(true);
    setKeyTestResult(null);
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/user-ai-key/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: aiKeyForm.provider,
          apiKey: aiKeyForm.apiKey,
          model: model,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setKeyTestResult({ success: true, message: data.message });
        toast.success(data.message);
      } else {
        setKeyTestResult({
          success: false,
          message: data.message || data.error || "Kiểm tra thất bại",
          errorType: data.errorType,
        });
        toast.error(data.message || data.error || "Kiểm tra thất bại");
      }
    } catch (err: any) {
      setKeyTestResult({ success: false, message: err.message });
      toast.error("Lỗi kết nối: " + err.message);
    } finally {
      setIsTestingKey(false);
    }
  };

  const savePersonalKey = async () => {
    const currentUser = auth.currentUser || user;
    if (!currentUser || !keyTestResult?.success) {
      if (!currentUser) toast.error("Vui lòng đăng nhập để thực hiện.");
      return;
    }
    const model = getEffectiveModel();
    setIsSavingKey(true);
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/user-ai-key/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: aiKeyForm.provider,
          apiKey: aiKeyForm.apiKey,
          model: model,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success("Đã lưu API Key cá nhân!");
        fetchAIKeyStatus();
        setShowAiKeyForm(false);
        setAiKeyForm({
          provider: "gemini",
          apiKey: "",
          modelPreset: "gemini-2.5-flash",
          customModel: "",
        });
        setKeyTestResult(null);
      } else {
        toast.error(data.message || data.error || "Lỗi khi lưu key");
      }
    } catch (err: any) {
      toast.error("Lỗi khi lưu: " + err.message);
    } finally {
      setIsSavingKey(false);
    }
  };

  const deletePersonalKey = async () => {
    const currentUser = auth.currentUser || user;
    if (!currentUser) {
      toast.error("Vui lòng đăng nhập để thực hiện.");
      return;
    }
    const confirmed = await requestConfirmAsync(
      "Bạn có chắc chắn muốn xóa API Key cá nhân và quay về dùng key hệ thống?",
    );
    if (!confirmed) return;
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch("/api/user-ai-key", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success("Đã xóa API Key cá nhân");
        fetchAIKeyStatus();
      }
    } catch (err: any) {
      toast.error("Lỗi khi xóa: " + err.message);
    }
  };
  const [health, setHealth] = useState<any>(null);

  const isSystemAiActive = Boolean(
    health?.hasGeminiKey || health?.hasSystemGeminiKey,
  );
  const isPersonalAiActive =
    personalAIStatus?.status === "active" || personalAIStatus?.hasKey === true;
  const isAiCoreActive = isSystemAiActive || isPersonalAiActive;

  const aiStateStatus = !backendReady
    ? "error"
    : isAiCoreActive
      ? "ready"
      : "unconfigured";
  const aiCoreLabel =
    aiStateStatus === "ready"
      ? "AI sẵn sàng"
      : aiStateStatus === "unconfigured"
        ? "Chưa cấu hình AI"
        : "Backend chưa sẵn sàng";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  // Sync Profile
  useEffect(() => {
    if (!user || !db) {
      setProfile(null);
      return;
    }
    const profileRef = doc(db, "users", user.uid, "profile", "main");
    const unsub = onSnapshot(
      profileRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile(null);
        }
      },
      (error) => {
        console.warn("[Profile Snapshot Error]", error);
      },
    );
    return () => unsub();
  }, [user, db]);

  // Sync Library Collections
  useEffect(() => {
    if (!user || !db) return;
    const collsRef = collection(db, "users", user.uid, "libraryCollections");
    const unsub = onSnapshot(collsRef, (snapshot) => {
      const fbColls: LibraryCollection[] = [];
      snapshot.forEach((d) =>
        fbColls.push({ id: d.id, ...d.data() } as LibraryCollection),
      );

      // Merge with default collections
      setLibraryCollections((prev) => {
        const merged = [...DEFAULT_LIBRARY_COLLECTIONS];
        fbColls.forEach((fc) => {
          if (!fc.id) return; // filter valid id
          const idx = merged.findIndex((m) => m.id === fc.id);
          if (idx >= 0) merged[idx] = fc;
          else merged.push(fc);
        });

        // Final deduplicate by id
        const uniqueMap = new Map();
        merged.forEach((m) => {
          if (m.id) {
            uniqueMap.set(m.id, m);
          }
        });
        return Array.from(uniqueMap.values());
      });
    });
    return () => unsub();
  }, [user?.uid, db]);

  // Sync Documents
  useEffect(() => {
    if (activeModal && isChatOpen) setIsChatOpen(false);
  }, [activeModal, isChatOpen]);

  useEffect(() => {
    if (!user || !db) return;
    const docsRef = collection(db, "users", user.uid, "documents");
    const unsub = onSnapshot(docsRef, (snapshot) => {
      const fbDocs: DocumentSource[] = [];
      snapshot.forEach((d) =>
        fbDocs.push({ id: d.id, ...d.data() } as DocumentSource),
      );
      setDocuments((prev) => {
        const localOnly = prev.filter((d) => d.temporary);
        // Avoid duplicates if any, though temporary shouldn't be in fbDocs
        return [...fbDocs, ...localOnly];
      });
    });
    return () => unsub();
  }, [user?.uid, db]);

  // Sync Sessions
  useEffect(() => {
    if (!user || !db) return;
    const sessionsRef = query(
      collection(db, "users", user.uid, "sessions"),
      orderBy("updatedAt", "desc"),
    );
    const unsub = onSnapshot(sessionsRef, (snapshot) => {
      const fbSessions: ProjectSession[] = [];
      snapshot.forEach((s) =>
        fbSessions.push({ id: s.id, ...s.data() } as ProjectSession),
      );
      setSessions(fbSessions);
    });
    return () => unsub();
  }, [user?.uid, db]);

  // Separate effect for real-time tasks to properly manage subscription lifecycle
  useEffect(() => {
    if (!user || !db) return;

    let unsubscribeLogs: () => void = () => {};

    try {
      const logsQuery = query(
        collection(db, "users", user.uid, "activityLogs"),
        orderBy("createdAt", "desc"),
        limit(5),
      );

      unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
        const logs: any[] = [];
        snapshot.forEach((doc) => logs.push({ id: doc.id, ...doc.data() }));
        setRecentLogs(logs);
      });
    } catch (e) {
      console.error("Error fetching logs", e);
    }

    let unsubscribeTasks: () => void = () => {};

    try {
      const tasksQuery = query(
        collection(db, "users", user.uid, "tasks"),
        orderBy("createdAt", "desc"),
      );

      unsubscribeTasks = onSnapshot(
        tasksQuery,
        (snapshot) => {
          const tasks: WorkTask[] = [];
          snapshot.forEach((doc) =>
            tasks.push({ id: doc.id, ...doc.data() } as WorkTask),
          );
          setAllTasks(tasks);
        },
        (err) => {
          if (err.code === "permission-denied") {
            handleFirestoreError(err, "list", `users/${user.uid}/tasks`);
          } else {
            console.error("Task Sync Error:", err);
          }
        },
      );
    } catch (e) {
      console.error("Critical Firestore Error during setup:", e);
    }

    return () => unsubscribeTasks();
  }, [user?.uid, db]);

  const syncDataFromFirestore = async (userId: string) => {
    // legacy function left empty since we use separate effects now
  };

  // Library Helpers
  const formatLibraryDate = (timestamp: number | string | undefined) => {
    if (!timestamp) return "Chưa có ngày sửa";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Chưa có ngày sửa";
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const createLibraryCollection = async (
    coll: Omit<LibraryCollection, "id" | "ownerId" | "createdAt" | "updatedAt">,
  ) => {
    if (!user || !db) {
      // Local only
      const newColl: LibraryCollection = {
        ...coll,
        id: `lib-${Date.now()}`,
        ownerId: "default",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setLibraryCollections((prev) => [...prev, newColl]);
      return newColl.id;
    }
    try {
      const docRef = await addDoc(
        collection(db, "users", user.uid, "libraryCollections"),
        {
          ...coll,
          ownerId: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      );
      const newColl = {
        id: docRef.id,
        ...coll,
        ownerId: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as LibraryCollection;
      // avoid optimistic update when user is logged in, let onSnapshot handle it
      return docRef.id;
    } catch (err: any) {
      handleFirestoreError(
        err,
        "create",
        `users/${user?.uid}/libraryCollections`,
      );
      return null;
    }
  };

  const updateLibraryCollection = async (
    id: string,
    coll: Partial<LibraryCollection>,
  ) => {
    if (user && db) {
      try {
        await updateDoc(doc(db, "users", user.uid, "libraryCollections", id), {
          ...coll,
          updatedAt: Date.now(),
        });
      } catch (err: any) {
        handleFirestoreError(
          err,
          "update",
          `users/${user.uid}/libraryCollections/${id}`,
        );
      }
    }
    setLibraryCollections((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, ...coll, updatedAt: Date.now() } : c,
      ),
    );
  };

  const deleteLibraryCollection = async (id: string) => {
    if (user && db) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "libraryCollections", id));
      } catch (err: any) {
        handleFirestoreError(
          err,
          "delete",
          `users/${user.uid}/libraryCollections/${id}`,
        );
      }
    }
    setLibraryCollections((prev) => prev.filter((c) => c.id !== id));
    if (activeLibraryId === id) setActiveLibraryId("lib-personal");
  };

  const persistDocument = async (
    docData: Omit<DocumentSource, "id">,
    forceLocal?: boolean,
  ) => {
    const timestamp = Date.now();
    const finalDocData = {
      ...docData,
      collectionId: docData.collectionId || activeLibraryId,
      createdAt: timestamp,
      updatedAt: timestamp,
      ownerId: user?.uid || "default",
    };

    let finalData: any = { ...finalDocData };
    if (docData.type === "link" || docData.type === "drive") {
      const gLink = docData.metadata?.url || docData.content;
      const driveInfo = parseGoogleDriveUrl(gLink);
      if (driveInfo.isGoogleDrive) {
        finalData.type = "drive";
        finalData.sourceType = (driveInfo as any).sourceType;
        finalData.metadata = {
          ...docData.metadata,
          ...driveInfo,
          isGoogleDrive: true,
          driveId: (driveInfo as any).driveId,
        };
        if (!finalData.name || finalData.name === "Web Link") {
          finalData.name = driveInfo.title;
        }
      }
    }

    // If forceLocal is true, or if we decide to use the global saveToLibrary (if we can access it here)
    // Actually, forceLocal is cleaner.
    if (forceLocal) {
      const localDoc = {
        id: `local-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        ...finalData,
        temporary: true,
      } as DocumentSource;

      setDocuments((prev) => [localDoc, ...prev]);
      return localDoc;
    }

    if (user && db) {
      try {
        const docRef = await addDoc(
          collection(db, "users", user.uid, "documents"),
          finalData,
        );
        const newDoc = { id: docRef.id, ...finalData } as DocumentSource;

        // Update local state if not already there
        setDocuments((prev) => [newDoc, ...prev]);

        await logActivity({
          module: "library",
          action: "created",
          entityType: finalData.type === "drive" ? "drive_file" : "document",
          entityId: docRef.id,
          entityTitle: finalData.name,
          title: "Thêm tài liệu mới",
          summary: `Đã thêm tài liệu "${finalData.name}" vào Kho tư liệu.`,
          metadata: { source: "client" },
        });

        // KNOWLEDGE INDEXING
        getChatAuthToken()
          .then((authToken) => {
            apiFetchJson("/api/knowledge/index-document", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ documentId: newDoc.id }),
            }).catch(console.error);
          })
          .catch(console.error);

        // avoid optimistic update when user is logged in, let onSnapshot handle it
        return newDoc;
      } catch (err: any) {
        handleFirestoreError(err, "create", `users/${user.uid}/documents`);
        return null;
      }
    } else {
      const newDoc = {
        id: Math.random().toString(36).substr(2, 9),
        ...finalData,
      } as DocumentSource;
      setDocuments((prev) => {
        const updated = [...prev, newDoc];
        localStorage.setItem("vms_documents", JSON.stringify(updated));
        return updated;
      });
      return newDoc;
    }
  };

  const persistSession = async (
    sessionData: Omit<ProjectSession, "id">,
    existingId?: string | null,
  ) => {
    if (user) {
      try {
        if (existingId) {
          const sessionRef = doc(db, "users", user.uid, "sessions", existingId);
          await updateDoc(sessionRef, {
            ...sessionData,
            updatedAt: Date.now(),
          });

          await logActivity({
            module: "editorial",
            action: "updated",
            entityType: "editorial_session",
            entityId: existingId,
            entityTitle: sessionData.title,
            title: "Cập nhật phiên biên tập",
            summary: `Đã lưu cập nhật cho phiên bản bài viết "${sessionData.title}".`,
            metadata: { source: "client" },
          });

          setSessions((prev) =>
            prev.map((s) =>
              s.id === existingId
                ? { ...s, ...sessionData, updatedAt: Date.now() }
                : s,
            ),
          );
          return existingId;
        } else {
          const dataToInsert = {
            ...sessionData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const sessionRef = await addDoc(
            collection(db, "users", user.uid, "sessions"),
            dataToInsert,
          );

          await logActivity({
            module: "editorial",
            action: "created",
            entityType: "editorial_session",
            entityId: sessionRef.id,
            entityTitle: sessionData.title,
            title: "Tạo phiên biên tập mới",
            summary: `Đã tạo lưu nháp bài viết mới "${sessionData.title}".`,
            metadata: { source: "client" },
          });

          const newSession = {
            id: sessionRef.id,
            ...dataToInsert,
          } as ProjectSession;
          // onSnapshot handles it
          return sessionRef.id;
        }
      } catch (err: any) {
        handleFirestoreError(
          err,
          existingId ? "update" : "create",
          `sessions/${existingId || ""}`,
        );
        return null;
      }
    } else {
      const timestamp = Date.now();
      if (existingId) {
        setSessions((prev) => {
          const updated = prev.map((s) =>
            s.id === existingId
              ? { ...s, ...sessionData, updatedAt: timestamp }
              : s,
          );
          localStorage.setItem("vms_sessions", JSON.stringify(updated));
          return updated as ProjectSession[];
        });
        return existingId;
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        const newSession = {
          id,
          ...sessionData,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as ProjectSession;
        setSessions((prev) => {
          const updated = [newSession, ...prev];
          localStorage.setItem("vms_sessions", JSON.stringify(updated));
          return updated;
        });
        return id;
      }
    }
  };

  function parseGoogleDriveUrl(url: string) {
    const patterns = [
      {
        sourceType: "google_drive_file",
        regex: /drive\.google\.com\/file\/d\/([^/]+)/,
        buildOpenUrl: (id: string) =>
          `https://drive.google.com/file/d/${id}/view`,
        buildPreviewUrl: (id: string) =>
          `https://drive.google.com/file/d/${id}/preview`,
        title: "Tệp Google Drive",
      },
      {
        sourceType: "google_drive_folder",
        regex: /drive\.google\.com\/drive\/folders\/([^/?]+)/,
        buildOpenUrl: (id: string) =>
          `https://drive.google.com/drive/folders/${id}`,
        buildPreviewUrl: (_id: string) => "",
        title: "Thư mục Google Drive",
      },
      {
        sourceType: "google_docs",
        regex: /docs\.google\.com\/document\/d\/([^/]+)/,
        buildOpenUrl: (id: string) =>
          `https://docs.google.com/document/d/${id}/edit`,
        buildPreviewUrl: (id: string) =>
          `https://docs.google.com/document/d/${id}/preview`,
        title: "Google Docs",
      },
      {
        sourceType: "google_sheets",
        regex: /docs\.google\.com\/spreadsheets\/d\/([^/]+)/,
        buildOpenUrl: (id: string) =>
          `https://docs.google.com/spreadsheets/d/${id}/edit`,
        buildPreviewUrl: (id: string) =>
          `https://docs.google.com/spreadsheets/d/${id}/preview`,
        title: "Google Sheets",
      },
      {
        sourceType: "google_slides",
        regex: /docs\.google\.com\/presentation\/d\/([^/]+)/,
        buildOpenUrl: (id: string) =>
          `https://docs.google.com/presentation/d/${id}/edit`,
        buildPreviewUrl: (id: string) =>
          `https://docs.google.com/presentation/d/${id}/preview`,
        title: "Google Slides",
      },
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern.regex);
      if (match?.[1]) {
        const id = match[1];
        return {
          isGoogleDrive: true,
          sourceType: pattern.sourceType,
          driveId: id,
          title: pattern.title,
          url,
          openUrl: pattern.buildOpenUrl(id),
          previewUrl: pattern.buildPreviewUrl(id),
        };
      }
    }

    return {
      isGoogleDrive: false,
      sourceType: "web_link",
      url,
      openUrl: url,
      previewUrl: "",
    };
  }

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url;
    }
  };

  const handleSyncDriveFolder = async (
    folderId: string,
    folderName: string,
  ) => {
    if (!user) return;
    setIsSyncingDrive(folderId);
    try {
      const rawToken = await user.getIdToken();
      const token = rawToken
        ? String(rawToken)
            .trim()
            .replace(/[\r\n]/g, "")
        : "";
      const response = await fetch("/api/drive/sync-public-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ folderId, collectionId: activeLibraryId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Lỗi khi đồng bộ Drive");

      if (data.stats.added > 0 || data.stats.updated > 0) {
        toast.success(
          `Đã đồng bộ ${folderName}: ${data.stats.added} mới, ${data.stats.updated} cập nhật.`,
        );
      } else {
        toast.success("Dữ liệu thư mục đã được cập nhật bản mới nhất.");
      }

      await logActivity({
        module: "library",
        action: "synced",
        entityType: "drive_folder",
        entityId: folderId,
        entityTitle: folderName,
        title: "Đồng bộ Google Drive",
        summary: `Đã đồng bộ thư mục "${folderName}": thêm ${data.stats?.added || 0}, cập nhật ${data.stats?.updated || 0}, lỗi ${data.stats?.failed || 0}.`,
        metadata: { source: "drive_sync" },
      });
    } catch (err: any) {
      console.error("Sync Error:", err);
      toast.error("Lỗi đồng bộ: " + err.message);
    } finally {
      setIsSyncingDrive(null);
    }
  };

  const handleAnalyzeDocument = async (docId: string) => {
    if (!user) return;
    setIsAnalyzing(docId);
    try {
      const rawToken = await user.getIdToken();
      const token = rawToken
        ? String(rawToken)
            .trim()
            .replace(/[\r\n]/g, "")
        : "";
      const data = await apiFetchJson(
        `/api/documents/${encodeURIComponent(docId)}/analyze`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (data.document || data.analysis) {
        const analysis = data.analysis || {};
        const summaryData = analysis.summary || data.document?.summary;
        const docUpdates: any = {
          contentStatus: data.document?.contentStatus || "extracted",
          updatedAt: Date.now(),
        };
        if (summaryData) docUpdates.summary = summaryData;
        if (analysis.taskCategoryCode)
          docUpdates.taskCategoryCode = analysis.taskCategoryCode;
        if (analysis.taskCategoryName)
          docUpdates.taskCategoryName = analysis.taskCategoryName;
        if (analysis.documentKind)
          docUpdates.documentKind = analysis.documentKind;

        if (Object.keys(docUpdates).length > 0) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === docId ? { ...d, ...docUpdates } : d)),
          );
          if (previewDocument?.id === docId) {
            setPreviewDocument((prev) =>
              prev ? { ...prev, ...docUpdates } : null,
            );
            setDocumentDetailTab("ai");
          }
        }
      }

      toast.success("Phân tích tài liệu hoàn tất");

      const docTitle =
        documents.find((d) => d.id === docId)?.name || "Tài liệu";
      await logActivity({
        module: "library",
        action: "analyzed",
        entityType: "document",
        entityId: docId,
        entityTitle: docTitle,
        title: "AI phân tích tài liệu",
        summary: `Đã dùng AI phân tích & tóm tắt tài liệu "${docTitle}".`,
        metadata: { source: "ai" },
      });
    } catch (err: any) {
      console.error("Analyze Error:", err);
      toast.error("Lỗi phân tích: " + err.message);
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleExtractScan = async (documentId: string) => {
    if (!user) return;
    setIsExtractingScan(documentId);

    // Optimistic update
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === documentId ? { ...d, contentStatus: "ocr_processing" } : d,
      ),
    );
    if (previewDocument?.id === documentId) {
      setPreviewDocument((prev) =>
        prev ? { ...prev, contentStatus: "ocr_processing" } : null,
      );
    }

    try {
      const rawToken = await user.getIdToken(true);
      const token = rawToken
        ? String(rawToken)
            .trim()
            .replace(/[\r\n]/g, "")
        : "";
      const resp = await fetch("/api/ai/extract-scan", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 413) {
          throw new Error("Tài liệu quá lớn (>20MB) để xử lý OCR AI.");
        }
        throw new Error(data.message || "Lỗi trích xuất OCR");
      }

      toast.success("Đã đọc tài liệu bằng AI thành công!");
      const updates = {
        content: data.text,
        contentStatus: "extracted" as const,
        sourceLimitNote: data.contentTruncated
          ? "Nội dung đã được rút gọn do quá dài."
          : "",
      };

      setDocuments((prev) =>
        prev.map((d) => (d.id === documentId ? { ...d, ...updates } : d)),
      );
      if (previewDocument?.id === documentId) {
        setPreviewDocument((prev) => (prev ? { ...prev, ...updates } : null));
        if (data.needsAnalyze) {
          setDocumentDetailTab("ai");
          handleAnalyzeDocument(documentId);
        }
      }

      await logActivity({
        module: "library",
        action: "updated",
        entityType: "document",
        entityId: documentId,
        entityTitle: previewDocument?.name || "Tài liệu",
        title: "Trích xuất OCR AI",
        summary: `Đã thực hiện quét ảnh bằng AI cho tài liệu "${previewDocument?.name}". Độ dài trích xuất: ${data.textLength} ký tự.`,
        metadata: { method: "ai_ocr", source: "client" },
      });
    } catch (err: any) {
      console.error("OCR Error:", err);
      toast.error("Lỗi OCR: " + err.message);

      // Set status to ocr_failed
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === documentId ? { ...d, contentStatus: "ocr_failed" } : d,
        ),
      );
      if (previewDocument?.id === documentId) {
        setPreviewDocument((prev) =>
          prev ? { ...prev, contentStatus: "ocr_failed" } : null,
        );
      }
    } finally {
      setIsExtractingScan(null);
    }
  };

  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem("vms_documents", JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem("vms_sessions", JSON.stringify(sessions));
  }, [sessions]);

  const saveCurrentToSession = async (newOutput?: string) => {
    const finalOutput = newOutput ?? output;
    if (!finalOutput) return;

    // CONSTRAINT 3: Check session size (700,000 chars limit for currentOutput)
    if (finalOutput.length > 700000) {
      toast.error(
        "Nội dung bài viết quá lớn (>700k ký tự). Vui lòng rút gọn hoặc chia nhỏ session để đảm bảo lưu trữ ổn định trên Firestore.",
      );
      return;
    }

    const timestamp = Date.now();
    const newVersion: ArticleVersion = {
      id: Math.random().toString(36).substr(2, 9),
      content: finalOutput,
      timestamp,
      note: isEditing ? "Chỉnh sửa bởi người dùng" : "Tạo mới bởi AI",
      illustrations,
    };

    const sessionData: Omit<ProjectSession, "id"> = {
      title:
        input.substring(0, 50) || `Bài viết ${new Date().toLocaleDateString()}`,
      taskType,
      style,
      format: outputFormat,
      documentIds: selectedSourceDocIds,
      currentOutput: finalOutput,
      versions: [] as ArticleVersion[],
      illustrations,
      createdAt:
        sessions.find((s) => s.id === currentSessionId)?.createdAt ||
        Date.now(),
      updatedAt: Date.now(),
    };

    if (currentSessionId) {
      const currentSess = sessions.find((s) => s.id === currentSessionId);
      sessionData.versions = [newVersion, ...(currentSess?.versions || [])];
      await persistSession(sessionData, currentSessionId);
    } else {
      sessionData.versions = [newVersion];
      const newId = await persistSession(sessionData);
      if (newId) setCurrentSessionId(newId);
    }
  };

  const loadSession = (session: ProjectSession) => {
    setCurrentSessionId(session.id);
    setTaskType(session.taskType);
    setStyle(session.style);
    setInput(session.title);
    setOutput(session.currentOutput);
    setSelectedSourceDocIds(session.documentIds);
    setIllustrations(session.illustrations || []);
    setActiveTab("editor");
  };

  const createNewSession = () => {
    closeMobileDrawer();
    setCurrentSessionId(null);
    setInput("");
    setOutput("");
    setIllustrations([]);
    setSelectedSourceDocIds([]);
    setIsEditing(false);
    setActiveTab("editor"); // Switch to editor for new article
  };

  const handleSaveSlideOutline = async (result: SlideOutlineResult) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu");
      return;
    }
    try {
      const currentSess = sessions.find((s) => s.id === currentSessionId);
      const isCurrentSlideSession =
        currentSessionId && currentSess?.taskType === "SLIDE_OUTLINE";
      let actualSessionId = isCurrentSlideSession
        ? currentSessionId
        : undefined;
      let versionNumber = 1;

      if (!actualSessionId) {
        actualSessionId = `slide-${Date.now()}`;
      } else if (currentSess) {
        versionNumber = (currentSess.versions?.length || 0) + 1;
      }

      const sessionRef = doc(
        db,
        "users",
        user.uid,
        "sessions",
        actualSessionId,
      );

      const newVersion = {
        id: `v-${Date.now()}`,
        version: versionNumber,
        content: JSON.stringify(result, null, 2),
        structuredContent: result,
        createdAt: Date.now(),
      };

      if (!isCurrentSlideSession || !currentSessionId) {
        const sessionData = {
          id: actualSessionId,
          taskType: "SLIDE_OUTLINE",
          style: result.style || "chuyen_nghiep",
          format: "SLIDE",
          title: result.title,
          currentOutput: JSON.stringify(result, null, 2),
          documentIds: selectedSourceDocIds,
          versions: [newVersion],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await setDoc(sessionRef, sessionData);
        setSessions((prev) => [sessionData as any, ...prev]);
        setCurrentSessionId(actualSessionId);
      } else {
        const updatePayload = {
          title: result.title,
          currentOutput: JSON.stringify(result, null, 2),
          documentIds: selectedSourceDocIds,
          versions: [newVersion, ...(currentSess?.versions || [])],
          updatedAt: Date.now(),
        };

        await updateDoc(sessionRef, updatePayload);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === actualSessionId ? { ...s, ...updatePayload } : s,
          ),
        );
      }

      await logActivity({
        action: isCurrentSlideSession ? "updated" : "created",
        module: "editorial",
        entityType: "editorial_session",
        entityId: actualSessionId,
        entityTitle: result.title,
        title: "Lưu phác thảo Slide",
        summary: `Đã lưu phác thảo slide "${result.title}" gồm ${result.slideCount} slide.`,
        metadata: { source: "client" },
      });

      toast.success("Đã lưu phác thảo slide vào lịch sử báo cáo/bài viết");
    } catch (e) {
      console.error(e);
      toast.error("Không thể lưu phác thảo");
    }
  };

  const handleCreateTaskFromSlideOutline = (result: SlideOutlineResult) => {
    // Identify slides with caution notes for verification tasks
    const slidesWithCaution = result.slides.filter(
      (s) => s.cautionNotes && s.cautionNotes.length > 0,
    );

    const checklistItems = [
      {
        id: `c1-${Date.now()}`,
        title: "Rà soát cấu trúc tổng thể slide",
        done: false,
        createdAt: Date.now(),
      },
      {
        id: `c2-${Date.now()}`,
        title: "Thiết kế Visual Assets (Ảnh, Icon) theo gợi ý",
        done: false,
        createdAt: Date.now(),
      },
      {
        id: `c3-${Date.now()}`,
        title: "Luyện tập thuyết minh theo Speaker Notes",
        done: false,
        createdAt: Date.now(),
      },
    ];

    // Add specific verification tasks for caution notes
    slidesWithCaution.forEach((s, idx) => {
      checklistItems.push({
        id: `caution-${s.slideNumber}-${idx}-${Date.now()}`,
        title: `Xác minh số liệu Slide ${s.slideNumber}: ${s.cautionNotes![0].substring(0, 40)}...`,
        done: false,
        createdAt: Date.now(),
      });
    });

    setEditingTask({
      id: "",
      title: `Hoàn thiện Slide Deck: ${result.title}`,
      description: `Mục tiêu: Hoàn thiện bài thuyết trình cho đối tượng ${result.audience}.\n\nThông điệp chính: ${result.mainMessage}\n\nPhong cách: ${result.style}\nSố lượng: ${result.slideCount} slides.\n\nCần lưu ý rà soát kỹ các slide: ${slidesWithCaution.map((s) => s.slideNumber).join(", ") || "Không có cảnh báo"}`,
      categoryCode: "LV_VPDT",
      assignee: user?.uid || "",
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      status: "todo",
      priority: "high",
      source: "manual",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      checklist: checklistItems,
    });
    closeMobileDrawer();
    setActiveModal("task-edit");
  };

  const handleBuildTasks = async () => {
    if (!input.trim()) {
      toast.error("Vui lòng nhập nội dung mô tả công việc");
      return;
    }

    setIsBuildingTasks(true);
    setError(null);
    try {
      const token = user ? await user.getIdToken() : undefined;
      const response = await fetch("/api/tasks/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: input,
          today: new Date().toISOString().split("T")[0],
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "Asia/Ho_Chi_Minh",
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Không thể trích xuất công việc từ AI");

      const newTasks = (data.tasks || []).map((t: any) => {
        // Fallback safety
        const safeCategory = TASK_CATEGORIES.some(
          (c) => c.code === t.categoryCode,
        )
          ? t.categoryCode
          : "LV_DH";
        return {
          ...t,
          id: `wt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: t.status || "todo",
          priority: ["low", "medium", "high", "urgent"].includes(t.priority)
            ? t.priority
            : "medium",
          categoryCode: safeCategory,
          isDeputy: !!t.isDeputy,
          assignee: "", // Keep empty as it requires user selection
          assigneeText: t.assigneeText || t.assignee || "",
          sourceText: t.sourceText || "",
          nextActions: t.nextActions || [],
          dueDate: t.dueDate || "",
          selected: true, // Auto selected
          source: "ai",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }) as (WorkTask & { selected?: boolean })[];

      setBuiltTasks(newTasks);
      toast.success(`Đã trích xuất ${newTasks.length} công việc`);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsBuildingTasks(false);
    }
  };

  const persistTask = async (
    taskDataOrPartial: Omit<WorkTask, "id"> | Partial<WorkTask>,
  ) => {
    if (!user) {
      toast.error("Chỉ người dùng đã đăng nhập mới có thể lưu công việc.");
      return null;
    }
    try {
      // In TS context inside handleSendChat we defined sanitizeTaskForSave,
      // but persistTask is out of that scope. I should move it or redefine.
      // Re-defining inside or using a global one.

      const categoryCode =
        taskDataOrPartial.categoryCode &&
        TASK_CATEGORIES.some((c) => c.code === taskDataOrPartial.categoryCode)
          ? taskDataOrPartial.categoryCode
          : "LV_DH";

      const finalData = {
        title: String(taskDataOrPartial.title || "").trim(),
        assignee: String(taskDataOrPartial.assignee || "").trim(),
        dueDate: String(taskDataOrPartial.dueDate || ""),
        categoryCode,
        isDeputy: !!taskDataOrPartial.isDeputy,
        assignmentCode: taskDataOrPartial.assignmentCode || "",
        assignmentName: taskDataOrPartial.assignmentName || "",
        description: String(taskDataOrPartial.description || "").trim(),
        status: ["todo", "doing", "review", "done", "blocked"].includes(
          taskDataOrPartial.status as string,
        )
          ? (taskDataOrPartial.status as any)
          : "todo",
        priority: ["low", "medium", "high", "urgent"].includes(
          taskDataOrPartial.priority as string,
        )
          ? (taskDataOrPartial.priority as any)
          : "medium",
        source: taskDataOrPartial.source === "ai" ? "ai" : "manual",
        ownerId: user.uid,
        linkedDocumentIds: Array.isArray(taskDataOrPartial.linkedDocumentIds)
          ? taskDataOrPartial.linkedDocumentIds
          : [],
        checklist: Array.isArray(taskDataOrPartial.checklist)
          ? taskDataOrPartial.checklist.map((item) => ({
              id:
                item.id ||
                `check-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              title: item.title,
              done: !!item.done,
              createdAt: item.createdAt || Date.now(),
              updatedAt: Date.now(),
            }))
          : [],
        parentGroupTitle: taskDataOrPartial.parentGroupTitle || "",
        createdAt: taskDataOrPartial.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      const docRef = await addDoc(
        collection(db, "users", user.uid, "tasks"),
        finalData,
      );

      await logActivity({
        module: "task",
        action: "created",
        entityType: "task",
        entityId: docRef.id,
        entityTitle: finalData.title,
        title: "Tạo nhiệm vụ",
        summary: `Đã tạo nhiệm vụ "${finalData.title}".`,
        metadata: { source: "client" },
      });

      return docRef.id;
    } catch (err: any) {
      handleFirestoreError(err, "create", "tasks");
      return null;
    }
  };

  const handleUpdateTask = async (
    taskId: string,
    updates: Partial<WorkTask>,
  ) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", taskId);
      await updateDoc(taskRef, {
        ...updates,
        updatedAt: Date.now(),
      });

      const updatedTaskTitle =
        updates.title ||
        allTasks.find((t) => t.id === taskId)?.title ||
        "Nhiệm vụ";
      await logActivity({
        module: "task",
        action: "updated",
        entityType: "task",
        entityId: taskId,
        entityTitle: updatedTaskTitle,
        title: "Cập nhật nhiệm vụ",
        summary: `Đã cập nhật thông tin nhiệm vụ "${updatedTaskTitle}".`,
        changedFields: Object.keys(updates),
        metadata: { source: "client" },
      });

      toast.success("Đã cập nhật công việc.");
      setActiveModal(null);
      setEditingTask(null);
    } catch (err: any) {
      handleFirestoreError(err, "update", `tasks/${taskId}`);
    }
  };

  const updateTaskStatus = async (
    taskId: string,
    status: WorkTask["status"],
  ) => {
    if (!user) return;
    try {
      const taskRef = doc(db, "users", user.uid, "tasks", taskId);
      const updateData: any = {
        status,
        updatedAt: Date.now(),
      };
      if (status === "done") {
        updateData.completedAt = Date.now();
      }
      await updateDoc(taskRef, updateData);

      const task = allTasks.find((t) => t.id === taskId);
      if (task) {
        await logActivity({
          module: "task",
          action: "status_changed",
          entityType: "task",
          entityId: taskId,
          entityTitle: task.title,
          title: "Đổi trạng thái nhiệm vụ",
          summary: `Đã đổi trạng thái nhiệm vụ "${task.title}" từ "${TASK_STATUS_LABELS[task.status] || task.status}" sang "${TASK_STATUS_LABELS[status] || status}".`,
          changedFields: ["status"],
          metadata: {
            statusFrom: task.status,
            statusTo: status,
            source: "client",
          },
        });
      }

      toast.success("Đã cập nhật trạng thái công việc.");
    } catch (err: any) {
      handleFirestoreError(err, "update", `tasks/${taskId}`);
    }
  };

  const handleProcess = async () => {
    if (!input.trim() && selectedSourceDocIds.length === 0) return;

    // Cache check
    const currentInputSignature = `${taskType}-${style}-${outputFormat}-${input.substring(0, 500)}-${selectedSourceDocIds.join(",")}`;
    if (currentInputSignature === lastAiInput && lastAiOutput) {
      const confirmed = await requestConfirmAsync(
        "Nội dung yêu cầu trùng khớp với lần gọi AI trước đó. Bạn có muốn dùng lại kết quả cũ để tiết kiệm hạn mức không?",
      );
      if (confirmed) {
        setOutput(lastAiOutput);
        setIsEditing(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const selectedSources = documents.filter((d) =>
        selectedSourceDocIds.includes(d.id),
      );
      const limitedSources = limitSourceContent(selectedSources);

      const token = user ? await user.getIdToken() : undefined;

      let finalInput = input;
      if (taskType === "WRITE_NEW") {
        finalInput = buildEditorialPrompt(
          editorialKind,
          input,
          limitedSources,
          {},
        );
      }

      const response = await processTask(
        taskType,
        finalInput,
        style,
        outputFormat,
        limitedSources,
        token,
      );

      let generatedOutput = "";
      if (typeof response === "string") {
        generatedOutput = response;
        setContentReview(null);
      } else if (
        response &&
        typeof response === "object" &&
        response.isReview
      ) {
        generatedOutput = response.text || response.review?.improvedText || "";
        setContentReview(response.review);
      } else {
        generatedOutput = response?.text || "";
        setContentReview(null);
      }

      setOutput(generatedOutput);
      setLastAiInput(currentInputSignature);
      setLastAiOutput(generatedOutput);
      setIsEditing(false);

      // Auto save to session
      saveCurrentToSession(generatedOutput);

      // Auto local plan
      const localAnalysis = buildLocalImageAnalysis(
        generatedOutput,
        illustrations,
      );
      setImagePlans(localAnalysis.plans || []);

      if (window.innerWidth >= 1024 && outputRef.current) {
        outputRef.current.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err: any) {
      const isQuota =
        err?.message?.includes("429") || err?.message?.includes("Hạn mức");
      const msg = isQuota
        ? "Hệ thống AI đang tạm thời hết hạn mức. Vui lòng thử lại sau 1 phút hoặc biên tập bài viết thủ công."
        : err?.message ||
          "Đã xảy ra lỗi khi xử lý. Vui lòng kiểm tra lại kết nối hoặc API Key.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualUpload = async (
    file: File,
    paragraphIndex: number = 0,
    planId?: string,
  ) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để tải ảnh.");
      return;
    }

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn.");
      return;
    }

    setIsLoading(true);
    const id = `manual-${Date.now()}`;
    const subPath = currentSessionId || "draft";

    try {
      const { ref, uploadBytes, getDownloadURL } =
        await import("firebase/storage");
      // CONSTRAINT 4: Specific storage path pattern
      const storageRef = ref(
        storage,
        `illustrations/${user.uid}/${subPath}/${id}`,
      );
      await uploadBytes(storageRef, file, { contentType: file.type });
      const imageUrl = await getDownloadURL(storageRef);

      const matchingPlan = imagePlans.find((p) => p.id === planId);

      const newIllustration: EditorialIllustration = {
        id,
        planId: planId || `manual-${id}`,
        url: imageUrl,
        storagePath: storageRef.fullPath,
        prompt: matchingPlan?.prompt || "Manual upload",
        caption: matchingPlan?.caption || "Ảnh tải lên thủ công",
        paragraphIndex: matchingPlan?.paragraphIndex ?? paragraphIndex,
        insertAfter: matchingPlan?.insertAfter || "",
        status: "ready",
        qualityStatus: "unchecked",
        qualitySummary: "Ảnh tải lên thủ công.",
        qualityWarnings: [],
        reviewStatus: "suggested",
        createdAt: Date.now(),
      };

      setIllustrations((prev) => {
        const updated = [newIllustration, ...prev];
        // CONSTRAINT 4: Autosave session if exists
        if (currentSessionId) {
          setTimeout(() => saveCurrentToSession(output), 500);
        }
        return updated;
      });
      toast.success(
        "Đã tải ảnh lên thành công. Vui lòng duyệt ảnh để xuất văn bản.",
      );
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Lỗi khi tải ảnh lên.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalIllustrationScan = async () => {
    if (!output) return;
    setIsPlanningImages(true);
    try {
      const analysis = buildLocalImageAnalysis(output, illustrations);
      // Quét cục bộ dựa trên placeholder trong văn bản
      setImagePlans(analysis.plans || []);
      toast.success(
        `Đã tự động xác định ${analysis.plans?.length || 0} vị trí hình ảnh dựa trên ghi chú trong bài.`,
      );
    } catch (err: any) {
      toast.error(err.message || "Không thể quét vị trí hình ảnh");
    } finally {
      setIsPlanningImages(false);
    }
  };

  const handleAIIllustrationSuggestions = async () => {
    if (!output) return;
    setIsPlanningImages(true);
    try {
      const analysis = buildLocalImageAnalysis(output, illustrations);
      const token = user ? await user.getIdToken() : undefined;
      const { plans } = await planEditorialImages(output, analysis, token);
      setImagePlans(plans);
      toast.success(
        `AI đã gợi ý thêm ${plans.length} vị trí minh họa phù hợp.`,
      );
    } catch (err: any) {
      const isQuota = err?.message?.includes("429");
      toast.error(
        isQuota
          ? "Hạn mức AI tạm dùng cho chức năng này đang hết. Vui lòng dùng quét cục bộ."
          : err.message || "Lỗi gọi AI gợi ý",
      );
    } finally {
      setIsPlanningImages(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: "GENERAL" | "PROJECT" = "PROJECT",
  ) => {
    const files = e.target.files;
    if (!files) return;

    setError(null);

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const allowedExtensions = [
      "pdf",
      "docx",
      "xlsx",
      "xls",
      "csv",
      "txt",
      "md",
    ];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Size validation
      if (file.size > MAX_SIZE) {
        toast.error(`Tệp ${file.name} quá lớn (tối đa 10MB).`);
        continue;
      }

      // Extension validation
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !allowedExtensions.includes(ext)) {
        toast.error(`Định dạng tệp ${file.name} không hỗ trợ.`);
        continue;
      }

      const taskId = `task-file-${Date.now()}-${i}`;
      setBackgroundTasks((prev) => [
        {
          id: taskId,
          url: "",
          title: file.name,
          type: "file",
          status: "processing",
          startedAt: Date.now(),
        },
        ...prev,
      ]);

      // Process file asynchronously so we don't block the loop completely
      // Wait, for loop is fine, but we can do it and update state correctly.
      // Actually letting it be awaited is okay since it's just local client side processing.
      // But doing it without blocking UI requires setTimeout or Promise.all.
      // Or we can just `parseFile` without await but loop will finish instantly.
      // We'll await inside an async IIFE to not block loop
      (async () => {
        try {
          const content = await parseFile(file);
          const type = file.name.endsWith(".pdf")
            ? "pdf"
            : file.name.endsWith(".docx")
              ? "word"
              : file.name.endsWith(".xlsx") || file.name.endsWith(".xls")
                ? "excel"
                : "text";

          const docData: Omit<DocumentSource, "id"> = {
            name: file.name,
            content,
            type: type as any,
            category,
            collectionId: activeLibraryId,
            metadata: {
              description: `Tệp tải lên: ${file.name}`,
              modifiedTime: new Date(file.lastModified).toISOString(),
              size: file.size,
            },
          };
          const newDoc = await persistDocument(docData, !saveToLibrary);
          if (newDoc && category === "PROJECT") {
            setSelectedSourceDocIds((prev) =>
              prev.includes(newDoc.id) ? prev : [...prev, newDoc.id],
            );
          }
          setBackgroundTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "success" } : t,
            ),
          );
          toast.success(
            `Đã nạp ${newDoc?.temporary ? "tạm" : ""} tệp "${file.name}"`,
          );
          setSourceActiveTab(null);
          setActiveTab("activity");
          setTimeout(() => {
            setBackgroundTasks((prev) => prev.filter((t) => t.id !== taskId));
          }, 3000);
        } catch (err: any) {
          console.error("File Parse Error:", err);
          toast.error(`Lỗi xử lý file ${file.name}: ${err.message}`);
          setBackgroundTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, status: "error", message: err.message }
                : t,
            ),
          );
        }
      })();
    }

    setIsAddingLink(false);
    setIsAddingText(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleWebSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const token = user ? await user.getIdToken() : undefined;
      const results = await searchWebSources(searchQuery, token);
      setSearchResults(results);
    } catch (err: any) {
      const msg = err?.message || "Lỗi khi tìm kiếm thông tin trên web.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const addSearchResultAsSource = async (
    title: string,
    content: string,
    url?: string,
  ) => {
    const newDocData: Omit<DocumentSource, "id"> = {
      name: title,
      content: content,
      type: "link",
      category: "PROJECT",
      metadata: { title, url },
    };
    const newDoc = await persistDocument(newDocData, true); // Always local for web results
    if (newDoc) {
      setSelectedSourceDocIds((prev) =>
        prev.includes(newDoc.id) ? prev : [...prev, newDoc.id],
      );
      toast.success("Đã nạp nội dung làm nguồn.");
    }
  };

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const linkContainerRef = useRef<HTMLDivElement>(null);

  // Auto-close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSearching &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearching(false);
      }
      if (
        isAddingText &&
        textContainerRef.current &&
        !textContainerRef.current.contains(event.target as Node)
      ) {
        setIsAddingText(false);
      }
      if (
        isAddingLink &&
        linkContainerRef.current &&
        !linkContainerRef.current.contains(event.target as Node)
      ) {
        setIsAddingLink(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSearching, isAddingText, isAddingLink]);

  const handleAddLink = async () => {
    const url = newLinkUrl.trim();
    if (!url || (!url.startsWith("http") && !url.startsWith("www"))) return;

    // Check if it's a Google Drive link
    const isDrive =
      url.includes("drive.google.com") || url.includes("docs.google.com");

    if (isDrive) {
      await handleImportDriveLink(url);
      return;
    }

    if (!user) {
      toast.error("Vui lòng đăng nhập để thêm liên kết.");
      return;
    }

    setNewLinkUrl("");
    setIsAddingLink(false);

    const taskId = `task-${Date.now()}`;
    setBackgroundTasks((prev) => [
      {
        id: taskId,
        url,
        type: "link",
        status: "processing",
        startedAt: Date.now(),
      },
      ...prev,
    ]);

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        `/api/fetch-link?url=${encodeURIComponent(url)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );

      const data = await response.json();
      if (!response.ok) {
        const errorMsg =
          data.message || data.error || "Không thể lấy dữ liệu từ link này";
        throw new Error(errorMsg);
      }

      const docData: Omit<DocumentSource, "id"> = {
        name: data.title || url,
        content: data.content || `Nguồn Link: ${url}`,
        type: "link",
        category: "PROJECT",
        collectionId: activeLibraryId,
        metadata: {
          title: data.title,
          description: data.description,
          favicon: data.favicon,
          url: url,
        },
      };
      const newDoc = await persistDocument(docData, !saveToLibrary);
      if (newDoc) {
        setSelectedSourceDocIds((prev) =>
          prev.includes(newDoc.id) ? prev : [...prev, newDoc.id],
        );
        setSourceActiveTab(null);
        toast.success(
          saveToLibrary
            ? "Đã lưu liên kết vào thư viện"
            : "Đã nạp nội dung từ liên kết",
        );
        setBackgroundTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "success" } : t)),
        );
        setActiveTab("activity");
        setTimeout(() => {
          setBackgroundTasks((prev) => prev.filter((t) => t.id !== taskId));
        }, 3000);
      } else {
        throw new Error("Không thể lưu tài liệu");
      }
    } catch (err: any) {
      console.error("Add Link Error:", err);
      toast.error(`Lỗi: ${err.message}`);
      setBackgroundTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "error", message: err.message } : t,
        ),
      );
    }
  };

  // Quick Action Helpers
  const openCreateTask = () => {
    closeMobileDrawer();
    setEditingTask({
      id: "",
      title: "",
      assignee:
        profile?.defaultAssigneeName || getUserDisplayName(user, profile),
      dueDate: new Date().toISOString().split("T")[0],
      categoryCode: profile?.defaultTaskCategoryCode || "LV_DH",
      isDeputy: false,
      assignmentCode: "",
      assignmentName: "",
      description: "",
      status: "todo",
      priority: "medium",
      source: "manual",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setActiveModal("task-edit");
  };

  const openAiTaskBuilder = () => {
    closeMobileDrawer();
    setActiveTab("editor");
    setTaskType("TASK_BUILDER");
    setInput("");
    setOutput("");
    toast.success("Đã mở công cụ AI tạo công việc.");
  };

  const openLibrary = () => {
    closeMobileDrawer();
    setActiveTab("library");
  };

  const openSettings = () => {
    closeMobileDrawer();
    setActiveTab("settings");
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để xóa công việc.");
      return;
    }

    const task = allTasks.find((t) => t.id === taskId);
    if (
      !(await requestConfirmAsync(
        "Bạn có chắc chắn muốn xóa công việc này? Dữ liệu không thể khôi phục.",
      ))
    )
      return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "tasks", taskId));
      setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (editingTask?.id === taskId) {
        setActiveModal(null);
        setEditingTask(null);
      }

      if (task) {
        await logActivity({
          module: "task",
          action: "deleted",
          entityType: "task",
          entityId: taskId,
          entityTitle: task.title,
          title: "Xóa nhiệm vụ",
          summary: `Đã xóa nhiệm vụ "${task.title}".`,
          metadata: { source: "client" },
        });
      }

      toast.success("Đã xóa công việc.");
    } catch (err: any) {
      handleFirestoreError(err, "delete" as any, `tasks/${taskId}`);
      toast.error(
        "Không thể xóa công việc: " + (err.message || "Lỗi không xác định"),
      );
    }
  };
  const archiveDocument = async (id: string) => {
    try {
      if (user) {
        await updateDoc(doc(db, "users", user.uid, "documents", id), {
          archived: true,
          updatedAt: Date.now(),
        });
      }
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, archived: true } : d)),
      );
      if (documentMenuDocId === id) setDocumentMenuDocId(null);
      toast.success("Đã lưu trữ tài liệu");
    } catch (err: any) {
      toast.error("Lỗi khi lưu trữ: " + err.message);
    }
  };

  const removeDocument = async (id: string) => {
    try {
      if (user) {
        const token = await user.getIdToken();
        const res = await apiFetchJson(
          `/api/documents/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }
      const docToDelete = documents.find((d) => d.id === id);
      setDocuments((prev) => {
        const updated = prev.filter((d) => d.id !== id);
        if (!user)
          localStorage.setItem("vms_documents", JSON.stringify(updated));
        return updated;
      });
      setSelectedSourceDocIds((prev) => prev.filter((did) => did !== id));
      setBulkSelectedDocIds((prev) => prev.filter((did) => did !== id));
      if (previewDocument?.id === id) setPreviewDocument(null);
      toast.success("Đã xóa tài liệu.");

      if (docToDelete) {
        await logActivity({
          module: "library",
          action: "deleted",
          entityType: docToDelete.type === "drive" ? "drive_file" : "document",
          entityId: id,
          entityTitle: docToDelete.name,
          title: "Xóa tài liệu",
          summary: `Đã xóa tài liệu "${docToDelete.name}" khỏi Kho tư liệu.`,
          metadata: { source: "client" },
        });
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error("Lỗi khi xóa: " + err.message);
    }
  };

  const deleteSelectedDocuments = async () => {
    if (bulkSelectedDocIds.length === 0) return;
    if (
      !(await requestConfirmAsync(
        `Bạn có chắc chắn muốn xóa ${bulkSelectedDocIds.length} tài liệu đã chọn khỏi hệ thống?`,
      ))
    )
      return;

    setIsLoading(true);
    let successCount = 0;
    try {
      const token = user ? await user.getIdToken() : "";
      for (const id of bulkSelectedDocIds) {
        try {
          if (user) {
            await apiFetchJson(`/api/documents/${encodeURIComponent(id)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          }
          successCount++;
        } catch (e) {
          console.error(`Failed to delete doc ${id}:`, e);
        }
      }

      setDocuments((prev) => {
        const updated = prev.filter((d) => !bulkSelectedDocIds.includes(d.id));
        setBulkSelectedDocIds([]);
        if (!user)
          localStorage.setItem("vms_documents", JSON.stringify(updated));
        return updated;
      });
      setSelectedSourceDocIds((prev) =>
        prev.filter((did) => !bulkSelectedDocIds.includes(did)),
      );
      if (previewDocument && bulkSelectedDocIds.includes(previewDocument.id)) {
        setPreviewDocument(null);
      }
      toast.success(`Đã xóa ${successCount} tài liệu.`);
    } catch (err: any) {
      toast.error("Có lỗi xảy ra khi xóa tài liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveDocumentEdit = async () => {
    if (!editingDocument) return;
    try {
      const updates: any = {
        name: docEditForm.name.trim(),
        metadata: {
          ...editingDocument.metadata,
          description: docEditForm.description.trim(),
        },
        collectionId:
          docEditForm.collectionId ||
          editingDocument.collectionId ||
          "lib-personal",
        documentKind:
          docEditForm.documentKind || editingDocument.documentKind || "",
        taskCategoryCode:
          docEditForm.taskCategoryCode ||
          editingDocument.taskCategoryCode ||
          "",
        updatedAt: Date.now(),
      };

      if (user) {
        await updateDoc(
          doc(db, "users", user.uid, "documents", editingDocument.id),
          updates,
        );
      }
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === editingDocument.id
            ? {
                ...d,
                ...updates,
              }
            : d,
        ),
      );
      toast.success("Đã cập nhật thông tin tài liệu.");
      setIsEditingDocModalOpen(false);
      setEditingDocument(null);
    } catch (err: any) {
      toast.error("Lỗi khi lưu thông tin: " + err.message);
    }
  };

  const openDocumentExplorer = async (folderId: string, folderName: string) => {
    setDocumentExplorerFolder({ id: folderId, name: folderName });
    setIsExplorerLoading(true);
    setExplorerFiles([]);
    try {
      const authHeader = auth.currentUser
        ? `Bearer ${await auth.currentUser.getIdToken()}`
        : "";
      const data = await apiFetchJson(
        "/api/drive/folder-contents?folderId=" + folderId,
        {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      );
      if (data.success) {
        setExplorerFiles(data.files || []);
      } else {
        toast.error(data.message || "Có lỗi xảy ra khi tải nội dung thư mục");
      }
    } catch (err: any) {
      toast.error("Có lỗi xảy ra khi tải nội dung thư mục.");
    } finally {
      setIsExplorerLoading(false);
    }
  };

  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  const requestConfirmAsync = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ message, resolve });
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    const email = target.email.value;
    const password = target.password.value;

    setError(null);
    setIsLoading(true);
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        // Create user profile in Firestore
        if (auth.currentUser) {
          await setDoc(doc(db, "users", auth.currentUser.uid), {
            email: auth.currentUser.email,
            updatedAt: Date.now(),
          }).catch((e) =>
            handleFirestoreError(e, "create", `users/${auth.currentUser?.uid}`),
          );
        }
      }
      setActiveModal(null);
    } catch (err: any) {
      setError(`Lỗi xác thực: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setActiveModal(null);
    } catch (err: any) {
      setError(`Lỗi đăng nhập Google: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setDocuments([]);
      setSessions([]);
      setCurrentSessionId(null);
      setActiveModal(null);
    } catch (err: any) {
      setError(`Lỗi Đăng Xuất: ${err.message}`);
    }
  };

  const handleAddText = async () => {
    const name =
      newTextName.trim() || `Văn bản dán - ${new Date().toLocaleTimeString()}`;
    const content = newTextContent.trim();

    if (content) {
      const docData: Omit<DocumentSource, "id"> = {
        name: name,
        content: content,
        type: "text",
        category: "PROJECT",
      };

      const newDoc = await persistDocument(docData, !saveToLibrary);
      if (newDoc) {
        setSelectedSourceDocIds((prev) =>
          prev.includes(newDoc.id) ? prev : [...prev, newDoc.id],
        );
        setNewTextName("");
        setNewTextContent("");
        setSourceActiveTab(null);
      }
    }
  };

  const toggleDocSelection = (id: string) => {
    setSelectedSourceDocIds((prev) =>
      prev.includes(id) ? prev.filter((did) => did !== id) : [...prev, id],
    );
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const analyzeNeededIllustrations = async () => {
    if (!output.trim()) return;
    setIsPlanningImages(true);
    setError(null);
    try {
      const cleanedOutput = removeBrokenMarkdownImages(output);
      if (cleanedOutput !== output) setOutput(cleanedOutput);

      const localAnalysis = buildLocalImageAnalysis(
        cleanedOutput,
        illustrations,
      );
      // Gọi AI để gợi ý các vị trí và mô tả ảnh cần tải lên thủ công
      const token = user ? await user.getIdToken() : undefined;
      const remotePlan = await planEditorialImages(
        cleanedOutput,
        localAnalysis,
        token,
      );
      const finalAnalysis: EditorialImageAnalysis = {
        ...localAnalysis,
        plans: remotePlan.plans?.length
          ? remotePlan.plans
          : localAnalysis.plans,
        notes: remotePlan.notes || [],
      };
      setImageAnalysis(finalAnalysis);
      setImagePlans(finalAnalysis.plans);
      toast.success("Đã hoàn tất phân tích và đề xuất vị trí hình ảnh.");
    } catch (err: any) {
      const fallback = buildLocalImageAnalysis(output, illustrations);
      setImageAnalysis(fallback);
      setImagePlans(fallback.plans);
      console.warn("AI Image Planning failed, fell back to local scan.");
    } finally {
      setIsPlanningImages(false);
    }
  };

  const approveIllustration = (id: string) => {
    setIllustrations((prev) => {
      const updated = prev.map((img) =>
        img.id === id
          ? { ...img, reviewStatus: "approved" as IllustrationReviewStatus }
          : img,
      );
      if (currentSessionId) setTimeout(() => saveCurrentToSession(output), 500);
      return updated;
    });
  };

  const rejectIllustration = (id: string) => {
    setIllustrations((prev) => {
      const updated = prev.map((img) =>
        img.id === id
          ? { ...img, reviewStatus: "rejected" as IllustrationReviewStatus }
          : img,
      );
      if (currentSessionId) setTimeout(() => saveCurrentToSession(output), 500);
      return updated;
    });
  };

  const approveAllValidIllustrations = () => {
    setIllustrations((prev) => {
      const updated = prev.map((img) =>
        img.status === "ready" &&
        img.qualityStatus !== "failed" &&
        img.reviewStatus === "suggested"
          ? { ...img, reviewStatus: "approved" as IllustrationReviewStatus }
          : img,
      );
      if (currentSessionId) setTimeout(() => saveCurrentToSession(output), 500);
      return updated;
    });
    toast.success("Đã duyệt tất cả hình ảnh hợp lệ");
  };

  const clearErrorImages = () => {
    setIllustrations((prev) => {
      const updated = prev.filter(
        (img) =>
          img.status !== "error" &&
          img.qualityStatus !== "failed" &&
          img.reviewStatus !== "rejected",
      );
      if (currentSessionId) setTimeout(() => saveCurrentToSession(output), 500);
      return updated;
    });
  };

  const updateImageLoadStatus = (id: string, status: "loaded" | "error") => {
    setIllustrations((prev) =>
      prev.map((img) => (img.id === id ? { ...img, loadStatus: status } : img)),
    );
  };

  const getCategoryName = (code: string) => {
    return TASK_CATEGORIES.find((c) => c.code === code)?.name || code;
  };

  const saveBuiltTasks = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để lưu công việc");
      return;
    }

    const tasksToSave = (builtTasks as any[]).filter((t) => t.selected);
    if (tasksToSave.length === 0) {
      toast.error("Vui lòng chọn ít nhất một công việc để lưu.");
      return;
    }

    setIsBuildingTasks(true);
    try {
      let savedCount = 0;
      for (const t of tasksToSave) {
        const docId = await persistTask({
          title: t.title,
          assignee: t.assignee,
          dueDate: t.dueDate || "",
          categoryCode: t.categoryCode,
          isDeputy: !!t.isDeputy,
          assignmentCode: t.assignmentCode || "",
          assignmentName: t.assignmentName || "",
          description: t.description,
          status: t.status || "todo",
          priority: t.priority || "medium",
          source: "ai",
          ownerId: user.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        if (docId) savedCount++;
      }
      if (savedCount > 0) {
        toast.success(`Đã lưu ${savedCount} công việc vào hệ thống`);
        setBuiltTasks([]);
        setActiveTab("tasks");
      }
    } catch (err: any) {
      handleFirestoreError(err, "create", "tasks");
    } finally {
      setIsBuildingTasks(false);
    }
  };

  const TASK_GROUPS = [
    {
      title: "Soạn thảo",
      options: [
        {
          id: "WRITE_NEW",
          label: "Viết tin bài",
          icon: Edit3,
          desc: "Viết mới từ sự kiện/thông cáo",
        },
        {
          id: "OUTLINE_REPORT",
          label: "Đề cương báo cáo",
          icon: Target,
          desc: "Lập dàn ý báo cáo mảng/khối",
        },
        {
          id: "OUTLINE_SPEECH",
          label: "Đề cương phát biểu",
          icon: Target,
          desc: "Tạo đề cương bài phát biểu",
        },
        {
          id: "NOTICE_DOC",
          label: "Thông báo / Công văn",
          icon: FileText,
          desc: "Soạn thảo thông báo hành chính",
        },
      ],
    },
    {
      title: "Biên tập",
      options: [
        {
          id: "REVIEW",
          label: "Chỉnh văn phong hành chính",
          icon: CheckCircle2,
          desc: "Chuẩn hóa cấu trúc văn bản",
        },
        {
          id: "RESIZE",
          label: "Rút gọn",
          icon: Maximize2,
          desc: "Rút gọn độ dài văn bản",
        },
        {
          id: "EDITORIAL_POLITICAL",
          label: "Tăng tính chính luận",
          icon: BookOpen,
          desc: "Làm sâu sắc & trang trọng",
        },
        {
          id: "CREATE_TITLES",
          label: "Tạo Tiêu đề & Sapo",
          icon: Type,
          desc: "Đề xuất tiêu đề chuẩn SEO",
        },
      ],
    },
    {
      title: "Phân tích nội dung",
      options: [
        {
          id: "CONTENT_REVIEW",
          label: "Phân tích / đánh giá nội dung",
          icon: Activity,
          desc: "Chẩn đoán lỗi, tính trọn vẹn, đề xuất",
        },
      ],
    },
    {
      title: "Chuyển đổi đầu ra",
      options: [
        {
          id: "SLIDE_OUTLINE",
          label: "Phác thảo Slide",
          icon: Presentation,
          desc: "Tạo cấu trúc trình chiếu",
        },
        {
          id: "SUMMARY_DOC",
          label: "Tài liệu tổng hợp",
          icon: Files,
          desc: "Tổng hợp tài liệu",
        },
        {
          id: "SUMMARY_CARD",
          label: "Phiếu tóm tắt",
          icon: CheckCircle2,
          desc: "Tạo phiếu tóm tắt thông tin",
        },
        {
          id: "TASK_BUILDER",
          label: "Tạo task từ nội dung",
          icon: CheckSquare,
          desc: "Lập kế hoạch & giao việc",
        },
      ],
    },
  ];

  const styleOptions: { id: WritingStyle; label: string }[] = [
    { id: "FORMAL", label: "Trang trọng" },
    { id: "TECHNICAL", label: "Kỹ thuật" },
    { id: "EDITORIAL", label: "Báo chí" },
    { id: "DYNAMISM", label: "Năng động" },
  ];

  const formatOptions: { id: OutputFormat; label: string }[] = [
    { id: "ARTICLE", label: "Bài viết" },
    { id: "NEWS", label: "Tin tức" },
    { id: "PRESS_RELEASE", label: "Thông cáo" },
    { id: "REPORT", label: "Báo cáo" },
    { id: "ANNOUNCEMENT", label: "Thông báo" },
    { id: "PLAN", label: "Kế hoạch" },
    { id: "MEETING_MINUTES", label: "Biên bản họp" },
    { id: "SPEECH_OUTLINE", label: "Đề cương phát biểu" },
    { id: "SUMMARY_CARD", label: "Phiếu tóm tắt" },
    { id: "SUMMARY_DOC", label: "Tài liệu tổng hợp" },
    { id: "SLIDE_OUTLINE", label: "Phác thảo Slide" },
  ];

  // Removed early return for bootstrap to allow overlay
  // Removed full screen backendError to allow degraded mode UI

  // --- AUTH CHECK: LANDING PAGE ---
  if (!user) {
    return (
      <>
        <StartupOverlay state={startupState} />
        <DegradedBanner
          state={startupState}
          error={backendError}
          onRetry={() => window.location.reload()}
        />
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-[#002D56] selection:text-white overflow-x-hidden mesh-gradient">
          <Toaster position="top-right" />

          {/* Navigation / Header */}
          <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20 px-4 py-3 sm:px-6 sm:py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-[#002D56] p-2 sm:p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/20 shrink-0">
                  <Ship className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-none truncate">
                    VMS Navigator
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-blue-600/70 tracking-wider uppercase mt-1 truncate hidden sm:block">
                    Trợ lý Nghiệp vụ & Biên tập
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveModal("auth")}
                className="px-4 py-2 sm:px-6 sm:py-2.5 bg-[#002D56] text-white rounded-full text-xs sm:text-sm font-bold shadow-lg shadow-blue-900/20 hover:bg-[#001F3D] hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shrink-0"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4" /> Đăng nhập
              </button>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
            {/* Decorative Orbs - Removed pulse to prevent lag */}
            <div className="absolute top-20 -left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />
            <div className="absolute top-40 -right-20 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl" />

            <div className="max-w-5xl mx-auto text-center relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold tracking-wider uppercase mb-6 sm:mb-8">
                  <span className="relative flex h-2 w-2 rounded-full bg-blue-500 shadow-sm border border-white"></span>
                  Hệ sinh thái Nghiệp vụ Thông minh
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 leading-[1.2] md:leading-[1.1] mb-6 md:mb-8 tracking-tight">
                  Nâng tầm Nghiệp vụ
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                    với Trợ lý AI chuyên sâu
                  </span>
                </h1>

                <p className="text-base md:text-xl text-slate-600 font-medium leading-relaxed mb-10 md:mb-12 max-w-3xl mx-auto px-2 sm:px-4">
                  VMS Navigator đồng hành cùng cán bộ Hoa tiêu trong việc quản
                  lý công việc, số hóa tư liệu và biên tập nội dung một cách đột
                  phá và chính xác.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button
                    onClick={() => setActiveModal("auth")}
                    className="px-8 py-3.5 sm:px-10 sm:py-4 w-full sm:w-auto bg-[#002D56] text-white rounded-full text-base sm:text-lg font-bold transition-all hover:bg-[#001F3D] hover:shadow-xl hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 group"
                  >
                    Bắt đầu trải nghiệm{" "}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <div className="px-8 py-3.5 sm:px-10 sm:py-4 w-full sm:w-auto glass-card text-blue-900 rounded-full text-base sm:text-lg font-bold flex items-center justify-center gap-3">
                    Nội bộ VMS <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Features Bento Grid */}
          <section className="px-4 py-24 sm:px-6 lg:px-8 bg-slate-50/50 relative overflow-hidden">
            <div className="mx-auto max-w-6xl">
              <div className="text-center mb-12 sm:mb-16 relative z-10">
                <h2 className="text-2xl sm:text-3xl md:text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 tracking-tight uppercase">
                  Đặc quyền công nghệ
                </h2>
                <div className="h-1 sm:h-1.5 w-16 sm:w-24 bg-blue-600 mx-auto mt-3 sm:mt-4 rounded-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                {/* Card 1 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-blue-300 hover:shadow-lg transition-all group overflow-hidden relative">
                  <div className="bg-blue-600/10 p-3.5 rounded-2xl w-fit mb-5 text-blue-600">
                    <ListTodo className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#002D56] mb-2 uppercase tracking-tight line-clamp-1">
                    Quản lý Công việc
                  </h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    Lập kế hoạch, giao việc và theo dõi tiến độ một cách trực
                    quan để không bỏ lỡ hạn chót nào.
                  </p>
                </div>

                {/* Card 2 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all group">
                  <div className="bg-indigo-600/10 p-3.5 rounded-2xl w-fit mb-5 text-indigo-600">
                    <Database className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#002D56] mb-2 uppercase tracking-tight line-clamp-1">
                    Kho tư liệu số
                  </h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    Lưu trữ tập trung, liên kết với Google Drive và xây dựng bộ
                    nhớ dùng chung nội bộ.
                  </p>
                </div>

                {/* Card 3 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-300 hover:shadow-lg transition-all group">
                  <div className="bg-emerald-600/10 p-3.5 rounded-2xl w-fit mb-5 text-emerald-600">
                    <Edit3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#002D56] mb-2 uppercase tracking-tight line-clamp-1">
                    Trợ lý Biên tập
                  </h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    Tự động chuyển đổi tài liệu, xây dựng Outline Slide báo cáo
                    và tạo công văn nhanh chóng.
                  </p>
                </div>

                {/* Card 4 */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-orange-300 hover:shadow-lg transition-all group overflow-hidden relative">
                  <div className="bg-orange-600/10 p-3.5 rounded-2xl w-fit mb-5 text-orange-600">
                    <Bot className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#002D56] mb-2 uppercase tracking-tight line-clamp-1">
                    AI Nghiệp vụ
                  </h3>
                  <p className="text-slate-500 font-medium text-sm leading-relaxed">
                    Tra cứu chuyên môn, hỏi đáp AI bám sát dữ liệu và hiểu rõ
                    đặc thù VMS.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Security / Quality / Footer */}
          <footer className="py-16 border-t border-slate-200 bg-white px-4 relative">
            <div className="max-w-7xl mx-auto flex flex-col items-center">
              <div className="flex items-center gap-6 mb-10 overflow-x-auto pb-4 max-w-full">
                <div className="flex items-center gap-2 text-slate-500 font-semibold uppercase tracking-tight text-[10px] whitespace-nowrap">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Bảo mật
                  Nội bộ
                </div>
                <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                <div className="flex items-center gap-2 text-slate-500 font-semibold uppercase tracking-tight text-[10px] whitespace-nowrap">
                  <Target className="w-4 h-4 text-blue-500" /> Tối ưu Nghiệp vụ
                </div>
                <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                <div className="flex items-center gap-2 text-slate-500 font-semibold uppercase tracking-tight text-[10px] whitespace-nowrap">
                  <Zap className="w-4 h-4 text-orange-500" /> Hiệu suất Vững bền
                </div>
              </div>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider text-center">
                © {new Date().getFullYear()} CÔNG TY TNHH MTV HOA TIÊU HÀNG HẢI
                MIỀN BẮC
                <br />
                <span className="opacity-50">
                  Hành động trái phép sẽ bị truy cứu trách nhiệm
                </span>
              </p>
            </div>
          </footer>

          {/* Auth Modal Inside Landing */}
          <AnimatePresence>
            {activeModal === "auth" && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-[#002D56]/40 backdrop-blur-xl"
                  onClick={() => setActiveModal(null)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 30 }}
                  className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden p-8 border border-white/50"
                >
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/30 animate-float">
                      <Ship className="w-8 h-8" />
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-bold text-slate-800   tracking-tight">
                      Chào mừng trở lại
                    </h3>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mt-2">
                      VMS Navigator Ecosystem
                    </p>
                  </div>

                  <div className="space-y-5">
                    <button
                      onClick={handleGoogleAuth}
                      disabled={isLoading}
                      className="w-full py-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-3 hover:bg-white hover:border-blue-400 hover:shadow-lg transition-all group active:scale-95 disabled:opacity-50"
                    >
                      <img
                        src="https://www.google.com/favicon.ico"
                        alt="Google"
                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                      />
                      <span className="font-bold text-sm text-slate-700">
                        Tiếp tục với Google
                      </span>
                    </button>

                    <div className="flex items-center gap-4 my-6">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                        Hoặc Email nghiệp vụ
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    <form onSubmit={handleAuth} className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">
                          Email nội bộ
                        </label>
                        <input
                          name="email"
                          type="email"
                          required
                          className="w-full py-4 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"
                          placeholder="ten@vmsnorth-pilot.vn"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block ml-1">
                          Mật khẩu
                        </label>
                        <div className="relative">
                          <input
                            name="password"
                            type="password"
                            required
                            className="w-full py-4 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 mt-4 bg-[#002D56] text-white rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-blue-600 hover:shadow-xl hover:shadow-blue-600/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : authMode === "login" ? (
                          "Truy cập ngay"
                        ) : (
                          "Đăng ký tài khoản"
                        )}
                      </button>
                      {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-center">
                          <p className="text-xs font-bold uppercase tracking-tight">
                            {error}
                          </p>
                        </div>
                      )}
                    </form>

                    <div className="pt-6 text-center">
                      <button
                        onClick={() =>
                          setAuthMode(
                            authMode === "login" ? "register" : "login",
                          )
                        }
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-tight"
                      >
                        {authMode === "login"
                          ? "Bạn là thành viên mới? Cấp tài khoản"
                          : "Đã là thành viên? Quay lại đăng nhập"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </>
    );
  }

  // --- CHAT ATTACHMENT HANDLER ---
  const handleUploadChatAttachment = async (
    file: File,
    onStatusUpdate?: (status: string) => void,
  ): Promise<ChatAttachment> => {
    if (!user) throw new Error("Vui lòng đăng nhập.");

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`Tệp ${file.name} vượt quá 10MB.`);
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    let extension = file.name.split(".").pop()?.toLowerCase() || "";
    let mimeType = file.type;

    // MIME type inference
    if (!mimeType) {
      if (extension === "pdf") mimeType = "application/pdf";
      else if (extension === "docx")
        mimeType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (extension === "xlsx")
        mimeType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (extension === "xls") mimeType = "application/vnd.ms-excel";
      else if (extension === "csv") mimeType = "text/csv";
      else if (extension === "txt") mimeType = "text/plain";
      else if (extension === "md") mimeType = "text/markdown";
      else mimeType = "application/octet-stream";
    }

    const allowedExtensions = [
      "pdf",
      "docx",
      "xlsx",
      "xls",
      "csv",
      "txt",
      "md",
    ];
    if (!allowedExtensions.includes(extension)) {
      throw new Error(`Định dạng tệp .${extension} không được hỗ trợ.`);
    }

    onStatusUpdate?.("uploading");

    const attachmentId =
      Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7);
    const storagePath = `chatAttachments/${user.uid}/${attachmentId}/${cleanFileName}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: mimeType });

    const token = await user.getIdToken();
    const res = await apiFetchJson("/api/chat/attachments/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: cleanFileName,
        originalName: file.name,
        mimeType,
        extension,
        size: file.size,
        storagePath,
      }),
    });

    if (!res.success) throw new Error(res.message);

    // Extract content immediately and wait for it
    try {
      const extractRes = await apiFetchJson(
        `/api/chat/attachments/${res.attachment.id}/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!extractRes.success) {
        toast.error(`Lỗi trích xuất tệp: ${extractRes.message}`);
        return {
          ...res.attachment,
          status: "error",
          contentStatus: "error",
          errorMessage: extractRes.message,
        };
      }

      onStatusUpdate?.("ready");

      return {
        ...res.attachment,
        status: "ready",
        contentStatus: "extracted",
      };
    } catch (err: any) {
      toast.error(`Lỗi kết nối trích xuất tệp: ${err.message}`);
      return {
        ...res.attachment,
        status: "error",
        contentStatus: "error",
        errorMessage: err.message,
      };
    }
  };

  // --- MAIN APP LAYOUT (LOGGED IN) ---
  return (
    <div
      className={cn(
        "h-dvh w-full bg-[#F1F5F9] flex font-sans text-slate-900 overflow-hidden",
        density === "compact" ? "compact-layout" : "",
      )}
    >
      <Toaster position="top-right" />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[50] bg-[#002D56] text-white transition-all duration-300 ease-in-out shadow-lg flex flex-col",
          isSidebarCollapsed
            ? "lg:w-20 w-[280px]"
            : "lg:w-72 xl:w-80 w-[280px]",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Sidebar Header / Logo */}
        <div
          className={cn(
            "relative h-24 flex items-center border-b border-white/5 shrink-0 gap-3 px-6",
            isSidebarCollapsed && !isSidebarOpen
              ? "justify-center px-0"
              : "justify-between",
          )}
        >
          {(!isSidebarCollapsed || isSidebarOpen) && (
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-900/50 shrink-0 transform -rotate-3 transition-transform hover:rotate-0">
                <Ship className="w-6 h-6" />
              </div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-1 min-w-0"
              >
                <h1 className="font-bold text-white text-[15px] tracking-tight leading-none  break-words ">
                  Hoa Tiêu Miền Bắc
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <p className="text-xs font-medium tracking-wide text-blue-200/90 truncate">
                    Ecosystem v2.5
                  </p>
                </div>
              </motion.div>
            </div>
          )}

          {isSidebarCollapsed && !isSidebarOpen && (
            <div
              className="bg-white/10 p-2 rounded-md backdrop-blur-md border border-white/20 shrink-0 cursor-pointer hover:bg-white/20 transition-all group"
              onClick={() => setIsSidebarCollapsed(false)}
              title="Mở rộng menu"
            >
              <Ship className="text-white w-5 h-5 lg:w-6 lg:h-6 group-hover:hidden" />
              <ChevronRight className="text-white w-5 h-5 lg:w-6 lg:h-6 hidden group-hover:block" />
            </div>
          )}

          {/* Sidebar Toggle/Close */}
          {(!isSidebarCollapsed || isSidebarOpen) && (
            <div className="flex items-center shrink-0">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:flex p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Thu gọn menu"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white hover:text-white transition-colors bg-white/10"
                title="Đóng menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto overscroll-contain py-6 px-3 space-y-2 custom-scrollbar">
          {[
            { id: "home", label: "Trang chủ", icon: LayoutDashboard },
            {
              id: "tasks",
              label: "Quản lý công việc",
              icon: ListTodo,
              badge: allTasks.filter(
                (t) => t.status !== "done" && t.status !== "blocked",
              ).length,
            },
            { id: "editor", label: "Trợ lý biên tập", icon: Edit3 },
            { id: "library", label: "Kho tư liệu", icon: Database },
            { id: "history", label: "Lịch sử bài viết", icon: History },
            { id: "activity", label: "Nhật ký hoạt động", icon: Clock },
            { id: "settings", label: "Cài đặt / Tài khoản", icon: Settings },
            ...(profile?.role === "admin"
              ? [{ id: "admin", label: "Admin Workspace", icon: Shield }]
              : []),
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "tasks") {
                  openTaskOverview();
                } else {
                  setActiveTab(item.id as any);
                  closeMobileDrawer();
                }
              }}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all relative group mb-1",
                activeTab === item.id
                  ? "bg-white text-[#002D56] shadow-xl shadow-blue-900/20 active:scale-95"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
              title={isSidebarCollapsed ? item.label : ""}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-transform group-hover:scale-110",
                  activeTab === item.id ? "text-[#002D56]" : "text-white/40",
                )}
              />
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <span className="text-sm font-bold truncate leading-none uppercase tracking-tight">
                  {item.label}
                </span>
              )}
              {item.badge > 0 && (
                <span
                  className={cn(
                    "absolute flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-semibold border-2 border-[#002D56]",
                    activeTab === item.id
                      ? "bg-red-500 text-white -top-1 -right-1"
                      : "bg-red-500 text-white top-2 right-2",
                    isSidebarCollapsed && activeTab !== item.id
                      ? "top-1 right-1"
                      : "",
                  )}
                >
                  {item.badge}
                </span>
              )}
              {activeTab === item.id && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 w-1 h-6 bg-[#002D56] rounded-r-full"
                />
              )}
            </button>
          ))}

          <div className="pt-6 mt-6 border-t border-white/5 space-y-2">
            {(!isSidebarCollapsed || isSidebarOpen) && (
              <p className="px-4 text-[10px] font-semibold uppercase text-white/30 tracking-wide mb-3">
                Tác vụ nhanh
              </p>
            )}
            <button
              onClick={createNewSession}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all group border border-transparent hover:border-emerald-500/50",
                isSidebarCollapsed ? "justify-center" : "",
              )}
              title={isSidebarCollapsed ? "Bài viết mới" : ""}
            >
              <FilePlus className="w-5 h-5 shrink-0" />
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <span className="text-sm font-semibold">Bài viết mới</span>
              )}
            </button>
            <button
              onClick={openCreateTask}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all group border border-transparent hover:border-blue-500/50",
                isSidebarCollapsed && !isSidebarOpen ? "justify-center" : "",
              )}
              title={isSidebarCollapsed ? "Thêm việc" : ""}
            >
              <CheckSquare className="w-5 h-5 shrink-0" />
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <span className="text-sm font-semibold">Thêm việc</span>
              )}
            </button>
            <button
              onClick={openAiTaskBuilder}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-md bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white transition-all group border border-transparent hover:border-orange-500/50",
                isSidebarCollapsed && !isSidebarOpen ? "justify-center" : "",
              )}
              title={isSidebarCollapsed ? "Tạo công việc bằng AI" : ""}
            >
              <Bot className="w-5 h-5 shrink-0" />
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <span className="text-sm font-semibold">Tạo công việc AI</span>
              )}
            </button>
          </div>
        </nav>

        {/* User Profile / Status */}
        <div className="p-4 border-t border-white/10 shrink-0">
          {user ? (
            <div
              className={cn(
                "flex items-center gap-3 p-2 rounded-md bg-white/5 border border-white/10",
                isSidebarCollapsed ? "justify-center" : "",
              )}
            >
              <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center text-xs font-semibold text-white shrink-0 border border-white/10 uppercase">
                {profile?.avatarText || user.email?.[0]}
              </div>
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white/40 tracking-normal leading-none mb-1">
                    Thành viên
                  </p>
                  <p className="text-xs font-semibold text-white truncate">
                    {getUserDisplayName(user, profile)}
                  </p>
                </div>
              )}
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <button
                  onClick={() => {
                    closeMobileDrawer();
                    setActiveModal("account");
                  }}
                  className="p-1.5 text-white/40 hover:text-white transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setActiveModal("auth")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-md bg-white/10 text-white font-bold hover:bg-white/20 transition-all border border-white/10",
                isSidebarCollapsed && !isSidebarOpen ? "justify-center" : "",
              )}
            >
              <User className="w-5 h-5 shrink-0" />
              {(!isSidebarCollapsed || isSidebarOpen) && (
                <span className="text-sm">Đăng nhập</span>
              )}
            </button>
          )}

          {(!isSidebarCollapsed || isSidebarOpen) && (
            <div className="mt-4 flex items-center justify-between px-2">
              <div
                className="flex items-center gap-2"
                title={backendError || undefined}
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    aiStateStatus === "ready"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                      : aiStateStatus === "unconfigured"
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        : "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
                  )}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-white/50 leading-none truncate">
                    {aiCoreLabel}
                  </span>
                  {aiStateStatus === "error" && backendError && (
                    <span
                      className="text-[9px] text-rose-400 truncate mt-0.5"
                      title={backendError}
                    >
                      {backendError}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setDensity((d) =>
                      d === "compact" ? "comfortable" : "compact",
                    )
                  }
                  className="p-1.5 text-white/40 hover:text-white transition-colors"
                  title={
                    density === "compact"
                      ? "Chuyển sang chế độ Thoải mái"
                      : "Chuyển sang chế độ Mật độ cao"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 8h16M4 16h16" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    closeMobileDrawer();
                    setActiveModal("settings");
                  }}
                  className="p-1.5 text-white/40 hover:text-white transition-colors"
                  title="Cài đặt hệ thống"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className={cn(
          "lg:hidden fixed top-0 left-0 right-0 z-[40] bg-[#002D56]/80 backdrop-blur-xl text-white transition-all duration-300 border-b border-white/10 pt-[env(safe-area-inset-top)]",
          showMobileHeader ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="h-16 flex items-center px-5">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all active:scale-90"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 ml-4 min-w-0">
            <div className="p-1.5 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-lg rotate-3 shrink-0">
              <Ship className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight  truncate ">
              Hoa Tiêu MB
            </span>
          </div>
          {user ? (
            <button
              onClick={() => {
                closeMobileDrawer();
                setActiveModal("account");
              }}
              className="ml-auto w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0 hover:bg-white/20 transition-all active:scale-95"
            >
              <User className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => {
                closeMobileDrawer();
                setActiveModal("auth");
              }}
              className="ml-auto p-2.5 bg-white/10 rounded-xl"
            >
              <User className="w-5 h-5 shrink-0" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col h-dvh transition-all duration-300 ease-in-out min-w-0 overflow-x-hidden pt-16 lg:pt-0",
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-72 xl:ml-80",
        )}
      >
        {/* Main Viewport */}
        <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden p-4 md:p-6 lg:p-10 custom-scrollbar pb-[calc(24px+env(safe-area-inset-bottom))] md:pb-10 w-full min-w-0">
          <div className="max-w-6xl mx-auto space-y-8 w-full min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <React.Suspense
                  fallback={
                    <div className="p-12 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    </div>
                  }
                >
                  {activeTab === "home" ? (
                    <div className="space-y-8 pb-10 relative">
                      {/* Background Decorative Blob */}
                      <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                      {/* Welcome Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#002D56] text-white text-[10px] font-bold uppercase tracking-wider mb-4">
                            <Zap className="w-3 h-3 text-yellow-400" /> Hệ thống
                            đang vận hành tốt
                          </div>
                          <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-2 leading-[1.1]">
                            {getGreeting()},{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                              {getUserDisplayName(user, profile)
                                .split(" ")
                                .pop()}
                              !
                            </span>
                          </h2>
                          <p className="text-slate-500 font-bold text-sm uppercase tracking-tight">
                            Cùng kiến tạo những nội dung nghiệp vụ xuất sắc hôm
                            nay.
                          </p>
                        </motion.div>
                      </div>

                      {/* System Status Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          {
                            label: "Cloud Firestore",
                            active: health?.firestoreReady,
                            icon: Database,
                          },
                          {
                            label: "Hoa Tiêu AI Core",
                            active: isAiCoreActive,
                            icon: Bot,
                          },
                          {
                            label: "Workspace Drive",
                            active: health?.hasGoogleDriveKey,
                            icon: "DriveIcon",
                          },
                          {
                            label: "Bảo mật dữ liệu",
                            active: health?.hasEncryptionSecret,
                            icon: ShieldCheck,
                          },
                        ].map((sys, idx) => {
                          const IconComp =
                            sys.icon === "DriveIcon"
                              ? HardDrive
                              : (sys.icon as any);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div
                                className={cn(
                                  "p-2.5 rounded-xl shrink-0",
                                  sys.active
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50 text-rose-600",
                                )}
                              >
                                <IconComp className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate">
                                  {sys.label}
                                </span>
                                <span
                                  className={cn(
                                    "text-xs font-bold truncate",
                                    sys.active
                                      ? "text-emerald-700"
                                      : "text-rose-600",
                                  )}
                                >
                                  {sys.active ? "TRỰC TUYẾN" : "CHƯA CẤU HÌNH"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bento Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {[
                          {
                            label: "Tổng việc",
                            value: taskStats.total,
                            icon: ListTodo,
                            color: "text-white",
                            bg: "bg-[#002D56]",
                            onClick: () => openTaskOverview(),
                            className: "col-span-2",
                          },
                          {
                            label: "Cần làm",
                            value: taskStats.todo,
                            icon: Target,
                            color: "text-blue-600",
                            bg: "bg-blue-50",
                            onClick: () => openTaskOverview({ status: "todo" }),
                          },
                          {
                            label: "Đang làm",
                            value: taskStats.doing,
                            icon: Clock,
                            color: "text-orange-600",
                            bg: "bg-orange-50",
                            onClick: () =>
                              openTaskOverview({ status: "doing" }),
                          },
                          {
                            label: "Quá hạn",
                            value: taskStats.overdue,
                            icon: AlertCircle,
                            color: "text-red-600",
                            bg: "bg-red-50",
                            onClick: () =>
                              openTaskOverview({ status: "overdue" }),
                          },
                          {
                            label: "Gần hạn",
                            value: taskStats.upcoming,
                            icon: Calendar,
                            color: "text-amber-600",
                            bg: "bg-amber-50",
                            onClick: () =>
                              openTaskOverview({ status: "upcoming" }),
                          },
                          {
                            label: "Ưu tiên",
                            value: taskStats.highPriority,
                            icon: AlertTriangle,
                            color: "text-indigo-600",
                            bg: "bg-indigo-50",
                            onClick: () =>
                              openTaskOverview({
                                priority: HIGH_PRIORITY_FILTER,
                              }),
                          },
                        ].map((stat, i) => (
                          <motion.button
                            key={i}
                            whileHover={{ y: -5, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={stat.onClick}
                            className={cn(
                              "group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-[#002D56]/30 hover:shadow-xl",
                              stat.className,
                            )}
                          >
                            <div
                              className={cn(
                                "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 transition-transform group-hover:rotate-12",
                                stat.bg,
                                stat.color,
                              )}
                            >
                              <stat.icon className="h-6 w-6" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold tracking-wider text-slate-400 truncate uppercase mb-1">
                                {stat.label}
                              </p>
                              <p className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight">
                                {stat.value}
                              </p>
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-5 transition-transform group-hover:scale-150 group-hover:rotate-12">
                              <stat.icon className="h-20 w-20" />
                            </div>
                          </motion.button>
                        ))}
                      </div>

                      {/* Quick Actions / Featured */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <motion.button
                          whileHover={{ y: -5 }}
                          onClick={createNewSession}
                          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#002D56] to-blue-800 p-8 text-white shadow-xl group"
                        >
                          <div className="relative z-10">
                            <div className="p-4 bg-white/10 rounded-2xl w-fit mb-6 animate-float">
                              <Edit3 className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800   tracking-tight">
                              Biên tập bài viết
                            </h3>
                            <p className="text-sm font-medium text-blue-100 mt-2 opacity-80 leading-relaxed">
                              Sử dụng AI để phác thảo nội dung nghiệp vụ chuyên
                              sâu.
                            </p>
                            <div className="mt-8 flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider">
                              Bắt đầu ngay{" "}
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                            </div>
                          </div>
                          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
                        </motion.button>

                        <motion.button
                          whileHover={{ y: -5 }}
                          onClick={openCreateTask}
                          className="rounded-[2rem] border-2 border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-blue-500/50 hover:shadow-2xl group flex flex-col"
                        >
                          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-6 transition-colors group-hover:bg-emerald-100">
                            <CheckSquare className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold text-slate-800   tracking-tight">
                            Quản lý Nhiệm vụ
                          </h3>
                          <p className="text-sm font-bold text-slate-400 mt-2">
                            Theo dõi và phối hợp công việc trơn tru.
                          </p>
                          <div className="mt-auto pt-8">
                            <div className="h-1.5 w-12 bg-slate-100 rounded-full group-hover:w-full group-hover:bg-emerald-500 transition-all duration-500" />
                          </div>
                        </motion.button>

                        <motion.button
                          whileHover={{ y: -5 }}
                          onClick={openAiTaskBuilder}
                          className="rounded-[2rem] border-2 border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-orange-500/50 hover:shadow-2xl group flex flex-col"
                        >
                          <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl w-fit mb-6 transition-colors group-hover:bg-orange-100">
                            <Bot className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl sm:text-2xl font-bold text-slate-800   tracking-tight">
                            AI Task Planner
                          </h3>
                          <p className="text-sm font-bold text-slate-400 mt-2">
                            Biến ý tưởng thành kế hoạch hành động.
                          </p>
                          <div className="mt-auto pt-8 text-[#002D56] opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-6 h-6 ml-auto" />
                          </div>
                        </motion.button>
                      </div>

                      {/* Lists Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                        {/* 1. Upcoming Tasks */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-[#002D56] rounded-lg text-white">
                                <ListTodo className="w-4 h-4" />
                              </div>
                              <h3 className="font-bold text-xs text-[#002D56] uppercase tracking-wider">
                                Nhiệm vụ trọng tâm
                              </h3>
                            </div>
                            <button
                              onClick={() => setActiveTab("tasks")}
                              className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              Tất cả
                            </button>
                          </div>
                          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto overscroll-contain max-h-[400px] custom-scrollbar">
                            {allTasks
                              .filter((t) => t.status !== "done")
                              .sort(
                                (a, b) =>
                                  new Date(a.dueDate).getTime() -
                                  new Date(b.dueDate).getTime(),
                              )
                              .slice(0, 6)
                              .map((task) => (
                                <button
                                  key={task.id}
                                  id={`task-${task.id}`}
                                  onClick={() => {
                                    setEditingTask(task);
                                    setActiveModal("task-edit");
                                  }}
                                  className="task-card w-full text-left p-5 hover:bg-slate-50 transition-all flex items-center justify-between group border-l-4 border-transparent hover:border-[#002D56]"
                                >
                                  <div className="flex-1 min-w-0 mr-4">
                                    <h4 className="font-bold text-sm text-[#002D56] line-clamp-1 mb-2 group-hover:translate-x-1 transition-transform">
                                      {task.title}
                                    </h4>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" />
                                        {task.dueDate
                                          ? new Date(
                                              task.dueDate,
                                            ).toLocaleDateString("vi-VN")
                                          : "CHƯA CÓ HẠN"}
                                      </span>
                                      <span
                                        className={cn(
                                          "text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full ",
                                          task.priority === "urgent"
                                            ? "bg-red-100 text-red-600"
                                            : task.priority === "high"
                                              ? "bg-orange-100 text-orange-600"
                                              : "bg-slate-100 text-slate-500",
                                        )}
                                      >
                                        {task.priority === "urgent"
                                          ? "KHẨN CẤP"
                                          : task.priority === "high"
                                            ? "ƯU TIÊN"
                                            : "THƯỜNG"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-5 h-5 text-blue-600" />
                                  </div>
                                </button>
                              ))}
                            {allTasks.filter((t) => t.status !== "done")
                              .length === 0 && (
                              <div className="p-10 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider italic">
                                  Tuyệt vời! Không có việc tồn đọng.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. Recent Sessions / Documents - Mixed */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-emerald-500 rounded-lg text-white">
                                <Zap className="w-4 h-4" />
                              </div>
                              <h3 className="font-bold text-xs text-[#002D56] uppercase tracking-wider">
                                Hoạt động vừa qua
                              </h3>
                            </div>
                            <button
                              onClick={() => setActiveTab("activity")}
                              className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#002D56] transition-colors"
                            >
                              Toàn bộ
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 overflow-y-auto overscroll-contain max-h-[400px] custom-scrollbar">
                            {recentLogs.slice(0, 6).map((log) => (
                              <div
                                key={log.id}
                                className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-all border-b border-slate-50"
                              >
                                <div
                                  className={cn(
                                    "p-2.5 rounded-xl shrink-0 mt-0.5",
                                    log.module === "documents"
                                      ? "bg-blue-50 text-blue-600"
                                      : log.module === "tasks"
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "bg-slate-100 text-slate-500",
                                  )}
                                >
                                  {log.module === "documents" ? (
                                    <Database className="w-4 h-4" />
                                  ) : log.module === "tasks" ? (
                                    <ListTodo className="w-4 h-4" />
                                  ) : (
                                    <Settings className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-[#002D56] uppercase tracking-tight leading-tight line-clamp-2">
                                    {log.actionType === "create"
                                      ? "Tạo mới"
                                      : log.actionType === "update"
                                        ? "Cập nhật"
                                        : "Xóa"}{" "}
                                    {log.entityName || "Dữ liệu"}
                                  </p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                                    {new Date(log.createdAt).toLocaleString(
                                      "vi-VN",
                                    )}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {recentLogs.length === 0 && (
                              <div className="col-span-full p-10 text-center text-slate-400 text-xs font-bold  tracking-wider">
                                Chưa có hoạt động nào ghi nhận.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : activeTab === "tasks" ? (
                    <div className="space-y-6">
                      {/* Dashboard Summary */}
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                          {
                            label: "Tổng việc",
                            value: taskStats.total,
                            icon: ListTodo,
                            color: "text-slate-700",
                            bg: "bg-slate-100",
                            onClick: () =>
                              setTaskFilters({
                                status: "all",
                                priority: "all",
                                category: "all",
                                search: "",
                              }),
                          },
                          {
                            label: "Quá hạn",
                            value: taskStats.overdue,
                            icon: AlertCircle,
                            color: "text-red-700",
                            bg: "bg-red-50",
                            onClick: () =>
                              setTaskFilters({
                                status: "overdue",
                                priority: "all",
                                category: "all",
                                search: "",
                              }),
                          },
                          {
                            label: "Cần làm",
                            value: taskStats.upcoming,
                            icon: Clock,
                            color: "text-orange-700",
                            bg: "bg-orange-50",
                            onClick: () =>
                              setTaskFilters({
                                status: "upcoming",
                                priority: "all",
                                category: "all",
                                search: "",
                              }),
                          },
                          {
                            label: "Đang làm",
                            value: taskStats.doing,
                            icon: Target,
                            color: "text-blue-700",
                            bg: "bg-blue-50",
                            onClick: () =>
                              setTaskFilters({
                                status: "doing",
                                priority: "all",
                                category: "all",
                                search: "",
                              }),
                          },
                          {
                            label: "Hoàn thành",
                            value: taskStats.done,
                            icon: CheckCircle,
                            color: "text-emerald-700",
                            bg: "bg-emerald-50",
                            onClick: () =>
                              setTaskFilters({
                                status: "done",
                                priority: "all",
                                category: "all",
                                search: "",
                              }),
                          },
                        ].map((stat, i) => (
                          <button
                            key={i}
                            onClick={stat.onClick}
                            className="group rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 min-w-0"
                          >
                            <div
                              className={cn(
                                "mb-3 flex h-9 w-9 items-center justify-center rounded-md shrink-0",
                                stat.bg,
                                stat.color,
                              )}
                            >
                              <stat.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold tracking-normal text-slate-500 truncate">
                                {stat.label}
                              </p>
                              <p className="mt-1 text-2xl font-bold text-slate-900">
                                {stat.value}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Task List Header */}
                      <div className="flex flex-col gap-4 bg-white p-4 sm:p-6 rounded-md lg:rounded-lg border border-slate-200">
                        <div className="flex flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-3 px-1 min-w-0">
                            <LayoutDashboard className="w-5 h-5 text-[#002D56] shrink-0" />
                            <h2 className="text-xs sm:text-sm font-semibold uppercase text-slate-800 tracking-wide leading-tight py-1">
                              Bảng công việc
                            </h2>
                          </div>
                          <button
                            onClick={() => {
                              closeMobileDrawer();
                              setEditingTask({
                                id: "",
                                title: "",
                                assignee: "",
                                dueDate: new Date().toISOString().split("T")[0],
                                categoryCode: "LV_DH",
                                isDeputy: false,
                                assignmentCode: "",
                                assignmentName: "",
                                description: "",
                                status: "todo",
                                priority: "medium",
                                source: "manual",
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                              });
                              setActiveModal("task-edit");
                            }}
                            className="flex items-center gap-2 bg-[#002D56] text-white px-4 py-2 rounded-md text-[10px] font-semibold shadow-sm hover:shadow-[#002D56]/20 transition-all active:scale-[0.98] shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" /> MỚI
                          </button>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Tìm kiếm..."
                              value={taskFilters.search}
                              onChange={(e) =>
                                setTaskFilters((prev) => ({
                                  ...prev,
                                  search: e.target.value,
                                }))
                              }
                              className="pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold w-full focus:outline-none focus:ring-2 ring-[#002D56]/10"
                            />
                          </div>

                          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
                            <select
                              value={taskFilters.status}
                              onChange={(e) =>
                                setTaskFilters((prev) => ({
                                  ...prev,
                                  status: e.target.value,
                                }))
                              }
                              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-[10px] font-semibold tracking-tight shrink-0 focus:border-[#002D56] outline-none"
                            >
                              <option value="all">Trạng thái</option>
                              <option value="todo">Cần làm</option>
                              <option value="doing">Đang làm</option>
                              <option value="review">Duyệt</option>
                              <option value="done">Xong</option>
                              <option value="overdue">Quá hạn</option>
                              <option value="upcoming">Gần hạn</option>
                            </select>

                            <select
                              value={taskFilters.priority}
                              onChange={(e) =>
                                setTaskFilters((prev) => ({
                                  ...prev,
                                  priority: e.target.value,
                                }))
                              }
                              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-[10px] font-semibold tracking-tight shrink-0 focus:border-[#002D56] outline-none"
                            >
                              <option value="all">Ưu tiên</option>
                              <option value={HIGH_PRIORITY_FILTER}>
                                Cao/khẩn
                              </option>
                              <option value="urgent">Khẩn</option>
                              <option value="high">Cao</option>
                              <option value="medium">Vừa</option>
                              <option value="low">Thấp</option>
                            </select>

                            <select
                              value={taskFilters.category}
                              onChange={(e) =>
                                setTaskFilters((prev) => ({
                                  ...prev,
                                  category: e.target.value,
                                }))
                              }
                              className="px-3 py-2 bg-white border border-slate-200 rounded-md text-[10px] font-semibold tracking-tight shrink-0 focus:border-[#002D56] outline-none"
                            >
                              <option value="all">Lĩnh vực</option>
                              {TASK_CATEGORIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Tasks Table/List */}
                      <div className="bg-white rounded-md lg:rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        {/* Desktop View */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide">
                                  CÔNG VIỆC
                                </th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide">
                                  LĨNH VỰC
                                </th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide">
                                  NGƯỜI XỬ LÝ
                                </th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide">
                                  THỜI HẠN
                                </th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide">
                                  ƯU TIÊN
                                </th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide text-center">
                                  TRẠNG THÁI
                                </th>
                                <th className="px-5 py-3 text-[10px] font-semibold text-slate-400 tracking-wide"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {filteredTasks.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-6 py-20 text-center"
                                  >
                                    <NoTasksMessage
                                      setTaskFilters={setTaskFilters}
                                    />
                                  </td>
                                </tr>
                              ) : (
                                filteredTasks.map((t) => (
                                  <tr
                                    key={t.id}
                                    id={`task-${t.id}`}
                                    className="task-card hover:bg-slate-50/50 transition-colors group"
                                  >
                                    <td
                                      className="px-6 py-5 cursor-pointer"
                                      onClick={() => {
                                        closeMobileDrawer();
                                        setEditingTask(t);
                                        setActiveModal("task-edit");
                                      }}
                                    >
                                      <TaskTitleCell
                                        task={t}
                                        documents={documents}
                                      />
                                    </td>
                                    <td className="px-6 py-5">
                                      <span className="px-3 py-1 bg-slate-100 text-[#002D56] rounded-lg text-[10px] font-semibold tracking-tight">
                                        {TASK_CATEGORIES.find(
                                          (c) => c.code === t.categoryCode,
                                        )?.name || t.categoryCode}
                                      </span>
                                    </td>
                                    <td className="px-6 py-5">
                                      <TaskAssigneeCell task={t} />
                                    </td>
                                    <td className="px-6 py-5">
                                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                        {t.dueDate
                                          ? new Date(
                                              t.dueDate,
                                            ).toLocaleDateString("vi-VN")
                                          : "---"}
                                      </div>
                                    </td>
                                    <td className="px-6 py-5">
                                      <TaskPriorityCell task={t} />
                                    </td>
                                    <td className="px-6 py-5">
                                      <TaskStatusCell
                                        task={t}
                                        updateTaskStatus={updateTaskStatus}
                                      />
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                      <TaskActionsCell
                                        task={t}
                                        onDelete={handleDeleteTask}
                                      />
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Tablet / Mobile View (Card List) */}
                        <div className="lg:hidden p-3 sm:p-6 space-y-3 sm:space-y-4 bg-slate-50/50">
                          {filteredTasks.length === 0 ? (
                            <NoTasksMessage setTaskFilters={setTaskFilters} />
                          ) : (
                            filteredTasks.map((t) => (
                              <div
                                key={t.id}
                                id={`task-${t.id}`}
                                className="task-card bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-sm active:scale-[0.98] transition-all"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div
                                    className="flex-1 min-w-0"
                                    onClick={() => {
                                      closeMobileDrawer();
                                      setEditingTask(t);
                                      setActiveModal("task-edit");
                                    }}
                                  >
                                    <h3 className="text-sm font-semibold text-[#002D56] leading-tight mb-2 line-clamp-2 tracking-tight">
                                      {t.title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[8px] font-semibold uppercase text-white bg-[#002D56] px-2 py-0.5 rounded-lg tracking-wider">
                                        {TASK_CATEGORIES.find(
                                          (c) => c.code === t.categoryCode,
                                        )?.name || t.categoryCode}
                                      </span>
                                      {t.isDeputy && (
                                        <span className="text-[8px] font-semibold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                          Kiêm nhiệm
                                        </span>
                                      )}
                                      {t.linkedDocumentIds &&
                                        t.linkedDocumentIds.length > 0 && (
                                          <span className="text-[8px] font-semibold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 italic flex items-center gap-1">
                                            <FileText className="w-2.5 h-2.5" />{" "}
                                            {t.linkedDocumentIds.length} tệp
                                          </span>
                                        )}
                                    </div>
                                  </div>
                                  <TaskActionsCell
                                    task={t}
                                    onDelete={handleDeleteTask}
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
                                  <div>
                                    <p className="text-[8px] font-semibold text-slate-400 tracking-normal mb-1">
                                      Thời hạn
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-700">
                                      <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                      {t.dueDate
                                        ? new Date(
                                            t.dueDate,
                                          ).toLocaleDateString("vi-VN")
                                        : "---"}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[8px] font-semibold text-slate-400 tracking-normal mb-1">
                                      Ưu tiên
                                    </p>
                                    <TaskPriorityCell task={t} />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-400">
                                      {t.assignee?.slice(0, 2).toUpperCase() ||
                                        "??"}
                                    </div>
                                    <p className="text-[10px] font-semibold text-slate-600 tracking-tight truncate max-w-[100px]">
                                      {t.assignee || "Chưa gán"}
                                    </p>
                                  </div>
                                  <TaskStatusCell
                                    task={t}
                                    updateTaskStatus={updateTaskStatus}
                                  />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : activeTab === "editor" ? (
                    taskType === "SLIDE_OUTLINE" ? (
                      <div className="w-full flex-col flex h-full min-h-0">
                        <div className="mb-4">
                          <button
                            onClick={() => setTaskType("WRITE_NEW")}
                            className="px-4 py-2 border border-slate-200 bg-white shadow-sm rounded-md text-[11px] tracking-normal font-bold text-[#002D56] hover:bg-slate-50 flex items-center gap-2"
                          >
                            ← Trở lại các công cụ khác
                          </button>
                        </div>
                        <SlideOutlineGenerator
                          user={user}
                          selectedSourceDocIds={selectedSourceDocIds}
                          documents={documents}
                          onOpenLibrary={() => setIsPickingFromLibrary(true)}
                          onSaveResult={handleSaveSlideOutline}
                          onCreateTask={handleCreateTaskFromSlideOutline}
                          loadedResult={safeParseSlideOutline(output)}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr] gap-6 h-full">
                        {/* Sidebar: Controls & Sources */}
                        <aside className="space-y-4 sm:space-y-6 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto overscroll-contain custom-scrollbar pr-1">
                          {/* Task Types */}
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <Target className="w-4 h-4 text-[#002D56]" />
                              <h2 className="text-xs font-semibold text-slate-800 tracking-normal">
                                Nhiệm vụ AI
                              </h2>
                            </div>
                            <div className="space-y-4">
                              {TASK_GROUPS.map((group, gIdx) => (
                                <div key={gIdx}>
                                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                                    {group.title}
                                  </h3>
                                  <div className="grid grid-cols-2 gap-2">
                                    {group.options.map((opt) => (
                                      <button
                                        key={opt.id}
                                        onClick={() =>
                                          setTaskType(opt.id as TaskType)
                                        }
                                        className={cn(
                                          "w-full flex flex-col items-start gap-2 p-3 rounded-md transition-all group text-left",
                                          taskType === opt.id
                                            ? "bg-[#002D56] text-white shadow-sm ring-1 ring-[#002D56]"
                                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "p-1.5 rounded-md",
                                            taskType === opt.id
                                              ? "bg-white/20 text-white"
                                              : "bg-white text-slate-500 shadow-sm group-hover:bg-white group-hover:text-[#002D56]",
                                          )}
                                        >
                                          <opt.icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                          <p className="font-bold text-[11px] leading-tight mb-0.5">
                                            {opt.label}
                                          </p>
                                          <p
                                            className={cn(
                                              "text-[8px] line-clamp-2 leading-tight font-medium opacity-80",
                                              taskType === opt.id
                                                ? "text-white"
                                                : "text-slate-400 group-hover:text-slate-500",
                                            )}
                                          >
                                            {opt.desc}
                                          </p>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>

                          {/* Output Format Selector */}
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <Type className="w-4 h-4 text-[#002D56]" />
                              <h2 className="text-xs font-semibold text-slate-800 tracking-normal">
                                Loại kết quả
                              </h2>
                            </div>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const menu =
                                    e.currentTarget.nextElementSibling;
                                  if (menu) {
                                    menu.classList.toggle("invisible");
                                    menu.classList.toggle("opacity-0");
                                  }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002D56] text-left flex items-center justify-between transition-all hover:bg-slate-100"
                              >
                                <span>
                                  {formatOptions.find(
                                    (o) => o.id === outputFormat,
                                  )?.label || "Chọn định dạng"}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              </button>
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-xl max-h-60 overflow-y-auto overscroll-contain custom-scrollbar z-[100] opacity-0 invisible transition-all">
                                {formatOptions.map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={(e) => {
                                      setOutputFormat(opt.id as OutputFormat);
                                      const menu =
                                        e.currentTarget.parentElement;
                                      if (menu) {
                                        menu.classList.add("invisible");
                                        menu.classList.add("opacity-0");
                                      }
                                    }}
                                    className={cn(
                                      "w-full text-left px-4 py-2 text-xs font-semibold transition-colors",
                                      outputFormat === opt.id
                                        ? "bg-blue-50 text-[#002D56]"
                                        : "text-slate-600 hover:bg-slate-50",
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </section>

                          {/* Project Specific Sources */}
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <Files className="w-5 h-5 text-[#002D56]" />
                              <h2 className="text-[14px] font-semibold text-slate-800">
                                Nguồn dữ liệu bài viết
                              </h2>
                            </div>

                            {/* Tab Controls */}
                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg mb-4 overflow-x-auto custom-scrollbar">
                              {[
                                { id: "library", label: "Từ kho", icon: Plus },
                                { id: "web", label: "Web", icon: Globe },
                                { id: "text", label: "Văn bản", icon: Type },
                                { id: "link", label: "Link", icon: LinkIcon },
                                {
                                  id: "upload",
                                  label: "Tải lên",
                                  icon: FileUp,
                                },
                              ].map((tab) => (
                                <button
                                  key={tab.id}
                                  onClick={() =>
                                    setSourceActiveTab(
                                      sourceActiveTab === tab.id
                                        ? null
                                        : (tab.id as any),
                                    )
                                  }
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap",
                                    sourceActiveTab === tab.id
                                      ? "bg-white text-[#002D56] shadow-sm"
                                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50",
                                  )}
                                >
                                  <tab.icon className="w-3.5 h-3.5" />
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            {/* Tab Forms */}
                            <AnimatePresence mode="wait">
                              {sourceActiveTab && (
                                <motion.div
                                  key={sourceActiveTab}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden mb-4"
                                >
                                  <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                                    {sourceActiveTab === "library" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Thư viện cá nhân
                                        </p>
                                        <button
                                          onClick={() => {
                                            setIsPickingFromLibrary(true);
                                            setSourceActiveTab(null);
                                          }}
                                          className="w-full py-3 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                          <Plus className="w-4 h-4" /> Mở Kho tư
                                          liệu
                                        </button>
                                      </div>
                                    )}

                                    {sourceActiveTab === "web" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Nghiên cứu Web AI
                                        </p>
                                        <div className="flex gap-2">
                                          <input
                                            autoFocus
                                            type="text"
                                            placeholder="VD: Quy định mớn nước luồng Lạch Huyện..."
                                            value={searchQuery}
                                            onChange={(e) =>
                                              setSearchQuery(e.target.value)
                                            }
                                            className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium"
                                            onKeyDown={(e) =>
                                              e.key === "Enter" &&
                                              handleWebSearch()
                                            }
                                          />
                                          <button
                                            onClick={handleWebSearch}
                                            disabled={isLoading}
                                            className="bg-[#002D56] text-white p-2 rounded-md hover:bg-slate-900 disabled:opacity-50"
                                          >
                                            {isLoading ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Search className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>

                                        {searchResults && (
                                          <div className="mt-4 space-y-3 max-h-[250px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed bg-blue-50 p-3 rounded-md border border-blue-100 italic">
                                              {searchResults.text.substring(
                                                0,
                                                200,
                                              )}
                                              ...
                                            </p>
                                            <div className="space-y-2">
                                              {searchResults.groundingMetadata?.groundingChunks?.map(
                                                (chunk: any, idx: number) => {
                                                  const title =
                                                    chunk.web?.title ||
                                                    `Nguồn ${idx + 1}`;
                                                  const uri = chunk.web?.uri;
                                                  return (
                                                    <div
                                                      key={`web-chunk-${idx}`}
                                                      className="group/res bg-white p-3 rounded-md border border-slate-100 hover:border-[#002D56] transition-all"
                                                    >
                                                      <div className="flex items-center gap-1.5 mb-1 opacity-60">
                                                        <Globe className="w-2.5 h-2.5" />
                                                        <span className="text-[8px] font-bold truncate">
                                                          {uri
                                                            ? getHostname(uri)
                                                            : "Nguồn Web"}
                                                        </span>
                                                      </div>
                                                      <h4 className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover/res:text-[#002D56]">
                                                        {title}
                                                      </h4>
                                                      <button
                                                        onClick={() =>
                                                          addSearchResultAsSource(
                                                            title,
                                                            `Nội dung từ tìm kiếm AI: ${title}`,
                                                            uri,
                                                          )
                                                        }
                                                        className="mt-2 text-[9px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                                      >
                                                        <Plus className="w-3 h-3" />{" "}
                                                        Trích xuất làm tư liệu
                                                      </button>
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {sourceActiveTab === "text" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Nhập văn bản nguồn
                                        </p>
                                        <input
                                          type="text"
                                          placeholder="Tên nguồn (tùy chọn)..."
                                          value={newTextName}
                                          onChange={(e) =>
                                            setNewTextName(e.target.value)
                                          }
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium"
                                        />
                                        <textarea
                                          placeholder="Dán nội dung vào đây..."
                                          value={newTextContent}
                                          onChange={(e) =>
                                            setNewTextContent(e.target.value)
                                          }
                                          className="w-full h-32 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium resize-none shadow-inner"
                                        />

                                        <label className="flex items-center gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={saveToLibrary}
                                            onChange={(e) =>
                                              setSaveToLibrary(e.target.checked)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-[#002D56] focus:ring-[#002D56]"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#002D56] transition-colors">
                                              Lưu vào Kho tư liệu
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">
                                              Nếu không chọn, tài liệu sẽ mất
                                              khi tải lại trang.
                                            </span>
                                          </div>
                                        </label>

                                        <div className="flex gap-2">
                                          <button
                                            onClick={handleAddText}
                                            className="flex-1 bg-[#002D56] text-white py-2.5 rounded-lg text-xs font-bold hover:bg-slate-900 transition-all shadow-md"
                                          >
                                            Thêm nguồn
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {sourceActiveTab === "link" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Dán liên kết
                                        </p>
                                        <input
                                          autoFocus
                                          type="text"
                                          placeholder="https://..."
                                          value={newLinkUrl}
                                          onChange={(e) =>
                                            setNewLinkUrl(e.target.value)
                                          }
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium"
                                          onKeyDown={(e) =>
                                            e.key === "Enter" && handleAddLink()
                                          }
                                        />

                                        <label className="flex items-center gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={saveToLibrary}
                                            onChange={(e) =>
                                              setSaveToLibrary(e.target.checked)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-[#002D56] focus:ring-[#002D56]"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#002D56] transition-colors">
                                              Lưu vào Kho tư liệu
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">
                                              Lưu link và nội dung tóm tắt vào
                                              thư viện.
                                            </span>
                                          </div>
                                        </label>

                                        <button
                                          onClick={handleAddLink}
                                          disabled={isParsing}
                                          className="w-full bg-[#002D56] text-white py-2.5 rounded-lg text-xs font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                                        >
                                          {isParsing && (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          )}
                                          Kết nối & Trích xuất
                                        </button>
                                      </div>
                                    )}

                                    {sourceActiveTab === "upload" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Tải lên tệp
                                        </p>
                                        <div
                                          onClick={() =>
                                            fileInputRef.current?.click()
                                          }
                                          className="w-full py-8 border-2 border-dashed border-slate-200 rounded-lg bg-white hover:border-[#002D56] hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                                        >
                                          <div className="p-3 bg-slate-50 rounded-full">
                                            <FileUp className="w-6 h-6 text-slate-400" />
                                          </div>
                                          <div className="text-center">
                                            <p className="text-xs font-bold text-slate-700">
                                              Click để chọn tệp
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                              Hỗ trợ PDF, Word, Ảnh (OCR)
                                            </p>
                                          </div>
                                        </div>

                                        <label className="flex items-center gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={saveToLibrary}
                                            onChange={(e) =>
                                              setSaveToLibrary(e.target.checked)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-[#002D56] focus:ring-[#002D56]"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#002D56] transition-colors">
                                              Lưu vào Kho tư liệu
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">
                                              Tệp sẽ được lưu vĩnh viễn trên hệ
                                              thống.
                                            </span>
                                          </div>
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Active Sources List */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                              {selectedSourceDocIds.length === 0 ? (
                                <div className="py-8 text-center bg-slate-50 rounded-md border border-dashed border-slate-200 px-4">
                                  <Database className="w-10 h-10 text-slate-100 mx-auto mb-4" />
                                  <p className="text-[11px] text-slate-400 font-bold tracking-normal leading-relaxed">
                                    Chưa chọn tài liệu nguồn cho AI. <br /> Hãy
                                    chọn từ thư viện, dán link hoặc nhập văn
                                    bản.
                                  </p>
                                </div>
                              ) : (
                                documents
                                  .filter((d) =>
                                    selectedSourceDocIds.includes(d.id),
                                  )
                                  .map((doc) => (
                                    <div
                                      key={doc.id}
                                      className={cn(
                                        "flex items-center gap-3 p-3 rounded-md border transition-all shadow-sm",
                                        doc.temporary
                                          ? "bg-amber-50/30 border-amber-100"
                                          : "bg-white border-blue-100",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "p-2 rounded-md shrink-0",
                                          doc.temporary
                                            ? "bg-amber-50 text-amber-600"
                                            : doc.type === "drive"
                                              ? "bg-slate-50 text-[#002D56]"
                                              : "bg-blue-50 text-blue-600",
                                        )}
                                      >
                                        {doc.driveIconUrl ? (
                                          <img
                                            src={doc.driveIconUrl}
                                            alt="icon"
                                            className="w-4 h-4 opacity-70"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <FileText className="w-4 h-4" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                          <p className="text-[11px] font-semibold text-slate-700 truncate tracking-tight">
                                            {doc.name}
                                          </p>
                                          {doc.temporary && (
                                            <span className="shrink-0 text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold uppercase">
                                              Tạm
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[9px] text-slate-400 font-bold tracking-normal truncate">
                                          {getDocTypeLabel(doc.type)} •{" "}
                                          {getSourceTypeLabel(doc.sourceType)}
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleDocSelection(doc.id);
                                        }}
                                        className="p-1 text-slate-300 hover:text-red-500 rounded-md transition-colors"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))
                              )}
                            </div>
                          </section>
                        </aside>

                        {/* Main Editor Area */}
                        <div className="space-y-6 min-w-0">
                          {/* Input Area */}
                          <section className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 sm:p-2.5 bg-[#002D56] rounded-md shadow-sm shadow-[#002D56]/10">
                                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                </div>
                                <div>
                                  <span className="text-xs sm:text-sm font-semibold text-[#002D56] tracking-normal">
                                    Yêu cầu biên soạn
                                  </span>
                                  {selectedSourceDocIds.length > 0 && (
                                    <p className="text-[8px] sm:text-[10px] text-emerald-600 font-semibold flex items-center gap-1.5 mt-0.5 uppercase">
                                      <Database className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />{" "}
                                      {selectedSourceDocIds.length} tệp nguồn đã
                                      chọn
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                {isParsing && (
                                  <span className="text-[9px] font-semibold text-amber-600 animate-pulse flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 tracking-normal">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Parsing...
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    setInput("");
                                    setOutput("");
                                    setError(null);
                                  }}
                                  className="text-slate-300 hover:text-red-500 p-2 sm:p-2.5 rounded-md transition-all hover:bg-red-50"
                                  title="Làm mới vùng biên tập"
                                >
                                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              </div>
                            </div>
                            <div className="relative flex-1 flex flex-col min-h-[300px] bg-slate-50/50">
                              {taskType === "WRITE_NEW" ? (
                                <div className="p-6 sm:p-6 flex-1 w-full space-y-6">
                                  <EditorialKindSelector
                                    value={editorialKind}
                                    onChange={setEditorialKind}
                                  />
                                  <EditorialInputForm
                                    kind={editorialKind}
                                    initialValue={input}
                                    onChange={setInput}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  value={input}
                                  onChange={(e) => setInput(e.target.value)}
                                  placeholder="Viết yêu cầu chi tiết của bạn tại đây để AI xử lý..."
                                  className="flex-1 w-full p-6 sm:p-6 pb-32 focus:outline-none resize-none text-slate-800 text-base sm:text-lg leading-relaxed placeholder:text-slate-400 placeholder:font-medium bg-transparent"
                                />
                              )}

                              <div className="absolute flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 bottom-0 right-0 w-full p-4 sm:p-6 pointer-events-none">
                                {!input.trim() &&
                                  selectedSourceDocIds.length === 0 && (
                                    <span className="text-[12px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 italic tracking-tight hidden sm:block">
                                      Nhập yêu cầu để bắt đầu
                                    </span>
                                  )}
                                <button
                                  disabled={
                                    (!input.trim() &&
                                      selectedSourceDocIds.length === 0) ||
                                    isLoading ||
                                    isParsing ||
                                    isBuildingTasks
                                  }
                                  onClick={
                                    taskType === "TASK_BUILDER"
                                      ? handleBuildTasks
                                      : handleProcess
                                  }
                                  className={cn(
                                    "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-md font-semibold text-[13px] tracking-normal transition-all duration-300 shadow-md active:scale-[0.98] pointer-events-auto shrink-0",
                                    (!input.trim() &&
                                      selectedSourceDocIds.length === 0) ||
                                      isLoading ||
                                      isParsing ||
                                      isBuildingTasks
                                      ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                                      : "bg-[#002D56] text-white hover:bg-slate-900 shadow-[#002D56]/30 hover:shadow-sm",
                                  )}
                                >
                                  {isLoading || isBuildingTasks ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Đang xử lý...
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-4 h-4 fill-current" />
                                      {!input.trim() &&
                                      selectedSourceDocIds.length === 0
                                        ? "Nhập yêu cầu để bắt đầu"
                                        : "Bắt đầu xử lý"}
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-5">
                              <div className="flex items-start gap-3 w-full">
                                <div className="p-1.5 bg-blue-100 rounded-lg shrink-0 mt-0.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#002D56]" />
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                  Hệ thống sẽ đồng nhất thuật ngữ và cấu trúc
                                  bài viết theo quy chuẩn Hoa Tiêu Miền Bắc.
                                </p>
                              </div>
                            </div>
                          </section>

                          {/* Task Builder Results */}
                          <AnimatePresence>
                            {builtTasks.length > 0 && (
                              <motion.section
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 30 }}
                                className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden"
                              >
                                <div className="px-6 sm:px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                                  <div className="flex items-center gap-4 w-full sm:w-auto">
                                    <div className="bg-[#002D56] p-3 rounded-md shadow-sm shrink-0">
                                      <Target className="text-white w-6 h-6" />
                                    </div>
                                    <div>
                                      <h2 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">
                                        Kế hoạch công việc trích xuất
                                      </h2>
                                      <p className="text-xs sm:text-sm text-slate-500 font-medium">
                                        Rà soát và lưu danh sách công việc đã
                                        được AI lập kế hoạch.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                                    <button
                                      onClick={() => {
                                        const allSelected = (
                                          builtTasks as any[]
                                        ).every((t) => t.selected);
                                        setBuiltTasks((prev) =>
                                          prev.map((t) => ({
                                            ...t,
                                            selected: !allSelected,
                                          })),
                                        );
                                      }}
                                      className="bg-slate-100 text-slate-600 px-4 py-3 rounded-md font-bold text-[10px] sm:text-xs tracking-normal hover:bg-slate-200 transition-all whitespace-nowrap"
                                    >
                                      {(builtTasks as any[]).every(
                                        (t) => t.selected,
                                      )
                                        ? "Bỏ chọn hết"
                                        : "Chọn tất cả"}
                                    </button>
                                    <button
                                      onClick={() => setBuiltTasks([])}
                                      className="bg-red-50 text-red-500 p-3 rounded-md hover:bg-red-100 transition-all shrink-0"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={saveBuiltTasks}
                                      disabled={isBuildingTasks}
                                      className="bg-emerald-500 text-white px-6 py-3 rounded-md font-semibold text-[10px] sm:text-xs tracking-normal hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shrink-0 flex-1 sm:flex-initial"
                                    >
                                      <Save className="w-4 h-4" /> Lưu đã chọn
                                    </button>
                                  </div>
                                </div>

                                <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 bg-slate-50/50">
                                  {(builtTasks as any[]).map((task, idx) => (
                                    <div
                                      key={task.id}
                                      className={`bg-white p-6 rounded-md shadow-sm border transition-all relative ${task.selected ? "border-[#002D56] shadow-md ring-4 ring-[#002D56]/5" : "border-slate-200 shadow-slate-200/50"}`}
                                    >
                                      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={task.selected}
                                          onChange={() =>
                                            setBuiltTasks((prev) =>
                                              prev.map((t) =>
                                                t.id === task.id
                                                  ? {
                                                      ...t,
                                                      selected: !t.selected,
                                                    }
                                                  : t,
                                              ),
                                            )
                                          }
                                          className="w-5 h-5 rounded-lg text-[#002D56] focus:ring-[#002D56] border-slate-300 cursor-pointer"
                                        />
                                      </div>

                                      <div className="flex items-start justify-between mb-5 pl-10">
                                        <div className="flex flex-col gap-1 w-full min-w-0">
                                          <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <select
                                              value={task.categoryCode}
                                              onChange={(e) =>
                                                setBuiltTasks((prev) =>
                                                  prev.map((t) =>
                                                    t.id === task.id
                                                      ? {
                                                          ...t,
                                                          categoryCode:
                                                            e.target.value,
                                                        }
                                                      : t,
                                                  ),
                                                )
                                              }
                                              className="bg-blue-50 text-[#002D56] text-[9px] font-semibold tracking-normal px-3 py-1 rounded-md border-none focus:ring-1 focus:ring-blue-300 outline-none cursor-pointer"
                                            >
                                              {TASK_CATEGORIES.map((c) => (
                                                <option
                                                  key={c.code}
                                                  value={c.code}
                                                >
                                                  {c.name}
                                                </option>
                                              ))}
                                            </select>
                                            <select
                                              value={task.priority}
                                              onChange={(e) =>
                                                setBuiltTasks((prev) =>
                                                  prev.map((t) =>
                                                    t.id === task.id
                                                      ? {
                                                          ...t,
                                                          priority: e.target
                                                            .value as any,
                                                        }
                                                      : t,
                                                  ),
                                                )
                                              }
                                              className={cn(
                                                "text-[9px] font-semibold tracking-normal px-3 py-1 rounded-md border-none outline-none cursor-pointer",
                                                task.priority === "urgent"
                                                  ? "bg-red-50 text-red-600"
                                                  : task.priority === "high"
                                                    ? "bg-orange-50 text-orange-600"
                                                    : "bg-slate-100 text-slate-500",
                                              )}
                                            >
                                              <option value="low">
                                                Ưu tiên: Thấp
                                              </option>
                                              <option value="medium">
                                                Ưu tiên: Vừa
                                              </option>
                                              <option value="high">
                                                Ưu tiên: Cao
                                              </option>
                                              <option value="urgent">
                                                Cấp bách
                                              </option>
                                            </select>
                                          </div>
                                          <input
                                            value={task.title}
                                            onChange={(e) =>
                                              setBuiltTasks((prev) =>
                                                prev.map((t) =>
                                                  t.id === task.id
                                                    ? {
                                                        ...t,
                                                        title: e.target.value,
                                                      }
                                                    : t,
                                                ),
                                              )
                                            }
                                            className="text-base sm:text-lg font-semibold text-[#002D56] bg-transparent border-b-2 border-transparent hover:border-slate-100 focus:border-[#002D56] focus:outline-none w-full tracking-tight"
                                            placeholder="Tên nhiệm vụ..."
                                          />
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            onClick={async () => {
                                              const docId =
                                                await persistTask(task);
                                              if (docId) {
                                                toast.success(
                                                  "Đã lưu công việc",
                                                );
                                                setBuiltTasks((prev) =>
                                                  prev.filter(
                                                    (t) => t.id !== task.id,
                                                  ),
                                                );
                                              }
                                            }}
                                            className="text-emerald-500 hover:bg-emerald-50 p-2 rounded-md transition-all shadow-sm active:scale-[0.98]"
                                            title="Lưu riêng nhiệm vụ này"
                                          >
                                            <Check className="w-5 h-5" />
                                          </button>
                                          <button
                                            onClick={() =>
                                              setBuiltTasks((prev) =>
                                                prev.filter(
                                                  (t) => t.id !== task.id,
                                                ),
                                              )
                                            }
                                            className="text-slate-300 hover:text-red-500 transition-all p-2 rounded-md active:scale-[0.98]"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <label className="text-[9px] font-semibold text-slate-400 tracking-normal flex items-center gap-1.5">
                                              <User className="w-3 h-3" /> Phụ
                                              trách
                                            </label>
                                            <input
                                              value={task.assignee}
                                              onChange={(e) =>
                                                setBuiltTasks((prev) =>
                                                  prev.map((t) =>
                                                    t.id === task.id
                                                      ? {
                                                          ...t,
                                                          assignee:
                                                            e.target.value,
                                                        }
                                                      : t,
                                                  ),
                                                )
                                              }
                                              placeholder="Gán tên..."
                                              className="w-full bg-transparent border-none p-0 text-xs font-semibold text-[#002D56] tracking-tight focus:ring-0 focus:outline-none placeholder:text-slate-300"
                                            />
                                          </div>
                                          <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-100">
                                            <label className="text-[9px] font-semibold text-slate-400 tracking-normal flex items-center gap-1.5">
                                              <Calendar className="w-3 h-3" />{" "}
                                              Hạn xử lý
                                            </label>
                                            <input
                                              type="date"
                                              value={task.dueDate || ""}
                                              onChange={(e) =>
                                                setBuiltTasks((prev) =>
                                                  prev.map((t) =>
                                                    t.id === task.id
                                                      ? {
                                                          ...t,
                                                          dueDate:
                                                            e.target.value,
                                                        }
                                                      : t,
                                                  ),
                                                )
                                              }
                                              className="w-full bg-transparent border-none p-0 text-xs font-semibold text-[#002D56] focus:ring-0 focus:outline-none cursor-pointer"
                                            />
                                          </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-md border border-slate-100">
                                          <label className="text-[9px] font-semibold text-slate-400 tracking-normal mb-1.5 block">
                                            Chi tiết nghiệp vụ
                                          </label>
                                          <textarea
                                            value={task.description}
                                            onChange={(e) =>
                                              setBuiltTasks((prev) =>
                                                prev.map((t) =>
                                                  t.id === task.id
                                                    ? {
                                                        ...t,
                                                        description:
                                                          e.target.value,
                                                      }
                                                    : t,
                                                ),
                                              )
                                            }
                                            rows={2}
                                            placeholder="Mô tả các bước thực hiện..."
                                            className="w-full bg-transparent text-[11px] text-slate-600 font-bold leading-relaxed resize-none focus:outline-none placeholder:text-slate-300 border-none p-0 focus:ring-0"
                                          />
                                        </div>
                                        {(task.sourceText ||
                                          task.assigneeText) && (
                                          <div className="grid grid-cols-2 gap-4 mt-2">
                                            {task.assigneeText && (
                                              <div className="p-3 bg-purple-50 rounded-md border border-purple-100">
                                                <label className="text-[9px] font-semibold text-purple-400 tracking-normal mb-1 block">
                                                  Tên phụ trách (Raw)
                                                </label>
                                                <p className="text-[11px] text-purple-700 font-medium">
                                                  Lưu ý tên trích xuất:{" "}
                                                  {task.assigneeText}
                                                </p>
                                              </div>
                                            )}
                                            {task.sourceText && (
                                              <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
                                                <label className="text-[9px] font-semibold text-blue-400 tracking-normal mb-1 block">
                                                  Tài liệu Nguồn
                                                </label>
                                                <p className="text-[10px] text-blue-700 font-medium italic line-clamp-2">
                                                  "{task.sourceText}"
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {task.nextActions &&
                                          task.nextActions.length > 0 && (
                                            <div className="p-3 bg-slate-100 rounded-md">
                                              <label className="text-[9px] font-semibold text-slate-500 tracking-normal mb-2 block">
                                                Hành động tiếp theo
                                              </label>
                                              <ul className="list-disc pl-4 space-y-1">
                                                {task.nextActions.map(
                                                  (action, actionIdx) => (
                                                    <li
                                                      key={actionIdx}
                                                      className="text-[10px] text-slate-600 font-medium"
                                                    >
                                                      {action}
                                                    </li>
                                                  ),
                                                )}
                                              </ul>
                                            </div>
                                          )}
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            id={`deputy-${task.id}`}
                                            checked={task.isDeputy}
                                            onChange={(e) =>
                                              setBuiltTasks((prev) =>
                                                prev.map((t) =>
                                                  t.id === task.id
                                                    ? {
                                                        ...t,
                                                        isDeputy:
                                                          e.target.checked,
                                                      }
                                                    : t,
                                                ),
                                              )
                                            }
                                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                                          />
                                          <label
                                            htmlFor={`deputy-${task.id}`}
                                            className="text-[10px] font-semibold uppercase text-amber-600 tracking-wide cursor-pointer select-none"
                                          >
                                            P. Trưởng phòng / Kiêm nhiệm
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.section>
                            )}
                          </AnimatePresence>

                          {/* Error Message */}
                          <AnimatePresence>
                            {error && (
                              <motion.div
                                key="error-alert"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-red-50 border border-red-200 text-red-600 p-5 rounded-md flex items-start gap-4 shadow-sm"
                              >
                                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm tracking-tight mb-1">
                                    Cảnh báo hệ thống
                                  </h4>
                                  <p className="text-sm font-medium opacity-80">
                                    {error}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Output / Results */}
                          <AnimatePresence>
                            {output && output.trim() && (
                              <motion.section
                                key="output-panel"
                                ref={outputRef}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden"
                              >
                                <div className="px-5 sm:px-8 py-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-semibold text-slate-400 tracking-normal mb-0.5">
                                          Sản phẩm truyền thông
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() =>
                                              setIsEditing(!isEditing)
                                            }
                                            className={cn(
                                              "text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight",
                                              isEditing
                                                ? "bg-[#002D56] text-white shadow-sm"
                                                : "bg-white border border-slate-200 text-[#002D56] hover:bg-slate-50",
                                            )}
                                          >
                                            {isEditing ? (
                                              <Save className="w-3.5 h-3.5" />
                                            ) : (
                                              <Edit3 className="w-3.5 h-3.5" />
                                            )}
                                            {isEditing
                                              ? "Đang sửa"
                                              : "Sửa thủ công"}
                                          </button>
                                          {currentSessionId &&
                                            sessions.find(
                                              (s) => s.id === currentSessionId,
                                            )?.versions.length! > 1 && (
                                              <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 tracking-wide bg-white px-2 py-1 rounded-lg border border-slate-100">
                                                <History className="w-3 h-3" />
                                                {
                                                  sessions.find(
                                                    (s) =>
                                                      s.id === currentSessionId,
                                                  )?.versions.length
                                                }{" "}
                                                hồ sơ
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={handleCopy}
                                        className={cn(
                                          "p-2.5 rounded-md transition-all shadow-sm active:scale-90 border",
                                          copySuccess
                                            ? "bg-emerald-600 text-white border-emerald-500"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                                        )}
                                        title="Sao chép"
                                      >
                                        {copySuccess ? (
                                          <Check className="w-4 h-4" />
                                        ) : (
                                          <Copy className="w-4 h-4" />
                                        )}
                                      </button>
                                      {isEditing && (
                                        <button
                                          onClick={() => {
                                            saveCurrentToSession();
                                            setIsEditing(false);
                                          }}
                                          className="p-2.5 rounded-md bg-emerald-600 text-white shadow-sm shadow-emerald-200 active:scale-90 border border-emerald-500"
                                          title="Lưu phiên bản"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {taskType === "WRITE_NEW" && (
                                    <EditorialPreflightPanel
                                      kind={editorialKind}
                                      markdownContent={output}
                                    />
                                  )}

                                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                                    <button
                                      onClick={handleLocalIllustrationScan}
                                      disabled={
                                        isLoading || isPlanningImages || !output
                                      }
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-md text-[10px] font-semibold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-all active:scale-[0.98] disabled:opacity-50 tracking-normal shrink-0"
                                    >
                                      <Search className="w-3.5 h-3.5 text-amber-600" />
                                      QUÉT VỊ TRÍ HÌNH
                                    </button>

                                    <button
                                      onClick={handleAIIllustrationSuggestions}
                                      disabled={
                                        isLoading || isPlanningImages || !output
                                      }
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-md text-[10px] font-semibold border border-blue-200 text-[#002D56] hover:bg-[#002D56]/5 transition-all active:scale-[0.98] disabled:opacity-50 tracking-normal shrink-0 bg-white"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                      GỢI Ý BẰNG AI
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (!output) return;
                                        const input =
                                          document.createElement("input");
                                        input.type = "file";
                                        input.accept = "image/*";
                                        input.onchange = (e) => {
                                          const file = (
                                            e.target as HTMLInputElement
                                          ).files?.[0];
                                          if (file)
                                            setSelectingParagraphForImage({
                                              file,
                                            });
                                        };
                                        input.click();
                                      }}
                                      disabled={isLoading || !output}
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-md text-[10px] font-semibold bg-[#002D56] text-white hover:bg-slate-900 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md tracking-normal shrink-0"
                                    >
                                      <FileUp className="w-4 h-4" />
                                      TẢI ẢNH TỰ DO
                                    </button>

                                    <button
                                      onClick={() => {
                                        setInput(output);
                                        setTaskType("TASK_BUILDER");
                                        if (window.innerWidth >= 1024)
                                          window.scrollTo({
                                            top: 0,
                                            behavior: "smooth",
                                          });
                                      }}
                                      disabled={isLoading || !output}
                                      className="flex items-center gap-2 px-4 py-2.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 tracking-normal shrink-0"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      TẠO TASK
                                    </button>

                                    <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />

                                    <button
                                      onClick={async () => {
                                        const audit =
                                          auditEditorialPublish(illustrations);
                                        if (audit.suggestedCount > 0) {
                                          const confirmed =
                                            await requestConfirmAsync(
                                              `Còn ${audit.suggestedCount} hình ảnh chưa được duyệt. Bạn có muốn tiếp tục xuất bản PDF mà không có các hình này?`,
                                            );
                                          if (!confirmed) return;
                                        }
                                        try {
                                          toast(
                                            "Tính năng xuất PDF dạng văn bản (text searchable) đang được nâng cấp ở server. Hệ thống sẽ tạm xuất file dạng hình ảnh (Visual Snapshot).",
                                            { icon: "ℹ️", duration: 5000 },
                                          );
                                          const { exportVisualSnapshotPDF } =
                                            await import("./lib/exportUtils");
                                          await exportVisualSnapshotPDF(
                                            "printable-article",
                                            `Bai_viet_HTMB_${Date.now()}`,
                                          );

                                          if (currentSessionId) {
                                            await logActivity({
                                              module: "editorial",
                                              action: "exported",
                                              entityType: "editorial_session",
                                              entityId: currentSessionId,
                                              entityTitle:
                                                sessions.find(
                                                  (s) =>
                                                    s.id === currentSessionId,
                                                )?.title || "Bài viết",
                                              title: "Xuất PDF",
                                              summary:
                                                "Đã xuất bài viết ra định dạng PDF (Visual Snapshot).",
                                              metadata: {
                                                exportFormat: "pdf",
                                                source: "client",
                                              },
                                            });
                                          }
                                        } catch (err: any) {
                                          setError(err.message);
                                        }
                                      }}
                                      className="flex items-center gap-2 p-2.5 rounded-md bg-white text-red-600 border border-red-100 hover:bg-red-50 transition-all shrink-0 active:scale-[0.98]"
                                      title="Xuất PDF"
                                    >
                                      <FileDown className="w-4 h-4" />
                                      <span className="text-[10px] font-semibold uppercase">
                                        PDF
                                      </span>
                                    </button>

                                    <button
                                      onClick={async () => {
                                        const audit =
                                          auditEditorialPublish(illustrations);
                                        if (audit.suggestedCount > 0) {
                                          const confirmed =
                                            await requestConfirmAsync(
                                              `Còn ${audit.suggestedCount} hình ảnh chưa được duyệt. Bạn có muốn tiếp tục xuất bản Word mà không có các hình này?`,
                                            );
                                          if (!confirmed) return;
                                        }
                                        try {
                                          let cleanContent =
                                            stripResolvedPlaceholders(
                                              removeBrokenMarkdownImages(
                                                output,
                                              ),
                                              illustrations,
                                              true,
                                            );
                                          const {
                                            extractExportTitle,
                                            exportToWord,
                                          } = await import("./lib/exportUtils");
                                          const extracted = extractExportTitle(
                                            input,
                                            cleanContent,
                                          );
                                          await exportToWord(
                                            extracted.title,
                                            extracted.body,
                                            `Bai_viet_HTMB_${Date.now()}`,
                                            illustrations,
                                            editorialKind,
                                          );

                                          if (currentSessionId) {
                                            await logActivity({
                                              module: "editorial",
                                              action: "exported",
                                              entityType: "editorial_session",
                                              entityId: currentSessionId,
                                              entityTitle:
                                                sessions.find(
                                                  (s) =>
                                                    s.id === currentSessionId,
                                                )?.title || "Bài viết",
                                              title: "Xuất Word",
                                              summary:
                                                "Đã xuất bài viết ra định dạng Word (DOCX).",
                                              metadata: {
                                                exportFormat: "docx",
                                                source: "client",
                                              },
                                            });
                                          }
                                        } catch (err: any) {
                                          setError(err.message);
                                        }
                                      }}
                                      className="flex items-center gap-2 p-2.5 rounded-md bg-white text-blue-600 border border-blue-100 hover:bg-blue-50 transition-all shrink-0 active:scale-[0.98]"
                                      title="Xuất Word"
                                    >
                                      <FileText className="w-4 h-4" />
                                      <span className="text-[10px] font-semibold uppercase">
                                        Word
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {/* Illustration Progress / Dashboard - MOVED OUT OF PRINTABLE AREA */}
                                {(illustrations.length > 0 ||
                                  imagePlans.length > 0) && (
                                  <div className="mx-8 md:mx-12 mt-8 p-6 bg-slate-50 border border-slate-200 rounded-md">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
                                      <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="bg-[#002D56] p-3 rounded-md shadow-sm shrink-0">
                                          <ImageIcon className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                          <h4 className="text-sm font-semibold tracking-normal text-[#002D56]">
                                            Duyệt hình bài viết
                                          </h4>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                            Xác nhận ảnh tải lên để xuất bản văn
                                            bản
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                                        {illustrations.some(
                                          (img) =>
                                            img.reviewStatus === "suggested" &&
                                            img.status === "ready",
                                        ) && (
                                          <button
                                            onClick={
                                              approveAllValidIllustrations
                                            }
                                            className="flex-1 sm:flex-initial bg-emerald-500/10 text-emerald-600 px-5 py-2.5 rounded-md font-semibold text-[10px] tracking-wide hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                          >
                                            <CheckCircle className="w-4 h-4 shrink-0" />{" "}
                                            Duyệt tất cả
                                          </button>
                                        )}
                                        {illustrations.some(
                                          (img) =>
                                            img.status === "error" ||
                                            img.qualityStatus === "failed" ||
                                            img.reviewStatus === "rejected",
                                        ) && (
                                          <button
                                            onClick={clearErrorImages}
                                            className="flex-1 sm:flex-initial bg-red-500/10 text-red-600 px-5 py-2.5 rounded-md font-semibold text-[10px] tracking-wide hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                          >
                                            <Trash2 className="w-4 h-4 shrink-0" />{" "}
                                            Dọn ảnh loại
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="space-y-10">
                                      {/* 1. Vị trí cần ảnh (Plans without images) */}
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 ml-2">
                                          <Target className="w-4 h-4 text-amber-500" />
                                          <h5 className="text-[11px] font-semibold tracking-normal text-slate-500">
                                            Vị trí cần bổ sung ảnh
                                          </h5>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                          {imagePlans.map((plan) => {
                                            const hasImage = illustrations.some(
                                              (img) => img.planId === plan.id,
                                            );
                                            if (hasImage) return null;
                                            return (
                                              <div
                                                key={plan.id}
                                                className="bg-white p-5 rounded-md border border-slate-200 shadow-sm hover:shadow-md transition-all group border-dashed"
                                              >
                                                <div className="flex items-start justify-between mb-4">
                                                  <div className="w-10 h-10 rounded-md bg-amber-50 flex items-center justify-center font-semibold text-amber-600 text-xs">
                                                    P{plan.paragraphIndex}
                                                  </div>
                                                  <button
                                                    onClick={() => {
                                                      const input =
                                                        document.createElement(
                                                          "input",
                                                        );
                                                      input.type = "file";
                                                      input.accept = "image/*";
                                                      input.onchange = (e) => {
                                                        const file = (
                                                          e.target as HTMLInputElement
                                                        ).files?.[0];
                                                        if (file)
                                                          handleManualUpload(
                                                            file,
                                                            plan.paragraphIndex,
                                                            plan.id,
                                                          );
                                                      };
                                                      input.click();
                                                    }}
                                                    className="w-10 h-10 rounded-md bg-[#002D56] text-white flex items-center justify-center hover:bg-slate-900 transition-all shadow-md group-hover:scale-110 active:scale-[0.98]"
                                                    title="Tải ảnh cho vị trí này"
                                                  >
                                                    <FileUp className="w-5 h-5" />
                                                  </button>
                                                </div>
                                                <h6 className="text-[11px] font-semibold text-slate-800 tracking-tight mb-2 line-clamp-2">
                                                  {plan.caption}
                                                </h6>
                                                <p className="text-[10px] font-medium text-slate-400 italic mb-4 leading-relaxed">
                                                  {plan.reason}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[8px] font-semibold tracking-normal px-2 py-1 bg-slate-100 text-slate-400 rounded-lg">
                                                    Chưa có ảnh
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                          {imagePlans.every((plan) =>
                                            illustrations.some(
                                              (img) => img.planId === plan.id,
                                            ),
                                          ) &&
                                            imagePlans.length > 0 && (
                                              <div className="col-span-full py-8 text-center bg-white rounded-md border border-emerald-200 border-dashed">
                                                <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
                                                <p className="text-xs font-bold text-emerald-600 tracking-normal">
                                                  Tất cả vị trí kế hoạch đã được
                                                  đăng tải ảnh
                                                </p>
                                              </div>
                                            )}
                                          {imagePlans.length === 0 && (
                                            <div className="col-span-full py-8 text-center bg-white/50 rounded-md border border-slate-200 border-dashed">
                                              <p className="text-xs font-bold text-slate-300 tracking-normal italic">
                                                Bấm "LẬP KẾ HOẠCH HÌNH" để AI đề
                                                xuất các vị trí cần minh họa
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* 2. Ảnh chờ duyệt (Suggested) */}
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 ml-2">
                                          <Clock className="w-4 h-4 text-blue-500" />
                                          <h5 className="text-[11px] font-semibold tracking-normal text-slate-500">
                                            Ảnh chờ duyệt
                                          </h5>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                          {illustrations
                                            .filter(
                                              (img) =>
                                                img.reviewStatus ===
                                                "suggested",
                                            )
                                            .map((img, idx) => (
                                              <div
                                                key={`${img.id}-${idx}`}
                                                className="bg-white p-4 rounded-md border border-blue-100 shadow-sm relative group overflow-hidden"
                                              >
                                                <div className="aspect-video rounded-md overflow-hidden mb-4 relative">
                                                  <img
                                                    src={img.url}
                                                    alt={img.caption}
                                                    className="w-full h-full object-cover"
                                                  />
                                                  <div className="absolute inset-0 bg-blue-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                    <button
                                                      onClick={() =>
                                                        approveIllustration(
                                                          img.id,
                                                        )
                                                      }
                                                      className="w-10 h-10 bg-emerald-500 text-white rounded-md shadow-md flex items-center justify-center hover:scale-110 active:scale-[0.98] transition-all"
                                                      title="Duyệt ảnh"
                                                    >
                                                      <Check className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        rejectIllustration(
                                                          img.id,
                                                        )
                                                      }
                                                      className="w-10 h-10 bg-red-500 text-white rounded-md shadow-md flex items-center justify-center hover:scale-110 active:scale-[0.98] transition-all"
                                                      title="Từ chối"
                                                    >
                                                      <X className="w-5 h-5" />
                                                    </button>
                                                  </div>
                                                </div>
                                                <h6 className="text-[10px] font-semibold text-slate-800 tracking-tight truncate px-1 mb-1">
                                                  {img.caption}
                                                </h6>
                                                <div className="flex items-center justify-between px-1">
                                                  <span className="text-[8px] font-semibold text-blue-500 uppercase">
                                                    P{img.paragraphIndex} • CHỜ
                                                    DUYỆT
                                                  </span>
                                                  <button
                                                    onClick={() =>
                                                      setIllustrations((prev) =>
                                                        prev.filter(
                                                          (i) =>
                                                            i.id !== img.id,
                                                        ),
                                                      )
                                                    }
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </div>
                                            ))}
                                          {illustrations.filter(
                                            (img) =>
                                              img.reviewStatus === "suggested",
                                          ).length === 0 && (
                                            <div className="col-span-full py-8 text-center text-slate-300 font-bold uppercase text-[10px] tracking-wide border border-slate-200 border-dashed rounded-md">
                                              Không có ảnh chờ duyệt
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* 3. Ảnh đã duyệt (Approved) */}
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 ml-2">
                                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                          <h5 className="text-[11px] font-semibold tracking-normal text-slate-500">
                                            Ảnh đã duyệt (Sẽ xuất PDF/Word)
                                          </h5>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                          {illustrations
                                            .filter(
                                              (img) =>
                                                img.reviewStatus === "approved",
                                            )
                                            .map((img, idx) => (
                                              <div
                                                key={`${img.id}-${idx}`}
                                                className="bg-white p-4 rounded-md border border-emerald-200 shadow-sm relative group overflow-hidden"
                                              >
                                                <div className="aspect-video rounded-md overflow-hidden mb-4 relative">
                                                  <img
                                                    src={img.url}
                                                    alt={img.caption}
                                                    className="w-full h-full object-cover"
                                                  />
                                                  <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1.5 rounded-md shadow-sm">
                                                    <Check className="w-3 h-3" />
                                                  </div>
                                                  <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                    <button
                                                      onClick={() =>
                                                        rejectIllustration(
                                                          img.id,
                                                        )
                                                      }
                                                      className="w-10 h-10 bg-white text-red-500 rounded-md shadow-md flex items-center justify-center hover:scale-110 active:scale-[0.98] transition-all"
                                                      title="Hủy duyệt"
                                                    >
                                                      <X className="w-5 h-5" />
                                                    </button>
                                                  </div>
                                                </div>
                                                <h6 className="text-[10px] font-semibold text-slate-800 tracking-tight truncate px-1 mb-1">
                                                  {img.caption}
                                                </h6>
                                                <div className="flex items-center justify-between px-1">
                                                  <span className="text-[8px] font-semibold text-emerald-600 uppercase">
                                                    P{img.paragraphIndex} • ĐÃ
                                                    DUYỆT
                                                  </span>
                                                  <p className="text-[8px] font-bold text-slate-300">
                                                    Xuất sẵn sàng
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          {illustrations.filter(
                                            (img) =>
                                              img.reviewStatus === "approved",
                                          ).length === 0 && (
                                            <div className="col-span-full py-8 text-center text-slate-300 font-bold uppercase text-[10px] tracking-wide border border-slate-200 border-dashed rounded-md">
                                              Chưa có ảnh nào được duyệt
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div
                                  className="p-6 md:p-12 bg-[#FCFDFF] printable-article"
                                  id="printable-article"
                                >
                                  {contentReview && (
                                    <ContentReviewDisplay
                                      review={contentReview}
                                    />
                                  )}

                                  <div className="prose prose-slate max-w-none prose-headings:text-[#002D56] prose-headings:font-semibold prose-p:text-slate-700 prose-p:text-lg prose-p:leading-relaxed prose-li:text-slate-600 font-serif">
                                    {isEditing ? (
                                      <textarea
                                        value={output}
                                        onChange={(e) =>
                                          setOutput(e.target.value)
                                        }
                                        className="w-full h-[600px] p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-lg leading-relaxed font-serif focus:outline-none focus:border-[#002D56] transition-all"
                                      />
                                    ) : (
                                      <ReactMarkdown
                                        components={{
                                          h1: ({ node, ...props }) => (
                                            <h1
                                              className="text-3xl md:text-5xl font-semibold text-[#002D56] mb-8 leading-tight tracking-tight uppercase"
                                              {...props}
                                            />
                                          ),
                                          h2: ({ node, ...props }) => (
                                            <h2
                                              className="text-2xl md:text-3xl mt-14 mb-6 pb-4 border-b-4 border-[#002D56]/10 font-semibold"
                                              {...props}
                                            />
                                          ),
                                          h3: ({ node, ...props }) => (
                                            <h3
                                              className="text-xl font-bold text-slate-800 mt-10 mb-4 flex items-center gap-3 bg-slate-50 p-4 rounded-md border-l-8 border-[#002D56]"
                                              {...props}
                                            />
                                          ),
                                          p: ({ node, children, ...props }) => {
                                            return (
                                              <p
                                                className="mb-8 text-justify"
                                                {...props}
                                              >
                                                {children}
                                              </p>
                                            );
                                          },
                                          strong: ({ node, ...props }) => (
                                            <strong
                                              className="font-semibold text-slate-900 underline decoration-[#002D56]/20 underline-offset-4"
                                              {...props}
                                            />
                                          ),
                                          em: ({ node, ...props }) => (
                                            <em
                                              className="text-slate-500 italic block border-l-4 border-[#002D56]/20 pl-8 my-10 py-4 text-2xl bg-[#002D56]/5 rounded-r-3xl leading-snug"
                                              {...props}
                                            />
                                          ),
                                          img: ({
                                            node,
                                            src,
                                            alt,
                                            ...props
                                          }) => {
                                            // Double check URL validity
                                            if (
                                              !src ||
                                              (!src.startsWith("http") &&
                                                !src.startsWith("data:"))
                                            ) {
                                              return null;
                                            }

                                            // Find metadata to get ID if possible
                                            const meta = illustrations.find(
                                              (i) => i.url === src,
                                            );
                                            if (
                                              meta &&
                                              !isPublishableIllustration(meta)
                                            )
                                              return null;
                                            if (
                                              meta &&
                                              meta.loadStatus === "error"
                                            )
                                              return null;

                                            return (
                                              <div className="my-10 group relative">
                                                <img
                                                  src={src}
                                                  alt={alt || "Hình minh họa"}
                                                  className={cn(
                                                    "rounded-md shadow-sm border-4 border-white mx-auto w-full transition-all",
                                                    meta?.reviewStatus ===
                                                      "suggested" &&
                                                      "opacity-75 grayscale-[20%] ring-8 ring-[#002D56]/10",
                                                  )}
                                                  onLoad={() =>
                                                    meta &&
                                                    updateImageLoadStatus(
                                                      meta.id,
                                                      "loaded",
                                                    )
                                                  }
                                                  onError={() =>
                                                    meta &&
                                                    updateImageLoadStatus(
                                                      meta.id,
                                                      "error",
                                                    )
                                                  }
                                                  {...props}
                                                />
                                                {meta?.reviewStatus ===
                                                  "suggested" && (
                                                  <div className="absolute top-6 left-6 bg-[#002D56] text-white px-4 py-2 rounded-md text-[10px] font-semibold uppercase shadow-md flex items-center gap-2">
                                                    <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                                    Ảnh chờ duyệt
                                                  </div>
                                                )}
                                                {alt &&
                                                  alt !== "Hình minh họa" && (
                                                    <p className="text-center mt-4 text-sm font-bold text-slate-400 italic">
                                                      * {alt} *
                                                    </p>
                                                  )}
                                              </div>
                                            );
                                          },
                                        }}
                                      >
                                        {isEditing
                                          ? output
                                          : insertApprovedIllustrationsForPlainExport(
                                              output,
                                              illustrations,
                                            )}
                                      </ReactMarkdown>
                                    )}
                                  </div>
                                </div>

                                {/* Versions Quick Access */}
                                {currentSessionId &&
                                  sessions.find(
                                    (s) => s.id === currentSessionId,
                                  )?.versions.length! > 1 && (
                                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
                                      <span className="text-[10px] font-semibold text-slate-400 tracking-normal mr-2">
                                        Lịch sử bài viết:
                                      </span>
                                      {sessions
                                        .find((s) => s.id === currentSessionId)
                                        ?.versions.map((v, i) => (
                                          <button
                                            key={`ver-${v.id || i}`}
                                            onClick={() => {
                                              setOutput(v.content);
                                              setIllustrations(
                                                v.illustrations || [],
                                              );
                                            }}
                                            className={cn(
                                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all border",
                                              output === v.content
                                                ? "bg-[#002D56] text-white border-[#002D56]"
                                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400",
                                            )}
                                          >
                                            <Clock className="w-3 h-3" />
                                            {new Date(
                                              v.timestamp,
                                            ).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                            {i === 0 && (
                                              <span className="ml-1 opacity-60">
                                                (Mới nhất)
                                              </span>
                                            )}
                                          </button>
                                        ))}
                                    </div>
                                  )}

                                <div className="px-8 py-6 bg-[#002D56] text-white/50 text-[10px] font-semibold text-center uppercase tracking-[0.3em]">
                                  Bản quyền nội dung thuộc về Tổng Công ty Bảo
                                  đảm an toàn hàng hải Việt Nam
                                </div>
                              </motion.section>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )
                  ) : activeTab === "history" ? (
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 sm:px-8 py-5 sm:py-6 rounded-md lg:rounded-lg border border-slate-200 shadow-sm gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="bg-[#002D56] p-2.5 sm:p-3 rounded-md lg:rounded-lg shadow-sm shrink-0">
                            <History className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-semibold text-slate-800 tracking-tight truncate">
                              Bài báo AI đã tạo
                            </h2>
                            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                              Lưu trữ các bài viết và phiên bản chỉnh sửa.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-3 flex-1 sm:justify-end">
                          <div className="relative w-full sm:max-w-xs">
                            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Tìm kiếm bài viết..."
                              value={historySearchQuery}
                              onChange={(e) =>
                                setHistorySearchQuery(e.target.value)
                              }
                              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-md text-xs font-semibold focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                            />
                          </div>
                          <button
                            onClick={createNewSession}
                            className="w-full sm:w-auto bg-[#002D56] text-white px-6 py-3 rounded-md font-semibold text-xs tracking-normal hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#002D56]/20 shrink-0"
                          >
                            <Plus className="w-4 h-4" /> Soạn bài mới
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {sessions.filter(
                          (s) =>
                            !historySearchQuery ||
                            s.title
                              ?.toLowerCase()
                              .includes(historySearchQuery.toLowerCase()) ||
                            s.versions[0]?.content
                              ?.toLowerCase()
                              .includes(historySearchQuery.toLowerCase()),
                        ).length === 0 ? (
                          <div className="col-span-full py-20 sm:py-32 flex flex-col items-center justify-center bg-white rounded-md lg:rounded-lg border border-dashed border-slate-200">
                            <Clock className="w-16 h-16 sm:w-20 sm:h-20 text-slate-200 mb-4 sm:mb-6" />
                            <p className="text-slate-400 font-semibold tracking-normal text-xs">
                              Không tìm thấy bài viết
                            </p>
                          </div>
                        ) : (
                          sessions
                            .filter(
                              (s) =>
                                !historySearchQuery ||
                                s.title
                                  ?.toLowerCase()
                                  .includes(historySearchQuery.toLowerCase()) ||
                                s.versions[0]?.content
                                  ?.toLowerCase()
                                  .includes(historySearchQuery.toLowerCase()),
                            )
                            .map((session) => (
                              <div
                                key={session.id}
                                className="bg-white rounded-md p-5 sm:p-6 shadow-sm border border-slate-200 hover:border-[#002D56] hover:shadow-md transition-all group flex flex-col h-full relative overflow-hidden"
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 text-[#002D56] text-[10px] font-medium rounded tracking-normal bg-slate-100",
                                        session.taskType === "WRITE_NEW"
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-teal-50 text-teal-700",
                                      )}
                                    >
                                      {session.taskType === "WRITE_NEW"
                                        ? "Viết mới"
                                        : "Rà soát"}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                                      <Clock className="w-3 h-3" />
                                      {new Date(
                                        session.updatedAt,
                                      ).toLocaleDateString("vi-VN")}
                                    </span>
                                  </div>
                                </div>

                                <h3 className="text-base font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-[#002D56] transition-colors mb-4 flex-1">
                                  {cleanDisplayTitle(session.title)}
                                </h3>

                                <div className="flex flex-wrap gap-2 mb-6">
                                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                    <History className="w-3.5 h-3.5" />{" "}
                                    {session.versions.length} phiên bản
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                    <Files className="w-3.5 h-3.5" />{" "}
                                    {session.documentIds.length} nguồn
                                  </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex items-center gap-2 mt-auto">
                                  <button
                                    onClick={() => loadSession(session)}
                                    className="flex-1 bg-white text-[#002D56] border border-[#002D56] py-2 rounded-md text-[12px] font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                                  >
                                    <Edit3 className="w-4 h-4" /> Tiếp tục
                                  </button>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const confirmed =
                                        await requestConfirmAsync(
                                          "Bạn có chắc chắn muốn xóa bài viết này cùng toàn bộ lịch sử?",
                                        );
                                      if (confirmed) {
                                        if (user) {
                                          try {
                                            await deleteDoc(
                                              doc(
                                                db,
                                                "users",
                                                user.uid,
                                                "sessions",
                                                session.id,
                                              ),
                                            );
                                            setSessions((prev) =>
                                              prev.filter(
                                                (s) => s.id !== session.id,
                                              ),
                                            );
                                            toast.success("Đã xóa bài viết.");

                                            await logActivity({
                                              module: "editorial",
                                              action: "deleted",
                                              entityType: "editorial_session",
                                              entityId: session.id,
                                              entityTitle: session.title,
                                              title: "Xóa bài viết",
                                              summary: `Đã xóa bài viết "${session.title}".`,
                                              metadata: { source: "client" },
                                            });
                                          } catch (err) {
                                            console.error(
                                              "Delete session error:",
                                              err,
                                            );
                                            toast.error(
                                              "Không thể xóa bài viết trên hệ thống.",
                                            );
                                          }
                                        } else {
                                          setSessions((prev) =>
                                            prev.filter(
                                              (s) => s.id !== session.id,
                                            ),
                                          );
                                        }
                                      }
                                    }}
                                    className="px-3 py-2.5 rounded-md text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100"
                                    title="Xóa bài viết"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  ) : activeTab === "activity" ? (
                    <ActivityLogView
                      onOpenEntity={(type, id) => {
                        if (
                          type === "document" ||
                          type === "drive_file" ||
                          type === "drive_folder"
                        ) {
                          const docMatch = documents.find(
                            (d) => d.id === id || d.driveFileId === id,
                          );
                          if (docMatch) {
                            setActiveTab("library");
                            setPreviewDocument(docMatch);
                          } else {
                            toast.error(
                              "Nội dung không còn tồn tại hoặc không tìm thấy.",
                            );
                          }
                        } else if (type === "task") {
                          const t = allTasks.find((t) => t.id === id);
                          if (t) {
                            setActiveTab("tasks");
                            setEditingTask(t);
                            setActiveModal("task-edit");
                          } else {
                            toast.error("Nhiệm vụ không còn tồn tại.");
                          }
                        } else if (type === "editorial_session") {
                          const s = sessions.find((s) => s.id === id);
                          if (s) {
                            loadSession(s);
                          } else {
                            toast.error(
                              "Bài viết/Phiên biên tập không còn tồn tại.",
                            );
                          }
                        }
                      }}
                    />
                  ) : activeTab === "settings" ? (
                    <UserProfileSection
                      user={user}
                      profile={profile}
                      onSave={handleSaveProfile}
                    />
                  ) : activeTab === "admin" ? (
                    <AdminWorkspace profile={profile} />
                  ) : (
                    /* Knowledge Base / Library Management - NEW MODULAR UI */
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                      {/* Left Sidebar: Collections - Horizontal on Mobile */}
                      <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8">
                        <div className="bg-white rounded-md lg:rounded-md p-4 lg:p-6 shadow-sm border border-slate-200">
                          <div className="flex items-center justify-between mb-4 lg:mb-6 px-1 shrink-0">
                            <h3 className="text-[11px] font-semibold text-slate-400 tracking-normal flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5" /> Kho lưu trữ
                            </h3>
                            <button
                              onClick={() => {
                                closeMobileDrawer();
                                setIsAddingLibrary(true);
                              }}
                              className="p-1.5 bg-slate-50 text-slate-400 hover:text-[#002D56] hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-hide -mx-2 px-2 lg:mx-0 lg:px-0">
                            {libraryCollections.map((coll) => (
                              <button
                                key={coll.id}
                                onClick={() => setActiveLibraryId(coll.id)}
                                className={cn(
                                  "flex shrink-0 items-center justify-between px-3.5 py-2.5 lg:py-3 rounded-md transition-all group border",
                                  activeLibraryId === coll.id
                                    ? "bg-[#002D56] text-white shadow-sm shadow-[#002D56]/20 border-[#002D56]"
                                    : "text-slate-600 hover:bg-slate-50 border-transparent hover:border-slate-100 bg-slate-50/50",
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={cn(
                                      "p-2 rounded-md transition-colors shrink-0",
                                      activeLibraryId === coll.id
                                        ? "bg-white/10"
                                        : "bg-slate-100 group-hover:bg-white shadow-sm",
                                    )}
                                  >
                                    {coll.type === "personal" && (
                                      <User className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    )}
                                    {coll.type === "work" && (
                                      <Briefcase className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    )}
                                    {coll.type === "editorial" && (
                                      <Edit3 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    )}
                                    {coll.type === "shared" && (
                                      <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    )}
                                    {coll.type === "drive" && (
                                      <Database className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    )}
                                    {coll.type === "custom" && (
                                      <BookOpen className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    )}
                                  </div>
                                  <span className="text-[11px] lg:text-xs font-semibold tracking-tight truncate max-w-[100px]">
                                    {coll.name}
                                  </span>
                                </div>
                                <div className="hidden lg:flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                                      activeLibraryId === coll.id
                                        ? "bg-white/20 text-white"
                                        : "bg-slate-100 text-slate-400",
                                    )}
                                  >
                                    {
                                      documents.filter(
                                        (d) =>
                                          d.collectionId === coll.id ||
                                          (!d.collectionId &&
                                            coll.id === "lib-personal"),
                                      ).length
                                    }
                                  </span>
                                  {coll.type === "custom" && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingCollection(coll);
                                        }}
                                        className="p-1 hover:bg-white/20 rounded-md transition-all"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const confirmed =
                                            await requestConfirmAsync(
                                              "Xóa kho này?",
                                            );
                                          if (confirmed)
                                            deleteLibraryCollection(coll.id);
                                        }}
                                        className="p-1 hover:bg-red-500 hover:text-white rounded-md transition-all"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </nav>
                        </div>

                        <div className="hidden lg:block bg-[#002D56] rounded-md p-6 text-white shadow-md">
                          <h4 className="text-[10px] font-semibold tracking-normal mb-4 opacity-60">
                            Thống kê lưu trữ
                          </h4>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold opacity-80">
                                Tổng tài liệu
                              </span>
                              <span className="text-sm font-semibold">
                                {documents.length}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold opacity-80">
                                Dung lượng ước tính
                              </span>
                              <span className="text-sm font-semibold">
                                ~
                                {(
                                  documents.reduce(
                                    (acc, d) => acc + (d.content?.length || 0),
                                    0,
                                  ) / 1024
                                ).toFixed(1)}{" "}
                                KB
                              </span>
                            </div>
                            <div className="h-px bg-white/10 w-full"></div>
                            <p className="text-[9px] font-medium leading-relaxed opacity-40  tracking-tight">
                              Hệ thống hỗ trợ lưu trữ phi cấu trúc & đồng bộ
                              Drive Public.
                            </p>
                          </div>
                        </div>
                      </aside>

                      {/* Main Content: Document List */}
                      <main className="flex-1 w-full space-y-6">
                        {/* Toolbar */}
                        <div className="bg-white rounded-md p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="relative w-full sm:max-w-md">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input
                                type="text"
                                placeholder="Tìm kiếm tài liệu trong kho..."
                                value={librarySearchQuery}
                                onChange={(e) =>
                                  setLibrarySearchQuery(e.target.value)
                                }
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-md text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-400"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                              {bulkSelectedDocIds.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteSelectedDocuments();
                                  }}
                                  className="flex-1 sm:flex-initial bg-red-50 text-red-600 border border-red-100 px-4 py-2.5 rounded-md text-[13px] font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                  <Trash2 className="w-4 h-4" /> Xóa (
                                  {bulkSelectedDocIds.length})
                                </button>
                              )}
                              {documents.some(
                                (d) =>
                                  (d.type as string) === "link" &&
                                  (d.metadata?.url?.includes(
                                    "drive.google.com",
                                  ) ||
                                    d.metadata?.url?.includes(
                                      "docs.google.com",
                                    )),
                              ) && (
                                <button
                                  onClick={repairLegacyDriveLinks}
                                  className="flex-1 sm:flex-initial bg-amber-50 text-amber-700 border border-amber-100 px-4 py-2.5 rounded-md text-[13px] font-bold hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                                  title="Chuyển đổi các link Drive cũ sang định dạng chuẩn"
                                >
                                  <Zap className="w-4 h-4" /> Sửa link cũ
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  closeMobileDrawer();
                                  setIsAddingText(true);
                                }}
                                className="flex-1 sm:flex-initial bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-md text-[13px] font-bold hover:bg-slate-50 hover:text-[#002D56] transition-all flex items-center justify-center gap-2"
                              >
                                <Type className="w-4 h-4" /> Ghi chú
                              </button>
                              <button
                                onClick={() => {
                                  closeMobileDrawer();
                                  setIsAddingLink(true);
                                }}
                                className="flex-1 sm:flex-initial bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-md text-[13px] font-bold hover:bg-slate-50 hover:text-[#002D56] transition-all flex items-center justify-center gap-2"
                              >
                                <LinkIcon className="w-4 h-4" /> Liên kết
                              </button>
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 sm:flex-initial bg-[#002D56] text-white px-5 py-2.5 rounded-md text-[13px] font-bold hover:bg-slate-900 transition-all shadow-sm shadow-[#002D56]/10 flex items-center justify-center gap-2"
                              >
                                <FileUp className="w-4 h-4" /> Tải tệp
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-500 tracking-normal uppercase">
                                Loại tài liệu
                              </span>
                              <select
                                value={libraryFilters.kind}
                                onChange={(e) =>
                                  setLibraryFilters((prev) => ({
                                    ...prev,
                                    kind: e.target.value,
                                  }))
                                }
                                className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                              >
                                <option value="all">Tất cả</option>
                                {Object.entries(DOCUMENT_KIND_LABELS).map(
                                  ([k, v]) => (
                                    <option key={k} value={k}>
                                      {v as React.ReactNode}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-500 tracking-normal uppercase">
                                Trạng thái xử lý
                              </span>
                              <select
                                value={libraryFilters.status}
                                onChange={(e) =>
                                  setLibraryFilters((prev) => ({
                                    ...prev,
                                    status: e.target.value,
                                  }))
                                }
                                className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                              >
                                <option value="all">Tất cả</option>
                                <option value="extracted">
                                  Đã trích xuất nội dung
                                </option>
                                <option value="metadata_only">
                                  Chỉ có Metadata
                                </option>
                                <option value="ocr_processing">
                                  Đang đợi OCR
                                </option>
                                <option value="too_large">Quá lớn</option>
                                <option value="error">Lỗi trích xuất</option>
                              </select>
                            </div>

                            <div className="ml-auto">
                              <button
                                onClick={async () => {
                                  const currentDocIds = documents
                                    .filter(
                                      (d) => d.collectionId === activeLibraryId,
                                    )
                                    .map((d) => d.id);
                                  if (currentDocIds.length === 0)
                                    return toast.error(
                                      "Không có document trong bộ sưu tập này.",
                                    );
                                  const token = await getChatAuthToken();
                                  toast.loading(
                                    "Đang khởi tạo Knowledge Index...",
                                  );
                                  let indexed = 0;
                                  for (const docId of currentDocIds) {
                                    try {
                                      await apiFetchJson(
                                        "/api/knowledge/index-document",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            Authorization: `Bearer ${token}`,
                                          },
                                          body: JSON.stringify({
                                            documentId: docId,
                                          }),
                                        },
                                      );
                                      indexed++;
                                    } catch (e) {}
                                  }
                                  toast.dismiss();
                                  toast.success(
                                    `Đã hoàn tất Index ${indexed}/${currentDocIds.length} tài liệu.`,
                                  );
                                }}
                                className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-md text-xs font-bold hover:bg-indigo-100 flex items-center gap-2 transition-all"
                                title="Khởi tạo AI Knowledge Index cho toàn bộ tài liệu trong bộ sưu tập hiện tại"
                              >
                                <Zap className="w-3.5 h-3.5" /> Tạo lại Index
                              </button>
                            </div>
                          </div>
                        </div>

                        {backgroundTasks.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {backgroundTasks.map((task) => (
                              <div
                                key={task.id}
                                className="bg-indigo-50 border border-indigo-100 rounded-md p-3 flex items-center justify-between shadow-sm"
                              >
                                <div className="flex items-center gap-3 overflow-hidden">
                                  {task.status === "processing" ? (
                                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" />
                                  ) : task.status === "success" ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                  ) : (
                                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                                  )}
                                  <div className="flex flex-col truncate">
                                    <span className="text-xs font-bold text-slate-700 truncate">
                                      {task.title || task.url}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-[10px] font-medium",
                                        task.status === "processing"
                                          ? "text-indigo-600"
                                          : task.status === "success"
                                            ? "text-emerald-600"
                                            : "text-rose-600",
                                      )}
                                    >
                                      {task.status === "processing"
                                        ? "Đang trích xuất dữ liệu..."
                                        : task.status === "success"
                                          ? "Trích xuất thành công"
                                          : `Lỗi: ${task.message}`}
                                    </span>
                                  </div>
                                </div>
                                {task.status === "error" && (
                                  <button
                                    onClick={() =>
                                      setBackgroundTasks((prev) =>
                                        prev.filter((t) => t.id !== task.id),
                                      )
                                    }
                                    className="p-1 hover:bg-indigo-100 rounded text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Document Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 sm:gap-5">
                          {filteredDocs.length === 0 ? (
                            <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white rounded-md border border-dashed border-slate-200 text-center">
                              <div className="w-20 h-20 bg-slate-50 rounded-lg flex items-center justify-center mb-6">
                                <Database className="w-10 h-10 text-slate-200" />
                              </div>
                              <h4 className="text-sm font-semibold text-slate-500 tracking-normal mb-2">
                                Kho tư liệu đang trống
                              </h4>
                              <p className="text-[11px] text-slate-400 font-medium px-10 leading-relaxed uppercase">
                                Bắt đầu bằng việc tải lên tài liệu, dán liên kết
                                Google Drive <br /> hoặc tìm kiếm dữ liệu trực
                                tuyến.
                              </p>
                            </div>
                          ) : (
                            filteredDocs.map((doc) => (
                              <motion.div
                                layout
                                key={doc.id}
                                className="bg-white rounded-md border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-[#002D56]/20 transition-all group relative overflow-hidden flex flex-col justify-between"
                              >
                                <div>
                                  {/* Status/Type Badge */}
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={cn(
                                          "px-2.5 py-1 rounded-lg text-[10px] font-bold border shadow-sm",
                                          doc.type === "pdf"
                                            ? "bg-rose-50 border-rose-100 text-rose-600"
                                            : doc.type === "word"
                                              ? "bg-blue-50 border-blue-100 text-blue-600"
                                              : doc.type === "excel"
                                                ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                                                : doc.type === "drive"
                                                  ? "bg-[#002D56] border-[#002D56] text-white"
                                                  : "bg-slate-50 border-slate-100 text-slate-500",
                                        )}
                                      >
                                        {doc.driveMimeType?.includes("folder")
                                          ? "Thư mục"
                                          : getDocTypeLabel(doc.type)}
                                      </div>
                                      {doc.documentKind && (
                                        <div className="px-2 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg text-[10px] font-bold capitalize">
                                          {doc.documentKind
                                            .replace(/_/g, " ")
                                            .toLowerCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 relative z-10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setBulkSelectedDocIds((prev) =>
                                            prev.includes(doc.id)
                                              ? prev.filter(
                                                  (id) => id !== doc.id,
                                                )
                                              : [...prev, doc.id],
                                          );
                                        }}
                                        className={cn(
                                          "p-2 rounded-md transition-all shadow-sm border",
                                          bulkSelectedDocIds.includes(doc.id)
                                            ? "bg-blue-500 text-white border-blue-400"
                                            : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50",
                                        )}
                                        title={
                                          bulkSelectedDocIds.includes(doc.id)
                                            ? "Đã chọn lưới"
                                            : "Chọn nhiều"
                                        }
                                      >
                                        <CheckSquare className="w-3.5 h-3.5" />
                                      </button>

                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDocumentMenuDocId(
                                              documentMenuDocId === doc.id
                                                ? null
                                                : doc.id,
                                            );
                                          }}
                                          className="p-2 bg-white border border-slate-100 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-all shadow-sm"
                                          title="Thao tác"
                                        >
                                          <MoreHorizontal className="w-3.5 h-3.5" />
                                        </button>

                                        {documentMenuDocId === doc.id && (
                                          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-md shadow-md border border-slate-100 py-1.5 z-[200]">
                                            {!doc.summary && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDocumentMenuDocId(null);
                                                  handleAnalyzeDocument(doc.id);
                                                }}
                                                disabled={!!isAnalyzing}
                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2"
                                              >
                                                <Sparkles className="w-3.5 h-3.5" />{" "}
                                                Phân tích AI
                                              </button>
                                            )}
                                            {doc.type === "drive" && (
                                              <a
                                                href={getDocumentOpenUrl(doc)}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDocumentMenuDocId(null);
                                                }}
                                                className="flex w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 items-center gap-2"
                                              >
                                                <ExternalLink className="w-3.5 h-3.5" />{" "}
                                                Mở Drive
                                              </a>
                                            )}
                                            {doc.type === "drive" &&
                                              doc.driveMimeType?.includes(
                                                "folder",
                                              ) && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDocumentMenuDocId(null);
                                                    handleSyncDriveFolder(
                                                      doc.driveFileId || "",
                                                      doc.name,
                                                    );
                                                  }}
                                                  disabled={
                                                    isSyncingDrive ===
                                                    doc.driveFileId
                                                  }
                                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-amber-600 flex items-center gap-2"
                                                >
                                                  <RefreshCw className="w-3.5 h-3.5" />{" "}
                                                  Đồng bộ thư mục
                                                </button>
                                              )}
                                            {!doc.summary &&
                                              doc.type === "drive" && (
                                                <div className="h-px bg-slate-100 my-1"></div>
                                              )}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDocumentMenuDocId(null);
                                                setEditingDocument(doc);
                                                setDocEditForm({
                                                  name: doc.name,
                                                  description:
                                                    doc.metadata?.description ||
                                                    "",
                                                  collectionId:
                                                    doc.collectionId ||
                                                    "lib-personal",
                                                  documentKind:
                                                    doc.documentKind || "",
                                                  taskCategoryCode:
                                                    doc.taskCategoryCode || "",
                                                });
                                                setIsEditingDocModalOpen(true);
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#002D56] flex items-center gap-2"
                                            >
                                              <Edit3 className="w-3.5 h-3.5" />{" "}
                                              Chỉnh sửa
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDocumentMenuDocId(null);
                                                archiveDocument(doc.id);
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-amber-600 flex items-center gap-2"
                                            >
                                              <Archive className="w-3.5 h-3.5" />{" "}
                                              Lưu trữ
                                            </button>
                                            <div className="h-px bg-slate-100 my-1"></div>
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                setDocumentMenuDocId(null);
                                                if (
                                                  await requestConfirmAsync(
                                                    "Xóa tài liệu này khỏi hệ thống?",
                                                  )
                                                ) {
                                                  removeDocument(doc.id);
                                                }
                                              }}
                                              className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />{" "}
                                              Xóa tài liệu
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Content Info */}
                                  <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                      <div className="p-3 bg-slate-50 rounded-md group-hover:bg-blue-50 transition-colors shrink-0">
                                        {doc.driveIconUrl ? (
                                          <img
                                            src={doc.driveIconUrl}
                                            alt="icon"
                                            className="w-5 h-5 opacity-70"
                                            referrerPolicy="no-referrer"
                                          />
                                        ) : (
                                          <>
                                            {doc.type === "pdf" && (
                                              <FileText className="w-5 h-5 text-rose-500" />
                                            )}
                                            {doc.type === "word" && (
                                              <FileText className="w-5 h-5 text-blue-500" />
                                            )}
                                            {doc.type === "excel" && (
                                              <FileText className="w-5 h-5 text-emerald-500" />
                                            )}
                                            {doc.type === "drive" ? (
                                              <Database className="w-5 h-5 text-[#002D56]" />
                                            ) : doc.type === "link" ? (
                                              <LinkIcon className="w-5 h-5 text-indigo-500" />
                                            ) : (
                                              <FileText className="w-5 h-5 text-slate-400" />
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="text-[13px] font-semibold text-slate-800 leading-tight line-clamp-3 decoration-[#002D56]/10 underline-offset-2 decoration-2 group-hover:underline mt-0.5">
                                          {doc.name}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5 min-h-[16px]">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate">
                                            {formatLibraryDate(
                                              doc.metadata?.modifiedTime ||
                                                doc.updatedAt ||
                                                doc.createdAt,
                                            )}
                                          </p>
                                          <span className="text-[10px] font-bold text-slate-300">
                                            •
                                          </span>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                            {getDocTypeLabel(doc.type)}
                                          </p>
                                          {doc.documentKind && (
                                            <>
                                              <span className="text-[10px] font-bold text-slate-300">
                                                •
                                              </span>
                                              <span className="px-1.5 py-0.5 bg-blue-50 text-[#002D56] text-[8px] font-bold rounded tracking-tight uppercase border border-blue-100">
                                                {DOCUMENT_KIND_LABELS[
                                                  doc.documentKind
                                                ] || doc.documentKind}
                                              </span>
                                            </>
                                          )}
                                          {doc.taskCategoryCode && (
                                            <>
                                              <span className="text-[10px] font-bold text-slate-300">
                                                •
                                              </span>
                                              <span className="text-[9px] font-bold text-slate-500 italic">
                                                {
                                                  TASK_CATEGORIES.find(
                                                    (c) =>
                                                      c.code ===
                                                      doc.taskCategoryCode,
                                                  )?.name
                                                }
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {((doc.summary &&
                                      (typeof doc.summary === "string"
                                        ? doc.summary
                                        : doc.summary.short)) ||
                                      doc.metadata?.description) && (
                                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed line-clamp-3 border-l-2 border-slate-100 pl-3 italic">
                                        {typeof doc.summary === "string"
                                          ? doc.summary
                                          : doc.summary?.short ||
                                            doc.metadata?.description}
                                      </p>
                                    )}

                                    {doc.type === "drive" && (
                                      <div className="space-y-3 pt-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="px-2 py-0.5 bg-[#002D56]/5 text-[#002D56] rounded-md text-[10px] font-bold border border-[#002D56]/10">
                                            Nguồn Drive
                                          </div>
                                          <div
                                            className={cn(
                                              "px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1",
                                              doc.contentStatus ===
                                                "extracted" ||
                                                doc.contentStatus ===
                                                  "summary_only"
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                : doc.contentStatus ===
                                                    "too_large"
                                                  ? "bg-orange-50 text-orange-700 border-orange-100"
                                                  : doc.contentStatus ===
                                                      "error"
                                                    ? "bg-red-50 text-red-700 border-red-100"
                                                    : "bg-amber-50 text-amber-700 border-amber-100",
                                            )}
                                          >
                                            {doc.contentStatus ===
                                              "extracted" ||
                                            doc.contentStatus ===
                                              "summary_only" ? (
                                              <Check className="w-3 h-3" />
                                            ) : doc.contentStatus ===
                                              "too_large" ? (
                                              <HardDrive className="w-3 h-3" />
                                            ) : doc.contentStatus ===
                                              "error" ? (
                                              <AlertTriangle className="w-3 h-3" />
                                            ) : (
                                              <EyeOff className="w-3 h-3" />
                                            )}
                                            {doc.contentStatus ===
                                              "extracted" ||
                                            doc.contentStatus === "summary_only"
                                              ? "AI Đọc được"
                                              : doc.contentStatus ===
                                                  "too_large"
                                                ? "Tệp quá lớn"
                                                : doc.contentStatus === "error"
                                                  ? "Lỗi phân tích"
                                                  : doc.sourceType ===
                                                      "google_drive_folder"
                                                    ? "Thư mục"
                                                    : "Chỉ tiêu đề"}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Footer / Meta */}
                                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        closeMobileDrawer();
                                        setIsPickingTaskForDoc(doc);
                                      }}
                                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md hover:bg-emerald-100 transition-all flex items-center gap-1.5 group/btn"
                                    >
                                      <Plus className="w-3.5 h-3.5 group-hover/btn:rotate-90 transition-transform" />
                                      <span className="text-[11px] font-bold">
                                        Dùng làm nguồn
                                      </span>
                                    </button>
                                    {doc.summary && (
                                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 italic px-2">
                                        <ShieldCheck className="w-3.5 h-3.5" />{" "}
                                        Đã phân tích
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => openDocumentPreview(doc)}
                                    className="text-[11px] font-bold text-[#002D56] hover:underline flex items-center gap-1.5 group/link bg-slate-50 px-3 py-1.5 rounded-md hover:bg-slate-100"
                                  >
                                    Xem{" "}
                                    <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                                  </button>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </main>
                    </div>
                  )}
                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="mt-8 border-t border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="text-center md:text-left">
                <h2 className="text-sm font-semibold tracking-normal text-[#002D56]">
                  Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Hệ thống hỗ trợ nghiệp vụ và biên tập nội dung
                </p>
              </div>

              <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500 md:justify-end">
                <button
                  disabled
                  className="hover:text-[#002D56] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                >
                  Sơ đồ luồng
                </button>
                <button
                  disabled
                  className="hover:text-[#002D56] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                >
                  Quy định biên tập
                </button>
                <button
                  disabled
                  className="hover:text-[#002D56] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                >
                  Liên hệ kỹ thuật
                </button>
                <button className="text-emerald-700 hover:text-emerald-800">
                  Bộ Xây dựng 2025
                </button>
              </nav>
            </div>

            <div className="mx-auto mt-5 max-w-7xl border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400 md:text-left">
              © {new Date().getFullYear()} Tổng công ty Bảo đảm an toàn hàng hải
              Việt Nam. Bản quyền được bảo lưu.
            </div>
          </footer>
        </main>

        {/* Modals Container */}
        <AnimatePresence>
          {activeModal === "auth" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-md lg:rounded-lg shadow-sm w-full max-w-md overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 sm:p-6 pb-4">
                  <div className="flex justify-between items-start mb-6 sm:mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-[#002D56] rounded-md">
                        <Ship className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-[#002D56] tracking-tight">
                          {authMode === "login"
                            ? "Đăng nhập tài khoản"
                            : "Đăng ký nghiệp vụ"}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 tracking-normal mt-1">
                          Phục vụ Nghiệp vụ Hoa tiêu
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-slate-100 rounded-md"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <form className="space-y-4" onSubmit={handleAuth}>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 tracking-normal ml-1">
                        Email nội bộ
                      </label>
                      <input
                        name="email"
                        type="email"
                        placeholder="ten.nguoidung@vms.com.vn"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#002D56] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 tracking-normal ml-1">
                        Mật khẩu
                      </label>
                      <input
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#002D56] transition-all"
                      />
                    </div>

                    {authMode === "login" && (
                      <div className="flex items-center justify-between text-[11px] font-bold px-1 pt-1">
                        <button
                          type="button"
                          className="text-[#002D56] hover:underline"
                        >
                          Quên mật khẩu?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-[#002D56] text-white py-4 rounded-md font-semibold text-sm shadow-md hover:bg-slate-900 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                    >
                      {isLoading && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {authMode === "login"
                        ? "TRUY CẬP HỆ THỐNG"
                        : "TẠO TÀI KHOẢN MỚI"}
                    </button>

                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-[10px] uppercase font-semibold tracking-wide">
                        <span className="bg-white px-4 text-slate-400">
                          Hoặc tiếp tục với
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={isLoading}
                      className="w-full bg-white border border-slate-200 text-slate-700 py-3.5 rounded-md font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#EA4335"
                          d="M12 5.04c1.94 0 3.68.67 5.05 1.97l3.77-3.77C18.54 1.24 15.48 0 12 0 7.31 0 3.25 2.69 1.2 6.65l4.39 3.4C6.63 7.15 9.08 5.04 12 5.04z"
                        />
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.8-.07-1.56-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.8 2.94c2.23-2.06 3.62-5.09 3.62-8.76z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.59 14.5c-.24-.72-.38-1.5-.38-2.31s.14-1.59.38-2.31l-4.39-3.4C.45 8.2 0 10.05 0 12c0 1.95.45 3.8 1.2 5.51l4.39-3.41z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.8-2.94c-1.08.73-2.47 1.16-4.13 1.16-3.19 0-5.89-2.15-6.85-5.07l-4.4 3.41C3.25 21.31 7.31 24 12 24z"
                        />
                      </svg>
                      TIẾP TỤC VỚI GOOGLE
                    </button>

                    {authMode === "login" && (
                      <p className="mt-4 text-[10px] text-center text-slate-400 font-medium leading-relaxed">
                        Lưu ý: Nếu đăng nhập Email bị lỗi, vui lòng sử dụng tài
                        khoản Google để trải nghiệm hệ thống ổn định nhất.
                      </p>
                    )}
                  </form>
                </div>

                <div className="p-6 pt-0 mt-4 border-t border-slate-100">
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400 font-bold tracking-normal mb-4">
                      {authMode === "login"
                        ? "Chưa có tài khoản nghiệp vụ?"
                        : "Đã có tài khoản?"}
                    </p>
                    <button
                      onClick={() =>
                        setAuthMode(authMode === "login" ? "register" : "login")
                      }
                      className="w-full bg-emerald-50 text-emerald-600 py-3 rounded-md font-semibold text-[10px] tracking-normal hover:bg-emerald-100 transition-all"
                    >
                      {authMode === "login"
                        ? "Đăng ký ngay (Không cần xác nhận)"
                        : "Quay lại đăng nhập"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeModal === "account" && user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex justify-end"
              onClick={() => setActiveModal(null)}
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-sm h-full shadow-2xl p-6 sm:p-6 overflow-y-auto overscroll-contain"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-white z-20 -mt-6 -mx-6 p-6 pb-4 mb-4 border-b border-slate-100 flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#002D56] rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                        {user.email}
                      </h2>
                      <p className="text-[10px] font-bold text-emerald-600 tracking-normal mt-1">
                        Trạng thái: Đang hoạt động
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModal(null)}
                    className="p-2 hover:bg-slate-100 rounded-md"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-md border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-normal mb-1">
                      Cơ quan / Đơn vị
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      Công ty TNHH MTV Hoa tiêu hàng hải miền Bắc
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-md border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-normal mb-1">
                      Chức vụ / Vị trí
                    </p>
                    <p className="text-sm font-bold text-slate-700">
                      Biên tập viên Nghiệp vụ
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full mt-8 bg-red-50 text-red-600 py-4 rounded-md font-semibold text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> ĐĂNG XUẤT KHỎI HỆ THỐNG
                </button>
              </motion.div>
            </motion.div>
          )}

          {activeModal === "settings" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex justify-end"
              onClick={() => setActiveModal(null)}
            >
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-sm h-full shadow-2xl p-6 md:p-6 overflow-y-auto overscroll-contain"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-white z-20 -mt-6 -mx-6 p-6 pb-4 mb-4 border-b border-slate-100 flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-md">
                      <Settings className="w-6 h-6 text-[#002D56]" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
                        Cài đặt hệ thống
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModal(null)}
                    className="p-2 hover:bg-slate-100 rounded-md"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        Chế độ tối (Dark Mode)
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Đang phát triển...
                      </p>
                    </div>
                    <div className="w-12 h-6 bg-slate-200 rounded-full"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        Tự động sao lưu
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Bật mặc định
                      </p>
                    </div>
                    <div className="w-12 h-6 bg-emerald-500 rounded-full flex items-center justify-end px-1">
                      <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-[#002D56]/5 rounded-md border border-[#002D56]/10">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-semibold text-[#002D56] tracking-normal">
                      API AI Cá nhân
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${personalAIStatus.hasKey ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
                      />
                      <span className="text-[9px] font-semibold text-slate-400 uppercase">
                        {personalAIStatus.hasKey
                          ? "Đã kích hoạt"
                          : "Dùng key hệ thống"}
                      </span>
                    </div>
                  </div>

                  {personalAIStatus.hasKey && !showAiKeyForm ? (
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-[11px] font-bold text-slate-700">
                              {personalAIStatus.provider?.toUpperCase()} -{" "}
                              {personalAIStatus.model}
                            </p>
                            <code className="text-[10px] font-mono text-slate-400">
                              ••••••••{personalAIStatus.keyLast4}
                            </code>
                          </div>
                          <button
                            onClick={deletePersonalKey}
                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                            title="Xóa key cá nhân"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {personalAIStatus.lastTestedAt && (
                          <p className="text-[8px] font-medium text-slate-300 uppercase">
                            Kiểm tra lần cuối:{" "}
                            {new Date(
                              personalAIStatus.lastTestedAt,
                            ).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowAiKeyForm(true)}
                        className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[10px] font-semibold tracking-normal transition-all"
                      >
                        Cập nhật API Key
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {showAiKeyForm ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[8px] font-semibold text-slate-400 tracking-normal ml-1">
                              Nhà cung cấp
                            </label>
                            <select
                              value={aiKeyForm.provider}
                              onChange={(e) =>
                                resetTestResultIfFormChanged({
                                  ...aiKeyForm,
                                  provider: e.target.value,
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[10px] font-bold text-slate-700 focus:outline-none"
                            >
                              <option value="gemini">Google Gemini</option>
                              <option value="openai" disabled>
                                OpenAI (Sắp có)
                              </option>
                              <option value="anthropic" disabled>
                                Anthropic (Sắp có)
                              </option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-semibold text-slate-400 tracking-normal ml-1">
                              API Key
                            </label>
                            <input
                              type="password"
                              placeholder="Dán API key tại đây..."
                              value={aiKeyForm.apiKey}
                              onChange={(e) =>
                                resetTestResultIfFormChanged({
                                  ...aiKeyForm,
                                  apiKey: e.target.value,
                                })
                              }
                              className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[10px] font-mono text-slate-700 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-semibold text-slate-400 tracking-normal ml-1">
                              Model mặc định
                            </label>
                            <div className="space-y-2">
                              <select
                                value={aiKeyForm.modelPreset}
                                onChange={(e) =>
                                  resetTestResultIfFormChanged({
                                    ...aiKeyForm,
                                    modelPreset: e.target.value,
                                  })
                                }
                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[10px] font-bold text-slate-700 focus:outline-none"
                              >
                                <option value="gemini-2.5-flash">
                                  gemini-2.5-flash (Chuẩn - Nhanh & Ổn định)
                                </option>
                                <option value="gemini-2.5-flash-lite">
                                  gemini-2.5-flash-lite (Tiết kiệm)
                                </option>
                                <option value="gemini-2.5-pro">
                                  gemini-2.5-pro (Thông minh cao nhất)
                                </option>
                                <option value="gemma-4-26b-a4b-it">
                                  gemma-4-26b-a4b-it (Thử nghiệm)
                                </option>
                                <option value="gemma-4-31b-it">
                                  gemma-4-31b-it (Thử nghiệm)
                                </option>
                                <option value="custom">
                                  -- Tùy chỉnh (Cảnh báo: Có thể không ổn định)
                                  --
                                </option>
                              </select>
                              {aiKeyForm.modelPreset === "custom" && (
                                <input
                                  type="text"
                                  placeholder="Nhập chính xác Model ID (VD: gemini-2.0-flash-exp)..."
                                  value={aiKeyForm.customModel}
                                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-[10px] font-bold text-slate-700 focus:outline-none"
                                  onChange={(e) =>
                                    resetTestResultIfFormChanged({
                                      ...aiKeyForm,
                                      customModel: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </div>
                          </div>

                          {keyTestResult && !keyTestResult.success && (
                            <div className="p-3 bg-red-50 rounded-md border border-red-100 mb-2">
                              <p className="text-[9px] font-bold text-red-600 uppercase mb-1">
                                Lỗi:{" "}
                                {keyTestResult.errorType === "invalid_key"
                                  ? "API Key không hợp lệ"
                                  : keyTestResult.errorType ===
                                      "model_not_found"
                                    ? "Model không được hỗ trợ"
                                    : keyTestResult.errorType ===
                                        "quota_exceeded"
                                      ? "Hết hạn mức (Quota)"
                                      : keyTestResult.errorType ===
                                          "permission_denied"
                                        ? "Không có quyền truy cập"
                                        : "Lỗi không xác định"}
                              </p>
                              <p className="text-[10px] text-red-500 leading-tight">
                                {keyTestResult.message}
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={testPersonalKey}
                              disabled={isTestingKey || !aiKeyForm.apiKey}
                              className={`flex-1 py-2.5 rounded-md text-[10px] font-semibold tracking-normal transition-all ${isTestingKey ? "bg-slate-100 text-slate-400" : "bg-slate-800 text-white hover:bg-black"}`}
                            >
                              {isTestingKey ? "Đang test..." : "Kiểm tra"}
                            </button>
                            {keyTestResult?.success && (
                              <button
                                onClick={savePersonalKey}
                                disabled={isSavingKey}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-[10px] font-semibold tracking-normal transition-all"
                              >
                                {isSavingKey ? "Đang lưu..." : "Lưu Key"}
                              </button>
                            )}
                          </div>
                          <button
                            onClick={() => setShowAiKeyForm(false)}
                            className="w-full text-[9px] font-bold text-slate-400 uppercase hover:text-slate-600 transition-all pt-1"
                          >
                            Hủy bỏ
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2">
                          <p className="text-[10px] text-slate-400 font-medium mb-4 italic">
                            Đang sử dụng cấu hình AI chung của hệ thống Hoa Tiêu
                            Miền Bắc.
                          </p>
                          <button
                            onClick={() => setShowAiKeyForm(true)}
                            className="w-full py-2.5 px-4 bg-[#002D56] hover:bg-[#003d74] text-white rounded-md text-[10px] font-semibold tracking-normal shadow-sm shadow-[#002D56]/20 transition-all"
                          >
                            Thêm API Key Cá nhân
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) =>
            handleFileUpload(e, activeTab === "editor" ? "PROJECT" : "GENERAL")
          }
          multiple
          className="hidden"
          accept=".pdf,.docx,.xlsx,.xls,.txt,.csv"
        />

        <AnimatePresence>
          {selectingParagraphForImage && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectingParagraphForImage(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-md shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-md">
                      <ImageIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 tracking-tight">
                        Chọn vị trí chèn ảnh
                      </h3>
                      <p className="text-xs text-slate-400 font-bold tracking-wide">
                        Tệp: {selectingParagraphForImage.file.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectingParagraphForImage(null)}
                    className="p-2 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto overscroll-contain space-y-4 custom-scrollbar">
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Nhấp vào đoạn văn bạn muốn chèn hình ảnh này vào sau đó. Vị
                    trí được chọn sẽ được AI ghi nhớ để xuất bản Word/PDF.
                  </p>
                  {output
                    .split("\n")
                    .filter((p) => p.trim())
                    .map((para, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleManualUpload(
                            selectingParagraphForImage.file,
                            idx,
                          );
                          setSelectingParagraphForImage(null);
                        }}
                        className="w-full text-left p-6 rounded-lg border border-slate-200 hover:border-[#002D56] hover:bg-slate-50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-400 px-2 py-1 rounded-lg group-hover:bg-[#002D56] group-hover:text-white transition-all">
                            ĐOẠN {idx + 1}
                          </span>
                          <div className="h-0.5 flex-1 bg-slate-50 group-hover:bg-[#002D56]/10" />
                        </div>
                        <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-relaxed">
                          {para}
                        </p>
                      </button>
                    ))}
                </div>
              </motion.div>
            </div>
          )}

          {activeModal === "task-edit" && editingTask && (
            <React.Suspense fallback={null}>
              <TaskEditModal
                editingTask={editingTask}
                setEditingTask={setEditingTask}
                onClose={() => setActiveModal(null)}
                onDelete={handleDeleteTask}
                onSave={(task) => {
                  if (!task.title) return toast.error("Vui lòng nhập tiêu đề");
                  if (task.id) {
                    handleUpdateTask(task.id, task);
                  } else {
                    const { id, ...rest } = task;
                    persistTask(rest);
                    setActiveModal(null);
                  }
                }}
                documents={documents}
                setIsPickingFromLibrary={setIsPickingFromLibraryForTask}
              />
            </React.Suspense>
          )}

          {/* Library Add Text Modal */}
          {isAddingText && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white w-full max-w-lg rounded-md shadow-sm p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-50 rounded-md">
                    <Type className="w-6 h-6 text-[#002D56]" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 tracking-tight">
                    Thêm ghi chú văn bản
                  </h3>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Tiêu đề ghi chú..."
                    value={newTextName}
                    onChange={(e) => setNewTextName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                  />
                  <textarea
                    rows={6}
                    placeholder="Dán nội dung văn bản tại đây..."
                    value={newTextContent}
                    onChange={(e) => setNewTextContent(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10 resize-none"
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setIsAddingText(false)}
                    className="flex-1 py-4 text-xs font-semibold uppercase text-slate-400 hover:bg-slate-50 rounded-md"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      if (!newTextName || !newTextContent)
                        return toast.error("Vui lòng điền đủ thông tin");
                      await persistDocument({
                        name: newTextName,
                        content: newTextContent,
                        type: "text",
                        category: "GENERAL",
                        collectionId: activeLibraryId,
                      });
                      setIsAddingText(false);
                      setNewTextName("");
                      setNewTextContent("");
                      toast.success("Đã lưu ghi chú");
                    }}
                    className="flex-1 bg-[#002D56] text-white py-4 rounded-md text-xs font-semibold tracking-normal shadow-md"
                  >
                    Lưu vào kho
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Library Add Link Modal */}
          {isAddingLink && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white w-full max-w-lg rounded-md shadow-sm p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-indigo-50 rounded-md">
                    <LinkIcon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-800 tracking-tight">
                    Thêm liên kết / Drive
                  </h3>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase px-1">
                    Dán liên kết trang web hoặc link chia sẻ Google Drive
                  </p>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setIsAddingLink(false)}
                    disabled={isParsing}
                    className="flex-1 py-4 text-xs font-semibold uppercase text-slate-400 hover:bg-slate-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAddLink}
                    disabled={isParsing}
                    className="flex-1 bg-indigo-600 text-white py-4 rounded-md text-xs font-semibold tracking-normal shadow-md disabled:bg-indigo-400 flex items-center justify-center gap-2"
                  >
                    {isParsing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {isParsing ? "Đang xử lý..." : "Xác nhận thêm"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Create Collection Modal */}
          {isAddingLibrary && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white w-full max-w-sm rounded-md shadow-sm p-6"
              >
                <h3 className="text-xl font-semibold text-slate-800 tracking-tight mb-6">
                  Tạo kho lưu trữ mới
                </h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Tên kho tư liệu..."
                    value={newLibName}
                    onChange={(e) => setNewLibName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                  />
                  <select
                    value={newLibType}
                    onChange={(e) => setNewLibType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-4 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="custom">Tùy chỉnh</option>
                    <option value="work">Công việc</option>
                    <option value="editorial">Biên tập</option>
                    <option value="personal">Cá nhân</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setIsAddingLibrary(false)}
                    className="flex-1 py-4 text-xs font-semibold uppercase text-slate-400 hover:bg-slate-50 rounded-md"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      if (!newLibName) return toast.error("Vui lòng nhập tên");
                      const newId = await createLibraryCollection({
                        name: newLibName,
                        type: newLibType,
                      });
                      if (newId) setActiveLibraryId(newId);
                      setIsAddingLibrary(false);
                      setNewLibName("");
                      toast.success("Đã tạo kho mới");
                    }}
                    className="flex-1 bg-[#002D56] text-white py-4 rounded-md text-xs font-semibold tracking-normal shadow-md"
                  >
                    Xác nhận
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {/* Pick from Library Modal */}
          {isPickingFromLibrary && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[120] flex justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                onClick={() => {
                  setIsPickingFromLibrary(false);
                  setSearchQuery("");
                }}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-hidden relative z-10"
              >
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#002D56] rounded-md shadow-sm shadow-[#002D56]/20">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-800 tracking-tight">
                        Chọn nguồn từ Kho tư liệu
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold tracking-normal">
                        Hoa Tiêu Miền Bắc - Knowledge Connector
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsPickingFromLibrary(false);
                      setSearchQuery("");
                    }}
                    className="p-2 hover:bg-slate-200 rounded-md transition-all"
                  >
                    <X className="w-6 h-6 text-slate-300" />
                  </button>
                </div>

                <div className="px-8 py-4 bg-white border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm tài liệu..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-normal bg-slate-50 px-3 py-2 rounded-md">
                    {pickingMode === "ai"
                      ? "CHẾ ĐỘ CHỌN NGUỒN AI"
                      : "CHẾ ĐỘ GẮN CÔNG VIỆC"}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
                  {/* Collection Tabs */}
                  <aside className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r border-slate-100 bg-slate-50/30 p-2 sm:p-4 space-y-1 overflow-x-auto sm:overflow-y-auto overscroll-contain shrink-0 flex sm:flex-col gap-2 sm:gap-0 h-auto sm:h-full">
                    <p className="text-[10px] font-semibold text-slate-400 tracking-normal hidden sm:block mb-4 ml-2">
                      Bộ sưu tập
                    </p>
                    {libraryCollections.map((coll) => (
                      <button
                        key={coll.id}
                        onClick={() => setActiveLibraryId(coll.id)}
                        className={cn(
                          "w-full sm:w-auto shrink-0 flex items-center gap-3 px-4 py-2 sm:py-3 rounded-md transition-all text-left whitespace-nowrap",
                          activeLibraryId === coll.id
                            ? "bg-[#002D56] text-white shadow-md shadow-[#002D56]/10"
                            : "text-slate-600 hover:bg-white hover:shadow-sm",
                        )}
                      >
                        <Layers
                          className={cn(
                            "w-4 h-4",
                            activeLibraryId === coll.id
                              ? "text-blue-300"
                              : "text-slate-300",
                          )}
                        />
                        <span className="text-xs font-bold truncate tracking-tight">
                          {coll.name}
                        </span>
                      </button>
                    ))}
                  </aside>

                  {/* Document List */}
                  <main className="flex-1 p-6 overflow-y-auto overscroll-contain space-y-4 custom-scrollbar bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {documents
                        .filter(
                          (d) =>
                            d.collectionId === activeLibraryId ||
                            (!d.collectionId &&
                              activeLibraryId === "lib-personal"),
                        )
                        .filter((d) => matchesSearch(d, searchQuery))
                        .map((doc) => {
                          const isSelected =
                            pickingMode === "ai"
                              ? selectedSourceDocIds.includes(doc.id)
                              : (editingTask?.linkedDocumentIds || []).includes(
                                  doc.id,
                                );

                          return (
                            <button
                              key={doc.id}
                              onClick={() => {
                                if (pickingMode === "ai") {
                                  toggleDocSelection(doc.id);
                                } else if (editingTask) {
                                  const current =
                                    editingTask.linkedDocumentIds || [];
                                  const next = current.includes(doc.id)
                                    ? current.filter((id) => id !== doc.id)
                                    : [...current, doc.id];
                                  setEditingTask({
                                    ...editingTask,
                                    linkedDocumentIds: next,
                                  });
                                }
                              }}
                              className={cn(
                                "p-4 rounded-lg border-2 transition-all text-left group flex flex-col gap-3",
                                isSelected
                                  ? "border-[#002D56] bg-blue-50/30 ring-1 ring-[#002D56]"
                                  : "border-slate-100 bg-white hover:border-slate-200 shadow-sm",
                              )}
                            >
                              <div className="flex items-start justify-between w-full">
                                <div className="p-2 bg-slate-50 group-hover:bg-white rounded-md transition-colors">
                                  <FileText
                                    className={cn(
                                      "w-4 h-4",
                                      isSelected
                                        ? "text-[#002D56]"
                                        : "text-slate-400",
                                    )}
                                  />
                                </div>
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                    isSelected
                                      ? "bg-[#002D56] border-[#002D56]"
                                      : "border-slate-200",
                                  )}
                                >
                                  {isSelected && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-slate-800 tracking-tight line-clamp-2 leading-tight">
                                  {doc.name}
                                </h4>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-1 tracking-tight">
                                  {getDocTypeLabel(doc.type)} •{" "}
                                  {formatLibraryDate(
                                    doc.metadata?.modifiedTime || doc.updatedAt,
                                  )}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                    {documents.filter(
                      (d) =>
                        (d.collectionId === activeLibraryId ||
                          (!d.collectionId &&
                            activeLibraryId === "lib-personal")) &&
                        matchesSearch(d, searchQuery),
                    ).length === 0 && (
                      <div className="py-20 text-center flex flex-col items-center">
                        <Database className="w-12 h-12 text-slate-100 mb-4" />
                        <p className="text-xs font-semibold text-slate-300 tracking-normal">
                          Không tìm thấy tài liệu phù hợp
                        </p>
                      </div>
                    )}
                  </main>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                  <p className="text-[10px] font-semibold text-slate-400 tracking-normal">
                    {pickingMode === "ai"
                      ? `ĐANG CHỌN ${selectedSourceDocIds.length} NGUỒN TÀI LIỆU`
                      : `ĐÃ GẮN ${editingTask?.linkedDocumentIds?.length || 0} TÀI LIỆU VÀO CÔNG VIỆC`}
                  </p>
                  <button
                    onClick={() => {
                      setIsPickingFromLibrary(false);
                      setSearchQuery("");
                    }}
                    className="bg-[#002D56] text-white px-10 py-3 rounded-md text-[10px] font-semibold tracking-normal shadow-md hover:bg-slate-900 transition-all active:scale-[0.98]"
                  >
                    Xác nhận
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {/* Edit Collection Modal */}
          {editingCollection && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white w-full max-w-sm rounded-md shadow-sm p-6"
              >
                <h3 className="text-xl font-semibold text-slate-800 tracking-tight mb-6">
                  Chỉnh sửa kho lưu trữ
                </h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Tên kho tư liệu..."
                    value={newLibName || editingCollection.name}
                    onChange={(e) => setNewLibName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                  />
                  <select
                    value={newLibType || editingCollection.type}
                    onChange={(e) => setNewLibType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-4 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="custom">Tùy chỉnh</option>
                    <option value="work">Công việc</option>
                    <option value="editorial">Biên tập</option>
                    <option value="personal">Cá nhân</option>
                  </select>
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => {
                      setEditingCollection(null);
                      setNewLibName("");
                    }}
                    className="flex-1 py-4 text-xs font-semibold uppercase text-slate-400 hover:bg-slate-50 rounded-md"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      const name = newLibName || editingCollection.name;
                      const type = newLibType || editingCollection.type;
                      await updateLibraryCollection(editingCollection.id, {
                        name,
                        type,
                      });
                      setEditingCollection(null);
                      setNewLibName("");
                      toast.success("Đã cập nhật kho");
                    }}
                    className="flex-1 bg-[#002D56] text-white py-4 rounded-md text-xs font-semibold tracking-normal shadow-md"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
          {/* Task Picker Modal for Documents */}
          {isPickingTaskForDoc && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white w-full max-w-4xl h-[80vh] rounded-md shadow-sm flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-600 p-3 rounded-md">
                      <LayoutDashboard className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-emerald-700 tracking-tight">
                        Gắn tài liệu vào công việc
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 tracking-normal mt-0.5">
                        Tài liệu: {isPickingTaskForDoc.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPickingTaskForDoc(null)}
                    className="p-3 hover:bg-white rounded-md shadow-sm border border-slate-100 transition-all"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="p-6 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm công việc..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-md text-xs font-bold focus:outline-none focus:ring-4 focus:ring-emerald-50 transition-all"
                      onChange={(e) =>
                        setTaskFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-6 custom-scrollbar bg-slate-50/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allTasks
                      .filter(
                        (t) =>
                          !taskFilters.search ||
                          t.title
                            .toLowerCase()
                            .includes(taskFilters.search.toLowerCase()),
                      )
                      .map((task) => (
                        <button
                          key={task.id}
                          disabled={task.linkedDocumentIds?.includes(
                            isPickingTaskForDoc.id,
                          )}
                          onClick={async () => {
                            const currentIds = task.linkedDocumentIds || [];
                            if (!currentIds.includes(isPickingTaskForDoc.id)) {
                              await handleUpdateTask(task.id, {
                                ...task,
                                linkedDocumentIds: [
                                  ...currentIds,
                                  isPickingTaskForDoc.id,
                                ],
                              });
                            }
                            setIsPickingTaskForDoc(null);
                            toast.success("Đã gắn tài liệu");
                          }}
                          className={cn(
                            "flex items-center gap-4 p-5 rounded-md border-2 transition-all group text-left",
                            task.linkedDocumentIds?.includes(
                              isPickingTaskForDoc.id,
                            )
                              ? "bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed"
                              : "bg-white border-slate-100 hover:border-emerald-500 hover:shadow-md active:scale-[0.98]",
                          )}
                        >
                          <div
                            className={cn(
                              "p-3 rounded-md shrink-0 group-hover:scale-110 transition-transform",
                              task.status === "done"
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-blue-100 text-blue-600",
                            )}
                          >
                            {task.status === "done" ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 tracking-tight line-clamp-1 group-hover:text-emerald-700">
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[8px] font-semibold uppercase text-slate-400 tracking-wide">
                                HẠN:{" "}
                                {task.dueDate
                                  ? new Date(task.dueDate).toLocaleDateString(
                                      "vi-VN",
                                    )
                                  : "---"}
                              </span>
                              <div
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[8px] font-semibold uppercase",
                                  task.priority === "urgent"
                                    ? "bg-red-50 text-red-600"
                                    : "bg-slate-100 text-slate-500",
                                )}
                              >
                                {task.priority}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Document Detail Drawer */}
        <AnimatePresence>
          {previewDocument && (
            <div className="fixed inset-0 z-[250] flex justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setPreviewDocument(null)}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-2xl bg-white h-full shadow-sm flex flex-col overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={cn(
                        "p-3 rounded-md shadow-sm shrink-0",
                        previewDocument.type === "drive"
                          ? "bg-[#002D56] text-white"
                          : "bg-blue-600 text-white",
                      )}
                    >
                      {previewDocument.driveIconUrl ? (
                        <img
                          src={previewDocument.driveIconUrl}
                          alt="icon"
                          className="w-5 h-5 brightness-0 invert"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Database className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-800 tracking-tight truncate leading-tight">
                        {previewDocument.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 tracking-normal">
                          {getDocTypeLabel(previewDocument.type)} •{" "}
                          {formatLibraryDate(
                            previewDocument.metadata?.modifiedTime ||
                              previewDocument.updatedAt,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewDocument(null)}
                    className="p-2.5 hover:bg-white rounded-md shadow-sm border border-slate-100 transition-all shrink-0 ml-4"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Tabs Navigation */}
                <div className="px-5 sm:px-8 bg-white border-b border-slate-100 flex items-center gap-6 shrink-0 overflow-x-auto scrollbar-hide">
                  {["overview", "preview", "ai", "manual", "metadata"].map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setDocumentDetailTab(tab as any)}
                        className={cn(
                          "py-4 text-[10px] font-semibold tracking-normal relative transition-all whitespace-nowrap",
                          documentDetailTab === tab
                            ? "text-[#002D56]"
                            : "text-slate-400 hover:text-slate-600",
                        )}
                      >
                        {tab === "overview" && "Tổng quan"}
                        {tab === "preview" && "Xem trước"}
                        {tab === "ai" && "AI tóm tắt"}
                        {tab === "manual" && "Nhập tay"}
                        {tab === "metadata" && "Metadata"}
                        {documentDetailTab === tab && (
                          <motion.div
                            layoutId="activeTabUnderline"
                            className="absolute bottom-0 left-0 right-0 h-1 bg-[#002D56] rounded-t-full"
                          />
                        )}
                      </button>
                    ),
                  )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-6 custom-scrollbar">
                  {documentDetailTab === "overview" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Summary Card */}
                      <div className="bg-slate-50 rounded-md p-6 border border-slate-100">
                        <h4 className="text-[11px] font-semibold text-[#002D56] tracking-normal mb-4 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5" /> Tóm tắt nội dung
                        </h4>
                        {previewDocument.summary ? (
                          <p className="text-sm text-slate-600 font-medium leading-relaxed">
                            {typeof previewDocument.summary === "string"
                              ? previewDocument.summary
                              : previewDocument.summary.short}
                          </p>
                        ) : (
                          <div className="py-4 text-center">
                            <p className="text-xs text-slate-500 font-semibold uppercase mb-4">
                              Chưa có bản tóm tắt AI
                            </p>
                            <button
                              onClick={() =>
                                handleAnalyzeDocument(previewDocument.id)
                              }
                              disabled={!!isAnalyzing}
                              className="bg-blue-600 text-white px-6 py-2.5 rounded-md text-[10px] font-semibold tracking-normal hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                            >
                              {isAnalyzing === previewDocument.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              Phân tích ngay
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-4 h-4 text-orange-500" />
                            <span className="text-[9px] font-semibold text-slate-400 tracking-normal">
                              Ngày cập nhật
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 uppercase">
                            {formatLibraryDate(
                              previewDocument.metadata?.modifiedTime ||
                                previewDocument.updatedAt,
                            )}
                          </p>
                        </div>
                        <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <HardDrive className="w-4 h-4 text-indigo-500" />
                            <span className="text-[9px] font-semibold text-slate-400 tracking-normal">
                              Dung lượng
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-700 uppercase">
                            {previewDocument.driveSize
                              ? (
                                  parseInt(previewDocument.driveSize) /
                                  1024 /
                                  1024
                                ).toFixed(2) + " MB"
                              : (previewDocument.content?.length || 0) / 1000 +
                                " KB"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 flex flex-wrap gap-3">
                        <a
                          href={
                            previewDocument.driveWebViewLink ||
                            (previewDocument.type === "link"
                              ? previewDocument.metadata?.url
                              : undefined)
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="bg-slate-900 text-white px-6 py-3 rounded-md text-[10px] font-semibold tracking-normal flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
                        >
                          Mở nguồn gốc <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            closeMobileDrawer();
                            setIsPickingTaskForDoc(previewDocument);
                            setPreviewDocument(null);
                          }}
                          className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-6 py-3 rounded-md text-[10px] font-semibold tracking-normal hover:bg-emerald-100 transition-all flex items-center gap-2"
                        >
                          Gắn vào công việc <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {documentDetailTab === "preview" && (
                    <div className="h-full min-h-[500px] flex flex-col bg-slate-100 rounded-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-500">
                      {/* OCR Banner */}
                      {isPotentialScannedDocument(previewDocument) && (
                        <div className="bg-amber-50 border-b border-amber-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 z-10">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                previewDocument.contentStatus === "ocr_failed"
                                  ? "bg-rose-100 text-rose-600"
                                  : "bg-amber-100 text-amber-600",
                              )}
                            >
                              {previewDocument.contentStatus ===
                              "ocr_processing" ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Sparkles className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <h5 className="text-[11px] font-bold text-slate-800 tracking-tight">
                                {previewDocument.contentStatus ===
                                "ocr_processing"
                                  ? "Đang trích xuất văn bản bằng AI..."
                                  : previewDocument.contentStatus ===
                                      "ocr_failed"
                                    ? "Trích xuất OCR thất bại"
                                    : "Phát hiện tài liệu quét/ảnh"}
                              </h5>
                              <p className="text-[10px] font-medium text-slate-500 leading-tight">
                                {previewDocument.contentStatus ===
                                "ocr_processing"
                                  ? "Quá trình trích xuất OCR có thể mất 15-30 giây tùy độ dài tệp."
                                  : previewDocument.contentStatus ===
                                      "ocr_failed"
                                    ? 'Hãy thử "Nhập tay" hoặc kiểm tra lại file gốc. Tệp có thể quá mờ hoặc quá phức tạp.'
                                    : "Tài liệu này không có văn bản chọn được. Bạn có muốn dùng AI để quét và trích xuất nội dung?"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() =>
                                handleExtractScan(previewDocument.id)
                              }
                              disabled={!!isExtractingScan}
                              className="flex-1 sm:flex-none px-4 py-2 bg-[#002D56] text-white rounded-md text-[10px] font-bold tracking-normal hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isExtractingScan ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                              Quét AI (OCR)
                            </button>
                            <button
                              onClick={() => setDocumentDetailTab("manual")}
                              className="flex-1 sm:flex-none px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-md text-[10px] font-bold tracking-normal hover:bg-slate-50 transition-all"
                            >
                              Nhập tay
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex-1 overflow-hidden">
                        {previewDocument.driveMimeType ===
                        "application/vnd.google-apps.folder" ? (
                          <div className="h-full p-4">
                            <React.Suspense
                              fallback={
                                <div className="h-full flex items-center justify-center p-6">
                                  <span className="animate-spin text-slate-400">
                                    <Loader2 />
                                  </span>
                                </div>
                              }
                            >
                              <DriveFolderBrowser
                                folderId={
                                  previewDocument.driveFileId ||
                                  previewDocument.metadata?.driveId ||
                                  ""
                                }
                                folderName={previewDocument.name}
                                onSyncFolder={handleSyncDriveFolder}
                                onImportFile={async (item) => {
                                  const token = await user?.getIdToken();
                                  setIsParsing(true);
                                  try {
                                    const resp = await fetch(
                                      "/api/drive/import-public-link",
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                          Authorization: `Bearer ${token}`,
                                        },
                                        body: JSON.stringify({
                                          url: `https://drive.google.com/open?id=${item.id}`,
                                          collectionId:
                                            previewDocument.collectionId ||
                                            "lib-personal",
                                        }),
                                      },
                                    );
                                    const respData = await resp.json();
                                    if (resp.ok && respData.document) {
                                      setDocuments((prev) => [
                                        respData.document,
                                        ...prev,
                                      ]);
                                      toast.success(
                                        "Đã import tài liệu từ thư mục!",
                                      );
                                    } else {
                                      toast.error(
                                        `Không thể import tài liệu: ${respData.message || "Lỗi không xác định"}`,
                                      );
                                    }
                                  } catch (e: any) {
                                    toast.error(`Lỗi import: ${e.message}`);
                                  } finally {
                                    setIsParsing(false);
                                  }
                                }}
                              />
                            </React.Suspense>
                          </div>
                        ) : previewDocument.contentStatus ===
                          "ocr_processing" ? (
                          <div className="h-full flex flex-col items-center justify-center bg-white p-6 text-center">
                            <div className="w-20 h-20 bg-blue-50 rounded-lg flex items-center justify-center mb-6 animate-pulse">
                              <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800 uppercase mb-2">
                              Đang xử lý OCR
                            </h4>
                            <p className="text-sm text-slate-500">
                              AI đang đọc nội dung từ hình ảnh/file quét. Vui
                              lòng đợi trong giây lát...
                            </p>
                          </div>
                        ) : getDocumentPreviewUrl(previewDocument) ? (
                          <iframe
                            src={getDocumentPreviewUrl(previewDocument)}
                            className="w-full h-full border-none"
                            title={previewDocument.name}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="p-6 h-full bg-white flex flex-col">
                            <div className="flex flex-col gap-3 mb-6 p-4 bg-slate-50 rounded-md border border-slate-100">
                              <div className="flex items-center gap-3">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <p className="text-[10px] font-bold text-slate-500 tracking-tight italic">
                                  Không có liên kết xem trước. Hệ thống hiển thị
                                  nội dung thô đã được AI trích xuất.
                                </p>
                              </div>
                              {previewDocument.contentStatus === "error" &&
                                previewDocument.type === "drive" && (
                                  <div className="mt-2 text-[10px] font-medium text-slate-600 bg-white p-3 rounded border border-slate-200">
                                    <p className="mb-2">
                                      Đây có thể là file dạng PDF scan hoặc ảnh,
                                      việc đọc tự động đã thất bại.
                                    </p>
                                    <button
                                      onClick={() =>
                                        handleExtractScan(previewDocument.id)
                                      }
                                      disabled={!!isExtractingScan}
                                      className="bg-[#002D56] text-white px-4 py-2 rounded font-semibold tracking-normal hover:bg-blue-900 transition-all flex items-center gap-2 w-fit"
                                    >
                                      {isExtractingScan ===
                                      previewDocument.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-4 h-4" />
                                      )}
                                      Quét Ảnh bằng AI (OCR)
                                    </button>
                                  </div>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto overscroll-contain font-mono text-[11px] leading-relaxed text-slate-600 bg-slate-50/50 p-6 rounded-lg border border-slate-50">
                              <pre className="whitespace-pre-wrap">
                                {previewDocument.content ||
                                  previewDocument.summary?.full ||
                                  previewDocument.summary?.short ||
                                  "Nội dung trống"}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {documentDetailTab === "ai" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                      {previewDocument.summary &&
                      typeof previewDocument.summary === "object" ? (
                        <>
                          <div className="flex flex-wrap items-center gap-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Phân loại tài liệu
                              </span>
                              <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 bg-[#002D56] text-white text-[9px] font-bold uppercase rounded tracking-wide flex items-center gap-1.5 shadow-sm">
                                  <FileCheck className="w-3 h-3" />{" "}
                                  {DOCUMENT_KIND_LABELS[
                                    previewDocument.documentKind || ""
                                  ] ||
                                    previewDocument.documentKind ||
                                    "Tài liệu"}
                                </span>
                                {previewDocument.taskCategoryCode && (
                                  <span className="px-3 py-1 bg-white text-[#002D56] border border-[#002D56]/20 text-[9px] font-bold uppercase rounded tracking-wide shadow-sm">
                                    {TASK_CATEGORIES.find(
                                      (c) =>
                                        c.code ===
                                        previewDocument.taskCategoryCode,
                                    )?.name || previewDocument.taskCategoryCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="p-6 bg-slate-50/50 rounded-md border border-slate-100 mb-6">
                            <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal mb-4">
                              Tóm tắt nội dung
                            </h5>
                            <div className="prose prose-slate prose-sm text-slate-600 max-w-none font-medium leading-relaxed mb-4 text-justify">
                              <span className="font-bold text-[#002D56]">
                                {previewDocument.summary.short}
                              </span>
                            </div>
                            <div className="prose prose-slate prose-sm text-slate-700 max-w-none leading-relaxed text-justify [&>p]:mb-4 [&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5">
                              {previewDocument.summary.full &&
                                previewDocument.summary.full !==
                                  previewDocument.summary.short && (
                                  <ReactMarkdown>
                                    {previewDocument.summary.full}
                                  </ReactMarkdown>
                                )}
                            </div>
                            {(previewDocument.summary?.sourceLimitNote ||
                              previewDocument.sourceLimitNote) && (
                              <p className="mt-4 text-[10px] italic text-amber-600 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-100 mt-4">
                                ⚠️{" "}
                                {previewDocument.summary?.sourceLimitNote ||
                                  previewDocument.sourceLimitNote}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {(
                              previewDocument.summary.mainPoints ||
                              previewDocument.summary.keyPoints
                            )?.map((point: string, idx: number) => (
                              <div
                                key={idx}
                                className="flex gap-4 p-4 bg-white rounded-md border border-slate-100 shadow-sm hover:border-blue-100 transition-colors group"
                              >
                                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-[10px] font-semibold shrink-0 group-hover:bg-[#002D56] group-hover:text-white transition-colors">
                                  {idx + 1}
                                </div>
                                <p className="text-xs font-medium text-slate-700 leading-relaxed">
                                  {point}
                                </p>
                              </div>
                            ))}
                          </div>

                          {previewDocument.summary.actionItems &&
                            previewDocument.summary.actionItems.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal ml-2">
                                  Yêu cầu thực hiện / Hành động
                                </h5>
                                <div className="grid grid-cols-1 gap-3">
                                  {previewDocument.summary.actionItems.map(
                                    (item: string, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex gap-3 p-3 bg-emerald-50 rounded-md border border-emerald-100 items-start"
                                      >
                                        <CheckSquare className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                        <p className="text-xs font-medium text-emerald-900 leading-relaxed">
                                          {item}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {previewDocument.summary.risks &&
                            previewDocument.summary.risks.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal ml-2">
                                  Rủi ro / Cảnh báo
                                </h5>
                                <div className="grid grid-cols-1 gap-3">
                                  {previewDocument.summary.risks.map(
                                    (item: string, idx: number) => (
                                      <div
                                        key={idx}
                                        className="flex gap-3 p-3 bg-rose-50 rounded-md border border-rose-100 items-start"
                                      >
                                        <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                        <p className="text-xs font-medium text-rose-900 leading-relaxed">
                                          {item}
                                        </p>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {previewDocument.summary.keywords &&
                            previewDocument.summary.keywords.length > 0 && (
                              <div className="space-y-3">
                                <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal ml-2">
                                  Từ khóa
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {previewDocument.summary.keywords.map(
                                    (kw: string, kidx: number) => (
                                      <span
                                        key={kidx}
                                        className="px-3 py-1.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100 tracking-tight"
                                      >
                                        #{kw}
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                          {previewDocument.summary.entities && (
                            <div className="space-y-4">
                              <h5 className="text-[10px] font-semibold text-slate-400 tracking-normal ml-2">
                                Thực thể chính
                              </h5>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {Object.entries(
                                  previewDocument.summary.entities,
                                ).map(([key, vals]) => {
                                  if (!Array.isArray(vals) || vals.length === 0)
                                    return null;
                                  const labels: Record<string, string> = {
                                    people: "Nhân vật",
                                    organizations: "Tổ chức",
                                    locations: "Địa danh",
                                    vessels: "Tàu thuyền",
                                    dates: "Thời gian",
                                  };
                                  return (
                                    <div
                                      key={key}
                                      className="p-4 bg-slate-50 rounded-md border border-slate-100"
                                    >
                                      <p className="text-[9px] font-semibold text-slate-400 tracking-normal mb-2">
                                        {labels[key] || key}
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {vals.map((v, vidx) => (
                                          <span
                                            key={vidx}
                                            className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-100"
                                          >
                                            {v}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="p-6 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-semibold text-[#002D56] tracking-tight">
                                Cần cập nhật phân tích?
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 tracking-normal mt-0.5">
                                AI sẽ đọc lại & lập chỉ mục mới
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                handleAnalyzeDocument(previewDocument.id)
                              }
                              disabled={!!isAnalyzing}
                              className="p-2.5 bg-white text-[#002D56] border border-slate-100 rounded-md hover:bg-blue-50 transition-all shadow-sm"
                            >
                              <RefreshCw
                                className={cn(
                                  "w-4 h-4",
                                  isAnalyzing === previewDocument.id &&
                                    "animate-spin",
                                )}
                              />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="py-20 text-center flex flex-col items-center">
                          <div
                            className={cn(
                              "w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-6",
                              isPotentialScannedDocument(previewDocument)
                                ? "bg-amber-50"
                                : "bg-slate-50",
                            )}
                          >
                            {isPotentialScannedDocument(previewDocument) ? (
                              <AlertCircle className="w-8 h-8 text-amber-500" />
                            ) : (
                              <Sparkles className="w-8 h-8 text-slate-200" />
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-800 tracking-normal mb-2">
                            Chưa có kết quả AI
                          </h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-8 max-w-xs mx-auto leading-relaxed">
                            {isPotentialScannedDocument(previewDocument)
                              ? "Tài liệu này dạng quét/ảnh, cần trích xuất OCR trước khi phân tích."
                              : "AI cần đọc nội dung tài liệu trước khi tóm tắt."}
                          </p>
                          <div className="flex flex-col gap-3 w-full max-w-[240px]">
                            {isPotentialScannedDocument(previewDocument) ? (
                              <button
                                onClick={() =>
                                  handleExtractScan(previewDocument.id)
                                }
                                disabled={!!isExtractingScan}
                                className="w-full bg-[#002D56] text-white px-8 py-3 rounded-md text-[10px] font-semibold tracking-normal hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 shadow-sm"
                              >
                                {isExtractingScan === previewDocument.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4 text-emerald-400" />
                                )}
                                Quét Ảnh bằng AI (OCR)
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleAnalyzeDocument(previewDocument.id)
                                }
                                disabled={!!isAnalyzing}
                                className="w-full bg-blue-600 text-white px-8 py-3 rounded-md text-[10px] font-semibold tracking-normal hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm"
                              >
                                {isAnalyzing === previewDocument.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                Yêu cầu AI phân tích
                              </button>
                            )}
                            <button
                              onClick={() => setDocumentDetailTab("manual")}
                              className="w-full bg-white text-slate-600 border border-slate-200 px-8 py-3 rounded-md text-[10px] font-semibold tracking-normal hover:bg-slate-50 transition-all"
                            >
                              Nhập tay tóm tắt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {documentDetailTab === "manual" && (
                    <ManualSummaryTab
                      docObj={previewDocument}
                      onSave={handleSaveManualSummary}
                    />
                  )}

                  {documentDetailTab === "metadata" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      <div className="bg-slate-900 rounded-md p-6 text-slate-300 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
                          <FileType className="w-64 h-64 rotate-12" />
                        </div>
                        <h5 className="text-[10px] font-semibold text-white/40 tracking-normal mb-6 flex items-center gap-2">
                          <Code className="w-3.5 h-3.5" /> Metadata thô từ nguồn
                        </h5>
                        <pre className="text-[10px] font-mono leading-relaxed overflow-x-auto custom-scrollbar">
                          {JSON.stringify(
                            {
                              id: previewDocument.id,
                              type: previewDocument.type,
                              sourceType: previewDocument.sourceType,
                              mimeType: previewDocument.driveMimeType,
                              fileId: previewDocument.driveFileId,
                              createdAt: previewDocument.createdAt,
                              updatedAt: previewDocument.updatedAt,
                              metadata: previewDocument.metadata,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Footer for Drawer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedSourceDocIds((prev) =>
                          prev.includes(previewDocument.id)
                            ? prev
                            : [...prev, previewDocument.id],
                        );
                        setPreviewDocument(null);
                        toast.success("Đã chọn làm nguồn AI");
                      }}
                      className="px-6 py-2.5 bg-emerald-500 text-white rounded-md text-[10px] font-semibold tracking-normal shadow-sm"
                    >
                      Dùng làm nguồn AI
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          await requestConfirmAsync(
                            "Xóa tài liệu này khỏi kho lưu trữ?",
                          )
                        ) {
                          removeDocument(previewDocument.id);
                        }
                      }}
                      className="px-6 py-2.5 bg-red-50 text-red-500 border border-red-100 rounded-md text-[10px] font-semibold tracking-normal hover:bg-red-500 hover:text-white transition-all shadow-sm"
                    >
                      Xóa tài liệu
                    </button>
                  </div>
                  <button
                    onClick={() => setPreviewDocument(null)}
                    className="px-6 py-2.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-semibold tracking-normal"
                  >
                    Đóng
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isPickingFromLibrary && pickingMode === "task" && editingTask && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white w-full max-w-4xl h-[80vh] rounded-md shadow-sm flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#002D56] p-3 rounded-md">
                      <Database className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[#002D56] tracking-tight">
                        Chọn tài liệu gắn vào công việc
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 tracking-normal mt-0.5">
                        Đang chọn cho: {editingTask.title}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsPickingFromLibrary(false)}
                    className="p-3 hover:bg-white rounded-md shadow-sm border border-slate-100 transition-all"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="p-6 border-b border-slate-100 bg-white">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm tài liệu..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-md text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                      onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-6 custom-scrollbar bg-slate-50/30">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents
                      .filter((d) => matchesSearch(d, librarySearchQuery))
                      .map((doc) => (
                        <button
                          key={doc.id}
                          disabled={editingTask.linkedDocumentIds?.includes(
                            doc.id,
                          )}
                          onClick={() => {
                            const currentIds =
                              editingTask.linkedDocumentIds || [];
                            if (!currentIds.includes(doc.id)) {
                              setEditingTask({
                                ...editingTask,
                                linkedDocumentIds: [...currentIds, doc.id],
                              });
                            }
                            setIsPickingFromLibrary(false);
                            toast.success("Đã gắn tài liệu");
                          }}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-md border-2 transition-all group text-left",
                            editingTask.linkedDocumentIds?.includes(doc.id)
                              ? "bg-slate-50 border-slate-100 opacity-60 grayscale cursor-not-allowed"
                              : "bg-white border-slate-100 hover:border-[#002D56] hover:shadow-md active:scale-[0.98]",
                          )}
                        >
                          <div className="p-3 bg-slate-50 rounded-md group-hover:bg-blue-50 transition-colors shrink-0">
                            {doc.driveIconUrl ? (
                              <img
                                src={doc.driveIconUrl}
                                alt="icon"
                                className="w-5 h-5 opacity-70"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <FileText className="w-5 h-5 text-slate-400 group-hover:text-[#002D56]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 tracking-tight truncate group-hover:text-[#002D56]">
                              {doc.name}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400 tracking-normal mt-0.5">
                              {getDocTypeLabel(doc.type)} •{" "}
                              {formatLibraryDate(doc.createdAt)}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isEditingDocModalOpen && editingDocument && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setIsEditingDocModalOpen(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-lg bg-white rounded-md shadow-sm overflow-hidden"
              >
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-800 tracking-normal">
                    Sửa thông tin tài liệu
                  </h3>
                  <button
                    onClick={() => setIsEditingDocModalOpen(false)}
                    className="p-2 hover:bg-slate-200 rounded-md transition-all"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto overscroll-contain max-h-[60vh] custom-scrollbar">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 tracking-wide mb-2">
                      Tên tài liệu
                    </label>
                    <input
                      type="text"
                      value={docEditForm.name}
                      onChange={(e) =>
                        setDocEditForm({ ...docEditForm, name: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 tracking-wide mb-2">
                      Kho lưu trữ
                    </label>
                    <select
                      value={docEditForm.collectionId || "lib-personal"}
                      onChange={(e) =>
                        setDocEditForm({
                          ...docEditForm,
                          collectionId: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none"
                    >
                      {DEFAULT_LIBRARY_COLLECTIONS.map((coll) => (
                        <option key={coll.id} value={coll.id}>
                          {coll.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 tracking-wide mb-2">
                        Loại tài liệu
                      </label>
                      <select
                        value={docEditForm.documentKind || ""}
                        onChange={(e) =>
                          setDocEditForm({
                            ...docEditForm,
                            documentKind: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none"
                      >
                        <option value="">(Không xác định)</option>
                        {Object.entries(DOCUMENT_KIND_LABELS).map(
                          ([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-slate-400 tracking-wide mb-2">
                        Nghiệp vụ
                      </label>
                      <select
                        value={docEditForm.taskCategoryCode || ""}
                        onChange={(e) =>
                          setDocEditForm({
                            ...docEditForm,
                            taskCategoryCode: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none"
                      >
                        <option value="">(Không xác định)</option>
                        {TASK_CATEGORIES.map((cat) => (
                          <option key={cat.code} value={cat.code}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 tracking-wide mb-2">
                      Ghi chú / Trích yếu
                    </label>
                    <textarea
                      rows={4}
                      value={docEditForm.description}
                      onChange={(e) =>
                        setDocEditForm({
                          ...docEditForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold text-slate-800 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none resize-none"
                    ></textarea>
                  </div>
                </div>
                <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setIsEditingDocModalOpen(false)}
                    className="px-6 py-3 rounded-md text-[10px] font-semibold tracking-normal text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={saveDocumentEdit}
                    className="px-6 py-3 bg-[#002D56] text-white rounded-md text-[10px] font-semibold tracking-normal hover:bg-slate-900 transition-all shadow-md shadow-[#002D56]/20"
                  >
                    Lưu Thay Đổi
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {documentExplorerFolder && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={() => setDocumentExplorerFolder(null)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-4xl max-h-[80vh] flex flex-col bg-white rounded-md shadow-sm overflow-hidden"
              >
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-md">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                        {documentExplorerFolder.name}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 tracking-normal mt-0.5">
                        Duyệt File Google Drive
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDocumentExplorerFolder(null)}
                    className="p-2.5 hover:bg-slate-200 rounded-md transition-all"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain p-6 bg-slate-50/50 custom-scrollbar">
                  {isExplorerLoading ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-4" />
                      <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                        Đang tải nội dung thư mục...
                      </p>
                    </div>
                  ) : explorerFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 tracking-wide">
                        Thư mục trống
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {explorerFiles.map((file) => {
                        const isFolder =
                          file.mimeType ===
                          "application/vnd.google-apps.folder";
                        return (
                          <div
                            key={file.id}
                            className="flex flex-col p-4 bg-white border border-slate-100 rounded-md hover:border-blue-200 hover:shadow-sm transition-all group"
                          >
                            <div
                              className="flex items-start gap-3 cursor-pointer mb-3"
                              onClick={(e) => {
                                if (isFolder) {
                                  e.preventDefault();
                                  openDocumentExplorer(file.id, file.name);
                                } else {
                                  window.open(file.webViewLink, "_blank");
                                }
                              }}
                            >
                              <div className="shrink-0 p-2 bg-slate-50 rounded-md group-hover:bg-blue-50 transition-colors">
                                {file.iconLink ? (
                                  <img
                                    src={file.iconLink}
                                    alt="icon"
                                    className="w-5 h-5"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : isFolder ? (
                                  <FolderOpen className="w-5 h-5 text-slate-400" />
                                ) : (
                                  <FileText className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                                  {file.name}
                                </p>
                                {file.size && (
                                  <p className="text-[9px] font-semibold text-slate-400 mt-1">
                                    {(
                                      parseInt(file.size) /
                                      1024 /
                                      1024
                                    ).toFixed(2)}{" "}
                                    MB
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-slate-50">
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 text-center py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[9px] font-semibold tracking-normal transition-colors"
                              >
                                Mở
                              </a>
                              {isFolder ? (
                                <button
                                  onClick={() =>
                                    handleSyncDriveFolder(file.id, file.name)
                                  }
                                  disabled={isSyncingDrive === file.id}
                                  className="flex-[2] py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[9px] font-semibold tracking-normal transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                >
                                  {isSyncingDrive === file.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Đồng bộ
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleImportDriveLink(file.webViewLink)
                                  }
                                  className="flex-[2] py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[9px] font-semibold tracking-normal transition-colors flex items-center justify-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  Nhập
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Chatbox - Only show if auth ready and user logged in */}
        {authReady &&
          user &&
          !activeModal &&
          !isPickingFromLibrary &&
          !previewDocument &&
          !isPickingTaskForDoc &&
          !isSidebarOpen && (
            <React.Suspense fallback={null}>
              <FloatingChatbox
                isOpen={isChatOpen}
                onToggle={() => setIsChatOpen(!isChatOpen)}
                messages={chatMessages}
                input={chatInput}
                onInputChange={setChatInput}
                onSend={(atts) => handleSendChat(undefined, atts)}
                onClear={() => setChatMessages([])}
                onExecuteAction={handleExecuteAction}
                onCreateTasks={createTasksFromChatDrafts}
                onToggleTaskDraft={toggleChatTaskDraft}
                activeTab={activeTab}
                loading={isChatLoading}
                disabled={
                  !backendReady || !authReady || !user || !isAiCoreActive
                }
                isAiReady={isAiCoreActive}
                disabledReason={
                  !backendReady
                    ? "Máy chủ đang khởi động hoặc chưa sẵn sàng."
                    : !isAiCoreActive
                      ? "AI chưa được cấu hình. Hãy thêm GEMINI_API_KEY hoặc nhập API key cá nhân trong Cài đặt / Tài khoản."
                      : undefined
                }
                currentModel={
                  isPersonalAiActive
                    ? personalAIStatus?.model || health?.textModel
                    : health?.textModel || "gemini-2.5-flash"
                }
                onUploadAttachment={handleUploadChatAttachment}
              />
            </React.Suspense>
          )}

        <AnimatePresence>
          {confirmDialog && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                onClick={() => {
                  confirmDialog.resolve(false);
                  setConfirmDialog(null);
                }}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative bg-white w-full max-w-sm rounded-md shadow-sm overflow-hidden text-center p-6"
              >
                <div className="w-16 h-16 bg-amber-50 rounded-lg flex items-center justify-center mx-auto mb-6 text-amber-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold uppercase text-slate-800 mb-4 tracking-tight">
                  Xác nhận
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed font-semibold mb-8">
                  {confirmDialog.message}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      confirmDialog.resolve(false);
                      setConfirmDialog(null);
                    }}
                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold tracking-normal hover:bg-slate-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      confirmDialog.resolve(true);
                      setConfirmDialog(null);
                    }}
                    className="flex-1 py-3 px-4 bg-red-500 text-white rounded-md text-[10px] font-semibold tracking-normal hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20"
                  >
                    Đồng ý
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
