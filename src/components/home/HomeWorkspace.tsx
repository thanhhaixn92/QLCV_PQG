import React from 'react';
import { getRenderKey } from "../../utils/listKeys";
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Database, Bot, HardDrive, ShieldCheck, PieChart, Play,
  FolderLock, RefreshCw, Layers, Edit3, ClipboardList, PenTool, BarChart3, Search, Image, ArrowRight, CheckSquare, FileText, Library, CheckCircle2, Clock, Plus
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TaskType, OutputFormat, WritingStyle } from '../../types';

export const HomeWorkspace = (props: any) => {
  const {
    user, profile, health, isAiCoreActive, getGreeting, getUserDisplayName,
    documents, allTasks, createNewSession,
    setActiveTab, openCreateTask, openAiTaskBuilder,
    setEditingTask, setActiveModal
  } = props;

  const systemStatus = [
    {
      label: "Cloud Firestore",
      active: health?.firestoreReady,
      icon: Database,
      code: "firestore"
    },
    {
      label: "Hoa Tiêu AI Core",
      active: isAiCoreActive,
      icon: Bot,
      code: "ai_core"
    },
    {
      label: "Workspace Drive",
      active: health?.hasGoogleDriveKey,
      icon: "DriveIcon",
      code: "drive"
    },
    {
      label: "Bảo mật dữ liệu",
      active: health?.hasEncryptionSecret,
      icon: ShieldCheck,
      code: "encryption"
    },
  ];

  const dashboards = [
    {
      id: "tasks",
      label: "Công việc",
      icon: CheckSquare,
      desc: "Quản lý nhiệm vụ, checklist, tiến độ",
      color: "text-emerald-500",
      bg: "bg-emerald-50",
      value: `${allTasks.length}`,
    },
    {
      id: "editor",
      label: "Biên tập",
      icon: Edit3,
      desc: "Soạn thảo bài viết, tài liệu AI",
      color: "text-blue-500",
      bg: "bg-blue-50",
      value: "AI",
    },
    {
      id: "library",
      label: "Kho tư liệu",
      icon: Library,
      desc: "Kho dữ liệu mẫu, văn bản, hướng dẫn",
      color: "text-orange-500",
      bg: "bg-orange-50",
      value: `${documents.length}`,
    },
  ];

  return (
    <>
      <div className="space-y-8 pb-10 relative">
        {/* Background Decorative Blob */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#002D56] text-white text-[10px] font-bold uppercase tracking-wider mb-4">
              <Zap className="w-3 h-3 text-yellow-400" /> Hệ thống
              đang vận hành tốt
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight mb-2 leading-[1.1]">
              {getGreeting()},{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                {getUserDisplayName(user, profile)
                  .split(" ")
                  .pop()}
                !
              </span>
            </h2>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-tight">
              Cùng kiến tạo những nội dung nghiệp vụ xuất sắc hôm
              nay.
            </p>
          </motion.div>
        </div>

        {/* System Status Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {systemStatus.map((sys: any) => {
            const IconComp =
              sys.icon === "DriveIcon"
                ? HardDrive
                : (sys.icon as any);
            return (
              <div
                key={`home-sys-${sys.code}`}
                className={cn(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between h-32 relative overflow-hidden",
                  sys.active
                    ? "bg-white border-slate-200 shadow-sm"
                    : "bg-slate-50/80 border-slate-100",
                )}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div
                    className={cn(
                      "p-2 rounded-xl",
                      sys.active
                        ? "bg-slate-50 text-[#002D56]"
                        : "bg-white text-slate-300",
                    )}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full shadow-sm",
                      sys.active
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-slate-300",
                    )}
                  />
                </div>
                <div className="relative z-10">
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      sys.active
                        ? "text-slate-800"
                        : "text-slate-400",
                    )}
                  >
                    {sys.label}
                  </p>
                  <p
                    className={cn(
                      "text-[9px] font-medium leading-none mt-1",
                      sys.active
                        ? "text-emerald-600"
                        : "text-slate-400",
                    )}
                  >
                    {sys.active ? "Sẵn sàng" : "Chưa kích hoạt"}
                  </p>
                </div>
                {!sys.active && (
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Navigation - Large Bento Grid */}
        <div className="mt-12 mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Bảng điều khiển
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Truy cập nhanh các phân hệ nghiệp vụ chính
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dashboards.map((stat: any) => (
            <motion.button
              key={`home-dash-${stat.id}`}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(stat.id)}
              className={cn(
                "group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:border-[#002D56]/30 hover:shadow-xl",
              )}
            >
              <div
                className={cn(
                  "mb-4 flex h-12 w-12 items-center justify-center rounded-2xl shrink-0 transition-transform group-hover:rotate-12",
                  stat.bg,
                  stat.color,
                )}
              >
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-slate-400 truncate uppercase mb-1">
                  {stat.label}
                </p>
                <p className="text-3xl sm:text-4xl font-bold text-slate-800 tracking-tight">
                  {stat.value}
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 transition-transform group-hover:scale-150 group-hover:rotate-12">
                <stat.icon className="h-20 w-20" />
              </div>
            </motion.button>
          ))}
        </div>

        {/* Quick Actions / Featured */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.button
            whileHover={{ y: -5 }}
            onClick={createNewSession}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#002D56] to-blue-800 p-8 text-white shadow-xl group"
          >
            <div className="relative z-10">
              <div className="p-4 bg-white/10 rounded-2xl w-fit mb-6 animate-float">
                <Edit3 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800   tracking-tight">
                Biên tập bài viết
              </h3>
              <p className="text-sm font-medium text-blue-100 mt-2 opacity-80 leading-relaxed">
                Sử dụng AI để phác thảo nội dung nghiệp vụ chuyên
                sâu.
              </p>
              <div className="mt-8 flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider">
                Bắt đầu ngay{" "}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
            <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
          </motion.button>

          <motion.button
            whileHover={{ y: -5 }}
            onClick={openCreateTask}
            className="rounded-[2rem] border-2 border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-blue-500/50 hover:shadow-2xl group flex flex-col text-left"
          >
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-6 transition-colors group-hover:bg-emerald-100">
              <CheckSquare className="w-8 h-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Quản lý Nhiệm vụ
            </h3>
            <p className="text-sm font-bold text-slate-400 mt-2">
              Theo dõi và phối hợp công việc trơn tru.
            </p>
            <div className="mt-auto pt-8">
              <div className="h-1.5 w-12 bg-slate-100 rounded-full group-hover:w-full group-hover:bg-emerald-500 transition-all duration-500" />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -5 }}
            onClick={openAiTaskBuilder}
            className="rounded-[2rem] border-2 border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-orange-500/50 hover:shadow-2xl group flex flex-col text-left"
          >
            <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl w-fit mb-6 transition-colors group-hover:bg-orange-100">
              <Bot className="w-8 h-8" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              AI Task Planner
            </h3>
            <p className="text-sm font-bold text-slate-400 mt-2">
              Biến ý tưởng thành kế hoạch hành động.
            </p>
            <div className="mt-auto pt-8 text-[#002D56] opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-6 h-6 ml-auto" />
            </div>
          </motion.button>
        </div>

        {/* Lists Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
          {/* 1. Upcoming Tasks */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-[#002D56] p-2 rounded-lg">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">
                    Công việc sắp tới
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                    Cần hoàn thành sớm
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("tasks")}
                className="text-[10px] font-bold uppercase tracking-wider text-[#002D56] hover:bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
              >
                Xem tất cả
              </button>
            </div>
            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto overscroll-contain max-h-[400px] custom-scrollbar">
              {allTasks
                .filter((t: any) => t.status !== "done")
                .sort(
                  (a: any, b: any) =>
                    new Date(a.dueDate || "9999").getTime() -
                    new Date(b.dueDate || "9999").getTime(),
                )
                .slice(0, 5)
                .map((task: any, idx: number) => (
                  <button
                    key={getRenderKey("task-home", task, idx)}
                    onClick={() => {
                      setEditingTask(task);
                      setActiveModal("task-edit");
                    }}
                    className="w-full text-left p-5 hover:bg-slate-50 transition-colors group flex items-start gap-4"
                  >
                    <div className="mt-0.5 relative">
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-[#002D56] transition-colors" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 mb-1 truncate group-hover:text-[#002D56] transition-colors">
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500">
                        {task.dueDate && (
                          <span
                            className={cn(
                              "flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded",
                              new Date(task.dueDate) < new Date()
                                ? "text-red-600 bg-red-50"
                                : "",
                            )}
                          >
                            <Clock className="w-3 h-3" />
                            {task.dueDate}
                          </span>
                        )}
                        <span className="truncate max-w-[120px]">
                          {task.categoryName || task.categoryCode}
                        </span>
                      </div>
                    </div>
                    <div className="pl-2 flex items-center">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mr-1",
                          task.priority === "urgent"
                            ? "bg-rose-500"
                            : task.priority === "high"
                              ? "bg-orange-500"
                              : task.priority === "medium"
                                ? "bg-blue-500"
                                : "bg-slate-300",
                        )}
                        aria-hidden="true"
                      />
                      <span className="sr-only">Priority: {task.priority || "normal"}</span>
                    </div>
                  </button>
                ))}
              {allTasks.filter((t: any) => t.status !== "done")
                .length === 0 && (
                <div className="p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-semibold text-sm">
                    Tuyệt vời!
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Không có công việc nào đang chờ xử lý.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 2. Recent Documents */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-orange-500 p-2 rounded-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">
                    Tài liệu gần đây
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-0.5">
                    Truy cập từ kho Mẫu biểu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("library")}
                className="text-[10px] font-bold uppercase tracking-wider text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-full transition-colors"
              >
                Kho tài liệu
              </button>
            </div>
            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto overscroll-contain max-h-[400px] custom-scrollbar">
              {documents
                .slice()
                .sort(
                  (a: any, b: any) =>
                    (b.updatedAt || 0) - (a.updatedAt || 0),
                )
                .slice(0, 5)
                .map((doc: any, idx: number) => (
                  <button
                    key={getRenderKey("doc-home", doc, idx)}
                    onClick={() => {
                      setActiveTab("library");
                    }}
                    className="w-full text-left p-5 hover:bg-slate-50 transition-colors group flex items-start gap-4"
                  >
                    <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-orange-100 group-hover:text-orange-600 text-slate-500 transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 mb-1 truncate group-hover:text-orange-600 transition-colors">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                        <span className="uppercase tracking-wider">
                          {doc.type}
                        </span>
                        {doc.updatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(
                              doc.updatedAt,
                            ).toLocaleDateString("vi-VN")}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              {documents.length === 0 && (
                <div className="p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <FolderLock className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-semibold text-sm">
                    Kho lưu trữ trống
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    Chưa có tài liệu nào được thêm vào.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
