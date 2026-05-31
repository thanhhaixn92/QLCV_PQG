import React, { useState, useEffect } from 'react';
import { EditorialDocumentKind } from '../../types/editorial';
import { EDITORIAL_KIND_CONFIG } from '../../lib/editorialTemplates';
import { normalizeEditorialBriefInput } from '../../lib/editorialBrief';

interface Props {
  kind: EditorialDocumentKind;
  onChange: (compiledGuidance: string) => void;
  initialValue?: string;
}

export function EditorialInputForm({ kind, onChange, initialValue = '' }: Props) {
  const config = EDITORIAL_KIND_CONFIG[kind];
  
  const [formData, setFormData] = useState<Record<string, string>>({
    generalContext: normalizeEditorialBriefInput(initialValue)
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      generalContext: normalizeEditorialBriefInput(prev.generalContext || initialValue || ''),
    }));
  }, [kind, initialValue]);

  useEffect(() => {
    // Whenever formData changes, compile it to a single text prompt
    const parts = [];
    const generalContext = normalizeEditorialBriefInput(formData.generalContext || '');
    if (generalContext) parts.push(generalContext);
    
    // Only include fields that are actually relevant to the selected kind
    const allowTimeAndPlace = ['news', 'press_release', 'meeting_minutes'].includes(kind);
    const allowRecipients = ['official_letter', 'announcement', 'administrative_report'].includes(kind);

    if (allowTimeAndPlace && formData.timeAndPlace) parts.push(`Thời gian & Địa điểm: ${formData.timeAndPlace}`);
    if (allowTimeAndPlace && formData.characters) parts.push(`Thành phần / Nhân vật: ${formData.characters}`);
    if (allowRecipients && formData.recipients) parts.push(`Gửi đến: ${formData.recipients}`);
    
    if (formData.mainPoints) parts.push(`Nội dung chính cần có: ${formData.mainPoints}`);
    
    onChange(parts.join('\n\n'));
  }, [formData, kind]);

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
          value={normalizeEditorialBriefInput(formData.generalContext || '')}
          onChange={(e) => handleChange('generalContext', normalizeEditorialBriefInput(e.target.value))}
          placeholder="Nhập yêu cầu, bối cảnh, mục tiêu bài viết..."
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
