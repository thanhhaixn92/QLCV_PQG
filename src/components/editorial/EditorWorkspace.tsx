import React from 'react';
import { getRenderKey } from '../../utils/listKeys';
import {
  Files, Globe, Type, FileUp, Search, Loader2, Database,
  FileText, X, ShieldCheck, FileDown,
  Target as Plus, Link as LinkIcon, Trash2, Edit3,
  Save, Zap, Check, Copy, History, AlertCircle,
  BookOpen, ClipboardCheck, FileStack, ChevronRight, PanelRightOpen, Clock,
  MoreVertical, MessageCircle, Sparkles
} from 'lucide-react';
import { EditorialKindSelector } from './EditorialKindSelector';
import { EDITORIAL_KIND_CONFIG } from '../../lib/editorialTemplates';
import { EditorialInputForm } from './EditorialInputForm';
import { EditorialPreflightPanel } from './EditorialPreflightPanel';
import { TaskType, OutputFormat } from '../../types';
import type { EditorialWorkspaceMode } from '../../types/editorial';
import type { ArticleBlock } from '../../lib/publishing/articleDocument';
import { FloatingCopilot, type CopilotCommand, type CopilotContextItem, type CopilotDraftFlowState, type CopilotProposal, type CopilotSourceFlowState, type CopilotViewMode } from '../copilot/FloatingCopilot';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { EDITORIAL_TOOLS, getEditorialTool } from '../../lib/editorialTools';
import { deriveEditorialSessionTitle } from '../library/LibraryHelpers';
import { A4PrintPreview, getArticleBlockExcerpt } from './A4PrintPreview';
import {
  LayoutRecommendationPanel,
  recommendArticleLayoutsForBrief,
  type LayoutRecommendation,
} from './LayoutRecommendationPanel';
import { createArticleDocumentFromCurrentContent } from '../../lib/publishing/articleDocumentAdapter';
import { validateArticleDocument } from '../../lib/publishing/validateArticleDocument';
import {
  countPreflightIssuesBySeverity,
  hasBlockingPreflightIssues,
  createPreflightIssue,
  dedupePreflightIssues,
  type PreflightIssue,
} from '../../lib/publishing/preflightIssue';
import { getArticleLayout, getDefaultArticleLayout } from '../../lib/publishing/layoutRegistry';
import { matchEditorialTemplates } from '../../lib/editorialTemplateMatcher';
import { getEditorialTemplateById } from '../../lib/editorialTemplateRegistry';
import { buildEditorialTemplateDraft } from '../../lib/editorialTemplateBuilder';
import { runDocumentPreflight } from '../../lib/documentStandards/documentPreflightRunner';
import type { DocumentPreflightStructuredInput } from '../../types/editorialDocumentStandards';
import { buildArticleHtml, buildArticleHtmlFilename } from '../../lib/publishing/htmlExport';
import { normalizeArticleDocumentForExport } from '../../lib/publishing/articleExportAdapter';
import { normalizeEditorialBriefContent, normalizeEditorialBriefInput } from '../../lib/editorialBrief';
import { processTask } from '../../services/geminiService';
import { executeEditorialWorkflowCommand, getEditorialWorkflowTelemetry } from '../../lib/editorialWorkflowRouter';
import type { EditorialExecutionResult, EditorialProposal } from '../../types/editorialExecution';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type EditorialCreationStep = "brief" | "recommendation" | "generating" | "draft";

const COPILOT_ONBOARDING_KEY = "vms-editorial-copilot-onboarding-seen";

type CopilotCommandId =
  | "draft_new"
  | "manual_edit"
  | "rewrite_selection"
  | "shorten_selection"
  | "fix_selection"
  | "strengthen_argument"
  | "review_current_draft"
  | "normalize_caption_title"
  | "check_missing_source_or_caption"
  | "remove_bad_technical_markers"
  | "check_long_paragraph"
  | "normalize_basic_heading"
  | "suggest_title_sapo"
  | "add_source"
  | "summarize_selected_source"
  | "create_caption"
  | "normalize_table"
  | "check_table_numbers"
  | "figure_caption"
  | "table_to_analysis"
  | "suggest_figure"
  | "describe_figure"
  | "check_figure_position"
  | "use_source_to_update_draft"
  | "attach_source_to_draft"
  | "compare_source_with_draft"
  | "explain_preflight_issue"
  | "fix_preflight_issue"
  | "find_similar_issue"
  | "ignore_preflight_issue"
  | "export_docx"
  | "export_pdf"
  | "export_html_a4"
  | "open_history"
  | "choose_template"
  | "more";

interface CanvasBlockEditState {
  blockId: string;
  blockType: ArticleBlock["type"];
  blockIndex: number;
  originalText: string;
  value: string;
  title: string;
  undoStack: string[];
  redoStack: string[];
  error?: string | null;
}

interface CanvasBlockOverride {
  block: ArticleBlock;
  empty: boolean;
  index: number;
}

type PreflightUiStatus = "idle" | "checking" | "ready" | "stale";

const CANVAS_EDITABLE_BLOCK_TYPES = new Set<ArticleBlock["type"]>([
  "title",
  "sapo",
  "section-heading",
  "paragraph",
  "conclusion",
  "quote",
  "bullet-list",
  "ordered-list",
]);


function markdownHeading(value: string, level: 1 | 2 | 3): string {
  const text = clearCanvasEditFormatting(value).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).join(" ");
  return text ? `${"#".repeat(level)} ${text}` : "";
}

function clearCanvasEditFormatting(value: string): string {
  return String(value || "")
    .split(/\r?\n/u)
    .map((line) => line
      .replace(/^#{1,6}\s+/u, "")
      .replace(/^[-*+]\s+/u, "")
      .replace(/^\d+[.)]\s+/u, "")
      .replace(/(?:\*\*|__|`)/gu, "")
      .replace(/(^|[^_])_([^_]+)_/gu, "$1$2")
      .trim())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n");
}

function paragraphCanvasEditText(value: string): string {
  return clearCanvasEditFormatting(value);
}

function bulletCanvasEditText(value: string): string {
  const lines = clearCanvasEditFormatting(value).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "- ";
}

function numberedCanvasEditText(value: string): string {
  const lines = clearCanvasEditFormatting(value).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines.map((line, index) => `${index + 1}. ${line}`).join("\n") : "1. ";
}

function wrapCanvasEditText(value: string, marker: "**" | "_"): string {
  const text = String(value || "").trim();
  if (!text) return "";
  const escapedMarker = marker.replace(/\*/gu, "\\*");
  const wrappedPattern = new RegExp(`^${escapedMarker}([\\s\\S]*)${escapedMarker}$`, "u");
  const match = text.match(wrappedPattern);
  return match ? match[1] : `${marker}${text}${marker}`;
}

function getCanvasHeadingLevel(value: string, blockType?: ArticleBlock["type"]): 1 | 2 | 3 | null {
  const match = String(value || "").trim().match(/^(#{1,3})\s+/u);
  if (match) return match[1].length as 1 | 2 | 3;
  if (blockType === "title") return 1;
  if (blockType === "section-heading") return 2;
  return null;
}

function isCanvasBulletList(value: string, blockType?: ArticleBlock["type"]): boolean {
  if (blockType === "bullet-list") return true;
  const lines = String(value || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^[-*+]\s+/u.test(line));
}

function isCanvasNumberedList(value: string, blockType?: ArticleBlock["type"]): boolean {
  if (blockType === "ordered-list") return true;
  const lines = String(value || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^\d+[.)]\s+/u.test(line));
}

function isCanvasInlineWrapped(value: string, marker: "**" | "_"): boolean {
  const text = String(value || "").trim();
  if (!text) return false;
  if (marker === "**") return /^\*\*[\s\S]+\*\*$/u.test(text);
  return /^_[\s\S]+_$/u.test(text);
}

function canvasBlockEditLabel(blockType: ArticleBlock["type"]): string {
  if (blockType === "title") return "Tiêu đề";
  if (blockType === "section-heading") return "Tiêu đề mục";
  if (blockType === "bullet-list" || blockType === "ordered-list") return "Danh sách";
  if (blockType === "sapo") return "Sapo";
  if (blockType === "quote") return "Trích dẫn";
  if (blockType === "conclusion") return "Kết luận";
  return "Đoạn văn";
}

function normalizeCanvasMultilineText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/[\u200B\u200C\u200D\uFEFF]/gu, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

function blockWithTextOverride(block: ArticleBlock, value: string): ArticleBlock {
  const multilineValue = normalizeCanvasMultilineText(value);
  if (block.type === "bullet-list" || block.type === "ordered-list") {
    const items = multilineValue.split(/\n/u).map((line) => line.replace(/^[-*+]\s+/u, "").replace(/^\d+[.)]\s+/u, "").trim()).filter(Boolean);
    return { ...block, slots: { ...block.slots, items } };
  }

  // Canvas text blocks are multiline containers; do not flatten newlines during edit commit.
  return { ...block, slots: { ...block.slots, text: multilineValue } };
}

function comparableCanvasLine(value: unknown): string {
  return normalizeCanvasMultilineText(value)
    .replace(/(?:\*\*|__|`)/gu, "")
    .replace(/^#{1,6}\s+/u, "")
    .replace(/^[-*+]\s+/u, "")
    .replace(/^\d+[.)]\s+/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("vi-VN");
}

function multilineTextLines(value: unknown): string[] {
  return normalizeCanvasMultilineText(value)
    .split(/\n/u)
    .map((line) => comparableCanvasLine(line))
    .filter(Boolean);
}

function getOverrideMultilineLines(block: ArticleBlock): string[] {
  if (block.type === "bullet-list" || block.type === "ordered-list" || block.type === "lead-in-list") return [];
  const text = normalizeCanvasMultilineText(block.slots?.text);
  if (!text.includes("\n")) return [];
  return multilineTextLines(text);
}

function findParsedMultilineRun(blocks: ArticleBlock[], override: CanvasBlockOverride): { start: number; length: number } | null {
  const lines = getOverrideMultilineLines(override.block);
  if (lines.length <= 1) return null;

  const blockLines = blocks.map((block) => comparableCanvasLine(getArticleBlockFullText(block)));
  const expectedLength = lines.length;
  const preferredStart = Math.max(0, Math.min(override.index, blocks.length - 1));
  const starts = [
    preferredStart,
    preferredStart - 2,
    preferredStart - 1,
    preferredStart + 1,
    preferredStart + 2,
    ...blocks.map((_block, index) => index),
  ].filter((start, index, all) => start >= 0 && start + expectedLength <= blocks.length && all.indexOf(start) === index);

  for (const start of starts) {
    const matches = lines.every((line, offset) => blockLines[start + offset] === line);
    if (matches) return { start, length: expectedLength };
  }

  return null;
}

function applyCanvasBlockOverrides(baseBlocks: ArticleBlock[], overrides: CanvasBlockOverride[]): ArticleBlock[] {
  let blocks = [...baseBlocks];

  overrides
    .sort((a, b) => a.index - b.index)
    .forEach((override) => {
      const multilineRun = findParsedMultilineRun(blocks, override);
      if (multilineRun) {
        blocks.splice(multilineRun.start, multilineRun.length, override.block);
        return;
      }

      const existingIndex = blocks.findIndex((block) => block.id === override.block.id);
      if (existingIndex >= 0) {
        blocks[existingIndex] = override.block;
        return;
      }
      blocks.splice(Math.min(override.index, blocks.length), 0, override.block);
    });

  return blocks;
}

function normalizePreflightText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizePreflightIssueMessage(value: string): string {
  return normalizePreflightText(value).replace(/\s+/gu, " ").toLowerCase();
}

function normalizePreflightIssuesForDisplay(issues: PreflightIssue[]): PreflightIssue[] {
  const seen = new Set<string>();
  const normalized: PreflightIssue[] = [];

  dedupePreflightIssues(issues).forEach((issue) => {
    const target = issue.path || issue.blockId || issue.field || issue.blockType || "";
    const rule = issue.code || issue.id || "";
    const key = [issue.severity, issue.source || "", rule, target, normalizePreflightIssueMessage(issue.message)].join("|");
    const fallbackKey = [issue.severity, normalizePreflightIssueMessage(issue.message), target].join("|");
    if (seen.has(key) || seen.has(fallbackKey)) return;
    seen.add(key);
    seen.add(fallbackKey);
    normalized.push(issue);
  });

  return normalized;
}

function collectArticleDocumentPreflightText(blocks: ArticleBlock[]): string {
  const parts: string[] = [];

  blocks.forEach((block) => {
    const slots = block.slots as Record<string, unknown> | undefined;
    if (!slots) return;

    // Preflight must use ArticleDocument model/plain slots only; never DOM/outerHTML/UI attributes.
    const text = normalizePreflightText(slots.text);
    const title = normalizePreflightText(slots.title);
    const caption = normalizePreflightText(slots.caption);
    const source = normalizePreflightText(slots.source || slots.sourceNote || slots.note);

    if (title) parts.push(`[${block.type}] ${title}`);
    if (text) parts.push(`[${block.type}] ${text}`);
    if (caption) parts.push(`[${block.type} caption] ${caption}`);
    if (source) parts.push(`[${block.type} source] ${source}`);

    if (Array.isArray(slots.items)) {
      slots.items.forEach((item) => {
        if (typeof item === "string" || typeof item === "number") {
          const itemText = normalizePreflightText(item);
          if (itemText) parts.push(`[${block.type} item] ${itemText}`);
          return;
        }
        if (item && typeof item === "object") {
          const label = normalizePreflightText((item as { label?: unknown }).label);
          const body = normalizePreflightText((item as { body?: unknown }).body);
          const itemText = [label, body].filter(Boolean).join(": ");
          if (itemText) parts.push(`[${block.type} item] ${itemText}`);
        }
      });
    }

    if (Array.isArray(slots.rows)) {
      const rowText = slots.rows
        .map((row) => Array.isArray(row)
          ? row.map((cell) => normalizePreflightText((cell as { text?: unknown } | undefined)?.text)).filter(Boolean).join(" | ")
          : "")
        .filter(Boolean)
        .slice(0, 8)
        .join("\n");
      if (rowText) parts.push(`[${block.type} rows] ${rowText}`);
    }
  });

  return parts.join("\n\n").trim();
}

function buildArticleDocumentPreflightInput(
  articleDocument: { templateId: string; metadata?: { title?: string; sapo?: string; organization?: string }; blocks: ArticleBlock[] },
  profileId: ReturnType<typeof resolveDocumentStandardProfileId>,
): DocumentPreflightStructuredInput {
  const paragraphs: NonNullable<DocumentPreflightStructuredInput["paragraphs"]> = [];
  const headings: NonNullable<DocumentPreflightStructuredInput["headings"]> = [];
  const tables: NonNullable<DocumentPreflightStructuredInput["tables"]> = [];
  const figures: NonNullable<DocumentPreflightStructuredInput["figures"]> = [];

  articleDocument.blocks.forEach((block, index) => {
    const slots = block.slots as Record<string, unknown>;
    const text = normalizePreflightText(slots.text || slots.title || slots.caption || slots.note);
    const base = { id: block.id || `${block.type}-${index + 1}`, text };
    if ((block.type === "title" || block.type === "section-heading") && text) headings.push({ ...base, role: "heading" });
    if ((block.type === "sapo" || block.type === "paragraph" || block.type === "conclusion" || block.type === "quote") && text) {
      paragraphs.push({ ...base, role: block.type === "sapo" ? "sapo" : block.type === "conclusion" ? "conclusion" : "body" });
    }
    if ((block.type === "bullet-list" || block.type === "ordered-list" || block.type === "lead-in-list") && Array.isArray(slots.items)) {
      const itemText = slots.items.map((item) => typeof item === "string" ? item : typeof item === "number" ? String(item) : item && typeof item === "object" ? [String((item as { label?: unknown }).label || ""), String((item as { body?: unknown }).body || "")].filter(Boolean).join(": ") : "").filter(Boolean).join("\n");
      if (itemText) paragraphs.push({ id: block.id, text: itemText, role: "body" });
    }
    if (block.type === "table") {
      const rows = Array.isArray(slots.rows)
        ? slots.rows.map((row) => Array.isArray(row) ? row.map((cell) => normalizePreflightText((cell as { text?: unknown } | undefined)?.text)) : [])
        : undefined;
      tables.push({
        id: block.id,
        caption: normalizePreflightText(slots.caption || slots.title),
        note: normalizePreflightText(slots.note),
        source: normalizePreflightText(slots.source || slots.sourceNote),
        rows,
        isDataLike: Boolean(rows?.some((row) => row.some((cell) => /\d/u.test(cell)))),
      });
    }
    if (block.type === "figure-placeholder") {
      figures.push({
        id: block.id,
        caption: normalizePreflightText(slots.caption || slots.title),
        note: normalizePreflightText(slots.note),
        source: normalizePreflightText(slots.source || slots.sourceNote),
        placeholderText: normalizePreflightText(slots.description || slots.text),
      });
    }
  });

  return {
    profileId,
    title: articleDocument.metadata?.title,
    sapo: articleDocument.metadata?.sapo,
    text: collectArticleDocumentPreflightText(articleDocument.blocks),
    paragraphs,
    headings,
    tables,
    figures,
    metadata: {
      organizationName: articleDocument.metadata?.organization,
    },
  };
}

const COPILOT_DRAFT_KIND_ORDER = [
  "website_article",
  "news",
  "press_release",
  "administrative_report",
  "official_letter",
  "plan",
  "meeting_minutes",
  "speech_outline",
  "briefing_note",
  "summary_note",
] as const;

const COMMAND_LABELS: Record<CopilotCommandId, string> = {
  draft_new: "Soạn mới",
  manual_edit: "Sửa trên Canvas",
  rewrite_selection: "Viết lại",
  shorten_selection: "Rút gọn",
  fix_selection: "Sửa lỗi",
  strengthen_argument: "Tăng lập luận",
  review_current_draft: "Rà soát",
  normalize_caption_title: "Chuẩn hóa",
  check_missing_source_or_caption: "Kiểm tra lỗi",
  remove_bad_technical_markers: "Xóa marker",
  check_long_paragraph: "Đoạn dài",
  normalize_basic_heading: "Chuẩn hóa",
  suggest_title_sapo: "Tiêu đề",
  add_source: "Nguồn",
  summarize_selected_source: "Tóm tắt nguồn",
  create_caption: "Tạo tên bảng",
  normalize_table: "Chuẩn hóa bảng",
  check_table_numbers: "Kiểm tra số liệu",
  figure_caption: "Viết caption",
  table_to_analysis: "Chuyển thành đoạn phân tích",
  suggest_figure: "Gợi ý hình cần chèn",
  describe_figure: "Mô tả hình",
  check_figure_position: "Kiểm tra vị trí hình",
  use_source_to_update_draft: "Dùng để cập nhật bài",
  attach_source_to_draft: "Gắn vào bản thảo",
  compare_source_with_draft: "So sánh với bản thảo",
  explain_preflight_issue: "Giải thích lỗi",
  fix_preflight_issue: "Sửa lỗi này",
  find_similar_issue: "Tìm lỗi tương tự",
  ignore_preflight_issue: "Bỏ qua cảnh báo",
  export_docx: "Xuất Word",
  export_pdf: "Xuất PDF",
  export_html_a4: "Xuất HTML A4",
  open_history: "Lịch sử",
  choose_template: "Chọn mẫu",
  more: "Khác",
};

function makeCommand(id: CopilotCommandId, description?: string, disabled?: boolean): CopilotCommand {
  return { id, label: COMMAND_LABELS[id], description, disabled };
}

function makePlaceholderCommand(label: string, missingCommandKey: string): CopilotCommand {
  return {
    id: `placeholder:${missingCommandKey}`,
    label,
    description: "Chức năng này sẽ hoàn thiện ở bước sau.",
    disabled: true,
  };
}

function contextTypeFromBlock(block: ArticleBlock): CopilotContextItem["type"] {
  if (block.type === "section-heading" || block.type === "title" || block.type === "sapo") return "heading";
  if (block.type === "table") return "table";
  if (block.type === "figure-placeholder") return "figure";
  return "paragraph";
}

function normalizeBlockSlotText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/\s+$/gm, "").trim();
}

