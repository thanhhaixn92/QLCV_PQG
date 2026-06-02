import type {
  EditorialLayoutBlock,
  EditorialTemplate,
  EditorialTemplateDraft,
  EditorialTemplateDraftBlock,
  EditorialTemplateDraftInput,
} from "../types/editorialTemplate";
import { getEditorialTemplateById } from "./editorialTemplateRegistry";
import { matchEditorialTemplates } from "./editorialTemplateMatcher";
import { resolveMissingInputs } from "./editorialTemplateUtils";

const resolveTemplate = (input: EditorialTemplateDraftInput): EditorialTemplate => {
  if (input.templateId) {
    const template = getEditorialTemplateById(input.templateId);
    if (template) {
      return template;
    }
  }

  const [bestMatch] = matchEditorialTemplates(input);
  const matchedTemplate = bestMatch ? getEditorialTemplateById(bestMatch.templateId) : undefined;

  if (!matchedTemplate) {
    throw new Error("Không tìm thấy template biên tập phù hợp.");
  }

  return matchedTemplate;
};

const providedContentForBlock = (
  block: EditorialLayoutBlock,
  input: EditorialTemplateDraftInput,
  contentAllocated: boolean,
): string | undefined => {
  const providedInputs = input.providedInputs ?? {};
  const directValue = providedInputs[block.id]?.trim();

  if (directValue) {
    return directValue;
  }

  if (block.type === "title") {
    return providedInputs.title?.trim();
  }

  if (block.type === "source_note") {
    return providedInputs.source?.trim() ?? providedInputs.sources?.trim();
  }

  if (block.type === "legal_basis") {
    return providedInputs.legalBasis?.trim();
  }

  if (block.type === "recipients") {
    return providedInputs.recipient?.trim();
  }

  if (!contentAllocated && ["lead", "paragraph", "section", "review_note"].includes(block.type)) {
    return input.sourceSummary?.trim() || input.userBrief.trim();
  }

  return undefined;
};

const buildDraftBlock = (
  block: EditorialLayoutBlock,
  input: EditorialTemplateDraftInput,
  contentAllocated: boolean,
): { draftBlock: EditorialTemplateDraftBlock; contentAllocated: boolean } => {
  const content = providedContentForBlock(block, input, contentAllocated);
  const hasContent = Boolean(content);
  const shouldAllocateContent = hasContent && content === (input.sourceSummary?.trim() || input.userBrief.trim());

  return {
    draftBlock: {
      id: `draft_${block.id}`,
      templateBlockId: block.id,
      type: block.type,
      label: block.label,
      placeholder: block.placeholder,
      content,
      contentHint: block.contentHint,
      required: block.required ?? false,
      status: hasContent ? "provided" : block.placeholder ? "placeholder" : "empty",
    },
    contentAllocated: contentAllocated || shouldAllocateContent,
  };
};

export const buildEditorialTemplateDraft = (input: EditorialTemplateDraftInput): EditorialTemplateDraft => {
  const template = resolveTemplate(input);
  const missingInputs = resolveMissingInputs(template.requiredInputs, input.providedInputs);

  let contentAllocated = false;
  const blocks = template.layoutBlocks.map((layoutBlock) => {
    const result = buildDraftBlock(layoutBlock, input, contentAllocated);
    contentAllocated = result.contentAllocated;
    return result.draftBlock;
  });

  return {
    templateId: template.id,
    templateName: template.name,
    group: template.group,
    category: template.category,
    formatProfile: template.formatProfile,
    missingInputs,
    preflightHints: template.preflightHints,
    blocks,
  };
};
