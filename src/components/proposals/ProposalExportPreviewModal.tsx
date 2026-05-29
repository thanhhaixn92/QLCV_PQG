import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  RefreshCcw, 
  ArrowLeft,
  Loader2,
  FileDown,
  CheckCircle2,
  AlertCircle,
  Hash
} from 'lucide-react';
import { motion } from 'motion/react';
import { ProposalExportPreviewContent, ProposalExportStatus } from '../../features/proposals/types';
import { getRenderKey, staticKey } from '../../utils/listKeys';
import { cn } from '../../lib/utils';

interface ProposalExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: ProposalExportPreviewContent | null;
  onDownload: (fileType: 'docx' | 'pdf') => Promise<void>;
  onRegenerate: () => void;
  isDownloading: 'docx' | 'pdf' | null;
}

export const ProposalExportPreviewModal: React.FC<ProposalExportPreviewModalProps> = ({
  isOpen,
  onClose,
  preview,
  onDownload,
  onRegenerate,
  isDownloading
}) => {
  if (!isOpen || !preview) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#F8FAFC] rounded-[32px] shadow-2xl w-full max-w-5xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-[#002D56] rounded-2xl flex items-center justify-center shadow-inner">
               <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Xem trước bản xuất</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                {preview.title} • {new Date().toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={onRegenerate}
               className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-[#002D56] hover:bg-slate-50 rounded-xl transition-all text-[11px] font-bold uppercase tracking-wider"
             >
               <RefreshCcw className="w-3.5 h-3.5" />
               Tạo lại
             </button>
             <button 
               onClick={onClose}
               className="p-3 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
             >
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Sidebar / Summary */}
          <div className="w-full md:w-72 bg-white border-r border-slate-100 p-6 space-y-6 overflow-y-auto custom-scrollbar">
             <div className="space-y-4">
               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Đề án</p>
                  <p className="text-xs font-black text-[#002D56] uppercase leading-tight line-clamp-2">{preview.projectName}</p>
               </div>

               {preview.summary && (
                  <div className="space-y-3">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mb-1">Tiến độ nội dung</p>
                      <div className="flex items-end justify-between">
                         <span className="text-2xl font-black text-emerald-600">{preview.summary.completionRate}%</span>
                         <span className="text-[10px] font-bold text-emerald-600/70">{preview.summary.completedItems}/{preview.summary.totalItems} MỤC</span>
                      </div>
                      <div className="mt-2 w-full h-1.5 bg-emerald-200/50 rounded-full overflow-hidden">
                         <div className="h-full bg-emerald-500 transition-all" style={{ width: `${preview.summary.completionRate}%` }} />
                      </div>
                    </div>

                    {preview.summary.missingItems > 0 && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                         <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                         <p className="text-[10px] font-medium text-amber-700 leading-normal">
                           Cảnh báo: Hiện có {preview.summary.missingItems} mục đang để trống hoặc chưa hoàn thiện bản thảo.
                         </p>
                      </div>
                    )}
                  </div>
               )}
             </div>

             <div className="pt-4 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Thành phần bản xuất</p>
                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Trang bìa & Tiêu đề
                   </div>
                   <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Nội dung theo đề cương
                   </div>
                   {preview.appendices?.map((app, idx) => (
                      <div key={getRenderKey("export-appendix", app, idx)} className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        {app.title}
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Document Preview */}
          <div className="flex-1 overflow-y-auto p-12 bg-white m-6 rounded-[24px] shadow-inner border border-slate-100 custom-scrollbar">
             <div id="proposal-export-preview-content" className="max-w-2xl mx-auto bg-white min-h-full">
                {/* Title Section */}
                <div className="text-center mb-16">
                   <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-12">
                      <div className="text-center">
                        <p>TỔNG CÔNG TY BẢO ĐẢM ATHH MIỀN BẮC</p>
                        <p className="font-extrabold text-slate-900">CÔNG TY TNHH MTV HOA TIÊU HÀNG HẢI MIỀN BẮC</p>
                        <div className="w-20 h-px bg-slate-300 mx-auto mt-1" />
                      </div>
                      <div className="text-center">
                        <p className="font-extrabold text-slate-900 uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                        <p className="font-extrabold text-slate-900">Độc lập - Tự do - Hạnh phúc</p>
                        <div className="w-24 h-px bg-slate-900 mx-auto mt-1" />
                      </div>
                   </div>
                   
                   <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tighter">ĐỀ ÁN</h1>
                   <h2 className="text-xl font-black text-slate-900 uppercase leading-snug">{preview.projectName}</h2>
                </div>

                {/* Main Content */}
                <div className="space-y-12">
                   {preview.sections.map((section, idx) => {
                     const isMissing = section.isMissing;
                     const isSection = section.type === 'section';
                     return (
                       <div key={getRenderKey("export-section", section, idx)} className="space-y-4">
                          <h3 className={cn(
                            "font-black text-slate-900 leading-tight",
                            section.level === 1 ? "text-lg uppercase mt-12 mb-6" : 
                            section.level === 2 ? "text-base mt-8 mb-4 border-l-4 border-[#002D56] pl-3" : "text-sm mt-6 mb-3"
                          )}>
                             {section.code} {section.title}
                          </h3>
                          
                          {section.content ? (
                            <div className={cn(
                              "text-sm text-slate-700 leading-relaxed text-justify whitespace-pre-wrap font-serif",
                              isMissing ? "bg-amber-50/50 p-4 rounded-2xl border border-amber-100/50 italic text-slate-400" : ""
                            )}>
                               {section.content}
                            </div>
                          ) : !isSection && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-slate-400 text-sm">
                               [Không có nội dung]
                            </div>
                          )}
                       </div>
                     );
                   })}
                </div>

                {/* Appendices Summary for Preview */}
                {preview.appendices && preview.appendices.length > 0 && (
                  <div className="mt-20 pt-12 border-t border-slate-100">
                     <h3 className="text-xl font-black text-slate-900 uppercase text-center mb-10">PHỤ LỤC</h3>
                     <div className="space-y-10">
                        {preview.appendices.map((app, idx) => (
                           <div key={getRenderKey("export-app-detail", app, idx)} className="space-y-4">
                              <h4 className="font-bold text-slate-900 text-sm italic">
                                Phụ lục {idx + 1}: {app.title}
                              </h4>
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-center gap-2 text-slate-400 italic text-xs">
                                 <AlertCircle className="w-4 h-4" />
                                 Dữ liệu bảng và danh mục sẽ được tự động định dạng khi xuất file thực tế.
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
           <button 
             onClick={onRegenerate}
             className="flex items-center gap-2 text-slate-400 hover:text-[#002D56] transition-all text-xs font-bold uppercase tracking-widest p-2"
           >
             <ArrowLeft className="w-4 h-4" />
             Quay lại chỉnh sửa đề cương
           </button>

           <div className="flex items-center gap-3">
              <button 
                onClick={() => onDownload('docx')}
                disabled={!!isDownloading}
                className={cn(
                  "flex items-center gap-3 px-8 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/10",
                  isDownloading === 'docx' 
                    ? "bg-slate-100 text-slate-400" 
                    : "bg-[#002D56] text-white hover:opacity-95 active:scale-95"
                )}
              >
                {isDownloading === 'docx' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                TẢI FILE WORD (.DOCX)
              </button>

              <button 
                onClick={() => onDownload('pdf')}
                disabled={!!isDownloading}
                className={cn(
                  "flex items-center gap-3 px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border-2",
                  isDownloading === 'pdf'
                    ? "border-slate-100 bg-slate-50 text-slate-400"
                    : "border-emerald-500/20 text-emerald-600 hover:bg-emerald-50"
                )}
                title="Xuất bản PDF chất lượng cao, có thể quét và chọn được văn bản"
              >
                {isDownloading === 'pdf' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                XUẤT PDF VĂN BẢN
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
};
