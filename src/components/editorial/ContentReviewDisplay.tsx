import { motion } from "motion/react";
import { 
  Activity, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Type, 
  ListTree, 
  Edit3, 
  Files, 
  Target, 
  ShieldAlert, 
  Zap, 
  Bot, 
  MessageSquare, 
  Copy 
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "../../lib/utils";
import { ContentReview } from "../../types";

export const ContentReviewDisplay = ({ review }: { review: ContentReview }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl border-2 border-[#002D56]/10 shadow-xl overflow-hidden mb-12 no-print"
    >
      <div className="bg-[#002D56] p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-tight">
              Kế hoạch Chẩn đoán & Đánh giá
            </h3>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
              Phân tích bởi AI Ban Biên tập VMS Hoa Tiêu Miền Bắc
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
            Điểm nội bộ
          </span>
          <span className="text-4xl font-bold tracking-tight">
            {review.qualityScore}
            <span className="text-lg opacity-40 ml-1">/100</span>
          </span>
        </div>
      </div>

      <div className="p-8 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 h-full">
              <h4 className="text-[11px] font-bold text-[#002D56] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Tóm lược AI
              </h4>
              <p className="text-sm font-semibold text-slate-800 leading-relaxed text-justify mb-4">
                {review.summary}
              </p>
              <div className="pt-4 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-2 italic">
                  Mục đích chính:
                </p>
                <p className="text-xs font-bold text-slate-600">
                  {review.purpose}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <h5 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Điểm mạnh
                </h5>
                <ul className="space-y-2">
                  {review.strengths.map((s, idx) => (
                    <li
                      key={`review-strength-${idx}`}
                      className="text-xs font-semibold text-emerald-900 leading-tight flex gap-2"
                    >
                      <span className="shrink-0">•</span> {s}
                    </li>
                  ))}
                  {review.strengths.length === 0 && (
                    <li className="text-[10px] text-emerald-400 italic">
                      Không có dữ liệu
                    </li>
                  )}
                </ul>
              </div>
              <div className="p-5 bg-rose-50 border border-rose-100 rounded-lg">
                <h5 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Hạn chế
                </h5>
                <ul className="space-y-2">
                  {review.weaknesses.map((w, idx) => (
                    <li
                      key={`review-weakness-${idx}`}
                      className="text-xs font-semibold text-rose-900 leading-tight flex gap-2"
                    >
                      <span className="shrink-0">•</span> {w}
                    </li>
                  ))}
                  {review.weaknesses.length === 0 && (
                    <li className="text-[10px] text-rose-400 italic">
                      Không phát hiện
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              id: "spelling",
              label: "Lỗi chính tả / dùng từ",
              data: review.spellingIssues,
              icon: Type,
              color: "rose",
            },
            {
              id: "structure",
              label: "Bố cục / Sắp xếp",
              data: review.structureIssues,
              icon: ListTree,
              color: "amber",
            },
            {
              id: "style",
              label: "Văn phong / Sắc thái",
              data: review.styleIssues,
              icon: Edit3,
              color: "blue",
            },
            {
              id: "duplication",
              label: "Trùng lặp nội dung",
              data: review.duplicationIssues,
              icon: Files,
              color: "slate",
            },
            {
              id: "missing",
              label: "Thiếu sót nội dung",
              data: review.missingContent,
              icon: Target,
              color: "indigo",
            },
            {
              id: "factual",
              label: "Rủi ro dữ kiện",
              data: review.factualWarnings,
              icon: ShieldAlert,
              color: "orange",
            },
          ].map((group) => (
            <div
              key={group.id}
              className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm hover:border-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    group.color === "rose"
                      ? "bg-rose-100 text-rose-600"
                      : group.color === "amber"
                        ? "bg-amber-100 text-amber-600"
                        : group.color === "blue"
                          ? "bg-blue-100 text-blue-600"
                          : group.color === "indigo"
                            ? "bg-indigo-100 text-indigo-600"
                            : group.color === "orange"
                              ? "bg-orange-100 text-orange-600"
                              : "bg-slate-100 text-slate-600",
                  )}
                >
                  <group.icon className="w-4 h-4" />
                </div>
                <h5 className="text-[10px] font-bold text-slate-800 tracking-tight uppercase">
                  {group.label}
                </h5>
              </div>
              <div className="space-y-2">
                {group.data && group.data.length > 0 ? (
                  group.data.map((item, idx) => (
                    <div key={`review-issue-${group.id}-${idx}`} className="flex gap-2 items-start">
                      <span className="text-slate-300 mt-0.5 shrink-0">•</span>
                      <p className="text-xs font-medium text-slate-600 leading-tight">
                        {item}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-300 font-bold italic tracking-tight">
                    Tất cả đều ổn
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-emerald-50/50 p-6 rounded-lg border border-emerald-100">
            <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Đề xuất nâng cấp
            </h4>
            <div className="space-y-3">
              {review.improvementSuggestions &&
                review.improvementSuggestions.map((s, idx) => (
                  <div key={`review-suggestion-${idx}`} className="flex gap-3 items-center">
                    <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded flex items-center justify-center text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-tight">
                      {s}
                    </p>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-inner relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5">
              <Bot className="w-32 h-32 text-white" />
            </div>
            <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Prompt gợi ý tối ưu
            </h4>
            <div className="bg-white/10 rounded border border-white/10 p-4 text-xs font-mono text-emerald-400 leading-relaxed italic">
              "{review.rewrittenPrompt}"
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(review.rewrittenPrompt || "");
                  toast.success("Đã sao chép prompt!");
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white text-white hover:text-slate-900 rounded text-[9px] font-bold uppercase transition-all flex items-center gap-2"
              >
                <Copy className="w-3 h-3" /> Sao chép prompt
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
