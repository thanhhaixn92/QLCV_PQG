import React from 'react';
import { motion } from 'motion/react';
import { X, Save, Edit3, Plus, CheckSquare } from 'lucide-react';
import { WorkTask, TASK_CATEGORIES } from '../types';
import { cn } from '../lib/utils';

interface TaskEditModalProps {
  editingTask: WorkTask;
  setEditingTask: (task: WorkTask) => void;
  onClose: () => void;
  onSave: (task: WorkTask) => void;
  onDelete: (id: string) => void;
  documents: any[];
  setIsPickingFromLibrary: (val: boolean) => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  editingTask,
  setEditingTask,
  onClose,
  onSave,
  onDelete,
  documents,
  setIsPickingFromLibrary
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-4xl rounded-md lg:rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-24px)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-[#002D56] p-2 sm:p-3 rounded-md">
              {editingTask.id ? <Edit3 className="text-white w-5 h-5" /> : <Plus className="text-white w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-black text-slate-800 uppercase tracking-tight">
                {editingTask.id ? 'Chi tiết công việc' : 'Tạo mới công việc'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Hoa Tiêu Miền Bắc - Hệ thống Công việc</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-800 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề công việc</label>
            <input 
              type="text" 
              value={editingTask.title}
              onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
              placeholder="VD: Kiểm tra mớn nước tàu HTMB 01..."
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Người xử lý</label>
              <input 
                type="text" 
                value={editingTask.assignee}
                onChange={e => setEditingTask({ ...editingTask, assignee: e.target.value })}
                placeholder="Tên hoặc mã định danh..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lĩnh vực chuyên môn</label>
              <select 
                value={editingTask.categoryCode}
                onChange={e => setEditingTask({ ...editingTask, categoryCode: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
              >
                {TASK_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thời hạn xử lý</label>
              <input 
                type="date" 
                value={editingTask.dueDate}
                onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Độ ưu tiên</label>
              <select 
                value={editingTask.priority}
                onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái hiện tại</label>
              <select 
                value={editingTask.status}
                onChange={e => setEditingTask({ ...editingTask, status: e.target.value as any })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
              >
                <option value="todo">Cần làm</option>
                <option value="doing">Đang làm</option>
                <option value="review">Kiểm tra</option>
                <option value="done">Xong</option>
                <option value="blocked">Vướng</option>
              </select>
            </div>
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tài liệu liên quan ({editingTask.linkedDocumentIds?.length || 0})</label>
              <div className="flex flex-wrap gap-2">
                {editingTask.linkedDocumentIds?.map((docId, idx) => {
                  const doc = documents.find(d => d.id === docId);
                  if (!doc) return null;
                  return (
                    <div key={`${docId}-${idx}`} className="flex items-center gap-2 bg-[#002D56] text-white px-3 py-1.5 rounded-md text-[10px] font-black uppercase shadow-sm">
                      <span className="truncate max-w-[120px] sm:max-w-[150px]">{doc.name}</span>
                      <button 
                        onClick={() => setEditingTask({
                          ...editingTask,
                          linkedDocumentIds: editingTask.linkedDocumentIds?.filter(id => id !== docId)
                        })}
                        className="p-0.5 hover:bg-white/20 rounded-md transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                <button 
                  onClick={() => setIsPickingFromLibrary(true)}
                  className="flex items-center gap-2 bg-white text-[#002D56] px-3 py-1.5 rounded-md text-[10px] font-black uppercase border border-dashed border-[#002D56]/30 hover:bg-[#002D56]/5 transition-all"
                >
                  <Plus className="w-3 h-3" /> Gắn tài liệu
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col justify-center gap-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer select-none bg-slate-50 p-4 rounded-md border border-slate-100 hover:border-[#002D56]/20 transition-all">
                <input 
                  type="checkbox"
                  checked={editingTask.isDeputy}
                  onChange={e => setEditingTask({ ...editingTask, isDeputy: e.target.checked })}
                  className="w-5 h-5 rounded-lg text-[#002D56] focus:ring-[#002D56]"
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-tight">Chế độ kiêm nhiệm</span>
                  <span className="text-[10px] text-slate-400 font-bold italic">Cho phép giao việc không chính danh</span>
                </div>
              </label>
            </div>
          </div>

          {editingTask.isDeputy && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã chức danh</label>
                <input 
                  type="text" 
                  value={editingTask.assignmentCode || ''}
                  onChange={e => setEditingTask({ ...editingTask, assignmentCode: e.target.value })}
                  placeholder="VD: DH01"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên chức vụ</label>
                <input 
                  type="text" 
                  value={editingTask.assignmentName || ''}
                  onChange={e => setEditingTask({ ...editingTask, assignmentName: e.target.value })}
                  placeholder="Phó ca, hỗ trợ..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả chi tiết</label>
            <textarea 
              rows={4}
              value={editingTask.description}
              onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
              placeholder="Ghi chú thêm về yêu cầu, tài liệu đính kèm hoặc các vướng mắc..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10 resize-none custom-scrollbar"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-8 shrink-0 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {editingTask.id && (
              <button 
                onClick={() => onDelete(editingTask.id)}
                className="flex-1 sm:flex-none px-6 py-3 rounded-md text-[10px] font-black uppercase text-red-500 hover:bg-red-50 transition-all border border-red-100"
              >
                Xóa công việc
              </button>
            )}
            <button 
              onClick={onClose}
              className="flex-1 sm:flex-none px-6 py-3 rounded-md text-[10px] font-black uppercase text-slate-400 hover:bg-slate-200 transition-all"
            >
              Hủy bỏ
            </button>
          </div>
          <button 
            onClick={() => onSave(editingTask)}
            className="w-full sm:w-auto bg-[#002D56] text-white px-10 py-4 rounded-md text-xs font-black uppercase tracking-[0.2em] shadow-2xl hover:shadow-[#002D56]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingTask.id ? 'CẬP NHẬT DỮ LIỆU' : 'LƯU CÔNG VIỆC MỚI'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
