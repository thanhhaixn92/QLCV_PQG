import React from 'react';
import { History, Search, Plus, Clock, Files, Edit3, Trash2 } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { getRenderKey } from '../../utils/listKeys';
import { deriveEditorialSessionTitle } from '../library/LibraryHelpers';

export const HistoryWorkspace = (props: any) => {
  const {
    historySearchQuery, setHistorySearchQuery, createNewSession, sessions,
    cleanDisplayTitle, loadSession, requestConfirmAsync, user, setSessions, logActivity
  } = props;

  const getSessionTitle = React.useCallback((session: any) => {
    const derived = deriveEditorialSessionTitle({
      output: session?.currentOutput || session?.versions?.[0]?.content,
      currentTitle: session?.title,
      latestPreview: session?.latestPreview,
      input: session?.input,
    });
    return typeof cleanDisplayTitle === "function" ? cleanDisplayTitle(derived) : derived;
  }, [cleanDisplayTitle]);

  const filteredSessions = React.useMemo(() => {
    const query = (historySearchQuery || "").toLowerCase();
    return (sessions || []).filter((session: any) => {
      if (!query) return true;
      return (
        getSessionTitle(session).toLowerCase().includes(query) ||
        session.versions?.[0]?.content?.toLowerCase().includes(query) ||
        session.currentOutput?.toLowerCase().includes(query) ||
        session.latestPreview?.toLowerCase().includes(query)
      );
    });
  }, [getSessionTitle, historySearchQuery, sessions]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white px-6 sm:px-8 py-5 sm:py-6 rounded-md lg:rounded-lg border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="bg-[#002D56] p-2.5 sm:p-3 rounded-md lg:rounded-lg shadow-sm shrink-0">
            <History className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 tracking-tight truncate">
              Lịch sử văn bản
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
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-md text-xs font-semibold focus:ring-2 focus:ring-[#002D56]/20 transition-all"
            />
          </div>
          <button
            onClick={createNewSession}
            className="w-full sm:w-auto bg-[#002D56] text-white px-6 py-3 rounded-md font-semibold text-xs tracking-normal hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#002D56]/20 shrink-0"
          >
            <Plus className="w-4 h-4" /> Tạo văn bản mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredSessions.length === 0 ? (
          <div className="col-span-full py-20 sm:py-32 flex flex-col items-center justify-center bg-white rounded-md lg:rounded-lg border border-dashed border-slate-200">
            <Clock className="w-16 h-16 sm:w-20 sm:h-20 text-slate-200 mb-4 sm:mb-6" />
            <p className="text-slate-400 font-semibold tracking-normal text-xs">
              Không tìm thấy bài viết
            </p>
          </div>
        ) : (
          filteredSessions.map((session: any, idx: number) => (
              <div
                key={getRenderKey("session", session, idx)}
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
                      {session.taskType === "WRITE_NEW" ? "Viết mới" : "Rà soát"}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString("vi-VN") : "---"}
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-[#002D56] transition-colors mb-4 flex-1">
                  {getSessionTitle(session)}
                </h3>

                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <History className="w-3.5 h-3.5" /> {session.versions?.length ? `${session.versions.length} phiên bản` : "Đã lưu phiên bản"}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                    <Files className="w-3.5 h-3.5" /> {(session.documentIds || []).length} nguồn
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => loadSession(session)}
                    className="flex-1 bg-white text-[#002D56] border border-[#002D56] py-2 rounded-md text-[12px] font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Mở biên tập
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const confirmed = await requestConfirmAsync(
                        "Bạn có chắc chắn muốn xóa bài viết này cùng toàn bộ lịch sử?",
                      );
                      if (confirmed) {
                        if (user) {
                          try {
                            await deleteDoc(
                              doc(db, "users", user.uid, "sessions", session.id),
                            );
                            setSessions((prev: any) =>
                              prev.filter((s: any) => s.id !== session.id),
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
                            console.error("Delete session error:", err);
                            toast.error("Không thể xóa bài viết trên hệ thống.");
                          }
                        } else {
                          setSessions((prev: any) =>
                            prev.filter((s: any) => s.id !== session.id),
                          );
                        }
                      }
                    }}
                    className="px-3 py-2.5 rounded-md text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100"
                    title="Xóa bài viết"
                    aria-label="Xóa bài viết"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};
