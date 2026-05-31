import React from "react";
import { getRenderKey } from "../../utils/listKeys";
import { cn } from "../../lib/utils";
import { MoreHorizontal, AlertCircle, CalendarClock, PlayCircle, CheckCircle2, Circle, Clock } from "lucide-react";
import { NoTasksMessage, TASK_STATUS_LABELS, getCategoryLabel, TASK_PRIORITY_LABELS, isTaskOverdue, isTaskUpcoming } from "./TaskHelpers";
import { WorkTask } from "../../types";

const getAvatarLetter = (name?: string) => {
  if (!name) return "?";
  const clean = name.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  if (parts.length > 1) {
    const first = parts[0][0];
    const last = parts[parts.length - 1][0];
    return (first + last).toUpperCase();
  }
  return clean[0].toUpperCase();
};

export const TaskListView = ({
  tasks,
  documents,
  openTaskEditor,
  updateTaskStatus,
  handleDeleteTask,
  setTaskFilters
}: {
  tasks: WorkTask[];
  documents: any[];
  openTaskEditor: (t: WorkTask | null) => void;
  updateTaskStatus: (id: string, status: any) => void;
  handleDeleteTask: (id: string) => void;
  setTaskFilters: React.Dispatch<React.SetStateAction<any>>;
}) => {
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const closeDropdown = () => setOpenDropdownId(null);
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-2xl border border-slate-200 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {tasks.length === 0 ? (
        <NoTasksMessage setTaskFilters={setTaskFilters} openTaskEditor={openTaskEditor} />
      ) : (
        <div className="flex flex-col p-2 space-y-1.5">
          {tasks.map((t: any, index: number) => {
            const isCompleted = t.status === "done" || t.status === "completed" || t.status === "archived";

            // Status Icon mapping
            let StatusIcon = Circle;
            let statusIconColor = "text-slate-300";
            if (isCompleted) {
              StatusIcon = CheckCircle2;
              statusIconColor = "text-emerald-500 fill-emerald-50";
            } else if (t.status === "doing" || t.status === "in_progress") {
              StatusIcon = PlayCircle;
              statusIconColor = "text-blue-500 fill-blue-50";
            } else if (t.status === "review" || t.status === "waiting") {
              StatusIcon = Clock;
              statusIconColor = "text-amber-500 fill-amber-50";
            } else if (t.status === "blocked") {
              StatusIcon = AlertCircle;
              statusIconColor = "text-red-500 fill-red-50";
            }

            return (
              <div
                key={getRenderKey("task-list", t, index)}
                className={cn(
                  "group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex gap-3 relative",
                  isCompleted && "opacity-75"
                )}
                onClick={() => openTaskEditor(t)}
              >
                {/* Left: Status Icon */}
                <div className="pt-0.5 shrink-0">
                  <StatusIcon className={cn("w-5 h-5", statusIconColor)} />
                </div>

                {/* Right: Content */}
                <div className="flex-1 min-w-0 pr-8">
                  {/* Row 1: Title and Actions */}
                  <div className="flex items-start justify-between gap-4 mb-1.5">
                    <h3 className="text-[15px] font-semibold text-slate-800 leading-snug truncate">
                      {t.title}
                    </h3>
                  </div>

                  {/* Row 2: Description */}
                  <div className="mb-2">
                    {t.description ? (
                      <p className="text-[13px] text-slate-500 line-clamp-1 leading-relaxed">
                        {t.description}
                      </p>
                    ) : null}
                  </div>

                  {/* Row 3: Metadata */}
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                    {t.categoryCode && (
                      <span className="font-medium text-slate-600">
                        {getCategoryLabel(t.categoryCode)}
                      </span>
                    )}

                    <span className="text-slate-300">&bull;</span>

                    <span className={cn(
                      "font-medium",
                      t.priority === "urgent" ? "text-red-600" :
                      t.priority === "high" ? "text-orange-600" :
                      t.priority === "medium" ? "text-blue-600" : "text-slate-600"
                    )}>
                      {TASK_PRIORITY_LABELS[t.priority] || "Trung bình"}
                    </span>

                    {t.dueDate && (
                      <>
                        <span className="text-slate-300">&bull;</span>
                        <span className={cn(
                          "flex items-center gap-1 font-medium",
                          !isCompleted && isTaskOverdue(t) ? "text-red-600" : ""
                        )}>
                          Hạn: {new Date(t.dueDate).toLocaleDateString("vi-VN")}
                        </span>
                      </>
                    )}

                    <span className="text-slate-300">&bull;</span>

                    <div className="flex items-center gap-1.5 bg-slate-100/90 text-slate-700 px-2 py-0.5 rounded-full select-none text-[11px] font-semibold w-fit border border-slate-200/50">
                      <div className="w-4 h-4 rounded-full bg-blue-600 font-bold text-white flex items-center justify-center text-[9px] shrink-0 uppercase tracking-tight">
                        {getAvatarLetter(t.assignee)}
                      </div>
                      <span>{t.assignee || "Chưa giao"}</span>
                    </div>

                    {t.updatedAt && (
                      <>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-[11px] text-slate-400">
                          Cập nhật: {new Date(t.updatedAt).toLocaleDateString("vi-VN")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center justify-center",
                    (t.status === "done" || t.status === "completed") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    (t.status === "doing" || t.status === "in_progress") ? "bg-blue-50 text-blue-700 border border-blue-200" :
                    t.status === "blocked" ? "bg-red-50 text-red-700 border border-red-200" :
                    (t.status === "review" || t.status === "waiting") ? "bg-amber-50 text-amber-700 border border-amber-200" :
                    t.status === "archived" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                    "bg-slate-100 text-slate-700 border border-slate-300"
                  )}>
                    {TASK_STATUS_LABELS[t.status] || TASK_STATUS_LABELS["todo"]}
                  </span>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === t.id ? null : t.id);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {openDropdownId === t.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setOpenDropdownId(null);
                            openTaskEditor(t);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Sửa công việc
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm("Bạn có chắc chắn muốn xóa công việc này?")) {
                              handleDeleteTask(t.id);
                              setOpenDropdownId(null);
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
