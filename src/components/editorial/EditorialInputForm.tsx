import React, { useState, useEffect, useRef } from 'react';
import { EditorialDocumentKind } from '../../types/editorial';
import { EDITORIAL_KIND_CONFIG } from '../../lib/editorialTemplates';

interface Props {
  kind: EditorialDocumentKind;
  onChange: (compiledGuidance: string) => void;
  initialValue?: string;
}

const FIELD_LABELS: Array<{ field: string; pattern: RegExp }> = [
  { field: 'generalContext', pattern: /^Yêu\s*cầu(?:\s*chung)?\s*\/\s*Bối\s*cảnh\s*[:：]\s*/iu },
  { field: 'timeAndPlace', pattern: /^Thời\s*gian\s*&\s*Địa\s*điểm\s*[:：]\s*/iu },
  { field: 'characters', pattern: /^(?:Thành\s*phần\s*\/\s*Nhân\s*vật|Thành\s*phần\s*tham\s*dự)\s*[:：]\s*/iu },
  { field: 'recipients', pattern: /^(?:Gửi\s*đến|Cơ\s*quan\s*\/\s*Cá\s*nhân\s*nhận|Nơi\s*nhận)\s*[:：]\s*/iu },
  { field: 'mainPoints', pattern: /^(?:Nội\s*dung\s*chính\s*cần\s*có|Các\s*ý\s*chính\s*bắt\s*buộc\s*phải\s*có)\s*[:：]\s*/iu },
];

function parseCompiledGuidance(value: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  const blocks = String(value || '')
    .replace(/\u00a0/gu, ' ')
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);

  blocks.forEach((block) => {
    const matchedLabel = FIELD_LABELS.find(({ pattern }) => pattern.test(block));
    if (!matchedLabel) {
      parsed.generalContext = [parsed.generalContext, block].filter(Boolean).join('\n\n');
      return;
    }

    const fieldValue = block.replace(matchedLabel.pattern, '').trim();
    if (!fieldValue) return;
    parsed[matchedLabel.field] = [parsed[matchedLabel.field], fieldValue].filter(Boolean).join('\n\n');
  });

  return { generalContext: '', ...parsed };
}

function pickFieldsForKind(formData: Record<string, string>, kind: EditorialDocumentKind): Record<string, string> {
  const allowTimeAndPlace = ['news', 'press_release', 'meeting_minutes'].includes(kind);
  const allowRecipients = ['official_letter', 'announcement', 'administrative_report'].includes(kind);

  return {
    generalContext: formData.generalContext || '',
    ...(allowTimeAndPlace && formData.timeAndPlace ? { timeAndPlace: formData.timeAndPlace } : {}),
    ...(allowTimeAndPlace && formData.characters ? { characters: formData.characters } : {}),
    ...(allowRecipients && formData.recipients ? { recipients: formData.recipients } : {}),
    ...(formData.mainPoints ? { mainPoints: formData.mainPoints } : {}),
  };
}

export function EditorialInputForm({ kind, onChange, initialValue = '' }: Props) {
  const config = EDITORIAL_KIND_CONFIG[kind];
  
  const [formData, setFormData] = useState<Record<string, string>>(() => parseCompiledGuidance(initialValue));
  const lastCompiledGuidanceRef = useRef('');

  useEffect(() => {
    if (initialValue === lastCompiledGuidanceRef.current) return;
    setFormData(parseCompiledGuidance(initialValue));
  }, [initialValue]);

  useEffect(() => {
    setFormData((current) => pickFieldsForKind(current, kind));
  }, [kind]);

  useEffect(() => {
    // Whenever formData changes, compile it to a single text prompt
    const parts = [];
    if (formData.generalContext) parts.push(`Yêu cầu / Bối cảnh: ${formData.generalContext}`);
    
    // Only include fields that are actually relevant to the selected kind
    const allowTimeAndPlace = ['news', 'press_release', 'meeting_minutes'].includes(kind);
    const allowRecipients = ['official_letter', 'announcement', 'administrative_report'].includes(kind);

    if (allowTimeAndPlace && formData.timeAndPlace) parts.push(`Thời gian & Địa điểm: ${formData.timeAndPlace}`);
    if (allowTimeAndPlace && formData.characters) parts.push(`Thành phần / Nhân vật: ${formData.characters}`);
    if (allowRecipients && formData.recipients) parts.push(`Gửi đến: ${formData.recipients}`);
    
    if (formData.mainPoints) parts.push(`Nội dung chính cần có: ${formData.mainPoints}`);
    
    const compiledGuidance = parts.join('\n\n');
    lastCompiledGuidanceRef.current = compiledGuidance;
    onChange(compiledGuidance);
  }, [formData, kind, onChange]);

  const handleChange = (field: string, val: string) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-slate-700 tracking-normal mb-1.5">
          Yêu cầu chung / Bối cảnh
        </label>
        <textarea
          value={formData.generalContext || ''}
          onChange={(e) => handleChange('generalContext', e.target.value)}
          placeholder="Nhập thông tin nền hoặc yêu cầu cụ thể..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D56] resize-none h-24"
        />
      </div>

      {(kind === 'news' || kind === 'press_release' || kind === 'meeting_minutes') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 tracking-normal mb-1.5">
              Thời gian & Địa điểm
            </label>
            <input
              type="text"
              value={formData.timeAndPlace || ''}
              onChange={(e) => handleChange('timeAndPlace', e.target.value)}
              placeholder="VD: Chiều 14/10 tại Hải Phòng..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D56]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 tracking-normal mb-1.5">
              Thành phần tham dự
            </label>
            <input
              type="text"
              value={formData.characters || ''}
              onChange={(e) => handleChange('characters', e.target.value)}
              placeholder="VD: Lãnh đạo Cục, Giám đốc Công ty..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D56]"
            />
          </div>
        </div>
      )}

      {(kind === 'official_letter' || kind === 'announcement' || kind === 'administrative_report') && (
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 tracking-normal mb-1.5">
            Cơ quan / Cá nhân nhận (Nơi nhận)
          </label>
          <input
            type="text"
            value={formData.recipients || ''}
            onChange={(e) => handleChange('recipients', e.target.value)}
            placeholder="VD: Tổng công ty BĐATHH MB, Các trạm..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D56]"
          />
        </div>
      )}

      <div>
        <label className="block text-[11px] font-semibold text-slate-700 tracking-normal mb-1.5">
          Các ý chính bắt buộc phải có
        </label>
        <textarea
          value={formData.mainPoints || ''}
          onChange={(e) => handleChange('mainPoints', e.target.value)}
          placeholder="Gạch đầu dòng các thông tin quan trọng nhất, số liệu, hoặc chỉ đạo..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D56] resize-none h-24"
        />
      </div>
    </div>
  );
}
