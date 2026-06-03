import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
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

type PreflightReviewStatus = "idle" | "checking" | "ready" | "stale";

interface Props {
  kind?: EditorialDocumentKind;
  markdownContent?: string;
  articleDocument?: ArticleDocument;
  issues?: PreflightIssue[];
  hasDraft?: boolean;
  reviewStatus?: PreflightReviewStatus;
  onRequestReview?: () => void;
}

const DRAFT_MARKER_PATTERN = /\[(?:\s*Bổ sung\s*:|\s*Cần\s+(?:bổ sung|bổ sung\/kiểm chứng|kiểm chứng)\s*:?)[^\]]*\]/i;
const COMPACT_WARNING_LIMIT = 2;

const SEVERITY_LABELS: Record<PreflightSeverity, string> = {
  blocker: 'Lỗi chặn',
  warning: 'Cần rà soát',
  info: 'Gợi ý',
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

function normalizeIssuePart(value: string | undefined): string {
  return (value || '').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function issueDedupeKey(issue: PreflightIssue): string {
  const targetHint = issue.path || issue.blockId || issue.field || issue.blockType;
  return [
    issue.severity,
    issue.source,
    issue.code,
    targetHint,
    normalizeIssuePart(issue.message),
  ]
    .map((part) => normalizeIssuePart(part))
    .join('|');
}

function dedupePanelIssues(issues: PreflightIssue[]): PreflightIssue[] {
  const seen = new Set<string>();
  const deduped: PreflightIssue[] = [];

  dedupePreflightIssues(issues).forEach((issue) => {
    const key = issueDedupeKey(issue);
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(issue);
  });

  return deduped;
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

function renderIssue(issue: PreflightIssue) {
  return (
    <li key={issue.id} className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-slate-700">
      <p className="font-semibold text-slate-900">{issue.message}</p>
      {issue.suggestion && <p className="mt-1 text-slate-600">Gợi ý: {issue.suggestion}</p>}
    </li>
  );
}

export function EditorialPreflightPanel({ kind, markdownContent = '', articleDocument, issues, hasDraft, reviewStatus = 'ready', onRequestReview }: Props) {
  const hasRealDraft = hasDraft ?? Boolean(markdownContent.trim());
  const [isExpanded, setIsExpanded] = React.useState(false);
  const shouldShowResults = reviewStatus === 'ready' || reviewStatus === 'stale';

  const preflightIssues = React.useMemo(() => {
    if (!hasRealDraft || !shouldShowResults) return [];
    if (issues) return dedupePanelIssues(issues);
    if (articleDocument) return dedupePanelIssues(validateArticleDocument(articleDocument).preflightIssues);
    return dedupePanelIssues(legacyIssuesFromMarkdown(kind, markdownContent));
  }, [articleDocument, hasRealDraft, issues, kind, markdownContent, shouldShowResults]);

  const counts = React.useMemo(() => countPreflightIssuesBySeverity(preflightIssues), [preflightIssues]);
  const status = reviewStatus === 'stale'
    ? 'Cần rà soát lại'
    : counts.blocker > 0
      ? 'Chưa thể xuất bản'
      : counts.warning > 0 || counts.info > 0
        ? 'Cần rà soát'
        : 'Sẵn sàng xuất bản';
  const summary = `${counts.blocker} lỗi chặn · ${counts.warning} cảnh báo · ${counts.info} cần kiểm tra`;
  const statusClass = counts.blocker > 0
    ? 'border-red-200 bg-red-50/70 text-red-800'
    : reviewStatus === 'stale' || counts.warning > 0
      ? 'border-amber-200 bg-amber-50/70 text-amber-800'
      : 'border-emerald-200 bg-emerald-50/70 text-emerald-800';
  const groupedIssues = {
    blocker: preflightIssues.filter((issue) => issue.severity === 'blocker'),
    warning: preflightIssues.filter((issue) => issue.severity === 'warning'),
    info: preflightIssues.filter((issue) => issue.severity === 'info'),
  } satisfies Record<PreflightSeverity, PreflightIssue[]>;
  const visibleWarnings = isExpanded ? groupedIssues.warning : groupedIssues.warning.slice(0, COMPACT_WARNING_LIMIT);
  const hiddenWarningCount = Math.max(0, groupedIssues.warning.length - visibleWarnings.length);
  const hasDetails = preflightIssues.length > 0;
  const detailsId = 'editorial-preflight-details';

  if (!hasRealDraft) {
    return (
      <aside className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm shadow-sm" aria-label="Bảng kiểm xuất bản" data-preflight-panel="true" data-export-exclude="true">
        <p className="font-black text-slate-800">Không có bản thảo</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Tạo hoặc mở bản thảo trước khi chạy kiểm tra.</p>
      </aside>
    );
  }

  if (!shouldShowResults) {
    const isChecking = reviewStatus === 'checking';
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Bảng kiểm xuất bản" data-preflight-panel="true" data-export-exclude="true">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">Kiểm tra trước xuất bản</p>
            <p className={cn('mt-1 text-xs leading-5 font-semibold', isChecking ? 'text-amber-700' : 'text-slate-500')}>
              {isChecking
                ? 'Đang rà soát bản thảo…'
                : 'Chưa rà soát bản thảo trong phiên hiện tại.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestReview}
            disabled={isChecking}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#002D56] bg-white px-3 text-xs font-black text-[#002D56] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isChecking && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Rà soát bản thảo
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Bảng kiểm xuất bản" data-preflight-panel="true" data-export-exclude="true">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2', statusClass)}>
          <span className="shrink-0">
            {counts.blocker > 0 || reviewStatus === 'stale' ? <AlertCircle className="h-4 w-4" /> : counts.warning > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-black">{status}</p>
              {reviewStatus === 'stale' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">Cần rà soát lại</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] font-semibold opacity-85">{summary}</p>
            {counts.blocker > 0 && <p className="mt-0.5 text-[11px] font-semibold opacity-85">Cần xử lý lỗi chặn trước khi xuất Word/PDF.</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {reviewStatus === 'stale' && (
            <button
              type="button"
              onClick={onRequestReview}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#002D56] bg-white px-3 text-xs font-black text-[#002D56] hover:bg-blue-50"
            >
              Rà soát lại
            </button>
          )}
          {hasDetails && (
            <button
              type="button"
              onClick={() => setIsExpanded((value) => !value)}
              aria-expanded={isExpanded}
              aria-controls={detailsId}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
            </button>
          )}
        </div>
      </div>

      {hasDetails ? (
        <div id={detailsId} className="mt-3 space-y-2">
          {groupedIssues.blocker.length > 0 && (
            <section className={cn('rounded-xl border px-3 py-2', SEVERITY_STYLES.blocker)}>
              <div className="mb-2 flex items-center gap-2">
                {severityIcon('blocker')}
                <h4 className="text-xs font-bold uppercase tracking-[0.14em]">{SEVERITY_LABELS.blocker} ({groupedIssues.blocker.length})</h4>
              </div>
              <ul className="space-y-2">{groupedIssues.blocker.map(renderIssue)}</ul>
            </section>
          )}

          {visibleWarnings.length > 0 && (
            <section className={cn('rounded-xl border px-3 py-2', SEVERITY_STYLES.warning)}>
              <div className="mb-2 flex items-center gap-2">
                {severityIcon('warning')}
                <h4 className="text-xs font-bold uppercase tracking-[0.14em]">{SEVERITY_LABELS.warning} ({groupedIssues.warning.length})</h4>
              </div>
              <ul className="space-y-2">{visibleWarnings.map(renderIssue)}</ul>
              {!isExpanded && hiddenWarningCount > 0 && <p className="mt-2 text-xs font-semibold text-amber-800/80">Còn {hiddenWarningCount} cảnh báo khác. Bấm Xem chi tiết để mở đầy đủ.</p>}
            </section>
          )}

          {!isExpanded && groupedIssues.info.length > 0 && (
            <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">Có {groupedIssues.info.length} gợi ý bổ sung.</p>
          )}

          {isExpanded && groupedIssues.info.length > 0 && (
            <section className={cn('rounded-xl border px-3 py-2', SEVERITY_STYLES.info)}>
              <div className="mb-2 flex items-center gap-2">
                {severityIcon('info')}
                <h4 className="text-xs font-bold uppercase tracking-[0.14em]">{SEVERITY_LABELS.info} ({groupedIssues.info.length})</h4>
              </div>
              <ul className="space-y-2">{groupedIssues.info.map(renderIssue)}</ul>
            </section>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">Bản thảo chưa phát hiện vấn đề lớn theo lần rà soát hiện tại.</p>
        </div>
      )}
    </aside>
  );
}
