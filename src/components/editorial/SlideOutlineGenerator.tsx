import React, { useState, useEffect } from 'react';
import { 
  SlideOutlineInput, 
  SlideOutlineResult, 
  SlideAudience, 
  SlideOutlineStyle 
} from '../../types/slideOutline';
import { 
  Presentation, 
  Loader2, 
  Clock, 
  Users, 
  BookOpen, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  RefreshCw,
  Save,
  FileText,
  Target,
  Database
} from 'lucide-react';
import { cn } from '../../lib/utils';
import Markdown from 'react-markdown';
import { User as FirebaseUser } from 'firebase/auth';
import { SlideOutlineWorkspace } from './SlideOutlineWorkspace';

interface Props {
  user: FirebaseUser | null;
  selectedSourceDocIds: string[];
  documents: any[];
  onOpenLibrary: () => void;
  onSaveResult: (result: SlideOutlineResult) => void;
  onCreateTask: (result: SlideOutlineResult) => void;
  loadedResult?: SlideOutlineResult;
}

export function SlideOutlineGenerator({
  user,
  selectedSourceDocIds,
  documents,
  onOpenLibrary,
  onSaveResult,
  onCreateTask,
  loadedResult
}: Props) {
  const [sourceText, setSourceText] = useState('');
  const [slideCount, setSlideCount] = useState<number | ''>('');
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('');
  const [audience, setAudience] = useState<SlideAudience>('leaders');
  const [style, setStyle] = useState<SlideOutlineStyle>('administrative');
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(true);
  const [includeVisualSuggestions, setIncludeVisualSuggestions] = useState(true);
  const [includeTiming, setIncludeTiming] = useState(true);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SlideOutlineResult | null>(loadedResult || null);
  const [token, setToken] = useState<string | undefined>();

  useEffect(() => {
     if (user) {
        user.getIdToken().then(t => setToken(t)).catch(console.error);
     }
  }, [user]);

  useEffect(() => {
     if (loadedResult) setResult(loadedResult);
  }, [loadedResult]);

  const selectedDocs = documents.filter(d => selectedSourceDocIds.includes(d.id));

  const handleGenerate = async () => {
    if (!sourceText.trim() && selectedSourceDocIds.length === 0) {
       setError('Vui lòng nhập nội dung hoặc chọn tài liệu nguồn gốc.');
       return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const currentToken = await user?.getIdToken();
      const payload: SlideOutlineInput = {
         sourceText,
         sourceDocumentIds: selectedSourceDocIds,
         sources: selectedDocs.map(d => ({
            name: d.name,
            content: d.content || d.summary || '',
         })),
         slideCount: slideCount === '' ? undefined : Number(slideCount),
         durationMinutes: durationMinutes === '' ? undefined : Number(durationMinutes),
         audience,
         style,
         includeSpeakerNotes,
         includeVisualSuggestions,
         includeTiming
      };

      const res = await fetch('/api/ai/slide-outline', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
         },
         body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!data.success) {
         throw new Error(data.message || data.error || 'Lỗi khi tạo phác thảo');
      }
      
      const normalizedResult = {
        ...data.result,
        slides: (data.result.slides || []).map((slide: any, idx: number) => ({
          ...slide,
          id: slide.id || crypto.randomUUID(),
          title: slide.title || `Slide ${idx + 1}`,
          bullets: Array.isArray(slide.bullets) ? slide.bullets : [],
          dataOrEvidence: Array.isArray(slide.dataOrEvidence) ? slide.dataOrEvidence : [],
          cautionNotes: Array.isArray(slide.cautionNotes) ? slide.cautionNotes : [],
        }))
      };
      
      setResult(normalizedResult);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Có lỗi xảy ra.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
     setResult(null);
     setError(null);
  };

  if (result) {
     return (
        <div className="flex min-h-[calc(100dvh-140px)] w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
           <SlideOutlineWorkspace 
             initialResult={result}
             onSave={onSaveResult}
             onCreateTask={onCreateTask}
             token={token}
             onClose={handleReset}
           />
        </div>
     );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8 bg-slate-50/50">
       <div className="max-w-4xl mx-auto w-full space-y-6">
          <div className="flex flex-col items-center text-center space-y-2 mb-8">
             <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-lg mb-2">
                <Presentation className="w-6 h-6" />
             </div>
             <h2 className="text-xl md:text-2xl font-bold text-[#002D56] tracking-tight">Tạo Phác thảo Slide AI</h2>
             <p className="text-sm text-slate-500 font-medium">Nhập nội dung gốc và tùy chỉnh cấu trúc để AI thiết kế sườn bài thuyết trình.</p>
          </div>

          {error && (
             <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm font-medium flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
             </div>
          )}

          {/* Source Input */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
             <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 tracking-normal">1. Nguồn nội dung gốc</label>
                <button 
                  onClick={onOpenLibrary}
                  className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                >
                   <Database className="w-3.5 h-3.5" /> Chọn từ kho
                </button>
             </div>
             
             {selectedDocs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                   {selectedDocs.map(d => (
                      <div key={d.id} className="bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                         <FileText className="w-3.5 h-3.5" /> {d.name}
                      </div>
                   ))}
                </div>
             )}

             <textarea 
               value={sourceText}
               onChange={e => setSourceText(e.target.value)}
               placeholder="Dán nội dung gốc, báo cáo, tài liệu hoặc url tại đây..."
               className="w-full h-32 md:h-48 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D56] resize-none"
             />
          </div>

          {/* Configs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Sizing */}
             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                <label className="text-sm font-bold text-slate-700 tracking-normal block">2. Chiều dài & Thời lượng</label>
                <div className="space-y-4">
                   <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Số slide mong muốn</p>
                      <input 
                        type="number" min="3" max="30"
                        value={slideCount}
                        onChange={e => setSlideCount(e.target.value ? Number(e.target.value) : '')}
                        placeholder="VD: 10 (từ 3 - 30)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[#002D56] focus:outline-none"
                      />
                   </div>
                   <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Thời lượng thuyết trình</p>
                      <select
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#002D56] focus:outline-none text-slate-700"
                      >
                         <option value="">-- Tính tự động --</option>
                         <option value="5">5 phút</option>
                         <option value="7">7 phút</option>
                         <option value="10">10 phút</option>
                         <option value="15">15 phút</option>
                         <option value="20">20 phút</option>
                         <option value="30">30 phút</option>
                      </select>
                   </div>
                </div>
             </div>

             {/* Style */}
             <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                <label className="text-sm font-bold text-slate-700 tracking-normal block">3. Góc nhìn & Phong cách</label>
                <div className="space-y-4">
                   <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Đối tượng nghe</p>
                      <select
                        value={audience}
                        onChange={e => setAudience(e.target.value as SlideAudience)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#002D56] focus:outline-none text-slate-700"
                      >
                         <option value="leaders">Cấp trên / Lãnh đạo</option>
                         <option value="internal_staff">Cán bộ / Nhân viên nội bộ</option>
                         <option value="conference">Hội nghị / Hội thảo</option>
                         <option value="contest_judges">Ban giám khảo / Hội thi</option>
                         <option value="training_class">Lớp đào tạo nghiệp vụ</option>
                         <option value="public">Công chúng chung</option>
                      </select>
                   </div>
                   <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Phong cách</p>
                      <select
                        value={style}
                        onChange={e => setStyle(e.target.value as SlideOutlineStyle)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#002D56] focus:outline-none text-slate-700"
                      >
                         <option value="administrative">Hành chính - Báo cáo nghiệp vụ</option>
                         <option value="political_report">Báo cáo chính trị</option>
                         <option value="professional_briefing">Thuyết trình chuyên đề</option>
                         <option value="training">Đào tạo - Huấn luyện</option>
                         <option value="corporate_communication">Truyền thông nội bộ</option>
                      </select>
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
             <label className="text-sm font-bold text-slate-700 tracking-normal block mb-4">4. Tùy chọn đi kèm</label>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                   <input type="checkbox" checked={includeSpeakerNotes} onChange={e => setIncludeSpeakerNotes(e.target.checked)} className="rounded text-[#002D56] focus:ring-[#002D56]" />
                   Tạo lời dẫn thuyết trình
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                   <input type="checkbox" checked={includeVisualSuggestions} onChange={e => setIncludeVisualSuggestions(e.target.checked)} className="rounded text-[#002D56] focus:ring-[#002D56]" />
                   Gợi ý hình ảnh/sơ đồ
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                   <input type="checkbox" checked={includeTiming} onChange={e => setIncludeTiming(e.target.checked)} className="rounded text-[#002D56] focus:ring-[#002D56]" />
                   Ước tính thời gian từng slide
                </label>
             </div>
          </div>

          <div className="pt-4">
             <button 
               disabled={isLoading}
               onClick={handleGenerate}
               className="w-full md:w-auto mx-auto md:w-64 py-3.5 px-8 rounded-lg bg-[#002D56] text-white font-bold text-sm tracking-wide uppercase flex items-center justify-center gap-2 transition-all hover:bg-slate-900 shadow-sm shadow-[#002D56]/20 disabled:opacity-70 disabled:cursor-not-allowed"
             >
                {isLoading ? (
                   <><Loader2 className="w-5 h-5 animate-spin" /> Đang thiết kế slide...</>
                ) : (
                   <><Presentation className="w-5 h-5" /> Phân tích & Tạo phác thảo</>
                )}
             </button>
          </div>

       </div>
    </div>
  );
}

// Ensure the code has no compilation errors, I've used Database icon which needs to be imported
// Let's add it to the top import
