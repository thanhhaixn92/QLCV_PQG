import React from 'react';
import { getRenderKey } from '../../utils/listKeys';
import {
  ChevronDown, Files, Globe, Type, FileUp, Search, Loader2, Database,
  FileText, X, ShieldCheck, User, Calendar, FileDown, CheckCircle,
  Target, Target as Plus, Link as LinkIcon, Trash2, Edit3, Image as ImageIcon,
  Save, Sparkles, CheckSquare, Zap, Target as Crosshair, Clock, Check, Copy, History, AlertCircle, CheckCircle2
} from 'lucide-react';
import { EditorialKindSelector } from './EditorialKindSelector';
import { EditorialInputForm } from './EditorialInputForm';
import { EditorialPreflightPanel } from './EditorialPreflightPanel';
import { TaskType, OutputFormat } from '../../types';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TASK_CATEGORIES } from '../../types';
import { SlideOutlineGenerator } from './SlideOutlineGenerator';
import { SlideOutlineWorkspace } from './SlideOutlineWorkspace';
import { getEditorialTool } from '../../lib/editorialTools';
import { EditorialToolSelector } from './EditorialToolSelector';
import { ContentReviewDisplay } from './ContentReviewDisplay';
import { A4PrintPreview } from './A4PrintPreview';
import { createArticleDocumentFromCurrentContent } from '../../lib/publishing/articleDocumentAdapter';
import { validateArticleDocument } from '../../lib/publishing/validateArticleDocument';

