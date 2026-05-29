import React from "react";
import { ListTodo, AlertCircle, Clock, CheckCircle2, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

export const TaskStatsCompact = ({ stats, filters, setFilters }: any) => {
  return (
    <div className="flex overflow-x-auto gap-4 hide-scrollbar snap-x pb-2">
      {[
        {
          label: "Tổng việc",
          value: stats.total,
          icon: ListTodo,
          color: "text-slate-700",
          bg: "bg-slate-100",
          status: "all"
        },
        {
          label: "Quá hạn",
          value: stats.overdue,
          icon: AlertCircle,
          color: "text-red-700",
          bg: "bg-red-50",
          status: "overdue"
        },
        {
          label: "Cần làm",
          value: stats.todo,
          icon: Clock,
          color: "text-blue-700",
          bg: "bg-blue-50",
          status: "todo"
        },
        {
          label: "Đang xử lý",
          value: stats.doing,
          icon: Settings,
          color: "text-amber-700",
          bg: "bg-amber-50",
          status: "doing"
        },
        {
          label: "Hoàn thành",
          value: stats.done,
          icon: CheckCircle2,
          color: "text-emerald-700",
          bg: "bg-emerald-50",
          status: "done"
        },
      ].map((stat) => (
        <div
          key={`task-stat-${stat.status}`}
          className={cn(
            "min-w-[150px] flex-1 bg-white p-3.5 rounded-xl border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:shadow-md group snap-start shrink-0",
            filters.status === stat.status ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200 hover:border-slate-300"
          )}
          onClick={() => setFilters({ ...filters, status: stat.status })}
        >
          <div>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-0.5">
              {stat.label}
            </p>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {stat.value}
            </h3>
          </div>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
            <stat.icon className="w-4 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
};
