import type {
  DocumentPreflightContext,
  DocumentPreflightInput,
  DocumentPreflightIssue,
  DocumentPreflightParagraph,
  DocumentPreflightRunnerOptions,
  DocumentPreflightStructuredInput,
} from "../../types/editorialDocumentStandards";
import { getDocumentStandardProfile } from "./documentStandardProfiles";
import { getDocumentStandardRules } from "./documentStandardRules";
import { normalizeTextForPreflight, splitParagraphs } from "./documentStandardUtils";

export function runDocumentPreflight(
  input: DocumentPreflightInput,
  options: DocumentPreflightRunnerOptions = {},
): DocumentPreflightIssue[] {
  const context = buildDocumentPreflightContext(input, options);
  const issues = getDocumentStandardRules().flatMap((rule) => rule.run(context));
  return options.includeInfo === false ? issues.filter((issue) => issue.severity !== "info") : issues;
}

export function buildDocumentPreflightContext(
  input: DocumentPreflightInput,
  options: DocumentPreflightRunnerOptions = {},
): DocumentPreflightContext {
  const structured = toStructuredInput(input);
  const profileId = structured.profileId ?? options.profileId ?? "website_article";
  const profile = getDocumentStandardProfile(profileId);
  const text = collectText(structured);
  const normalizedText = normalizeTextForPreflight(text);
  const inferredParagraphs = splitParagraphs(normalizedText);
  const paragraphs = normalizeParagraphInput(structured.paragraphs, inferredParagraphs);
  const headings = normalizeHeadingInput(structured.headings, paragraphs);

  return {
    profile,
    profileId,
    normalizedText,
    lines: normalizedText.split("\n").map((line) => line.trim()).filter(Boolean),
    paragraphs,
    headings,
    tables: structured.tables ?? [],
    figures: structured.figures ?? [],
    metadata: structured.metadata ?? {},
    title: structured.title || inferTitle(headings, paragraphs),
    sapo: structured.sapo || inferSapo(paragraphs),
    conclusion: structured.conclusion,
  };
}

function toStructuredInput(input: DocumentPreflightInput): DocumentPreflightStructuredInput {
  return typeof input === "string" ? { text: input } : input;
}

function collectText(input: DocumentPreflightStructuredInput): string {
  const parts = [
    input.title,
    input.sapo,
    input.text,
    ...(input.headings ?? []).map((heading) => heading.text),
    ...(input.paragraphs ?? []).map((paragraph) => paragraph.text),
    ...(input.tables ?? []).flatMap((table) => [
      table.caption,
      table.note,
      table.source,
      ...(table.headers ?? []),
      ...(table.rows ?? []).flat(),
    ]),
    ...(input.figures ?? []).flatMap((figure) => [figure.caption, figure.note, figure.source, figure.placeholderText, figure.alt]),
    input.conclusion,
  ];
  return parts.filter((part): part is string => Boolean(part?.trim())).join("\n\n");
}

function normalizeParagraphInput(
  explicitParagraphs: DocumentPreflightParagraph[] | undefined,
  inferredParagraphs: DocumentPreflightParagraph[],
): DocumentPreflightParagraph[] {
  if (!explicitParagraphs?.length) return inferredParagraphs;
  return explicitParagraphs.map((paragraph, index) => ({
    ...paragraph,
    id: paragraph.id ?? `paragraph-${index + 1}`,
    text: normalizeTextForPreflight(paragraph.text),
    role: paragraph.role ?? "body",
  }));
}

function normalizeHeadingInput(
  explicitHeadings: DocumentPreflightParagraph[] | undefined,
  paragraphs: DocumentPreflightParagraph[],
): DocumentPreflightParagraph[] {
  if (explicitHeadings?.length) {
    return explicitHeadings.map((heading, index) => ({
      ...heading,
      id: heading.id ?? `heading-${index + 1}`,
      text: normalizeTextForPreflight(heading.text),
      role: "heading",
    }));
  }
  return paragraphs
    .filter((paragraph) => paragraph.role === "heading" || looksLikePlainTextHeading(paragraph.text))
    .map((heading, index) => ({ ...heading, id: heading.id ?? `heading-${index + 1}`, role: "heading" }));
}

function inferTitle(headings: DocumentPreflightParagraph[], paragraphs: DocumentPreflightParagraph[]): string | undefined {
  return headings[0]?.text || paragraphs.find((paragraph) => paragraph.role === "title")?.text;
}

function inferSapo(paragraphs: DocumentPreflightParagraph[]): string | undefined {
  return paragraphs.find((paragraph) => paragraph.role === "sapo")?.text;
}

function looksLikePlainTextHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length > 120) return false;
  if (/^\s*(?:[IVXLCDM]+\.|\d+(?:\.\d+)*[.)]|[A-Z]\.)\s+/u.test(trimmed)) return true;
  const wordCount = trimmed.split(/\s+/u).filter(Boolean).length;
  return wordCount <= 12 && trimmed === trimmed.toLocaleUpperCase("vi-VN") && /\p{L}/u.test(trimmed);
}
