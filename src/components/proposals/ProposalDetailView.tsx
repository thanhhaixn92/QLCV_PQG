import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Settings, 
  FileText, 
  Layout, 
  CheckSquare, 
  Database, 
  History, 
  Download,
  Share2,
  Calendar,
  User,
  ExternalLink,
  Edit,
  Clock,
  ShieldCheck,
  BarChart
} from 'lucide-react';
import { Proposal, ProposalChatContext } from '../../features/proposals/types';
import { getProposal } from '../../features/proposals/proposalService';
import { ProposalSourcesTab } from './ProposalSourcesTab';
import { ProposalOutlineTab } from './ProposalOutlineTab';
import { ProposalTasksTab } from './ProposalTasksTab';
import { ProposalDraftsTab } from './ProposalDraftsTab';
import { ProposalChecklistTab } from './ProposalChecklistTab';
import { ProposalDataRequirementsTab } from './ProposalDataRequirementsTab';
import { ProposalExportTab } from './ProposalExportTab';
import { cn } from '../../lib/utils';

interface ProposalDetailViewProps {
  userId: string;
  proposalId: string;
  onBack: () => void;
  documents: any[]; // Global library documents for picking
  onContextUpdate?: (context: ProposalChatContext | null) => void;
  requestConfirmAsync: (msg: string) => Promise<boolean>;
}

type TabId = 'overview' | 'outline' | 'sources' | 'data' | 'checklist' | 'tasks' | 'drafts' | 'export' | 'history';

