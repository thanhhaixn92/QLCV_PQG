import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SlideOutlineResult, SlideOutlineItem } from '../../types/slideOutline';
import { 
  Presentation, 
  Trash2, 
  Save,
  Target,
  Copy,
  ChevronUp,
  ChevronDown,
  Wand2,
  AlertTriangle,
  Lightbulb,
  Plus,
  X,
  Star,
  CheckCircle2,
  Eye,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  Type,
  Layout,
  MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { SlideExportPanel } from './SlideExportPanel';

interface Props {
  initialResult: SlideOutlineResult;
  onSave: (result: SlideOutlineResult) => void;
  onCreateTask: (result: SlideOutlineResult) => void;
  token?: string;
  onClose?: () => void;
}

export function SlideOutlineWorkspace({ initialResult, onSave, onCreateTask, token, onClose }: Props) {
  const [outline, setOutline] = useState<SlideOutlineResult>(initialResult);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'extras' | 'export'>('editor');

  // Initialize IDs if missing
  useEffect(() => {
    let changed = false;
    const mapped = outline.slides.map(s => {
      if (!s.id) {
        changed = true;
        return { ...s, id: crypto.randomUUID() };
      }
      return s;
    });
    if (changed) {
      setOutline({ ...outline, slides: mapped as SlideOutlineItem[] });
      setSelectedSlideId(mapped[0]?.id || null);
    } else if (!selectedSlideId && mapped.length > 0) {
      setSelectedSlideId(mapped[0].id || null);
    }
  }, []);

  const selectedSlide = outline.slides.find(s => s.id === selectedSlideId);

  const updateSlide = (id: string, partial: Partial<SlideOutlineItem>) => {
    setOutline(prev => ({
      ...prev,
      slides: prev.slides.map(s => s.id === id ? { ...s, ...partial } : s)
    }));
  };

  const reorderSlide = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...outline.slides];
    if (direction === 'up' && index > 0) {
      [newSlides[index - 1], newSlides[index]] = [newSlides[index], newSlides[index - 1]];
    } else if (direction === 'down' && index < newSlides.length - 1) {
      [newSlides[index + 1], newSlides[index]] = [newSlides[index], newSlides[index + 1]];
    }
    // Update slide numbers
    newSlides.forEach((s, idx) => s.slideNumber = idx + 1);
    setOutline({ ...outline, slides: newSlides });
  };

  const deleteSlide = (id: string) => {
    const newSlides = outline.slides.filter(s => s.id !== id);
    newSlides.forEach((s, idx) => s.slideNumber = idx + 1);
    setOutline({ ...outline, slides: newSlides });
    if (selectedSlideId === id) {
      setSelectedSlideId(newSlides[0]?.id || null);
    }
  };

  const cloneSlide = (index: number) => {
    const newSlides = [...outline.slides];
    const source = newSlides[index];
    const cloned: SlideOutlineItem = { 
      ...source, 
      id: crypto.randomUUID(),
      title: source.title + " (Copy)"
    };
    newSlides.splice(index + 1, 0, cloned);
    newSlides.forEach((s, idx) => s.slideNumber = idx + 1);
    setOutline({ ...outline, slides: newSlides, slideCount: newSlides.length });
    setSelectedSlideId(cloned.id!);
  };

  const addNewSlide = () => {
    const newSlides = [...outline.slides];
    const newSlide: SlideOutlineItem = {
      id: crypto.randomUUID(),
      slideNumber: newSlides.length + 1,
      title: "Slide mới",
      bullets: ["Nội dung 1"],
      layoutType: "content"
    };
    newSlides.push(newSlide);
    setOutline({ ...outline, slides: newSlides, slideCount: newSlides.length });
    setSelectedSlideId(newSlide.id!);
  };

  const handleAiRefine = async (action: string, slideId: string) => {
    if (!token) return toast.error("Cần đăng nhập để sử dụng AI");
    const targetSlide = outline.slides.find(s => s.id === slideId);
    if (!targetSlide) return;

    try {
      setIsRefining(true);
      const res = await fetch('/api/ai/slide-outline/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          slide: targetSlide,
          audience: outline.audience,
          style: outline.style,
          wholeOutlineContext: outline.mainMessage
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      const newSlideData = data.updatedSlide;
      updateSlide(slideId, {
        ...newSlideData,
        id: targetSlide.id, // Preserve our exact UI ID
        slideNumber: targetSlide.slideNumber,
        bullets: Array.isArray(newSlideData.bullets) ? newSlideData.bullets : [],
        dataOrEvidence: Array.isArray(newSlideData.dataOrEvidence) ? newSlideData.dataOrEvidence : [],
        cautionNotes: Array.isArray(newSlideData.cautionNotes) ? newSlideData.cautionNotes : [],
      });
      toast.success(data.explanation || "Đã tinh chỉnh bằng AI");
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi gọi AI");
    } finally {
      setIsRefining(false);
    }
  };

  const handleOptimizeDeck = async () => {
    if (!token) return toast.error("Cần đăng nhập để sử dụng AI");
    
    try {
      setIsRefining(true);
      toast.loading("Đang tối ưu toàn bộ Slide...", { id: "optimize" });
      const res = await fetch('/api/ai/slide-outline/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          outline,
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      // Add missing IDs and missing arrays to the new output
      const optimized = (data.optimizedOutline.slides || []).map((s: any) => ({
         ...s,
         id: crypto.randomUUID(),
         bullets: Array.isArray(s.bullets) ? s.bullets : [],
         dataOrEvidence: Array.isArray(s.dataOrEvidence) ? s.dataOrEvidence : [],
         cautionNotes: Array.isArray(s.cautionNotes) ? s.cautionNotes : [],
      }));

      setOutline({
         ...outline,
         ...data.optimizedOutline,
         slides: optimized,
      });
      setSelectedSlideId(optimized[0]?.id || null);
      toast.success("Đã tối ưu hóa Slide cho trình chiếu!", { id: "optimize" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi gọi AI tối ưu slide", { id: "optimize" });
    } finally {
      setIsRefining(false);
    }
  };

  const handleGetFeedback = async () => {
    if (!token) return toast.error("Cần đăng nhập để sử dụng AI");
    
    try {
      setIsRefining(true);
      toast.loading("AI đang phân tích slide của bạn...", { id: "feedback" });
      const res = await fetch('/api/ai/slide-outline/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ outline })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      setFeedbackData(data.feedback);
      setShowFeedbackModal(true);
      toast.success("Đã nhận được góp ý của AI!", { id: "feedback" });
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi gọi AI góp ý", { id: "feedback" });
    } finally {
      setIsRefining(false);
    }
  };

  // Validation inline
  const getSlideErrors = (s: SlideOutlineItem) => {
    const errors = [];
    if (s.title.length > 80) errors.push("Tiêu đề quá dài (>80 ký tự)");
    if (s.bullets.length > 5) errors.push("Quá nhiều bullet (>5)");
    if (s.bullets.some(b => b.length > 120)) errors.push("Có bullet quá dài (>120 ký tự)");
    return errors;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{outline.title}</h2>
          <p className="text-xs text-slate-500 font-medium">{outline.slides.length} slides • {outline.audience}</p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-sm font-bold transition-colors">
              Đóng
            </button>
          )}
          <button 
            onClick={() => onSave(outline)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-[#002D56] rounded shadow-sm text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Lưu phiên bản
          </button>
          <button 
            onClick={() => onCreateTask(outline)}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded shadow-sm text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
          >
            <Target className="w-4 h-4" /> Tạo Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex items-center gap-6 shrink-0 overflow-x-auto whitespace-nowrap custom-scrollbar">
         <button 
           onClick={() => setActiveTab('editor')}
           className={cn("py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'editor' ? 'border-[#002D56] text-[#002D56]' : 'border-transparent text-slate-500 hover:text-slate-800')}
         >
            Chỉnh sửa Slide
         </button>
         <button 
           onClick={() => setActiveTab('extras')}
           className={cn("py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'extras' ? 'border-[#002D56] text-[#002D56]' : 'border-transparent text-slate-500 hover:text-slate-800')}
         >
            Tài liệu kèm theo
         </button>
         <button 
           onClick={() => setActiveTab('export')}
           className={cn("py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'export' ? 'border-[#002D56] text-[#002D56]' : 'border-transparent text-slate-500 hover:text-slate-800')}
         >
            Xuất bản & PPTX
         </button>
      </div>

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden lg:flex-row">
        {activeTab === 'editor' ? (
          <>
            {/* Left: Storyboard */}
            <div className="w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-64 lg:border-b-0 lg:border-r flex max-h-[30vh] lg:max-h-full">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xs font-bold text-slate-400 tracking-normal">Storyboard</h3>
                <button onClick={addNewSlide} className="p-1 text-[#002D56] hover:bg-blue-50 rounded" title="Thêm slide" aria-label="Thêm slide">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-2 lg:block flex gap-3 lg:space-x-0 overflow-x-auto lg:overflow-x-hidden">
                {outline.slides.map((s, idx) => {
                  const errors = getSlideErrors(s);
                  return (
                    <div 
                      key={`storyboard-slide-${s.id || idx}`}
                      onClick={() => setSelectedSlideId(s.id!)}
                      className={cn(
                        "p-3 rounded-lg border group cursor-pointer transition-all shrink-0 w-60 lg:w-auto",
                        selectedSlideId === s.id 
                          ? "bg-blue-50/50 border-[#002D56] shadow-sm" 
                          : "bg-white border-slate-100 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Slide {s.slideNumber}</span>
                        {errors.length > 0 && <div title={errors.join("\n")}><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /></div>}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2">{s.title || "Chưa có tiêu đề"}</h4>
                      
                      <div className="mt-2 flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); reorderSlide(idx, 'up'); }} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); reorderSlide(idx, 'down'); }} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); cloneSlide(idx); }} className="p-1 hover:bg-slate-200 rounded text-slate-500 ml-auto"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteSlide(s.id!); }} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center: Editor */}
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-slate-50 min-w-0">
              {selectedSlide ? (
                <div className="p-6 md:p-8 max-w-3xl mx-auto w-full space-y-6">
                  
                  {/* Toolbar */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 font-medium text-xs text-slate-500 mr-2">AI Refine</span>
                    {isRefining ? (
                      <span className="text-xs font-medium text-[#002D56] animate-pulse flex items-center gap-2">
                        <Wand2 className="w-3.5 h-3.5" /> Đang xử lý...
                      </span>
                    ) : (
                      <>
                        <button onClick={() => handleAiRefine('rewrite_title', selectedSlide.id!)} className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition flex items-center gap-1.5"><Wand2 className="w-3 h-3" /> Sửa tiêu đề</button>
                        <button onClick={() => handleAiRefine('shorten_slide', selectedSlide.id!)} className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition flex items-center gap-1.5"><Wand2 className="w-3 h-3" /> Rút gọn text</button>
                        <button onClick={() => handleAiRefine('generate_speaker_notes', selectedSlide.id!)} className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 transition flex items-center gap-1.5"><Wand2 className="w-3 h-3" /> Viết lời dẫn</button>
                        <div className="w-px h-5 bg-slate-200 mx-1"></div>
                        <button onClick={handleOptimizeDeck} className="px-2.5 py-1.5 text-[11px] font-bold rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 transition flex items-center gap-1.5 ml-auto"><Wand2 className="w-3 h-3" /> Tối ưu toàn bộ Slide</button>
                        <button onClick={handleGetFeedback} className="px-2.5 py-1.5 text-[11px] font-bold rounded border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 transition flex items-center gap-1.5 ml-1"><Lightbulb className="w-3 h-3" /> AI Góp ý</button>
                      </>
                    )}
                  </div>

                  {/* Main Content Area */}
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-[#002D56] px-5 py-3 text-white flex items-center justify-between">
                      <h3 className="text-sm font-bold font-medium text-xs text-slate-500">Slide {selectedSlide.slideNumber}</h3>
                    </div>
                    
                    <div className="p-6 space-y-5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tiêu đề Slide</label>
                        <input 
                          type="text" 
                          value={selectedSlide.title}
                          onChange={(e) => updateSlide(selectedSlide.id!, { title: e.target.value })}
                          className="w-full text-xl font-bold text-slate-900 border-0 border-b-2 border-slate-100 px-0 py-2 focus:ring-0 focus:border-[#002D56] bg-transparent"
                        />
                      </div>
                      
                      {selectedSlide.keyMessage !== undefined && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Thông điệp cốt lõi</label>
                          <input 
                            type="text" 
                            value={selectedSlide.keyMessage}
                            onChange={(e) => updateSlide(selectedSlide.id!, { keyMessage: e.target.value })}
                            className="w-full text-sm font-medium text-[#002D56] italic bg-blue-50 border-0 rounded px-3 py-2 focus:ring-2 focus:ring-[#002D56]"
                            placeholder="Một câu thông điệp..."
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                           <label className="text-[11px] font-bold text-slate-500 uppercase">Các ý chính (Bullets)</label>
                           <span className={cn("text-[10px] font-bold", selectedSlide.bullets.length > 5 ? "text-red-500" : "text-slate-400")}>{selectedSlide.bullets.length}/5</span>
                        </div>
                        <div className="space-y-2">
                          {selectedSlide.bullets.map((b, bIdx) => (
                            <div key={`slide-${selectedSlide.id}-bullet-${bIdx}`} className="flex items-start gap-2 group">
                              <span className="text-slate-300 select-none mt-1.5">•</span>
                              <textarea 
                                value={b}
                                onChange={(e) => {
                                  const newB = [...selectedSlide.bullets];
                                  newB[bIdx] = e.target.value;
                                  updateSlide(selectedSlide.id!, { bullets: newB });
                                }}
                                rows={1}
                                className="flex-1 text-sm bg-transparent border-slate-200 rounded p-1.5 focus:ring-2 focus:ring-[#002D56] resize-none"
                              />
                              <button 
                                 onClick={() => {
                                   const newB = selectedSlide.bullets.filter((_, i) => i !== bIdx);
                                   updateSlide(selectedSlide.id!, { bullets: newB });
                                 }}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => updateSlide(selectedSlide.id!, { bullets: [...selectedSlide.bullets, ''] })}
                            className="text-[11px] font-bold text-[#002D56] flex items-center gap-1 hover:underline ml-4"
                          >
                            <Plus className="w-3 h-3" /> Thêm bullet
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Presenter Notes */}
                  <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 font-medium text-xs text-slate-500 flex items-center gap-2 border-b border-slate-100 pb-3">
                      <Lightbulb className="w-4 h-4 text-amber-500" /> Ghi chú trình bày
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Gợi ý hình ảnh / Biểu đồ</label>
                        <textarea 
                          value={selectedSlide.visualSuggestion || ''}
                          onChange={(e) => updateSlide(selectedSlide.id!, { visualSuggestion: e.target.value })}
                          placeholder="VD: Sử dụng biểu đồ tròn thể hiện tỷ lệ..."
                          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md p-3 min-h-[80px] focus:ring-2 focus:ring-[#002D56] focus:border-transparent resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Lời dẫn (Speaker Notes)</label>
                        <textarea 
                          value={selectedSlide.speakerNotes || ''}
                          onChange={(e) => updateSlide(selectedSlide.id!, { speakerNotes: e.target.value })}
                          placeholder="VD: Kính thưa các đồng chí..."
                          className="w-full text-sm bg-emerald-50/50 border border-emerald-100 rounded-md p-3 min-h-[80px] focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                        />
                      </div>
                    </div>
                    
                    {selectedSlide.cautionNotes && selectedSlide.cautionNotes.length > 0 && (
                      <div>
                        <label className="block text-[11px] font-bold text-red-500 uppercase mb-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Dữ liệu cần kiểm chứng</label>
                        <div className="bg-red-50 p-3 rounded-md border border-red-100">
                           <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                              {selectedSlide.cautionNotes.map((c, i) => (
                                 <li key={`slide-${selectedSlide.id}-caution-${i}`}>{c}</li>
                              ))}
                           </ul>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm font-medium">
                  Chọn một slide để chỉnh sửa
                </div>
              )}
            </div>

            {/* Right: Preview Mini */}
            {selectedSlide && (
              <div className="hidden xl:flex w-80 bg-white border-l border-slate-200 flex-col p-6 shrink-0 space-y-6">
                 <h3 className="text-xs font-bold text-slate-400 font-medium text-xs text-slate-500 border-b border-slate-100 pb-2">Preview Slide (16:9)</h3>
                 
                 {/* Slide Preview Card Mock */}
                 <div className="aspect-video w-full rounded border border-slate-200 shadow-sm flex flex-col p-4 bg-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-[#002D56]"></div>
                    <div className="flex items-center justify-between mb-3 mt-1">
                       <h4 className="text-[10px] font-bold text-slate-400">SLIDE {selectedSlide.slideNumber}</h4>
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 leading-tight mb-3 line-clamp-2">{selectedSlide.title}</h2>
                    <div className="flex-1 flex gap-2">
                       <div className="flex-1">
                          <ul className="text-[9px] text-slate-700 space-y-1.5 px-3 list-disc">
                             {selectedSlide.bullets.slice(0, 5).map((b, i) => <li key={`slide-${selectedSlide.id}-preview-${i}`} className="line-clamp-2">{b}</li>)}
                          </ul>
                       </div>
                       {selectedSlide.visualSuggestion && (
                         <div className="w-24 bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-center p-2 text-center text-[8px] text-slate-400 italic">
                            {selectedSlide.visualSuggestion}
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="pt-4 border-t border-slate-100">
                   <h3 className="text-xs font-bold text-slate-400 font-medium text-xs text-slate-500 mb-3">Thông tin bản trình bày</h3>
                   <div className="space-y-2 text-xs">
                     <p className="flex justify-between"><span className="text-slate-500">Đối tượng:</span> <span className="font-semibold text-slate-800 capitalize">{outline.audience.replace('_', ' ')}</span></p>
                     <p className="flex justify-between"><span className="text-slate-500">Phong cách:</span> <span className="font-semibold text-slate-800 capitalize">{outline.style.replace('_', ' ')}</span></p>
                   </div>
                 </div>
              </div>
            )}
          </>
        ) : activeTab === 'extras' ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
             <div className="bg-white rounded-lg border border-slate-200 xl:border-slate-300 shadow-sm p-6 space-y-8 max-w-4xl mx-auto">
               <div>
                 <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">Tài liệu phát tay (Handout) / Speaker Script tổng hợp</h3>
                 <textarea
                   className="w-full text-sm bg-slate-50 border border-slate-200 rounded-md p-4 min-h-[200px] focus:ring-2 focus:ring-[#002D56] focus:border-transparent resize-y"
                   value={outline.handout || ''}
                   onChange={(e) => setOutline({ ...outline, handout: e.target.value })}
                   placeholder="Nhập nội dung tài liệu phát tay tóm tắt..."
                 />
                 <p className="mt-2 text-xs text-slate-500 italic">* Nội dung này sẽ được sử dụng để in ra phát cho khán giả hoặc ban giám khảo đọc trước/sau buổi thuyết trình.</p>
               </div>

               <div>
                 <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                   <h3 className="text-lg font-bold text-slate-800">Q&A Dự kiến (Hỏi - Đáp)</h3>
                   <button 
                     onClick={() => setOutline({ ...outline, expectedQA: [...(outline.expectedQA || []), { question: '', answer: '' }] })}
                     className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded transition"
                   >
                     + Thêm Q&A
                   </button>
                 </div>
                 {(!outline.expectedQA || outline.expectedQA.length === 0) ? (
                   <div className="text-sm text-slate-500 italic p-4 text-center border border-dashed rounded-lg bg-slate-50">Chưa có câu hỏi dự kiến nào. Bấm "Thêm Q&A" để tự chuẩn bị các câu hỏi khán giả có thể đưa ra.</div>
                 ) : (
                   <div className="space-y-4">
                     {outline.expectedQA.map((qa, i) => (
                       <div key={`slide-qa-${i}-${qa.question.slice(0, 10)}`} className="flex flex-col gap-2 p-4 bg-slate-50 border border-slate-200 rounded-lg group relative">
                         <button
                           onClick={() => {
                             const newQA = [...outline.expectedQA!];
                             newQA.splice(i, 1);
                             setOutline({ ...outline, expectedQA: newQA });
                           }}
                           className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition"
                           title="Xóa Q&A"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                         <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Khán giả hỏi:</label>
                           <input
                             value={qa.question}
                             onChange={(e) => {
                               const newQA = [...outline.expectedQA!];
                               newQA[i].question = e.target.value;
                               setOutline({ ...outline, expectedQA: newQA });
                             }}
                             placeholder="Nhập câu hỏi dự đoán..."
                             className="w-full text-sm font-semibold border-slate-200 rounded px-3 py-2 focus:ring-[#002D56] pr-8"
                           />
                         </div>
                         <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dự kiến trả lời:</label>
                           <textarea
                             value={qa.answer}
                             onChange={(e) => {
                               const newQA = [...outline.expectedQA!];
                               newQA[i].answer = e.target.value;
                               setOutline({ ...outline, expectedQA: newQA });
                             }}
                             placeholder="Nhập gợi ý trả lời..."
                             className="w-full text-sm bg-white border-slate-200 rounded px-3 py-2 min-h-[60px] focus:ring-[#002D56]"
                           />
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
             <SlideExportPanel outline={outline} onExportComplete={(format) => {
               if (format === 'pptx') {
                 // Save session immediately when user exports
                 onSave({ ...outline, theme: outline.theme });
               }
             }} />
          </div>
        )}
      </div>
      {/* Feedback Modal */}
      {showFeedbackModal && feedbackData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50">
               <div className="flex items-center gap-2 text-amber-800">
                  <Lightbulb className="w-5 h-5" />
                  <h3 className="font-bold">Góp ý từ Chuyên gia AI</h3>
               </div>
               <button onClick={() => setShowFeedbackModal(false)} className="p-2 hover:bg-amber-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-amber-800" />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 tracking-wide mb-1">Điểm đánh giá tổng thể</p>
                    <div className="flex items-center gap-1">
                       {[...Array(10)].map((_, i) => (
                         <Star key={`score-star-${i}`} className={cn("w-4 h-4", i < feedbackData.overallScore ? "text-amber-500 fill-amber-500" : "text-slate-300")} />
                       ))}
                       <span className="ml-2 font-bold text-slate-700">{feedbackData.overallScore}/10</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-xs font-semibold text-slate-500 tracking-wide mb-1">Tông giọng</p>
                     <p className="text-sm font-medium text-slate-700">{feedbackData.toneAnalysis}</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                     <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Điểm mạnh
                     </h4>
                     <ul className="space-y-2">
                        {feedbackData.strengths.map((s: string, i: number) => (
                          <li key={`fb-strength-${i}`} className="text-xs text-emerald-700 flex gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                             {s}
                          </li>
                        ))}
                     </ul>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                     <h4 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Cần cải thiện
                     </h4>
                     <ul className="space-y-2">
                        {feedbackData.weaknesses.map((w: string, i: number) => (
                          <li key={`fb-weakness-${i}`} className="text-xs text-red-700 flex gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                             {w}
                          </li>
                        ))}
                     </ul>
                  </div>
               </div>

               <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-4 px-1">Đề xuất hành động cụ thể</h4>
                  <div className="space-y-3">
                     {feedbackData.actionableSuggestions.map((s: any, i: number) => (
                       <div key={`fb-action-${i}`} className="p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                          <div className="flex items-start gap-3">
                             <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {s.slideNumber ? `S${s.slideNumber}` : "!!"}
                             </div>
                             <div>
                                <p className="text-sm font-bold text-slate-700 mb-1">{s.issue}</p>
                                <p className="text-xs text-slate-600 leading-relaxed"><span className="font-semibold text-emerald-600">Khắc phục:</span> {s.fix}</p>
                             </div>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
               <button 
                 onClick={() => setShowFeedbackModal(false)}
                 className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors"
               >
                 Đã hiểu
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
