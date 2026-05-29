import React from 'react';
import { ProposalOutlineItem } from '../../features/proposals/types';
import { ProposalOutlineItemCard } from './ProposalOutlineItemCard';
import { Layout } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProposalOutlineTreeProps {
  items: ProposalOutlineItem[];
  onEdit: (item: ProposalOutlineItem) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, level: number) => void;
  onUpdateStatus: (id: string, status: ProposalOutlineItem['status']) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onAiSuggest: () => void;
}

export const ProposalOutlineTree: React.FC<ProposalOutlineTreeProps> = ({
  items,
  onEdit,
  onDelete,
  onAddChild,
  onUpdateStatus,
  onMove,
  onAiSuggest
}) => {
  if (items.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-2xl flex items-center justify-center mb-4">
          <Layout className="w-8 h-8" />
        </div>
        <h4 className="text-base font-bold text-slate-800">Chưa có đề cương</h4>
        <p className="text-sm text-slate-400 max-w-sm mt-2">
          Áp dụng mẫu đề án chuẩn hoặc mẫu kiện toàn sau hợp nhất để bắt đầu nhanh chóng.
        </p>
        <div className="flex gap-3 mt-6">
          <button 
            onClick={onAiSuggest}
            className="flex items-center gap-2 px-6 py-3 bg-[#002D56] text-white rounded-2xl text-xs font-bold shadow-xl shadow-blue-900/10 hover:opacity-90 transition-all uppercase tracking-tight"
          >
            Tạo bằng AI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-8 shadow-sm">
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.div
              key={`${item.id}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <ProposalOutlineItemCard 
                item={item}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onUpdateStatus={onUpdateStatus}
                onMove={onMove}
                isFirst={index === 0}
                isLast={index === items.length - 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
