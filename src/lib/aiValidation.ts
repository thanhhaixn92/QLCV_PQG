import { z } from "zod";

export const ChatResponseSchema = z.object({
  intent: z.enum(["chat", "create_tasks", "summarize", "editorial", "none"]).default("chat"),
  reply: z.string().describe("Markdown content for the user"),
  taskDrafts: z.array(z.object({
    title: z.string(),
    description: z.string().optional().default(""),
    assignee: z.string().optional().default(""),
    dueDate: z.string().optional().default(""),
    categoryCode: z.string().optional().default("LV_DH"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    status: z.enum(["todo", "doing", "review", "done", "blocked"]).default("todo"),
    isDeputy: z.boolean().default(false),
    checklist: z.array(z.object({
      title: z.string(),
      done: z.boolean().default(false)
    })).optional().default([])
  })).optional().default([]),
  suggestedActions: z.array(z.object({
    id: z.string().optional(),
    type: z.string(),
    label: z.string(),
    payload: z.any().optional()
  })).optional().default([])
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const TaskBuilderSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    assigneeText: z.string().optional(),
    dueDate: z.string().optional(),
    categoryCode: z.string().optional(),
    isDeputy: z.boolean().default(false).optional(),
    priority: z.string().optional(),
    description: z.string().optional(),
    sourceText: z.string().optional(),
    nextActions: z.array(z.string()).default([])
  }))
});

export type TaskBuilderPlan = z.infer<typeof TaskBuilderSchema>;

export const SlideOutlineSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  audience: z.string().optional(),
  style: z.string().optional(),
  slideCount: z.number().int().optional(),
  durationMinutes: z.number().optional(),
  mainMessage: z.string().optional(),
  openingSuggestion: z.string().optional(),
  closingSuggestion: z.string().optional(),
  sourceSummary: z.string().optional(),
  missingInfoWarnings: z.array(z.string()).optional().default([]),
  handout: z.string().optional(),
  expectedQA: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).optional().default([]),
  slides: z.array(z.object({
    slideNumber: z.number(),
    title: z.string(),
    objective: z.string().optional(),
    keyMessage: z.string().optional(),
    bullets: z.array(z.string()).default([]),
    speakerNotes: z.string().optional(),
    visualSuggestion: z.string().optional(),
    dataOrEvidence: z.array(z.string()).optional().default([]),
    estimatedTimeSeconds: z.number().optional(),
    cautionNotes: z.array(z.string()).optional().default([])
  }))
});

export const EditorialPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  targetAudience: z.string().optional(),
  keyMessages: z.array(z.string()).default([]),
  structure: z.array(z.object({
    heading: z.string(),
    points: z.array(z.string()).default([]),
    illustrationSuggestion: z.string().optional()
  })),
  suggestedLength: z.string().optional(),
  keywords: z.array(z.string()).optional()
});

export type EditorialPlan = z.infer<typeof EditorialPlanSchema>;

export const IllustrationPlanSchema = z.object({
  illustrations: z.array(z.object({
    description: z.string(),
    position: z.string(),
    caption: z.string(),
    style: z.string().optional()
  }))
});

export const ContentReviewSchema = z.object({
  summary: z.string(),
  purpose: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  spellingIssues: z.array(z.string()).default([]),
  structureIssues: z.array(z.string()).default([]),
  styleIssues: z.array(z.string()).default([]),
  duplicationIssues: z.array(z.string()).default([]),
  missingContent: z.array(z.string()).default([]),
  factualWarnings: z.array(z.string()).default([]),
  improvementSuggestions: z.array(z.string()).default([]),
  rewrittenPrompt: z.string(),
  improvedText: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional()
});

export type ContentReview = z.infer<typeof ContentReviewSchema>;

export const ImagePlanSchema = z.object({
  plans: z.array(z.object({
    paragraphIndex: z.number().default(0),
    insertAfter: z.string().default(""),
    caption: z.string().default(""),
    prompt: z.string().default(""),
    reason: z.string().default(""),
    priority: z.enum(["high", "medium", "low"]).default("medium")
  })).max(4),
  notes: z.array(z.string()).default([])
});

