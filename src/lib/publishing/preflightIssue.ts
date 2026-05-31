export type PreflightSeverity = "blocker" | "warning" | "info";

export type PreflightIssueSource =
  | "article-validation"
  | "layout-validation"
  | "editorial-check"
  | "export-readiness";

export interface PreflightIssue {
  id: string;
  severity: PreflightSeverity;
  message: string;
  blockId?: string;
  blockType?: string;
  field?: string;
  suggestion?: string;
  source?: PreflightIssueSource;
}

export type PreflightIssueInput = Omit<PreflightIssue, "id"> & { id?: string };

export interface PreflightSeverityCounts {
  blocker: number;
  warning: number;
  info: number;
}

function normalizeIssuePart(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function createStableIssueId(issue: PreflightIssueInput): string {
  return [issue.severity, issue.source, issue.message, issue.blockId, issue.field]
    .map(normalizeIssuePart)
    .join("|")
    .replace(/[^a-z0-9|._-]+/gu, "-")
    .replace(/-+/gu, "-");
}

export function createPreflightIssue(issue: PreflightIssueInput): PreflightIssue {
  return {
    ...issue,
    id: issue.id || createStableIssueId(issue),
  };
}

function dedupeKey(issue: PreflightIssue): string {
  return [issue.severity, issue.message, issue.blockId, issue.field]
    .map(normalizeIssuePart)
    .join("|");
}

export function dedupePreflightIssues(issues: PreflightIssue[]): PreflightIssue[] {
  const seen = new Set<string>();
  const deduped: PreflightIssue[] = [];

  issues.forEach((issue) => {
    const key = dedupeKey(issue);
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(issue);
  });

  return deduped;
}

export function countPreflightIssuesBySeverity(issues: PreflightIssue[]): PreflightSeverityCounts {
  return issues.reduce<PreflightSeverityCounts>(
    (counts, issue) => {
      counts[issue.severity] += 1;
      return counts;
    },
    { blocker: 0, warning: 0, info: 0 },
  );
}

export function hasBlockingPreflightIssues(issues: PreflightIssue[]): boolean {
  return issues.some((issue) => issue.severity === "blocker");
}
