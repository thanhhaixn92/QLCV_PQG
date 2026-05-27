import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Plus, Loader2, Check, AlertTriangle, Clock } from 'lucide-react';
import { TASK_CATEGORIES, WorkTaskPriority } from '../../types';
import { createClientId, extractJsonFromText, normalizeAIResponseToArray } from '../../lib/taskAiUtils';

export type ProposedTask = {
  clientId: string;
  title: string;
  description: string;
  assigneeName?: string;
  dueDate?: string;
  priority: "low" | "medium" | "high" | "urgent";
  category: string;
  selected: boolean;
};

// 1. Helper function to normalize priorities
export function normalizePriority(val: any): "low" | "medium" | "high" | "urgent" {
  if (!val) return "medium";
  const s = String(val).toLowerCase().trim();
  if (s.includes("thấp") || s === "low") return "low";
  if (s.includes("cao") || s === "high") return "high";
  if (s.includes("khẩn") || s === "urgent" || s.includes("gấp")) return "urgent";
  return "medium";
}

// 2. Helper function to normalize task categories
export function normalizeCategory(val: any): string {
  if (!val) return "LV_DH";
  const s = String(val).toUpperCase().trim();
  if (s === "LV_DH" || s.includes("ĐIỀU HÀNH")) return "LV_DH";
  if (s === "LV_AT" || s.includes("AN TOÀN")) return "LV_AT";
  if (s === "LV_KT" || s.includes("KỸ THUẬT")) return "LV_KT";
  if (s === "LV_TC" || s.includes("TÀI CHÍNH")) return "LV_TC";
  if (s === "LV_TCCB" || s.includes("TỔ CHỨC") || s.includes("LAO ĐỘNG") || s.includes("LĐ")) return "LV_TCCB";
  if (s === "LV_VPDT" || s.includes("VĂN PHÒNG") || s.includes("VPDT")) return "LV_VPDT";
  if (s === "LV_KHDN" || s.includes("KẾ HOẠCH") || s.includes("KINH DOANH") || s.includes("KHDN") || s.includes("KD")) return "LV_KHDN";
  if (s === "LV_PCTTRA" || s.includes("PHÁP CHẾ") || s.includes("THANH TRA") || s.includes("PCTTRA")) return "LV_PCTTra";
  return "LV_DH";
}

// 3. Fallback local parser for separating raw text by comma/semicolon/newline
export const fallbackLocalTasks = (input: string): ProposedTask[] => {
  const parts = input.split(/[,;\n\r]+/).map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length === 0) return [];
  
  return parts.map((part, index) => {
    let title = part;
    if (/\d+h/i.test(part) && !part.toLowerCase().includes("lúc")) {
      title = part.replace(/(\d+h)/i, "lúc $1");
    } else if (/\d+\s*gi/i.test(part) && !part.toLowerCase().includes("lúc")) {
      title = part.replace(/(\d+\s*gi[\w]*)/i, "lúc $1");
    }
    
    return {
      clientId: createClientId(),
      title: title,
      description: "Được tách ý tự động theo phân tách văn bản nhanh",
      assigneeName: "",
      dueDate: "",
      priority: "medium",
      category: "LV_DH",
      selected: true
    };
  });
};

// 4. Robust structure parser for AI outputs (handles direct arrays, nested keys, JSON strings)
export function parseAIProposedTasks(raw: any, fallbackOffset: number = 0): ProposedTask[] {
  if (!raw) return [];
  
  const parsed = typeof raw === "string" ? extractJsonFromText(raw) : raw;
  const arr = normalizeAIResponseToArray(parsed);
  
  return arr.map((item: any) => {
    if (!item || typeof item !== "object") return null;
    const title = String(item.title || item.name || item.summary || item.content || "").trim();
    if (!title) return null;
    
    return {
      clientId: createClientId(),
      title,
      description: String(item.description || item.desc || "").trim(),
      assigneeName: String(item.assigneeName || item.assignee || "").trim(),
      dueDate: String(item.dueDate || item.due_date || "").trim(),
      priority: normalizePriority(item.priority || item.priorityLevel),
      category: normalizeCategory(item.category || item.categoryCode || item.category_code),
      selected: true
    };
  }).filter(Boolean) as ProposedTask[];
}

