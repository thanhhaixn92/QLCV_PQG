import React, { useState } from 'react';
import { auth } from '../../lib/firebase';
import { SlideOutlineResult, SlideDeckExportOptions, SlideDeckTheme } from '../../types/slideOutline';
import { SLIDE_THEMES } from '../../lib/slideThemes';
import { buildGammaMarkdown } from '../../lib/gammaExport';
import { validateDeckForExport } from '../../lib/slideValidation';
import { Download, Copy, AlertTriangle, CheckCircle, FileText, Presentation, Code } from 'lucide-react';
import toast from 'react-hot-toast';
import { logActivity } from '../../lib/activityLog';

interface Props {
  outline: SlideOutlineResult;
  onExportComplete?: (format: string) => void;
}

export function SlideExportPanel({ outline, onExportComplete }: Props) {
  const [options, setOptions] = useState<SlideDeckExportOptions>({
    theme: outline.theme || 'vms_enterprise',
    includeSpeakerNotes: true,
    includeVisualSuggestions: true,
    includeSourceSummary: true,
    includeCautionNotes: false,
    format: 'pptx'
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const validation = validateDeckForExport(outline);

  const handleGenerateHTML = async () => {
    if (!validation.isValid) {
      toast.error("Vui lòng khắc phục các lỗi nghiêm trọng trước khi xuất.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      toast.error("Vui lòng đăng nhập để sử dụng tính năng này.");
      return;
    }
    try {
      setIsExporting(true);
      const loadingToast = toast.loading("AI đang tạo mã HTML cho slide...");
      
      const token = await user.getIdToken();
      
      const themeColors = SLIDE_THEMES[options.theme as SlideDeckTheme]?.colors;
      
      const res = await fetch('/api/ai/slide-outline/export-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ outline, themeColors })
      });
      
      const data = await res.json();
      toast.dismiss(loadingToast);
      
      if (!data.success) {
        throw new Error(data.message || 'Lỗi từ máy chủ');
      }
      
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${outline.title.replace(/\\s+/g, '_')}_Presentation.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Tạo HTML thành công!");
      await logActivity({
        action: 'exported',
        module: 'editorial',
        entityType: 'editorial_session',
        entityId: 'html',
        entityTitle: outline.title,
        title: 'Thử nghiệm tạo HTML',
        summary: `Đã dùng Cinema AI để tạo bản web slide cho bài "${outline.title}".`
      });
      if (onExportComplete) onExportComplete('html');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Lỗi tạo HTML.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPptx = async () => {
    if (!validation.isValid) {
       toast.error("Vui lòng khắc phục các lỗi nghiêm trọng trước khi xuất.");
       return;
    }
    try {
      setIsExporting(true);
      const { exportSlideOutlineToPptx } = await import('../../lib/pptxExport');
      await exportSlideOutlineToPptx(outline, options);
      toast.success("Xuất PowerPoint thành công!");
      await logActivity({
        action: 'exported',
        module: 'editorial',
        entityType: 'editorial_session',
        entityId: 'pptx',
        entityTitle: outline.title,
        title: 'Xuất file PowerPoint',
        summary: `Đã xuất phác thảo slide "${outline.title}" thành file .pptx.`
      });
      if (onExportComplete) onExportComplete('pptx');
    } catch (error) {
      console.error(error);
      toast.error("Lỗi xuất PowerPoint.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyGamma = () => {
    const md = buildGammaMarkdown(outline, options);
    navigator.clipboard.writeText(md)
      .then(async () => {
         toast.success("Đã copy Markdown tương thích Gamma!");
         await logActivity({
           action: 'exported',
           module: 'editorial',
           entityType: 'editorial_session',
           entityId: 'gamma',
           entityTitle: outline.title,
           title: 'Xuất mã Gamma',
           summary: `Đã copy nguồn Markdown cho AI Gamma từ bài "${outline.title}".`
         });
         if (onExportComplete) onExportComplete('gamma');
      })
      .catch(async () => {
         const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `${outline.title}_Gamma.md`;
         a.click();
         URL.revokeObjectURL(url);
         toast.success("Đã tải về file Markdown!");
         await logActivity({
           action: 'exported',
           module: 'editorial',
           entityType: 'editorial_session',
           entityId: 'gamma',
           entityTitle: outline.title,
           title: 'Tải mã Gamma',
           summary: `Đã tải về file Markdown tương thích Gamma từ bài "${outline.title}".`
         });
         if (onExportComplete) onExportComplete('gamma');
      });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6 max-w-2xl mx-auto">
      <div className="border-b border-slate-100 pb-4">
         <h3 className="text-lg font-bold text-slate-800">Cấu hình xuất bản</h3>
         <p className="text-sm text-slate-500 mt-1">Điều chỉnh định dạng và nội dung trước khi xuất phác thảo thành slide thực tế.</p>
      </div>

      <div className="space-y-4">
        <div>
           <label className="block text-sm font-bold text-slate-700 mb-2">Giao diện (Theme)</label>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
             {Object.values(SLIDE_THEMES).map(theme => (
               <label key={theme.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${options.theme === theme.id ? 'bg-blue-50/50 border-[#002D56] ring-1 ring-[#002D56]' : 'border-slate-200 hover:border-slate-300'}`}>
                 <input 
                   type="radio" 
                   name="slide_theme" 
                   value={theme.id}
                   checked={options.theme === theme.id}
                   onChange={() => setOptions({ ...options, theme: theme.id as SlideDeckTheme })}
                   className="mt-1"
                 />
                 <div>
                    <div className="text-sm font-bold text-slate-800">{theme.label}</div>
                    <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{theme.description}</div>
                    <div className="flex gap-1 mt-2">
                       <span className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: '#' + theme.colors.primary }}></span>
                       <span className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: '#' + theme.colors.accent }}></span>
                       <span className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: '#' + theme.colors.background }}></span>
                    </div>
                 </div>
               </label>
             ))}
           </div>
        </div>

        <div className="pt-4">
           <label className="block text-sm font-bold text-slate-700 mb-3">Tùy chọn nội dung kèm theo</label>
           <div className="space-y-3">
             <label className="flex items-center gap-3">
               <input type="checkbox" className="rounded text-[#002D56] focus:ring-[#002D56]" checked={options.includeSpeakerNotes} onChange={e => setOptions({...options, includeSpeakerNotes: e.target.checked})} />
               <span className="text-sm font-medium text-slate-700">Lời dẫn (Speaker Notes)</span>
             </label>
             <label className="flex items-center gap-3">
               <input type="checkbox" className="rounded text-[#002D56] focus:ring-[#002D56]" checked={options.includeVisualSuggestions} onChange={e => setOptions({...options, includeVisualSuggestions: e.target.checked})} />
               <span className="text-sm font-medium text-slate-700">Gợi ý hình ảnh/biểu đồ</span>
             </label>
             <label className="flex items-center gap-3">
               <input type="checkbox" className="rounded text-[#002D56] focus:ring-[#002D56]" checked={options.includeSourceSummary} onChange={e => setOptions({...options, includeSourceSummary: e.target.checked})} />
               <span className="text-sm font-medium text-slate-700">Trang tóm tắt nguồn (Markdown)</span>
             </label>
             <label className="flex items-center gap-3">
               <input type="checkbox" className="rounded text-[#002D56] focus:ring-[#002D56]" checked={options.includeCautionNotes} onChange={e => setOptions({...options, includeCautionNotes: e.target.checked})} />
               <span className="text-sm font-medium text-slate-700">Cảnh báo kiểm chứng số liệu</span>
             </label>
           </div>
        </div>
      </div>

      {(!validation.isValid || validation.warnings.length > 0) && (
        <div className={`p-4 rounded-lg border ${!validation.isValid ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            {!validation.isValid ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            <span className={`font-bold ${!validation.isValid ? 'text-red-800' : 'text-amber-800'}`}>
              {!validation.isValid ? "Không thể xuất bản" : "Cần lưu ý trước khi xuất"}
            </span>
          </div>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-slate-700">
             {validation.errors.map((e, i) => <li key={`exp-err-${i}`} className="text-red-700">{e}</li>)}
             {validation.warnings.map((w, i) => <li key={`exp-warn-${i}`}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-3">
        <button 
          onClick={handleExportPptx}
          disabled={!validation.isValid || isExporting}
          className="flex-1 min-w-[200px] px-6 py-3 bg-[#002D56] text-white rounded-lg shadow font-bold text-sm hover:bg-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Presentation className="w-4 h-4" />
          {isExporting ? "Đang xử lý..." : "Tải file PowerPoint (.pptx)"}
        </button>
        <button 
          onClick={async () => {
             try {
               setIsExporting(true);
               const { exportSlideOutlineToWord } = await import('../../lib/slideWordExport');
               await exportSlideOutlineToWord(outline, options);
               toast.success("Xuất bản Word thành công!");
               await logActivity({
                 action: 'exported',
                 module: 'editorial',
                 entityType: 'editorial_session',
                 entityId: 'docx',
                 entityTitle: outline.title,
                 title: 'Xuất Kịch bản Word',
                 summary: `Đã xuất khung kịch bản thuyết trình chi tiết cho bài "${outline.title}".`
               });
               if (onExportComplete) onExportComplete('docx');
             } catch (e) {
               toast.error("Lỗi xuất Word.");
             } finally {
               setIsExporting(false);
             }
          }}
          disabled={!validation.isValid || isExporting}
          className="px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg shadow-sm font-bold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText className="w-4 h-4 text-blue-600" />
          Tải bản Outline (.docx)
        </button>
        <button 
          onClick={handleCopyGamma}
          disabled={!validation.isValid}
          className="px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg shadow-sm font-bold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy className="w-4 h-4 text-purple-600" />
          Copy Gamma Markdown
        </button>
        <button 
          onClick={handleGenerateHTML}
          disabled={!validation.isValid || isExporting}
          className="px-6 py-3 bg-white border border-dashed border-emerald-300 text-emerald-800 rounded-lg shadow-sm font-semibold text-xs hover:bg-emerald-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed tracking-normal opacity-80 mt-4 sm:col-span-full"
        >
          <Code className="w-4 h-4 text-emerald-600" />
          [Thử nghiệm] Tạo bản HTML (Cinema AI)
        </button>
      </div>

    </div>
  );
}
