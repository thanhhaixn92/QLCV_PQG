import React from 'react';
import { 
  Layout, 
  Plus, 
  Sparkles, 
  Search, 
  Filter,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Wand2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ProposalOutlineItem } from '../../features/proposals/types';
import { 
  STANDARD_PROPOSAL_TEMPLATE, 
  RESTRUCTURE_AFTER_MERGER_TEMPLATE 
} from '../../features/proposals/proposalTemplates';

interface ProposalOutlineToolbarProps {
  items: ProposalOutlineItem[];
  onApplyTemplate: (template: any) => void;
  onNormalize: () => void;
  onAddManual: () => void;
  onAiSuggest: () => void;
  isSuggesting: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  levelFilter: string;
  setLevelFilter: (f: string) => void;
}

export const ProposalOutlineToolbar: React.FC<ProposalOutlineToolbarProps> = ({
  items,
  onApplyTemplate,
  onNormalize,
  onAddManual,
  onAiSuggest,
  isSuggesting,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  levelFilter,
  setLevelFilter
}) => {
  const stats = {
    total: items.length,
    sections: items.filter(i => i.itemType === 'section').length,
    content: items.filter(i => i.itemType === 'content').length,
    appendix: items.filter(i => i.itemType === 'appendix' || i.itemType === 'table').length,
    
    // Process counters
    countItems: items.filter(i => i.countInProgress),
    completed: items.filter(i => i.countInProgress && i.status === 'completed').length,
    needs_data: items.filter(i => i.countInProgress && i.status === 'needs_data').length,
    writing: items.filter(i => i.countInProgress && i.status === 'writing').length,
    not_started: items.filter(i => i.countInProgress && (i.status === 'not_started' || !i.status)).length,
  };

  const totalCountable = stats.countItems.length;
  const progressPercent = totalCountable > 0 
    ? Math.round((stats.completed / totalCountable) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4 md:gap-8 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-[#002D56] text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-900/10">
            {progressPercent}%
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">TIẾN ĐỘ NỘI DUNG</p>
            <p className="text-xs font-extrabold text-slate-700">{stats.completed}/{totalCountable} MỤC</p>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-100 hidden md:block"></div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">PHẦN LỚN</p>
            <p className="text-xs font-bold text-slate-800">{stats.sections}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">MỤC NỘI DUNG</p>
            <p className="text-xs font-bold text-blue-600">{stats.content}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold text-amber-400 uppercase tracking-tighter">CẦN SỐ LIỆU</p>
            <p className="text-xs font-bold text-amber-600">{stats.needs_data}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">PHỤ LỤC</p>
            <p className="text-xs font-bold text-emerald-600">{stats.appendix}</p>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Templates & Add */}
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => onApplyTemplate(STANDARD_PROPOSAL_TEMPLATE)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-all border border-slate-200"
          >
            <Layout className="w-3.5 h-3.5" />
            MẪU ĐỀ ÁN CHUẨN
          </button>
          <button 
            onClick={() => onApplyTemplate(RESTRUCTURE_AFTER_MERGER_TEMPLATE)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-[#002D56] rounded-xl text-[10px] font-bold hover:bg-slate-200 transition-all border border-[#002D56]/10"
          >
            <Layout className="w-3.5 h-3.5" />
            MẪU HẬU HỢP NHẤT
          </button>

          <button 
            onClick={onNormalize}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-600 rounded-xl text-[10px] font-bold hover:bg-emerald-50 transition-all border border-emerald-100"
            title="Tự động nhận diện Phần/Mục nội dung/Phụ lục"
          >
            <Wand2 className="w-3.5 h-3.5" />
            CHUẨN HÓA ĐỀ CƯƠNG
          </button>
          
          <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>
          
          <button 
            onClick={onAiSuggest}
            disabled={isSuggesting}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#002D56] text-white rounded-xl text-[10px] font-bold uppercase shadow-lg shadow-blue-900/10 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isSuggesting ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Sparkles className="w-3.5 h-3.5 text-blue-300" />}
            AI GỢI Ý
          </button>
          
          <button 
            onClick={onAddManual}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase hover:bg-emerald-600 shadow-lg shadow-emerald-500/10 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> THÊM MỤC
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div className="relative group flex-1 md:flex-none md:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500" />
            <input 
              type="text" 
              placeholder="Tìm mục lục..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
            />
          </div>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 outline-none hover:bg-slate-50 transition-all"
          >
            <option value="all">TẤT CẢ TRẠNG THÁI</option>
            <option value="not_started">CHƯA VIẾT</option>
            <option value="writing">ĐANG VIẾT</option>
            <option value="needs_data">CẦN SỐ LIỆU</option>
            <option value="needs_review">CẦN RÀ SOÁT</option>
            <option value="completed">HOÀN THÀNH</option>
          </select>

          <select 
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 outline-none hover:bg-slate-50 transition-all"
          >
            <option value="all">TẤT CẢ CẤP BẬC</option>
            <option value="1">CẤP 1 (PHẦN)</option>
            <option value="2">CẤP 2 (MỤC LỚN)</option>
            <option value="3">CẤP 3 (MỤC NHỎ)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