export type ImagePlan = z.infer<typeof ImagePlanSchema>;

export const ProposalOutlineSchema = z.object({
  outlineItems: z.array(z.object({
    title: z.string(),
    level: z.number().int().min(1).max(5),
    parentId: z.string().optional(),
    rationale: z.string().optional(),
    requiredSources: z.array(z.string()).optional().default([]),
    requiredData: z.array(z.string()).optional().default([])
  }))
});

export const ProposalDraftAssistSchema = z.object({
  intent: z.enum(["write_draft", "improve_draft", "review_logic", "missing_data", "executive_summary", "general_answer"]).default("general_answer"),
  reply: z.string().describe("Main AI response text"),
  draftSuggestion: z.object({
    title: z.string().optional(),
    content: z.string(),
    insertionMode: z.enum(["replace", "append", "insert_after_cursor", "note_only"]).default("append")
  }).optional(),
  comments: z.array(z.string()).default([]),
  missingData: z.array(z.string()).default([]),
  suggestedSources: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  suggestedActions: z.array(z.object({
    type: z.enum(["apply_to_draft", "append_to_draft", "copy", "mark_needs_data", "create_data_requirement", "create_task"]),
    label: z.string()
  })).default([])
});

export type ProposalDraftAssist = z.infer<typeof ProposalDraftAssistSchema>;

export const ProposalDataAnalysisSchema = z.object({
  summary: z.string(),
  detectedData: z.array(z.object({
    group: z.string(),
    title: z.string(),
    valueText: z.string(),
    status: z.enum(["available", "partial", "missing", "needs_verification", "needs_update"]),
    priority: z.enum(["very_high", "high", "medium", "low"]),
    purpose: z.string(),
    suggestedSource: z.string(),
    responsibleUnit: z.string(),
    periodRequired: z.string(),
    breakdownRequired: z.string(),
    verificationNote: z.string(),
    linkedOutlineCodes: z.array(z.string()).default([]),
    confidence: z.enum(["high", "medium", "low"])
  })).default([]),
  missingData: z.array(z.object({
    group: z.string(),
    title: z.string(),
    reason: z.string(),
    priority: z.enum(["very_high", "high", "medium", "low"]),
    suggestedSource: z.string(),
    responsibleUnit: z.string(),
    linkedOutlineCodes: z.array(z.string()).default([])
  })).default([]),
  risks: z.array(z.string()).default([]),
  suggestedTasks: z.array(z.object({
    title: z.string(),
    assigneeSuggestion: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    reason: z.string()
  })).default([]),
  conclusion: z.string()
});

export type ProposalDataAnalysis = z.infer<typeof ProposalDataAnalysisSchema>;

export const DraftImportPreviewSchema = z.object({
  success: z.boolean().default(true),
  mode: z.enum(["current_item", "target_section", "whole_proposal"]),
  summary: z.string(),
  targetScope: z.object({
    proposalId: z.string(),
    targetOutlineItemId: z.string().nullable(),
    targetOutlineCode: z.string().nullable(),
    targetLabel: z.string()
  }),
  allocations: z.array(z.object({
    outlineItemId: z.string(),
    outlineCode: z.string(),
    outlineTitle: z.string(),
    action: z.enum(["append", "replace", "note_only", "skip"]),
    content: z.string(),
    reason: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
    warnings: z.array(z.string()).optional().default([]),
    sourceExcerpt: z.string().optional()
  })),
  unmappedContent: z.array(z.object({
    content: z.string(),
    reason: z.string(),
    suggestedAction: z.enum(["manual_review", "create_new_outline_item", "ignore"])
  })).optional().default([]),
  missingData: z.array(z.string()).optional().default([]),
  risks: z.array(z.string()).optional().default([]),
  messageToUser: z.string()
});

export type DraftImportPreview = z.infer<typeof DraftImportPreviewSchema>;
