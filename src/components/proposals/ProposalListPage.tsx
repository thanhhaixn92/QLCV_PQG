import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Briefcase, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { Proposal } from '../../features/proposals/types';
import { listProposals } from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';

interface ProposalListPageProps {
  userId: string;
  onOpenCreateModal: () => void;
  onSelectProposal: (proposalId: string) => void;
}

export const ProposalListPage: React.FC<ProposalListPageProps> = ({ 
  userId, 
  onOpenCreateModal,
  onSelectProposal
}) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProposals = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        const data = await listProposals(userId);
        setProposals(data);
      } catch (err: any) {
        console.error('Failed to fetch proposals:', err);
        if (err.message?.includes('permission-denied') || err.message?.includes('Insufficient permissions')) {
          setError('Bạn không có quyền truy cập danh sách đề án hoặc chưa được cấp quyền Firestore. Vui lòng kiểm tra lại tài khoản hoặc liên hệ quản trị viên.');
        } else {
          setError('Không thể tải danh sách đề án. Vui lòng thử lại sau.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, [userId]);

  if (!userId && loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#002D56] rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Đang xác thực...</p>
      </div>
    );
  }

  if (!userId && !loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-200 rounded-3xl border-dashed">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Vui lòng đăng nhập</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Bạn cần đăng nhập để quản lý và theo dõi các đề án nghiệp vụ.
        </p>
      </div>
    );
  }

  const filteredProposals = proposals.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.department && p.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Hoàn thành</span>;
      case 'reviewing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> Đang duyệt</span>;
      case 'draft':
        return <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full flex items-center gap-1"><FileText className="w-3 h-3" /> Bản thảo</span>;
      case 'archived':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Đã lưu trữ</span>;
      default:
        return <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">{status}</span>;
    }
  };

  if (error) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-red-100 rounded-3xl">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Lỗi truy cập dữ liệu</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm px-6">
          {error}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-6 bg-slate-100 text-slate-600 px-6 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
        >
          THỬ LẠI
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-[#002D56]" />
            Quản lý Xây dựng Đề án
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Theo dõi, điều phối và biên tập các đề án nghiệp vụ chuyên sâu.
          </p>
        </div>
        <button 
          onClick={onOpenCreateModal}
          className="bg-[#002D56] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-xl shadow-blue-900/20 flex items-center gap-2 hover:bg-opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" /> TẠO ĐỀ ÁN MỚI
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3 relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Tìm kiếm đề án bằng tên, lĩnh vực hoặc phòng ban..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] focus:border-transparent outline-none transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter className="w-4 h-4" /> Bộ lọc
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#002D56] rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">Đang tải danh sách...</p>
        </div>
      ) : filteredProposals.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredProposals.map((proposal, idx) => (
            <motion.div 
              key={`${proposal.id}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#002D56]/30 hover:shadow-xl transition-all group relative cursor-pointer"
              onClick={() => onSelectProposal(proposal.id)}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(proposal.status)}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">
                      {proposal.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 group-hover:text-[#002D56] transition-colors">
                    {proposal.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {proposal.description}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-4 h-4" />
                      <span className="text-[11px] font-bold">
                        {proposal.dueDate ? new Date(proposal.dueDate).toLocaleDateString('vi-VN') : 'Chưa đặt hạn'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <User className="w-4 h-4" />
                      <span className="text-[11px] font-bold">{proposal.department || 'Chưa phân đơn vị'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tiến độ</p>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#002D56] transition-all duration-500" 
                          style={{ width: `${proposal.progressPercent || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{proposal.progressPercent || 0}%</span>
                    </div>
                  </div>
                  <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-200 rounded-3xl border-dashed">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Chưa có đề án nào</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Bắt đầu tạo đề án mới để quản lý quy trình xây dựng và phê duyệt nghiệp vụ.
          </p>
          <button 
            onClick={onOpenCreateModal}
            className="mt-6 text-[#002D56] font-bold text-sm hover:underline"
          >
            Tạo đề án đầu tiên ngay
          </button>
        </div>
      )}
    </div>
  );
};
