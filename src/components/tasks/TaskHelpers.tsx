import { FileText, ListTodo, Trash2 } from "lucide-react";
import { FEATURE_FLAGS } from "../../config/featureFlags";
import { cn } from "../../lib/utils";
import { WorkTask, TASK_CATEGORIES } from "../../types";

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Cần làm",
  todo: "Cần làm",
  doing: "Đang xử lý",
  in_progress: "Đang xử lý",
  review: "Chờ phản hồi",
  waiting: "Chờ phản hồi",
  done: "Hoàn thành",
  completed: "Hoàn thành",
  blocked: "Vướng mắc",
  archived: "Lưu trữ"
};

export const CATEGORY_LABELS: Record<string, string> = {
  LV_DH: "Điều hành",
  LV_AT: "An toàn",
  LV_KT: "Kỹ thuật",
  LV_TC: "Tài chính",
  LV_TCCB: "Tổ chức - Lao động",
  LV_VPDT: "Văn phòng điện tử",
  LV_KHDN: "Kế hoạch - Kinh doanh",
  LV_PCTTra: "Pháp chế - Thanh tra",
};

export const getCategoryLabel = (code: string) => {
  return CATEGORY_LABELS[code] || "Khác";
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

export const HIGH_PRIORITY_FILTER = "high_urgent";

export function getCategoryName(code: string) {
  const cat = TASK_CATEGORIES.find((c) => c.code === code);
  return cat ? cat.name : code;
}

export const localizeTaskForAI = (t: WorkTask) => ({
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

export function getTaskDueEndTime(dueDate: string | undefined): number | null {
  if (!dueDate) return null;
  try {
    const date = new Date(dueDate);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  } catch (e) {
    return null;
  }
}

export function isTaskOverdue(task: WorkTask): boolean {
  if (task.status === "done" || task.status === "completed" || task.status === "archived") return false;
  const endTime = getTaskDueEndTime(task.dueDate);
  return !!(endTime && endTime < Date.now());
}

export function isTaskUpcoming(task: WorkTask, days: number = 3): boolean {
  if (task.status === "done" || task.status === "completed" || task.status === "archived" || isTaskOverdue(task)) return false;
  const endTime = getTaskDueEndTime(task.dueDate);
  if (!endTime) return false;
  const now = Date.now();
  return endTime > now && endTime < now + days * 24 * 60 * 60 * 1000;
}

// --- TASK HELPER COMPONENTS ---

export function NoTasksMessage({
  setTaskFilters,
  openTaskEditor
}: {
  setTaskFilters: (f: any) => void;
  openTaskEditor?: (t: any) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 py-10 w-full bg-slate-50/50 rounded-xl">
      <div className="p-4 bg-white rounded-full shadow-sm border border-slate-100">
        <ListTodo className="w-8 h-8 text-slate-300" />
      </div>
      <div className="text-center">
        <h3 className="text-slate-600 font-bold text-sm mb-1">
          Không có công việc phù hợp
        </h3>
        <p className="text-slate-400 text-xs mb-4">
          Thử đổi bộ lọc hoặc tạo công việc mới.
        </p>
        <div className="flex items-center gap-3 justify-center">
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
            className="text-slate-600 font-semibold text-xs px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            Bỏ lọc
          </button>
          
          {openTaskEditor && (
            <button
              onClick={() => openTaskEditor(null)}
              className="text-white font-semibold text-xs px-4 py-2 bg-[#002D56] hover:bg-blue-900 border border-[#002D56] rounded-lg transition-colors"
            >
              + Thêm việc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskTitleCell({ task, documents }: { task: any; documents: any[] }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-sm font-bold text-slate-800 mb-1 leading-tight line-clamp-2">
        {task.title}
      </span>
      <div className="flex flex-col gap-1.5">
        {task.proposalId && FEATURE_FLAGS.PROPOSAL_MODULE && (
          <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase border border-blue-100 mb-1 w-fit">
            Đề án liên kết
          </div>
        )}
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

export function TaskAssigneeCell({ task }: { task: any }) {
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

export function TaskPriorityCell({ task }: { task: any }) {
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

export function TaskStatusCell({
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
          "px-3 py-1.5 rounded-md text-[10px] uppercase font-bold tracking-wide border-2 transition-all cursor-pointer outline-none focus:ring-2 disabled:opacity-50",
          (task.status === "done" || task.status === "completed")
            ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300"
            : (task.status === "doing" || task.status === "in_progress")
              ? "bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300"
              : task.status === "blocked"
                ? "bg-red-50 border-red-200 text-red-700 hover:border-red-300"
                : (task.status === "review" || task.status === "waiting")
                  ? "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-300"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="todo">Cần làm</option>
        <option value="doing">Đang làm</option>
        <option value="waiting">Phản hồi</option>
        <option value="done">Xong</option>
        <option value="blocked">Vướng</option>
        <option value="archived">Lưu trữ</option>
      </select>
    </div>
  );
}

export function TaskActionsCell({
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