export const ProposalDetailView: React.FC<ProposalDetailViewProps> = ({ 
  userId, 
  proposalId, 
  onBack,
  documents,
  onContextUpdate,
  requestConfirmAsync
}) => {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [localContext, setLocalContext] = useState<Partial<ProposalChatContext>>({});

  const handleSelectionChange = React.useCallback((selection: any) => {
    setLocalContext(prev => {
      // Deep comparison to avoid redundant updates
      const isChanged = JSON.stringify(prev) !== JSON.stringify({ ...prev, ...selection });
      if (!isChanged) return prev;
      return { ...prev, ...selection };
    });
  }, []);

  const fullContext = useMemo(() => {
    if (!proposal) return null;
    return {
      proposalId,
      proposalTitle: proposal.name,
      activeTab,
      ...localContext
    } as ProposalChatContext;
  }, [proposal, proposalId, activeTab, localContext]);

  useEffect(() => {
    if (onContextUpdate && fullContext) {
      onContextUpdate(fullContext);
    }
  }, [fullContext, onContextUpdate]);

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        const data = await getProposal(userId, proposalId);
        setProposal(data);
      } catch (error) {
        console.error('Failed to fetch proposal detail:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [userId, proposalId]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#002D56] rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Đang tải chi tiết...</p>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500 font-bold">Không tìm thấy yêu cầu hoặc dữ liệu không tồn tại.</p>
        <button onClick={onBack} className="mt-4 text-[#002D56] font-bold text-sm flex items-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </button>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Tổng quan', icon: FileText },
    { id: 'sources', label: 'Hồ sơ nguồn', icon: Database },
    { id: 'outline', label: 'Đề cương', icon: Layout },
    { id: 'data', label: 'Số liệu', icon: BarChart },
    { id: 'checklist', label: 'Checklist', icon: ShieldCheck },
    { id: 'tasks', label: 'Nhiệm vụ', icon: CheckSquare },
    { id: 'drafts', label: 'Bản thảo', icon: Edit },
    { id: 'export', label: 'Xuất bản', icon: Download },
    { id: 'history', label: 'Lịch sử', icon: History },
  ];

  return (
    <div className="space-y-3">
      {/* Detail Header - More Compact & Polished */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3 group">
          <button 
            onClick={onBack}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm group-hover:scale-105 active:scale-95"
            aria-label="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-1.5 py-0.5 bg-[#002D56] text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-md shadow-blue-900/10">
                {proposal.status}
              </span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-l border-slate-200 pl-2">
                {proposal.category}
              </span>
            </div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none truncate max-w-[300px] md:max-w-[500px] xl:max-w-[700px]">
              {proposal.name}
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2 self-end md:self-center">
          <div className="flex bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
            <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Chia sẻ">
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Tải về">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#002D56] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all">
            <Settings className="w-3.5 h-3.5" />
            Cài đặt
          </button>
        </div>
      </div>

      {/* Primary Tabs - Refined Density */}
      <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 min-w-[80px] md:min-w-[100px] flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
              activeTab === tab.id 
                ? "bg-[#002D56] text-white shadow-lg shadow-blue-900/20" 
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            )}
          >
            <tab.icon className={cn("w-3 h-3", activeTab === tab.id ? "text-blue-300" : "text-slate-300")} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="relative min-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">Mô tả mục tiêu</h3>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {proposal.description || "Chưa có mô tả chi tiết cho đề án này."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tài liệu nguồn</p>
                      <p className="text-2xl font-bold text-slate-800">{proposal.sourceCount}</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <CheckSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhiệm vụ</p>
                      <p className="text-2xl font-bold text-slate-800">{proposal.taskCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
                  <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Chi tiết nghiệp vụ</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hạn hoàn thành</p>
                        <p className="text-xs font-bold text-slate-700">
                          {proposal.dueDate ? new Date(proposal.dueDate).toLocaleDateString('vi-VN') : 'Chưa đặt hạn'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Người phụ trách</p>
                        <p className="text-xs font-bold text-slate-700">{proposal.department || 'Chưa phân đơn vị'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cập nhật lần cuối</p>
                        <p className="text-xs font-bold text-slate-700">
                          {new Date(proposal.updatedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Tiến độ chung</p>
                    {proposal.taskCount > 0 ? (
                      <>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full bg-[#002D56] shadow-inner transition-all duration-500" 
                            style={{ width: `${proposal.progressPercent || 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] font-bold text-slate-600">
                          <span>Hoàn thành {proposal.progressPercent || 0}%</span>
                          <span>{proposal.taskCount} nhiệm vụ</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Chưa đủ dữ liệu tính tiến độ</p>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setActiveTab('export')}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Xuất bản đề án (Word/PDF)
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'sources' && (
            <motion.div 
              key="sources"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalSourcesTab 
                userId={userId} 
                proposalId={proposalId} 
                documents={documents} 
              />
            </motion.div>
          )}

          {activeTab === 'outline' && (
            <motion.div 
              key="outline"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalOutlineTab 
                userId={userId} 
                proposalId={proposalId} 
                proposal={proposal} 
                requestConfirmAsync={requestConfirmAsync}
              />
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div 
              key="tasks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalTasksTab 
                userId={userId} 
                proposalId={proposalId} 
                proposal={proposal}
                documents={[]} // Will be passed from parent if needed, for now empty is fine
                requestConfirmAsync={requestConfirmAsync}
              />
            </motion.div>
          )}

          {activeTab === 'drafts' && (
            <motion.div 
              key="drafts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalDraftsTab 
                userId={userId} 
                proposalId={proposalId} 
                proposal={proposal} 
                onSelectionChange={handleSelectionChange}
              />
            </motion.div>
          )}

          {activeTab === 'checklist' && (
            <motion.div 
              key="checklist"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalChecklistTab 
                userId={userId} 
                proposalId={proposalId} 
                requestConfirmAsync={requestConfirmAsync}
              />
            </motion.div>
          )}

          {activeTab === 'data' && (
            <motion.div 
              key="data"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalDataRequirementsTab 
                userId={userId} 
                proposalId={proposalId} 
                requestConfirmAsync={requestConfirmAsync}
              />
            </motion.div>
          )}

          {activeTab === 'export' && (
            <motion.div 
              key="export"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProposalExportTab 
                userId={userId} 
                proposalId={proposalId} 
              />
            </motion.div>
          )}

          {activeTab !== 'overview' && activeTab !== 'sources' && activeTab !== 'outline' && activeTab !== 'tasks' && activeTab !== 'drafts' && activeTab !== 'checklist' && activeTab !== 'data' && activeTab !== 'export' && (
            <motion.div 
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 flex flex-col items-center justify-center text-center space-y-4"
            >
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
                <Layout className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Module đang xây dựng</h3>
              <p className="text-sm text-slate-500 max-w-xs">Giai đoạn tiếp theo sẽ hỗ trợ đầy đủ Đề cương, Nhiệm vụ và Bản thảo AI cho Đề án.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