export const EditorWorkspace = (props: any) => {
  const {
    selectedEditorialToolId, handleToolChange,
    setTaskType, user, selectedSourceDocIds, documents, setIsPickingFromLibrary, handleSaveSlideOutline, handleCreateTaskFromSlideOutline, safeParseSlideOutline, output, taskType, outputFormat, setOutputFormat, input, setSourceActiveTab, sourceActiveTab, searchQuery, setSearchQuery, handleWebSearch, isLoading, searchResults, getHostname, addSearchResultAsSource, newTextName, setNewTextName, newTextContent, setNewTextContent, saveToLibrary, setSaveToLibrary, handleAddText, newLinkUrl, setNewLinkUrl, handleAddLink, isParsing, fileInputRef, getDocTypeLabel, getSourceTypeLabel, toggleDocSelection, setInput, setOutput, setError, aiCooldownUntil, editorialKind, setEditorialKind, isBuildingTasks, handleBuildTasks, handleProcess, builtTasks, setBuiltTasks, saveBuiltTasks, persistTask, toast, error, outputRef, setIsEditing, isEditing, currentSessionId, sessions, handleCopy, copySuccess, saveCurrentToSession, handleLocalIllustrationScan, isPlanningImages, handleAIIllustrationSuggestions, setSelectingParagraphForImage, auditEditorialPublish, illustrations, requestConfirmAsync, logActivity, stripResolvedPlaceholders, removeBrokenMarkdownImages, imagePlans, approveAllValidIllustrations, clearErrorImages, handleManualUpload, approveIllustration, rejectIllustration, setIllustrations, contentReview, isPublishableIllustration, updateImageLoadStatus, insertApprovedIllustrationsForPlainExport
  } = props;

  const currentTool = getEditorialTool(selectedEditorialToolId);
  const articleDocument = React.useMemo(() => {
    const previewContent = insertApprovedIllustrationsForPlainExport(
      output || "",
      illustrations || [],
    );

    return createArticleDocumentFromCurrentContent(previewContent, {
      status: "draft",
      authorName: user?.displayName || user?.email || undefined,
    });
  }, [illustrations, insertApprovedIllustrationsForPlainExport, output, user?.displayName, user?.email]);

  const validateArticleBeforeExport = React.useCallback(async () => {
    const validation = validateArticleDocument(articleDocument);

    if (!validation.valid) {
      const message = validation.errors[0]?.message || "ArticleDocument chưa hợp lệ, không thể xuất file.";
      toast.error(message);
      setError(message);
      return false;
    }

    if (validation.warnings.length > 0) {
      toast("Bản thảo còn cảnh báo trước khi xuất bản chính thức.", { icon: "⚠️", duration: 4000 });
      return requestConfirmAsync("Bản thảo còn cảnh báo/cần bổ sung. Bạn vẫn muốn xuất file bản nháp?");
    }

    return true;
  }, [articleDocument, requestConfirmAsync, setError, toast]);

  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);
  const [exportingFormat, setExportingFormat] = React.useState<null | "pdf" | "docx">(null);
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

  return (
    <>
    {taskType === "SLIDE_OUTLINE" ? (
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
                          <section className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 sm:p-2.5 bg-[#002D56] rounded-md shadow-sm shadow-[#002D56]/10">
                                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                </div>
                                <div>
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
                              {currentTool?.taskType === "WRITE_NEW" ? (
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
                                    onChange={setInput}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  value={input}
                                  onChange={(e) => setInput(e.target.value)}
                                  placeholder={currentTool?.inputPlaceholder || "Nhập thông tin..."}
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
                                    isLoading ||
                                    isParsing ||
                                    isBuildingTasks ||
                                    cooldownRemaining > 0
                                  }
                                  onClick={
                                    currentTool?.taskType === "TASK_BUILDER"
                                      ? handleBuildTasks
                                      : handleProcess
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
                                      key={getRenderKey("editor-built-task", task, idx)}
                                      className={`bg-white p-6 rounded-md shadow-sm border transition-all relative ${task.selected ? "border-[#002D56] shadow-md ring-4 ring-[#002D56]/5" : "border-slate-200 shadow-slate-200/50"}`}
                                    >
                                      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={task.selected}
                                          onChange={() =>
                                            setBuiltTasks((prev) =>
                                              prev.map((t) =>
                                                (t.clientId || t.id) === (task.clientId || task.id)
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
                                                    (t.clientId || t.id) === (task.clientId || task.id)
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
                                                    (t.clientId || t.id) === (task.clientId || task.id)
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
                                          {currentTool?.resultLabel || "Sản phẩm đầu ra"}
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
                                    <EditorialPreflightPanel
                                      kind={editorialKind}
                                      markdownContent={output}
                                    />
                                  )}

                                  <div className="flex flex-wrap items-center gap-2 pb-1 -mx-1 px-1 overflow-visible">
                                    {currentTool?.allowImageTools && (
                                      <>
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
                                      </>
                                    )}

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

                                    <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0" />

                                    {(currentTool?.allowPdfExport !== false) && (
                                      <>
                                        <button
                                          onClick={async () => {
                                            if (exportingFormat) return;
                                            setExportingFormat("pdf");
                                            const audit = auditEditorialPublish(illustrations);
                                            if (audit.suggestedCount > 0) {
                                              const confirmed = await requestConfirmAsync(
                                                `Còn ${audit.suggestedCount} hình ảnh chưa được duyệt. Bạn có muốn tiếp tục xuất bản PDF mà không có các hình này?`,
                                              );
                                              if (!confirmed) {
                                                setExportingFormat(null);
                                                return;
                                              }
                                            }
                                            try {
                                              if (!(await validateArticleBeforeExport())) return;
                                              toast(
                                                "Đang tạo file PDF...",
                                                { icon: "ℹ️", duration: 5000 },
                                              );
                                              const { exportPrintablePdfFromElement } =
                                                await import("../../lib/printablePdfExport");
                                              await exportPrintablePdfFromElement(
                                                "printable-article", { 
                                                  title: `Bai_viet_HTMB_${Date.now()}`, 
                                                  profile: "article",
                                                  onValidationError: (msg) => {
                                                    toast(`Lỗi: ${msg}`, { icon: '❌', duration: 4000 });
                                                  },
                                                  onValidationWarning: (msg) => {
                                                    toast(`Cảnh báo: ${msg}`, { icon: '⚠️', duration: 3000 });
                                                  }
                                                }
                                              );
                                              toast.success("Tải PDF thành công!");

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
                                              toast.error(err?.message || "Không tạo được file PDF.");
                                              setError(err.message);
                                            } finally {
                                              setExportingFormat(null);
                                            }
                                          }}
                                          disabled={Boolean(exportingFormat)}
                                          className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/80 transition-all shrink-0 active:scale-[0.98] shadow-sm disabled:opacity-50"
                                          title="Xuất bản PDF chất lượng cao có thể tìm kiếm và chọn được văn bản"
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
                                          const audit = auditEditorialPublish(illustrations);
                                          if (audit.suggestedCount > 0) {
                                            const confirmed = await requestConfirmAsync(
                                              `Còn ${audit.suggestedCount} hình ảnh chưa được duyệt. Bạn có muốn tiếp tục xuất bản Word mà không có các hình này?`,
                                            );
                                            if (!confirmed) {
                                              setExportingFormat(null);
                                              return;
                                            }
                                          }
                                          try {
                                            if (!(await validateArticleBeforeExport())) return;
                                            const { exportWordFromElement } = await import("../../lib/exportUtils");
                                            await exportWordFromElement(
                                              "printable-article",
                                              {
                                                title:
                                                  sessions.find(
                                                    (s) => s.id === currentSessionId,
                                                  )?.title ||
                                                  input ||
                                                  "Bài viết",
                                                filename: `Bai_viet_HTMB_${Date.now()}`,
                                                kind: editorialKind,
                                              },
                                            );

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
                                            toast.error(err?.message || "Không tạo được file Word.");
                                            setError(err.message);
                                          } finally {
                                            setExportingFormat(null);
                                          }
                                        }}
                                        disabled={Boolean(exportingFormat)}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100/80 transition-all shrink-0 active:scale-[0.98] shadow-sm disabled:opacity-50"
                                        title="Xuất Word (DOCX)"
                                      >
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                          Word (DOCX)
                                        </span>
                                      </button>
                                    )}
                                  </>
                                )}
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

                                <div className="p-4 sm:p-6 md:p-10 bg-[#FCFDFF] printable-article-shell">
                                  {contentReview && (
                                    <div data-export-exclude="true">
                                      <ContentReviewDisplay
                                        review={contentReview}
                                      />
                                    </div>
                                  )}

                                  {isEditing ? (
                                    <div className="prose prose-slate max-w-none prose-headings:text-[#002D56] prose-headings:font-semibold prose-p:text-slate-700 prose-p:text-lg prose-p:leading-relaxed prose-li:text-slate-600 font-serif">
                                      <textarea
                                        value={output}
                                        onChange={(e) =>
                                          setOutput(e.target.value)
                                        }
                                        className="w-full h-[600px] p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-lg leading-relaxed font-serif focus:outline-none focus:border-[#002D56] transition-all"
                                      />
                                    </div>
                                  ) : (
                                    <A4PrintPreview document={articleDocument} rootId="printable-article" />
                                  )}
                                </div>

                                {/* Versions Quick Access */}
                                {currentSessionId &&
                                  sessions.find(
                                    (s) => s.id === currentSessionId,
                                  )?.versions?.length! > 1 && (
                                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
                                      <span className="text-[10px] font-semibold text-slate-400 tracking-normal mr-2">
                                        Lịch sử bài viết:
                                      </span>
                                      {sessions
                                        .find((s) => s.id === currentSessionId)
                                        ?.versions?.map((v, i) => (
                                          <button
                                            key={`ver-${v.id || i}`}
                                            onClick={() => {
                                              setOutput(v.content);
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
                                              v.createdAt,
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
                    )}
    </>
  );
};
