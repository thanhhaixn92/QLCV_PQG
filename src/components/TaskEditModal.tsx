import React from 'react';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { motion } from 'motion/react';
import { X, Save, Edit3, Plus, CheckSquare, Layout, Clock, Trash2, ListChecks } from 'lucide-react';
import { WorkTask, TASK_CATEGORIES } from '../types';
import { cn } from '../lib/utils';
import { getRenderKey, staticKey } from '../utils/listKeys';

interface TaskEditModalProps {
  editingTask: WorkTask;
  setEditingTask: (task: WorkTask) => void;
  onClose: () => void;
  onSave: (task: WorkTask) => void | Promise<void>;
  onDelete: (id: string) => void;
  documents: any[];
  setIsPickingFromLibrary: (val: boolean) => void;
  onDiscardDraft?: () => void;
  onConfirmDelete?: (message: string) => Promise<boolean>;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  editingTask,
  setEditingTask,
  onClose,
  onSave,
  onDelete,
  documents,
  setIsPickingFromLibrary,
  onDiscardDraft,
  onConfirmDelete
}) => {
  const isDraft = !editingTask.id || String(editingTask.id).startsWith('draft-task-') || Boolean(editingTask.clientId);
  const isPersisted = !isDraft && !!editingTask.id;
  const [isSaving, setIsSaving] = React.useState(false);
  const trimmedTitle = String(editingTask.title || "").trim();

  const handleSave = async () => {
    if (isSaving || !trimmedTitle) return;
    setIsSaving(true);
    try {
      await onSave({ ...editingTask, title: trimmedTitle });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex justify-end" onClick={onClose}>
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-white w-full max-w-5xl h-full shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-[#002D56] p-2 sm:p-3 rounded-md">
              {isPersisted ? <Edit3 className="text-white w-5 h-5" /> : <Plus className="text-white w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-slate-800 tracking-tight">
                {isPersisted ? 'Chi tiết công việc' : 'Tạo mới công việc'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-normal hidden sm:block">Hoa Tiêu Miền Bắc - Hệ thống Công việc</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-800 transition-colors bg-white rounded-full border border-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col bg-slate-50/30">
          <div className="p-4 sm:p-8 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Content (2/3 width) */}
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Tiêu đề công việc</label>
                  <input 
                    type="text" 
                    value={editingTask.title}
                    onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                    placeholder="VD: Kiểm tra mớn nước tàu HTMB 01..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-shadow shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Mô tả chi tiết</label>
                  <textarea 
                    rows={6}
                    value={editingTask.description}
                    onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                    placeholder="Ghi chú thêm về yêu cầu, tài liệu đính kèm hoặc các vướng mắc..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-5 py-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 resize-none custom-scrollbar shadow-sm"
                  />
                </div>

                {/* Checklist Section */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1 flex items-center gap-2">
                    <ListChecks className="w-4 h-4" /> Checklist chi tiết ({editingTask.checklist?.length || 0})
                  </label>
                  <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    {editingTask.checklist?.map((item, idx) => (
                      <div 
                        key={getRenderKey("task-checklist", item, idx)}
                        className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors group"
                      >
                        <input 
                          type="checkbox"
                          checked={item.done}
                          onChange={e => {
                            const newChecklist = [...(editingTask.checklist || [])];
                            newChecklist[idx] = { ...item, done: e.target.checked, updatedAt: Date.now() };
                            setEditingTask({ ...editingTask, checklist: newChecklist });
                          }}
                          className="w-4 h-4 rounded text-[#002D56] border-slate-300 focus:ring-[#002D56]"
                        />
                        <input 
                          type="text"
                          value={item.title}
                          onChange={e => {
                            const newChecklist = [...(editingTask.checklist || [])];
                            newChecklist[idx] = { ...item, title: e.target.value, updatedAt: Date.now() };
                            setEditingTask({ ...editingTask, checklist: newChecklist });
                          }}
                          className={cn(
                            "flex-1 bg-transparent border-none p-0 text-sm focus:ring-0",
                            item.done ? "text-slate-400 line-through" : "text-slate-700 font-medium"
                          )}
                        />
                        <button 
                          onClick={() => {
                            const newChecklist = editingTask.checklist?.filter((_, i) => i !== idx);
                            setEditingTask({ ...editingTask, checklist: newChecklist });
                          }}
                          className="p-1 px-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const newItem = {
                          id: `checklist-item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                          title: '',
                          done: false,
                          createdAt: Date.now()
                        };
                        setEditingTask({
                          ...editingTask,
                          checklist: [...(editingTask.checklist || []), newItem]
                        });
                      }}
                      className="flex items-center gap-2 text-xs font-bold text-[#002D56] hover:text-blue-700 p-2 ml-1 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Thêm mục kiểm tra
                    </button>
                  </div>
                </div>

                {FEATURE_FLAGS.PROPOSAL_MODULE && editingTask.proposalId && (
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Đề án liên quan</label>
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg border border-blue-100 text-xs font-bold shadow-sm">
                      <Layout className="w-4 h-4" />
                      <span>ĐANG LIÊN KẾT VỚI ĐỀ ÁN</span>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Tài liệu đính kèm ({editingTask.linkedDocumentIds?.length || 0})</label>
                  <div className="flex flex-wrap gap-2">
                    {editingTask.linkedDocumentIds?.map((docId, idx) => {
                      const doc = documents.find(d => d.id === docId);
                      if (!doc) return null;
                      return (
                        <div key={getRenderKey("task-doc", { id: docId, clientId: docId }, idx)} className="flex items-center gap-2 bg-slate-100/80 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm">
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{doc.name}</span>
                          <button 
                            onClick={() => setEditingTask({
                              ...editingTask,
                              linkedDocumentIds: editingTask.linkedDocumentIds?.filter(id => id !== docId)
                            })}
                            className="p-1 hover:bg-white hover:text-red-500 rounded-md transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <button 
                      onClick={() => setIsPickingFromLibrary(true)}
                      className="flex items-center gap-2 bg-white text-[#002D56] px-4 py-2 rounded-lg text-xs font-semibold border border-dashed border-[#002D56]/40 hover:bg-[#002D56]/5 transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Gắn tài liệu mới
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column - Metadata (1/3 width) */}
              <div className="lg:col-span-1 space-y-5 bg-white p-5 rounded-xl border border-slate-100 shadow-sm self-start">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Người xử lý</label>
                  <input 
                    type="text" 
                    value={editingTask.assignee}
                    onChange={e => setEditingTask({ ...editingTask, assignee: e.target.value })}
                    placeholder="Tên hoặc mã định danh..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Trạng thái hiện tại</label>
                  <select 
                    value={editingTask.status || "todo"}
                    onChange={e => setEditingTask({ ...editingTask, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                  >
                    <option key={staticKey("status-opt", "todo-init", 0)} value="todo">Cần làm</option>
                    <option key={staticKey("status-opt", "in_progress", 1)} value="in_progress">Đang xử lý</option>
                    <option key={staticKey("status-opt", "doing", 2)} value="doing">Đang làm</option>
                    <option key={staticKey("status-opt", "waiting", 3)} value="waiting">Chờ phản hồi</option>
                    <option key={staticKey("status-opt", "review", 4)} value="review">Kiểm tra</option>
                    <option key={staticKey("status-opt", "done", 5)} value="done">Hoàn thành</option>
                    <option key={staticKey("status-opt", "blocked", 6)} value="blocked">Vướng mắc</option>
                    <option key={staticKey("status-opt", "archived", 7)} value="archived">Lưu trữ</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Lĩnh vực chuyên môn</label>
                  <select 
                    value={editingTask.categoryCode}
                    onChange={e => setEditingTask({ ...editingTask, categoryCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                  >
                    {TASK_CATEGORIES.map((c, cidx) => (
                      <option key={staticKey("task-cat", c.code, cidx)} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Thời hạn xử lý</label>
                  <input 
                    type="date" 
                    value={editingTask.dueDate}
                    onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 tracking-normal ml-1">Độ ưu tiên</label>
                  <select 
                    value={editingTask.priority}
                    onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                  >
                    <option key={staticKey("pri-opt", "low", 0)} value="low">Thấp</option>
                    <option key={staticKey("pri-opt", "medium", 1)} value="medium">Trung bình</option>
                    <option key={staticKey("pri-opt", "high", 2)} value="high">Cao</option>
                    <option key={staticKey("pri-opt", "urgent", 3)} value="urgent">Khẩn cấp</option>
                  </select>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none bg-slate-50 p-3 rounded-lg border border-slate-200 hover:border-[#002D56]/30 transition-all">
                    <input 
                      type="checkbox"
                      checked={editingTask.isDeputy}
                      onChange={e => setEditingTask({ ...editingTask, isDeputy: e.target.checked })}
                      className="w-4 h-4 mt-0.5 rounded text-[#002D56] focus:ring-[#002D56] border-slate-300"
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-slate-800 tracking-tight">Chế độ kiêm nhiệm</span>
                      <span className="text-[11px] text-slate-500 italic mt-0.5" style={{ lineHeight: 1.3 }}>Cho phép giao việc không chính danh (Chức danh kiêm nhiệm)</span>
                    </div>
                  </label>
                </div>

                {editingTask.isDeputy && (
                  <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 border-t border-slate-100">
                    <div className="space-y-2 mt-4">
                      <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Mã chức danh</label>
                      <input 
                        type="text" 
                        value={editingTask.assignmentCode || ''}
                        onChange={e => setEditingTask({ ...editingTask, assignmentCode: e.target.value })}
                        placeholder="VD: DH01"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Tên chức vụ</label>
                      <input 
                        type="text" 
                        value={editingTask.assignmentName || ''}
                        onChange={e => setEditingTask({ ...editingTask, assignmentName: e.target.value })}
                        placeholder="Phó ca, hỗ trợ..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/20 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 sm:px-8 sm:py-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isPersisted && onDiscardDraft && (
              <button
                onClick={onDiscardDraft}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-all border border-amber-200"
              >
                Xóa bản nháp
              </button>
            )}
            {isPersisted && (
              <button 
                onClick={async () => {
                  const confirmed = onConfirmDelete
                    ? await onConfirmDelete("Bạn có chắc chắn muốn xóa công việc này?")
                    : true;
                  if (confirmed) {
                    onDelete(editingTask.id!);
                  }
                }}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-all border border-red-200"
              >
                Xóa
              </button>
            )}
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
            >
              Hủy bỏ
            </button>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving || !trimmedTitle}
            className="w-full sm:w-auto bg-[#002D56] text-white px-8 py-3 rounded-lg text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-900 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#002D56]"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Đang lưu...' : isPersisted ? 'Cập nhật công việc' : 'Lưu công việc mới'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
