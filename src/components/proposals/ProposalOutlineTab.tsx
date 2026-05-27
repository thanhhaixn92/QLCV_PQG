import React, { useState, useEffect, useMemo } from 'react';
import { 
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  HelpCircle,
  Sparkles,
  Save
} from 'lucide-react';
import { 
  ProposalOutlineItem, 
  Proposal
} from '../../features/proposals/types';
import { 
  listOutlineItems, 
  suggestProposalOutline,
  saveOutlineItems,
  clearOutlineItems,
  listSources,
  applyProposalTemplate,
  updateOutlineItem,
  deleteOutlineItem,
  addOutlineItem
} from '../../features/proposals/proposalService';
import { 
  STANDARD_PROPOSAL_TEMPLATE, 
  RESTRUCTURE_AFTER_MERGER_TEMPLATE 
} from '../../features/proposals/proposalTemplates';
import { ProposalOutlineToolbar } from './ProposalOutlineToolbar';
import { ProposalOutlineTree } from './ProposalOutlineTree';
import { ProposalOutlineEditorModal } from './ProposalOutlineEditorModal';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface ProposalOutlineTabProps {
  userId: string;
  proposalId: string;
  proposal: Proposal;
  requestConfirmAsync?: (msg: string) => Promise<boolean>;
}

