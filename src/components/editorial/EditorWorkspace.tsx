import React from 'react';
import { getRenderKey } from '../../utils/listKeys';
import {
  Files, Globe, Type, FileUp, Search, Loader2, Database,
  FileText, X, ShieldCheck, FileDown,
  Target as Plus, Link as LinkIcon, Trash2, Edit3,
  Save, Zap, Check, Copy, History, AlertCircle,
  BookOpen, ClipboardCheck, FileStack, ChevronRight, PanelRightOpen, Clock
} from 'lucide-react';
import { EditorialKindSelector } from './EditorialKindSelector';
import { EDITORIAL_KIND_CONFIG } from '../../lib/editorialTemplates';
import { EditorialInputForm } from './EditorialInputForm';
import { EditorialPreflightPanel } from './EditorialPreflightPanel';
import { TaskType, OutputFormat } from '../../types';
import type { EditorialWorkspaceMode } from '../../types/editorial';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { getEditorialTool } from '../../lib/editorialTools';
import { EditorialToolSelector } from './EditorialToolSelector';
import { A4PrintPreview } from './A4PrintPreview';
import {
  LayoutRecommendationPanel,
  recommendArticleLayoutsForBrief,
  type LayoutRecommendation,
} from './LayoutRecommendationPanel';
import { createArticleDocumentFromCurrentContent } from '../../lib/publishing/articleDocumentAdapter';
import { validateArticleDocument } from '../../lib/publishing/validateArticleDocument';
import {
  countPreflightIssuesBySeverity,
  hasBlockingPreflightIssues,
} from '../../lib/publishing/preflightIssue';
import { getArticleLayout, getDefaultArticleLayout } from '../../lib/publishing/layoutRegistry';
import { buildArticleHtml, buildArticleHtmlFilename } from '../../lib/publishing/htmlExport';
import { normalizeArticleDocumentForExport } from '../../lib/publishing/articleExportAdapter';
import { normalizeEditorialBriefContent, normalizeEditorialBriefInput } from '../../lib/editorialBrief';
import { processTask } from '../../services/geminiService';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type EditorialCreationStep = "brief" | "recommendation" | "generating" | "draft";

