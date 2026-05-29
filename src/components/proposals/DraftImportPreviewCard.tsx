import React, { useState } from 'react';
import { 
  FileText, 
  MapPin, 
  AlertTriangle, 
  ChevronRight, 
  CheckCircle2, 
  Info, 
  Check, 
  X, 
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getRenderKey, staticKey } from '../../utils/listKeys';
import { DraftImportPreviewResponse, DraftImportAllocation } from '../../features/proposals/types';
import { motion, AnimatePresence } from 'motion/react';

interface DraftImportPreviewCardProps {
  preview: DraftImportPreviewResponse;
  onApply: (allocations: DraftImportAllocation[]) => void;
  onCancel: () => void;
}

export const DraftImportPreviewCard: React.FC<DraftImportPreviewCardProps> = ({
  preview,
  onApply,
  onCancel
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preview.allocations.filter(a => a.confidence === 'high').map(a => a.outlineItemId))
  );
  const [expandedId, setExpandedId] = useState<string | null>(
    preview.allocations.length > 0 ? preview.allocations[0].outlineItemId : null
  );

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleApplyAll = () => {
    const selected = preview.allocations.filter(a => selectedIds.has(a.outlineItemId));
    onApply(selected);
  };

  const hasHighConfidence = preview.allocations.some(a => a.confidence === 'high');

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden my-4 max-w-full">
      {/* Header */}
      <div className="bg-[#002D56] p-4 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/10 rounded-md">
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold tracking-tight">XEM TRƯỚC PHÂN BỔ BẢN THẢO</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                Chế độ: {
                  preview.mode === 'current_item' ? 'Mục đang chọn' :
                  preview.mode === 'target_section' ? 'Phân bổ theo phần' : 'Toàn bộ đề cương'
                }
              </span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-white/80 leading-relaxed italic border-t border-white/10 pt-2 mt-2">
          {preview.messageToUser}
        </p>
      </div>

      {/* Stats */}
      <div className="flex divide-x divide-slate-100 bg-slate-50 border-b border-slate-100">
        <div className="flex-1 p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Số mục rà được</p>
          <p className="text-sm font-black text-[#002D56]">{preview.allocations.length}</p>
        </div>
        <div className="flex-1 p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Độ tin cậy cao</p>
          <p className="text-sm font-black text-emerald-600">
            {preview.allocations.filter(a => a.confidence === 'high').length}
          </p>
        </div>
        <div className="flex-1 p-3 text-center">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1">Chưa phân bổ</p>
          <p className="text-sm font-black text-rose-500">{preview.unmappedContent?.length || 0}</p>
        </div>
      </div>

      {/* Allocations List */}
      <div className="p-2 bg-slate-50 max-h-[300px] overflow-y-auto custom-scrollbar">
        <div className="space-y-2">
          {preview.allocations.map((alloc) => (
            <div 
              key={alloc.outlineItemId}
              className={cn(
                "bg-white border rounded-md transition-all shadow-sm",
                selectedIds.has(alloc.outlineItemId) ? "border-emerald-200" : "border-slate-200",
                expandedId === alloc.outlineItemId && "ring-1 ring-emerald-500/20"
              )}
            >
              <div className="p-3 flex items-start gap-3">
                <input 
                  type="checkbox"
                  checked={selectedIds.has(alloc.outlineItemId)}
                  onChange={() => toggleSelect(alloc.outlineItemId)}
                  className="mt-1 w-4 h-4 rounded text-emerald-600 border-slate-300"
                />
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === alloc.outlineItemId ? null : alloc.outlineItemId)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">
                      Mục {alloc.outlineCode || '??'}
                    </span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                      alloc.confidence === 'high' ? "bg-emerald-100 text-emerald-700" :
                      alloc.confidence === 'medium' ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {alloc.confidence === 'high' ? 'Tin cậy cao' : alloc.confidence === 'medium' ? 'Trung bình' : 'Thấp'}
                    </span>
                  </div>
                  <h5 className="text-[12px] font-bold text-[#002D56] truncate mb-1">
                    {alloc.outlineTitle}
                  </h5>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded",
                      alloc.action === 'replace' ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {alloc.action === 'replace' ? 'THAY THẾ' : 'CHÈN THÊM'}
                    </span>
                    <p className="text-[10px] text-slate-500 italic truncate flex-1">
                      {alloc.reason}
                    </p>
                  </div>
                </div>
                <button 
                   onClick={() => setExpandedId(expandedId === alloc.outlineItemId ? null : alloc.outlineItemId)}
                   className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                   <ChevronRight className={cn("w-4 h-4 transition-transform", expandedId === alloc.outlineItemId ? "rotate-90" : "")} />
                </button>
              </div>

              <AnimatePresence>
                {expandedId === alloc.outlineItemId && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-slate-50 border-t border-slate-100"
                  >
                    <div className="p-3">
                      <div className="mb-3">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3" /> Nội dung đề xuất
                        </p>
                        <div className="bg-white border border-slate-200 rounded p-2.5 text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-mono max-h-[150px] overflow-y-auto">
                          {alloc.content}
                        </div>
                      </div>
                      
                      {alloc.sourceExcerpt && (
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-emerald-500" /> Căn cứ từ file
                          </p>
                          <p className="text-[10px] text-slate-500 italic leading-relaxed border-l-2 border-emerald-200 pl-2">
                            "{alloc.sourceExcerpt}"
                          </p>
                        </div>
                      )}
                      
                      {alloc.warnings && alloc.warnings.length > 0 && (
                        <div className="mt-2 text-[10px] text-rose-500 font-bold bg-rose-50 p-2 rounded border border-rose-100">
                          {alloc.warnings.join('. ')}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Summary warnings/risks */}
      {(preview.risks.length > 0 || preview.missingData.length > 0) && (
        <div className="p-3 bg-amber-50 border-t border-amber-100">
           {preview.risks.map((r, i) => (
             <div key={staticKey("import-risk", r, i)} className="flex items-start gap-2 text-[10px] text-amber-800 font-medium mb-1">
               <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
               <span>{r}</span>
             </div>
           ))}
           {preview.missingData.map((m, i) => (
             <div key={staticKey("import-missing", m, i)} className="flex items-start gap-2 text-[10px] text-amber-700 font-medium">
               <Info className="w-3 h-3 shrink-0 mt-0.5" />
               <span>{m}</span>
             </div>
           ))}
        </div>
      )}

      {/* Footer */}
      <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2">
        <div className="flex items-center gap-2">
           <button 
             onClick={handleApplyAll}
             disabled={selectedIds.size === 0}
             className="flex-1 bg-emerald-600 text-white rounded-md py-2.5 text-[11px] font-black uppercase tracking-tighter hover:bg-emerald-700 transition shadow-md shadow-emerald-900/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
           >
             <Check className="w-4 h-4" />
             Áp dụng {selectedIds.size} mục đã chọn
           </button>
           <button 
             onClick={onCancel}
             className="px-4 border border-slate-200 text-slate-500 rounded-md py-2.5 text-[11px] font-black uppercase tracking-tighter hover:bg-slate-50 transition active:scale-[0.98]"
           >
             Bỏ qua
           </button>
        </div>
        {hasHighConfidence && selectedIds.size < preview.allocations.filter(a => a.confidence === 'high').length && (
           <button 
             onClick={() => setSelectedIds(new Set(preview.allocations.filter(a => a.confidence === 'high').map(a => a.outlineItemId)))}
             className="text-[10px] font-bold text-blue-600 hover:underline text-center"
           >
             Chọn nhanh các mục tin cậy cao
           </button>
        )}
      </div>
    </div>
  );
};