export const TaskAICreateModal = ({ isOpen, onClose, onSave, onAnalyze, isAnalyzing, setTaskFilters }: any) => {
  const [content, setContent] = useState('');
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([]);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  React.useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleAnalyze = async () => {
    if (!content.trim()) return;
    setErrorMessage(null);
    setIsLocalFallback(false);
    setProposedTasks([]);

    // Call AI analyzer from parent
    const res = await onAnalyze(content);
    
    // Check if res is an error object
    if (res && typeof res === "object" && res.success === false) {
      const errType = res.errorType || "ai_error";
      const blockFallback = ["quota_exceeded", "invalid_api_key", "safety_blocked", "model_not_available", "missing_api_key"].includes(errType);
      
      if (errType === "quota_exceeded") {
        setCooldownRemaining(60);
      }

      if (blockFallback) {
        let vietnameseMsg = res.message;
        if (errType === "quota_exceeded") {
          vietnameseMsg = "Đã vượt hạn mức AI tạm thời (Quota Exceeded). Anh vui lòng thử lại sau.";
        } else if (errType === "invalid_api_key" || errType === "missing_api_key") {
          vietnameseMsg = "Chưa cấu hình API Key AI hoặc API Key không hợp lệ. Anh vui lòng kiểm tra Cài đặt.";
        }
        setErrorMessage(vietnameseMsg || "Lỗi cuộc gọi API từ AI.");
        return;
      } else {
        const fallback = fallbackLocalTasks(content);
        if (fallback.length > 0) {
          setProposedTasks(fallback);
          setIsLocalFallback(true);
        } else {
          setErrorMessage(res.message || "Lỗi khi gọi AI phân tích công việc. Anh vui lòng thử lại.");
        }
        return;
      }
    }

    const rawResult = (res && typeof res === "object") ? res.text : (res || "");
    // Parse the output robustly
    let tasks = parseAIProposedTasks(rawResult);
    
    if (tasks && tasks.length > 0) {
      setProposedTasks(tasks);
    } else {
      // Fallback local separator and parser
      const fallback = fallbackLocalTasks(content);
      if (fallback.length > 0) {
        setProposedTasks(fallback);
        setIsLocalFallback(true);
      } else {
        setErrorMessage("AI chưa tách được công việc từ nội dung này. Anh vui lòng viết rõ hơn theo dạng: việc cần làm, thời hạn, người phụ trách; hoặc thử lại.");
      }
    }
  };

  const updateTaskField = (clientId: string, field: keyof ProposedTask, value: any) => {
    setProposedTasks((prev) =>
      prev.map((t) => (t.clientId === clientId ? { ...t, [field]: value } : t))
    );
  };

  const handleSave = () => {
    const selectedTasks = proposedTasks.filter((t) => t.selected);
    
    // Safety verification
    const emptyTitleTasks = selectedTasks.filter(t => !t.title.trim());
    if (emptyTitleTasks.length > 0) {
      alert("Nhiệm vụ không được để trống tiêu đề.");
      return;
    }

    const tasksToSave = selectedTasks.map((t) => ({
      title: t.title.trim(),
      description: t.description.trim(),
      assignee: t.assigneeName?.trim() || "",
      dueDate: t.dueDate || "",
      priority: t.priority,
      categoryCode: t.category || "LV_DH",
    }));

    onSave(tasksToSave);
    onClose();
    setContent('');
    setProposedTasks([]);
    setIsLocalFallback(false);
    setErrorMessage(null);
    setTaskFilters((prev: any) => ({
      ...prev,
      status: 'all',
      priority: 'all',
      category: 'all',
      search: '',
    }));
  };

  if (!isOpen) return null;

  const selectedCount = proposedTasks.filter((t) => t.selected).length;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-4xl h-[90vh] md:h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">Tạo công việc bằng AI</h2>
              <p className="text-xs font-semibold text-purple-600/80">Nhập chỉ đạo hoặc văn bản để tách việc tự động</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 transition-colors bg-white rounded-full shadow-sm border border-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {proposedTasks.length === 0 ? (
            <div className="p-6 flex-1 flex flex-col items-center justify-center bg-slate-50/50">
              <div className="w-full max-w-2xl space-y-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Dán nội dung chỉ đạo, biên bản họp, văn bản, email... AI sẽ phân tích và tách thành các nhiệm vụ cụ thể. Ví dụ: Họp 14h, phân công công việc, chuẩn bị đồ về quê 5h..."
                  className="w-full h-64 bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none shadow-sm transition-shadow"
                />

                {errorMessage && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs font-medium text-orange-700 flex gap-2 items-start shadow-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !content.trim() || cooldownRemaining > 0}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : cooldownRemaining > 0 ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {isAnalyzing ? (
                      "AI đang phân tích nội dung và tách việc..."
                    ) : cooldownRemaining > 0 ? (
                      `Thử lại sau ${cooldownRemaining}s`
                    ) : (
                      "Phân tích nội dung"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto bg-slate-50/80 p-6 custom-scrollbar flex flex-col">
              <div className="max-w-4xl mx-auto w-full space-y-4 flex-1">
                {isLocalFallback && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700 flex gap-2 items-center shadow-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>AI chưa trả về danh sách rõ ràng, hệ thống đã tách nhanh nội dung để anh kiểm tra trước khi lưu.</span>
                  </div>
                )}

                <div className="space-y-3.5">
                  {proposedTasks.map((task) => (
                    <div 
                      key={task.clientId} 
                      className={`p-5 bg-white border rounded-xl shadow-sm transition-all ${
                        task.selected ? 'border-purple-300 ring-2 ring-purple-100/50' : 'border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="pt-1 select-none">
                          <button 
                            onClick={() => updateTaskField(task.clientId, 'selected', !task.selected)}
                            className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                              task.selected 
                                ? 'bg-purple-600 border-purple-600 text-white' 
                                : 'bg-slate-50 border-slate-300 text-transparent hover:border-purple-400'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <input 
                            type="text" 
                            value={task.title}
                            onChange={(e) => updateTaskField(task.clientId, 'title', e.target.value)}
                            className="w-full text-[15px] font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-200 pb-1 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Tiêu đề công việc"
                          />
                          
                          <textarea 
                            value={task.description}
                            onChange={(e) => updateTaskField(task.clientId, 'description', e.target.value)}
                            className="w-full text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none transition-shadow"
                            rows={2}
                            placeholder="Mô tả công việc"
                          />
                          
                          <div className="flex flex-wrap gap-2.5">
                            <input 
                              type="text" 
                              placeholder="Người xử lý..."
                              value={task.assigneeName || ''}
                              onChange={(e) => updateTaskField(task.clientId, 'assigneeName', e.target.value)}
                              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white min-w-[140px] focus:ring-1 focus:ring-purple-400 focus:outline-none shadow-sm"
                            />
                            
                            <input 
                              type="date"
                              value={task.dueDate || ''}
                              onChange={(e) => updateTaskField(task.clientId, 'dueDate', e.target.value)}
                              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:ring-1 focus:ring-purple-400 focus:outline-none shadow-sm"
                              title="Hạn xử lý"
                            />
                            
                            <select 
                              value={task.priority}
                              onChange={(e) => updateTaskField(task.clientId, 'priority', e.target.value)}
                              className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:ring-1 focus:ring-purple-400 focus:outline-none shadow-sm font-semibold"
                            >
                              <option value="low">Ưu tiên: Thấp</option>
                              <option value="medium">Ưu tiên: Thường</option>
                              <option value="high">Ưu tiên: Cao</option>
                              <option value="urgent">Khẩn cấp</option>
                            </select>
                            
                            <select 
                              value={task.category}
                              onChange={(e) => updateTaskField(task.clientId, 'category', e.target.value)}
                              className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-700 bg-white max-w-[200px] truncate focus:ring-1 focus:ring-purple-400 focus:outline-none shadow-sm font-semibold"
                            >
                              {TASK_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {proposedTasks.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.03)] z-10">
            <button 
              onClick={() => { setProposedTasks([]); setContent(''); setIsLocalFallback(false); }}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              Hủy / Tải lại văn bản
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-500">Đã chọn: <span className="text-purple-600">{selectedCount}</span>/{proposedTasks.length}</span>
              <button 
                onClick={handleSave}
                disabled={selectedCount === 0}
                className="px-8 py-2.5 bg-[#002D56] hover:bg-blue-900 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lưu công việc được chọn
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
