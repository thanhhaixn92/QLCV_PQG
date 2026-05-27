import React, { useState, useEffect } from 'react';
import { 
  Link as LinkIcon, 
  Unlink, 
  Database, 
  FileText, 
  Globe, 
  BarChart, 
  Plus, 
  Loader2, 
  Paperclip,
  CheckCircle2,
  Trash2,
  X
} from 'lucide-react';
import { ProposalSource, ProposalEvidenceLink } from '../../features/proposals/types';
import { 
  listSources, 
  addEvidenceLink, 
  removeEvidenceLink, 
  listEvidenceLinksForTarget 
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface EvidenceLinkerProps {
  userId: string;
  proposalId: string;
  targetType: ProposalEvidenceLink['targetType'];
  targetId: string;
  className?: string;
}

export const EvidenceLinker: React.FC<EvidenceLinkerProps> = ({
  userId,
  proposalId,
  targetType,
  targetId,
  className
}) => {
  const [sources, setSources] = useState<ProposalSource[]>([]);
  const [links, setLinks] = useState<ProposalEvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [isLinking, setIsLinking] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [proposalId, targetId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [srcs, lnks] = await Promise.all([
        listSources(userId, proposalId),
        listEvidenceLinksForTarget(userId, proposalId, targetType, targetId)
      ]);
      setSources(srcs);
      setLinks(lnks);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (sourceId: string) => {
    setIsLinking(sourceId);
    try {
      await addEvidenceLink(userId, proposalId, {
        sourceId,
        targetType,
        targetId,
        proposalId
      });
      toast.success("Đã gắn nguồn tài liệu");
      fetchData();
    } catch (error) {
      toast.error("Lỗi khi gắn nguồn");
    } finally {
      setIsLinking(null);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await removeEvidenceLink(userId, proposalId, linkId);
      setLinks(links.filter(l => l.id !== linkId));
      toast.success("Đã gỡ liên kết");
    } catch (error) {
      toast.error("Lỗi khi gỡ liên kết");
    }
  };

  const linkedSourceIds = links.map(l => l.sourceId);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-3.5 h-3.5 text-red-500" />;
      case 'word': return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      case 'excel': return <BarChart className="w-3.5 h-3.5 text-emerald-500" />;
      case 'link': return <Globe className="w-3.5 h-3.5 text-blue-400" />;
      default: return <Database className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-blue-500 mx-auto" />;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Paperclip className="w-3 h-3" /> Nguồn & Bằng chứng ({links.length})
        </h5>
        <button 
          onClick={() => setShowPicker(!showPicker)}
          className="text-blue-600 hover:text-blue-700 text-[10px] font-black uppercase tracking-tighter flex items-center gap-1"
        >
          {showPicker ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {showPicker ? "Đóng" : "Gắn nguồn"}
        </button>
      </div>

      {/* Linked Sources List */}
      <div className="flex flex-wrap gap-2">
        {links.map(link => {
          const source = sources.find(s => s.id === link.sourceId);
          if (!source) return null;
          return (
            <div 
              key={link.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/50 border border-blue-100 rounded-full text-[10px] font-bold text-blue-800"
            >
              {getSourceIcon(source.type)}
              <span className="max-w-[150px] truncate">{source.name}</span>
              <button 
                onClick={() => handleUnlink(link.id)}
                className="p-1 hover:bg-blue-100 rounded-full text-blue-400 hover:text-red-500 transition-colors"
                title="Gỡ nguồn"
              >
                <Unlink className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        {links.length === 0 && !showPicker && (
          <span className="text-[10px] text-slate-300 font-medium italic">Chưa có nguồn đính kèm</span>
        )}
      </div>

      {/* Picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Chọn từ kho tư liệu đề án</p>
              {sources.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic px-1">Kho tư liệu đề án đang trống</p>
              ) : (
                sources.map(source => {
                  const isLinked = linkedSourceIds.includes(source.id);
                  return (
                    <button
                      key={source.id}
                      disabled={isLinked || isLinking === source.id}
                      onClick={() => handleLink(source.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group",
                        isLinked 
                          ? "bg-slate-100 border-slate-200 opacity-60 grayscale" 
                          : "bg-white border-slate-100 hover:border-blue-300 hover:shadow-sm"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                           {getSourceIcon(source.type)}
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-slate-700 truncate max-w-[180px]">{source.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{source.sourceType}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                         {isLinked ? (
                           <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                         ) : (
                           <Plus className={cn("w-4 h-4 text-blue-500 group-hover:rotate-90 transition-transform", isLinking === source.id && "animate-spin")} />
                         )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
