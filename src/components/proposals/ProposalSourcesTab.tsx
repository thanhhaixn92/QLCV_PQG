import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Library, 
  Upload, 
  FileText, 
  Database, 
  Tag, 
  ExternalLink,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  ProposalSource, 
  ProposalSourceType 
} from '../../features/proposals/types';
import { 
  addSource, 
  listSources 
} from '../../features/proposals/proposalService';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ProposalSourcesTabProps {
  userId: string;
  proposalId: string;
  documents: any[]; // Existing library docs
}

export const ProposalSourcesTab: React.FC<ProposalSourcesTabProps> = ({ 
  userId, 
  proposalId,
  documents 
}) => {
  const [sources, setSources] = useState<ProposalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [addMode, setAddMode] = useState<'pick' | 'upload' | null>(null);
  
  // Selection state for picking from library
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<ProposalSourceType>('legal');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableTags = [
    'Pháp lý',
    'Dữ liệu tổ chức',
    'Số liệu tài chính',
    'Nhân sự',
    'Quy chế',
    'Phụ lục'
  ];

  const sourceTypes: { value: ProposalSourceType; label: string }[] = [
    { value: 'legal', label: 'Văn bản Pháp lý' },
    { value: 'data', label: 'Dữ liệu chuyên môn' },
    { value: 'report', label: 'Báo cáo/Tham luận' },
    { value: 'draft', label: 'Dự thảo trước' },
    { value: 'other', label: 'Khác' }
  ];

  useEffect(() => {
    if (userId && proposalId) {
      fetchSources();
    }
  }, [userId, proposalId]);

  const fetchSources = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await listSources(userId, proposalId);
      setSources(data);
    } catch (error: any) {
      console.error('Failed to fetch sources:', error);
      if (error?.message?.includes('permission-denied') || error?.code === 'permission-denied') {
        toast.error("Chưa có quyền đọc dữ liệu đề án. Vui lòng kiểm tra Firestore Rules hoặc đăng nhập lại.");
      } else {
        toast.error("Không thể tải hồ sơ nguồn");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddFromLibrary = async () => {
    if (!selectedDocId) return;
    
    // Check if already in sources
    if (sources.some(s => s.documentId === selectedDocId)) {
      toast.error('Nguồn này đã có trong đề án.');
      return;
    }

    const doc = documents.find(d => d.id === selectedDocId);
    if (!doc) return;

    setIsSubmitting(true);
    try {
      await addSource(userId, proposalId, {
        name: doc.name,
        type: doc.type as any || 'pdf',
        sourceType,
        documentId: doc.id,
        tags: selectedTags,
        summary,
        order: sources.length,
      });
      
      await fetchSources();
      resetForm();
    } catch (error) {
      console.error('Add source failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsAddingSource(false);
    setAddMode(null);
    setSelectedDocId(null);
    setSelectedTags([]);
    setSummary('');
    setSourceType('legal');
  };

  const filteredLibrary = documents.filter(d => 
    !sources.some(s => s.documentId === d.id) && // Don't show already added
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSourceCompositeKey = (source: ProposalSource, index: number) => {
    const kind = source.documentId ? 'document' : (source.type === 'link' ? 'link' : 'upload');
    return `${kind}:${source.id || source.documentId}:${index}`;
  };

  if (!userId) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Đang xác thực...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Danh mục Hồ sơ nguồn</h3>
          <p className="text-xs font-medium text-slate-500 mt-1">
            Quản lý các tài liệu căn cứ, số liệu và văn bản pháp lý phục vụ xây dựng đề án.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsAddingSource(true);
              setAddMode('pick');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#002D56] hover:bg-slate-50 shadow-sm transition-all"
          >
            <Library className="w-4 h-4" /> CHỌN TỪ KHO
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 bg-[#002D56] text-white rounded-xl text-xs font-bold shadow-xl shadow-blue-900/10 hover:opacity-90 transition-all opacity-50 cursor-not-allowed"
            title="Sắp ra mắt"
          >
            <Upload className="w-4 h-4" /> TẢI FILE MỚI
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">Đang tải hồ sơ...</p>
        </div>
      ) : sources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((source, idx) => (
            <div 
              key={getSourceCompositeKey(source, idx)}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#002D56]/30 transition-all flex items-start gap-4 shadow-sm"
            >
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                    {sourceTypes.find(t => t.value === source.sourceType)?.label || source.sourceType}
                  </span>
                  <button className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-sm font-bold text-slate-800 mt-1 truncate">{source.name}</h4>
                {source.summary && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{source.summary}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {source.tags?.map((tag, tIdx) => (
                    <span key={`${source.id}-tag-${tag}-${tIdx}`} className="text-[9px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                  {(!source.tags || source.tags.length === 0) && (
                    <span className="text-[9px] font-medium text-slate-300 italic">Chưa gắn thẻ</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center bg-white border border-slate-100 rounded-3xl border-dashed">
          <Database className="w-12 h-12 text-slate-200 mb-4" />
          <h4 className="text-base font-bold text-slate-800 uppercase tracking-tight">Hồ sơ nguồn còn trống</h4>
          <p className="text-xs text-slate-500 mt-1">Vui lòng chọn tài liệu từ Kho tư liệu hoặc tải lên căn cứ cho đề án.</p>
        </div>
      )}

      {/* Add Source Modal */}
      <AnimatePresence>
        {isAddingSource && (
          <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Thêm hồ sơ nguồn</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <button 
                      onClick={() => setAddMode('pick')}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest pb-1 transition-all",
                        addMode === 'pick' ? "text-[#002D56] border-b-2 border-[#002D56]" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Chọn từ Kho tư liệu
                    </button>
                    <button 
                      onClick={() => setAddMode('upload')}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest pb-1 transition-all opacity-50",
                        addMode === 'upload' ? "text-[#002D56] border-b-2 border-[#002D56]" : "text-slate-400"
                      )}
                      disabled
                    >
                      Tải file mới (Sắp ra mắt)
                    </button>
                  </div>
                </div>
                <button 
                  onClick={resetForm}
                  className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {addMode === 'pick' && (
                  <>
                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        1. Chọn tài liệu từ danh sách
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input 
                          type="text"
                          placeholder="Tìm trong kho tư liệu..."
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none transition-all"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar border border-slate-50 p-2 rounded-xl">
                        {filteredLibrary.length > 0 ? filteredLibrary.map((doc, dIdx) => (
                          <button
                            key={`pick-doc-${doc.id}-${dIdx}`}
                            onClick={() => setSelectedDocId(doc.id)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                              selectedDocId === doc.id 
                                ? "bg-blue-50 border-blue-200 shadow-sm" 
                                : "bg-white border-slate-100 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className={cn("w-4 h-4 shrink-0", selectedDocId === doc.id ? "text-[#002D56]" : "text-slate-300")} />
                              <span className={cn("text-sm font-semibold truncate", selectedDocId === doc.id ? "text-slate-800" : "text-slate-500")}>
                                {doc.name}
                              </span>
                            </div>
                            {selectedDocId === doc.id && <CheckCircle2 className="w-4 h-4 text-[#002D56]" />}
                          </button>
                        )) : (
                          <div className="py-10 text-center text-slate-300 italic text-xs">
                            Không tìm thấy tài liệu phù hợp trong kho.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          2. Phân loại
                        </label>
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none appearance-none font-semibold cursor-pointer"
                          value={sourceType}
                          onChange={(e) => setSourceType(e.target.value as ProposalSourceType)}
                        >
                          {sourceTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                          3. Thẻ nghiệp vụ
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(tag)}
                              className={cn(
                                "text-[10px] font-bold px-2.5 py-1.5 rounded-full border transition-all",
                                selectedTags.includes(tag)
                                  ? "bg-[#002D56] text-white border-[#002D56] shadow-sm"
                                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                              )}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        4. Ghi chú / Tóm tắt nội dung (Dùng cho RAG sau này)
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="Nội dung chính của tài liệu này đối với đề án..."
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-[#002D56] outline-none resize-none font-medium text-slate-600"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={resetForm}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  HỦY BỎ
                </button>
                <button 
                  onClick={handleAddFromLibrary}
                  disabled={!selectedDocId || isSubmitting}
                  className="flex-3 py-4 bg-[#002D56] text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-900/40 hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  XÁC NHẬN THÊM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