function getArticleBlockFullText(block: ArticleBlock): string {
  const text = normalizeBlockSlotText(block.slots?.text);
  if (text) return text;

  const caption = normalizeBlockSlotText(block.slots?.caption);
  if (caption) return caption;

  const title = normalizeBlockSlotText(block.slots?.title);
  if (title) return title;

  if (Array.isArray(block.slots?.items)) {
    const items = block.slots.items
      .map((item, index) => {
        const prefix = block.type === "bullet-list" ? "- " : block.type === "ordered-list" || block.type === "lead-in-list" ? `${index + 1}. ` : "";
        if (typeof item === "string" || typeof item === "number") return `${prefix}${normalizeBlockSlotText(item)}`.trim();
        if (item && typeof item === "object") {
          const label = normalizeBlockSlotText((item as { label?: unknown }).label);
          const body = normalizeBlockSlotText((item as { body?: unknown }).body);
          return `${prefix}${[label, body].filter(Boolean).join(": ")}`.trim();
        }
        return "";
      })
      .filter(Boolean);
    if (items.length > 0) return items.join("\n");
  }

  return getArticleBlockExcerpt(block);
}

function buildContextFromBlock(block: ArticleBlock): CopilotContextItem {
  const excerpt = getArticleBlockExcerpt(block);
  const fullText = getArticleBlockFullText(block);
  return {
    id: `block:${block.id}`,
    blockId: block.id,
    type: contextTypeFromBlock(block),
    title: block.type === "table" ? "Bảng trong bản thảo" : block.type === "figure-placeholder" ? "Hình/placeholder trong bản thảo" : excerpt.slice(0, 72) || "Nội dung đã chọn",
    excerpt,
    fullText,
  };
}

