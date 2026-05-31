import React from 'react';
import { cn } from '../../lib/utils';
import { EDITORIAL_TOOLS, EditorialToolGroup } from '../../lib/editorialTools';
import { Target, Zap, Search, LayoutTemplate } from 'lucide-react';

interface EditorialToolSelectorProps {
  value: string;
  onChange: (toolId: string) => void;
}

const GROUP_CONFIG: Record<EditorialToolGroup, { label: string; icon: React.ElementType }> = {
  draft: { label: "Soạn mới", icon: Target },
  edit: { label: "Biên tập", icon: Zap },
  review: { label: "Rà soát", icon: Search },
  summary: { label: "Tóm tắt", icon: LayoutTemplate },
};

export const EditorialToolSelector: React.FC<EditorialToolSelectorProps> = ({ value, onChange }) => {
  // Group tools for rendering
  const toolGroups = Object.keys(GROUP_CONFIG).map((groupId) => {
    return {
      id: groupId as EditorialToolGroup,
      ...GROUP_CONFIG[groupId as EditorialToolGroup],
      tools: EDITORIAL_TOOLS.filter((t) => t.group === groupId),
    };
  });

  return (
    <div className="space-y-4">
      {toolGroups.map((group) => {
        if (group.tools.length === 0) return null;
        return (
          <div key={group.id}>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
              <group.icon className="w-3.5 h-3.5" />
              {group.label}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {group.tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onChange(tool.id)}
                  className={cn(
                    "w-full flex flex-col items-start gap-2 p-3 rounded-md transition-all group text-left",
                    value === tool.id
                      ? "bg-[#002D56] text-white shadow-sm ring-1 ring-[#002D56]"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-md",
                      value === tool.id
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500 shadow-sm group-hover:bg-white group-hover:text-[#002D56]"
                    )}
                  >
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-[11px] leading-tight mb-0.5">
                      {tool.label}
                    </p>
                    <p
                      className={cn(
                        "text-[8px] line-clamp-2 leading-tight font-medium opacity-80",
                        value === tool.id
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-500"
                      )}
                    >
                      {tool.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
