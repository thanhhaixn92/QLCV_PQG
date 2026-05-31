import React from 'react';
import { EDITORIAL_KIND_CONFIG } from '../../lib/editorialTemplates';
import { EditorialDocumentKind } from '../../types/editorial';
import { cn } from '../../lib/utils';
import { FileText, Newspaper, Mic, FileBarChart, Bell, Send, Calendar, Users, List, AlignLeft, Presentation } from 'lucide-react';

interface Props {
  value: EditorialDocumentKind;
  onChange: (kind: EditorialDocumentKind) => void;
}

const HIDDEN_EDITORIAL_MVP_KINDS = new Set<EditorialDocumentKind>(["slide_outline"]);

const KIND_ICONS: Record<EditorialDocumentKind, React.ElementType> = {
  website_article: FileText,
  news: Newspaper,
  press_release: Mic,
  administrative_report: FileBarChart,
  announcement: Bell,
  official_letter: Send,
  plan: Calendar,
  meeting_minutes: Users,
  speech_outline: AlignLeft,
  briefing_note: List,
  summary_note: List,
  slide_outline: Presentation,
};

export function EditorialKindSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {(Object.keys(EDITORIAL_KIND_CONFIG) as EditorialDocumentKind[])
        .filter((key) => !HIDDEN_EDITORIAL_MVP_KINDS.has(key))
        .map((key) => {
        const config = EDITORIAL_KIND_CONFIG[key];
        const Icon = (KIND_ICONS[key] as React.ElementType) || FileText;
        const isSelected = value === key;
        
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex flex-col items-start p-4 rounded-lg border text-left transition-all duration-200",
              isSelected 
                ? "bg-[#002D56] border-[#002D56] text-white shadow-sm shadow-[#002D56]/20 scale-[1.02]" 
                : "bg-white border-slate-200 hover:border-[#002D56]/30 hover:bg-slate-50 text-slate-700"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg mb-3 shrink-0",
              isSelected ? "bg-white/20" : "bg-slate-100"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-[13px] leading-tight mb-1">{config.label}</h3>
            <p className={cn(
              "text-[10px] leading-relaxed line-clamp-2",
              isSelected ? "text-white/70" : "text-slate-500"
            )}>
              {config.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
