import React from "react";
import { cn } from "../../lib/utils";
import { HIGH_PRIORITY_FILTER } from "./TaskHelpers";

export const TaskFilterBar = ({ filters, setFilters }: any) => {
  const toggleFilter = (key: string, val: string) => {
    setFilters({ ...filters, [key]: filters[key] === val ? "all" : val });
  };

  const chips = [
    { label: "Tất cả", key: "status", value: "all" },
    { label: "Của tôi", key: "status", value: "mytasks" },
    { label: "Hôm nay", key: "status", value: "today" },
    { label: "Tuần này", key: "status", value: "thisweek" },
    { label: "Quá hạn", key: "status", value: "overdue", alert: true },
    { label: "Ưu tiên cao", key: "priority", value: HIGH_PRIORITY_FILTER, alert: true },
    { label: "Đang xử lý", key: "status", value: "doing" },
    { label: "Chờ phản hồi", key: "status", value: "waiting" },
    { label: "Hoàn thành", key: "status", value: "done" },
    { label: "Lưu trữ", key: "status", value: "archived" }
  ];

  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 sm:pb-0 shrink-0 max-w-full">
      {chips.map((chip, idx) => {
        const isActive = filters[chip.key] === chip.value;
        return (
          <button
            key={`task-filter-${chip.key}-${chip.value}`}
            onClick={() => {
              if (chip.value === "all") {
                setFilters({ ...filters, status: "all", priority: "all" });
              } else {
                toggleFilter(chip.key, chip.value);
              }
            }}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
              isActive 
                ? (chip.alert ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200") 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  );
};
