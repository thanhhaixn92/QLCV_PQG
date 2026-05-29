import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  Info,
  Edit,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSearch,
  MoveUp,
  MoveDown,
  ChevronDown
} from 'lucide-react';
import { ProposalOutlineItem } from '../../features/proposals/types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ProposalOutlineItemCardProps {
  item: ProposalOutlineItem;
  index: number;
  onEdit: (item: ProposalOutlineItem) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, level: number) => void;
  onUpdateStatus: (id: string, status: ProposalOutlineItem['status']) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

export const ProposalOutlineItemCard: React.FC<ProposalOutlineItemCardProps> = ({
  item,
  index,
  onEdit,
  onDelete,
  onAddChild,
  onUpdateStatus,
  onMove,
  isFirst,
  isLast
}) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const getStatusInfo = (status: ProposalOutlineItem['status']) => {
    switch (status) {
      case 'completed':
        return { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 };
      case 'writing':
        return { label: 'Đang viết', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock };
      case 'needs_data':
        return { label: 'Cần số liệu', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: AlertCircle };
      case 'needs_review':
        return { label: 'Cần rà soát', color: 'bg-purple-50 text-purple-600 border-purple-100', icon: FileSearch };
      default:
        return { label: 'Chưa viết', color: 'bg-slate-50 text-slate-400 border-slate-100', icon: Info };
    }
  };

  const statusInfo = getStatusInfo(item.status);
  const StatusIcon = statusInfo.icon;

  // Responsive indentation
  const indentClass = item.level === 1 ? "" : 
                     item.level === 2 ? "md:ml-8 ml-4 border-l-2 border-slate-100 pl-4" : 
                     "md:ml-16 ml-6 border-l-2 border-slate-100 pl-4";

  const statuses: { value: ProposalOutlineItem['status']; label: string; color: string }[] = [
    { value: 'not_started', label: 'Chưa viết', color: 'text-slate-600' },
    { value: 'writing', label: 'Đang viết', color: 'text-blue-600' },
    { value: 'needs_data', label: 'Cần số liệu', color: 'text-amber-600' },
    { value: 'needs_review', label: 'Cần rà soát', color: 'text-purple-600' },
    { value: 'completed', label: 'Hoàn thành', color: 'text-emerald-600' },
  ];

  const isSection = item.itemType === 'section' || (item.level === 1 && !item.itemType);
  const isAppendix = item.itemType === 'appendix' || item.itemType === 'table';

  return (
    <div 
      className={cn(
        "group relative flex flex-col md:flex-row md:items-start gap-3 md:gap-4 p-4 rounded-2xl transition-all border border-transparent hover:border-slate-100",
        isSection ? "bg-[#002D56]/5 border-[#002D56]/10 hover:bg-[#002D56]/10" : "hover:bg-slate-50",
        indentClass
      )}
    >
      {/* Cấp độ indicator for mobile */}
      {(item.level > 1 || isSection) && (
        <div className="md:hidden flex items-center gap-1">
          <span className={cn(
            "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
            isSection ? "bg-[#002D56] text-white border-[#002D56]" : "bg-slate-50 text-slate-300 border-slate-100"
          )}>
            {isSection ? "PHẦN LỚN" : `CẤP ${item.level}`}
          </span>
        </div>
      )}

      {/* Numerical Badge */}
      <div className={cn(
        "hidden md:flex w-8 h-8 rounded-xl items-center justify-center font-bold text-xs transition-all shrink-0 shadow-sm",
        isSection 
          ? "bg-[#002D56] text-white" 
          : "bg-white text-slate-400 border border-slate-100 group-hover:border-[#002D56]/30 group-hover:text-[#002D56]"
      )}>
        {item.code || index + 1}
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <div className={cn(
            "md:hidden w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0",
            isSection ? "bg-[#002D56] text-white" : "bg-slate-200 text-slate-500"
          )}>
            {item.code || index + 1}
          </div>
          
          <h4 className={cn(
            "font-extrabold flex-1 min-w-0 break-words",
            isSection ? "text-[#002D56] text-sm md:text-base uppercase tracking-tight" : "text-slate-800 text-sm",
            isAppendix && "text-slate-600 italic"
          )}>
            {item.title}
          </h4>

          {/* Status Badge - Hidden for sections unless specific progress is requested */}
          {!isSection && (
            <div className="shrink-0 flex items-center relative">
              <button 
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className={cn(
                  "flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider transition-all",
                  statusInfo.color
                )}
              >
                <StatusIcon className="w-3 h-3 shrink-0" />
                <span>{statusInfo.label}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>

              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)}></div>
                  <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1">
                    <div className="px-2 py-1.5 text-[9px] font-bold text-slate-400 uppercase">Trạng thái</div>
                    {statuses.map(s => (
                      <button
                        key={s.value}
                        onClick={() => {
                          onUpdateStatus(item.id, s.value);
                          setShowStatusMenu(false);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-2 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors",
                          s.color
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {isSection && (
            <span className="text-[9px] font-black text-[#002D56]/40 uppercase tracking-widest bg-[#002D56]/5 px-2 py-1 rounded-lg border border-[#002D56]/10">
              CẤU TRÚC PHẦN
            </span>
          )}
        </div>

        {/* Guidance & Rationale */}
        {item.guidance && (
          <div className="mt-1 flex items-start gap-1.5 text-[10px] text-slate-500 bg-slate-100/50 w-full md:w-fit px-2 py-1 rounded-lg border border-slate-100">
            <Info className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
            <span className="leading-relaxed">{item.guidance}</span>
          </div>
        )}

        {/* Requirements */}
        {(item.requiredSources?.length || item.requiredData?.length) ? (
          <div className="flex flex-wrap gap-2 mt-3">
            {item.requiredSources?.map((s, sIdx) => (
              <span key={`source-${s}-${sIdx}`} className="text-[8px] font-bold text-[#002D56] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
                NGUỒN: {s}
              </span>
            ))}
            {item.requiredData?.map((d, dIdx) => (
              <span key={`data-${d}-${dIdx}`} className="text-[8px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                SỐ LIỆU: {d}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end md:justify-start gap-1 mt-2 md:mt-0 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all shrink-0">
        <div className="flex items-center gap-1 bg-white md:bg-transparent p-1 md:p-0 rounded-xl md:rounded-none border md:border-none border-slate-100 shadow-sm md:shadow-none relative">
          <button 
            onClick={() => onMove(item.id, 'up')}
            disabled={isFirst}
            className="p-2 text-slate-400 hover:text-[#002D56] hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30"
            title="Dời lên"
          >
            <MoveUp className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onMove(item.id, 'down')}
            disabled={isLast}
            className="p-2 text-slate-400 hover:text-[#002D56] hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30"
            title="Dời xuống"
          >
            <MoveDown className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            className="p-2 text-slate-400 hover:text-[#002D56] hover:bg-slate-100 rounded-lg transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showActionsMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)}></div>
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-1">
                <button
                  onClick={() => {
                    onAddChild(item.id, item.level + 1);
                    setShowActionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-blue-500" /> THÊM MỤC CON
                </button>
                <button
                  onClick={() => {
                    onEdit(item);
                    setShowActionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4 text-emerald-500" /> CHỈNH SỬA
                </button>
                <div className="my-1 border-t border-slate-50"></div>
                <button
                  onClick={() => {
                    onDelete(item.id);
                    setShowActionsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> XÓA MỤC
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
