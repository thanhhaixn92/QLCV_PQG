import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { EditorialDocumentKind } from '../../types/editorial';
import { cn } from '../../lib/utils';
import type { ArticleDocument } from '../../lib/publishing/articleDocument';
import { validateArticleDocument } from '../../lib/publishing/validateArticleDocument';
import {
  countPreflightIssuesBySeverity,
  dedupePreflightIssues,
  type PreflightIssue,
  type PreflightSeverity,
} from '../../lib/publishing/preflightIssue';

interface Props {
  kind?: EditorialDocumentKind;
  markdownContent?: string;
  articleDocument?: ArticleDocument;
  issues?: PreflightIssue[];
}

const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+(?:bổ sung|bổ sung\/kiểm chứng|kiểm chứng)\s*:?)[^\]]*\]/i;

const SEVERITY_LABELS: Record<PreflightSeverity, string> = {
  blocker: 'Lỗi bắt buộc',
  warning: 'Cần rà soát',
  info: 'Thông tin',
};

const SEVERITY_STYLES: Record<PreflightSeverity, string> = {
  blocker: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

function severityIcon(severity: PreflightSeverity) {
  if (severity === 'blocker') return <AlertCircle className="h-4 w-4 text-red-600" />;
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <Info className="h-4 w-4 text-sky-600" />;
}

function legacyIssuesFromMarkdown(kind: EditorialDocumentKind | undefined, markdownContent: string): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  const hasDraftMarkers = DRAFT_MARKER_PATTERN.test(markdownContent) || markdownContent.includes('[cần trích nguồn]');
  const hasTitle = markdownContent.includes('# ') || markdownContent.includes('**');

  if (!hasTitle) {
    issues.push({
      id: 'legacy-title-missing',
      severity: 'blocker',
      message: 'Bản thảo chưa có tiêu đề rõ ràng.',
      field: 'title',
      suggestion: 'Bổ sung tiêu đề trước khi xuất bản.',
      source: 'editorial-check',
    });
  }

  if (hasDraftMarkers) {
    issues.push({
      id: 'legacy-draft-marker',
      severity: 'warning',
      message: 'Bản thảo còn dữ liệu cần bổ sung/kiểm chứng.',
      field: 'draft-marker',
      suggestion: 'Rà soát marker nháp và bổ sung nguồn/chi tiết còn thiếu.',
      source: 'editorial-check',
    });
  }

  if (markdownContent.length <= 50 || markdownContent.length >= 20000) {
    issues.push({
      id: 'legacy-content-length',
      severity: 'warning',
      message: 'Độ dài bản thảo chưa phù hợp để xuất bản.',
      field: 'content-length',
      suggestion: 'Bổ sung nội dung chính hoặc rút gọn bản thảo quá dài.',
      source: 'editorial-check',
    });
  }

  if ((kind === 'news' || kind === 'press_release' || kind === 'website_article')
    && markdownContent.split('\n').filter((line) => line.trim().length > 20).length <= 1) {
    issues.push({
      id: 'legacy-sapo-missing',
      severity: 'warning',
      message: 'Bài viết chưa có sapo/lead mở đầu.',
      field: 'sapo',
      suggestion: 'Bổ sung đoạn sapo ngắn để người đọc nắm ý chính.',
      source: 'editorial-check',
    });
  }

  if ((kind === 'official_letter' || kind === 'administrative_report') && !markdownContent.toLowerCase().includes('nơi nhận:')) {
    issues.push({
      id: 'legacy-recipients-missing',
      severity: 'warning',
      message: 'Văn bản hành chính chưa có mục Nơi nhận.',
      field: 'recipients',
      suggestion: 'Bổ sung Nơi nhận nếu đây là văn bản hành chính chính thức.',
      source: 'editorial-check',
    });
  }

  return issues;
}

export function EditorialPreflightPanel({ kind, markdownContent = '', articleDocument, issues }: Props) {
  const preflightIssues = React.useMemo(() => {
    if (issues) return dedupePreflightIssues(issues);
    if (articleDocument) return validateArticleDocument(articleDocument).preflightIssues;
    return dedupePreflightIssues(legacyIssuesFromMarkdown(kind, markdownContent));
  }, [articleDocument, issues, kind, markdownContent]);

  const counts = React.useMemo(() => countPreflightIssuesBySeverity(preflightIssues), [preflightIssues]);
  const status = counts.blocker > 0 ? 'Chưa thể xuất bản' : counts.warning > 0 ? 'Cần rà soát' : 'Sẵn sàng xuất bản';
  const statusClass = counts.blocker > 0
    ? 'border-red-200 bg-red-50/70 text-red-800'
    : counts.warning > 0
      ? 'border-amber-200 bg-amber-50/70 text-amber-800'
      : 'border-emerald-200 bg-emerald-50/70 text-emerald-800';
  const groupedIssues = {
    blocker: preflightIssues.filter((issue) => issue.severity === 'blocker'),
    warning: preflightIssues.filter((issue) => issue.severity === 'warning'),
    info: preflightIssues.filter((issue) => issue.severity === 'info'),
  } satisfies Record<PreflightSeverity, PreflightIssue[]>;

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Bảng kiểm xuất bản">
      <div className={cn('mb-4 rounded-2xl border px-3 py-3', statusClass)}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {counts.blocker > 0 ? <AlertCircle className="h-5 w-5" /> : counts.warning > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">Preflight cockpit</p>
            <h3 className="text-base font-semibold leading-tight">{status}</h3>
            <p className="mt-1 text-xs leading-relaxed opacity-85">
              {counts.blocker > 0
                ? 'Cần xử lý lỗi bắt buộc trước khi xuất Word/PDF.'
                : counts.warning > 0
                  ? 'Có thể xuất bản nháp, nhưng cần rà soát các cảnh báo.'
                  : 'Không phát hiện blocker hoặc warning nghiêm trọng.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-2 py-2">
          <p className="text-lg font-bold text-red-700">{counts.blocker}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700/70">Blocker</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-2 py-2">
          <p className="text-lg font-bold text-amber-700">{counts.warning}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/70">Warning</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-2 py-2">
          <p className="text-lg font-bold text-sky-700">{counts.info}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/70">Info</p>
        </div>
      </div>

      {preflightIssues.length === 0 ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">Bản thảo đã sẵn sàng để xuất Word/PDF theo kiểm tra hiện tại.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(['blocker', 'warning', 'info'] as PreflightSeverity[]).map((severity) => {
            const group = groupedIssues[severity];
            if (group.length === 0) return null;
            return (
              <section key={severity} className={cn('rounded-2xl border px-3 py-3', SEVERITY_STYLES[severity])}>
                <div className="mb-2 flex items-center gap-2">
                  {severityIcon(severity)}
                  <h4 className="text-xs font-bold uppercase tracking-[0.16em]">{SEVERITY_LABELS[severity]} ({group.length})</h4>
                </div>
                <ul className="space-y-2">
                  {group.map((issue) => (
                    <li key={issue.id} className="rounded-xl bg-white/65 px-3 py-2 text-xs leading-relaxed text-slate-700">
                      <p className="font-semibold text-slate-900">{issue.message}</p>
                      {issue.suggestion && <p className="mt-1 text-slate-600">Gợi ý: {issue.suggestion}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
