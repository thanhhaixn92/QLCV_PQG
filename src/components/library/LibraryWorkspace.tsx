import React from 'react';
import { getRenderKey } from '../../utils/listKeys';
import { 
  Layers, Plus, User, Briefcase, Edit3, Users, Database, BookOpen, Trash2, 
  Search, ExternalLink, Clock, Folder, CheckSquare, Eye, FileText, Image as ImageIcon,
  MoreVertical, Share2, Activity, Link as LinkIcon, RefreshCw, Zap, Type, FileUp, Loader2, CheckCircle2, AlertTriangle, AlertCircle, X, MoreHorizontal, Sparkles, Archive, Check, HardDrive, EyeOff, ShieldCheck, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { DocumentSource, TASK_CATEGORIES } from '../../types';

export const LibraryWorkspace = (props: any) => {
  const { 
    closeMobileDrawer, setIsAddingLibrary, libraryCollections, setActiveLibraryId, activeLibraryId, documents, setEditingCollection, requestConfirmAsync, deleteLibraryCollection, librarySearchQuery, setLibrarySearchQuery, bulkSelectedDocIds, deleteSelectedDocuments, repairLegacyDriveLinks, setIsAddingText, setIsAddingLink, fileInputRef, libraryFilters, setLibraryFilters, DOCUMENT_KIND_LABELS, toast, apiFetchJson, getChatAuthToken, backgroundTasks, setBackgroundTasks, filteredDocs, getDocTypeLabel, setBulkSelectedDocIds, setDocumentMenuDocId, documentMenuDocId, handleAnalyzeDocument, isAnalyzing, getDocumentOpenUrl, handleSyncDriveFolder, isSyncingDrive, setEditingDocument, setDocEditForm, setIsEditingDocModalOpen, archiveDocument, removeDocument, formatLibraryDate, openDocumentPreview, setIsPickingTaskForDoc
  } = props;

  return (
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
                            {libraryCollections.map((coll, idx) => (
                              <div
                                key={getRenderKey("lib-coll", coll, idx)}
                                role="button"
                                tabIndex={0}
                                onClick={() => setActiveLibraryId(coll.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setActiveLibraryId(coll.id);
                                  }
                                }}
                                className={cn(
                                  "flex shrink-0 items-center justify-between px-3.5 py-2.5 lg:py-3 rounded-md transition-all group border cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
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
                              </div>
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
                                  title="Chuyển đổi các link Drive cũ sang định dạng chuẩn" aria-label="Chuyển đổi các link Drive cũ sang định dạng chuẩn"
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
                                    <option key={`lib-filter-kind-${k}`} value={k}>
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
                            {backgroundTasks.map((task, taskIdx) => (
                              <div
                                key={getRenderKey("lib-task", task, taskIdx)}
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
                            filteredDocs.map((doc, idx) => {
                              const kind = doc.type === 'drive' ? (doc.driveMimeType?.includes('folder') ? 'drive_folder' : 'drive_file') : (doc.temporary ? 'temp' : 'document');
                              return (
                                <motion.div
                                  layout
                                  key={getRenderKey("lib-doc", doc, idx)}
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
                                          {doc.syncStatus === 'missing' && (
                                            <div className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md text-[10px] font-bold border border-red-100 flex items-center gap-1">
                                              <AlertCircle className="w-3 h-3" />
                                              Đã mất / Bị xoá
                                            </div>
                                          )}
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
                            );
                          })
                        )}
                        </div>
                      </main>
                    </div>
  );
};
