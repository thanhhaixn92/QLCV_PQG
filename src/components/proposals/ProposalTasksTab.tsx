import React, { useState, useEffect, useMemo } from 'react';
import { getRenderKey, staticKey } from '../../utils/listKeys';
import { 
  Plus, 
  Sparkles, 
  CheckCircle2, 
  Trash2, 
  Loader2,
  AlertCircle,
  Layout,
  CheckSquare,
  Clock,
  User,
  MoreVertical,
  ChevronRight,
  Edit2,
  Zap,
  Target,
  Search,
  Filter,
  Activity,
  Calendar,
  AlertTriangle,
  ClipboardList,
  ArrowRight,
  X,
  FileText,
  BadgeAlert,
  Database,
  Globe,
  ShieldCheck,
  PlusCircle
} from 'lucide-react';
import { 
  WorkTask
} from '../../types';
import {
  ProposalOutlineItem,
  Proposal
} from '../../features/proposals/types';
import { 
  listProposalTasks,
  addProposalTask,
  updateProposalTask,
  deleteProposalTask,
  listOutlineItems
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { apiFetchJson } from '../../services/apiClient';

interface ProposalTasksTabProps {
  userId: string;
  proposalId: string;
  proposal: Proposal;
  documents: any[];
  requestConfirmAsync?: (msg: string) => Promise<boolean>;
}

export const ProposalTasksTab: React.FC<ProposalTasksTabProps> = ({ 
  userId, 
  proposalId,
  proposal,
  documents,
  requestConfirmAsync
}) => {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [outlineItems, setOutlineItems] = useState<ProposalOutlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  
  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showManualForm, setShowManualForm] = useState(false);

  // Relationship Stats
  const [missingDataCount, setMissingDataCount] = useState(0);
  const [failedChecklistCount, setFailedChecklistCount] = useState(0);

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
      const [dataResponse, checklistResponse] = await Promise.all([
        apiFetchJson(`/api/proposals/${proposalId}/data-requirements/stats`, { headers }),
        apiFetchJson(`/api/proposals/${proposalId}/checklist/stats`, { headers })
      ]);
      
      if (dataResponse.success) {
        setMissingDataCount(dataResponse.stats.missingCount || 0);
      }
      if (checklistResponse.success) {
        setFailedChecklistCount(checklistResponse.stats.failCount || 0);
      }
    } catch (error) {
      console.warn('Failed to fetch cross-tab stats:', error);
    }
  };

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [tasksData, outlineData] = await Promise.all([
        listProposalTasks(userId, proposalId),
        listOutlineItems(userId, proposalId)
      ]);
      setTasks(tasksData);
      setOutlineItems(outlineData);
    } catch (error: any) {
      console.error('Fetch tasks/outline error:', error);
      if (error?.message?.includes('permission-denied') || error?.code === 'permission-denied') {
        toast.error("Chưa có quyền đọc dữ liệu đề án. Vui lòng kiểm tra Firestore Rules hoặc đăng nhập lại.");
      } else {
        toast.error("Không thể tải nhiệm vụ");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    try {
      await updateProposalTask(userId, proposalId, taskId, { status: status as any });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: status as any } : t));
      toast.success("Đã cập nhật trạng thái nhiệm vụ");
      // If linked, fetchData to sync source items
      fetchData();
    } catch (error) {
      toast.error("Lỗi cập nhật");
    }
  };

  const handleDelete = async (taskId: string) => {
    const confirmFn = requestConfirmAsync ? requestConfirmAsync : async (m: string) => window.confirm(m);
    if (!(await confirmFn("Xóa nhiệm vụ này?"))) return;
    try {
      await deleteProposalTask(userId, proposalId, taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
      toast.success("Đã xóa nhiệm vụ");
    } catch (error) {
      toast.error("Lỗi khi xóa");
    }
  };

  const handleCreateTask = async (taskData: Partial<WorkTask>) => {
    try {
      await addProposalTask(userId, proposalId, {
        ...taskData,
        status: 'todo',
        priority: taskData.priority || 'medium',
        source: 'manual',
        assignee: taskData.assignee || 'Chưa gán',
        dueDate: taskData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      setShowManualForm(false);
      fetchData();
      toast.success("Đã tạo nhiệm vụ mới.");
    } catch (error) {
      toast.error("Lỗi khi tạo nhiệm vụ.");
    }
  };

  const handleAiExtract = async () => {
    if (!aiInput.trim()) return;
    const user = auth.currentUser;
    if (!user) {
      toast.error("Vui lòng đăng nhập để sử dụng tính năng này.");
      return;
    }
    
    setIsAiProcessing(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taskType: 'TASK_BUILDER',
          input: aiInput,
          context: `Đề án: ${proposal.name}\nLĩnh vực: ${proposal.category}`
        })
      });
      
      const data = await response.json();
      if (data.success && data.taskDrafts) {
        const promises = data.taskDrafts.map((draft: any) => 
          addProposalTask(userId, proposalId, {
            title: draft.title,
            description: draft.description,
            assignee: draft.assignee,
            dueDate: draft.dueDate,
            priority: draft.priority,
            source: 'ai'
          })
        );
        await Promise.all(promises);
        fetchData();
        setAiInput('');
        setShowAiBuilder(false);
        toast.success(`Đã trích xuất và tạo ${data.taskDrafts.length} nhiệm vụ.`);
      } else {
        toast.error("AI không tìm thấy nhiệm vụ nào trong văn bản.");
      }
    } catch (error) {
      toast.error("Lỗi xử lý AI.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, percent: 0 };
    const todo = tasks.filter(t => (t.status as string) === 'todo').length;
    const inProgress = tasks.filter(t => (t.status as string) === 'in_progress' || (t.status as string) === 'doing').length;
    const done = tasks.filter(t => (t.status as string) === 'done' || (t.status as string) === 'completed').length;
    const overdue = tasks.filter(t => (t.status as string) !== 'done' && (t.status as string) !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const percent = Math.round((done / total) * 100);

    return { total, todo, inProgress, done, overdue, percent };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (t.assignee || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, filterStatus, filterPriority]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-[#002D56]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Overview Dashboard */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
           <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                   <Activity className="w-7 h-7 text-indigo-600" /> TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ
                 </h3>
                 <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-[#002D56]">{stats.percent}%</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">Hoàn thành</span>
                 </div>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-50 p-0.5 shadow-inner">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${stats.percent}%` }}
                   className="h-full bg-gradient-to-r from-indigo-500 via-blue-600 to-[#002D56] rounded-full shadow-lg"
                 />
              </div>
           </div>
           <div className="shrink-0 flex items-center gap-3">
              <button 
                onClick={() => setShowAiBuilder(true)}
                className="px-8 py-5 bg-emerald-100 text-emerald-700 rounded-3xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-900/10 border-2 border-emerald-200 transition-all flex items-center gap-3"
              >
                <Sparkles className="w-5 h-5" /> AI TRÍCH XUẤT
              </button>
              <button 
                onClick={() => setShowManualForm(true)}
                className="px-10 py-5 bg-[#002D56] text-white rounded-3xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
              >
                <Plus className="w-5 h-5" /> THÊM MỚI
              </button>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
           {[
             { label: 'Tổng nhiệm vụ', value: stats.total, color: 'bg-slate-50 text-slate-600 border-slate-100' },
             { label: 'Chưa làm', value: stats.todo, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
             { label: 'Đang triển khai', value: stats.inProgress, color: 'bg-blue-50 text-blue-600 border-blue-100' },
             { label: 'Đã hoàn tất', value: stats.done, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
             { label: 'Chậm tiến độ', value: stats.overdue, color: 'bg-rose-100 text-rose-700 border-rose-200' },
           ].map((stat, idx) => (
             <div key={staticKey("task-stat", stat.label, idx)} className={cn("p-5 rounded-[24px] border-2 flex flex-col items-center justify-center text-center transition-all hover:scale-105 shadow-sm", stat.color)}>
                <span className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1.5 leading-none">{stat.label}</span>
                <span className="text-2xl font-black tabular-nums">{stat.value}</span>
             </div>
           ))}
        </div>

        {/* Relationship Alerts */}
        {(missingDataCount > 0 || failedChecklistCount > 0) && (
          <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-slate-100">
            {missingDataCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm"
              >
                <Database className="w-4 h-4" />
                <span>Có {missingDataCount} mục số liệu còn thiếu cần lập kế hoạch thu thập.</span>
              </motion.div>
            )}
            {failedChecklistCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{failedChecklistCount} tiêu chuẩn/vướng mắc checklist đang cần xử lý.</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* 2. Filters & View Settings */}
      <div className="flex flex-col md:flex-row gap-5 items-center bg-white border border-slate-200 rounded-[32px] p-5 shadow-sm">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
           <input 
             type="text"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Tìm tên nhiệm vụ, người phối hợp hoặc nội dung..."
             className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm outline-none focus:bg-white focus:border-blue-400 transition-all font-bold text-slate-700 shadow-inner"
           />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <select 
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value)}
             className="px-5 py-3.5 bg-white rounded-[20px] border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 cursor-pointer hover:border-blue-200 transition-all shadow-sm"
           >
             <option value="all">MỌI TRẠNG THÁI</option>
             <option value="todo">CHƯA LÀM</option>
             <option value="in_progress">ĐANG LÀM</option>
             <option value="done">XONG</option>
           </select>
           <select 
             value={filterPriority}
             onChange={(e) => setFilterPriority(e.target.value)}
             className="px-5 py-3.5 bg-white rounded-[20px] border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 cursor-pointer hover:border-blue-200 transition-all shadow-sm"
           >
             <option value="all">MỌI ƯU TIÊN</option>
             <option value="high">CAO / KHẨN</option>
             <option value="medium">TRUNG BÌNH</option>
             <option value="low">THẤP</option>
           </select>
        </div>
      </div>

      {/* 3. Task List Components */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-4">
           {filteredTasks.length > 0 ? (
             <div className="grid grid-cols-1 gap-4">
               {filteredTasks.map((task, idx) => (
                 <TaskCard 
                   key={`${task.id}-${idx}`}
                   task={task}
                   onUpdateStatus={(s) => handleUpdateStatus(task.id, s)}
                   onDelete={() => handleDelete(task.id)}
                 />
               ))}
             </div>
           ) : (
             <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-20 text-center flex flex-col items-center justify-center">
                <ClipboardList className="w-16 h-16 text-slate-100 mb-6" />
                <h4 className="text-xl font-black text-slate-300 uppercase tracking-widest">Không tìm thấy nhiệm vụ nào</h4>
                <p className="text-xs text-slate-400 font-bold mt-2 italic max-w-sm">Hãy thử thay đổi bộ lọc hoặc tạo thêm nhiệm vụ mới từ danh mục số liệu/checklist.</p>
             </div>
           )}
        </div>

        {/* 4. Side Panels: AI Extraction Tool & Manual Creation */}
        <div className="xl:col-span-4 space-y-8">
           {showManualForm ? (
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="bg-white border-2 border-blue-50 bg-gradient-to-br from-white to-blue-50/30 rounded-[40px] p-8 shadow-xl shadow-blue-900/5"
             >
                <div className="flex items-center justify-between mb-8">
                   <h4 className="text-sm font-black text-[#002D56] uppercase tracking-widest flex items-center gap-3">
                      <PlusCircle className="w-5 h-5 text-blue-600" /> Tạo việc mới
                   </h4>
                   <button onClick={() => setShowManualForm(false)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-full transition-all">
                      <X className="w-5 h-5" />
                   </button>
                </div>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tên nhiệm vụ</label>
                      <input 
                        type="text" 
                        placeholder="VD: Rà soát phụ lục 3..."
                        className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black outline-none focus:border-blue-400 transition-all shadow-sm"
                        id="new-task-title"
                      />
                   </div>
                   <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nội dung chi tiết</label>
                       <textarea 
                         rows={4}
                         placeholder="Chi tiết công việc cần làm..."
                         className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-medium outline-none focus:border-blue-400 transition-all shadow-sm resize-none"
                         id="new-task-desc"
                       />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Người xử lý</label>
                         <input 
                           type="text"
                           placeholder="Tên CB/Phòng ban"
                           className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400 shadow-sm"
                           id="new-task-assignee"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Hạn định</label>
                         <input 
                           type="date"
                           className="w-full p-4 bg-white border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400 shadow-sm"
                           id="new-task-date"
                         />
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        const titleEl = document.getElementById('new-task-title') as HTMLInputElement;
                        const descEl = document.getElementById('new-task-desc') as HTMLTextAreaElement;
                        const assigneeEl = document.getElementById('new-task-assignee') as HTMLInputElement;
                        const dateEl = document.getElementById('new-task-date') as HTMLInputElement;
                        handleCreateTask({
                           title: titleEl.value,
                           description: descEl.value,
                           assignee: assigneeEl.value,
                           dueDate: dateEl.value
                        });
                     }}
                     className="w-full py-5 bg-[#002D56] text-white rounded-3xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >CHỐT TẠO NHIỆM VỤ</button>
                </div>
             </motion.div>
           ) : (
             <div className="space-y-6">
                <div 
                  onClick={() => setShowManualForm(true)}
                  className="bg-white border-2 border-slate-100 border-dashed rounded-[40px] p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                >
                   <PlusCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Bấm để tạo nhanh nhiệm vụ mới</h5>
                </div>

                <div className="bg-gradient-to-br from-[#002D56] to-[#00427A] rounded-[40px] p-8 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
                      <Brain className="w-32 h-32" />
                   </div>
                   <Zap className="w-10 h-10 text-yellow-400 mb-6" />
                   <h4 className="text-xl font-black mb-3">AI Task Builder</h4>
                   <p className="text-xs text-blue-100 leading-relaxed italic mb-8 font-medium">Bóc tách công việc từ văn bản nguồn, ghi chú họp hoặc ý kiến chỉ đạo của lãnh đạo bằng trí tuệ nhân tạo.</p>
                   <button 
                     onClick={() => setShowAiBuilder(true)}
                     className="w-full py-5 bg-white/10 hover:bg-white text-blue-900 rounded-[24px] text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-xl border border-white/20"
                   >TRẢI NGHIỆM TRỢ LÝ AI</button>
                </div>
             </div>
           )}
        </div>
      </div>

      {/* AI Builder Modal */}
      <AnimatePresence>
        {showAiBuilder && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 30 }}
               className="bg-white w-full max-w-2xl rounded-[48px] overflow-hidden shadow-2xl"
            >
               <div className="px-10 py-10 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
                  <div className="flex items-center gap-5">
                     <div className="p-4 bg-white/20 rounded-[20px] backdrop-blur-md">
                        <Sparkles className="w-7 h-7" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black italic tracking-tight">AI Task Builder</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">Trợ lý Phân rã Đầu việc</p>
                     </div>
                  </div>
                  <button onClick={() => setShowAiBuilder(false)} className="p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-2xl transition-all">
                    <X className="w-6 h-6" />
                  </button>
               </div>
               <div className="p-12 space-y-8">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nội dung thô / Ghi chú buổi họp</label>
                     <textarea 
                       rows={8}
                       value={aiInput}
                       onChange={(e) => setAiInput(e.target.value)}
                       className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[32px] text-sm font-medium outline-none focus:bg-white focus:border-emerald-400 transition-all custom-scrollbar resize-none leading-relaxed"
                       placeholder="Ví dụ: - Cần rà soát lại số liệu tài chính 3 năm gần nhất. - Anh Nam chuẩn bị hồ sơ thầu. - Chị Lan liên hệ sở kế hoạch để lấy văn bản pháp lý..."
                     />
                  </div>
                  <div className="flex bg-amber-50 p-6 rounded-[24px] border border-amber-100 gap-4">
                     <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                     <p className="text-[11px] text-amber-900 font-bold leading-relaxed italic">AI sẽ phân tích các hành động, người thực hiện và thời hạn để tự động đưa vào danh sách nhiệm vụ của dự án.</p>
                  </div>
                  <button 
                    onClick={handleAiExtract}
                    disabled={isAiProcessing || !aiInput.trim()}
                    className="w-full py-6 bg-emerald-600 text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-2xl shadow-emerald-900/40 hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                  >
                     {isAiProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
                     BẮT ĐẦU TRÍCH XUẤT VIỆC
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Subcomponent: TaskCard
const TaskCard = ({ task, onUpdateStatus, onDelete }: { task: WorkTask, onUpdateStatus: (s: string) => void | Promise<void>, onDelete: () => void | Promise<void> }) => {
  const isOverdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate) < new Date();
  
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high': return { label: 'KHẨN / CAO', color: 'bg-orange-50 text-orange-600 border-orange-200' };
      case 'urgent': return { label: 'KHẨN CẤP', color: 'bg-red-50 text-red-600 border-red-200' };
      case 'medium': return { label: 'TRUNG BÌNH', color: 'bg-blue-50 text-blue-600 border-blue-200' };
      default: return { label: 'THẤP', color: 'bg-slate-50 text-slate-500 border-slate-200' };
    }
  };

  const currentPriority = getPriorityConfig(task.priority || 'medium');

  return (
    <motion.div 
      layout
      className={cn(
        "bg-white border-2 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group overflow-hidden border-slate-100",
        task.status === 'done' ? "opacity-60 bg-slate-50 border-transparent shadow-none" : "hover:border-indigo-100"
      )}
    >
       <div className="flex items-center gap-6 flex-1 min-w-0">
          <div 
             onClick={() => onUpdateStatus(task.status === 'done' ? 'todo' : 'done')}
             className={cn(
               "w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 border-2 cursor-pointer transition-all",
               task.status === 'done' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-200 hover:border-emerald-400 hover:text-emerald-500"
             )}
          >
             <CheckCircle2 className={cn("w-7 h-7", task.status === 'done' ? "scale-110" : "")} />
          </div>
          
          <div className="min-w-0 flex-1">
             <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={cn("px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-tighter border shadow-sm shrink-0", currentPriority.color)}>
                   {currentPriority.label}
                </span>
                {(task.sourceType as any) === 'data_requirement' && (
                  <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-100 shadow-sm flex items-center gap-2">
                     <Database className="w-3 h-3" /> NGUỒN: SỐ LIỆU
                  </span>
                )}
                {task.sourceType === 'checklist_item' && (
                  <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-100 shadow-sm flex items-center gap-2">
                     <ClipboardList className="w-3 h-3" /> NGUỒN: CHECKLIST
                  </span>
                )}
                {isOverdue && <span className="bg-rose-600 text-white px-2 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-rose-900/20"><BadgeAlert className="w-3 h-3" /> CHẬM TIẾN ĐỘ</span>}
             </div>
             <h4 className={cn("text-base font-black text-slate-800 leading-[1.3] truncate", task.status === 'done' ? "text-slate-400 italic font-bold" : "")}>{task.title}</h4>
             <div className="flex flex-wrap items-center gap-5 mt-2.5">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <User className="w-3.5 h-3.5 text-slate-300" /> {task.assignee || 'H/D'}
                </div>
                <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-widest", isOverdue ? "text-rose-500 animate-pulse" : "text-slate-400")}>
                   <Calendar className="w-3.5 h-3.5 opacity-60" /> {task.dueDate || 'H/D'}
                </div>
             </div>
          </div>
       </div>

       <div className="flex items-center gap-3 shrink-0">
          <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-100">
             <button 
               onClick={() => onUpdateStatus('todo')}
               className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", task.status === 'todo' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
             >CHƯA LÀM</button>
             <button 
               onClick={() => onUpdateStatus('in_progress')}
               className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", task.status === 'in_progress' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
             >ĐANG LÀM</button>
             <button 
               onClick={() => onUpdateStatus('done')}
               className={cn("px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", task.status === 'done' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
             >XONG</button>
          </div>
          <button onClick={onDelete} className="p-3 text-slate-200 hover:border-rose-100 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border-2 border-transparent group-hover:bg-slate-50">
             <Trash2 className="w-5 h-5" />
          </button>
       </div>
    </motion.div>
  );
};

// Add missing icon for the export
const Brain = ({ className }: { className?: string }) => <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13a9 9 0 0118 0" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 13a5 5 0 0110 0" /></svg>;