const COPILOT_TARGET_SCOPED_COMMANDS = new Set<CopilotCommandId>(["rewrite_selection", "shorten_selection", "fix_selection", "strengthen_argument"]);
const COPILOT_SECTION_HEADING_PATTERN = /^(?:tiêu đề|sapo|sa-pô|thân bài|mở bài|kết luận|nội dung|heading|title)\s*[:：]/imu;
const COPILOT_MARKDOWN_LINE_PREFIX = /^(?:#{1,6}|[-*+]\s+|\d+[.)]\s+|>\s*)+/u;

function sanitizeProposalReplacement(value: string, targetType?: CopilotContextItem["type"]): string {
  const cleaned = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.replace(COPILOT_MARKDOWN_LINE_PREFIX, "").replace(/(?:\*\*|__|`)/g, "").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (targetType === "heading") {
    return cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0]?.replace(COPILOT_SECTION_HEADING_PATTERN, "").trim() || "";
  }
  return cleaned;
}

function isSafeReplacementForTarget(value: string, targetType?: CopilotContextItem["type"]): boolean {
  const cleaned = value.trim();
  if (!cleaned || COPILOT_SECTION_HEADING_PATTERN.test(cleaned)) return false;
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (targetType === "heading") return lines.length === 1 && cleaned.length <= 180;
  if (targetType === "paragraph") return !lines.some((line) => COPILOT_SECTION_HEADING_PATTERN.test(line) || COPILOT_MARKDOWN_LINE_PREFIX.test(line));
  return true;
}

function extractDocumentText(document: any): string {
  if (!document) return "";
  const candidates = [document.content, document.text, document.summary, document.description, document.excerpt, document.name, document.title];
  return candidates.map((value) => typeof value === "string" ? value.trim() : "").find(Boolean) || "";
}

function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resolveDocumentStandardProfileId(kindOrTemplateId?: string): "website_article" | "news_article" | "company_intro_article" | "administrative_report" | "kpi_data_report" | "official_dispatch" | "meeting_minutes" | "work_plan" | "notice_basic" | "summary_sheet" {
  const norm = (kindOrTemplateId || "").toLowerCase();
  if (norm.includes("website") || norm.includes("default")) return "website_article";
  if (norm.includes("news")) return "news_article";
  if (norm.includes("company") || norm.includes("intro")) return "company_intro_article";
  if (norm.includes("kpi") || norm.includes("data_report")) return "kpi_data_report";
  if (norm.includes("report")) return "administrative_report";
  if (norm.includes("dispatch")) return "official_dispatch";
  if (norm.includes("meeting") || norm.includes("minute")) return "meeting_minutes";
  if (norm.includes("plan")) return "work_plan";
  if (norm.includes("notice")) return "notice_basic";
  if (norm.includes("summary")) return "summary_sheet";
  return "website_article";
}

export const EditorWorkspace = (props: any) => {
  const {
    selectedEditorialToolId, handleToolChange,
    historySearchQuery = '', setHistorySearchQuery, loadSession, cleanDisplayTitle, setSessions,
    setTaskType, user, selectedSourceDocIds, documents, setIsPickingFromLibrary, handleSaveSlideOutline, handleCreateTaskFromSlideOutline, safeParseSlideOutline, output, taskType, outputFormat, setOutputFormat, input, setSourceActiveTab, sourceActiveTab, searchQuery, setSearchQuery, handleWebSearch, isLoading, searchResults, getHostname, addSearchResultAsSource, newTextName, setNewTextName, newTextContent, setNewTextContent, saveToLibrary, setSaveToLibrary, handleAddText, newLinkUrl, setNewLinkUrl, handleAddLink, isParsing, fileInputRef, getDocTypeLabel, getSourceTypeLabel, toggleDocSelection, setInput, setOutput, setError, aiCooldownUntil, editorialKind, setEditorialKind, isBuildingTasks, handleBuildTasks, handleProcess, builtTasks, setBuiltTasks, saveBuiltTasks, persistTask, toast, error, outputRef, setIsEditing, isEditing, currentSessionId, sessions, handleCopy, copySuccess, saveCurrentToSession, handleLocalIllustrationScan, isPlanningImages, handleAIIllustrationSuggestions, setSelectingParagraphForImage, auditEditorialPublish, illustrations, requestConfirmAsync, logActivity, stripResolvedPlaceholders, removeBrokenMarkdownImages, imagePlans, approveAllValidIllustrations, clearErrorImages, handleManualUpload, approveIllustration, rejectIllustration, setIllustrations, contentReview, isPublishableIllustration, updateImageLoadStatus, insertApprovedIllustrationsForPlainExport, editorialDraftKey, clearEditorialDraft, createNewSession
  } = props;

  const currentTool = getEditorialTool(selectedEditorialToolId);
  const [currentStep, setCurrentStep] = React.useState<EditorialCreationStep>("brief");
  const [recommendationBrief, setRecommendationBrief] = React.useState("");
  const [recommendedLayouts, setRecommendedLayouts] = React.useState<LayoutRecommendation[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = React.useState<string | undefined>();
  const [selectedLayoutVersion, setSelectedLayoutVersion] = React.useState<string | undefined>();
  const [layoutRecommendationError, setLayoutRecommendationError] = React.useState<string | undefined>();


  const hasGeneratedDraft = Boolean(output?.trim());
  const [isBriefPanelOpen, setIsBriefPanelOpen] = React.useState(false);
  const [isDraftDirty, setIsDraftDirty] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [copilotViewMode, setCopilotViewMode] = React.useState<CopilotViewMode>("collapsed");
  const [selectedContextItems, setSelectedContextItems] = React.useState<CopilotContextItem[]>([]);
  const [activeCommandId, setActiveCommandId] = React.useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = React.useState<CopilotProposal | null>(null);
  const [copilotInput, setCopilotInput] = React.useState("");
  const [copilotStatusMessage, setCopilotStatusMessage] = React.useState<string | null>(null);
  const [isCopilotBusy, setIsCopilotBusy] = React.useState(false);
  const [isCopilotDraftFlowOpen, setIsCopilotDraftFlowOpen] = React.useState(false);
  const [isCopilotSourceFlowOpen, setIsCopilotSourceFlowOpen] = React.useState(false);
  const [copilotDraftExtraNotes, setCopilotDraftExtraNotes] = React.useState("");
  const [copilotDraftFlowError, setCopilotDraftFlowError] = React.useState<string | null>(null);
  const [copilotDraftSelectedTemplateId, setCopilotDraftSelectedTemplateId] = React.useState<string | null>(null);
  const [copilotDraftTargetGroup, setCopilotDraftTargetGroup] = React.useState<CopilotDraftFlowState["targetGroup"]>();
  const [canvasBlockEditState, setCanvasBlockEditState] = React.useState<CanvasBlockEditState | null>(null);
  const [canvasBlockOverrides, setCanvasBlockOverrides] = React.useState<Record<string, CanvasBlockOverride>>({});
  const [pillAnchor, setPillAnchor] = React.useState<{ top: number; left: number } | null>(null);
  const [isContextPillVisible, setIsContextPillVisible] = React.useState(false);
  const [onboardingSeen, setOnboardingSeen] = React.useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(COPILOT_ONBOARDING_KEY) === "true";
  });
  const [workspaceMode, setWorkspaceMode] = React.useState<EditorialWorkspaceMode>("edit");
  const [activeHeaderMenu, setActiveHeaderMenu] = React.useState<null | "export" | "more">(null);
  const headerMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [exportingFormat, setExportingFormat] = React.useState<null | "pdf" | "docx" | "html">(null);
  const [preflightUiStatus, setPreflightUiStatus] = React.useState<PreflightUiStatus>("idle");
  const [lastPreflightDraftSignature, setLastPreflightDraftSignature] = React.useState<string | null>(null);
  const lastToastAtRef = React.useRef<Record<string, number>>({});
  const currentDraftId = React.useMemo(
    () => currentSessionId || `local-${user?.uid || "guest"}-editorial-main`,
    [currentSessionId, user?.uid],
  );
  const localDraftKey = editorialDraftKey || (user?.uid ? `vms:workspace:draft:${user.uid}:editorial:main` : null);

  const dedupeToast = React.useCallback((id: string, run: () => void, cooldownMs = 2500) => {
    const now = Date.now();
    if ((lastToastAtRef.current[id] || 0) + cooldownMs > now) return;
    lastToastAtRef.current[id] = now;
    run();
  }, []);

  const notifySuccess = React.useCallback((id: string, message: string) => {
    dedupeToast(id, () => toast.success(message, { id, duration: 3500 }));
  }, [dedupeToast, toast]);

  const notifyWarning = React.useCallback((id: string, message: string, duration = 4500) => {
    dedupeToast(id, () => toast(message, { id, icon: "⚠️", duration }));
  }, [dedupeToast, toast]);

  const notifyError = React.useCallback((id: string, message: string) => {
    dedupeToast(id, () => toast.error(message, { id, duration: 8000 }));
  }, [dedupeToast, toast]);

  const clearEditorialLocalDraft = React.useCallback(() => {
    if (localDraftKey) localStorage.removeItem(localDraftKey);
  }, [localDraftKey]);

  const persistEditorialLocalDraft = React.useCallback(() => {
    if (!localDraftKey || !isDraftDirty || !hasGeneratedDraft) return;
    localStorage.setItem(localDraftKey, JSON.stringify({
      input: normalizeEditorialBriefInput(input),
      output: normalizeEditorialBriefContent(output),
      selectedEditorialToolId,
      taskType,
      outputFormat,
      editorialKind,
      selectedSourceDocIds,
      currentDraftId,
      isDraftDirty: true,
      lastSavedAt,
      updatedAt: Date.now(),
    }));
  }, [currentDraftId, editorialKind, hasGeneratedDraft, input, isDraftDirty, lastSavedAt, localDraftKey, output, outputFormat, selectedEditorialToolId, selectedSourceDocIds, taskType]);

  const clearEditorialEditorTransientState = React.useCallback(() => {
    setCanvasBlockEditState(null);
    setCanvasBlockOverrides({});
    setSelectedContextItems([]);
    setPendingProposal(null);
    setPillAnchor(null);
    setIsContextPillVisible(false);
    setActiveCommandId(null);
    setPreflightUiStatus("idle");
    setLastPreflightDraftSignature(null);
  }, []);

  const resetEditorialDraftState = React.useCallback(() => {
    setOutput("");
    setError(null);
    setCurrentStep("brief");
    setIsDraftDirty(false);
    setLastSavedAt(null);
    clearEditorialEditorTransientState();
  }, [clearEditorialEditorTransientState, setError, setOutput]);

  const closeAllHeaderMenus = React.useCallback(() => {
    setActiveHeaderMenu(null);
  }, []);

  React.useEffect(() => {
    if (!activeHeaderMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && headerMenuRef.current?.contains(target)) return;
      closeAllHeaderMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAllHeaderMenus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeHeaderMenu, closeAllHeaderMenus]);

  const markDraftDirty = React.useCallback(() => {
    if (!hasGeneratedDraft) return;
    setIsDraftDirty(true);
  }, [hasGeneratedDraft]);

  React.useEffect(() => {
    if (onboardingSeen) return;
    window.localStorage.setItem(COPILOT_ONBOARDING_KEY, "true");
    setOnboardingSeen(true);
  }, [onboardingSeen]);

  React.useEffect(() => {
    if (!isContextPillVisible) return undefined;
    const timer = window.setTimeout(() => setIsContextPillVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [isContextPillVisible, pillAnchor, selectedContextItems.length]);

  React.useEffect(() => {
    if (!Array.isArray(documents) || selectedSourceDocIds.length === 0) return;
    const sourceItems: CopilotContextItem[] = documents
      .filter((document: any) => selectedSourceDocIds.includes(document.id))
      .slice(0, 3)
      .map((document: any) => ({
        id: `source:${document.id}`,
        sourceId: document.id,
        type: "source",
        title: document.name || document.title || "Nguồn tư liệu đã chọn",
        excerpt: extractDocumentText(document).slice(0, 600),
      }));
    if (sourceItems.length === 0) return;
    setSelectedContextItems((current) => {
      const nonSourceItems = current.filter((item) => item.type !== "source");
      const missingItems = sourceItems.filter((item) => !current.some((currentItem) => currentItem.id === item.id));
      return missingItems.length > 0 ? [...nonSourceItems, ...sourceItems].slice(0, 4) : current;
    });
  }, [documents, selectedSourceDocIds]);

  React.useEffect(() => {
    if (!copilotStatusMessage || isCopilotBusy || pendingProposal) return undefined;
    if (!copilotStatusMessage.startsWith("Đã")) return undefined;
    const timer = window.setTimeout(() => setCopilotStatusMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [copilotStatusMessage, isCopilotBusy, pendingProposal]);


  const clearLocalDraft = React.useCallback((showToast = true) => {
    if (typeof clearEditorialDraft === "function") {
      clearEditorialDraft();
    } else {
      clearEditorialLocalDraft();
    }

    resetEditorialDraftState();
    setCopilotStatusMessage("Đã xóa bản nháp. Canvas đã trở về trạng thái trống sạch.");
    closeAllHeaderMenus();

    if (showToast) notifySuccess("canvas-edit-status", "Đã xóa bản nháp biên tập trên máy này.");
  }, [clearEditorialDraft, clearEditorialLocalDraft, closeAllHeaderMenus, notifySuccess, resetEditorialDraftState]);

  React.useEffect(() => {
    if (!hasGeneratedDraft) return;
    setIsBriefPanelOpen(false);
    if (currentStep !== "draft") setCurrentStep("draft");
  }, [currentStep, hasGeneratedDraft]);

  React.useEffect(() => {
    if (!localDraftKey) return;
    const raw = localStorage.getItem(localDraftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { isDraftDirty?: boolean; lastSavedAt?: number | null };
      if (saved.isDraftDirty === true) {
        setIsDraftDirty(true);
        setLastSavedAt(saved.lastSavedAt ?? null);
      }
    } catch {
      // Ignore malformed local draft metadata.
    }
  }, [localDraftKey]);

  React.useEffect(() => {
    persistEditorialLocalDraft();
  }, [persistEditorialLocalDraft]);

  const resetWorkspaceForNewArticle = React.useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setIsEditing(false);
    setCurrentStep("brief");
    setIsBriefPanelOpen(false);
    setRecommendationBrief("");
    setRecommendedLayouts([]);
    setSelectedLayoutId(undefined);
    setSelectedLayoutVersion(undefined);
    setLayoutRecommendationError(undefined);
    setIsDraftDirty(false);
    setLastSavedAt(null);
    setIsCopilotDraftFlowOpen(false);
    setIsCopilotSourceFlowOpen(false);
    setCopilotDraftExtraNotes("");
    setCopilotDraftFlowError(null);
    setCopilotDraftSelectedTemplateId(null);
    setCanvasBlockEditState(null);
    setCanvasBlockOverrides({});
    setPreflightUiStatus("idle");
    setLastPreflightDraftSignature(null);
  }, [setError, setInput, setIsEditing, setOutput]);

  const hasProtectedWorkspaceData = React.useMemo(() => (
    isDraftDirty ||
    Boolean(output?.trim()) ||
    Boolean(input?.trim()) ||
    selectedSourceDocIds.length > 0
  ), [input, isDraftDirty, output, selectedSourceDocIds.length]);

  const handleCreateNewArticle = React.useCallback(async () => {
    if (hasProtectedWorkspaceData) {
      const confirmed = await requestConfirmAsync("Bản thảo hiện tại có dữ liệu hoặc nguồn tư liệu đang chọn. Bạn muốn tạo bài mới và xóa dữ liệu hiện tại?");
      if (!confirmed) return;
    }
    clearLocalDraft(false);
    if (typeof createNewSession === "function") {
      createNewSession();
    }
    resetWorkspaceForNewArticle();
  }, [clearLocalDraft, createNewSession, hasProtectedWorkspaceData, requestConfirmAsync, resetWorkspaceForNewArticle]);

  const handleSaveDraft = React.useCallback(async () => {
    if (!output?.trim()) return;
    setIsSavingDraft(true);
    try {
      await saveCurrentToSession(output);
      const savedAt = Date.now();
      setLastSavedAt(savedAt);
      setIsDraftDirty(false);
      clearEditorialLocalDraft();
      notifySuccess("save-draft-success", `Đã lưu bản thảo lúc ${new Date(savedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (err: any) {
      const message = err?.message || "Không lưu được bản thảo.";
      setError(message);
      notifyError("save-draft-error", message);
    } finally {
      setIsSavingDraft(false);
    }
  }, [clearEditorialLocalDraft, notifyError, notifySuccess, output, saveCurrentToSession, setError]);

  const draftSaveLabel = isSavingDraft
    ? "Đang lưu…"
    : isDraftDirty
      ? "Có thay đổi chưa lưu"
      : lastSavedAt
        ? `Đã lưu lúc ${new Date(lastSavedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
        : hasGeneratedDraft
          ? "Chưa lưu"
          : "Chưa có bản thảo";

  const selectedLayout = React.useMemo(() => {
    if (!selectedLayoutId || !selectedLayoutVersion) return undefined;
    return getArticleLayout(selectedLayoutId, selectedLayoutVersion);
  }, [selectedLayoutId, selectedLayoutVersion]);

  const articleDocument = React.useMemo(() => {
    const previewContent = normalizeEditorialBriefContent(output || "");
    const baseDocument = createArticleDocumentFromCurrentContent(previewContent, {
      status: "draft",
      authorName: user?.displayName || user?.email || undefined,
      layoutId: selectedLayout?.layoutId,
      layoutVersion: selectedLayout?.layoutVersion,
      estimatedPages: selectedLayout?.estimatedPages,
    });

    const overrides = Object.values(canvasBlockOverrides);
    if (overrides.length === 0) return baseDocument;

    return { ...baseDocument, blocks: applyCanvasBlockOverrides(baseDocument.blocks, overrides) };
  }, [canvasBlockOverrides, output, selectedLayout, user?.displayName, user?.email]);

  const emptyCanvasBlockIds = React.useMemo(() => Object.values(canvasBlockOverrides).filter((override) => override.empty).map((override) => override.block.id), [canvasBlockOverrides]);
  const articleExportModel = React.useMemo(() => normalizeArticleDocumentForExport(articleDocument), [articleDocument]);
  const articleValidation = React.useMemo(() => validateArticleDocument(articleDocument), [articleDocument]);
  
  const preflightIssues = React.useMemo(() => {
    if (!hasGeneratedDraft) return [];

    let issues = [...articleValidation.preflightIssues];
    const docText = [
      articleDocument.metadata?.title,
      articleDocument.metadata?.sapo,
      collectArticleDocumentPreflightText(articleDocument.blocks),
    ]
      .map(normalizePreflightText)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (docText) {
      try {
        const profileId = resolveDocumentStandardProfileId(articleDocument.templateId);
        const docStandardsIssues = runDocumentPreflight(buildArticleDocumentPreflightInput(articleDocument, profileId));

        const translatedIssues = docStandardsIssues.map(dsi => createPreflightIssue({
          severity: dsi.severity,
          code: `ds-${dsi.ruleId}`,
          message: dsi.message,
          suggestion: dsi.suggestion,
          field: dsi.targetHint,
          source: "editorial-check",
        }));

        issues = [...issues, ...translatedIssues];
      } catch (err) {
        console.warn("Preflight runner failed:", err);
      }
    }

    return normalizePreflightIssuesForDisplay(issues);
  }, [articleValidation, articleDocument, hasGeneratedDraft]);

  const preflightDraftSignature = React.useMemo(() => JSON.stringify({
    output: normalizeEditorialBriefContent(output || ""),
    overrides: Object.keys(canvasBlockOverrides).sort(),
  }), [canvasBlockOverrides, output]);

  React.useEffect(() => {
    if (!hasGeneratedDraft) {
      setPreflightUiStatus("idle");
      setLastPreflightDraftSignature(null);
      return;
    }
    if (preflightUiStatus === "ready" && lastPreflightDraftSignature && lastPreflightDraftSignature !== preflightDraftSignature) {
      setPreflightUiStatus("stale");
    }
  }, [hasGeneratedDraft, lastPreflightDraftSignature, preflightDraftSignature, preflightUiStatus]);

  const runUserRequestedPreflight = React.useCallback((source: "button" | "copilot" | "export" = "button") => {
    if (!hasGeneratedDraft) {
      setCopilotStatusMessage("Chưa có bản thảo để rà soát.");
      return false;
    }
    setPreflightUiStatus("checking");
    setLastPreflightDraftSignature(preflightDraftSignature);
    window.setTimeout(() => setPreflightUiStatus("ready"), 0);
    if (source !== "export") {
      setCopilotStatusMessage(preflightIssues.length > 0
        ? `Đã rà soát bản thảo: ${preflightIssues.length} vấn đề/gợi ý cần xem.`
        : "Đã rà soát bản thảo. Chưa phát hiện vấn đề lớn.");
    }
    return true;
  }, [hasGeneratedDraft, preflightDraftSignature, preflightIssues.length]);

  const visiblePreflightIssues = preflightUiStatus === "ready" ? preflightIssues : [];
  const preflightCounts = React.useMemo(() => countPreflightIssuesBySeverity(preflightIssues), [preflightIssues]);
  const hasPreflightBlockers = React.useMemo(() => hasBlockingPreflightIssues(preflightIssues), [preflightIssues]);

  const validateArticleBeforeExport = React.useCallback(async () => {
    runUserRequestedPreflight("export");
    if (hasPreflightBlockers) {
      const message = "Chưa thể xuất bản vì còn lỗi bắt buộc cần xử lý.";
      notifyError("preflight-warning", message);
      setError(message);
      return false;
    }

    if (preflightCounts.warning > 0) {
      notifyWarning("export-warning-summary", `Bản thảo còn ${preflightCounts.warning} cảnh báo. Xem Kiểm tra trước xuất bản để xử lý.`);
      return requestConfirmAsync("Bản thảo còn cảnh báo/cần bổ sung. Bạn vẫn muốn xuất file bản nháp?");
    }

    return true;
  }, [hasPreflightBlockers, notifyError, notifyWarning, preflightCounts.warning, requestConfirmAsync, runUserRequestedPreflight, setError]);


  const switchWorkspaceMode = React.useCallback((mode: EditorialWorkspaceMode) => {
    if (mode === "create") {
      handleToolChange?.("draft_new");
      setTaskType?.("WRITE_NEW");
      setOutputFormat?.("ARTICLE");
    }
    setWorkspaceMode(mode);
  }, [handleToolChange, setOutputFormat, setTaskType]);

  const selectedBlockIds = React.useMemo(() => selectedContextItems.map((item) => item.blockId).filter(Boolean) as string[], [selectedContextItems]);
  const selectedBlockContext = React.useMemo(() => selectedContextItems.find((item) => item.blockId), [selectedContextItems]);
  const selectedBlock = React.useMemo(() => {
    if (!selectedBlockContext?.blockId) return undefined;
    return articleDocument.blocks.find((block) => block.id === selectedBlockContext.blockId);
  }, [articleDocument.blocks, selectedBlockContext?.blockId]);

  const copilotCommands = React.useMemo<CopilotCommand[]>(() => {
    const firstContext = selectedContextItems[0];
    const noDraft = !normalizeEditorialBriefContent(output || "").trim();

    if (firstContext?.type === "paragraph" || firstContext?.type === "heading" || firstContext?.type === "selection") {
      return [
        makeCommand("rewrite_selection"),
        makeCommand("shorten_selection"),
        makeCommand("fix_selection"),
        makeCommand("strengthen_argument"),
        makeCommand("manual_edit"),
        makeCommand("more"),
      ];
    }

    if (firstContext?.type === "table") {
      return [
        makeCommand("create_caption"),
        makeCommand("normalize_caption_title", "Chuẩn hóa tên/caption bảng bằng rule hiện có"),
        makeCommand("check_table_numbers"),
        makePlaceholderCommand("Ghi chú bảng", "table_note"),
        makeCommand("more"),
      ];
    }

    if (firstContext?.type === "figure") {
      return [
        makeCommand("figure_caption", "Tạo tên/caption hình bằng rule hiện có"),
        makeCommand("normalize_caption_title", "Chuẩn hóa caption hình bằng rule hiện có"),
        makeCommand("check_missing_source_or_caption", "Kiểm tra nguồn/caption hình"),
        makePlaceholderCommand("Thêm nguồn hình", "add_figure_source"),
        makeCommand("more"),
      ];
    }

    if (firstContext?.type === "source") {
      return [
        makeCommand("summarize_selected_source"),
        makeCommand("use_source_to_update_draft"),
        makeCommand("compare_source_with_draft"),
        makeCommand("add_source"),
        makeCommand("more"),
      ];
    }

    if (firstContext?.type === "preflight_issue") {
      return [
        makeCommand("fix_preflight_issue"),
        makeCommand("remove_bad_technical_markers"),
        makeCommand("check_long_paragraph"),
        makeCommand("review_current_draft"),
        makeCommand("more"),
      ];
    }

    if (!noDraft) {
      return [
        makeCommand("review_current_draft"),
        makeCommand("remove_bad_technical_markers", "Chuẩn hóa marker kỹ thuật bằng rule hiện có"),
        makeCommand("check_missing_source_or_caption"),
        makeCommand("add_source"),
        makeCommand("more"),
      ];
    }

    return [
      makeCommand("draft_new"),
      makeCommand("choose_template"),
      makeCommand("open_history"),
      makeCommand("add_source"),
      makeCommand("more"),
    ];
  }, [output, selectedContextItems]);


  const openCopilotExpanded = React.useCallback(() => {
    setCopilotViewMode("expanded");
    setIsContextPillVisible(false);
  }, []);

  const clearCopilotContext = React.useCallback(() => {
    setSelectedContextItems([]);
    setPillAnchor(null);
    setIsContextPillVisible(false);
    setCanvasBlockEditState(null);
    setCopilotStatusMessage("Đã xóa context. Draft, nguồn và phiên làm việc vẫn được giữ nguyên.");
  }, []);

  const clearCanvasSelection = React.useCallback(() => {
    setSelectedContextItems((items) => items.filter((item) => !item.blockId));
    setPillAnchor(null);
    setIsContextPillVisible(false);
    setPendingProposal(null);
  }, []);

  const handleWorkspaceClick = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-canvas-block-id], [data-canvas-editing-wrapper], [data-copilot-root], [data-context-pill], [data-preflight-panel]')) return;
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const handleCanvasBlockSelect = React.useCallback((block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => {
    const contextItem = buildContextFromBlock(block);
    const wasSelected = selectedContextItems.some((item) => item.id === contextItem.id);
    const rect = event.currentTarget.getBoundingClientRect();

    setSelectedContextItems((current) => {
      if (wasSelected) {
        const nextItems = current.filter((item) => item.id !== contextItem.id);
        const nextCanvasItems = nextItems.filter((item) => item.blockId);
        if (nextCanvasItems.length === 0) {
          setPillAnchor(null);
          setIsContextPillVisible(false);
          setCopilotStatusMessage("Chưa chọn ngữ cảnh");
        } else {
          setPillAnchor({ top: Math.max(92, rect.top + window.scrollY - 8), left: Math.min(window.innerWidth - 180, rect.right + window.scrollX - 150) });
          setIsContextPillVisible(nextCanvasItems.length <= 3);
        }
        return nextItems;
      }

      const withoutCurrent = current.filter((item) => item.id !== contextItem.id && item.type !== "draft");
      return [contextItem, ...withoutCurrent].slice(0, 4);
    });

    if (!wasSelected) {
      setPillAnchor({ top: Math.max(92, rect.top + window.scrollY - 8), left: Math.min(window.innerWidth - 180, rect.right + window.scrollX - 150) });
      setIsContextPillVisible(true);
      setCopilotStatusMessage(null);
    }
  }, [selectedContextItems]);

  const replaceOutputText = React.useCallback((currentText: string, proposedText: string) => {
    const source = normalizeEditorialBriefContent(output || "");
    if (!currentText.trim()) return null;
    const index = source.indexOf(currentText);
    if (index >= 0) return `${source.slice(0, index)}${proposedText}${source.slice(index + currentText.length)}`;
    const lines = source.split(/\r?\n/);
    const matchingLineIndex = lines.findIndex((line) => line.includes(currentText.slice(0, 80)) || currentText.includes(line.trim()));
    if (matchingLineIndex >= 0) {
      lines[matchingLineIndex] = proposedText;
      return lines.join("\n");
    }
    return null;
  }, [output]);

  const focusCanvasBlock = React.useCallback((blockId: string) => {
    const target = document.querySelector<HTMLElement>(`[data-canvas-block-id="${blockId}"]`);
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    target?.focus({ preventScroll: true });
  }, []);

  const startCanvasBlockEdit = React.useCallback((block: ArticleBlock | undefined) => {
    if (!block?.id || !CANVAS_EDITABLE_BLOCK_TYPES.has(block.type)) {
      setCopilotStatusMessage("Sửa trên Canvas hiện chỉ hỗ trợ tiêu đề, đoạn văn và danh sách văn bản đơn giản.");
      return;
    }

    const fullText = getArticleBlockFullText(block);
    const blockIndex = articleDocument.blocks.findIndex((item) => item.id === block.id);
    setCanvasBlockEditState({
      blockId: block.id,
      blockType: block.type,
      blockIndex: blockIndex >= 0 ? blockIndex : articleDocument.blocks.length,
      originalText: fullText,
      value: fullText,
      title: canvasBlockEditLabel(block.type),
      undoStack: [],
      redoStack: [],
      error: null,
    });
    setPendingProposal(null);
    setCopilotStatusMessage("Đang sửa trực tiếp trên Canvas. Bấm Xong để cập nhật bản thảo, hoặc Hủy để khôi phục.");
    window.setTimeout(() => focusCanvasBlock(block.id), 0);
  }, [articleDocument.blocks, focusCanvasBlock]);

  const applyCanvasBlockEdit = React.useCallback(() => {
    if (!canvasBlockEditState) return;
    const latestBlock = articleDocument.blocks.find((block) => block.id === canvasBlockEditState.blockId);
    if (!latestBlock) {
      setCanvasBlockEditState((current) => current ? { ...current, error: "Không xác định được block cần cập nhật." } : current);
      return;
    }

    const latestText = getArticleBlockFullText(latestBlock);
    if (latestText.trim() !== canvasBlockEditState.originalText.trim()) {
      setCanvasBlockEditState((current) => current ? { ...current, error: "Nội dung gốc đã thay đổi. Hãy chọn lại block trước khi sửa." } : current);
      return;
    }

    const replacement = normalizeCanvasMultilineText(canvasBlockEditState.value);
    const isEmpty = replacement.trim().length === 0;
    const nextOutput = canvasBlockEditState.originalText.trim() ? replaceOutputText(canvasBlockEditState.originalText, replacement) : null;

    if (nextOutput === null && canvasBlockEditState.originalText.trim()) {
      setCanvasBlockEditState((current) => current ? { ...current, error: "Không tìm thấy nội dung gốc trong bản thảo để cập nhật an toàn." } : current);
      return;
    }

    const overrideBlock = blockWithTextOverride(latestBlock, replacement);
    const shouldKeepMultilineOverride = !isEmpty
      && latestBlock.type !== "bullet-list"
      && latestBlock.type !== "ordered-list"
      && normalizeCanvasMultilineText(overrideBlock.slots?.text).includes("\n");
    setCanvasBlockOverrides((current) => {
      const next = { ...current };
      if (isEmpty || !nextOutput || shouldKeepMultilineOverride) {
        next[canvasBlockEditState.blockId] = { block: overrideBlock, empty: isEmpty, index: canvasBlockEditState.blockIndex };
      } else {
        delete next[canvasBlockEditState.blockId];
      }
      return next;
    });

    if (nextOutput !== null) setOutput(nextOutput);
    setIsDraftDirty(true);
    setCurrentStep("draft");
    setWorkspaceMode("edit");
    setCanvasBlockEditState(null);
    setCopilotStatusMessage(isEmpty ? "Đã để trống block trong phiên Canvas. Placeholder không được ghi vào output/export." : "Đã cập nhật block trên Canvas. Nội dung chưa tự lưu cho đến khi bạn bấm Lưu.");
  }, [articleDocument.blocks, canvasBlockEditState, replaceOutputText, setOutput]);

  const cancelCanvasBlockEdit = React.useCallback(() => {
    setCanvasBlockEditState(null);
    setCopilotStatusMessage("Đã hủy sửa trên Canvas. Nội dung gốc không thay đổi.");
  }, []);

  const deleteCanvasBlock = React.useCallback(async () => {
    if (!canvasBlockEditState) return;
    const hasContent = canvasBlockEditState.originalText.trim().length > 0 || canvasBlockEditState.value.trim().length > 0;
    if (hasContent) {
      const confirmed = await requestConfirmAsync("Xóa block này khỏi bản thảo? Hành động này chưa tự lưu cho đến khi bạn bấm Lưu.");
      if (!confirmed) return;
    }

    const nextOutput = replaceOutputText(canvasBlockEditState.originalText, "");
    if (nextOutput === null) {
      setCanvasBlockEditState((current) => current ? { ...current, error: "Không tìm thấy block trong bản thảo để xóa an toàn." } : current);
      return;
    }

    setOutput(nextOutput);
    setIsDraftDirty(true);
    setCurrentStep("draft");
    setWorkspaceMode("edit");
    setCanvasBlockEditState(null);
    setCanvasBlockOverrides((current) => {
      const next = { ...current };
      delete next[canvasBlockEditState.blockId];
      return next;
    });
    setSelectedContextItems((items) => items.filter((item) => item.blockId !== canvasBlockEditState.blockId));
    setCopilotStatusMessage("Đã xóa block khỏi bản thảo. Nội dung chưa tự lưu cho đến khi bạn bấm Lưu.");
  }, [canvasBlockEditState, replaceOutputText, requestConfirmAsync, setOutput]);

  const pushCanvasEditValue = React.useCallback((nextValue: string | ((value: string) => string)) => {
    setCanvasBlockEditState((current) => {
      if (!current) return current;
      const value = typeof nextValue === "function" ? nextValue(current.value) : nextValue;
      if (value === current.value) return { ...current, error: null };
      return {
        ...current,
        value,
        undoStack: [...current.undoStack, current.value].slice(-40),
        redoStack: [],
        error: null,
      };
    });
  }, []);

  const applyCanvasParagraphFormat = React.useCallback(() => {
    pushCanvasEditValue(paragraphCanvasEditText);
  }, [pushCanvasEditValue]);

  const applyCanvasHeadingFormat = React.useCallback((level: 1 | 2 | 3) => {
    pushCanvasEditValue((value) => markdownHeading(value, level));
  }, [pushCanvasEditValue]);

  const applyCanvasInlineFormat = React.useCallback((marker: "**" | "_") => {
    pushCanvasEditValue((value) => wrapCanvasEditText(value, marker));
  }, [pushCanvasEditValue]);

  const applyCanvasBulletFormat = React.useCallback(() => {
    pushCanvasEditValue(bulletCanvasEditText);
  }, [pushCanvasEditValue]);

  const applyCanvasNumberedFormat = React.useCallback(() => {
    pushCanvasEditValue(numberedCanvasEditText);
  }, [pushCanvasEditValue]);

  const clearCanvasEditFormat = React.useCallback(() => {
    pushCanvasEditValue(clearCanvasEditFormatting);
  }, [pushCanvasEditValue]);

  const undoCanvasEdit = React.useCallback(() => {
    setCanvasBlockEditState((current) => {
      if (!current || current.undoStack.length === 0) return current;
      const previous = current.undoStack[current.undoStack.length - 1];
      return {
        ...current,
        value: previous,
        undoStack: current.undoStack.slice(0, -1),
        redoStack: [current.value, ...current.redoStack].slice(0, 40),
        error: null,
      };
    });
  }, []);

  const redoCanvasEdit = React.useCallback(() => {
    setCanvasBlockEditState((current) => {
      if (!current || current.redoStack.length === 0) return current;
      const nextValue = current.redoStack[0];
      return {
        ...current,
        value: nextValue,
        undoStack: [...current.undoStack, current.value].slice(-40),
        redoStack: current.redoStack.slice(1),
        error: null,
      };
    });
  }, []);

  const handleCanvasBlockOpen = React.useCallback((block: ArticleBlock, event: React.MouseEvent<HTMLElement>) => {
    const contextItem = buildContextFromBlock(block);
    if (!selectedContextItems.some((item) => item.id === contextItem.id)) {
      handleCanvasBlockSelect(block, event);
    }
    startCanvasBlockEdit(block);
  }, [handleCanvasBlockSelect, selectedContextItems, startCanvasBlockEdit]);

  const applyCaptionProposalToOutput = React.useCallback((proposal: Extract<EditorialProposal, { type: "add_caption" }>) => {
    const source = normalizeEditorialBriefContent(output || "");
    if (!source.trim() || !proposal.targetBlockId) return null;
    const targetBlockType = proposal.captionKind === "table" ? "table" : "figure-placeholder";
    const targetBlocks = articleDocument.blocks.filter((block) => block.type === targetBlockType);
    const targetIndex = targetBlocks.findIndex((block) => block.id === proposal.targetBlockId);
    if (targetIndex < 0) return null;

    const lines = source.split(/\r?\n/);
    if (proposal.captionKind === "table") {
      let tableIndex = -1;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index].trim();
        const previous = index > 0 ? lines[index - 1].trim() : "";
        const isTableLine = line.startsWith("|") && line.endsWith("|");
        const previousIsTableLine = previous.startsWith("|") && previous.endsWith("|");
        if (isTableLine && !previousIsTableLine) {
          tableIndex += 1;
          if (tableIndex === targetIndex) {
            const beforeTableIndex = Math.max(0, index - 1);
            if (/^Bảng\s*[:\d.：\-–—]/iu.test(lines[beforeTableIndex]?.trim() || "")) {
              lines[beforeTableIndex] = proposal.caption;
            } else {
              lines.splice(index, 0, proposal.caption);
            }
            return lines.join("\n");
          }
        }
      }
      return null;
    }

    let figureIndex = -1;
    const figurePattern = /(!\[[^\]]*\]\([^)]*\)|\bplaceholder\b|vị trí chèn|\[[^\]]*(?:ẢNH|ANH|HÌNH|PLACEHOLDER)[^\]]*\])/iu;
    for (let index = 0; index < lines.length; index += 1) {
      if (figurePattern.test(lines[index])) {
        figureIndex += 1;
        if (figureIndex === targetIndex) {
          const nextLine = lines[index + 1]?.trim() || "";
          if (/^(?:Hình|Ảnh|Chú thích ảnh|Caption)\s*[:.：\-–—]/iu.test(nextLine)) {
            lines[index + 1] = proposal.caption;
          } else {
            lines.splice(index + 1, 0, proposal.caption);
          }
          return lines.join("\n");
        }
      }
    }
    return null;
  }, [articleDocument.blocks, output]);

  const createProposal = React.useCallback((proposal: Omit<CopilotProposal, "id">) => {
    setPendingProposal({ ...proposal, id: `proposal-${Date.now()}` });
    setCopilotStatusMessage("Đề xuất đã sẵn sàng. Nội dung gốc chưa thay đổi cho đến khi bạn bấm Áp dụng.");
  }, []);

  const formatExecutionProposal = React.useCallback((result: EditorialExecutionResult): Omit<CopilotProposal, "id"> => {
    const proposal = result.proposal;
    if (!proposal) {
      return {
        commandId: result.commandId,
        title: result.ok ? "Kết quả Workflow Router" : "Workflow Router chưa hoàn tất",
        proposedText: result.error?.message || "Không có proposal để hiển thị.",
        canApply: false,
        executionResult: result,
      };
    }

    if (proposal.type === "replace_block") {
      const targetContext = selectedContextItems.find((item) => item.blockId === proposal.targetBlockId) || selectedBlockContext;
      const sanitizedText = sanitizeProposalReplacement(proposal.afterText, targetContext?.type);
      const isTargetScopedCommand = COPILOT_TARGET_SCOPED_COMMANDS.has(result.commandId as CopilotCommandId);
      const canApply = Boolean(
        result.ok &&
        !result.error &&
        proposal.targetBlockId &&
        proposal.beforeText?.trim() &&
        sanitizedText &&
        isSafeReplacementForTarget(sanitizedText, targetContext?.type) &&
        (!isTargetScopedCommand || proposal.targetBlockId === targetContext?.blockId),
      );
      return {
        commandId: result.commandId,
        title: result.ruleName || (canApply ? "Đề xuất thay thế block" : "Đề xuất tham khảo"),
        targetContextId: proposal.targetBlockId,
        currentText: proposal.beforeText,
        proposedText: sanitizedText || proposal.afterText,
        note: canApply ? proposal.reason : result.error?.message || "Chưa đủ điều kiện xác định target/replacement an toàn để áp dụng tự động.",
        canApply,
        executionResult: result,
      };
    }

    if (proposal.type === "add_caption") {
      const canApply = Boolean(result.ok && !result.error && proposal.targetBlockId && proposal.caption.trim());
      return {
        commandId: result.commandId,
        title: result.ruleName || (proposal.captionKind === "table" ? "Đề xuất caption bảng" : "Đề xuất caption hình"),
        targetContextId: proposal.targetBlockId,
        currentText: selectedBlockContext?.excerpt,
        proposedText: sanitizeProposalReplacement(proposal.caption),
        note: proposal.reason,
        canApply,
        executionResult: result,
      };
    }

    if (proposal.type === "insert_before" || proposal.type === "insert_after") {
      const sanitizedText = sanitizeProposalReplacement(proposal.text, selectedBlockContext?.type);
      const canApply = Boolean(result.ok && !result.error && proposal.targetBlockId && selectedBlockContext?.excerpt?.trim() && sanitizedText);
      return {
        commandId: result.commandId,
        title: proposal.type === "insert_before" ? "Đề xuất chèn trước block" : "Đề xuất chèn sau block",
        targetContextId: proposal.targetBlockId,
        currentText: selectedBlockContext?.excerpt,
        proposedText: sanitizedText || proposal.text,
        note: proposal.reason,
        canApply,
        executionResult: result,
      };
    }

    if (proposal.type === "checklist") {
      return {
        commandId: result.commandId,
        title: proposal.title,
        proposedText: proposal.items.map((item) => `- [${item.status}] ${item.label}${item.note ? `: ${item.note}` : ""}`).join("\n"),
        canApply: false,
        executionResult: result,
      };
    }

    if (proposal.type === "review_report") {
      return {
        commandId: result.commandId,
        title: proposal.title,
        proposedText: proposal.issues.map((issue) => `- ${issue.severity.toUpperCase()}: ${issue.message}${issue.suggestion ? `\n  Gợi ý: ${issue.suggestion}` : ""}`).join("\n"),
        canApply: false,
        executionResult: result,
      };
    }

    if (proposal.type === "message") {
      return {
        commandId: result.commandId,
        title: proposal.title,
        proposedText: proposal.message,
        canApply: false,
        executionResult: result,
      };
    }

    return {
      commandId: result.commandId,
      title: "Đề xuất Workflow Router",
      proposedText: "Proposal chưa được UI hỗ trợ trong PR này.",
      canApply: false,
      executionResult: result,
    };
  }, [selectedBlockContext, selectedContextItems]);

  const effectiveCopilotContexts = React.useCallback((): CopilotContextItem[] => {
    const draftText = normalizeEditorialBriefContent(output || "");
    if (selectedContextItems.length > 0) return selectedContextItems;
    return draftText
      ? [{ id: "draft:current", type: "draft", title: "Bản thảo hiện tại", excerpt: draftText.slice(0, 600) }]
      : [];
  }, [output, selectedContextItems]);

  const copilotKindOptions = React.useMemo(() => COPILOT_DRAFT_KIND_ORDER.map((value) => ({
    value,
    label: (EDITORIAL_KIND_CONFIG as Record<string, { label?: string }>)[value]?.label || value,
  })), []);

  const runProcessWithLayout = React.useCallback(async (layoutId?: string, layoutVersion?: string) => {
    setSelectedLayoutId(layoutId);
    setSelectedLayoutVersion(layoutVersion);
    setCurrentStep("generating");
    await handleProcess();
    setCurrentStep("draft");
    setIsDraftDirty(true);
    setLastSavedAt(null);
  }, [handleProcess]);

  const openCopilotDraftFlow = React.useCallback(() => {
    if (currentTool?.taskType !== "WRITE_NEW") {
      handleToolChange?.("draft_new");
      setTaskType?.("WRITE_NEW");
    }
    if (!COPILOT_DRAFT_KIND_ORDER.includes(editorialKind as any)) {
      setEditorialKind("website_article" as any);
    }
    setIsCopilotDraftFlowOpen(true);
    setIsCopilotSourceFlowOpen(false);
    setCopilotDraftFlowError(null);
    setCopilotViewMode("expanded");
    setWorkspaceMode("edit");
  }, [currentTool?.taskType, editorialKind, handleToolChange, setEditorialKind, setTaskType]);

  const copilotDraftFlowState = React.useMemo<CopilotDraftFlowState | null>(() => {
    if (!isCopilotDraftFlowOpen) return null;

    let templates: CopilotDraftFlowState["templates"] = undefined;
    if (input.trim() || copilotDraftExtraNotes.trim() || selectedSourceDocIds.length > 0 || copilotDraftTargetGroup) {
      const matchResult = matchEditorialTemplates({
        documentKind: editorialKind,
        userBrief: input,
        sourceSummary: copilotDraftExtraNotes,
        targetGroup: copilotDraftTargetGroup,
      });

      templates = matchResult.slice(0, 3).map((match) => {
        const template = getEditorialTemplateById(match.templateId);
        const groupLabel = template?.group === "administrative_document"
          ? "Hành chính"
          : template?.group === "review_improvement"
            ? "Rà soát"
            : "Truyền thông";
        return {
          id: match.templateId,
          name: template?.name || match.templateId,
          description: template?.description || "",
          score: match.score,
          groupLabel,
          reason: match.reasons?.[0] || template?.useCases?.[0] || "Phù hợp để dựng nhanh khung bản thảo.",
          missingInputs: match.missingInputs || [],
          previewLines: template?.miniPreviewBlocks?.slice(0, 5).map((block) => block.hint ? `${block.label}: ${block.hint}` : block.label)
            || template?.layoutBlocks?.slice(0, 5).map((block) => block.label)
            || ["Tiêu đề", "Sapo", "Mục chính", "Kết luận"],
          nonAiLabel: "Không dùng AI",
        };
      });
    }

    return {
      kind: editorialKind,
      kindOptions: copilotKindOptions,
      brief: input,
      extraNotes: copilotDraftExtraNotes,
      sourceSummary: selectedSourceDocIds.length > 0
        ? `Đang dùng ${selectedSourceDocIds.length} nguồn tư liệu đã chọn.`
        : "Chưa chọn nguồn tư liệu. Bạn vẫn có thể tạo bản thảo từ yêu cầu hiện tại.",
      error: copilotDraftFlowError,
      templates,
      selectedTemplateId: copilotDraftSelectedTemplateId,
      targetGroup: copilotDraftTargetGroup,
    };
  }, [copilotDraftExtraNotes, copilotDraftFlowError, copilotDraftSelectedTemplateId, copilotDraftTargetGroup, copilotKindOptions, editorialKind, input, isCopilotDraftFlowOpen, selectedSourceDocIds.length]);


  const copilotSourceFlowState = React.useMemo<CopilotSourceFlowState | null>(() => {
    if (!isCopilotSourceFlowOpen) return null;
    const selectedSources = Array.isArray(documents)
      ? documents
        .filter((document: any) => selectedSourceDocIds.includes(document.id))
        .slice(0, 3)
        .map((document: any) => ({
          id: document.id,
          title: document.name || document.title || "Nguồn tư liệu",
          excerpt: extractDocumentText(document).slice(0, 220),
        }))
      : [];
    return {
      sourceSummary: selectedSourceDocIds.length > 0
        ? `Đang chọn ${selectedSourceDocIds.length} nguồn tư liệu cho bản thảo.`
        : "Chưa chọn nguồn. Nguồn giúp AI bám căn cứ khi tạo hoặc chỉnh sửa bản thảo.",
      selectedSources,
      totalSelectedCount: selectedSourceDocIds.length,
    };
  }, [documents, isCopilotSourceFlowOpen, selectedSourceDocIds]);

  const updateCopilotDraftFlow = React.useCallback((patch: Partial<CopilotDraftFlowState>) => {
    if (typeof patch.kind === "string") setEditorialKind(patch.kind as any);
    if (typeof patch.brief === "string") setInput(patch.brief);
    if (typeof patch.extraNotes === "string") setCopilotDraftExtraNotes(patch.extraNotes);
    if (patch.selectedTemplateId !== undefined) setCopilotDraftSelectedTemplateId(patch.selectedTemplateId);
    if (patch.targetGroup) {
      setCopilotDraftTargetGroup(patch.targetGroup);
      if (patch.targetGroup === "administrative_document") setEditorialKind("official_letter" as any);
      if (patch.targetGroup === "communication_content") setEditorialKind("website_article" as any);
      setCopilotDraftSelectedTemplateId(null);
    }
    setCopilotDraftFlowError(null);
  }, [setEditorialKind, setInput]);

  const handleGenerateTemplateSkeleton = React.useCallback(async () => {
    if (!copilotDraftSelectedTemplateId) {
      setCopilotDraftFlowError("Vui lòng chọn một mẫu từ danh sách gợi ý.");
      return;
    }

    setIsCopilotBusy(true);
    setCopilotDraftFlowError(null);
    try {
      const draft = buildEditorialTemplateDraft({
        templateId: copilotDraftSelectedTemplateId,
        userBrief: input,
        sourceSummary: copilotDraftExtraNotes,
        providedInputs: {},
      });

      const lines: string[] = [];
      for (const block of draft.blocks) {
        const bType = block.type as string;
        const value = block.content || block.placeholder || block.contentHint || block.label;
        if (bType === "title") {
          lines.push(`# ${value}`);
        } else if (bType === "lead" || bType === "sapo") {
          lines.push(value);
        } else if (bType === "metadata") {
          lines.push(`## ${block.label}`);
          lines.push(value);
        } else if (bType === "section" || bType === "section_heading" || bType === "heading") {
          lines.push(`## ${block.label}`);
          if (value !== block.label) lines.push(value);
        } else if (bType === "list" || bType === "checklist") {
          lines.push(`## ${block.label}`);
          const listItems = value.split(/\n+/u).map((item) => item.trim()).filter(Boolean);
          lines.push(...(listItems.length > 0 ? listItems.map((item) => `- ${item.replace(/^-\s*/u, "")}`) : [`- ${block.label}`]));
        } else if (bType === "table") {
          lines.push(`## ${block.label}`);
          lines.push("| Nội dung | Ghi chú |");
          lines.push("|---|---|");
          lines.push(`| ${value} | [Cần ghi nguồn] |`);
        } else if (bType === "figure" || bType === "figure_placeholder") {
          lines.push(`Vị trí chèn hình minh họa: ${value}`);
          lines.push("Chú thích hình: [Cần bổ sung chú thích ảnh]");
          lines.push("Nguồn hình: [Cần bổ sung nguồn hình]");
        } else if (bType === "quote") {
          lines.push(`> ${value}`);
        } else if (bType === "source_note") {
          lines.push(`Nguồn: ${value}`);
        } else if (bType === "signature") {
          lines.push(`${block.label}: ${value}`);
        } else {
          lines.push(value);
        }
        lines.push("");
      }

      const generatedDraft = lines.join("\n").trim();
      setOutput(generatedDraft);
      
      const targetLayoutId = getDefaultArticleLayout().layoutId;
      const targetLayoutVersion = getDefaultArticleLayout().layoutVersion;
      
      setSelectedLayoutId(targetLayoutId);
      setSelectedLayoutVersion(targetLayoutVersion);
      setCurrentStep("draft");
      setIsDraftDirty(true);
      setLastSavedAt(null);
      
      setIsCopilotDraftFlowOpen(false);
      setIsCopilotSourceFlowOpen(false);
      setIsBriefPanelOpen(false);
      setCopilotDraftExtraNotes("");
      setCopilotDraftTargetGroup(undefined);
      setWorkspaceMode("edit");
      setPreflightUiStatus("idle");
      setLastPreflightDraftSignature(null);
      setCopilotStatusMessage("Bản thảo đã được tạo. Bạn có thể rà soát trước khi lưu hoặc xuất.");
    } catch (err: any) {
      setCopilotDraftFlowError(err.message || "Không thể tạo dàn ý từ mẫu đã chọn.");
    } finally {
      setIsCopilotBusy(false);
    }
  }, [copilotDraftSelectedTemplateId, input, copilotDraftExtraNotes, setOutput]);

  const submitCopilotDraftFlow = React.useCallback(async () => {
    const brief = normalizeEditorialBriefInput(input);
    const extraNotes = normalizeEditorialBriefInput(copilotDraftExtraNotes);
    if (!brief) {
      setCopilotDraftFlowError("Vui lòng nhập yêu cầu hoặc bối cảnh để tạo bản thảo.");
      return;
    }
    const mergedBrief = [brief, extraNotes ? `Ý chính / nguồn bổ sung:\n${extraNotes}` : ""].filter(Boolean).join("\n\n");
    if (mergedBrief !== input) setInput(mergedBrief);
    setCopilotDraftFlowError(null);
    setIsCopilotBusy(true);
    try {
      await runProcessWithLayout(getDefaultArticleLayout().layoutId, getDefaultArticleLayout().layoutVersion);
      setIsCopilotDraftFlowOpen(false);
      setIsCopilotSourceFlowOpen(false);
      setIsBriefPanelOpen(false);
      setCopilotDraftExtraNotes("");
      setCopilotDraftTargetGroup(undefined);
      setWorkspaceMode("edit");
      setPreflightUiStatus("idle");
      setLastPreflightDraftSignature(null);
      setCopilotStatusMessage("Bản thảo đã được tạo. Bạn có thể rà soát trước khi lưu hoặc xuất.");
    } finally {
      setIsCopilotBusy(false);
    }
  }, [copilotDraftExtraNotes, input, runProcessWithLayout, setInput]);

  const openCopilotReviewFlow = React.useCallback(() => {
    setActiveCommandId("review_current_draft");
    setIsCopilotDraftFlowOpen(false);
    setIsCopilotSourceFlowOpen(false);
    setCopilotViewMode("expanded");
    setCopilotStatusMessage(output?.trim()
      ? "Bạn có thể rà soát bản thảo hiện tại trong Copilot. Đề xuất sẽ cần Apply/Cancel rõ ràng."
      : "Chưa có bản thảo. Hãy dán nội dung vào Copilot hoặc tạo bản thảo trước khi rà soát.");
  }, [output]);

  const openCopilotSourceFlow = React.useCallback(() => {
    setActiveCommandId("add_source");
    setIsCopilotDraftFlowOpen(false);
    setIsCopilotSourceFlowOpen(true);
    setCopilotViewMode("expanded");
    setCopilotStatusMessage("Chọn cách thêm nguồn trong Copilot. Canvas chưa thay đổi cho đến khi bạn bấm Mở vùng nguồn.");
  }, []);

  const openSourceWorkspaceFromCopilot = React.useCallback((tab?: "library" | "text" | "link" | "upload") => {
    if (tab) setSourceActiveTab(tab as any);
    switchWorkspaceMode("sources");
    setCopilotStatusMessage("Đã mở vùng nguồn tư liệu. Nguồn đã chọn sẽ được gắn với bản thảo hiện tại.");
  }, [setSourceActiveTab, switchWorkspaceMode]);


  const handleRunCopilotCommand = React.useCallback(async (rawCommandId: string, promptOverride?: string) => {
    const commandId = rawCommandId as CopilotCommandId;
    const commandPrompt = normalizeEditorialBriefInput(promptOverride || copilotInput);
    const draftText = normalizeEditorialBriefContent(output || "");
    setActiveCommandId(commandId);

    if (commandId === "draft_new") {
      openCopilotDraftFlow();
      setCopilotStatusMessage("Luồng soạn văn bản mới đã mở trong Copilot.");
      return;
    }
    if (commandId === "manual_edit") {
      if (selectedContextItems.length !== 1 || !selectedBlock) {
        setCopilotStatusMessage("Chỉ có thể sửa trực tiếp từng block. Hãy chọn một block văn bản trên Canvas.");
        return;
      }
      if (!CANVAS_EDITABLE_BLOCK_TYPES.has(selectedBlock.type)) {
        setCopilotStatusMessage("Block này chưa hỗ trợ sửa trực tiếp.");
        return;
      }
      startCanvasBlockEdit(selectedBlock);
      return;
    }
    if (commandId === "review_current_draft") {
      runUserRequestedPreflight("copilot");
      return;
    }
    if (commandId === "add_source") {
      openCopilotSourceFlow();
      return;
    }
    if (commandId === "open_history") {
      switchWorkspaceMode("history");
      setCopilotStatusMessage("Đã mở lịch sử văn bản. Bản thảo hiện tại không thay đổi.");
      return;
    }
    if (commandId === "choose_template") {
      openCopilotDraftFlow();
      setCopilotStatusMessage("Chọn loại văn bản trong Copilot để bắt đầu từ mẫu phù hợp.");
      return;
    }
    if (commandId.startsWith("placeholder:")) {
      setCopilotStatusMessage("Chức năng này sẽ hoàn thiện ở bước sau.");
      return;
    }

    const draftRequiredCommands: CopilotCommandId[] = [
      "review_current_draft",
      "suggest_title_sapo",
      "check_missing_source_or_caption",
      "remove_bad_technical_markers",
      "check_long_paragraph",
      "normalize_basic_heading",
    ];
    const contextRequiredCommands: CopilotCommandId[] = [
      "rewrite_selection",
      "shorten_selection",
      "fix_selection",
      "strengthen_argument",
      "create_caption",
      "normalize_caption_title",
      "normalize_table",
      "check_table_numbers",
      "figure_caption",
      "table_to_analysis",
      "suggest_figure",
      "describe_figure",
      "check_figure_position",
      "explain_preflight_issue",
      "fix_preflight_issue",
      "find_similar_issue",
      "ignore_preflight_issue",
    ];
    const sourceRequiredCommands: CopilotCommandId[] = [
      "summarize_selected_source",
      "use_source_to_update_draft",
      "attach_source_to_draft",
      "compare_source_with_draft",
    ];

    if (commandId === "more" && !commandPrompt) {
      setCopilotStatusMessage("Nhập yêu cầu cụ thể trước khi dùng lệnh Khác.");
      return;
    }
    if (draftRequiredCommands.includes(commandId) && !draftText.trim()) {
      setCopilotStatusMessage("Chưa có bản thảo để rà soát.");
      return;
    }
    if (contextRequiredCommands.includes(commandId) && selectedContextItems.length === 0) {
      setCopilotStatusMessage("Hãy chọn nội dung trên Canvas trước.");
      return;
    }
    if (sourceRequiredCommands.includes(commandId) && !selectedContextItems.some((item) => item.type === "source")) {
      setCopilotStatusMessage("Hãy chọn ít nhất một nguồn tư liệu trước khi dùng lệnh này.");
      openCopilotSourceFlow();
      return;
    }

    setIsCopilotBusy(true);
    setCopilotStatusMessage(null);
    try {
      const contexts = effectiveCopilotContexts();
      const result = await executeEditorialWorkflowCommand({
        commandId,
        prompt: commandId === "more" ? commandPrompt : undefined,
        contexts,
        selectedBlock,
        articleDocument,
        draftText,
        outputFormat,
        getAuthToken: async () => user ? user.getIdToken() : undefined,
        runAi: async (content, token) => {
          const response = await processTask("EDITORIAL_POLITICAL", content, "EDITORIAL", outputFormat, [], token);
          return normalizeEditorialBriefContent(typeof response === "string" ? response : response?.text || "");
        },
      });

      createProposal(formatExecutionProposal(result));
      const telemetry = getEditorialWorkflowTelemetry(result, contexts, false);
      console.info("[editorial-workflow-router] command telemetry", telemetry);
      if (!result.ok && result.error?.message) {
        setCopilotStatusMessage(result.error.message);
      }
    } catch (err: any) {
      const message = err?.message || "Không chạy được Editorial Workflow Router.";
      setCopilotStatusMessage(message);
      notifyError("proposal-status", message);
    } finally {
      setIsCopilotBusy(false);
    }
  }, [articleDocument, copilotInput, createProposal, effectiveCopilotContexts, formatExecutionProposal, notifyError, openCopilotDraftFlow, openCopilotSourceFlow, output, outputFormat, runUserRequestedPreflight, selectedBlock, selectedContextItems, startCanvasBlockEdit, switchWorkspaceMode, user]);

  const handleApplyCopilotProposal = React.useCallback(() => {
    if (!pendingProposal) return;
    const executionProposal = pendingProposal.executionResult?.proposal;
    if (!pendingProposal.canApply || !executionProposal || pendingProposal.executionResult?.error) {
      setCopilotStatusMessage("Đề xuất này là kết quả tham khảo nên không áp dụng trực tiếp vào bản thảo.");
      return;
    }

    let nextOutput: string | null = null;
    if (executionProposal.type === "add_caption") {
      if (!executionProposal.targetBlockId || !pendingProposal.proposedText.trim()) {
        setCopilotStatusMessage("Không đủ target/caption an toàn để áp dụng tự động.");
        return;
      }
      nextOutput = applyCaptionProposalToOutput({ ...executionProposal, caption: pendingProposal.proposedText });
      if (!nextOutput) {
        const currentText = pendingProposal.currentText || selectedBlockContext?.excerpt || "";
        nextOutput = replaceOutputText(currentText, `${currentText}
${pendingProposal.proposedText}`);
      }
    } else if (executionProposal.type === "replace_block") {
      const targetContext = selectedContextItems.find((item) => item.blockId === executionProposal.targetBlockId) || selectedBlockContext;
      const replacement = sanitizeProposalReplacement(pendingProposal.proposedText, targetContext?.type);
      const isTargetScopedCommand = COPILOT_TARGET_SCOPED_COMMANDS.has(pendingProposal.commandId as CopilotCommandId);
      if (
        !executionProposal.targetBlockId ||
        !executionProposal.beforeText?.trim() ||
        !replacement ||
        !isSafeReplacementForTarget(replacement, targetContext?.type) ||
        (isTargetScopedCommand && executionProposal.targetBlockId !== targetContext?.blockId)
      ) {
        setCopilotStatusMessage("Đề xuất thiếu target/replacement an toàn nên không thể Apply tự động.");
        return;
      }
      nextOutput = replaceOutputText(executionProposal.beforeText, replacement);
    } else if (executionProposal.type === "insert_before" || executionProposal.type === "insert_after") {
      if (!executionProposal.targetBlockId || !pendingProposal.proposedText.trim()) {
        setCopilotStatusMessage("Không đủ target/nội dung an toàn để chèn tự động.");
        return;
      }
      const currentText = pendingProposal.currentText || selectedBlockContext?.excerpt || "";
      const replacement = executionProposal.type === "insert_before"
        ? `${pendingProposal.proposedText}
${currentText}`
        : `${currentText}
${pendingProposal.proposedText}`;
      nextOutput = replaceOutputText(currentText, replacement);
    }

    if (!nextOutput) {
      setCopilotStatusMessage("Không tìm được đúng vị trí trong bản thảo để áp dụng tự động. Vui lòng copy đề xuất hoặc sửa trực tiếp block trên Canvas.");
      return;
    }
    setOutput(nextOutput);
    setIsDraftDirty(true);
    setPendingProposal(null);
    setCurrentStep("draft");
    setWorkspaceMode("edit");
    if (pendingProposal.executionResult) {
      console.info("[editorial-workflow-router] apply telemetry", getEditorialWorkflowTelemetry(pendingProposal.executionResult, selectedContextItems, true));
    }
    notifySuccess("proposal-status", "Đã áp dụng đề xuất vào bản thảo. Hãy kiểm tra lại trên Canvas trước khi lưu.");
  }, [applyCaptionProposalToOutput, notifySuccess, pendingProposal, replaceOutputText, selectedBlockContext, selectedContextItems, setOutput]);

  const handleSubmitCopilotPrompt = React.useCallback(async () => {
    const prompt = normalizeEditorialBriefInput(copilotInput);
    if (!prompt) return;
    await handleRunCopilotCommand("more", prompt);
    setCopilotInput("");
  }, [copilotInput, handleRunCopilotCommand]);


  const handleExportArticle = React.useCallback(async (format: "pdf" | "docx" | "html") => {
    if (exportingFormat) return;
    closeAllHeaderMenus();
    setExportingFormat(format);

    try {
      if (!(await validateArticleBeforeExport())) return;

      if (format === "pdf") {
        let pdfValidationWarningCount = 0;
        toast("Đang tạo file PDF...", { id: "export-pdf-loading", icon: "ℹ️", duration: 3500 });
        const { exportPrintablePdfFromArticleExportModel } = await import("../../lib/printablePdfExport");
        await exportPrintablePdfFromArticleExportModel(articleExportModel, {
          title: articleExportModel.title || `Bai_viet_HTMB_${Date.now()}`,
          profile: "article",
          onValidationError: (msg) => notifyError("export-error", `Lỗi PDF: ${msg}`),
          onValidationWarning: () => {
            pdfValidationWarningCount += 1;
          },
        });
        if (pdfValidationWarningCount > 0) {
          notifyWarning("export-warning-summary", `Bản thảo còn ${pdfValidationWarningCount} cảnh báo khi tạo PDF. Xem Kiểm tra trước xuất bản để xử lý.`);
        }
        notifySuccess("export-pdf-success", "Tải PDF thành công!");
      }

      if (format === "docx") {
        const { exportWordFromArticleExportModel } = await import("../../lib/exportUtils");
        await exportWordFromArticleExportModel(articleExportModel, {
          title: articleExportModel.title || "Bài viết",
          filename: `Bai_viet_HTMB_${Date.now()}`,
          kind: editorialKind,
        });
        notifySuccess("export-word-success", "Tải Word thành công!");
      }

      if (format === "html") {
        const title = articleExportModel.title || articleDocument.metadata?.title || "Bài viết A4";
        downloadHtmlFile(buildArticleHtml(articleDocument, { title }), buildArticleHtmlFilename());
        notifySuccess("export-html-success", "Tải HTML A4 thành công!");
      }

      if (currentSessionId) {
        await logActivity({
          module: "editorial",
          action: "exported",
          entityType: "editorial_session",
          entityId: currentSessionId,
          entityTitle: sessions.find((session: any) => session.id === currentSessionId)?.title || "Bài viết",
          title: format === "pdf" ? "Xuất PDF văn bản" : format === "docx" ? "Xuất Word" : "Xuất HTML A4",
          summary: `Đã xuất bài viết ra định dạng ${format.toUpperCase()}.`,
          metadata: { exportFormat: format, source: "client" },
        });
      }
    } catch (err: any) {
      const message = err?.message || "Không xuất được file.";
      notifyError("export-error", message);
      setError(message);
    } finally {
      setExportingFormat(null);
    }
  }, [articleDocument, articleExportModel, closeAllHeaderMenus, currentSessionId, editorialKind, exportingFormat, logActivity, notifyError, notifySuccess, notifyWarning, sessions, setError, toast, validateArticleBeforeExport]);

  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);
  React.useEffect(() => {
    if (!aiCooldownUntil) {
      setCooldownRemaining(0);
      return;
    }
    const timer = setInterval(() => {
      const remaining = Math.ceil((aiCooldownUntil - Date.now()) / 1000);
      setCooldownRemaining(remaining > 0 ? remaining : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [aiCooldownUntil]);


  const buildRecommendationBrief = React.useCallback(() => {
    const sourceSummary = selectedSourceDocIds.length > 0
      ? `

Nguồn tư liệu đã chọn: ${selectedSourceDocIds.length} tài liệu.`
      : "";
    return `${normalizeEditorialBriefInput(input)}${sourceSummary}`.trim();
  }, [input, selectedSourceDocIds.length]);

  const openLayoutRecommendations = React.useCallback(() => {
    if (!normalizeEditorialBriefInput(input) && selectedSourceDocIds.length === 0) {
      toast.error("Vui lòng nhập nội dung hoặc chọn tài liệu nguồn trước khi xử lý.");
      return;
    }

    const brief = buildRecommendationBrief();
    const recommendations = recommendArticleLayoutsForBrief(brief);
    const invalidRecommendation = recommendations.find(
      (recommendation) => !getArticleLayout(recommendation.layout.layoutId, recommendation.layout.layoutVersion),
    );

    setRecommendationBrief(brief);
    setRecommendedLayouts(recommendations);
    setLayoutRecommendationError(
      invalidRecommendation
        ? `Layout ${invalidRecommendation.layout.layoutId}@${invalidRecommendation.layout.layoutVersion} không tồn tại trong registry.`
        : undefined,
    );
    setCurrentStep("recommendation");
  }, [buildRecommendationBrief, input, selectedSourceDocIds.length, toast]);


  const handleSelectRecommendedLayout = React.useCallback((recommendation: LayoutRecommendation) => {
    void runProcessWithLayout(recommendation.layout.layoutId, recommendation.layout.layoutVersion);
  }, [runProcessWithLayout]);

  const handleUseDefaultLayout = React.useCallback(() => {
    const defaultLayout = getDefaultArticleLayout();
    void runProcessWithLayout(defaultLayout.layoutId, defaultLayout.layoutVersion);
  }, [runProcessWithLayout]);

  const handleStartProcessing = React.useCallback(() => {
    if (currentTool?.taskType === "WRITE_NEW") {
      openLayoutRecommendations();
      return;
    }

    handleProcess();
  }, [currentTool?.taskType, handleProcess, openLayoutRecommendations]);

  React.useEffect(() => {
    if (workspaceMode === "create" && output?.trim()) {
      setWorkspaceMode("edit");
    }
  }, [output, workspaceMode]);

  const safeCleanDisplayTitle = React.useCallback((rawTitle?: string, session?: any) => {
    const derived = deriveEditorialSessionTitle({
      output: session?.currentOutput || session?.versions?.[0]?.content,
      currentTitle: rawTitle,
      latestPreview: session?.latestPreview,
      input: session?.input,
    });
    return typeof cleanDisplayTitle === "function" ? cleanDisplayTitle(derived) : derived;
  }, [cleanDisplayTitle]);

  const filteredSessions = React.useMemo(() => {
    const query = historySearchQuery.trim().toLowerCase();
    return (sessions || []).filter((session: any) => {
      if (!query) return true;
      return (
        safeCleanDisplayTitle(session.title, session).toLowerCase().includes(query) ||
        session.versions?.[0]?.content?.toLowerCase().includes(query) ||
        session.currentOutput?.toLowerCase().includes(query) ||
        session.latestPreview?.toLowerCase().includes(query)
      );
    });
  }, [historySearchQuery, safeCleanDisplayTitle, sessions]);

  const openSessionInEditor = React.useCallback(async (session: any) => {
    if (typeof loadSession === "function") {
      await loadSession(session);
    }
    setWorkspaceMode("edit");
  }, [loadSession]);

  const moduleMenuItems: Array<{
    id: EditorialWorkspaceMode;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "history", title: "Lịch sử văn bản", description: "Quản lý các bản thảo đã tạo.", icon: History },
    { id: "create", title: "Tạo văn bản mới", description: "Bắt đầu quy trình viết mới.", icon: FileText },
    { id: "edit", title: "Biên tập văn bản", description: "Soạn thảo, chỉnh sửa, AI edit, Preview.", icon: Edit3 },
    { id: "review", title: "Rà soát nội dung", description: "Kiểm tra chất lượng, lỗi chính tả, thuật ngữ.", icon: ClipboardCheck },
    { id: "summarize", title: "Tóm tắt – tổng hợp", description: "Tạo phiếu tóm tắt, tổng hợp tài liệu.", icon: FileStack },
    { id: "sources", title: "Nguồn tư liệu", description: "Quản lý kho tư liệu, web, file, link, văn bản.", icon: BookOpen },
  ];

  const workspaceTitles: Record<EditorialWorkspaceMode, { title: string; subtitle: string }> = {
    history: {
      title: "Lịch sử văn bản",
      subtitle: "Quản lý các bản thảo, phiên bản chỉnh sửa và nguồn tư liệu đã sử dụng.",
    },
    create: {
      title: "Tạo văn bản mới",
      subtitle: "Chọn loại văn bản, nhập yêu cầu và gắn nguồn tư liệu trong cùng một không gian biên tập.",
    },
    edit: {
      title: "Biên tập văn bản",
      subtitle: "Soạn thảo, chỉnh sửa, AI edit, Preview A4 và xuất bản thảo.",
    },
    review: {
      title: "Rà soát nội dung",
      subtitle: "Kiểm tra chất lượng văn bản, lỗi chính tả, thuật ngữ và rủi ro nội dung.",
    },
    summarize: {
      title: "Tóm tắt – tổng hợp",
      subtitle: "Tạo phiếu tóm tắt hoặc tài liệu tổng hợp từ nguồn tư liệu đã chọn.",
    },
    sources: {
      title: "Nguồn tư liệu",
      subtitle: "Quản lý kho tư liệu, tra cứu web, dán văn bản, thêm liên kết và tải tệp lên.",
    },
  };

  const sourceTabs = [
    { id: "library", label: "Kho tư liệu", icon: Plus },
    { id: "web", label: "Tra cứu web", icon: Globe },
    { id: "text", label: "Dán văn bản", icon: Type },
    { id: "link", label: "Thêm liên kết", icon: LinkIcon },
    { id: "upload", label: "Tải tệp lên", icon: FileUp },
  ];


  const groupedTemplates = [
    { title: "Truyền thông", kinds: ["website_article", "news", "press_release"] },
    { title: "Hành chính", kinds: ["official_letter", "announcement", "administrative_report", "plan", "meeting_minutes"] },
    { title: "Xử lý nhanh", kinds: ["speech_outline", "briefing_note", "summary_note"] },
  ] as const;

  const renderWorkspaceHeader = () => {
    const documentTitle = !hasGeneratedDraft
      ? "Trợ lý biên tập"
      : articleDocument.metadata?.title?.trim() && articleDocument.metadata.title !== "Bài viết chưa có tiêu đề"
        ? articleDocument.metadata.title
        : "Bài viết chưa đặt tiêu đề";
    return (
      <div className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#002D56]">Intelligent Canvas Assistant</p>
            <h1 className="mt-1 truncate text-lg font-black text-slate-950 sm:text-xl">{documentTitle}</h1>
            <p className={cn("mt-1 text-xs font-bold", !hasGeneratedDraft ? "text-slate-500" : isDraftDirty ? "text-amber-700" : "text-emerald-700")}>{draftSaveLabel}</p>
          </div>
          <div ref={headerMenuRef} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { closeAllHeaderMenus(); void handleSaveDraft(); }}
              disabled={isSavingDraft || !hasGeneratedDraft}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#002D56] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveHeaderMenu((menu) => menu === "export" ? null : "export")}
                disabled={!hasGeneratedDraft || Boolean(exportingFormat)}
                aria-haspopup="menu"
                aria-expanded={activeHeaderMenu === "export"}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportingFormat ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Xuất
              </button>
              {activeHeaderMenu === "export" && (
                <div role="menu" className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <button type="button" role="menuitem" onClick={() => void handleExportArticle("docx")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"><FileText className="h-4 w-4" /> Word</button>
                  <button type="button" role="menuitem" onClick={() => void handleExportArticle("pdf")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"><FileDown className="h-4 w-4" /> PDF</button>
                  <button type="button" role="menuitem" onClick={() => void handleExportArticle("html")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50"><Globe className="h-4 w-4" /> HTML A4</button>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveHeaderMenu((menu) => menu === "more" ? null : "more")}
                className="inline-flex min-h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label="Thao tác phụ"
                aria-haspopup="menu"
                aria-expanded={activeHeaderMenu === "more"}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {activeHeaderMenu === "more" && (
                <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  <button type="button" role="menuitem" onClick={() => { closeAllHeaderMenus(); switchWorkspaceMode("history"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><History className="h-4 w-4" /> Lịch sử văn bản</button>
                  <button type="button" role="menuitem" onClick={() => { closeAllHeaderMenus(); openCopilotSourceFlow(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><BookOpen className="h-4 w-4" /> Thêm nguồn bằng Copilot</button>
                  <button type="button" role="menuitem" onClick={() => { closeAllHeaderMenus(); openCopilotDraftFlow(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileStack className="h-4 w-4" /> Soạn bằng Copilot</button>
                  {!hasGeneratedDraft && (
                    <button type="button" role="menuitem" onClick={() => { closeAllHeaderMenus(); setIsBriefPanelOpen(true); setWorkspaceMode("edit"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"><Edit3 className="h-4 w-4" /> Tùy chọn nâng cao</button>
                  )}
                  <button type="button" role="menuitem" onClick={() => { closeAllHeaderMenus(); setCopilotStatusMessage("Cài đặt xuất bản chi tiết sẽ được mở ở PR tiếp theo; Preflight và export hiện vẫn giữ nguyên."); setCopilotViewMode("expanded"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" /> Cài đặt xuất bản</button>
                  <button type="button" role="menuitem" onClick={() => { closeAllHeaderMenus(); clearLocalDraft(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Xóa bản nháp</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoryMode = () => (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm kiếm văn bản, nội dung hoặc phiên bản..."
            value={historySearchQuery}
            onChange={(event) => setHistorySearchQuery?.(event.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium focus:ring-2 focus:ring-[#002D56]/20 focus:border-[#002D56]/30 transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-slate-500">
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1.5">Tất cả văn bản</span>
          <span className="rounded-full bg-slate-100 text-slate-600 px-3 py-1.5">{filteredSessions.length} bản thảo</span>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="min-h-[360px] bg-white border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center px-6 py-12">
          <History className="w-16 h-16 text-slate-200 mb-5" />
          <h2 className="text-lg font-bold text-slate-700">Chưa có văn bản phù hợp</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md">Tạo văn bản mới hoặc điều chỉnh từ khóa tìm kiếm để xem lại bản thảo đã lưu.</p>
          <button
            onClick={openCopilotDraftFlow}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#002D56] px-4 py-3 text-[13px] font-semibold text-white hover:bg-slate-900 transition-colors"
          >
            <Plus className="w-4 h-4" /> Tạo văn bản mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filteredSessions.map((session: any, idx: number) => (
            <article
              key={`editorial-history-${session.id || idx}`}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-[#002D56] hover:shadow-md transition-all group flex flex-col min-h-[220px]"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                  {session.taskType === "WRITE_NEW" ? "Viết mới" : "Biên tập"}
                </span>
                <span className="text-[12px] text-slate-500 font-medium flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString("vi-VN") : "Chưa lưu"}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-[#002D56] transition-colors">
                {safeCleanDisplayTitle(session.title, session)}
              </h2>
              <div className="flex flex-wrap gap-2 mt-5 mb-5">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <Clock className="w-3.5 h-3.5" /> {session.versions?.length ? `${session.versions.length} phiên bản` : "Đã lưu phiên bản"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                  <Files className="w-3.5 h-3.5" /> {(session.documentIds || []).length} nguồn
                </span>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 mt-auto">
                <button
                  onClick={() => void openSessionInEditor(session)}
                  className="flex-1 bg-white text-[#002D56] border border-[#002D56] py-2.5 rounded-lg text-[13px] font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" /> Mở biên tập
                </button>
                <button
                  onClick={async (event) => {
                    event.stopPropagation();
                    const confirmed = await requestConfirmAsync?.("Bạn có chắc chắn muốn xóa bài viết này cùng toàn bộ lịch sử?");
                    if (!confirmed) return;
                    if (user) {
                      try {
                        await deleteDoc(doc(db, "users", user.uid, "sessions", session.id));
                        setSessions?.((prev: any[]) => prev.filter((item: any) => item.id !== session.id));
                        toast.success("Đã xóa bài viết.");
                        await logActivity?.({
                          module: "editorial",
                          action: "deleted",
                          entityType: "editorial_session",
                          entityId: session.id,
                          entityTitle: session.title,
                          title: "Xóa bài viết",
                          summary: `Đã xóa bài viết "${session.title}".`,
                          metadata: { source: "client" },
                        });
                      } catch (err) {
                        console.error("Delete session error:", err);
                        toast.error("Không thể xóa bài viết trên hệ thống.");
                      }
                    } else {
                      setSessions?.((prev: any[]) => prev.filter((item: any) => item.id !== session.id));
                    }
                  }}
                  className="px-3 py-2.5 rounded-lg text-slate-400 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100"
                  title="Xóa bài viết"
                  aria-label="Xóa bài viết"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  const renderCreateMode = () => (
    <div className="space-y-5">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#002D56]"><MessageCircle className="h-6 w-6" /></span>
        <h2 className="mt-4 text-xl font-black text-slate-950">Tạo văn bản mới trong Copilot</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-600">Canvas được giữ gọn để đọc và kiểm chứng. Chọn loại văn bản, nhập yêu cầu, ý chính và nguồn ngay trong Copilot; bản thảo chỉ xuất hiện ở Canvas sau khi bạn bấm Tạo bản thảo.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={openCopilotDraftFlow} className="inline-flex items-center gap-2 rounded-xl bg-[#002D56] px-4 py-2.5 text-sm font-black text-white hover:bg-slate-900"><Sparkles className="h-4 w-4" /> Mở Copilot để tạo bản thảo</button>
          <button type="button" onClick={() => setWorkspaceMode("edit")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><X className="h-4 w-4" /> Đóng</button>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600">
          Loại đang chọn: <strong>{(EDITORIAL_KIND_CONFIG as any)[editorialKind]?.label || editorialKind}</strong> · {selectedSourceDocIds.length} nguồn tư liệu đang chọn.
        </div>
      </section>
    </div>
  );

  const runToolFromWorkspace = React.useCallback((toolId: string, seedFromOutput = false) => {
    const tool = getEditorialTool(toolId as any);
    handleToolChange?.(toolId);
    setTaskType?.(tool.taskType);
    setOutputFormat?.(tool.outputFormat);
    if (seedFromOutput && output?.trim()) {
      setInput(output);
    }
    setWorkspaceMode("edit");
  }, [handleToolChange, output, setInput, setOutputFormat, setTaskType]);

  const renderPlaceholderMode = (kind: "review" | "summarize") => {
    const isReviewMode = kind === "review";
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8 min-h-[420px]">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-[#002D56] px-3 py-1.5 text-[12px] font-bold mb-5">
            {isReviewMode ? <ClipboardCheck className="w-4 h-4" /> : <FileStack className="w-4 h-4" />}
            {isReviewMode ? "Kiểm tra chất lượng văn bản" : "Tóm tắt – tổng hợp tài liệu"}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            {isReviewMode ? "Rà soát nội dung" : "Tóm tắt – tổng hợp"}
          </h2>
          <p className="text-sm leading-7 text-slate-600">
            {isReviewMode
              ? "Dùng bản thảo hiện tại để rà soát lỗi, thiếu ý, thuật ngữ và rủi ro dữ kiện; hoặc chuyển sang vùng biên tập để dán văn bản cần kiểm tra."
              : "Tạo phiếu tóm tắt hoặc tài liệu tổng hợp từ nguồn đang chọn. Nếu chưa có nguồn, hãy chọn nguồn tư liệu trước khi xử lý."}
          </p>
          {contentReview && isReviewMode && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm text-emerald-800">
              Đã có kết quả rà soát nội dung. Mở vùng biên tập để xem chi tiết và tiếp tục chỉnh sửa.
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {isReviewMode ? (
              <button
                onClick={() => runToolFromWorkspace("review_content", Boolean(output?.trim()))}
                className="rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-900"
              >
                {output?.trim() ? "Rà soát bản thảo hiện tại" : "Chọn văn bản để rà soát"}
              </button>
            ) : (
              <>
                <button onClick={() => runToolFromWorkspace("summary_card")} className="rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-900">Tạo phiếu tóm tắt</button>
                <button onClick={() => runToolFromWorkspace("summary_doc")} className="rounded-lg border border-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-[#002D56] hover:bg-blue-50">Tạo tài liệu tổng hợp</button>
                {selectedSourceDocIds.length === 0 && (
                  <button onClick={() => switchWorkspaceMode("sources")} className="rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-[#002D56] hover:text-[#002D56]">Chọn nguồn để tổng hợp</button>
                )}
              </>
            )}
            <button onClick={() => switchWorkspaceMode("history")} className="rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:border-[#002D56] hover:text-[#002D56]">Quay lại lịch sử</button>
          </div>
        </div>
      </div>
    );
  };

  const renderSourcesMode = () => (
    <div className="space-y-5">
      <section className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4 px-1">
          <Files className="w-5 h-5 text-[#002D56]" />
          <h2 className="text-[15px] font-bold text-slate-800">Nguồn tư liệu</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl mb-5">
          {sourceTabs.map((tab) => (
            <button
              key={`source-mode-tab-${tab.id}`}
              onClick={() => setSourceActiveTab(sourceActiveTab === tab.id ? null : (tab.id as any))}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap",
                sourceActiveTab === tab.id ? "bg-white text-[#002D56] shadow-sm ring-1 ring-[#002D56]/10" : "text-slate-500 hover:text-slate-700 hover:bg-white/60",
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 text-sm text-slate-600 space-y-4">
          {!sourceActiveTab && (
            <p>Chọn hoặc bổ sung nguồn ngay trong Trợ lý biên tập. Các nguồn được chọn sẽ đi cùng bản thảo hiện tại.</p>
          )}
          {sourceActiveTab === "library" && (
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Kho tư liệu</p>
              <button onClick={() => { setIsPickingFromLibrary(true); setSourceActiveTab(null); }} className="inline-flex items-center gap-2 rounded-lg bg-white border border-blue-200 px-4 py-2.5 text-[13px] font-bold text-blue-700 hover:bg-blue-50">
                <Plus className="w-4 h-4" /> Mở/chọn từ Kho tư liệu
              </button>
            </div>
          )}
          {sourceActiveTab === "web" && (
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Tra cứu web</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleWebSearch()} placeholder="Nhập nội dung cần tra cứu..." className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#002D56]/20" />
                <button onClick={handleWebSearch} disabled={isLoading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Tra cứu
                </button>
              </div>
              {searchResults?.length > 0 && (
                <div className="grid gap-2">
                  {searchResults.map((result: any, idx: number) => (
                    <button key={`source-mode-result-${idx}`} onClick={() => addSearchResultAsSource(result.title, result.content || result.snippet || "", result.url)} className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-[#002D56]">
                      <span className="block text-[13px] font-bold text-slate-800">{result.title}</span>
                      <span className="block text-[11px] text-slate-500 mt-1">{result.url ? getHostname(result.url) : "Nguồn web"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {sourceActiveTab === "text" && (
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Dán văn bản</p>
              <input value={newTextName} onChange={(event) => setNewTextName(event.target.value)} placeholder="Tên nguồn" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]" />
              <textarea value={newTextContent} onChange={(event) => setNewTextContent(event.target.value)} placeholder="Dán nội dung nguồn..." rows={6} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]" />
              <button onClick={handleAddText} className="rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white">Thêm văn bản làm nguồn</button>
            </div>
          )}
          {sourceActiveTab === "link" && (
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Thêm liên kết</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={newLinkUrl} onChange={(event) => setNewLinkUrl(event.target.value)} placeholder="https://..." className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px]" />
                <button onClick={handleAddLink} className="rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white">Thêm liên kết</button>
              </div>
            </div>
          )}
          {sourceActiveTab === "upload" && (
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Tải tệp lên</p>
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-4 text-[13px] font-bold text-slate-700 hover:border-[#002D56] hover:text-[#002D56]">
                <FileUp className="w-5 h-5" /> Chọn tệp để tải lên
              </button>
            </div>
          )}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-[12px] font-bold text-slate-700 mb-3">Nguồn đang chọn ({selectedSourceDocIds.length})</p>
            {selectedSourceDocIds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-[13px] text-slate-500">Chưa chọn nguồn tư liệu.</p>
            ) : (
              <div className="grid gap-2">
                {documents.filter((doc: any) => selectedSourceDocIds.includes(doc.id)).map((doc: any, idx: number) => (
                  <div key={getRenderKey("source-mode-selected", doc, idx)} className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white p-3">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-800">{doc.name}</p>
                      <p className="text-[11px] text-slate-500">{getDocTypeLabel(doc.type)} • {getSourceTypeLabel(doc.sourceType)}</p>
                    </div>
                    <button onClick={() => toggleDocSelection(doc.id)} title="Bỏ chọn nguồn" aria-label="Bỏ chọn nguồn" className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <button onClick={() => switchWorkspaceMode("edit")} className="inline-flex items-center gap-2 rounded-lg bg-[#002D56] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-900">
        <PanelRightOpen className="w-4 h-4" /> Quay lại biên tập văn bản
      </button>
    </div>
  );

  const renderEditMode = () => (
    <div className="grid grid-cols-1 gap-5 h-full">
      {!hasGeneratedDraft && (
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/60 to-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#002D56] px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-white"><Sparkles className="h-4 w-4" /> Trợ lý biên tập</span>
            <h2 className="mt-5 text-2xl font-black text-slate-950 sm:text-3xl">Bạn muốn làm gì với Trợ lý biên tập?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Nhập yêu cầu trong Copilot để tạo bản thảo, hoặc chọn nội dung trên Canvas để hỏi AI. Bắt đầu bằng Copilot, sau đó kiểm chứng trên Canvas.</p>
            <button type="button" onClick={openCopilotExpanded} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#002D56] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-900"><MessageCircle className="h-4 w-4" /> Mở Copilot</button>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold">
              <button type="button" onClick={openCopilotDraftFlow} className="text-[#002D56] underline-offset-4 hover:underline">Soạn văn bản mới</button>
              <button type="button" onClick={openCopilotSourceFlow} className="text-[#002D56] underline-offset-4 hover:underline">Thêm nguồn</button>
            </div>
            <button type="button" onClick={() => setIsBriefPanelOpen(true)} className="mt-4 text-[11px] font-semibold text-slate-400 underline-offset-4 hover:text-slate-600 hover:underline">Tùy chọn nâng cao</button>
          </div>
        </section>
      )}
                        {/* Workspace controls and sources */}
                        <aside className="hidden" aria-hidden="true">
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <h2 className="text-[14px] font-semibold text-slate-800">Chỉnh sửa bằng AI</h2>
                                <p className="text-[12px] text-slate-500 mt-1">Chọn nhanh công cụ biên tập mà không mở thêm cột phụ.</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {EDITORIAL_TOOLS.filter((tool) => tool.taskType !== "WRITE_NEW").map((tool) => (
                                  <button
                                    key={`editor-quick-tool-${tool.id}`}
                                    type="button"
                                    onClick={() => handleToolChange?.(tool.id)}
                                    className={cn(
                                      "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                                      selectedEditorialToolId === tool.id
                                        ? "border-[#002D56] bg-blue-50 text-[#002D56]"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-[#002D56] hover:text-[#002D56]",
                                    )}
                                  >
                                    {tool.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </section>

                          {/* Project Specific Sources */}
                          <section className="bg-white rounded-lg p-5 shadow-sm border border-slate-200">
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <Files className="w-5 h-5 text-[#002D56]" />
                              <h2 className="text-[14px] font-semibold text-slate-800">
                                Nguồn tư liệu
                              </h2>
                            </div>

                            {/* Tab Controls */}
                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg mb-4 overflow-x-auto custom-scrollbar">
                              {[
                                { id: "library", label: "Kho tư liệu", icon: Plus },
                                { id: "web", label: "Tra cứu web", icon: Globe },
                                { id: "text", label: "Dán văn bản", icon: Type },
                                { id: "link", label: "Thêm liên kết", icon: LinkIcon },
                                {
                                  id: "upload",
                                  label: "Tải tệp lên",
                                  icon: FileUp,
                                },
                              ].map((tab) => (
                                <button
                                  key={`editor-source-tab-${tab.id}`}
                                  onClick={() =>
                                    setSourceActiveTab(
                                      sourceActiveTab === tab.id
                                        ? null
                                        : (tab.id as any),
                                    )
                                  }
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap",
                                    sourceActiveTab === tab.id
                                      ? "bg-white text-[#002D56] shadow-sm"
                                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50",
                                  )}
                                >
                                  <tab.icon className="w-3.5 h-3.5" />
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            {/* Tab Forms */}
                            <AnimatePresence mode="wait">
                              {sourceActiveTab && (
                                <motion.div
                                  key={sourceActiveTab}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden mb-4"
                                >
                                  <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                                    {sourceActiveTab === "library" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Thư viện cá nhân
                                        </p>
                                        <button
                                          onClick={() => {
                                            setIsPickingFromLibrary(true);
                                            setSourceActiveTab(null);
                                          }}
                                          className="w-full py-3 bg-white border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                          <Plus className="w-4 h-4" /> Mở Kho tư
                                          liệu
                                        </button>
                                      </div>
                                    )}

                                    {sourceActiveTab === "web" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Tra cứu web AI
                                        </p>
                                        <div className="flex gap-2">
                                          <input
                                            autoFocus
                                            type="text"
                                            placeholder="VD: Quy định mớn nước luồng Lạch Huyện..."
                                            value={searchQuery}
                                            onChange={(e) =>
                                              setSearchQuery(e.target.value)
                                            }
                                            className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium"
                                            onKeyDown={(e) =>
                                              e.key === "Enter" &&
                                              handleWebSearch()
                                            }
                                          />
                                          <button
                                            onClick={handleWebSearch}
                                            disabled={isLoading}
                                            className="bg-[#002D56] text-white p-2 rounded-md hover:bg-slate-900 disabled:opacity-50"
                                          >
                                            {isLoading ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Search className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </div>

                                        {searchResults && (
                                          <div className="mt-4 space-y-3 max-h-[250px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed bg-blue-50 p-3 rounded-md border border-blue-100 italic">
                                              {searchResults.text.substring(
                                                0,
                                                200,
                                              )}
                                              ...
                                            </p>
                                            <div className="space-y-2">
                                              {searchResults.groundingMetadata?.groundingChunks?.map(
                                                (chunk: any, idx: number) => {
                                                  const title =
                                                    chunk.web?.title ||
                                                    `Nguồn ${idx + 1}`;
                                                  const uri = chunk.web?.uri;
                                                  return (
                                                    <div
                                                      key={`web-chunk-${idx}`}
                                                      className="group/res bg-white p-3 rounded-md border border-slate-100 hover:border-[#002D56] transition-all"
                                                    >
                                                      <div className="flex items-center gap-1.5 mb-1 opacity-60">
                                                        <Globe className="w-2.5 h-2.5" />
                                                        <span className="text-[8px] font-bold truncate">
                                                          {uri
                                                            ? getHostname(uri)
                                                            : "Nguồn Web"}
                                                        </span>
                                                      </div>
                                                      <h4 className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover/res:text-[#002D56]">
                                                        {title}
                                                      </h4>
                                                      <button
                                                        onClick={() =>
                                                          addSearchResultAsSource(
                                                            title,
                                                            `Nội dung từ tìm kiếm AI: ${title}`,
                                                            uri,
                                                          )
                                                        }
                                                        className="mt-2 text-[9px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                                                      >
                                                        <Plus className="w-3 h-3" />{" "}
                                                        Trích xuất làm tư liệu
                                                      </button>
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {sourceActiveTab === "text" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Nhập văn bản nguồn
                                        </p>
                                        <input
                                          type="text"
                                          placeholder="Tên nguồn (tùy chọn)..."
                                          value={newTextName}
                                          onChange={(e) =>
                                            setNewTextName(e.target.value)
                                          }
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium"
                                        />
                                        <textarea
                                          placeholder="Dán nội dung vào đây..."
                                          value={newTextContent}
                                          onChange={(e) =>
                                            setNewTextContent(e.target.value)
                                          }
                                          className="w-full h-32 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium resize-none shadow-inner"
                                        />

                                        <label className="flex items-center gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={saveToLibrary}
                                            onChange={(e) =>
                                              setSaveToLibrary(e.target.checked)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-[#002D56] focus:ring-[#002D56]"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#002D56] transition-colors">
                                              Lưu vào Kho tư liệu
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">
                                              Nếu không chọn, tài liệu sẽ mất
                                              khi tải lại trang.
                                            </span>
                                          </div>
                                        </label>

                                        <div className="flex gap-2">
                                          <button
                                            onClick={handleAddText}
                                            className="flex-1 bg-[#002D56] text-white py-2.5 rounded-lg text-xs font-bold hover:bg-slate-900 transition-all shadow-md"
                                          >
                                            Thêm nguồn
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {sourceActiveTab === "link" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Dán liên kết
                                        </p>
                                        <input
                                          autoFocus
                                          type="text"
                                          placeholder="https://..."
                                          value={newLinkUrl}
                                          onChange={(e) =>
                                            setNewLinkUrl(e.target.value)
                                          }
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#002D56] font-medium"
                                          onKeyDown={(e) =>
                                            e.key === "Enter" && handleAddLink()
                                          }
                                        />

                                        <label className="flex items-center gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={saveToLibrary}
                                            onChange={(e) =>
                                              setSaveToLibrary(e.target.checked)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-[#002D56] focus:ring-[#002D56]"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#002D56] transition-colors">
                                              Lưu vào Kho tư liệu
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">
                                              Lưu link và nội dung tóm tắt vào
                                              thư viện.
                                            </span>
                                          </div>
                                        </label>

                                        <button
                                          onClick={handleAddLink}
                                          disabled={isParsing}
                                          className="w-full bg-[#002D56] text-white py-2.5 rounded-lg text-xs font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                                        >
                                          {isParsing && (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          )}
                                          Kết nối & Trích xuất
                                        </button>
                                      </div>
                                    )}

                                    {sourceActiveTab === "upload" && (
                                      <div className="space-y-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                          Tải lên tệp
                                        </p>
                                        <div
                                          onClick={() =>
                                            fileInputRef.current?.click()
                                          }
                                          className="w-full py-8 border-2 border-dashed border-slate-200 rounded-lg bg-white hover:border-[#002D56] hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                                        >
                                          <div className="p-3 bg-slate-50 rounded-full">
                                            <FileUp className="w-6 h-6 text-slate-400" />
                                          </div>
                                          <div className="text-center">
                                            <p className="text-xs font-bold text-slate-700">
                                              Click để chọn tệp
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-1">
                                              Hỗ trợ PDF, Word, Ảnh (OCR)
                                            </p>
                                          </div>
                                        </div>

                                        <label className="flex items-center gap-2 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={saveToLibrary}
                                            onChange={(e) =>
                                              setSaveToLibrary(e.target.checked)
                                            }
                                            className="w-4 h-4 rounded border-slate-300 text-[#002D56] focus:ring-[#002D56]"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#002D56] transition-colors">
                                              Lưu vào Kho tư liệu
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-medium">
                                              Tệp sẽ được lưu vĩnh viễn trên hệ
                                              thống.
                                            </span>
                                          </div>
                                        </label>
                                      </div>
                                    )}


                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Active Sources List */}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
                              {selectedSourceDocIds.length === 0 ? (
                                <div className="py-8 text-center bg-slate-50 rounded-md border border-dashed border-slate-200 px-4">
                                  <Database className="w-10 h-10 text-slate-100 mx-auto mb-4" />
                                  <p className="text-[11px] text-slate-400 font-bold tracking-normal leading-relaxed">
                                    Chưa chọn tài liệu nguồn cho AI. <br /> Hãy
                                    chọn từ thư viện, dán link hoặc nhập văn
                                    bản.
                                  </p>
                                </div>
                              ) : (
                                documents
                                  .filter((d) =>
                                    selectedSourceDocIds.includes(d.id),
                                  )
                                  .map((doc, idx) => {
                                    const kind = doc.type === 'drive' ? (doc.driveMimeType?.includes('folder') ? 'drive_folder' : 'drive_file') : (doc.temporary ? 'temp' : 'document');
                                    return (
                                      <div
                                        key={getRenderKey("editor-doc", doc, idx)}
                                        className={cn(
                                          "flex items-center gap-3 p-3 rounded-md border transition-all shadow-sm",
                                          doc.temporary
                                            ? "bg-amber-50/30 border-amber-100"
                                            : "bg-white border-blue-100",
                                        )}
                                      >
                                        <div
                                          className={cn(
                                            "p-2 rounded-md shrink-0",
                                            doc.temporary
                                              ? "bg-amber-50 text-amber-600"
                                              : doc.type === "drive"
                                                ? "bg-slate-50 text-[#002D56]"
                                                : "bg-blue-50 text-blue-600",
                                          )}
                                        >
                                          {doc.driveIconUrl ? (
                                            <img
                                              src={doc.driveIconUrl}
                                              alt="icon"
                                              className="w-4 h-4 opacity-70"
                                              referrerPolicy="no-referrer"
                                            />
                                          ) : (
                                            <FileText className="w-4 h-4" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 overflow-hidden">
                                            <p className="text-[11px] font-semibold text-slate-700 truncate tracking-tight">
                                              {doc.name}
                                            </p>
                                            {doc.temporary && (
                                              <span className="shrink-0 text-[8px] bg-amber-100 text-amber-700 px-1 rounded font-bold uppercase">
                                                Tạm
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[9px] text-slate-400 font-bold tracking-normal truncate">
                                            {getDocTypeLabel(doc.type)} •{" "}
                                            {getSourceTypeLabel(doc.sourceType)}
                                          </p>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDocSelection(doc.id);
                                          }}
                                          className="p-1 text-slate-300 hover:text-red-500 rounded-md transition-colors"
                                          title="Bỏ chọn nguồn"
                                          aria-label="Bỏ chọn nguồn"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </section>
                        </aside>

                        {/* Main Editor Area */}
                        <div className="space-y-6 min-w-0">
                          {/* Input Area */}
                          {isBriefPanelOpen && !hasGeneratedDraft && (
                          <section className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 sm:p-2.5 bg-[#002D56] rounded-md shadow-sm shadow-[#002D56]/10">
                                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                </div>
                                <div className="">
                                  <span className="text-xs sm:text-sm font-semibold text-[#002D56] tracking-normal">
                                    Biểu mẫu nâng cao
                                  </span>
                                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">Copilot vẫn là luồng chính; biểu mẫu này chỉ dùng khi cần nhập chi tiết thủ công.</p>
                                  {selectedSourceDocIds.length > 0 && (
                                    <p className="text-[8px] sm:text-[10px] text-emerald-600 font-semibold flex items-center gap-1.5 mt-0.5 uppercase">
                                      <Database className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />{" "}
                                      {selectedSourceDocIds.length} tệp nguồn đã
                                      chọn
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3">
                                {isParsing && (
                                  <span className="text-[9px] font-semibold text-amber-600 animate-pulse flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 tracking-normal">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Đang đọc tệp...
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setIsBriefPanelOpen(false)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                                >
                                  Đóng biểu mẫu nâng cao
                                </button>
                                <button
                                  onClick={handleCreateNewArticle}
                                  className="text-slate-300 hover:text-red-500 p-2 sm:p-2.5 rounded-md transition-all hover:bg-red-50"
                                  title="Xóa dữ liệu bản thảo hiện tại"
                                  aria-label="Xóa dữ liệu bản thảo hiện tại"
                                >
                                  <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                              </div>
                            </div>
                            <div className="relative flex-1 flex flex-col min-h-[300px] bg-slate-50/50">
                              {currentTool?.taskType === "WRITE_NEW" && currentStep === "recommendation" ? (
                                <LayoutRecommendationPanel
                                  userBrief={recommendationBrief}
                                  recommendations={recommendedLayouts}
                                  isLoading={false}
                                  errorMessage={layoutRecommendationError}
                                  onSelectLayout={handleSelectRecommendedLayout}
                                  onUseDefaultLayout={handleUseDefaultLayout}
                                  onBackToBrief={() => setCurrentStep("brief")}
                                />
                              ) : currentTool?.taskType === "WRITE_NEW" ? (
                                <div className="p-6 sm:p-6 flex-1 w-full space-y-6">
                                  {currentTool.requiresDocumentKind && (
                                    <EditorialKindSelector
                                      value={editorialKind}
                                      onChange={setEditorialKind}
                                    />
                                  )}
                                  <EditorialInputForm
                                    kind={editorialKind}
                                    initialValue={input}
                                    onChange={(value) => {
                                      setInput(normalizeEditorialBriefInput(value));
                                      if (hasGeneratedDraft) markDraftDirty();
                                    }}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  value={normalizeEditorialBriefInput(input)}
                                  onChange={(e) => {
                                    setInput(normalizeEditorialBriefInput(e.target.value));
                                    if (hasGeneratedDraft) markDraftDirty();
                                  }}
                                  placeholder={currentTool?.inputPlaceholder || "Nhập thông tin..."}
                                  className="flex-1 w-full p-6 sm:p-6 pb-32 focus:outline-none resize-none text-slate-800 text-base sm:text-lg leading-relaxed placeholder:text-slate-400 placeholder:font-medium bg-transparent"
                                />
                              )}

                              {!(currentTool?.taskType === "WRITE_NEW" && currentStep === "recommendation") && (
                              <div className="absolute flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 bottom-0 right-0 w-full p-4 sm:p-6 pointer-events-none">
                                {!input.trim() &&
                                  selectedSourceDocIds.length === 0 && (
                                    <span className="text-[12px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 italic tracking-tight hidden sm:block">
                                      Nhập yêu cầu để bắt đầu
                                    </span>
                                  )}
                                <button
                                  disabled={
                                    isLoading ||
                                    isParsing ||
                                    isBuildingTasks ||
                                    cooldownRemaining > 0
                                  }
                                  onClick={
                                    handleStartProcessing
                                  }
                                  className={cn(
                                    "w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-md font-semibold text-[13px] tracking-normal transition-all duration-300 shadow-md active:scale-[0.98] pointer-events-auto shrink-0",
                                    isLoading ||
                                      isParsing ||
                                      isBuildingTasks ||
                                      cooldownRemaining > 0
                                      ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                                      : "bg-[#002D56] text-white hover:bg-slate-900 shadow-[#002D56]/30 hover:shadow-sm",
                                  )}
                                >
                                  {isLoading || isBuildingTasks ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Đang xử lý...
                                    </>
                                  ) : cooldownRemaining > 0 ? (
                                    <>
                                      ⏱ Thử lại sau {cooldownRemaining}s
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-4 h-4 fill-current" />
                                      Tạo từ biểu mẫu nâng cao
                                    </>
                                  )}
                                </button>
                              </div>
                              )}
                            </div>

                            <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-5">
                              <div className="flex items-start gap-3 w-full">
                                <div className="p-1.5 bg-blue-100 rounded-lg shrink-0 mt-0.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#002D56]" />
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                  Copilot sẽ tạo bản thảo từ yêu cầu của bạn. Canvas chỉ hiển thị bản thảo và kết quả để kiểm chứng.
                                </p>
                              </div>
                            </div>
                          </section>
                          )}


                          {/* Error Message */}
                          <AnimatePresence>
                            {error && (
                              <motion.div
                                key="error-alert"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-red-50 border border-red-200 text-red-600 p-5 rounded-md flex items-start gap-4 shadow-sm"
                              >
                                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm tracking-tight mb-1">
                                    Cảnh báo hệ thống
                                  </h4>
                                  <p className="text-sm font-medium opacity-80">
                                    {error}
                                  </p>
                                  {error && error.toLowerCase().includes("không khả dụng") && (
                                    <div className="mt-2 text-xs bg-red-100 text-red-800 p-2.5 rounded border border-red-200">
                                      Gợi ý: Cấu hình model chưa kích hoạt hoặc không khả dụng. Vào <strong>Cài đặt/Tài khoản → AI Models / API key</strong> để kiểm tra lại cấu hình.
                                    </div>
                                  )}
                                  {error && error.toLowerCase().includes("hạn mức") && (
                                    <div className="mt-2 text-xs bg-amber-50 text-amber-850 p-2.5 rounded border border-amber-250 leading-relaxed">
                                      Gợi ý: Đây là giới hạn của Gemini API free tier, không phải lỗi dữ liệu. Thử lại sau khi hết thời gian chờ, hoặc vào Cài đặt để sử dụng API key khác/nâng hạn mức.
                                      <div className="mt-2">
                                        <button 
                                          onClick={() => document.dispatchEvent(new CustomEvent('open-settings'))}
                                          className="text-amber-800 bg-amber-100/50 hover:bg-amber-200/50 border border-amber-300 px-3 py-1 rounded shadow-sm transition-all"
                                        >
                                          Mở Cài đặt API key/model
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Output / Results */}
                          <AnimatePresence>
                            {output && output.trim() && (
                              <motion.section
                                key="output-panel"
                                ref={outputRef}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden"
                              >
                                <div className="px-5 sm:px-8 py-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                                      <div className="flex flex-col">
                                        <span className="text-[10px] font-semibold text-slate-400 tracking-normal mb-0.5">
                                          {taskType === "WRITE_NEW" ? "Bản thảo văn bản" : (currentTool?.resultLabel || "Sản phẩm đầu ra")}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => {
                                              if (!selectedBlock) {
                                                setCopilotStatusMessage("Hãy chọn một block văn bản trên Canvas, sau đó bấm Sửa trên Canvas.");
                                                return;
                                              }
                                              startCanvasBlockEdit(selectedBlock);
                                            }}
                                            className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-white border border-slate-200 text-[#002D56] hover:bg-slate-50"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            Sửa trên Canvas
                                          </button>
                                          <button
                                            onClick={() => { closeAllHeaderMenus(); void handleSaveDraft(); }}
                                            disabled={isSavingDraft || !output?.trim()}
                                            className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-[#002D56] text-white hover:bg-slate-900 disabled:opacity-60 disabled:cursor-not-allowed"
                                          >
                                            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Lưu bản thảo
                                          </button>
                                          <span className={cn(
                                            "text-[10px] font-semibold px-2.5 py-1 rounded-md border",
                                            isDraftDirty
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : lastSavedAt
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-slate-50 text-slate-500 border-slate-200",
                                          )}>
                                            {draftSaveLabel}
                                          </span>
                                          {isDraftDirty && (
                                            <button
                                              onClick={() => clearLocalDraft(true)}
                                              className="text-[10px] font-semibold px-3 py-1.5 rounded-md transition-all flex items-center gap-2 tracking-tight bg-white border border-red-100 text-red-600 hover:bg-red-50"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              Xóa bản nháp
                                            </button>
                                          )}
                                          {currentSessionId &&
                                            sessions.find(
                                              (s) => s.id === currentSessionId,
                                            )?.versions?.length! > 1 && (
                                              <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400 tracking-wide bg-white px-2 py-1 rounded-lg border border-slate-100">
                                                <History className="w-3 h-3" />
                                                {
                                                  sessions.find(
                                                    (s) =>
                                                      s.id === currentSessionId,
                                                  )?.versions?.length || 0
                                                }{" "}
                                                phiên bản
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={handleCopy}
                                        className={cn(
                                          "p-2.5 rounded-md transition-all shadow-sm active:scale-90 border",
                                          copySuccess
                                            ? "bg-emerald-600 text-white border-emerald-500"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                                        )}
                                        title="Sao chép" aria-label="Sao chép"
                                      >
                                        {copySuccess ? (
                                          <Check className="w-4 h-4" />
                                        ) : (
                                          <Copy className="w-4 h-4" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  {taskType === "WRITE_NEW" && (
                                    <EditorialPreflightPanel
                                      kind={editorialKind}
                                      markdownContent={output}
                                      articleDocument={articleDocument}
                                      issues={visiblePreflightIssues}
                                      hasDraft={hasGeneratedDraft}
                                      reviewStatus={preflightUiStatus}
                                      onRequestReview={() => runUserRequestedPreflight("button")}
                                    />
                                  )}

                                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-[11px] text-slate-600">
                                    <span className="px-1 font-bold uppercase tracking-[0.16em] text-slate-500">Xuất nhanh</span>
                                    {currentTool?.allowPdfExport !== false && (
                                      <button
                                        type="button"
                                        onClick={() => void handleExportArticle("pdf")}
                                        disabled={Boolean(exportingFormat)}
                                        aria-disabled={Boolean(exportingFormat)}
                                        className={cn(
                                          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50",
                                        )}
                                        title="Kiểm tra trước xuất và tải PDF văn bản"
                                      >
                                        {exportingFormat === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                                        PDF
                                      </button>
                                    )}
                                    {currentTool?.allowWordExport !== false && (
                                      <button
                                        type="button"
                                        onClick={() => void handleExportArticle("docx")}
                                        disabled={Boolean(exportingFormat)}
                                        aria-disabled={Boolean(exportingFormat)}
                                        className={cn(
                                          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50",
                                        )}
                                        title="Kiểm tra trước xuất và tải Word (DOCX)"
                                      >
                                        {exportingFormat === "docx" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                                        Word
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void handleExportArticle("html")}
                                      disabled={Boolean(exportingFormat)}
                                      aria-disabled={Boolean(exportingFormat)}
                                      className={cn(
                                        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50",
                                      )}
                                      title="Kiểm tra trước xuất và tải HTML A4 độc lập"
                                    >
                                      {exportingFormat === "html" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                                      HTML A4
                                    </button>
                                  </div>
                                </div>

                                <div
                                  className="p-4 sm:p-6 md:p-10 bg-[#FCFDFF] printable-article-shell"
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => event.preventDefault()}
                                >

                                  <>
                                      {canvasBlockEditState && (() => {
                                        const headingLevel = getCanvasHeadingLevel(canvasBlockEditState.value, canvasBlockEditState.blockType);
                                        const isBulletList = isCanvasBulletList(canvasBlockEditState.value, canvasBlockEditState.blockType);
                                        const isNumberedList = isCanvasNumberedList(canvasBlockEditState.value, canvasBlockEditState.blockType);
                                        const isBold = isCanvasInlineWrapped(canvasBlockEditState.value, "**");
                                        const isItalic = isCanvasInlineWrapped(canvasBlockEditState.value, "_");
                                        const toolbarButtonClass = (active = false) => [
                                          "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-[12px] font-black transition focus:outline-none focus:ring-2 focus:ring-[#002D56]/20",
                                          active ? "border-[#002D56] bg-[#002D56] text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                                        ].join(" ");
                                        const separatorClass = "mx-0.5 hidden h-7 w-px bg-slate-200 sm:block";

                                        return (
                                          <div data-export-exclude="true" className="mb-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                              <div className="flex min-w-0 items-center gap-2 lg:max-w-[220px]">
                                                <span className="h-2.5 w-2.5 flex-none rounded-full bg-emerald-500 shadow-sm" aria-hidden="true" />
                                                <div className="min-w-0">
                                                  <p className="truncate text-[12px] font-black text-slate-900">Đang sửa: {canvasBlockEditState.title}</p>
                                                  <p className="truncate text-[11px] font-semibold text-slate-500">Xong để cập nhật · Hủy để khôi phục</p>
                                                </div>
                                              </div>

                                              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-slate-50/80 px-1.5 py-1 [scrollbar-width:thin] lg:justify-center" role="toolbar" aria-label="Công cụ định dạng block đang sửa">
                                                <button type="button" onClick={undoCanvasEdit} disabled={canvasBlockEditState.undoStack.length === 0} title="Hoàn tác trong block đang sửa" className={`${toolbarButtonClass(false)} disabled:cursor-not-allowed disabled:opacity-40`}>↶</button>
                                                <button type="button" onClick={redoCanvasEdit} disabled={canvasBlockEditState.redoStack.length === 0} title="Làm lại trong block đang sửa" className={`${toolbarButtonClass(false)} disabled:cursor-not-allowed disabled:opacity-40`}>↷</button>
                                                <span className={separatorClass} aria-hidden="true" />
                                                <button type="button" onClick={applyCanvasParagraphFormat} title="Văn bản thường" className={toolbarButtonClass(!headingLevel && !isBulletList && !isNumberedList)}>P</button>
                                                <button type="button" onClick={() => applyCanvasHeadingFormat(1)} title="Tiêu đề cấp 1" className={toolbarButtonClass(headingLevel === 1)}>H1</button>
                                                <button type="button" onClick={() => applyCanvasHeadingFormat(2)} title="Tiêu đề cấp 2" className={toolbarButtonClass(headingLevel === 2)}>H2</button>
                                                <button type="button" onClick={() => applyCanvasHeadingFormat(3)} title="Tiêu đề cấp 3" className={toolbarButtonClass(headingLevel === 3)}>H3</button>
                                                <span className={separatorClass} aria-hidden="true" />
                                                <button type="button" onClick={() => applyCanvasInlineFormat("**")} title="In đậm toàn block" className={toolbarButtonClass(isBold)}>B</button>
                                                <button type="button" onClick={() => applyCanvasInlineFormat("_")} title="In nghiêng toàn block" className={`${toolbarButtonClass(isItalic)} italic`}>I</button>
                                                <span className={separatorClass} aria-hidden="true" />
                                                <button type="button" onClick={applyCanvasBulletFormat} title="Danh sách bullet" className={toolbarButtonClass(isBulletList)}>• List</button>
                                                <button type="button" onClick={applyCanvasNumberedFormat} title="Danh sách đánh số" className={toolbarButtonClass(isNumberedList)}>1. List</button>
                                                <span className={separatorClass} aria-hidden="true" />
                                                <button type="button" onClick={clearCanvasEditFormat} title="Xóa định dạng markdown cơ bản" className={toolbarButtonClass(false)}>Clear</button>
                                              </div>

                                              <div className="flex flex-none items-center justify-end gap-2">
                                                <button type="button" onClick={applyCanvasBlockEdit} className="inline-flex h-9 items-center justify-center rounded-lg bg-[#002D56] px-3.5 text-[12px] font-black text-white shadow-sm transition hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#002D56]/25">Xong</button>
                                                <button type="button" onClick={cancelCanvasBlockEdit} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200">Hủy</button>
                                                <button type="button" onClick={() => void deleteCanvasBlock()} className="ml-1 inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-[12px] font-bold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100">Xóa block</button>
                                              </div>
                                            </div>
                                            {canvasBlockEditState.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{canvasBlockEditState.error}</p>}
                                          </div>
                                        );
                                      })()}
                                      <A4PrintPreview
                                        document={articleDocument}
                                        rootId="printable-article"
                                        showValidationSummary={false}
                                        selectableBlocks
                                        selectedBlockIds={selectedBlockIds}
                                        onBlockSelect={handleCanvasBlockSelect}
                                        onBlockOpen={handleCanvasBlockOpen}
                                        editingBlockId={canvasBlockEditState?.blockId || null}
                                        editingValue={canvasBlockEditState?.value || ""}
                                        onEditingValueChange={(value) => pushCanvasEditValue(value)}
                                        emptyBlockIds={emptyCanvasBlockIds}
                                      />
                                    </>
                                </div>

                                <div data-export-exclude="true" className="px-8 py-6 bg-[#002D56] text-white/50 text-[10px] font-semibold text-center uppercase tracking-[0.3em]">
                                  Bản quyền nội dung thuộc về Tổng Công ty Bảo
                                  đảm an toàn hàng hải Việt Nam
                                </div>
                              </motion.section>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
  );

  const renderActiveWorkspace = () => {
    if (workspaceMode === "history") return renderHistoryMode();
    if (workspaceMode === "create") return renderCreateMode();
    if (workspaceMode === "review") return renderPlaceholderMode("review");
    if (workspaceMode === "summarize") return renderPlaceholderMode("summarize");
    if (workspaceMode === "sources") return renderSourcesMode();
    return renderEditMode();
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <main
        className={cn(
          "h-full min-w-0 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar space-y-5 pb-24 transition-[padding] duration-200",
          copilotViewMode !== "collapsed" && copilotViewMode !== "fullscreen" ? "pr-1 xl:pr-[440px]" : "pr-1",
        )}
        onClick={handleWorkspaceClick}
      >
        {renderWorkspaceHeader()}
        {renderActiveWorkspace()}
      </main>

      {isContextPillVisible && pillAnchor && selectedContextItems.length > 0 && selectedContextItems.length <= 3 && (
        <div
          data-context-pill="true"
          data-export-exclude="true"
          className="fixed z-40 flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2 py-2 shadow-xl shadow-slate-900/10"
          style={{ top: pillAnchor.top, left: pillAnchor.left }}
          onMouseEnter={() => setIsContextPillVisible(true)}
        >
          <button
            type="button"
            onClick={() => {
              setCopilotViewMode("expanded");
              setIsContextPillVisible(false);
            }}
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#002D56] px-3 text-xs font-black text-white hover:bg-slate-900"
          >
            <MessageCircle className="h-4 w-4" />
            {selectedContextItems.length === 1 ? "Hỏi AI" : `Hỏi AI về ${selectedContextItems.length} nội dung`}
          </button>
          <button type="button" onClick={clearCopilotContext} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Bỏ chọn context">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <FloatingCopilot
        viewMode={copilotViewMode}
        selectedContextItems={selectedContextItems}
        commands={copilotCommands}
        activeCommandId={activeCommandId}
        pendingProposal={pendingProposal}
        statusMessage={copilotStatusMessage}
        inputValue={copilotInput}
        draftFlow={copilotDraftFlowState}
        sourceFlow={copilotSourceFlowState}
        isBusy={isCopilotBusy}
        onDraftFlowChange={updateCopilotDraftFlow}
        onSubmitDraftFlow={() => void submitCopilotDraftFlow()}
        onGenerateTemplateSkeleton={() => void handleGenerateTemplateSkeleton()}
        onCancelDraftFlow={() => { setIsCopilotDraftFlowOpen(false); setCopilotDraftFlowError(null); setCopilotStatusMessage("Đã hủy tạo bản thảo. Canvas không thay đổi."); }}
        onOpenSourceWorkspace={openSourceWorkspaceFromCopilot}
        onCancelSourceFlow={() => { setIsCopilotSourceFlowOpen(false); setCopilotStatusMessage("Đã đóng luồng thêm nguồn. Canvas không thay đổi."); }}
        onOpenHistory={() => { switchWorkspaceMode("history"); setCopilotStatusMessage("Đã mở lịch sử văn bản. Bản thảo hiện tại không thay đổi."); }}
        onChooseTemplate={openCopilotDraftFlow}
        onCopyProposal={() => { if (pendingProposal?.proposedText) void navigator.clipboard?.writeText(pendingProposal.proposedText); setCopilotStatusMessage("Đã sao chép nội dung tham khảo."); }}
        onOpen={openCopilotExpanded}
        onClose={() => setCopilotViewMode("collapsed")}
        onFullscreen={() => setCopilotViewMode("fullscreen")}
        onReturnToCanvas={() => setCopilotViewMode("expanded")}
        onRemoveContext={(id) => { setSelectedContextItems((items) => items.filter((item) => item.id !== id)); }}
        onClearContext={clearCopilotContext}
        onRunCommand={(id, prompt) => void handleRunCopilotCommand(id, prompt)}
        onInputChange={setCopilotInput}
        onSubmitPrompt={() => void handleSubmitCopilotPrompt()}
        onApplyProposal={handleApplyCopilotProposal}
        onCancelProposal={() => {
          setPendingProposal(null);
          setCopilotStatusMessage("Đã hủy đề xuất. Nội dung gốc không thay đổi.");
        }}
      />
    </div>
  );
};
