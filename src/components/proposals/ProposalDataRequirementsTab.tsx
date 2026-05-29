import React, { useState, useEffect, useMemo } from 'react';
import { getRenderKey, staticKey } from '../../utils/listKeys';
import { 
  BarChart, 
  Database, 
  Search, 
  Filter, 
  LayoutGrid, 
  Plus, 
  Loader2, 
  Trash2, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Building,
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Brain,
  ClipboardCheck,
  AlertTriangle,
  X,
  PlusCircle,
  Clipboard,
  ShieldCheck,
  Activity,
  FileSearch,
  Layers,
  FileText,
  Save,
  ListPlus,
  Globe
} from 'lucide-react';
import { ProposalDataRequirement, ProposalOutlineItem, ProposalSource, ProposalDataAnalysisResponse, DetectedDataPoint, MissingDataPoint, SuggestedTask } from '../../features/proposals/types';
import { EvidenceLinker } from './EvidenceLinker';
import { 
  listDataRequirements, 
  updateDataRequirement, 
  deleteDataRequirement, 
  createTemplateDataRequirements,
  listOutlineItems,
  listSources,
  batchUpdateDataRequirements,
  addProposalTask
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { analyzeDataLocally } from '../../features/proposals/proposalDataLocalAnalyzer';
import { apiFetchJson } from '../../services/apiClient';
import { auth } from '../../lib/firebase';
import ReactMarkdown from 'react-markdown';

interface ProposalDataRequirementsTabProps {
  userId: string;
  proposalId: string;
  requestConfirmAsync?: (msg: string) => Promise<boolean>;
}

type AnalysisStatus = "idle" | "analyzing" | "success" | "error";

function normalizeAnalysisResult(input: Partial<ProposalDataAnalysisResponse> | null | undefined): ProposalDataAnalysisResponse {
  return {
    summary: input?.summary || "Chưa có tóm tắt phân tích.",
    detectedData: Array.isArray(input?.detectedData) ? input.detectedData : [],
    missingData: Array.isArray(input?.missingData) ? input.missingData : [],
    risks: Array.isArray(input?.risks) ? input.risks : [],
    suggestedTasks: Array.isArray(input?.suggestedTasks) ? input.suggestedTasks : [],
    conclusion: input?.conclusion || ""
  };
}

export const ProposalDataRequirementsTab: React.FC<ProposalDataRequirementsTabProps> = ({ 
  userId, 
  proposalId,
  requestConfirmAsync
}) => {
  const [items, setItems] = useState<ProposalDataRequirement[]>([]);
  const [outlineItems, setOutlineItems] = useState<ProposalOutlineItem[]>([]);
  const [sources, setSources] = useState<ProposalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // AI Analysis States
  const [isAnalysisMode, setIsAnalysisMode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rawText, setRawText] = useState('');
  const [analysisType, setAnalysisType] = useState('general');
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisErrorType, setAnalysisErrorType] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ProposalDataAnalysisResponse | null>(null);

  // Relationship Stats
  const [checklistMissingDataCount, setChecklistMissingDataCount] = useState(0);
  const [activeTasksCount, setActiveTasksCount] = useState(0);

  useEffect(() => {
    if (userId && proposalId) {
      fetchData();
      fetchRelationshipStats();
    }
  }, [userId, proposalId]);

  const fetchRelationshipStats = async () => {
    try {
      // Use existing services if they support it, otherwise minimal manual fetch
      // For brevity in this turn, I'll assume we have or can add these to proposalService
      const token = await auth.currentUser?.getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [checklistResponse, tasksResponse] = await Promise.all([
        apiFetchJson(`/api/proposals/${proposalId}/checklist/stats`, { headers }),
        apiFetchJson(`/api/proposals/${proposalId}/tasks/stats`, { headers })
      ]);
      
      if (checklistResponse.success) {
        setChecklistMissingDataCount(checklistResponse.stats.failCount || 0);
      }
      if (tasksResponse.success) {
        setActiveTasksCount(tasksResponse.activeCount || 0);
      }
    } catch (error) {
      console.warn('Failed to fetch cross-tab stats:', error);
    }
  };

  const handlePasteSample = () => {
    const sample = "- Công ty hoạt động từ 01/10/2024\n- Trụ sở có 06 phòng\n- Có 03 chi nhánh III, IV, VI\n- CN III có Phòng Tổng hợp 35 người, Phòng Hoa tiêu - Phương tiện 95 người\n- Có 30 phương tiện thủy và 28 phương tiện bộ\n- Đã ban hành 35 văn bản nội bộ\n- Còn thiếu sản lượng, doanh thu, chi phí, lợi nhuận theo chi nhánh";
    setRawText(sample);
    toast.success("Đã dán mẫu tổng hợp số liệu!");
  };

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [reqs, outlines, srcData] = await Promise.all([
        listDataRequirements(userId, proposalId),
        listOutlineItems(userId, proposalId),
        listSources(userId, proposalId)
      ]);
      setItems(reqs);
      setOutlineItems(outlines);
      setSources(srcData);
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('permission-denied') || error?.code === 'permission-denied') {
        toast.error("Chưa có quyền đọc dữ liệu đề án. Vui lòng kiểm tra Firestore Rules hoặc đăng nhập lại.");
      } else {
        toast.error("Không thể tải danh mục số liệu");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập nội dung cần phân tích");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus("analyzing");
    setAnalysisError(null);
    setAnalysisErrorType(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await apiFetchJson<any>(`/api/proposals/${proposalId}/data/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rawText, analysisType }),
        retries: 2,
        timeoutMs: 90000,
        allowHtmlRetry: false
      });

      if (response?.success === false) {
        setAnalysisStatus("error");
        setAnalysisError(response.message || "Không thể phân tích số liệu.");
        setAnalysisErrorType(response.errorType || response.error || "unknown");
        return;
      }

      setAnalysisResult(normalizeAnalysisResult(response.analysis || response));
      setAnalysisStatus("success");
      toast.success("Đã hoàn thành phân tích AI!");
    } catch (error: any) {
      console.error(error);
      const errType = error.errorType || (error.message?.includes("hạn mức") ? 'quota_exceeded' : 'unknown');
      const errorMsg = error.message || "Không thể phân tích số liệu tại thời điểm này. Vui lòng thử lại.";
      
      setAnalysisStatus("error");
      setAnalysisError(errorMsg);
      setAnalysisErrorType(errType);
      
      if (errType !== 'quota_exceeded' && errType !== 'ai_overloaded' && errType !== 'validation_error') {
          toast.error(errorMsg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRunLocalAnalysis = () => {
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập nội dung cần phân tích");
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = analyzeDataLocally(rawText);
      setAnalysisResult(normalizeAnalysisResult(result));
      setAnalysisStatus("success");
      setAnalysisError(null);
      setAnalysisErrorType(null);
      toast.success("Đã hoàn thành phân tích cục bộ!");
    } catch (error: any) {
      setAnalysisStatus("error");
      setAnalysisError("Lỗi khi phân tích cục bộ");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyAnalysis = async () => {
    if (!analysisResult) return;

    const rawDetected = analysisResult.detectedData ?? [];
    const rawMissing = analysisResult.missingData ?? [];

    if (rawDetected.length === 0 && rawMissing.length === 0) {
      toast.error("Không có danh mục số liệu (detectedData/missingData) nào để áp dụng.");
      return;
    }

    const loadingId = toast.loading("Đang áp dụng vào danh mục số liệu...");
    try {
      const detectedItems = rawDetected.map(detected => {
        const existing = items.find(i => 
          i.group === detected.group && 
          i.title.toLowerCase().trim() === detected.title.toLowerCase().trim()
        );

        let status: ProposalDataRequirement['status'] = 'collected';
        if (detected.status === 'missing') status = 'missing';
        if (detected.status === 'needs_update') status = 'needs_update';
        if (detected.status === 'available') status = 'collected';
        if (detected.status === 'partial') status = 'needs_verification';
        if (detected.status === 'needs_verification') status = 'needs_verification';

        return {
          id: existing?.id,
          proposalId,
          group: detected.group,
          title: detected.title,
          purpose: detected.purpose,
          suggestedSource: detected.suggestedSource,
          responsibleUnit: detected.responsibleUnit,
          periodRequired: detected.periodRequired,
          breakdownRequired: detected.breakdownRequired,
          status,
          statusDetail: detected.status as any,
          valueText: detected.valueText,
          verificationNote: detected.verificationNote,
          priority: detected.priority as any,
          linkedOutlineCodes: detected.linkedOutlineCodes,
          source: 'ai_analysis',
          updatedAt: Date.now(),
          createdAt: existing?.createdAt || Date.now()
        };
      });

      const missingItems = rawMissing.map(missing => {
        const existing = items.find(i => 
          i.group === missing.group && 
          i.title.toLowerCase().trim() === missing.title.toLowerCase().trim()
        );

        return {
          id: existing?.id,
          proposalId,
          group: missing.group,
          title: missing.title,
          purpose: missing.reason,
          suggestedSource: missing.suggestedSource,
          responsibleUnit: missing.responsibleUnit,
          periodRequired: "",
          breakdownRequired: "",
          status: 'missing' as ProposalDataRequirement['status'],
          statusDetail: 'missing' as any,
          valueText: "",
          verificationNote: "Mục số liệu còn thiếu do phát hiện tự động, cần thu thập bổ sung.",
          priority: (missing.priority as any) || 'medium',
          linkedOutlineCodes: missing.linkedOutlineCodes,
          source: 'ai_analysis',
          updatedAt: Date.now(),
          createdAt: existing?.createdAt || Date.now()
        };
      });

      const allItemsToUpdate = [...detectedItems, ...missingItems];

      // Dedup by group + title
      const uniqueItemsToUpdate: Partial<ProposalDataRequirement>[] = [];
      const seen = new Set();
      for (const item of allItemsToUpdate) {
        if (!item) continue;
        const key = `${item.group}-${item.title.toLowerCase().trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueItemsToUpdate.push(item);
        }
      }

      await batchUpdateDataRequirements(userId, proposalId, uniqueItemsToUpdate);
      
      toast.success("Đã áp dụng vào danh mục số liệu!", { id: loadingId });
      fetchData(); 
    } catch (error: any) {
      console.error(error);
      toast.error("Lỗi khi áp dụng dữ liệu: " + (error.message || "Vui lòng thử lại."), { id: loadingId });
      fetchData(); 
    }
  };

  const handleCreateTaskFromItem = async (item: ProposalDataRequirement) => {
    try {
      await addProposalTask(userId, proposalId, {
        title: `Thu thập số liệu: ${item.title}`,
        description: `Nhiệm vụ thu thập, cập nhật số liệu cho mục "${item.title}".\nNhóm: ${item.group}\nMục đích: ${item.purpose}\nNguồn dự kiến: ${item.suggestedSource || 'N/A'}\nGhi chú: ${item.verificationNote || ''}`,
        priority: (item.priority as any) || 'medium',
        sourceType: 'data_requirement',
        sourceId: item.id,
        sourceLabel: 'Số liệu' as any,
        responsibleUnit: item.responsibleUnit,
        linkedOutlineCodes: item.linkedOutlineCodes || [],
        status: 'todo',
        assignee: 'Đang chờ phân công'
      });
      
      // Update item with task info (locally first, though firestore would eventually sync)
      await updateDataRequirement(userId, proposalId, item.id, {
        taskId: 'created', // Placeholder or real ID if we returned it, addProposalTask returns string ID
        taskStatus: 'todo'
      });
      
      fetchData();
      toast.success("Đã tạo nhiệm vụ thu thập số liệu.");
    } catch (error) {
      console.error('Create task error:', error);
      toast.error("Lỗi khi tạo nhiệm vụ.");
    }
  };

  const handleCreateTemplate = async () => {
    setIsSeeding(true);
    try {
      await createTemplateDataRequirements(userId, proposalId);
      toast.success("Đã tạo danh mục số liệu mẫu!");
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tạo mẫu");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, newStatus: ProposalDataRequirement['status']) => {
    if (!itemId) {
      toast.error("Không thể cập nhật mục chưa có ID");
      return;
    }
    try {
      await updateDataRequirement(userId, proposalId, itemId, { status: newStatus });
      setItems(items.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
      toast.success("Cập nhật trạng thái thành công");
    } catch (error) {
      toast.error("Lỗi cập nhật");
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!itemId) {
      toast.error("Không thể xóa mục chưa có ID");
      return;
    }
    const confirmFn = requestConfirmAsync ? requestConfirmAsync : async (m: string) => window.confirm(m);
    if (!(await confirmFn("Xóa yêu cầu số liệu này?"))) return;
    try {
      await deleteDataRequirement(userId, proposalId, itemId);
      setItems(items.filter(item => item.id !== itemId));
      toast.success("Đã xóa");
    } catch (error) {
      toast.error("Lỗi xóa");
    }
  };

  const handleLinkOutline = async (itemId: string, outlineId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const linkedIds = item.linkedOutlineItemIds || [];
    const newLinkedIds = linkedIds.includes(outlineId) 
      ? linkedIds.filter(id => id !== outlineId)
      : [...linkedIds, outlineId];

    try {
      await updateDataRequirement(userId, proposalId, itemId, { linkedOutlineItemIds: newLinkedIds });
      setItems(items.map(i => i.id === itemId ? { ...i, linkedOutlineItemIds: newLinkedIds } : i));
      toast.success("Đã cập nhật liên kết");
    } catch (error) {
      toast.error("Lỗi cập nhật liên kết");
    }
  };

  const groups = useMemo(() => {
    const defaultGroups = [
      "Tổ chức bộ máy, đầu mối, chức năng",
      "Lao động, nhân sự, chức danh",
      "Hoa tiêu hàng hải",
      "Sản lượng dẫn tàu và tuyến dẫn",
      "Điều hành, lịch tàu, thời gian đáp ứng",
      "Phương tiện, tài sản, trang thiết bị",
      "Tài chính, doanh thu, chi phí, lợi nhuận",
      "Quy chế, văn bản nội bộ",
      "KPI, RACI, chi phí – lợi ích",
      "Ban Giám đốc và phân công điều hành",
      "An toàn, rủi ro, phân ánh khách hàng",
      "Khác"
    ];
    const existingGroups = Array.from(new Set(items.map(i => i.group)));
    return Array.from(new Set([...defaultGroups, ...existingGroups]));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (item.responsibleUnit || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = filterGroup === 'all' || item.group === filterGroup;
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [items, searchQuery, filterGroup, filterStatus]);

  const stats = useMemo(() => {
    const total = items.length;
    if (total === 0) return { percent: 0, collected: 0, total: 0, missing: 0, verified: 0, needsUpdate: 0, taskCreated: 0 };
    const collected = items.filter(i => i.status === 'collected').length;
    const verified = items.filter(i => i.status === 'verified').length;
    const missing = items.filter(i => i.status === 'missing').length;
    const needsUpdate = items.filter(i => i.status === 'needs_update').length;
    const taskCreated = items.filter(i => !!i.taskId).length;
    
    return {
      percent: Math.round(((collected + verified) / total) * 100),
      collected,
      verified,
      total,
      missing,
      needsUpdate,
      taskCreated
    };
  }, [items]);

  const getStatusConfig = (status: string, statusDetail?: string) => {
    const actualStatus = statusDetail || status;
    switch (actualStatus) {
      case 'verified': return { label: 'Đã xác minh', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 };
      case 'collected': 
      case 'available': return { label: 'Đã có số liệu', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Database };
      case 'partial': return { label: 'Có một phần', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Layers };
      case 'requested': return { label: 'Đã yêu cầu', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };
      case 'needs_update': return { label: 'Cần cập nhật', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Activity };
      case 'needs_verification': return { label: 'Cần xác minh', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: ShieldCheck };
      case 'missing': return { label: 'Còn thiếu', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle };
      case 'not_applicable': return { label: 'Không áp dụng', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: X };
      default: return { label: 'Chưa yêu cầu', color: 'bg-slate-50 text-slate-400 border-slate-100', icon: HelpCircle };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'very_high': return { label: 'Rất cao', color: 'text-red-600 bg-red-50 border-red-100' };
      case 'high': return { label: 'Cao', color: 'text-orange-600 bg-orange-50 border-orange-100' };
      case 'medium': return { label: 'Trung bình', color: 'text-amber-600 bg-amber-50 border-amber-100' };
      case 'low': return { label: 'Thấp', color: 'text-slate-500 bg-slate-50 border-slate-100' };
      default: return { label: 'Trung bình', color: 'text-amber-600 bg-amber-50 border-amber-100' };
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
      {/* 1. Progress Overview */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
          <div className="flex-1">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <Database className="w-7 h-7 text-blue-600" /> TIẾN ĐỘ THU THẬP SỐ LIỆU ĐỀ ÁN
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-[#002D56]">{stats.percent}%</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Hoàn thành</span>
                  </div>
                </div>
             </div>
             <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-slate-50 p-0.5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.percent}%` }}
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-[#002D56] rounded-full shadow-lg"
                />
             </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
             <button 
               onClick={() => setIsAnalysisMode(!isAnalysisMode)}
               className={cn(
                 "px-8 py-5 rounded-3xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl",
                 isAnalysisMode 
                  ? "bg-amber-100 text-amber-700 shadow-amber-900/10 border-2 border-amber-200" 
                  : "bg-white border-2 border-slate-100 text-[#002D56] shadow-blue-900/5 hover:bg-slate-50"
               )}
             >
                <Sparkles className="w-5 h-5" /> AI PHÂN TÍCH
             </button>
             <button 
               onClick={() => setIsSeeding(true)}
               disabled={isSeeding}
               className="px-10 py-5 bg-[#002D56] text-white rounded-3xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
             >
                {isSeeding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />} THÊM MẪU
             </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
           {[
             { label: 'Tổng số mục', value: stats.total, color: 'bg-slate-50 text-slate-600 border-slate-100' },
             { label: 'Đã có số liệu', value: stats.collected, color: 'bg-blue-50 text-blue-600 border-blue-100' },
             { label: 'Đã xác minh', value: stats.verified, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
             { label: 'Cần cập nhật', value: stats.needsUpdate, color: 'bg-orange-50 text-orange-600 border-orange-100' },
             { label: 'Còn thiếu', value: stats.missing, color: 'bg-red-50 text-red-600 border-red-100' },
             { label: 'Có nhiệm vụ', value: stats.taskCreated, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
           ].map((stat, idx) => (
             <div key={staticKey("proposal-data-stat", stat.label, idx)} className={cn("p-5 rounded-[24px] border-2 flex flex-col items-center justify-center text-center transition-all hover:scale-105", stat.color)}>
                <span className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1.5 leading-none">{stat.label}</span>
                <span className="text-2xl font-black tabular-nums">{stat.value}</span>
             </div>
           ))}
        </div>

        {/* Relationship Alerts */}
        {(checklistMissingDataCount > 0 || activeTasksCount > 0) && (
          <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-slate-100">
            {checklistMissingDataCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Cần bổ sung số liệu cho {checklistMissingDataCount} mục checklist chưa đạt.</span>
              </motion.div>
            )}
            {activeTasksCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-5 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl text-[11px] font-black uppercase tracking-tight shadow-sm"
              >
                <Clock className="w-4 h-4" />
                <span>{activeTasksCount} nhiệm vụ thu thập số liệu đang thực hiện.</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* 2. AI Data Analysis Section */}
      <AnimatePresence mode="wait">
        {isAnalysisMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -20 }}
          >
            <div className="bg-gradient-to-br from-[#F8FAFC] via-[#EEF2FF] to-[#EFF6FF] border-2 border-blue-100 rounded-[40px] p-10 shadow-2xl shadow-blue-900/10">
               <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 bg-[#002D56] text-white rounded-[24px] flex items-center justify-center shadow-xl shadow-blue-900/30">
                        <Brain className="w-8 h-8" />
                     </div>
                     <div>
                        <h4 className="text-2xl font-black text-[#002D56]">Trợ lý Giải đoán & Phân tách Số liệu</h4>
                        <p className="text-sm text-slate-500 font-bold tracking-tight mt-1 opacity-60">Dán dữ liệu thô, ghi chú hoặc nội dung báo cáo để AI hỗ trợ bóc tách danh mục số liệu quy chuẩn cho đề án.</p>
                     </div>
                  </div>
                  <button onClick={() => setIsAnalysisMode(false)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-white rounded-2xl transition-all shadow-sm">
                     <X className="w-6 h-6" />
                  </button>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-5 space-y-8">
                     <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                           <label className="text-[11px] font-black text-blue-900 uppercase tracking-wider">Nội dung thô / Ghi chú khảo sát</label>
                           <button 
                             onClick={handlePasteSample}
                             className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-white px-3 py-1.5 rounded-full border border-blue-100 transition-all flex items-center gap-2"
                           >
                              <PlusCircle className="w-3.5 h-3.5" /> Dán mẫu nghiệp vụ
                           </button>
                        </div>
                        <div className="relative group">
                          <textarea 
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Ví dụ: - Công ty có 10 phòng ban, 250 nhân sự tính đến 6/2024. - Doanh thu năm 2023 đạt 1.500 tỷ. - Còn thiếu danh sách chi tiết tàu thuyền và chi phí bảo trì..."
                            className="w-full h-[450px] p-8 bg-white border-2 border-blue-50 rounded-[32px] text-sm outline-none focus:border-blue-400 focus:ring-8 focus:ring-blue-100/50 transition-all font-medium custom-scrollbar resize-none shadow-inner leading-relaxed"
                          />
                        </div>
                     </div>

                     <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[32px] p-6 shadow-sm space-y-6">
                        <div className="space-y-3">
                           <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Cấu hình tri thức AI</span>
                           <select 
                             value={analysisType}
                             onChange={(e) => setAnalysisType(e.target.value)}
                             className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-wider outline-none text-[#002D56] cursor-pointer hover:bg-white transition-all shadow-sm"
                           >
                             <option value="general">📊 Phân tích Tổng hợp (Toàn diện)</option>
                             <option value="labor">👥 Số liệu Nhân sự & Lao động</option>
                             <option value="pilotage">🚢 Số liệu Hoa tiêu & Dẫn tàu</option>
                             <option value="finance">💰 Số liệu Tài chính & Kinh tế</option>
                             <option value="assets">🏗️ Số liệu Tài sản & Kỹ thuật</option>
                             <option value="dispatch">📅 Số liệu Điều hành & Dispatch</option>
                           </select>
                        </div>

                        <div className="flex gap-4">
                           <button 
                             onClick={handleRunAnalysis}
                             disabled={isAnalyzing || !rawText.trim()}
                             className="flex-1 py-5 bg-[#002D56] text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-2xl shadow-blue-900/30 hover:bg-blue-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                           >
                             {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                             Bắt đầu phân tách AI
                           </button>
                        </div>
                     </div>
                  </div>

                  <div className="lg:col-span-7">
                     <div className="bg-white border text-center h-full flex flex-col items-center justify-center rounded-[32px] p-10 border-slate-100">
                        {analysisStatus === 'analyzing' ? (
                          <div className="space-y-6">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                            <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Đang đọc dữ liệu & trích xuất số liệu...</p>
                          </div>
                        ) : analysisStatus === 'error' ? (
                          <div className="space-y-4">
                             <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                             <h5 className="text-lg font-black text-rose-900">Gặp lỗi khi phân tích</h5>
                             <p className="text-sm text-rose-700 whitespace-pre-wrap">{analysisError}</p>
                             <button onClick={handleRunLocalAnalysis} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700">Chạy phân tích cục bộ</button>
                          </div>
                        ) : analysisStatus === 'success' && analysisResult ? (
                          <div className="w-full h-full flex flex-col text-left">
                             <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 mb-6 italic text-blue-900 text-xs font-bold leading-relaxed">
                               "{analysisResult.summary}"
                             </div>
                             <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8">
                                <section>
                                   <h5 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4" /> Số liệu phát hiện
                                   </h5>
                                   <div className="space-y-3">
                                      {analysisResult.detectedData?.map((d, i) => (
                                        <div key={getRenderKey("ai-detected", d, i)} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                           <div className="flex items-center justify-between mb-2">
                                              <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter bg-blue-50 px-2.5 py-1 rounded-lg">{d.group}</span>
                                           </div>
                                           <h6 className="text-[11px] font-black text-slate-800 mb-1">{d.title}</h6>
                                           <p className="text-[10px] text-slate-500 italic">"{d.valueText}"</p>
                                        </div>
                                      ))}
                                      {(analysisResult.detectedData?.length ?? 0) === 0 && (
                                        <p className="text-xs text-slate-400 italic">Không phát hiện số liệu hiện hữu.</p>
                                      )}
                                   </div>
                                </section>
                                <section>
                                   <h5 className="text-[10px] font-black text-red-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4" /> Số liệu còn thiếu
                                   </h5>
                                   <div className="space-y-3">
                                      {analysisResult.missingData?.map((m, i) => (
                                        <div key={getRenderKey("ai-missing", m, i)} className="p-4 bg-red-50/30 border border-red-50 rounded-2xl">
                                           <div className="flex items-center justify-between mb-2">
                                              <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter bg-red-50 px-2.5 py-1 rounded-lg">{m.group}</span>
                                           </div>
                                           <h6 className="text-[11px] font-black text-slate-800 mb-1">{m.title}</h6>
                                           <p className="text-[10px] text-red-700 italic">"{m.reason}"</p>
                                        </div>
                                      ))}
                                      {(analysisResult.missingData?.length ?? 0) === 0 && (
                                        <p className="text-xs text-slate-400 italic">Không phát hiện số liệu thiếu theo ngữ cảnh.</p>
                                      )}
                                   </div>
                                </section>
                             </div>
                             <div className="flex gap-4 mt-8">
                                <button 
                                  onClick={handleApplyAnalysis}
                                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                >
                                   <Save className="w-4 h-4" /> ÁP DỤNG VÀO DANH MỤC
                                </button>
                             </div>
                          </div>
                        ) : (
                          <div className="opacity-30">
                            <FileSearch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Kết quả AI trích xuất sẽ hiển thị tại đây</p>
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Catalog Header (Search & Filter) */}
      <div className="flex flex-col md:flex-row gap-5 items-center bg-white border border-slate-200 rounded-[32px] p-5 shadow-sm">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
           <input 
             type="text"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             placeholder="Tìm tên số liệu, đơn vị cung cấp hoặc tóm tắt mục đích..."
             className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[24px] text-sm outline-none focus:bg-white focus:border-blue-400 transition-all font-bold text-slate-700 shadow-inner"
           />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
           <select 
             value={filterGroup}
             onChange={(e) => setFilterGroup(e.target.value)}
             className="px-5 py-3.5 bg-white rounded-[20px] border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none text-[#002D56] cursor-pointer hover:border-blue-200 transition-all shadow-sm"
           >
             <option value="all">MỌI PHÂN NHÓM</option>
             {groups.map((g, gIdx) => <option key={`filter-group-${g}-${gIdx}`} value={g}>{g.toUpperCase()}</option>)}
           </select>
           <select 
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value)}
             className="px-5 py-3.5 bg-white rounded-[20px] border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none text-[#002D56] cursor-pointer hover:border-blue-200 transition-all shadow-sm"
           >
             <option value="all">MỌI TRẠNG THÁI</option>
             <option value="requested">ĐANG YÊU CẦU</option>
             <option value="collected">ĐÃ THU THẬP</option>
             <option value="verified">ĐÃ XÁC MINH</option>
             <option value="missing">CÒN THIẾU</option>
             <option value="needs_update">CẦN CẬP NHẬT</option>
             <option value="needs_verification">CẦN XÁC MINH</option>
           </select>
        </div>
      </div>

      {/* 4. Data Requirement Catalog */}
      <div className="space-y-10">
        {groups.filter(g => filterGroup === 'all' || g === filterGroup).map((group, groupIdx) => {
          const groupItems = filteredItems.filter(i => i.group === group);
          if (groupItems.length === 0) return null;

          return (
            <div key={`group-section-${group}-${groupIdx}`} className="space-y-6">
              <div className="flex items-center gap-6 px-4">
                 <div className="flex items-center gap-3">
                   <div className="w-2.5 h-7 bg-[#002D56] rounded-full" />
                   <h4 className="text-sm font-black text-[#002D56] uppercase tracking-[0.2em]">{group}</h4>
                 </div>
                 <div className="flex-1 h-px bg-slate-100" />
                 <span className="text-[10px] font-black text-slate-400 italic">{groupItems.length} MỤC</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupItems.map((item, idx) => {
                  const statusInfo = getStatusConfig(item.status, item.statusDetail);
                  const priorityInfo = getPriorityConfig(item.priority || 'medium');
                  
                  return (
                    <motion.div 
                      key={getRenderKey("data-req", item, idx)}
                      layout
                      className="bg-white border-2 border-slate-100 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:shadow-[#002D56]/5 hover:border-blue-100 transition-all flex flex-col group relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-6">
                         <div 
                           onClick={() => {
                             const states: ProposalDataRequirement['status'][] = ['requested', 'collected', 'verified', 'missing', 'needs_update', 'needs_verification'];
                             const next = states[(states.indexOf(item.status) + 1) % states.length];
                             handleUpdateStatus(item.id, next);
                           }}
                           className={cn("px-4 py-2 rounded-2xl flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer hover:scale-105 active:scale-95 border shadow-sm", statusInfo.color)}
                         >
                            <statusInfo.icon className="w-4 h-4" />
                            {statusInfo.label}
                         </div>
                         <div className={cn("px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-tighter border shadow-sm", priorityInfo.color)}>
                            {priorityInfo.label}
                         </div>
                      </div>

                      <div className="flex-1 mb-8">
                        {item.taskId && (
                           <div className="mb-4 bg-indigo-600 text-white px-3 py-1 rounded-[10px] text-[8px] font-black uppercase tracking-widest flex items-center gap-2 border border-indigo-700 w-fit shadow-md">
                             <Activity className="w-3 h-3" /> NHIỆM VỤ ĐANG TRIỂN KHAI
                           </div>
                        )}
                        <h5 className="text-base font-black text-slate-800 leading-[1.3] mb-3">{item.title}</h5>
                        <p className="text-xs text-slate-400 font-bold leading-relaxed line-clamp-3 italic">"{item.purpose || 'Chưa rõ mục đích thu thập'}"</p>
                      </div>

                      <div className="space-y-4 pt-6 border-t-2 border-slate-50">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                               <Building className="w-4 h-4 text-slate-300 shrink-0" />
                               <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter truncate">{item.responsibleUnit || "H/D"}</span>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                               <Globe className="w-4 h-4 text-slate-300 shrink-0" />
                               <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter truncate">{item.suggestedSource || "H/D"}</span>
                            </div>
                         </div>

                         <div className="flex flex-wrap gap-2 pt-2">
                           {(item.status === 'missing' || item.status === 'needs_update') && !item.taskId && (
                             <button 
                               onClick={() => handleCreateTaskFromItem(item)}
                               className="flex-1 min-w-[120px] px-4 py-3 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
                             >
                                <PlusCircle className="w-3.5 h-3.5" /> GIAO NHIỆM VỤ
                             </button>
                           )}
                           <button className="px-4 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[9px] font-black uppercase hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm">SỬA</button>
                           {item.status === 'collected' && (
                             <button 
                               onClick={() => handleUpdateStatus(item.id, 'verified')}
                               className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10"
                             >XÁC MINH</button>
                           )}
                         </div>

                         <div className="pt-2">
                            <EvidenceLinker 
                               userId={userId}
                               proposalId={proposalId}
                               targetType="dataRequirement"
                               targetId={item.id}
                            />
                         </div>
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="absolute top-4 right-4 p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