export const ProposalOutlineTab: React.FC<ProposalOutlineTabProps> = ({ 
  userId, 
  proposalId,
  proposal,
  requestConfirmAsync
}) => {
  const [items, setItems] = useState<ProposalOutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [templateConfig, setTemplateConfig] = useState<{ template: any; mode: 'append' | 'replace' } | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProposalOutlineItem | null>(null);
  const [newChildConfig, setNewChildConfig] = useState<{ parentId: string; level: number } | null>(null);

  useEffect(() => {
    if (userId && proposalId) {
      fetchOutline();
    }
  }, [userId, proposalId]);

  const fetchOutline = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await listOutlineItems(userId, proposalId);
      
      // Auto-normalize for UI if missing fields
      const normalized = data.map(item => {
        if (item.itemType) return item;
        
        const title = item.title.toUpperCase();
        if (item.level === 1 || title.startsWith("PHẦN") || title.startsWith("MỞ ĐẦU") || title.startsWith("PHỤ LỤC")) {
          return { ...item, itemType: "section" as const, isContainer: true, canHaveDraft: false, countInProgress: false };
        } else if (title.includes("PHỤ LỤC") || title.includes("BẢNG") || title.includes("SƠ ĐỒ") || title.includes("MA TRẬN") || title.includes("KPI")) {
          return { ...item, itemType: "appendix" as const, isContainer: false, canHaveDraft: false, countInProgress: true };
        }
        return { ...item, itemType: "content" as const, isContainer: false, canHaveDraft: true, countInProgress: true };
      });

      setItems(normalized);
    } catch (error: any) {
      console.error('Fetch outline error:', error);
      if (error?.message?.includes('permission-denied') || error?.code === 'permission-denied') {
        toast.error("Chưa có quyền đọc dữ liệu đề án. Vui lòng kiểm tra Firestore Rules hoặc đăng nhập lại.");
      } else {
        toast.error("Không thể tải đề cương");
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (item.code || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesLevel = levelFilter === 'all' || item.level.toString() === levelFilter;
      const matchesType = true; // Placeholder for future type filters
      return matchesSearch && matchesStatus && matchesLevel;
    });
  }, [items, searchQuery, statusFilter, levelFilter]);

  const handleAiSuggest = async () => {
    setIsSuggesting(true);
    try {
      const sources = await listSources(userId, proposalId);
      const result = await suggestProposalOutline(userId, proposalId, {
        proposal,
        sources,
        objectives: proposal.description || ""
      });
      setSuggestions(result.outlineItems);
      toast.success("AI đã tạo xong gợi ý đề cương!");
    } catch (error: any) {
      toast.error(error.message || "Gợi ý thất bại");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (!suggestions) return;
    setIsApplying(true);
    try {
      await clearOutlineItems(userId, proposalId);
      await saveOutlineItems(userId, proposalId, suggestions);
      await fetchOutline();
      setSuggestions(null);
      toast.success("Đã áp dụng đề cương gợi ý!");
    } catch (error: any) {
      toast.error(error.message || "Áp dụng thất bại");
    } finally {
      setIsApplying(false);
    }
  };

  const onApplyTemplate = (template: any) => {
    if (items.length > 0) {
      setTemplateConfig({ template, mode: 'replace' });
      setShowTemplateConfirm(true);
    } else {
      handleExecuteTemplate(template, 'replace');
    }
  };

  const handleExecuteTemplate = async (template: any, mode: 'append' | 'replace') => {
    setIsApplying(true);
    try {
      await applyProposalTemplate(userId, proposalId, template.outlineItems, mode);
      await fetchOutline();
      setShowTemplateConfirm(false);
      setTemplateConfig(null);
      toast.success(`Đã áp dụng ${template.name}!`);
    } catch (error: any) {
      toast.error(error.message || "Áp dụng mẫu thất bại");
    } finally {
      setIsApplying(false);
    }
  };

  const handleSaveItem = async (data: Partial<ProposalOutlineItem>) => {
    try {
      if (editingItem) {
        await updateOutlineItem(userId, proposalId, editingItem.id, data);
        toast.success("Đã cập nhật mục lục");
      } else {
        // Auto-classify new items if not provided
        let itemType = data.itemType;
        let isContainer = data.isContainer;
        let canHaveDraft = data.canHaveDraft;
        let countInProgress = data.countInProgress;

        if (!itemType) {
          const title = data.title?.toUpperCase() || "";
          if (data.level === 1 || title.startsWith("PHẦN") || title.startsWith("MỞ ĐẦU") || title.startsWith("PHỤ LỤC")) {
            itemType = "section";
            isContainer = true;
            canHaveDraft = false;
            countInProgress = false;
          } else if (title.includes("PHỤ LỤC") || title.includes("BẢNG") || title.includes("SƠ ĐỒ") || title.includes("MA TRẬN") || title.includes("KPI")) {
            itemType = "appendix";
            isContainer = false;
            canHaveDraft = false;
            countInProgress = true;
          } else {
            itemType = "content";
            isContainer = false;
            canHaveDraft = true;
            countInProgress = true;
          }
        }

        const order = items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0;
        await addOutlineItem(userId, proposalId, { 
          ...data, 
          itemType, 
          isContainer, 
          canHaveDraft, 
          countInProgress, 
          order 
        });
        toast.success("Đã thêm mục lục mới");
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setNewChildConfig(null);
      await fetchOutline();
    } catch (error: any) {
      toast.error("Lỗi khi lưu: " + error.message);
    }
  };

  const handleNormalizeOutline = async () => {
    setLoading(true);
    try {
      const updates = items.map(item => {
        if (item.itemType) return null; // Already has metadata
        
        let itemType: ProposalOutlineItem['itemType'] = 'content';
        let isContainer = false;
        let canHaveDraft = true;
        let countInProgress = true;

        const title = item.title.toUpperCase();
        if (item.level === 1 || title.startsWith("PHẦN") || title.startsWith("MỞ ĐẦU") || title.startsWith("PHỤ LỤC")) {
          itemType = "section";
          isContainer = true;
          canHaveDraft = false;
          countInProgress = false;
        } else if (title.includes("PHỤ LỤC") || title.includes("BẢNG") || title.includes("SƠ ĐỒ") || title.includes("MA TRẬN") || title.includes("KPI")) {
          itemType = "appendix";
          isContainer = false;
          canHaveDraft = false;
          countInProgress = true;
        }

        return { id: item.id, itemType, isContainer, canHaveDraft, countInProgress };
      }).filter(Boolean);

      if (updates.length === 0) {
        toast.success("Đề cương đã ở dạng chuẩn!");
        return;
      }

      for (const update of updates) {
        if (update) {
          const { id, ...data } = update;
          await updateOutlineItem(userId, proposalId, id, data);
        }
      }
      
      await fetchOutline();
      toast.success("Đã chuẩn hóa thành công!");
    } catch (error: any) {
      toast.error("Lỗi khi chuẩn hóa: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const hasChildren = items.some(i => i.parentId === id);
    const confirmMsg = hasChildren 
      ? "Mục này có các mục con. Anh/chị muốn xóa cả nhánh đề cương này không?"
      : "Bạn có chắc chắn muốn xóa mục này khỏi đề cương?";
      
    const confirmFn = requestConfirmAsync ? requestConfirmAsync : async (m: string) => window.confirm(m);
    if (await confirmFn(confirmMsg)) {
      try {
        await deleteOutlineItem(userId, proposalId, id);
        if (hasChildren) {
          const children = items.filter(i => i.parentId === id);
          for (const child of children) {
            await deleteOutlineItem(userId, proposalId, child.id);
          }
        }
        await fetchOutline();
        toast.success("Đã xóa mục lục");
      } catch (error: any) {
        toast.error("Lỗi khi xóa: " + error.message);
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: ProposalOutlineItem['status']) => {
    try {
      await updateOutlineItem(userId, proposalId, id, { status });
      setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      toast.success("Đã cập nhật trạng thái");
    } catch (error: any) {
      toast.error("Lỗi cập nhật: " + error.message);
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(i => i.id === id);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    
    const currentItem = items[currentIndex];
    const targetItem = items[targetIndex];
    
    try {
      await updateOutlineItem(userId, proposalId, currentItem.id, { order: targetItem.order });
      await updateOutlineItem(userId, proposalId, targetItem.id, { order: currentItem.order });
      await fetchOutline();
    } catch (error) {
      toast.error("Không thể thay đổi thứ tự");
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
        <p className="text-xs font-bold uppercase tracking-widest">Đang tải đề cương...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProposalOutlineToolbar 
        items={items}
        onApplyTemplate={onApplyTemplate}
        onNormalize={handleNormalizeOutline}
        onAddManual={() => {
          setEditingItem(null);
          setNewChildConfig(null);
          setIsModalOpen(true);
        }}
        onAiSuggest={handleAiSuggest}
        isSuggesting={isSuggesting}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
      />

      <AnimatePresence>
        {showTemplateConfirm && templateConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl p-10 max-w-md w-full border border-slate-100"
            >
              <div className="w-20 h-20 bg-blue-50 text-[#002D56] rounded-[24px] flex items-center justify-center mb-8 mx-auto shadow-inner">
                <HelpCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 text-center">Xác nhận áp dụng mẫu</h3>
              <p className="text-sm text-slate-500 mt-4 leading-relaxed text-center">
                Đề cương hiện tại đã có <span className="font-bold text-blue-600">{items.length} mục</span>. Anh/chị muốn thêm mẫu vào cuối danh sách hay thay thế toàn bộ bản thảo cũ?
              </p>
              
              <div className="grid grid-cols-2 gap-5 mt-10">
                <button
                  onClick={() => handleExecuteTemplate(templateConfig.template, 'append')}
                  disabled={isApplying}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] border border-slate-100 hover:bg-slate-50 transition-all group group hover:border-blue-200"
                >
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-700 tracking-wide uppercase">THÊM VÀO CUỐI</span>
                </button>
                <button
                  onClick={() => handleExecuteTemplate(templateConfig.template, 'replace')}
                  disabled={isApplying}
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-[24px] border border-red-50 hover:bg-red-50 transition-all group hover:border-red-200"
                >
                  <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-700 tracking-wide uppercase">THAY THẾ TẤT CẢ</span>
                </button>
              </div>

              <div className="mt-10 flex justify-center">
                <button 
                  onClick={() => setShowTemplateConfirm(false)}
                  className="px-10 py-4 text-slate-400 text-xs font-bold uppercase hover:bg-slate-50 rounded-2xl transition-all"
                >
                  Hủy và giữ nguyên
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {suggestions && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-blue-600 rounded-[32px] p-8 shadow-2xl shadow-blue-900/40 text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Sparkles className="w-32 h-32" />
            </div>
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-[24px] flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8 text-blue-100" />
              </div>
              <div className="max-w-md">
                <h4 className="text-xl font-extrabold tracking-tight">AI đã gợi ý xong đề cương chi tiết</h4>
                <p className="text-sm font-medium text-blue-100 mt-1">Bao gồm {suggestions.length} mục đề cương được tối ưu hóa dựa trên nguồn dữ liệu của bạn.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
              <button 
                onClick={() => setSuggestions(null)}
                className="flex-1 md:flex-none px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold uppercase transition-all backdrop-blur-md"
              >
                Bỏ qua
              </button>
              <button 
                onClick={handleApplySuggestions}
                disabled={isApplying}
                className="flex-1 md:flex-none px-8 py-4 bg-white text-blue-600 rounded-2xl text-xs font-bold uppercase shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Áp dụng đề cương
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProposalOutlineTree 
        items={filteredItems}
        onEdit={(item) => {
          setEditingItem(item);
          setNewChildConfig(null);
          setIsModalOpen(true);
        }}
        onDelete={handleDeleteItem}
        onAddChild={(parentId, level) => {
          setEditingItem(null);
          setNewChildConfig({ parentId, level });
          setIsModalOpen(true);
        }}
        onUpdateStatus={handleUpdateStatus}
        onMove={handleMove}
        onAiSuggest={handleAiSuggest}
      />

      <ProposalOutlineEditorModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
          setNewChildConfig(null);
        }}
        onSave={handleSaveItem}
        item={editingItem}
        parentId={newChildConfig?.parentId}
        level={newChildConfig?.level}
      />
    </div>
  );
};
