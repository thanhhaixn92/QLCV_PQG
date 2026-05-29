import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Loader2,
  AlertCircle,
  FileText,
  Search,
  BookOpen,
  ChevronRight,
  Plus,
  ArrowRight,
  Layout,
  Menu,
  X
} from 'lucide-react';
import { 
  ProposalOutlineItem, 
  Proposal,
  ProposalDraft
} from '../../features/proposals/types';
import { 
  listOutlineItems, 
  getDraftByOutlineItem,
  createDraftForOutlineItem,
  listDrafts
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { ProposalDraftEditor } from './ProposalDraftEditor';

interface ProposalDraftsTabProps {
  userId: string;
  proposalId: string;
  proposal: Proposal;
  onSelectionChange?: (selection: { 
    selectedOutlineItemId: string | null;
    selectedOutlineItemTitle: string | null;
    selectedOutlineItemCode: string | null;
    currentDraftContent: string | null;
  }) => void;
}

export const ProposalDraftsTab: React.FC<ProposalDraftsTabProps> = ({ 
  userId, 
  proposalId,
  proposal,
  onSelectionChange
}) => {
  const [outlineItems, setOutlineItems] = useState<ProposalOutlineItem[]>([]);
  const [drafts, setDrafts] = useState<ProposalDraft[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const lastSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (onSelectionChange && selectedItemId) {
      const item = outlineItems.find(i => i.id === selectedItemId);
      const draft = drafts.find(d => d.outlineItemId === selectedItemId);
      
      const selectionKey = `${selectedItemId}-${draft?.content?.length || 0}`;
      if (lastSelectionRef.current === selectionKey) return;
      
      onSelectionChange({
        selectedOutlineItemId: selectedItemId,
        selectedOutlineItemTitle: item?.title || null,
        selectedOutlineItemCode: item?.code || null,
        currentDraftContent: draft?.content || null
      });
      lastSelectionRef.current = selectionKey;
    }
  }, [selectedItemId, outlineItems, drafts, onSelectionChange]);
  const [loading, setLoading] = useState(true);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const selectedItem = outlineItems.find(i => i.id === selectedItemId);
  const activeDraft = drafts.find(d => d.outlineItemId === selectedItemId);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (userId && proposalId) {
      fetchData();
    }
  }, [userId, proposalId]);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [items, draftsData] = await Promise.all([
        listOutlineItems(userId, proposalId),
        listDrafts(userId, proposalId)
      ]);
      setOutlineItems(items);
      setDrafts(draftsData);
      
      // Auto select first draftable item if none selected
      if (!initializedRef.current && items.length > 0 && !selectedItemId) {
        const firstDraftable = items.find(i => i.canHaveDraft !== false && i.itemType !== 'section');
        setSelectedItemId(firstDraftable?.id || items[0].id);
        initializedRef.current = true;
      }
    } catch (error: any) {
      console.error('Fetch data error:', error);
      toast.error("Không thể tải dữ liệu bản thảo");
    } finally {
      setLoading(false);
    }
  };

  const refreshDrafts = async () => {
    try {
      const draftsData = await listDrafts(userId, proposalId);
      setDrafts(draftsData);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDraft = async () => {
    if (!selectedItem) return;
    
    setIsCreatingDraft(true);
    try {
      await createDraftForOutlineItem(userId, proposalId, selectedItem);
      toast.success("Đã tạo bản thảo thành công!");
      await refreshDrafts();
    } catch (error: any) {
      toast.error("Lỗi khi tạo bản thảo: " + error.message);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const filteredOutline = useMemo(() => {
    let result = outlineItems;
    
    if (searchQuery) {
      result = result.filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.code || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }
    
    return result;
  }, [outlineItems, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return { label: 'XONG', color: 'bg-emerald-100 text-emerald-700' };
      case 'writing': return { label: 'VIẾT', color: 'bg-blue-100 text-blue-700' };
      case 'needs_data': return { label: 'DATA', color: 'bg-amber-100 text-amber-700' };
      case 'needs_review': return { label: 'RÀ SOÁT', color: 'bg-purple-100 text-purple-700' };
      default: return { label: 'CHỐNG', color: 'bg-slate-100 text-slate-400' };
    }
  };

  if (!userId) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Đang xác thực...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Đang tải bản thảo...</p>
      </div>
    );
  }

  if (outlineItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-[32px] flex flex-col items-center justify-center p-20 text-center shadow-sm">
        <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[28px] flex items-center justify-center mb-8">
           <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-extrabold text-slate-800">Chưa có đề cương</h3>
        <p className="text-sm text-slate-400 max-w-sm mt-3 font-medium">
          Vui lòng tạo hoặc áp dụng mẫu đề cương trong tab <span className="font-bold text-[#002D56]">Đề cương</span> trước khi bắt đầu viết bản thảo.
        </p>
      </div>
    );
  }

  const renderOutlineItems = () => (
    <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar space-y-1.5 py-1">
      {filteredOutline.map((item, idx) => {
        const itemType = item.itemType || (item.level === 1 ? 'section' : 'content');
        const isSection = itemType === 'section';
        const canHaveDraft = item.canHaveDraft !== false;
        
        const badge = getStatusBadge(item.status);
        const isSelected = selectedItemId === item.id;
        const hasDraft = drafts.some(d => d.outlineItemId === item.id);
        
        return (
          <button
            key={`${item.id}-${idx}`}
            onClick={() => {
              setSelectedItemId(item.id);
              setIsOutlineOpen(false); // Close drawer on mobile
            }}
            className={cn(
              "group w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 relative",
              isSelected 
                ? "bg-[#002D56] text-white shadow-xl shadow-blue-900/20 ring-1 ring-blue-400/30" 
                : isSection 
                  ? "bg-slate-50/80 text-slate-800 hover:bg-slate-100/80" 
                  : "hover:bg-blue-50/50 text-slate-600"
            )}
            style={{ marginLeft: `${(item.level - 1) * 8}px`, width: `calc(100% - ${(item.level - 1) * 8}px)` }}
          >
            {isSelected && (
              <motion.div 
                layoutId="active-indicator"
                className="absolute -left-1 top-3 bottom-3 w-1 bg-blue-400 rounded-full"
              />
            )}
            
            <div className={cn(
              "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black uppercase transition-all shadow-sm",
              isSelected 
                ? "bg-blue-500 text-white" 
                : isSection 
                  ? "bg-[#002D56] text-white" 
                  : "bg-white border border-slate-100 text-slate-400 group-hover:border-blue-200 group-hover:text-blue-500"
            )}>
              {item.code || item.level}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-xs font-black leading-tight line-clamp-2 transition-colors",
                isSelected ? "text-white" : isSection ? "text-[#002D56] uppercase tracking-tighter" : "text-slate-700 group-hover:text-blue-900"
              )}>
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {!canHaveDraft || isSection ? (
                  <span className={cn(
                    "text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-tighter",
                    isSelected ? "bg-blue-800/50 text-blue-100" : "bg-slate-200 text-slate-500"
                  )}>
                    {isSection ? 'LỚN' : 'KHÔNG BẢN THẢO'}
                  </span>
                ) : (
                  <span className={cn(
                    "text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-tighter",
                    isSelected ? "bg-blue-400 text-white" : badge.color
                  )}>
                    {badge.label}
                  </span>
                )}
                
                {hasDraft && (
                   <span className={cn(
                     "text-[9px] font-bold",
                     isSelected ? "text-blue-300" : "text-slate-400"
                   )}>
                     • Có bản thảo
                   </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const isValidDraftableItem = selectedItem && 
                               selectedItem.itemType !== "section" && 
                               selectedItem.canHaveDraft !== false;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-[700px] relative">
      {/* Mobile/Tablet Outline Trigger */}
      <div className="lg:hidden flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl mb-2 shadow-sm">
        <button 
          onClick={() => setIsOutlineOpen(true)}
          className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-widest px-3 py-2 bg-slate-100 rounded-xl"
        >
          <Menu className="w-4 h-4 text-blue-600" />
          Mục đề cương
        </button>
        {selectedItem && (
          <div className="text-[10px] font-bold text-slate-400 truncate max-w-[200px]">
            {selectedItem.code || ''} {selectedItem.title}
          </div>
        )}
      </div>

      {/* Drawer Overlay for Outline on small screens */}
      <AnimatePresence>
        {isOutlineOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOutlineOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white z-[101] shadow-2xl lg:hidden flex flex-col pt-safe"
            >
               <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="text-xs font-black text-[#002D56] uppercase tracking-widest">Đề cương chi tiết</h3>
                 <button onClick={() => setIsOutlineOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                   <X className="w-5 h-5 text-slate-400" />
                 </button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
                  <div className="mb-4">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm mục..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-xs outline-none focus:bg-white focus:border-blue-400 transition-all font-medium"
                      />
                    </div>
                  </div>
                  {renderOutlineItems()}
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sidebar: Outline Selector (Fixed on lg+) */}
      <div className={cn(
        "hidden lg:block shrink-0 transition-all duration-500 ease-in-out relative",
        isSidebarCollapsed ? "lg:w-20" : selectedItemId ? "lg:w-72" : "lg:w-80"
      )}>
        <div className="absolute -right-3 top-10 z-20">
           <button 
             onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
             className="w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-md transition-all active:scale-90"
           >
              <ChevronRight className={cn("w-3 h-3 transition-transform duration-500", isSidebarCollapsed ? "" : "rotate-180")} />
           </button>
        </div>

        <div id="outline-item-selector" className={cn(
          "bg-white border border-slate-200 rounded-[28px] p-5 shadow-sm overflow-hidden flex flex-col h-full max-h-[850px] sticky top-6 transition-all duration-500",
          isSidebarCollapsed ? "items-center px-2" : ""
        )}>
          {!isSidebarCollapsed ? (
            <>
              <div className="mb-5">
                <div className="flex items-center justify-between mb-4 text-nowrap">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-500" /> Cấu trúc đề án
                  </h3>
                  {outlineItems.length > 0 && (
                    <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {outlineItems.length} MỤC
                    </span>
                  )}
                </div>
                
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm mục cần viết..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-2xl text-xs outline-none focus:bg-white focus:border-blue-400 focus:shadow-md focus:shadow-blue-900/5 transition-all font-medium"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4">
                   {[
                     { id: 'all', label: 'Tất cả' },
                     { id: 'writing', label: 'Đang viết' },
                     { id: 'needs_data', label: 'Dữ liệu' },
                     { id: 'needs_review', label: 'Review' },
                     { id: 'completed', label: 'Xong' }
                   ].map(f => (
                     <button
                       key={f.id}
                       onClick={() => setStatusFilter(f.id)}
                       className={cn(
                         "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all tracking-tight",
                         statusFilter === f.id 
                          ? "bg-[#002D56] text-white shadow-lg shadow-blue-900/20" 
                          : "bg-slate-50 text-slate-400 hover:bg-slate-100 border border-transparent shadow-none"
                       )}
                     >
                       {f.label}
                     </button>
                   ))}
                </div>
              </div>
              
              {renderOutlineItems()}
            </>
          ) : (
            <div className="flex flex-col items-center gap-6 py-4">
               <FileText className="w-5 h-5 text-blue-500" />
               <div className="flex flex-col gap-3">
                  {filteredOutline.slice(0, 10).map((item, idx) => (
                    <button 
                      key={`${item.id}-collapsed-${idx}`}
                      onClick={() => setSelectedItemId(item.id)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border transition-all",
                        selectedItemId === item.id ? "bg-[#002D56] text-white border-[#002D56]" : "bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-600"
                      )}
                      title={item.title}
                    >
                      {item.code || item.level}
                    </button>
                  ))}
               </div>
               {filteredOutline.length > 10 && <span className="text-[10px] font-black text-slate-300">...</span>}
            </div>
          )}
        </div>

        {!isSidebarCollapsed && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#002D56] rounded-[32px] p-6 mt-6 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
               <BookOpen className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-2">Lời khuyên</h4>
              <p className="text-[11px] text-blue-100 leading-relaxed font-medium italic">
                "Việc viết đề án cần sự tỉ mỉ. Hãy hoàn thành từng mục nhỏ và sử dụng tính năng lưu phiên bản để lưu giữ các ý tưởng hay."
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Content: Editor Area */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <motion.div
              key={selectedItemId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {activeDraft ? (
                <ProposalDraftEditor 
                  userId={userId}
                  proposalId={proposalId}
                  draft={activeDraft}
                  outlineItem={selectedItem}
                  onUpdate={fetchData}
                />
              ) : selectedItem.itemType === 'section' || (selectedItem.level === 1 && !selectedItem.itemType) || selectedItem.canHaveDraft === false ? (
                <div className="bg-white border border-slate-200 rounded-[32px] flex flex-col items-center justify-center p-20 text-center shadow-sm h-full max-h-[700px]">
                   <div className="w-24 h-24 bg-slate-50 text-[#002D56] rounded-[32px] flex items-center justify-center mb-8 border border-slate-100">
                      <Layout className="w-10 h-10" />
                   </div>
                   <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">PHẦN LỚN / GỘP MỤC</h3>
                   <p className="text-sm text-slate-400 max-w-md mt-4 font-medium leading-relaxed">
                     Đây là phần lớn dùng để nhóm các mục con. Vui lòng chọn một mục nội dung bên trong để viết bản thảo.
                   </p>
                   <p className="text-xs text-slate-400 mt-2 italic font-bold">
                     (Mục: {selectedItem.title})
                   </p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-[32px] flex flex-col items-center justify-center p-20 text-center shadow-sm h-full max-h-[700px]">
                   <div className="w-24 h-24 bg-blue-50 text-[#002D56] rounded-[32px] flex items-center justify-center mb-8 shadow-inner ring-4 ring-white">
                      <Plus className="w-10 h-10" />
                   </div>
                   <h3 className="text-2xl font-black text-slate-800">Sẵn sàng viết nội dung</h3>
                   <p className="text-sm text-slate-400 max-w-sm mt-4 font-medium leading-relaxed">
                     Mục <span className="text-[#002D56] font-bold">"{selectedItem.title}"</span> hiện chưa có bản thảo. Anh/chị hãy tạo bản thảo mới để bắt đầu soạn thảo nội dung.
                   </p>
                   <button 
                     onClick={handleCreateDraft}
                     disabled={!isValidDraftableItem || isCreatingDraft}
                     className="mt-10 px-10 py-5 bg-[#002D56] text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isCreatingDraft ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                     TẠO BẢN THẢO CHO MỤC NÀY
                   </button>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-[32px] flex flex-col items-center justify-center p-20 text-center shadow-sm h-full min-h-[500px]">
               <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-[28px] flex items-center justify-center mb-8 border border-slate-100">
                  <BookOpen className="w-10 h-10" />
               </div>
               <h3 className="text-xl font-extrabold text-slate-800">Chọn nội dung soạn thảo</h3>
               <p className="text-sm text-slate-400 max-w-sm mt-3 font-medium">
                 Vui lòng chọn một mục trong đề cương ở danh sách bên trái để bắt đầu viết bản thảo.
               </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
