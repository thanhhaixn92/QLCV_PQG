import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Info,
  Layers,
  Heading,
  Code,
  Edit,
  Type,
  Layout,
  FileText,
  Paperclip,
  Table as TableIcon,
  CheckCircle2
} from 'lucide-react';
import { ProposalOutlineItem } from '../../features/proposals/types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface ProposalOutlineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProposalOutlineItem>) => void;
  item?: ProposalOutlineItem | null;
  parentId?: string | null;
  level?: number;
}

export const ProposalOutlineEditorModal: React.FC<ProposalOutlineEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  item,
  parentId,
  level = 1
}) => {
  const [formData, setFormData] = useState<Partial<ProposalOutlineItem>>({
    title: '',
    guidance: '',
    level: 1,
    status: 'not_started',
    code: '',
    itemType: 'content',
    isContainer: false,
    canHaveDraft: true,
    countInProgress: true
  });

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        guidance: item.guidance || '',
        level: item.level,
        status: item.status,
        code: item.code || '',
        parentId: item.parentId,
        itemType: item.itemType || (item.level === 1 ? 'section' : 'content'),
        isContainer: item.isContainer ?? (item.level === 1),
        canHaveDraft: item.canHaveDraft ?? (item.level !== 1),
        countInProgress: item.countInProgress ?? true
      });
    } else {
      setFormData({
        title: '',
        guidance: '',
        level: level,
        status: 'not_started',
        code: '',
        parentId: parentId || undefined,
        itemType: level === 1 ? 'section' : 'content',
        isContainer: level === 1,
        canHaveDraft: level !== 1,
        countInProgress: true
      });
    }
  }, [item, parentId, level, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const itemTypes = [
    { id: 'section', label: 'PHẦN LỚN', icon: Layout, desc: 'Dùng làm đề mục cha, không viết bản thảo trực tiếp' },
    { id: 'content', label: 'NỘI DUNG', icon: FileText, desc: 'Mục nội dung chi tiết cần viết bản thảo' },
    { id: 'appendix', label: 'PHỤ LỤC', icon: Paperclip, desc: 'Các tài liệu, biểu mẫu đính kèm' },
    { id: 'table', label: 'BẢNG BIỂU', icon: TableIcon, desc: 'Bảng số liệu, ma trận phân tích' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#002D56] text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10">
              {item ? <Edit className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">{item ? 'Chỉnh sửa mục lục' : 'Thêm mới mục lục'}</h3>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Cấp độ {formData.level}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div className="space-y-6">
            {/* Item Type Selection */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                <Type className="w-3.5 h-3.5" /> PHÂN LOẠI MỤC
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {itemTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.itemType === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        const isSect = type.id === 'section';
                        setFormData(prev => ({ 
                          ...prev, 
                          itemType: type.id as any,
                          isContainer: isSect,
                          canHaveDraft: !isSect
                        }));
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all",
                        isSelected 
                          ? "bg-[#002D56] border-[#002D56] text-white shadow-lg shadow-blue-900/20" 
                          : "bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:bg-blue-50"
                      )}
                    >
                      <Icon className={cn("w-5 h-5", isSelected ? "text-blue-300" : "text-slate-300")} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                <Heading className="w-3.5 h-3.5" /> TIÊU ĐỀ MỤC
              </label>
              <textarea 
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ví dụ: I. Thực trạng tổ chức bộ máy..."
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none min-h-[100px] resize-none shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Code/Prefix */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                  <Code className="w-3.5 h-3.5" /> MÃ/SỐ THỨ TỰ
                </label>
                <input 
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="1.1, I, PHẦN I..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                  <Info className="w-3.5 h-3.5" /> TRẠNG THÁI
                </label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none disabled:opacity-50"
                  disabled={formData.itemType === 'section'}
                >
                  <option value="not_started">Chưa viết</option>
                  <option value="writing">Đang viết</option>
                  <option value="needs_data">Cần số liệu</option>
                  <option value="needs_review">Cần rà soát</option>
                  <option value="completed">Hoàn thành</option>
                </select>
              </div>
            </div>

            {/* Config Toggles */}
            <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setFormData(prev => ({ ...prev, countInProgress: !prev.countInProgress }))}
                  className={cn(
                    "w-10 h-6 rounded-full transition-all relative flex items-center px-1",
                    formData.countInProgress ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full transition-all",
                    formData.countInProgress ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Tính vào tiến độ</p>
                  <p className="text-[9px] text-slate-400 font-medium">Bao gồm trong % hoàn thành</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group opacity-50" title="Auto-set based on Item Type">
                <div 
                  className={cn(
                    "w-10 h-6 rounded-full transition-all relative flex items-center px-1 bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 bg-white rounded-full transition-all",
                    formData.canHaveDraft ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Cho phép bản thảo</p>
                  <p className="text-[9px] text-slate-400 font-medium">{formData.canHaveDraft ? 'Có' : 'Không (Phần lớn)'}</p>
                </div>
              </label>
            </div>

            {/* Guidance */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> HƯỚNG DẪN NỘI DUNG
              </label>
              <textarea 
                value={formData.guidance}
                onChange={(e) => setFormData(prev => ({ ...prev, guidance: e.target.value }))}
                placeholder="Hướng dẫn cho người viết nội dung phần này..."
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-600 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none min-h-[120px] resize-none"
              />
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-slate-50 flex items-center justify-end gap-3 bg-slate-50/30">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-3 text-slate-500 text-xs font-bold uppercase hover:bg-slate-50 rounded-xl transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSubmit}
            className="px-8 py-3 bg-[#002D56] text-white rounded-xl text-xs font-bold shadow-xl shadow-blue-900/20 hover:opacity-90 transition-all flex items-center gap-2 uppercase tracking-wide"
          >
            <Save className="w-4 h-4 text-blue-300" /> {item ? 'Cập nhật' : 'Lưu mục lục'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

