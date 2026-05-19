import React from 'react';
import { EditorialDocumentKind } from '../../types/editorial';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';

interface Props {
  kind: EditorialDocumentKind;
  markdownContent: string;
}

export function EditorialPreflightPanel({ kind, markdownContent }: Props) {
  const checks = [
    {
      id: 'title',
      label: 'Có Tiêu đề',
      passed: markdownContent.includes('# ') || markdownContent.includes('**'),
    },
    {
      id: 'no_placeholders',
      label: 'Không còn [Cần bổ sung/kiểm chứng]',
      passed: !markdownContent.includes('[Cần') && !markdownContent.includes('[cần') && !markdownContent.includes('...') && !markdownContent.includes('[cần trích nguồn]'),
    },
    {
      id: 'content_length',
      label: 'Độ dài phù hợp',
      passed: markdownContent.length > 50 && markdownContent.length < 20000,
    }
  ];

  // Image caption check if there are any markdown images
  const mdImgMatches = markdownContent.match(/!\[(.*?)\]\([^)]+\)/g);
  if (mdImgMatches && mdImgMatches.length > 0) {
    checks.push({
      id: 'image_captions',
      label: 'Ảnh có chú thích',
      passed: mdImgMatches.every(m => {
        const altText = m.match(/!\[(.*?)\]/)?.[1];
        return altText && altText.trim().length > 0;
      })
    });
  }

  if (kind === 'news' || kind === 'press_release' || kind === 'website_article') {
    checks.push({
      id: 'sapo',
      label: 'Có đoạn Sapo mở đầu',
      passed: markdownContent.split('\n').filter(l => l.trim().length > 20).length > 1,
    });
  }

  if (kind === 'official_letter' || kind === 'administrative_report') {
    checks.push({
      id: 'recipients',
      label: 'Có Nơi nhận',
      passed: markdownContent.toLowerCase().includes('nơi nhận:'),
    });
  }

  const allPassed = checks.every(c => c.passed);

  return (
    <div className={cn(
      "p-5 rounded-3xl border",
      allPassed ? "bg-emerald-50/50 border-emerald-100" : "bg-amber-50/50 border-amber-100"
    )}>
      <div className="flex items-center gap-2 mb-4">
        {allPassed ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-500" />
        )}
        <h3 className={cn(
          "font-semibold text-sm tracking-normal",
          allPassed ? "text-emerald-700" : "text-amber-700"
        )}>
          Kiểm tra xuất bản
        </h3>
      </div>
      
      <div className="space-y-3">
        {checks.map(check => (
          <div key={check.id} className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              {check.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <p className={cn(
              "text-xs font-medium leading-relaxed",
              check.passed ? "text-slate-600" : "text-slate-800 font-bold"
            )}>
              {check.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
