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
      passed: !markdownContent.includes('[Cần') && !markdownContent.includes('[cần') && !markdownContent.includes('...'),
    },
  ];

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
          "font-black text-sm uppercase tracking-widest",
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
