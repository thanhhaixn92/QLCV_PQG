import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  FileText,
  Loader2,
  ChevronDown,
  Sparkles,
  Zap,
  BarChart,
  Scale,
  RefreshCw,
  Info,
  ArrowRight,
  ChevronRight,
  Eye,
  Bot,
  Edit,
  Database,
  X
} from 'lucide-react';
import { 
  ProposalDraft, 
  ProposalOutlineItem,
  Proposal,
  ProposalSource
} from '../../features/proposals/types';
import { 
  updateDraft, 
  saveDraftVersion,
  listDraftVersions,
  suggestDraftContent,
  listSources,
  getProposal
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ProposalDraftAssist } from '../../lib/aiValidation';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { EvidenceLinker } from './EvidenceLinker';

interface ProposalDraftEditorProps {
  userId: string;
  proposalId: string;
  draft: ProposalDraft;
  outlineItem: ProposalOutlineItem;
  onUpdate: () => void;
}

export const ProposalDraftEditor: React.FC<ProposalDraftEditorProps> = ({ 
  userId, 
  proposalId, 
  draft,
  outlineItem,
  onUpdate 
}) => {
  const [content, setContent] = useState(draft.content || '');
  const [status, setStatus] = useState(draft.status);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const lastLoadedIdRef = useRef<string | null>(null);

  const statuses: { value: ProposalDraft['status']; label: string; color: string }[] = [
    { value: 'empty', label: 'Chưa viết', color: 'text-slate-400' },
    { value: 'drafting', label: 'Đang viết', color: 'text-blue-600' },
    { value: 'needs_data', label: 'Cần số liệu', color: 'text-amber-600' },
    { value: 'needs_review', label: 'Cần rà soát', color: 'text-purple-600' },
    { value: 'completed', label: 'Hoàn thành', color: 'text-emerald-600' },
  ];

  const currentStatus = statuses.find(s => s.value === status) || statuses[0];

  useEffect(() => {
    if (lastLoadedIdRef.current === draft.id) return;
    
    setContent(draft.content || '');
    setStatus(draft.status);
    fetchProposal();
    lastLoadedIdRef.current = draft.id;
  }, [draft.id, draft.content, draft.status]);

  const fetchProposal = async () => {
    try {
      const p = await getProposal(userId, proposalId);
      setProposal(p);
    } catch (error) {
      console.error(error);
    }
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
      await updateDraft(userId, proposalId, draft.id, { 
        content, 
        status,
        wordCount 
      });
      toast.success("Đã lưu bản thảo");
      onUpdate();
    } catch (error: any) {
      toast.error("Lỗi khi lưu: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVersion = async () => {
    setIsSavingVersion(true);
    try {
      await saveDraftVersion(userId, proposalId, draft.id, content);
      toast.success("Đã lưu phiên bản mới (V" + (draft.version + 1) + ")");
      onUpdate();
      if (showVersions) fetchVersions();
    } catch (error: any) {
      toast.error("Lỗi khi lưu phiên bản: " + error.message);
    } finally {
      setIsSavingVersion(false);
    }
  };

  const fetchVersions = async () => {
    try {
      const data = await listDraftVersions(userId, proposalId, draft.id);
      setVersions(data);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleVersions = () => {
    if (!showVersions) fetchVersions();
    setShowVersions(!showVersions);
  };

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Workspace Header - Compact & Focused */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#002D56] text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/20">
            <span className="text-sm font-black tracking-tighter">{outlineItem.code || 'M'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-sm font-black text-slate-800 truncate uppercase tracking-tight">
                {outlineItem.title}
              </h2>
              <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100 uppercase tracking-widest shrink-0">
                V{draft.version}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={cn(
                    "flex items-center gap-1.5 text-[9px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest transition-all",
                    currentStatus.color,
                    "bg-white hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-1 h-1 rounded-full shrink-0", currentStatus.color.replace('text-', 'bg-'))} />
                  <span>{currentStatus.label}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-1.5">
                      {statuses.map(s => (
                        <button
                          key={s.value}
                          onClick={() => {
                            setStatus(s.value);
                            setShowStatusMenu(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-tight rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2",
                            s.value === status ? "bg-slate-50 text-blue-600" : "text-slate-500"
                          )}
                        >
                          <div className={cn("w-1 h-1 rounded-full", s.color.replace('text-', 'bg-'))} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                <Clock className="w-3 h-3" /> {format(draft.updatedAt, 'HH:mm dd/MM', { locale: vi })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button 
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              isAssistantOpen ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI & Nguồn
          </button>
          <button 
            onClick={toggleVersions}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              showVersions ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            <History className="w-3.5 h-3.5" /> {showVersions ? "Ẩn lịch sử" : "Lịch sử"}
          </button>
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#002D56] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shrink-0"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            LƯU BẢN THẢO
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-5 flex-1 min-h-0 relative">
        {/* Main Editor Area - Middle Pane */}
        <div className="flex-1 flex flex-col min-h-[500px] bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm relative focus-within:ring-2 focus-within:ring-blue-400/20 transition-all">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Bắt đầu soạn thảo nội dung chuyên sâu tại đây..."
            className="flex-1 w-full p-6 md:p-8 xl:p-10 2xl:p-14 text-base leading-relaxed text-slate-700 outline-none resize-none font-medium custom-scrollbar selection:bg-blue-100 placeholder:text-slate-300"
          />
          
          <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Dung lượng</span>
                <span className="text-xs font-black text-slate-600">{content.length} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Ký tự</span></span>
              </div>
              <div className="w-px h-6 bg-slate-100 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">Số từ</span>
                <span className="text-xs font-black text-slate-600">{content.trim() ? content.trim().split(/\s+/).length : 0} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Từ</span></span>
              </div>
            </div>
            
            <button 
              disabled={isSavingVersion}
              onClick={handleSaveVersion}
              className="px-4 py-2 text-[#002D56] hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group w-full sm:w-auto justify-center"
            >
              {isSavingVersion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />}
              Chốt phiên bản này
            </button>
          </div>

          {/* Versions Sidebar Overflow */}
          <AnimatePresence>
            {showVersions && (
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 w-full sm:w-80 h-full bg-white border-l border-slate-200 z-10 shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-500" /> Lịch sử soạn thảo
                  </h3>
                  <button onClick={() => setShowVersions(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-slate-600 transition-all shadow-sm">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {versions.map((v) => (
                    <div key={v.id} className="p-4 rounded-2xl border border-slate-100 hover:border-blue-200 bg-white hover:bg-blue-50/20 transition-all cursor-pointer group shadow-sm">
                      <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase tracking-tighter">
                        <div className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md">V{v.version}</div>
                        <span className="text-slate-400">{format(v.createdAt, 'HH:mm - dd/MM')}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-4 leading-relaxed mb-4 font-medium italic">"{v.content}"</p>
                      <button 
                        onClick={() => {
                          setContent(v.content);
                          toast.success("Đã khôi phục nội dung V" + v.version);
                        }}
                        className="w-full py-2 bg-[#002D56] text-white rounded-xl text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all shadow-lg shadow-blue-900/20"
                      >
                        Khôi phục
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Assistant Panel - Drawer or Column */}
        <AnimatePresence>
          {isAssistantOpen && (
            <>
              {/* Backdrop for mobile/tablet */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAssistantOpen(false)}
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60] xl:hidden"
              />
              
              <motion.div 
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={cn(
                  "shrink-0 z-[61] bg-slate-50/30 xl:bg-transparent transition-all duration-500",
                  "fixed top-0 right-0 h-full w-[320px] 2xl:w-[360px] xl:relative xl:h-auto overflow-hidden shadow-2xl xl:shadow-none"
                )}
              >
                <div className="h-full overflow-y-auto custom-scrollbar p-6 xl:p-0 xl:pt-1 space-y-5 flex flex-col bg-white xl:bg-transparent">
                  <div className="flex items-center justify-between xl:hidden mb-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Trợ lý & Nguồn</h3>
                    <button onClick={() => setIsAssistantOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  {/* AI Workspace Panel */}
                  <div className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm flex flex-col p-6">
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-50">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Trợ lý Hoa Tiêu</h3>
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter leading-none">AI-POWERED</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-6">
                       <button className="w-full p-4 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl border border-slate-100 transition-all group text-left">
                          <div className="flex items-center gap-3">
                            <Edit className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
                            <div>
                               <p className="text-xs font-black uppercase tracking-tighter leading-none mb-1">Gợi ý nội dung</p>
                               <p className="text-[10px] font-medium opacity-60 leading-tight">Dựa trên tên mục và ngữ cảnh</p>
                            </div>
                          </div>
                       </button>
                       <button className="w-full p-4 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-2xl border border-slate-100 transition-all group text-left">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-indigo-600 group-hover:text-white transition-colors" />
                            <div>
                               <p className="text-xs font-black uppercase tracking-tighter leading-none mb-1">Viết nháp từ hồ sơ</p>
                               <p className="text-[10px] font-medium opacity-60 leading-tight">Sử dụng nguồn tài liệu gắn</p>
                            </div>
                          </div>
                       </button>
                       <button className="w-full p-4 bg-slate-50 hover:bg-emerald-600 hover:text-white rounded-2xl border border-slate-100 transition-all group text-left">
                          <div className="flex items-center gap-3">
                            <RefreshCw className="w-4 h-4 text-emerald-600 group-hover:text-white transition-colors" />
                            <div>
                               <p className="text-xs font-black uppercase tracking-tighter leading-none mb-1">Biên tập văn phong</p>
                               <p className="text-[10px] font-medium opacity-60 leading-tight">Nâng cấp chất lượng ngôn từ</p>
                            </div>
                          </div>
                       </button>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl relative overflow-hidden">
                       <p className="text-[10px] text-blue-900 leading-relaxed font-bold italic z-10 relative">
                          Mẹo: Mở chatbox để yêu cầu AI chỉnh sửa từng đoạn cụ thể.
                       </p>
                    </div>
                  </div>

                  {/* Sources Section */}
                  <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
                     <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                       <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                         <Database className="w-3.5 h-3.5 text-indigo-500" /> Tài liệu hồ sơ nguồn
                       </h4>
                     </div>
                     
                     <div className="space-y-4">
                        <EvidenceLinker 
                          userId={userId}
                          proposalId={proposalId}
                          targetType="outlineItem"
                          targetId={outlineItem.id}
                        />
                        <div className="pt-4 border-t border-slate-100">
                           <EvidenceLinker 
                             userId={userId}
                             proposalId={proposalId}
                             targetType="draft"
                             targetId={draft.id}
                           />
                        </div>
                     </div>
                  </div>

                  {/* Guidance Section */}
                  <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm">
                    <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Hướng dẫn biên soạn
                    </h3>
                    <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 shadow-inner max-h-40 overflow-y-auto custom-scrollbar">
                      <div className="text-xs text-slate-600 leading-relaxed font-medium">
                        {outlineItem.guidance || "Chưa có hướng dẫn chi tiết."}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
