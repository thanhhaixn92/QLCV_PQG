import React, { useEffect, useState } from "react";
import { FEATURE_FLAGS } from "../../config/featureFlags";
import { 
  ListTodo, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Settings, 
  Plus, 
  Search,
  Sparkles,
  LayoutList,
  KanbanSquare
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { WorkTask } from "../../types";
import { Proposal } from "../../features/proposals/types";
import { TaskStatsCompact } from "./TaskStatsCompact";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskListView } from "./TaskListView";
import { TaskBoardView } from "./TaskBoardView";

interface TasksTabWorkspaceProps {
  taskStats: any;
  filteredTasks: WorkTask[];
  taskFilters: any;
  setTaskFilters: (f: any) => void;
  openTaskEditor: (task: WorkTask | null) => void;
  handleDeleteTask: (id: string) => void;
  updateTaskStatus: (id: string, newStatus: any) => void;
  documents: any[];
  proposals: Proposal[];
  user: any;
  setIsAiCreateModalOpen?: (v: boolean) => void;
}

export const TasksTabWorkspace = ({
  taskStats,
  filteredTasks,
  taskFilters,
  setTaskFilters,
  openTaskEditor,
  handleDeleteTask,
  updateTaskStatus,
  documents,
  user,
  setIsAiCreateModalOpen
}: TasksTabWorkspaceProps) => {
  const taskUiStorageKey = user?.uid
    ? `vms:workspace:ui:${user.uid}:tasks`
    : null;
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [viewModeRestored, setViewModeRestored] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");

  useEffect(() => {
    setViewModeRestored(false);
    if (!taskUiStorageKey) {
      setViewModeRestored(true);
      return;
    }
    try {
      const saved = localStorage.getItem(taskUiStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.viewMode === "list" || parsed?.viewMode === "board") {
          setViewMode(parsed.viewMode);
        }
      }
    } catch {
      // Ignore malformed local UI state.
    } finally {
      setViewModeRestored(true);
    }
  }, [taskUiStorageKey]);

  useEffect(() => {
    if (!taskUiStorageKey || !viewModeRestored) return;
    try {
      const previous = localStorage.getItem(taskUiStorageKey);
      const parsed = previous ? JSON.parse(previous) : {};
      localStorage.setItem(
        taskUiStorageKey,
        JSON.stringify({ ...parsed, viewMode, updatedAt: Date.now() }),
      );
    } catch {
      // Ignore local storage quota or malformed state errors.
    }
  }, [taskUiStorageKey, viewModeRestored, viewMode]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBoardSearch(val);
    setTaskFilters({ ...taskFilters, search: val });
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-800">Quản lý công việc</h2>
          <p className="text-sm text-slate-500 mt-1">Theo dõi, phân công và xử lý các nhiệm vụ nghiệp vụ hằng ngày.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm công việc..."
              value={boardSearch}
              onChange={handleSearch}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <button 
              onClick={() => setIsAiCreateModalOpen && setIsAiCreateModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border border-purple-200 hover:border-purple-300 hover:bg-purple-100 rounded-lg text-sm font-semibold transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              AI tách việc
            </button>
            <button 
              onClick={() => openTaskEditor(null)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#002D56] text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              Thêm việc
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <TaskStatsCompact stats={taskStats} filters={taskFilters} setFilters={setTaskFilters} />

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex overflow-x-auto hide-scrollbar">
          <TaskFilterBar filters={taskFilters} setFilters={setTaskFilters} />
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 w-fit self-end sm:self-auto">
          <button
            key="task-view-mode-list"
            onClick={() => setViewMode("list")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all",
              viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <LayoutList className="w-4 h-4" /> Danh sách
          </button>
          <button
            key="task-view-mode-board"
            onClick={() => setViewMode("board")}
            className={cn(
              "px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all",
              viewMode === "board" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <KanbanSquare className="w-4 h-4" /> Bảng
          </button>
        </div>
      </div>

      {/* Content View */}
      {viewMode === "list" ? (
        <TaskListView 
          tasks={filteredTasks} 
          documents={documents}
          openTaskEditor={openTaskEditor}
          updateTaskStatus={updateTaskStatus}
          handleDeleteTask={handleDeleteTask}
        />
      ) : (
        <TaskBoardView 
          tasks={filteredTasks}
          documents={documents}
          openTaskEditor={openTaskEditor}
          updateTaskStatus={updateTaskStatus}
        />
      )}
    </div>
  );
};

