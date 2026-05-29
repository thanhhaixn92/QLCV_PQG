import React, { useState, useEffect, useMemo } from 'react';
import { getRenderKey, staticKey } from '../../utils/listKeys';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  CheckSquare, 
  Clock, 
  ChevronDown,
  LayoutGrid,
  ShieldCheck,
  Zap,
  ArrowRight,
  ClipboardList,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  PlusCircle,
  Activity,
  Maximize2
} from 'lucide-react';
import { ProposalChecklistItem, ProposalOutlineItem } from '../../features/proposals/types';
import { EvidenceLinker } from './EvidenceLinker';
import { 
  listChecklistItems, 
  updateChecklistItem, 
  deleteChecklistItem, 
  createTemplateChecklist,
  listOutlineItems,
  addProposalTask
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { apiFetchJson } from '../../services/apiClient';
import { auth } from '../../lib/firebase';

interface ProposalChecklistTabProps {
  userId: string;
  proposalId: string;
  requestConfirmAsync?: (msg: string) => Promise<boolean>;
}

export const ProposalChecklistTab: React.FC<ProposalChecklistTabProps> = ({ 
  userId, 
  proposalId,
  requestConfirmAsync
}) => {
  const [items, setItems] = useState<ProposalChecklistItem[]>([]);
  const [outlineItems, setOutlineItems] = useState<ProposalOutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'group' | 'outline'>('group');

  // Relationship Stats
  const [dataNeedsVerifyCount, setDataNeedsVerifyCount] = useState(0);
  const [activeTasksCount, setActiveTasksCount] = useState(0);

  useEffect(() => {
    if (userId && proposalId) {
      fetchData();
      fetchRelationshipStats();
    }
  }, [userId, proposalId]);

  const fetchRelationshipStats = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [dataResponse, tasksResponse] = await Promise.all([
        apiFetchJson(`/api/proposals/${proposalId}/data-requirements/stats`, { headers }),
        apiFetchJson(`/api/proposals/${proposalId}/tasks/stats`, { headers })
      ]);
      
      if (dataResponse.success) {
        setDataNeedsVerifyCount(dataResponse.stats.needsVerificationCount || 0);
      }
      if (tasksResponse.success) {
        setActiveTasksCount(tasksResponse.activeCount || 0);
      }
    } catch (error) {
      console.warn('Failed to fetch cross-tab stats:', error);
    }
  };

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [checklistData, outlineData] = await Promise.all([
        listChecklistItems(userId, proposalId),
        listOutlineItems(userId, proposalId)
      ]);
      setItems(checklistData);
      setOutlineItems(outlineData);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('permission-denied') || error?.code === 'permission-denied') {
        toast.error("Chưa có quyền đọc dữ liệu đề án. Vui lòng kiểm tra Firestore Rules hoặc đăng nhập lại.");
      } else {
        toast.error("Không thể tải checklist");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    setIsSeeding(true);
    try {
      await createTemplateChecklist(userId, proposalId);
      toast.success("Đã tạo checklist chuẩn theo quy chuẩn đề án!");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tạo checklist");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, newStatus: ProposalChecklistItem['status']) => {
    try {
      await updateChecklistItem(userId, proposalId, itemId, { status: newStatus });
      setItems(items.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
      toast.success("Đã cập nhật trạng thái kiểm tra");
    } catch (error) {
      toast.error("Lỗi cập nhật");
    }
  };

  const handleCreateTaskFromItem = async (item: ProposalChecklistItem) => {
    try {
      const severity = item.severity === 'high' || item.severity === 'blocker' ? 'high' : 'medium';
      
      await addProposalTask(userId, proposalId, {
        title: `Xử lý Checklist: ${item.title}`,
        description: `Nhiệm vụ xử lý vấn đề "${item.title}" chưa đạt trong Checklist.\nNhóm: ${item.group}\nChi tiết: ${item.description || ''}`,
        priority: severity,
        sourceType: 'checklist_item',
        sourceId: item.id,
        sourceLabel: 'Checklist' as any,
        status: 'todo',
        assignee: 'Đang chờ phân công'
      });
      
      await updateChecklistItem(userId, proposalId, item.id, {
        taskId: 'created',
        taskStatus: 'todo'
      });
      
      fetchData();
      toast.success("Đã tạo nhiệm vụ xử lý vướng mắc.");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tạo nhiệm vụ.");
    }
  };

  const handleDelete = async (itemId: string) => {
    const confirmFn = requestConfirmAsync ? requestConfirmAsync : async (m: string) => window.confirm(m);
    if (!(await confirmFn("Xóa mục kiểm tra này?"))) return;
    try {
      await deleteChecklistItem(userId, proposalId, itemId);
      setItems(items.filter(item => item.id !== itemId));
      toast.success("Đã xóa");
    } catch (error) {
      toast.error("Lỗi xóa");
    }
  };

  const handleLinkOutline = async (itemId: string, outlineItemId: string) => {
    try {
      await updateChecklistItem(userId, proposalId, itemId, { outlineItemId });
      setItems(items.map(item => item.id === itemId ? { ...item, outlineItemId } : item));
      toast.success("Đã liên kết mục đề cương");
    } catch (error) {
      toast.error("Lỗi liên kết");
    }
  };

  const groups = useMemo(() => {
    const defaultGroups = [
      "Cơ sở Pháp lý & Thẩm quyền",
      "Sự cần thiết & Mục tiêu",
      "Giải pháp triển khai",
      "Đánh giá tác động & Hiệu quả",
      "Năng lực tổ chức thực hiện",
      "Hồ sơ tài liệu kèm theo",
      "Khác"
    ];
    const existingGroups = Array.from(new Set(items.map(i => i.group)));
    return Array.from(new Set([...defaultGroups, ...existingGroups]));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (item.group || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = filterGroup === 'all' || item.group === filterGroup;
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [items, searchQuery, filterGroup, filterStatus]);

  const stats = useMemo(() => {
    const total = items.length;
    if (total === 0) return { percent: 0, pass: 0, total: 0, fail: 0, needsReview: 0, blocker: 0 };
    const pass = items.filter(i => (i.status as string) === 'pass').length;
    const fail = items.filter(i => (i.status as string) === 'fail').length;
    const needsReview = items.filter(i => (i.status as string) === 'needs_review').length;
    const blocker = items.filter(i => (i.status as string) === 'blocker').length;
    
    return {
      percent: Math.round((pass / total) * 100),
      pass,
      fail,
      needsReview,
      blocker,
      total
    };
  }, [items]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pass': return { label: 'Đạt yêu cầu', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle };
      case 'fail': return { label: 'Chưa đạt', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle };
      case 'needs_review': return { label: 'Cần xem xét', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: HelpCircle };
      case 'blocker': return { label: 'Rủi ro cao', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: AlertTriangle };
      default: return { label: 'Chưa kiểm tra', color: 'bg-slate-50 text-slate-400 border-slate-100', icon: Clock };
    }
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'blocker': return { label: 'Nghiêm trọng', color: 'bg-rose-50 text-rose-600 border-rose-100' };
      case 'high': return { label: 'Cao', color: 'bg-orange-50 text-orange-600 border-orange-100' };
      case 'medium': return { label: 'Trung bình', color: 'bg-blue-50 text-blue-600 border-blue-100' };
      default: return { label: 'Thấp', color: 'bg-slate-50 text-slate-500 border-slate-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-[#002D56]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Progress Header */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
           <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                   <ShieldCheck className="w-7 h-7 text-emerald-600" /> KIỂM SOÁT TIÊU CHÍ ĐỀ ÁN
                 </h3>
                 <div className="flex items-center gap-3">
                   <span className="text-3xl font-black text-[#002D56]">{stats.percent}%</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Đạt yêu cầu</span>
                 </div>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-50 p-0.5 shadow-inner">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${stats.percent}%` }}
                   className="h-full bg-gradient-to-r from-emerald-500 via-teal-600 to-green-700 rounded-full shadow-lg"
                 />
              </div>
           </div>
           <div className="shrink-0 flex items-center gap-3">
              <button 
                onClick={handleCreateTemplate}
                disabled={isSeeding}
                className="px-10 py-5 bg-[#002D56] text-white rounded-3xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                TẠO CHECKLIST CHUẨN
              </button>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
           {[
             { label: 'Tổng mục tiêu', value: stats.total, color: 'bg-slate-50 text-slate-600' },
             { label: 'Đã đạt', value: stats.pass, color: 'bg-emerald-50 text-emerald-600' },
             { label: 'Cần xem xét', value: stats.needsReview, color: 'bg-orange-50 text-orange-600' },
             { label: 'Chưa đạt', value: stats.fail, color: 'bg-red-50 text-red-600' },
             { label: 'Rủi ro lớn', value: stats.blocker, color: 'bg-rose-100 text-rose-700' },
           ].map((stat, idx) => (
             <div key={staticKey("checklist-stat", stat.label, idx)} className={cn("p-5 rounded-[24px] border-2 border-transparent flex flex-col items-center justify-center text-center transition-all hover:scale-105 shadow-sm", stat.color)}>
                <span className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1.5 leading-none">{stat.label}</span>
                <span className="text-2xl font-black tabular-nums">{stat.value}</span>
             </div>
           ))}
        </div>

        {/* Relationship Alerts */}
        {(dataNeedsVerifyCount > 0 || activeTasksCount > 0) && (
          <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-slate-100">
            {dataNeedsVerifyCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-5 py-3 bg-purple-50 border border-purple-100 text-purple-700 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Có {dataNeedsVerifyCount} mục số liệu vừa import cần được xác minh.</span>
              </motion.div>
            )}
            {activeTasksCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm"
              >
                <Clock className="w-4 h-4" />
                <span>{activeTasksCount} nhiệm vụ xử lý vướng mắc đang thực hiện.</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* 2. Control Tools */}
      <div className="flex flex-col md:flex-row gap-5 items-center bg-white border border-slate-200 rounded-[32px] p-5 shadow-sm">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
           <input 
             type="text"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Tìm tên nội dung kiểm soát, vướng mắc, sai sót..."
             className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm outline-none focus:bg-white focus:border-blue-400 transition-all font-bold text-slate-700 shadow-inner"
           />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              <button 
                onClick={() => setViewMode('group')}
                className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'group' ? "bg-white text-blue-900 shadow-xl" : "text-slate-400")}
              >NHÓM</button>
              <button 
                onClick={() => setViewMode('outline')}
                className={cn("px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'outline' ? "bg-white text-blue-900 shadow-xl" : "text-slate-400")}
              >ĐỀ CƯƠNG</button>
           </div>
           {/* Filters */}
           <select 
             value={filterGroup}
             onChange={(e) => setFilterGroup(e.target.value)}
             className="px-5 py-3.5 bg-white rounded-[20px] border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 cursor-pointer hover:border-blue-200 transition-all shadow-sm"
           >
             <option value="all">MỌI NHÓM KIỂM SOÁT</option>
             {groups.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
           </select>
        </div>
      </div>

      {/* 3. Items View */}
      <div className="space-y-12">
        {viewMode === 'group' ? (
           groups.filter(g => filterGroup === 'all' || g === filterGroup).map(group => {
            const groupItems = filteredItems.filter(i => i.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group} className="space-y-6">
                <div className="flex items-center gap-6 px-4">
                   <div className="flex items-center gap-3">
                     <div className="w-2.5 h-7 bg-emerald-600 rounded-full" />
                     <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">{group}</h4>
                   </div>
                   <div className="flex-1 h-px bg-slate-100" />
                   <span className="text-[10px] font-black text-slate-400 italic">{groupItems.length} MỤC</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupItems.map((item, idx) => (
                    <ChecklistItemCard 
                      key={`${item.id}-${idx}`}
                      item={item}
                      outlineItems={outlineItems}
                      onUpdateStatus={(s) => handleUpdateStatus(item.id, s)}
                      onDelete={() => handleDelete(item.id)}
                      onLinkOutline={(oid) => handleLinkOutline(item.id, oid)}
                      onCreateTask={() => handleCreateTaskFromItem(item)}
                      getStatusConfig={getStatusConfig}
                      getSeverityConfig={getSeverityConfig}
                      userId={userId}
                      proposalId={proposalId}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="space-y-12">
             {outlineItems.map(outline => {
                const outlineItemsToCheck = filteredItems.filter(i => i.outlineItemId === outline.id);
                if (outlineItemsToCheck.length === 0) return null;

                return (
                  <div key={outline.id} className="space-y-6">
                    <div className="flex items-center gap-6 px-4">
                       <div className="flex items-center gap-3">
                         <div className="w-2.5 h-7 bg-[#002D56] rounded-full" />
                         <h4 className="text-sm font-black text-slate-800 tracking-tight">{outline.code || outline.level}. {outline.title}</h4>
                       </div>
                       <div className="flex-1 h-px bg-slate-100" />
                       <span className="text-[10px] font-black text-slate-400 italic">{outlineItemsToCheck.length} MỤC</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {outlineItemsToCheck.map((item, idx) => (
                        <ChecklistItemCard 
                          key={`${item.id}-${idx}`}
                          item={item}
                          outlineItems={outlineItems}
                          onUpdateStatus={(s) => handleUpdateStatus(item.id, s)}
                          onDelete={() => handleDelete(item.id)}
                          onLinkOutline={(oid) => handleLinkOutline(item.id, oid)}
                          onCreateTask={() => handleCreateTaskFromItem(item)}
                          getStatusConfig={getStatusConfig}
                          getSeverityConfig={getSeverityConfig}
                          userId={userId}
                          proposalId={proposalId}
                        />
                      ))}
                    </div>
                  </div>
                );
             })}
             {filteredItems.filter(i => !i.outlineItemId).length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center gap-6 px-4">
                       <div className="flex items-center gap-3">
                         <div className="w-2.5 h-7 bg-slate-300 rounded-full" />
                         <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Tiêu chí chung (Chưa gắn đề cương)</h4>
                       </div>
                       <div className="flex-1 h-px bg-slate-100" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredItems.filter(i => !i.outlineItemId).map((item, idx) => (
                        <ChecklistItemCard 
                          key={`${item.id}-${idx}`}
                          item={item}
                          outlineItems={outlineItems}
                          onUpdateStatus={(s) => handleUpdateStatus(item.id, s)}
                          onDelete={() => handleDelete(item.id)}
                          onLinkOutline={(oid) => handleLinkOutline(item.id, oid)}
                          onCreateTask={() => handleCreateTaskFromItem(item)}
                          getStatusConfig={getStatusConfig}
                          getSeverityConfig={getSeverityConfig}
                          userId={userId}
                          proposalId={proposalId}
                        />
                      ))}
                    </div>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

// Internal Sub-component for clarity
interface ChecklistItemCardProps {
  item: ProposalChecklistItem;
  outlineItems: ProposalOutlineItem[];
  onUpdateStatus: (status: ProposalChecklistItem['status']) => void;
  onDelete: () => void;
  onLinkOutline: (outlineId: string) => void;
  onCreateTask: () => void;
  getStatusConfig: (status: string) => any;
  getSeverityConfig: (severity: string) => any;
  userId: string;
  proposalId: string;
}

const ChecklistItemCard: React.FC<ChecklistItemCardProps> = ({ 
  item, 
  outlineItems, 
  onUpdateStatus, 
  onDelete, 
  onLinkOutline,
  onCreateTask,
  getStatusConfig,
  getSeverityConfig,
  userId,
  proposalId
}) => {
  const statusInfo = getStatusConfig(item.status);
  const severityInfo = getSeverityConfig(item.severity || 'medium');

  return (
    <motion.div 
      layout
      className="bg-white border-2 border-slate-100 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:shadow-blue-900/5 hover:border-blue-100 transition-all flex flex-col group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4">
         {item.taskId && (
           <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg animate-pulse" title="Đang có nhiệm vụ xử lý vướng mắc này">
              <Activity className="w-4 h-4" />
           </span>
         )}
      </div>

      <div className="flex items-start justify-between mb-6">
         <div 
           onClick={() => {
             const states: ProposalChecklistItem['status'][] = ['pass', 'fail', 'needs_review', 'blocker'];
             const next = states[(states.indexOf(item.status) + 1) % states.length];
             onUpdateStatus(next);
           }}
           className={cn("px-4 py-2 rounded-2xl flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer hover:scale-105 active:scale-95 border shadow-sm", statusInfo.color)}
         >
            <statusInfo.icon className="w-4 h-4" />
            {statusInfo.label}
         </div>
         <div className={cn("px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter border shadow-sm", severityInfo.color)}>
            {severityInfo.label}
         </div>
      </div>

      <div className="flex-1 mb-8">
        <h5 className="text-base font-black text-slate-800 leading-[1.3] mb-3">{item.title}</h5>
        <p className="text-xs text-slate-400 font-bold leading-relaxed line-clamp-3 italic">"{item.description || 'Tiêu chí kiểm soát quy chuẩn'}"</p>
      </div>

      <div className="space-y-4 pt-6 border-t-2 border-slate-50">
         <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">
               <ArrowRight className="w-3 h-3" /> Gắn với mục đề cương
            </div>
            <select 
              value={item.outlineItemId || ''}
              onChange={(e) => onLinkOutline(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-3 text-[11px] font-bold outline-none cursor-pointer hover:bg-white transition-all shadow-sm"
            >
               <option value="">Chưa liên kết đề cương</option>
               {outlineItems.map(oi => (
                 <option key={oi.id} value={oi.id}>{oi.code || oi.level}. {oi.title}</option>
               ))}
            </select>
         </div>

         <div className="flex flex-wrap gap-2 pt-2">
           {(item.status === 'fail' || item.status === 'needs_review' || item.status === 'blocker') && !item.taskId && (
             <button 
               onClick={onCreateTask}
               className="flex-1 min-w-[120px] px-4 py-3 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
             >
                <PlusCircle className="w-3.5 h-3.5" /> XỬ LÝ VƯỚNG MẮC
             </button>
           )}
           <button className="px-4 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[9px] font-black uppercase hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm">SỬA</button>
           {item.status !== 'pass' && (
             <button 
               onClick={() => onUpdateStatus('pass')}
               className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10"
             >CHỐT ĐẠT</button>
           )}
         </div>

         <div className="pt-2">
            <EvidenceLinker 
               userId={userId}
               proposalId={proposalId}
               targetType="checklistItem"
               targetId={item.id}
            />
         </div>
      </div>

      <button onClick={onDelete} className="absolute bottom-4 right-4 p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
