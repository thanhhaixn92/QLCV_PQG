import React from "react";
import { getRenderKey } from "../../utils/listKeys";
import { cn } from "../../lib/utils";
import { WorkTask } from "../../types";
import { getCategoryLabel, TASK_PRIORITY_LABELS, isTaskOverdue, isTaskUpcoming } from "./TaskHelpers";
import { CalendarClock, FileText } from "lucide-react";
import { FEATURE_FLAGS } from "../../config/featureFlags";

export const TaskBoardView = ({ tasks, documents, openTaskEditor }: any) => {
  const columns = [
    { title: "Cần làm", status: "todo", color: "border-slate-200 bg-slate-50/70", headerColor: "text-slate-700" },
    { title: "Đang xử lý", status: "doing", color: "border-blue-100 bg-blue-50/50", headerColor: "text-blue-700" },
    { title: "Chờ phản hồi", status: "waiting", color: "border-amber-100 bg-amber-50/50", headerColor: "text-amber-700" },
    { title: "Hoàn thành", status: "done", color: "border-emerald-100 bg-emerald-50/50", headerColor: "text-emerald-700" },
    { title: "Lưu trữ", status: "archived", color: "border-slate-200 bg-slate-100/70", headerColor: "text-slate-600" },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-[calc(7rem+env(safe-area-inset-bottom))] hide-scrollbar snap-x h-[calc(100vh-280px)] min-h-[500px] items-stretch">
      {columns.map((col) => {
        const columnTasks = tasks.filter((t: any) => {
          if (col.status === "todo") return t.status === "todo" || t.status === "pending";
          if (col.status === "doing") return t.status === "doing" || t.status === "in_progress";
          if (col.status === "waiting") return t.status === "waiting" || t.status === "review";
          if (col.status === "done") return t.status === "done" || t.status === "completed";
          if (col.status === "archived") return t.status === "archived";
          return false;
        });

        return (
          <div key={`kanban-column-${col.status}`} className={cn("flex-none w-[320px] rounded-xl border p-2.5 flex flex-col snap-center", col.color)}>
            <div className="flex items-center justify-between mb-3 px-1.5 shrink-0">
              <h3 className={cn("font-bold text-sm tracking-tight", col.headerColor)}>{col.title}</h3>
              <span className="bg-white/80 shadow-sm text-slate-500 text-xs font-bold px-2 py-0.5 rounded-md">
                {columnTasks.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1 pb-2">
              {columnTasks.map((t: any, index: number) => {
                const isCompleted = col.status === "done";
                const overdue = isTaskOverdue(t);

                return (
                  <div
                    key={getRenderKey("task-board", t, index)}
                    className={cn(
                      "bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col",
                      isCompleted && "opacity-75"
                    )}
                    onClick={() => openTaskEditor(t)}
                  >
                    <div className="flex items-center justify-between mb-2 gap-2">
                       <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit",
                          t.priority === "urgent" ? "bg-red-50 text-red-600 border border-red-100" :
                          t.priority === "high" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                          t.priority === "medium" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                          "bg-slate-100 text-slate-500 border border-slate-200"
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            t.priority === "urgent" ? "bg-red-500" :
                            t.priority === "high" ? "bg-orange-500" :
                            t.priority === "medium" ? "bg-blue-500" :
                            "bg-slate-400"
                          )} />
                          {TASK_PRIORITY_LABELS[t.priority] || "Trung bình"}
                        </span>
                        
                        {t.categoryCode && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            {getCategoryLabel(t.categoryCode)}
                          </span>
                        )}
                    </div>
                    
                    <h4 className="text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-3">
                      {t.title}
                    </h4>
                    
                    {t.description ? (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
                        {t.description}
                      </p>
                    ) : (
                      <div className="mb-3" />
                    )}
                    
                    <div className="mt-auto pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 max-w-[50%]">
                        <div className="w-5 h-5 shrink-0 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">
                          {t.assignee?.slice(0, 2).toUpperCase() || "??"}
                        </div>
                        <span className="text-[10px] font-medium text-slate-600 truncate">
                          {t.assignee || "Chưa giao"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {t.linkedDocumentIds && t.linkedDocumentIds.length > 0 && (
                          <span className="flex items-center text-[10px] text-slate-400" title={`${t.linkedDocumentIds.length} tài liệu đính kèm`}>
                            <FileText className="w-3 h-3 mr-0.5" />
                            {t.linkedDocumentIds.length}
                          </span>
                        )}

                        {t.dueDate && (
                          <span className={cn(
                            "flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            !isCompleted && overdue ? "text-red-600 bg-red-50 border border-red-100" : "text-slate-500 bg-slate-50 border border-slate-100"
                          )}>
                            <CalendarClock className="w-3 h-3 mr-1" />
                            {new Date(t.dueDate).toLocaleDateString("vi-VN", { month: "2-digit", day: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
