import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileIcon,
  ShieldCheck,
  Database,
  BarChart,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  Target,
  FileSearch,
  Eye,
  History
} from 'lucide-react';
import { 
  Proposal, 
  ProposalOutlineItem, 
  ProposalDraft, 
  ProposalSource, 
  ProposalChecklistItem, 
  ProposalDataRequirement,
  ProposalEvidenceLink,
  ProposalExportPreviewContent,
  ProposalExport
} from '../../features/proposals/types';
import { 
  getProposal, 
  listOutlineItems, 
  listDrafts, 
  listSources, 
  listChecklistItems, 
  listDataRequirements,
  listEvidenceLinksForProposal
} from '../../features/proposals/proposalService';
import { 
  buildProposalExportPreview, 
  createExportRecord, 
  updateExportStatus 
} from '../../features/proposals/proposalExportService';
import { exportProposalToWord } from '../../lib/proposalExport';
import { ProposalExportPreviewModal } from './ProposalExportPreviewModal';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';

interface ProposalExportTabProps {
  userId: string;
  proposalId: string;
}

export const ProposalExportTab: React.FC<ProposalExportTabProps> = ({ 
  userId, 
  proposalId 
}) => {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [outlineItems, setOutlineItems] = useState<ProposalOutlineItem[]>([]);
  const [drafts, setDrafts] = useState<ProposalDraft[]>([]);
  const [sources, setSources] = useState<ProposalSource[]>([]);
  const [checklistItems, setChecklistItems] = useState<ProposalChecklistItem[]>([]);
  const [dataReqs, setDataReqs] = useState<ProposalDataRequirement[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<ProposalEvidenceLink[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'docx' | 'pdf' | null>(null);
  
  // Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<ProposalExportPreviewContent | null>(null);
  const [activeExportType, setActiveExportType] = useState<ProposalExport['exportType'] | null>(null);

  useEffect(() => {
    if (userId && proposalId) {
      fetchData();
    }
  }, [userId, proposalId]);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [
        p, 
        items, 
        draftData, 
        srcData, 
        checklist, 
        reqs,
        links
      ] = await Promise.all([
        getProposal(userId, proposalId),
        listOutlineItems(userId, proposalId),
        listDrafts(userId, proposalId),
        listSources(userId, proposalId),
        listChecklistItems(userId, proposalId),
        listDataRequirements(userId, proposalId),
        listEvidenceLinksForProposal(userId, proposalId)
      ]);
      
      setProposal(p);
      setOutlineItems(items);
      setDrafts(draftData);
      setSources(srcData);
      setChecklistItems(checklist);
      setDataReqs(reqs);
      setEvidenceLinks(links);
    } catch (error: any) {
      console.error(error);
      toast.error("Không thể tải thông tin xuất bản");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPreview = async (type: ProposalExport['exportType']) => {
    if (!proposal) return;
    setLoading(true);
    try {
      const content = await buildProposalExportPreview(
        proposal,
        outlineItems,
        drafts,
        checklistItems,
        dataReqs,
        type
      );
      setPreviewContent(content);
      setActiveExportType(type);
      setIsPreviewOpen(true);
    } catch (error: any) {
      toast.error("Lỗi khi tạo bản xem trước: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileType: 'docx' | 'pdf') => {
    if (!proposal || !activeExportType || !previewContent) return;
    setExporting(fileType);
    
    let exportId = '';
    try {
      // 1. Create Record
      exportId = await createExportRecord(userId, proposalId, {
        proposalId,
        exportType: activeExportType,
        fileType: fileType,
        title: previewContent.title,
        fileName: `${previewContent.title.replace(/\s+/g, '_')}_${new Date().getTime()}.${fileType}`,
        status: 'previewed'
      });

      // 2. Execute Export
      if (fileType === 'docx') {
        // We might need to adjust what we pass to docx based on type, 
        // but for now we follow the user request to prioritize full draft
        if (activeExportType === 'full_draft') {
          await exportProposalToWord(
            proposal, 
            outlineItems, 
            drafts, 
            sources, 
            evidenceLinks, 
            checklistItems, 
            dataReqs
          );
        } else {
          // Fallback simple word export or specific ones if needed
          // For now, use the same full draft export as it handles most context
          await exportProposalToWord(proposal, outlineItems, drafts, sources, evidenceLinks, checklistItems, dataReqs);
        }
      } else if (fileType === 'pdf') {
        toast("Đang tạo file PDF...", { icon: "🖨️", duration: 5000 });
        const { exportPrintablePdfFromElement } = await import('../../lib/printablePdfExport');
        await exportPrintablePdfFromElement('proposal-export-preview-content', {
          title: `${proposal.name}_De_An`,
          profile: 'proposal',
          onValidationError: (msg) => {
            toast(`Lỗi: ${msg}`, { icon: '❌', duration: 4000 });
          },
          onValidationWarning: (msg) => {
            toast(`Cảnh báo: ${msg}`, { icon: '⚠️', duration: 3000 });
          }
        });
      }

      // 3. Update Record
      await updateExportStatus(userId, proposalId, exportId, 'downloaded');
      toast.success("Tải xuống thành công!");
    } catch (error) {
      console.error(error);
      if (exportId) {
        await updateExportStatus(userId, proposalId, exportId, 'failed');
      }
      toast.error("Lỗi khi tải file");
    } finally {
      setExporting(null);
    }
  };

  if (loading && !isPreviewOpen) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!proposal) return null;

  const exportCards = [
    {
      id: 'full_draft',
      title: 'Bản thảo tổng hợp đề án',
      description: 'Tổng hợp toàn bộ nội dung từ các mục đề cương, bản thảo và phụ lục.',
      icon: FileText,
      color: 'bg-blue-50 text-blue-600',
      type: 'full_draft' as const
    },
    {
      id: 'outline',
      title: 'Đề cương đề án',
      description: 'Xuất cấu trúc danh mục, mục lục và hướng dẫn chi tiết của đề án.',
      icon: ClipboardList,
      color: 'bg-indigo-50 text-indigo-600',
      type: 'outline' as const
    },
    {
       id: 'data_requirements',
       title: 'Danh mục số liệu thu thập',
       description: 'Danh sách các số liệu, dữ kiện cần thu thập kèm đơn vị chủ trì.',
       icon: Database,
       color: 'bg-emerald-50 text-emerald-600',
       type: 'data_requirements' as const
    },
    {
       id: 'checklist',
       title: 'Checklist nội dung',
       description: 'Danh mục các tiêu chuẩn chất lượng và trạng thái rà soát.',
       icon: ShieldCheck,
       color: 'bg-amber-50 text-amber-600',
       type: 'checklist' as const
    },
    {
       id: 'progress_report',
       title: 'Báo cáo tiến độ',
       description: 'Báo cáo chi tiết về tỷ lệ hoàn thành, các mục còn tồn đọng.',
       icon: BarChart,
       color: 'bg-purple-50 text-purple-600',
       type: 'progress_report' as const
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <FileIcon className="w-40 h-40" />
        </div>
        
        <div className="relative z-10">
          <h3 className="text-3xl font-black text-slate-800 mb-3 tracking-tighter uppercase">Trung tâm Xuất bản</h3>
          <p className="text-sm text-slate-400 font-medium max-w-xl leading-relaxed">
            Hệ thống hỗ trợ kiểm tra và xem trước nội dung trước khi xuất bản chính thức. 
            Mọi tệp tin đều tuân thủ định dạng trình bày tiêu chuẩn của VMS Navigator.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {exportCards.map((card) => {
           const Icon = card.icon;
           return (
             <motion.div 
               key={card.id}
               whileHover={{ y: -5 }}
               className="bg-white border border-slate-200 rounded-[28px] p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex flex-col h-full"
             >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm", card.color)}>
                   <Icon className="w-7 h-7" />
                </div>
                
                <div className="flex-1">
                  <h4 className="text-base font-black text-slate-800 mb-2 uppercase tracking-tighter">{card.title}</h4>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed mb-6">
                    {card.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-50 mt-auto flex items-center justify-between">
                   <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">W</div>
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-400">P</div>
                   </div>
                   
                   <button 
                     onClick={() => handleOpenPreview(card.type)}
                     className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-[#002D56] rounded-xl text-[10px] font-bold uppercase transition-all hover:bg-[#002D56] hover:text-white"
                   >
                     <Eye className="w-3.5 h-3.5" />
                     Xem trước
                   </button>
                </div>
             </motion.div>
           );
         })}

         {/* History Card Placeholder */}
         <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[28px] p-6 flex flex-col items-center justify-center text-center opacity-60">
            <History className="w-10 h-10 text-slate-300 mb-4" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lịch sử xuất bản</p>
            <p className="text-[10px] text-slate-300 font-medium mt-1">Hệ thống đang ghi lại các bản đã tải</p>
         </div>
      </div>

      <ProposalExportPreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        preview={previewContent}
        isDownloading={exporting}
        onDownload={handleDownload}
        onRegenerate={() => {
          setIsPreviewOpen(false);
          handleOpenPreview(activeExportType!);
        }}
      />
    </div>
  );
};
