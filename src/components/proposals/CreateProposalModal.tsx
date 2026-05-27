import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Briefcase, 
  FileText, 
  Tag, 
  Calendar, 
  Users, 
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { createProposal } from '../../features/proposals/proposalService';

interface CreateProposalModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

export const CreateProposalModal: React.FC<CreateProposalModalProps> = ({
  userId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Nghiệp vụ hàng hải',
    description: '',
    department: 'Ban Nghiệp vụ',
    dueDate: ''
  });

  const categories = [
    'Nghiệp vụ hàng hải',
    'Cải cách hành chính',
    'Đầu tư xây dựng',
    'Chuyển đổi số',
    'An toàn an ninh'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setLoading(true);
    try {
      const proposalId = await createProposal(userId, {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        department: formData.department,
        dueDate: formData.dueDate,
        status: 'draft',
        progressPercent: 0
      });
      onSuccess(proposalId);
    } catch (error) {
      console.error('Failed to create proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#002D56] rounded-xl">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 id="modal-title" className="text-xl font-bold text-slate-800 tracking-tight">Tạo Đề án mới</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Khởi tạo quy trình xây dựng văn bản</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                  Tên đề án / Nhiệm vụ
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text"
                    required
                    placeholder="Ví dụ: Đề án kiện toàn quy trình điều động tàu..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none transition-all font-semibold"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                    Lĩnh vực
                  </label>
                  <div className="relative">
                    <Tag className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <select 
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none transition-all font-semibold appearance-none cursor-pointer"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                    Thời hạn hoàn thành
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input 
                      type="date"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none transition-all font-semibold"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                  Đơn vị chủ trì / Phụ trách
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text"
                    placeholder="Phòng / Ban chủ trì..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none transition-all font-semibold"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                  Mô tả mục tiêu
                </label>
                <textarea 
                  rows={3}
                  placeholder="Nội dung chính và mục tiêu cần đạt được..."
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none transition-all font-medium resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                HỦY BỎ
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name}
                className="flex-1 py-4 bg-[#002D56] text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-900/40 hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                XÁC NHẬN TẠO
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