function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const EditorWorkspace = (props: any) => {
  const {
    selectedEditorialToolId, handleToolChange,
    historySearchQuery = '', setHistorySearchQuery, loadSession, cleanDisplayTitle, setSessions,
    setTaskType, user, selectedSourceDocIds, documents, setIsPickingFromLibrary, handleSaveSlideOutline, handleCreateTaskFromSlideOutline, safeParseSlideOutline, output, taskType, outputFormat, setOutputFormat, input, setSourceActiveTab, sourceActiveTab, searchQuery, setSearchQuery, handleWebSearch, isLoading, searchResults, getHostname, addSearchResultAsSource, newTextName, setNewTextName, newTextContent, setNewTextContent, saveToLibrary, setSaveToLibrary, handleAddText, newLinkUrl, setNewLinkUrl, handleAddLink, isParsing, fileInputRef, getDocTypeLabel, getSourceTypeLabel, toggleDocSelection, setInput, setOutput, setError, aiCooldownUntil, editorialKind, setEditorialKind, isBuildingTasks, handleBuildTasks, handleProcess, builtTasks, setBuiltTasks, saveBuiltTasks, persistTask, toast, error, outputRef, setIsEditing, isEditing, currentSessionId, sessions, handleCopy, copySuccess, saveCurrentToSession, handleLocalIllustrationScan, isPlanningImages, handleAIIllustrationSuggestions, setSelectingParagraphForImage, auditEditorialPublish, illustrations, requestConfirmAsync, logActivity, stripResolvedPlaceholders, removeBrokenMarkdownImages, imagePlans, approveAllValidIllustrations, clearErrorImages, handleManualUpload, approveIllustration, rejectIllustration, setIllustrations, contentReview, isPublishableIllustration, updateImageLoadStatus, insertApprovedIllustrationsForPlainExport, editorialDraftKey, clearEditorialDraft, createNewSession
  } = props;

  const currentTool = getEditorialTool(selectedEditorialToolId);
  const [currentStep, setCurrentStep] = React.useState<EditorialCreationStep>("brief");
  const [recommendationBrief, setRecommendationBrief] = React.useState("");
  const [recommendedLayouts, setRecommendedLayouts] = React.useState<LayoutRecommendation[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = React.useState<string | undefined>();
  const [selectedLayoutVersion, setSelectedLayoutVersion] = React.useState<string | undefined>();
  const [layoutRecommendationError, setLayoutRecommendationError] = React.useState<string | undefined>();


  const hasGeneratedDraft = Boolean(output?.trim()) || currentStep === "draft";
  const [isBriefPanelOpen, setIsBriefPanelOpen] = React.useState(true);
  const [isDraftDirty, setIsDraftDirty] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [aiEditPrompt, setAiEditPrompt] = React.useState("");
  const [isAiEditingDraft, setIsAiEditingDraft] = React.useState(false);
  const [aiEditError, setAiEditError] = React.useState<string | null>(null);
  const lastToastAtRef = React.useRef<Record<string, number>>({});
  const currentDraftId = React.useMemo(
    () => currentSessionId || `local-${user?.uid || "guest"}-editorial-main`,
    [currentSessionId, user?.uid],
  );
  const localDraftKey = editorialDraftKey || (user?.uid ? `vms:workspace:draft:${user.uid}:editorial:main` : null);

  const dedupeToast = React.useCallback((id: string, run: () => void, cooldownMs = 2500) => {
    const now = Date.now();
    if ((lastToastAtRef.current[id] || 0) + cooldownMs > now) return;
    lastToastAtRef.current[id] = now;
    run();
  }, []);

  const markDraftDirty = React.useCallback(() => {
    if (!hasGeneratedDraft) return;
    setIsDraftDirty(true);
  }, [hasGeneratedDraft]);

  const clearLocalDraft = React.useCallback((showToast = true) => {
    if (typeof clearEditorialDraft === "function") {
      clearEditorialDraft();
    } else if (localDraftKey) {
      localStorage.removeItem(localDraftKey);
      if (showToast) toast.success("Đã xóa bản nháp biên tập trên máy này.");
    }
    setIsDraftDirty(false);
  }, [clearEditorialDraft, localDraftKey, toast]);

  React.useEffect(() => {
    if (!hasGeneratedDraft) {
      setIsBriefPanelOpen(true);
      return;
    }
    setIsBriefPanelOpen(false);
    if (currentStep !== "draft") setCurrentStep("draft");
  }, [currentStep, hasGeneratedDraft]);

  React.useEffect(() => {
    if (!localDraftKey) return;
    const raw = localStorage.getItem(localDraftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { isDraftDirty?: boolean; lastSavedAt?: number | null };
      if (saved.isDraftDirty === true) {
        setIsDraftDirty(true);
        setLastSavedAt(saved.lastSavedAt ?? null);
      }
    } catch {
      // Ignore malformed local draft metadata.
    }
  }, [localDraftKey]);

  React.useEffect(() => {
    if (!localDraftKey || !isDraftDirty || !hasGeneratedDraft) return;
    localStorage.setItem(localDraftKey, JSON.stringify({
      input: normalizeEditorialBriefInput(input),
      output: normalizeEditorialBriefContent(output),
      selectedEditorialToolId,
      taskType,
      outputFormat,
      editorialKind,
      selectedSourceDocIds,
      currentDraftId,
      isDraftDirty: true,
      lastSavedAt,
      updatedAt: Date.now(),
    }));
  }, [currentDraftId, editorialKind, hasGeneratedDraft, input, isDraftDirty, lastSavedAt, localDraftKey, output, outputFormat, selectedEditorialToolId, selectedSourceDocIds, taskType]);

  const resetWorkspaceForNewArticle = React.useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setIsEditing(false);
    setCurrentStep("brief");
    setIsBriefPanelOpen(true);
    setRecommendationBrief("");
    setRecommendedLayouts([]);
    setSelectedLayoutId(undefined);
    setSelectedLayoutVersion(undefined);
    setLayoutRecommendationError(undefined);
    setAiEditPrompt("");
    setAiEditError(null);
    setIsDraftDirty(false);
    setLastSavedAt(null);
  }, [setError, setInput, setIsEditing, setOutput]);

  const handleCreateNewArticle = React.useCallback(async () => {
    if (isDraftDirty) {
      const confirmed = await requestConfirmAsync("Bản thảo hiện tại có thay đổi chưa lưu. Bạn muốn tạo bài mới và bỏ qua các thay đổi cục bộ?");
      if (!confirmed) return;
    }
    clearLocalDraft(false);
    if (typeof createNewSession === "function") {
      createNewSession();
    }
    resetWorkspaceForNewArticle();
  }, [clearLocalDraft, createNewSession, isDraftDirty, requestConfirmAsync, resetWorkspaceForNewArticle]);

  const handleSaveDraft = React.useCallback(async () => {
    if (!output?.trim()) return;
    setIsSavingDraft(true);
    try {
      await saveCurrentToSession(output);
      const savedAt = Date.now();
      setLastSavedAt(savedAt);
      setIsDraftDirty(false);
      if (localDraftKey) localStorage.removeItem(localDraftKey);
      toast.success(`Đã lưu bản thảo lúc ${new Date(savedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (err: any) {
      const message = err?.message || "Không lưu được bản thảo.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingDraft(false);
    }
  }, [localDraftKey, output, saveCurrentToSession, setError, toast]);

  const draftSaveLabel = isSavingDraft
    ? "Đang lưu…"
    : isDraftDirty
      ? "Có thay đổi chưa lưu"
      : lastSavedAt
        ? `Đã lưu lúc ${new Date(lastSavedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
        : hasGeneratedDraft
          ? "Chưa lưu"
          : "Chưa có bản thảo";

  const aiQuickPrompts = React.useMemo(() => [
    "Gợi ý tiêu đề & sapo",
    "Rút gọn nội dung",
    "Nâng cấp lập luận",
    "Chuẩn hóa văn phong website",
    "Kiểm tra lỗi & đề xuất sửa",
    "Làm rõ số liệu/nguồn kiểm chứng",
  ], []);

  const applyAiEdit = React.useCallback(async (promptOverride?: string) => {
    const prompt = normalizeEditorialBriefInput(promptOverride || aiEditPrompt);
    if (!prompt) {
      toast.error("Vui lòng nhập yêu cầu chỉnh sửa bản thảo.");
      return;
    }
    if (!output?.trim()) return;

    setIsAiEditingDraft(true);
    setAiEditError(null);
    try {
      const token = user ? await user.getIdToken() : undefined;
      const response = await processTask(
        "EDITORIAL_POLITICAL",
        [
          "Hãy chỉnh sửa bản thảo hiện tại theo yêu cầu của người dùng.",
          "Chỉ trả về toàn bộ bản thảo sau khi chỉnh sửa, không giải thích thêm.",
          "Bắt buộc bảo toàn cấu trúc xuất bản hiện có: tiêu đề, sapo, heading, bullet list, ordered list, bảng markdown, caption bảng, placeholder ảnh và caption ảnh.",
          "Không xóa placeholder ảnh có chủ đích; không biến bảng/list/caption thành đoạn văn thường; không thêm nhãn prompt kỹ thuật như Yêu cầu / Bối cảnh vào nội dung.",
          `Yêu cầu chỉnh sửa: ${prompt}`,
          "Bản thảo hiện tại:",
          normalizeEditorialBriefContent(output),
        ].join("\n\n"),
        "EDITORIAL",
        outputFormat,
        [],
        token,
      );
      const nextOutput = normalizeEditorialBriefContent(typeof response === "string" ? response : response?.text || "");
      if (!nextOutput.trim()) throw new Error("AI không trả về nội dung chỉnh sửa.");
      setOutput(nextOutput);
      setAiEditPrompt("");
      setIsEditing(false);
      setIsDraftDirty(true);
      setCurrentStep("draft");
      toast.success("Đã áp dụng chỉnh sửa bằng AI.");
    } catch (err: any) {
      const message = err?.message || "Không áp dụng được chỉnh sửa bằng AI.";
      setAiEditError(message);
      setError(message);
      toast.error(message);
    } finally {
      setIsAiEditingDraft(false);
    }
  }, [aiEditPrompt, output, outputFormat, setError, setIsEditing, setOutput, toast, user]);

  const selectedLayout = React.useMemo(() => {
    if (!selectedLayoutId || !selectedLayoutVersion) return undefined;
    return getArticleLayout(selectedLayoutId, selectedLayoutVersion);
  }, [selectedLayoutId, selectedLayoutVersion]);

  const articleDocument = React.useMemo(() => {
    const previewContent = normalizeEditorialBriefContent(output || "");

    return createArticleDocumentFromCurrentContent(previewContent, {
      status: "draft",
      authorName: user?.displayName || user?.email || undefined,
      layoutId: selectedLayout?.layoutId,
      layoutVersion: selectedLayout?.layoutVersion,
      estimatedPages: selectedLayout?.estimatedPages,
    });
  }, [output, selectedLayout, user?.displayName, user?.email]);

  const articleExportModel = React.useMemo(() => normalizeArticleDocumentForExport(articleDocument), [articleDocument]);
  const articleValidation = React.useMemo(() => validateArticleDocument(articleDocument), [articleDocument]);
  const preflightIssues = React.useMemo(() => articleValidation.preflightIssues, [articleValidation]);
  const preflightCounts = React.useMemo(() => countPreflightIssuesBySeverity(preflightIssues), [preflightIssues]);
  const hasPreflightBlockers = React.useMemo(() => hasBlockingPreflightIssues(preflightIssues), [preflightIssues]);

  const validateArticleBeforeExport = React.useCallback(async () => {
    if (hasPreflightBlockers) {
      const message = "Chưa thể xuất bản vì còn lỗi bắt buộc cần xử lý.";
      dedupeToast("preflight-blocker", () => toast.error(message));
      setError(message);
      return false;
    }

    if (preflightCounts.warning > 0) {
      dedupeToast("preflight-warning", () => toast("Bản thảo còn cảnh báo trước khi xuất bản chính thức.", { icon: "⚠️", duration: 4000 }));
      return requestConfirmAsync("Bản thảo còn cảnh báo/cần bổ sung. Bạn vẫn muốn xuất file bản nháp?");
    }

    return true;
  }, [dedupeToast, hasPreflightBlockers, preflightCounts.warning, requestConfirmAsync, setError, toast]);

  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);
  const [exportingFormat, setExportingFormat] = React.useState<null | "pdf" | "docx" | "html">(null);
  React.useEffect(() => {
    if (!aiCooldownUntil) {
      setCooldownRemaining(0);
      return;
    }
    const timer = setInterval(() => {
      const remaining = Math.ceil((aiCooldownUntil - Date.now()) / 1000);
      setCooldownRemaining(remaining > 0 ? remaining : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [aiCooldownUntil]);


  const buildRecommendationBrief = React.useCallback(() => {
    const sourceSummary = selectedSourceDocIds.length > 0
      ? `

Nguồn tư liệu đã chọn: ${selectedSourceDocIds.length} tài liệu.`
      : "";
    return `${normalizeEditorialBriefInput(input)}${sourceSummary}`.trim();
  }, [input, selectedSourceDocIds.length]);

  const openLayoutRecommendations = React.useCallback(() => {
    if (!normalizeEditorialBriefInput(input) && selectedSourceDocIds.length === 0) {
      toast.error("Vui lòng nhập nội dung hoặc chọn tài liệu nguồn trước khi xử lý.");
      return;
    }

    const brief = buildRecommendationBrief();
    const recommendations = recommendArticleLayoutsForBrief(brief);
    const invalidRecommendation = recommendations.find(
      (recommendation) => !getArticleLayout(recommendation.layout.layoutId, recommendation.layout.layoutVersion),
    );

    setRecommendationBrief(brief);
    setRecommendedLayouts(recommendations);
    setLayoutRecommendationError(
      invalidRecommendation
        ? `Layout ${invalidRecommendation.layout.layoutId}@${invalidRecommendation.layout.layoutVersion} không tồn tại trong registry.`
        : undefined,
    );
    setCurrentStep("recommendation");
  }, [buildRecommendationBrief, input, selectedSourceDocIds.length, toast]);

  const runProcessWithLayout = React.useCallback(async (layoutId?: string, layoutVersion?: string) => {
    setSelectedLayoutId(layoutId);
    setSelectedLayoutVersion(layoutVersion);
    setCurrentStep("generating");
    await handleProcess();
    setCurrentStep("draft");
    setIsDraftDirty(true);
    setLastSavedAt(null);
  }, [handleProcess]);

  const handleSelectRecommendedLayout = React.useCallback((recommendation: LayoutRecommendation) => {
    void runProcessWithLayout(recommendation.layout.layoutId, recommendation.layout.layoutVersion);
  }, [runProcessWithLayout]);

  const handleUseDefaultLayout = React.useCallback(() => {
    const defaultLayout = getDefaultArticleLayout();
    void runProcessWithLayout(defaultLayout.layoutId, defaultLayout.layoutVersion);
  }, [runProcessWithLayout]);

  const handleStartProcessing = React.useCallback(() => {
    if (currentTool?.taskType === "WRITE_NEW") {
      openLayoutRecommendations();
      return;
    }

    handleProcess();
  }, [currentTool?.taskType, handleProcess, openLayoutRecommendations]);

  const [workspaceMode, setWorkspaceMode] = React.useState<EditorialWorkspaceMode>("history");

  React.useEffect(() => {
    if (workspaceMode === "create" && output?.trim()) {
      setWorkspaceMode("edit");
    }
  }, [output, workspaceMode]);

  const safeCleanDisplayTitle = React.useCallback((rawTitle?: string) => {
    const cleaned = typeof cleanDisplayTitle === "function" ? cleanDisplayTitle(rawTitle) : rawTitle;
    const title = (cleaned || "").trim();
    const dirtyTitlePatterns = [
      /^yêu cầu\s*\/\s*bối cảnh/i,
      /^yêu cầu\s*[:：]/i,
      /^bối cảnh\s*[:：]/i,
      /yêu cầu\s*\/\s*bối cảnh/i,
    ];
    if (!title || dirtyTitlePatterns.some((pattern) => pattern.test(title))) {
      return "Bài viết chưa đặt tiêu đề";
    }
    return title;
  }, [cleanDisplayTitle]);

  const filteredSessions = React.useMemo(() => {
    const query = historySearchQuery.trim().toLowerCase();
    return (sessions || []).filter((session: any) => {
      if (!query) return true;
      return (
        safeCleanDisplayTitle(session.title).toLowerCase().includes(query) ||
        session.versions?.[0]?.content?.toLowerCase().includes(query) ||
        session.currentOutput?.toLowerCase().includes(query)
      );
    });
  }, [historySearchQuery, safeCleanDisplayTitle, sessions]);

  const switchWorkspaceMode = React.useCallback((mode: EditorialWorkspaceMode) => {
    if (mode === "create") {
      if (typeof createNewSession === "function") createNewSession();
      handleToolChange?.("draft_new");
      setTaskType?.("WRITE_NEW");
      setOutputFormat?.("ARTICLE");
    }
    setWorkspaceMode(mode);
  }, [createNewSession, handleToolChange, setOutputFormat, setTaskType]);

  const openSessionInEditor = React.useCallback(async (session: any) => {
    if (typeof loadSession === "function") {
      await loadSession(session);
    }
    setWorkspaceMode("edit");
  }, [loadSession]);

  const moduleMenuItems: Array<{
    id: EditorialWorkspaceMode;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "history", title: "Lịch sử văn bản", description: "Quản lý các bản thảo đã tạo.", icon: History },
    { id: "create", title: "Tạo văn bản mới", description: "Bắt đầu quy trình viết mới.", icon: FileText },
    { id: "edit", title: "Biên tập văn bản", description: "Soạn thảo, chỉnh sửa, AI edit, Preview.", icon: Edit3 },
    { id: "review", title: "Rà soát nội dung", description: "Kiểm tra chất lượng, lỗi chính tả, thuật ngữ.", icon: ClipboardCheck },
    { id: "summarize", title: "Tóm tắt – tổng hợp", description: "Tạo phiếu tóm tắt, tổng hợp tài liệu.", icon: FileStack },
    { id: "sources", title: "Nguồn tư liệu", description: "Quản lý kho tư liệu, web, file, link, văn bản.", icon: BookOpen },
  ];

  const workspaceTitles: Record<EditorialWorkspaceMode, { title: string; subtitle: string }> = {
    history: {
      title: "Lịch sử văn bản",
      subtitle: "Quản lý các bản thảo, phiên bản chỉnh sửa và nguồn tư liệu đã sử dụng.",
    },
    create: {
      title: "Tạo văn bản mới",
      subtitle: "Chọn loại văn bản, nhập yêu cầu và gắn nguồn tư liệu trong cùng một workspace.",
    },
    edit: {
      title: "Biên tập văn bản",
      subtitle: "Soạn thảo, chỉnh sửa, AI edit, Preview A4 và xuất bản thảo.",
    },
    review: {
      title: "Rà soát nội dung",
      subtitle: "Kiểm tra chất lượng văn bản, lỗi chính tả, thuật ngữ và rủi ro nội dung.",
    },
    summarize: {
      title: "Tóm tắt – tổng hợp",
      subtitle: "Tạo phiếu tóm tắt hoặc tài liệu tổng hợp từ nguồn tư liệu đã chọn.",
    },
    sources: {
      title: "Nguồn tư liệu",
      subtitle: "Quản lý kho tư liệu, tra cứu web, dán văn bản, thêm liên kết và tải tệp lên.",
    },
  };

  const sourceTabs = [
    { id: "library", label: "Kho tư liệu", icon: Plus },
    { id: "web", label: "Tra cứu web", icon: Globe },
    { id: "text", label: "Dán văn bản", icon: Type },
    { id: "link", label: "Thêm liên kết", icon: LinkIcon },
    { id: "upload", label: "Tải tệp lên", icon: FileUp },
  ];

  const groupedTemplates = [
    { title: "Truyền thông", kinds: ["website_article", "news", "press_release"] },
    { title: "Hành chính", kinds: ["official_letter", "announcement", "administrative_report", "plan", "meeting_minutes"] },
    { title: "Xử lý nhanh", kinds: ["speech_outline", "briefing_note", "summary_note"] },
  ] as const;

  const renderWorkspaceHeader = () => {
    const activeTitle = workspaceTitles[workspaceMode];
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 sm:px-6 py-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
          <span>Trợ lý biên tập</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#002D56]">{activeTitle.title}</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{activeTitle.title}</h1>
            <p className="text-[13px] sm:text-sm text-slate-500 mt-1 max-w-3xl">{activeTitle.subtitle}</p>
          </div>
          {workspaceMode === "history" && (
            <button
              onClick={() => switchWorkspaceMode("create")}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002D56] px-4 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-900 transition-colors"
            >
              <Plus className="w-4 h-4" /> Tạo văn bản mới
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderHistoryMode = () => (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm văn bản, nội dung hoặc phiên bản..."
            value={historySearchQuery}
            onChange={(event) => setHistorySearchQuery?.(event.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium focus:ring-2 focus:ring-[#002D56]/20 focus:border-[#002D56]/30 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-slate-500">
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1.5">Tất cả văn bản</span>
          <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1.5">{filteredSessions.length} bản thảo</span>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="min-h-[360px] bg-white border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center px-6 py-12">
          <History className="w-16 h-16 text-slate-200 mb-5" />
          <h2 className="text-lg font-bold text-slate-700">Chưa có văn bản phù hợp</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md">Tạo văn bản mới hoặc điều chỉnh từ khóa tìm kiếm để xem lại bản thảo đã lưu.</p>
          <button
            onClick={() => switchWorkspaceMode("create")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#002D56] px-4 py-3 text-[13px] font-semibold text-white hover:bg-slate-900 transition-colors"
          >
            <Plus className="w-4 h-4" /> Tạo văn bản mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredSessions.map((session: any, idx: number) => (
            <article
              key={`editorial-history-${session.id || idx}`}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-[#002D56] hover:shadow-md transition-all group flex flex-col min-h-[220px]"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                  {session.taskType === "WRITE_NEW" ? "Viết mới" : "Biên tập"}
                </span>
                <span className="text-[12px] text-slate-500 font-medium flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString("vi-VN") : "Chưa lưu"}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-[#002D56] transition-colors">
                {safeCleanDisplayTitle(session.title)}
              </h2>
              <div className="flex flex-wrap gap-2 mt-5 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <Clock className="w-3.5 h-3.5" /> {(session.versions || []).length} phiên bản
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <Files className="w-3.5 h-3.5" /> {(session.documentIds || []).length} nguồn
                </span>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 mt-auto">
                <button
                  onClick={() => void openSessionInEditor(session)}
                  className="flex-1 bg-white text-[#002D56] border border-[#002D56] py-2.5 rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" /> Mở biên tập
                </button>
                <button
                  onClick={async (event) => {
                    event.stopPropagation();
                    const confirmed = await requestConfirmAsync?.("Bạn có chắc chắn muốn xóa bài viết này cùng toàn bộ lịch sử?");
                    if (!confirmed) return;
                    if (user) {
                      try {
                        await deleteDoc(doc(db, "users", user.uid, "sessions", session.id));
                        setSessions?.((prev: any[]) => prev.filter((item: any) => item.id !== session.id));
                        toast.success("Đã xóa bài viết.");
                        await logActivity?.({
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
                        console.error("Delete session error:", err);
                        toast.error("Không thể xóa bài viết trên hệ thống.");
                      }
                    } else {
                      setSessions?.((prev: any[]) => prev.filter((item: any) => item.id !== session.id));
                    }
                  }}
                  className="px-3 py-2.5 rounded-lg text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100"
                  title="Xóa bài viết"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  const renderCreateMode = () => (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002D56] text-white text-sm font-bold">1</span>
          <div>
            <h2 className="text-base font-bold text-slate-800">Chọn loại văn bản</h2>
            <p className="text-[13px] text-slate-500">Template nằm trong workspace để tránh lẫn với menu nghiệp vụ.</p>
          </div>
        </div>
        <div className="space-y-5">
          {groupedTemplates.map((group) => (
            <div key={group.title}>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-500 mb-3">{group.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.kinds.map((kind) => {
                  const config = (EDITORIAL_KIND_CONFIG as any)[kind];
                  const selected = editorialKind === kind;
                  return (
                    <button
                      key={kind}
                      onClick={() => setEditorialKind(kind as any)}
                      className={cn(
                        "min-h-[112px] text-left rounded-xl border p-4 transition-all bg-white hover:border-[#002D56] hover:shadow-sm",
                        selected ? "border-[#002D56] bg-blue-50/70 shadow-sm ring-1 ring-[#002D56]/15" : "border-slate-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-[14px] font-bold text-slate-800">{config?.label || kind}</h4>
                          <p className="text-[12px] leading-relaxed text-slate-500 mt-2">{config?.description || "Mẫu văn bản."}</p>
                        </div>
                        {selected && <Check className="w-5 h-5 text-[#002D56] shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002D56] text-white text-sm font-bold">2</span>
          <div>
            <h2 className="text-base font-bold text-slate-800">Nhập thông tin đầu vào</h2>
            <p className="text-[13px] text-slate-500">Mô tả yêu cầu, bối cảnh, số liệu và đối tượng sử dụng văn bản.</p>
          </div>
        </div>
        <EditorialInputForm
          kind={editorialKind}
          initialValue={input}
          onChange={(nextValue: string) => setInput(nextValue)}
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#002D56] text-white text-sm font-bold">3</span>
          <div>
            <h2 className="text-base font-bold text-slate-800">Chọn nguồn tư liệu</h2>
            <p className="text-[13px] text-slate-500">Có thể bổ sung nguồn ở chế độ “Nguồn tư liệu” rồi quay lại tạo văn bản.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {sourceTabs.map((tab) => (
            <button
              key={`create-source-${tab.id}`}
              onClick={() => {
                setSourceActiveTab(tab.id as any);
                setWorkspaceMode("sources");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:border-[#002D56] hover:text-[#002D56]"
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-[13px] text-slate-600"><strong>{selectedSourceDocIds.length}</strong> nguồn tư liệu đang được chọn cho bản thảo này.</p>
          <button
            onClick={() => {
              setCurrentStep("brief");
              setWorkspaceMode("edit");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-[#002D56] hover:text-[#002D56]"
          >
            Mở workspace biên tập
          </button>
        </div>
      </section>
    </div>
  );

  const renderPlaceholderMode = (kind: "review" | "summarize") => (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 min-h-[420px] flex flex-col justify-center">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-[#002D56] px-3 py-1.5 text-[12px] font-bold mb-5">
          {kind === "review" ? <ClipboardCheck className="w-4 h-4" /> : <FileStack className="w-4 h-4" />}
          {kind === "review" ? "Kiểm tra chất lượng văn bản" : "Tóm tắt – tổng hợp tài liệu"}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">
          {kind === "review" ? "Rà soát nội dung" : "Tóm tắt – tổng hợp"}
        </h2>
        <p className="text-sm leading-7 text-slate-600">
          {kind === "review"
            ? "MVP này chuẩn hóa điểm vào cho chức năng kiểm tra chất lượng văn bản. Luồng AI review hiện có vẫn được giữ trong workspace biên tập để tránh rewrite lớn."
            : "MVP này chuẩn hóa điểm vào cho chức năng tạo phiếu tóm tắt và tài liệu tổng hợp. Logic xử lý hiện có vẫn được giữ an toàn trong workspace biên tập."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={() => switchWorkspaceMode("history")} className="rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-[#002D56] hover:text-[#002D56]">Quay lại lịch sử</button>
          <button onClick={() => switchWorkspaceMode("edit")} className="rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-900">Chọn văn bản để biên tập</button>
        </div>
      </div>
    </div>
  );

  const renderSourcesMode = () => (
    <div className="space-y-5">
      <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4 px-1">
          <Files className="w-5 h-5 text-[#002D56]" />
          <h2 className="text-[15px] font-bold text-slate-800">Nguồn tư liệu</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl mb-5">
          {sourceTabs.map((tab) => (
            <button
              key={`source-mode-tab-${tab.id}`}
              onClick={() => setSourceActiveTab(sourceActiveTab === tab.id ? null : (tab.id as any))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap",
                sourceActiveTab === tab.id ? "bg-white text-[#002D56] shadow-sm ring-1 ring-[#002D56]/10" : "text-slate-500 hover:text-slate-700 hover:bg-white/60",
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-600">
          Chế độ này chuẩn hóa nhãn nguồn tư liệu cho MVP. Các form chọn kho, tra cứu web, dán văn bản, thêm liên kết và tải tệp vẫn được giữ đầy đủ trong workspace biên tập để tránh rewrite module Kho tư liệu trong PR này.
        </div>
      </section>
      <button onClick={() => switchWorkspaceMode("edit")} className="inline-flex items-center gap-2 rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-900">
        <PanelRightOpen className="w-4 h-4" /> Quay lại biên tập văn bản
      </button>
    </div>
  );

  const renderEditMode = () => (
    <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-5 h-full">
                        {/* Sidebar: Controls & Sources */}
                        <aside className="space-y-4 sm:space-y-6 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto overscroll-contain custom-scrollbar pr-1">
                          {/* Task Types */}
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <EditorialToolSelector
                              value={selectedEditorialToolId}
                              onChange={handleToolChange}
                            />
                          </section>

                          {/* Project Specific Sources */}
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <Files className="w-5 h-5 text-[#002D56]" />
                              <h2 className="text-[14px] font-semibold text-slate-800">
                                Nguồn tư liệu
                              </h2>
                            </div>

                            {/* Tab Controls */}
                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg mb-4 overflow-x-auto custom-scrollbar">
                              {[
                                { id: "library", label: "Kho tư liệu", icon: Plus },
                                { id: "web", label: "Tra cứu web", icon: Globe },
                                { id: "text", label: "Dán văn bản", icon: Type },
                                { id: "link", label: "Thêm liên kết", icon: LinkIcon },
                                {
                                  id: "upload",
                                  label: "Tải tệp lên",
                                  icon: FileUp,
                                },
                              ].map((tab) => (
                                <button
                                  key={`editor-source-tab-${tab.id}`}
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
                                          Tra cứu web AI
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
                                  .map((doc, idx) => {
                                    const kind = doc.type === 'drive' ? (doc.driveMimeType?.includes('folder') ? 'drive_folder' : 'drive_file') : (doc.temporary ? 'temp' : 'document');
                                    return (
                                      <div
                                        key={getRenderKey("editor-doc", doc, idx)}
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
                                    );
                                  })
                              )}
                            </div>
                          </section>
                        </aside>

                        {/* Main Editor Area */}
                        <div className="space-y-6 min-w-0">
                          {/* Input Area */}
                          {(!hasGeneratedDraft || isBriefPanelOpen) && (
                          <section className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 sm:p-2.5 bg-[#002D56] rounded-md shadow-sm shadow-[#002D56]/10">
                                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                </div>
                                <div className="">
                                  <span className="text-xs sm:text-sm font-semibold text-[#002D56] tracking-normal">
                                    {currentTool?.inputLabel || "Thông tin đầu vào"}
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
                                  onClick={handleCreateNewArticle}
                                  className="text-slate-300 hover:text-red-500 p-2 sm:p-2.5 rounded-md transition-all hover:bg-red-50"
                                  title="Làm mới vùng biên tập"
                                >
                                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              </div>
                            </div>
                            <div className="relative flex-1 flex flex-col min-h-[300px] bg-slate-50/50">
                              {currentTool?.taskType === "WRITE_NEW" && currentStep === "recommendation" ? (
                                <LayoutRecommendationPanel
                                  userBrief={recommendationBrief}
                                  recommendations={recommendedLayouts}
                                  isLoading={false}
                                  errorMessage={layoutRecommendationError}
                                  onSelectLayout={handleSelectRecommendedLayout}
                                  onUseDefaultLayout={handleUseDefaultLayout}
                                  onBackToBrief={() => setCurrentStep("brief")}
                                />
                              ) : currentTool?.taskType === "WRITE_NEW" ? (
                                <div className="p-6 sm:p-6 flex-1 w-full space-y-6">
                                  {currentTool.requiresDocumentKind && (
                                    <EditorialKindSelector
                                      value={editorialKind}
                                      onChange={setEditorialKind}
                                    />
                                  )}
                                  <EditorialInputForm
                                    kind={editorialKind}
                                    initialValue={input}
                                    onChange={(value) => {
                                      setInput(normalizeEditorialBriefInput(value));
                                      if (hasGeneratedDraft) markDraftDirty();
                                    }}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  value={normalizeEditorialBriefInput(input)}
                                  onChange={(e) => {
                                    setInput(normalizeEditorialBriefInput(e.target.value));
                                    if (hasGeneratedDraft) markDraftDirty();
                                  }}
                                  placeholder={currentTool?.inputPlaceholder || "Nhập thông tin..."}
                                  className="flex-1 w-full p-6 sm:p-6 pb-32 focus:outline-none resize-none text-slate-800 text-base sm:text-lg leading-relaxed placeholder:text-slate-400 placeholder:font-medium bg-transparent"
                                />
                              )}

                              {!(currentTool?.taskType === "WRITE_NEW" && currentStep === "recommendation") && (
                              <div className="absolute flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 bottom-0 right-0 w-full p-4 sm:p-6 pointer-events-none">
                                {!input.trim() &&
                                  selectedSourceDocIds.length === 0 && (
                                    <span className="text-[12px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 italic tracking-tight hidden sm:block">
                                      Nhập yêu cầu để bắt đầu
                                    </span>
                                  )}
                                <button
                                  disabled={
                                    isLoading ||
                                    isParsing ||
                                    isBuildingTasks ||
                                    cooldownRemaining > 0
                                  }
                                  onClick={
                                    handleStartProcessing
                                  }
                                  className={cn(
                                    "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-md font-semibold text-[13px] tracking-normal transition-all duration-300 shadow-md active:scale-[0.98] pointer-events-auto shrink-0",
                                    isLoading ||
                                      isParsing ||
                                      isBuildingTasks ||
                                      cooldownRemaining > 0
                                      ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                                      : "bg-[#002D56] text-white hover:bg-slate-900 shadow-[#002D56]/30 hover:shadow-sm",
                                  )}
                                >
                                  {isLoading || isBuildingTasks ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Đang xử lý...
                                    </>
                                  ) : cooldownRemaining > 0 ? (
                                    <>
                                      ⏱ Thử lại sau {cooldownRemaining}s
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-4 h-4 fill-current" />
                                      Bắt đầu xử lý
                                    </>
                                  )}
                                </button>
                              </div>
                              )}
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
                          )}


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
                                  {error && error.toLowerCase().includes("không khả dụng") && (
                                    <div className="mt-2 text-xs bg-red-100 text-red-800 p-2.5 rounded border border-red-200">
                                      Gợi ý: Cấu hình model chưa kích hoạt hoặc không khả dụng. Vào <strong>Cài đặt/Tài khoản → AI Models / API key</strong> để kiểm tra lại cấu hình.
                                    </div>
                                  )}
                                  {error && error.toLowerCase().includes("hạn mức") && (
                                    <div className="mt-2 text-xs bg-amber-50 text-amber-850 p-2.5 rounded border border-amber-250 leading-relaxed">
                                      Gợi ý: Đây là giới hạn của Gemini API free tier, không phải lỗi dữ liệu. Thử lại sau khi hết thời gian chờ, hoặc vào Cài đặt để sử dụng API key khác/nâng hạn mức.
                                      <div className="mt-2">
                                        <button 
                                          onClick={() => document.dispatchEvent(new CustomEvent('open-settings'))}
                                          className="text-amber-800 bg-amber-100/50 hover:bg-amber-200/50 border border-amber-300 px-3 py-1 rounded shadow-sm transition-all"
                                        >
                                          Mở Cài đặt API key/model
                                        </button>
                                      </div>
                                    </div>
                                  )}
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
                                          {taskType === "WRITE_NEW" ? "Bản thảo văn bản" : (currentTool?.resultLabel || "Sản phẩm đầu ra")}
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
                                          <button
                                            onClick={() => setIsBriefPanelOpen((value) => !value)}
                                            className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-white border border-blue-100 text-blue-700 hover:bg-blue-50"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            {isBriefPanelOpen ? "Ẩn đầu vào" : "Chỉnh sửa đầu vào"}
                                          </button>
                                          <button
                                            onClick={handleCreateNewArticle}
                                            className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-white border border-emerald-100 text-emerald-700 hover:bg-emerald-50"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            Tạo bài mới
                                          </button>
                                          <button
                                            onClick={handleSaveDraft}
                                            disabled={isSavingDraft || !output?.trim()}
                                            className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-[#002D56] text-white hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
                                          >
                                            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Lưu bản thảo
                                          </button>
                                          <span className={cn(
                                            "text-[10px] font-semibold px-2.5 py-1 rounded-md border",
                                            isDraftDirty
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : lastSavedAt
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-slate-50 text-slate-500 border-slate-200",
                                          )}>
                                            {draftSaveLabel}
                                          </span>
                                          {isDraftDirty && (
                                            <button
                                              onClick={() => clearLocalDraft(true)}
                                              className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-white border border-red-100 text-red-600 hover:bg-red-50"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              Xóa bản nháp
                                            </button>
                                          )}
                                          {currentSessionId &&
                                            sessions.find(
                                              (s) => s.id === currentSessionId,
                                            )?.versions?.length! > 1 && (
                                              <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 tracking-wide bg-white px-2 py-1 rounded-lg border border-slate-100">
                                                <History className="w-3 h-3" />
                                                {
                                                  sessions.find(
                                                    (s) =>
                                                      s.id === currentSessionId,
                                                  )?.versions?.length || 0
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
                                        title="Sao chép" aria-label="Sao chép"
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
                                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <h3 className="text-xs font-bold text-[#002D56] uppercase tracking-wide">Chỉnh sửa bằng AI</h3>
                                          <p className="text-[11px] text-slate-500">Nhập yêu cầu riêng cho bản thảo hiện tại, tách khỏi thông tin tạo bài ban đầu.</p>
                                        </div>
                                        {isAiEditingDraft && (
                                          <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1.5">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang chỉnh sửa…
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {aiQuickPrompts.map((prompt) => (
                                          <button
                                            key={prompt}
                                            type="button"
                                            onClick={() => setAiEditPrompt(prompt)}
                                            className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
                                          >
                                            {prompt}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="flex flex-col gap-2 lg:flex-row">
                                        <textarea
                                          value={aiEditPrompt}
                                          onChange={(event) => setAiEditPrompt(normalizeEditorialBriefInput(event.target.value))}
                                          placeholder="Nhập yêu cầu chỉnh sửa cho bản thảo hiện tại…"
                                          className="min-h-[84px] flex-1 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void applyAiEdit()}
                                          disabled={isAiEditingDraft || !aiEditPrompt.trim()}
                                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002D56] px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 lg:w-48"
                                        >
                                          {isAiEditingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                          Áp dụng chỉnh sửa bằng AI
                                        </button>
                                      </div>
                                      {aiEditError && <p className="text-[11px] font-semibold text-red-600">{aiEditError}</p>}
                                    </div>
                                  )}

                                  {taskType === "WRITE_NEW" && (
                                    <EditorialPreflightPanel
                                      kind={editorialKind}
                                      markdownContent={output}
                                      articleDocument={articleDocument}
                                      issues={preflightIssues}
                                    />
                                  )}

                                  <div className="flex flex-wrap items-center gap-2 pb-1 -mx-1 px-1 overflow-visible">
                                    {(currentTool?.allowPdfExport !== false) && (
                                      <>
                                        <button
                                          onClick={async () => {
                                            if (exportingFormat) return;
                                            setExportingFormat("pdf");
                                            try {
                                              if (!(await validateArticleBeforeExport())) return;
                                              toast(
                                                "Đang tạo file PDF...",
                                                { icon: "ℹ️", duration: 5000 },
                                              );
                                              const { exportPrintablePdfFromArticleExportModel } =
                                                await import("../../lib/printablePdfExport");
                                              await exportPrintablePdfFromArticleExportModel(
                                                articleExportModel, {
                                                  title: articleExportModel.title || `Bai_viet_HTMB_${Date.now()}`,
                                                  profile: "article",
                                                  onValidationError: (msg) => {
                                                    dedupeToast(`pdf-validation-error-${msg}`, () => toast(`Lỗi: ${msg}`, { icon: '❌', duration: 4000 }));
                                                  },
                                                  onValidationWarning: (msg) => {
                                                    dedupeToast(`pdf-validation-warning-${msg}`, () => toast(`Cảnh báo: ${msg}`, { icon: '⚠️', duration: 3000 }));
                                                  }
                                                }
                                              );
                                              dedupeToast("export-pdf-success", () => toast.success("Tải PDF thành công!"));

                                              if (currentSessionId) {
                                                await logActivity({
                                                  module: "editorial",
                                                  action: "exported",
                                                  entityType: "editorial_session",
                                                  entityId: currentSessionId,
                                                  entityTitle:
                                                    sessions.find(
                                                      (s: any) => s.id === currentSessionId,
                                                    )?.title || "Bài viết",
                                                  title: "Xuất PDF văn bản",
                                                  summary:
                                                    "Đã xuất bài viết ra định dạng PDF văn bản có thể tìm kiếm.",
                                                  metadata: {
                                                    exportFormat: "pdf",
                                                    source: "client",
                                                  },
                                                });
                                              }
                                            } catch (err: any) {
                                              dedupeToast("export-pdf-error", () => toast.error(err?.message || "Không tạo được file PDF."));
                                              setError(err.message);
                                            } finally {
                                              setExportingFormat(null);
                                            }
                                          }}
                                          disabled={hasPreflightBlockers || Boolean(exportingFormat)}
                                          aria-disabled={hasPreflightBlockers || Boolean(exportingFormat)}
                                          className={cn(
                                            "flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/80 transition-all shrink-0 active:scale-[0.98] shadow-sm disabled:opacity-50",
                                            hasPreflightBlockers && "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
                                          )}
                                          title={hasPreflightBlockers ? "Chưa thể xuất bản vì còn lỗi bắt buộc cần xử lý." : "Xuất bản PDF chất lượng cao có thể tìm kiếm và chọn được văn bản"}
                                        >
                                          <FileDown className="w-4 h-4 text-emerald-600" />
                                          <span className="text-[10px] font-bold uppercase tracking-wider">
                                            PDF văn bản
                                          </span>
                                        </button>

                                        {(currentTool?.allowWordExport !== false) && (
                                      <button
                                        onClick={async () => {
                                          if (exportingFormat) return;
                                          setExportingFormat("docx");
                                          try {
                                            if (!(await validateArticleBeforeExport())) return;
                                            const { exportWordFromArticleExportModel } = await import("../../lib/exportUtils");
                                            await exportWordFromArticleExportModel(
                                              articleExportModel,
                                              {
                                                title: articleExportModel.title || "Bài viết",
                                                filename: `Bai_viet_HTMB_${Date.now()}`,
                                                kind: editorialKind,
                                              },
                                            );
                                            dedupeToast("export-docx-success", () => toast.success("Tải Word thành công!"));

                                            if (currentSessionId) {
                                              await logActivity({
                                                module: "editorial",
                                                action: "exported",
                                                entityType: "editorial_session",
                                                entityId: currentSessionId,
                                                entityTitle:
                                                  sessions.find(
                                                    (s) => s.id === currentSessionId,
                                                  )?.title || "Bài viết",
                                                title: "Xuất Word",
                                                summary: "Đã xuất bài viết ra định dạng Word (DOCX).",
                                                metadata: {
                                                  exportFormat: "docx",
                                                  source: "client",
                                                },
                                              });
                                            }
                                          } catch (err: any) {
                                            dedupeToast("export-docx-error", () => toast.error(err?.message || "Không tạo được file Word."));
                                            setError(err.message);
                                          } finally {
                                            setExportingFormat(null);
                                          }
                                        }}
                                        disabled={hasPreflightBlockers || Boolean(exportingFormat)}
                                        aria-disabled={hasPreflightBlockers || Boolean(exportingFormat)}
                                        className={cn(
                                          "flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100/80 transition-all shrink-0 active:scale-[0.98] shadow-sm disabled:opacity-50",
                                          hasPreflightBlockers && "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
                                        )}
                                        title={hasPreflightBlockers ? "Chưa thể xuất bản vì còn lỗi bắt buộc cần xử lý." : "Xuất Word (DOCX)"}
                                      >
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                          Word
                                        </span>
                                      </button>
                                    )}
                                      </>
                                    )}
                                        <button
                                          onClick={async () => {
                                            if (exportingFormat) return;
                                            setExportingFormat("html");
                                            try {
                                              if (!(await validateArticleBeforeExport())) return;
                                              const title = articleExportModel.title || articleDocument.metadata?.title || "Bài viết A4";
                                              const html = buildArticleHtml(articleDocument, { title });
                                              const filename = buildArticleHtmlFilename();
                                              downloadHtmlFile(html, filename);
                                              dedupeToast("export-html-success", () => toast.success("Tải HTML A4 thành công!"));

                                              if (currentSessionId) {
                                                await logActivity({
                                                  module: "editorial",
                                                  action: "exported",
                                                  entityType: "editorial_session",
                                                  entityId: currentSessionId,
                                                  entityTitle:
                                                    sessions.find((s) => s.id === currentSessionId)?.title || "Bài viết",
                                                  title: "Xuất HTML A4",
                                                  summary: "Đã xuất bài viết ra định dạng HTML A4 độc lập.",
                                                  metadata: {
                                                    exportFormat: "html",
                                                    source: "client",
                                                  },
                                                });
                                              }
                                            } catch (err: unknown) {
                                              const message = err instanceof Error ? err.message : "Không tạo được file HTML.";
                                              dedupeToast("export-html-error", () => toast.error(message));
                                              setError(message);
                                            } finally {
                                              setExportingFormat(null);
                                            }
                                          }}
                                          disabled={hasPreflightBlockers || Boolean(exportingFormat)}
                                          aria-disabled={hasPreflightBlockers || Boolean(exportingFormat)}
                                          className={cn(
                                            "flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100/80 transition-all shrink-0 active:scale-[0.98] shadow-sm disabled:opacity-50",
                                            hasPreflightBlockers && "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
                                          )}
                                          title={hasPreflightBlockers ? "Chưa thể xuất bản vì còn lỗi bắt buộc cần xử lý." : "Xuất HTML A4 độc lập"}
                                        >
                                          <Globe className="w-4 h-4 text-slate-600" />
                                          <span className="text-[10px] font-bold uppercase tracking-wider">
                                            HTML A4
                                          </span>
                                        </button>

                                  </div>
                                </div>

                                <div className="p-4 sm:p-6 md:p-10 bg-[#FCFDFF] printable-article-shell">

                                  {isEditing ? (
                                    <div className="prose prose-slate max-w-none prose-headings:text-[#002D56] prose-headings:font-semibold prose-p:text-slate-700 prose-p:text-lg prose-p:leading-relaxed prose-li:text-slate-600 font-serif">
                                      <textarea
                                        value={output}
                                        onChange={(e) => {
                                          setOutput(e.target.value);
                                          markDraftDirty();
                                        }}
                                        className="w-full h-[600px] p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-lg leading-relaxed font-serif focus:outline-none focus:border-[#002D56] transition-all"
                                      />
                                    </div>
                                  ) : (
                                    <A4PrintPreview document={articleDocument} rootId="printable-article" showValidationSummary={false} />
                                  )}
                                </div>

                                <div className="px-8 py-6 bg-[#002D56] text-white/50 text-[10px] font-semibold text-center uppercase tracking-[0.3em]">
                                  Bản quyền nội dung thuộc về Tổng Công ty Bảo
                                  đảm an toàn hàng hải Việt Nam
                                </div>
                              </motion.section>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
  );

  const renderActiveWorkspace = () => {
    if (workspaceMode === "history") return renderHistoryMode();
    if (workspaceMode === "create") return renderCreateMode();
    if (workspaceMode === "review") return renderPlaceholderMode("review");
    if (workspaceMode === "summarize") return renderPlaceholderMode("summarize");
    if (workspaceMode === "sources") return renderSourcesMode();
    return renderEditMode();
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] gap-5">
      <aside className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 lg:p-5 h-fit lg:sticky lg:top-0 lg:max-h-[calc(100vh-112px)] overflow-y-auto custom-scrollbar">
        <div className="mb-4 px-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#002D56]">Trợ lý biên tập</p>
          <h2 className="mt-1 text-[15px] font-bold text-slate-900">Unified Workspace</h2>
        </div>
        <nav className="space-y-2" aria-label="Menu Trợ lý biên tập">
          {moduleMenuItems.map((item) => {
            const active = workspaceMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => switchWorkspaceMode(item.id)}
                className={cn(
                  "w-full min-h-[50px] rounded-xl border px-3 py-2.5 text-left transition-all flex items-center gap-3",
                  active
                    ? "border-[#002D56] bg-blue-50/80 text-[#002D56] shadow-sm"
                    : "border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-200",
                )}
              >
                <span className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", active ? "bg-[#002D56] text-white" : "bg-slate-100 text-slate-500")}>
                  <item.icon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold leading-tight">{item.title}</span>
                  <span className="block text-[12px] leading-snug text-slate-500 mt-0.5">{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 min-h-0 overflow-y-auto overscroll-contain pr-1 custom-scrollbar space-y-5">
        {renderWorkspaceHeader()}
        {renderActiveWorkspace()}
      </main>
    </div>
  );
};
