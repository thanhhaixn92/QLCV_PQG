/**
 * copilotIntentClassifier.ts
 * Lightweight rule-first intent classifier for Copilot chat.
 * No AI call — pattern matching only. Fast and deterministic.
 *
 * v1.1 (6.1.1): expanded edit verbs, hardened context_question boundary,
 * advisory fallback moved here.
 */

export type CopilotIntent =
  | "greeting"
  | "general_chat"
  | "help_request"
  | "context_question"
  | "edit_selected_block"
  | "generate_draft"
  | "preflight_request"
  | "source_request";

// ---------------------------------------------------------------------------
// EDIT verbs — explicit rewrite/transform commands only.
// Adding a term here routes to proposal generation.
// DO NOT add advisory/question phrases here.
// ---------------------------------------------------------------------------
const EDIT_VERBS: string[] = [
  // Core rewrite
  "viết lại",
  "rewrite",
  "diễn đạt lại",
  "paraphrase",
  // Shorten/expand
  "rút gọn",
  "làm gọn lại",
  "làm ngắn lại",
  "làm ngắn hơn",
  "mở rộng",
  "làm dài hơn",
  // Style improvement — imperative commands
  "làm hay hơn",
  "làm mượt hơn",
  "làm trang trọng",
  "viết cho trang trọng",
  "viết chuyên nghiệp hơn",
  "viết mạch lạc hơn",
  "viết lại cho dễ hiểu",
  "làm rõ ý",
  "làm mạnh hơn",
  "tăng tính thuyết phục",
  // Fix/edit commands
  "chỉnh lại",
  "chỉnh câu này",
  "chỉnh đoạn này",
  "sửa câu này",
  "sửa đoạn này",
  "sửa lại",
  "sửa cho",
  "sửa đoạn",
  "biên tập lại",
  "sửa lỗi chính tả",
  "fix lỗi",
  // Transform
  "chuyển thành",
  "thay thế",
  // Argument/evidence
  "tăng lập luận",
  "thêm lập luận",
  "thêm dẫn chứng",
  "bổ sung lập luận",
  "bổ sung luận điểm",
  // Improve
  "cải thiện đoạn",
  "cải thiện văn phong",
];

// ---------------------------------------------------------------------------
// CONTEXT QUESTION phrases — advisory only, never generate proposal.
// These take priority OVER edit detection when matched.
// ---------------------------------------------------------------------------
const CONTEXT_QUESTION_PATTERNS: RegExp[] = [
  // "ổn không / tốt không / được không / hay không"
  /đoạn\s+này\s+(ổn|tốt|hay|okay|ok|được|viết\s+ổn|viết\s+tốt)\s*(không|chưa)?/iu,
  // "có nên sửa không"
  /có\s+nên\s+(sửa|chỉnh|viết\s+lại)\s*(không|chưa)?/iu,
  // "cần bổ sung gì"
  /cần\s+bổ\s+sung\s+(gì|thêm\s+gì)/iu,
  // "có gì cần sửa / sai / thiếu"
  /có\s+gì\s+(cần\s+sửa|sai|thiếu|bổ\s+sung)/iu,
  // "nhận xét đoạn / nhận xét giúp"
  /nhận\s+xét\s+(đoạn|nội\s+dung|bài|giúp|cho|về)/iu,
  // "ý kiến về / ý kiến của bạn"
  /ý\s+kiến\s+(về|của\s+bạn)/iu,
  // "đánh giá đoạn / nội dung"
  /đánh\s+giá\s+(đoạn|nội\s+dung|bài)/iu,
  // "gợi ý cải thiện / bổ sung"
  /gợi\s+ý\s+(cải\s+thiện|bổ\s+sung)/iu,
  // "đây viết ổn chưa"
  /đây\s+viết\s+(ổn|tốt|được)\s*(chưa|không)?/iu,
  // "what do you think"
  /what\s+do\s+you\s+think/iu,
  // "bạn thấy đoạn này thế nào"
  /bạn\s+thấy\s+(đoạn|nội\s+dung|bài)\s*(này)?\s*(thế\s+nào|như\s+thế\s+nào|sao)/iu,
  // "đoạn này còn thiếu gì"
  /đoạn\s+này\s+(còn\s+)?thiếu\s+(gì|những\s+gì)/iu,
  // "review đoạn này" (without edit intent)
  /^review\s+(đoạn|nội\s+dung|bài)\s*(này)?$/iu,
];

// ---------------------------------------------------------------------------
// GREETING
// ---------------------------------------------------------------------------
const GREETING_PATTERNS: RegExp[] = [
  /^(xin\s+)?chào\b/iu,
  /^hello\b/iu,
  /^hi\b/iu,
  /^hey\b/iu,
  /^alo\b/iu,
  /^bạn\s+ơi\b/iu,
  /^trợ\s+lý\s+ơi\b/iu,
];

// ---------------------------------------------------------------------------
// HELP
// ---------------------------------------------------------------------------
const HELP_PATTERNS: RegExp[] = [
  /bạn\s+(có\s+thể|làm\s+được|giúp|hỗ\s+trợ)\s+(gì|những\s+gì)/iu,
  /hướng\s+dẫn\s+(tôi|mình|em)/iu,
  /bạn\s+là\s+ai/iu,
  /bạn\s+làm\s+được\s+gì/iu,
  /chức\s+năng\s+(gì|là\s+gì)/iu,
  /dùng\s+như\s+thế\s+nào/iu,
  /cách\s+dùng/iu,
  /how\s+to\s+use/iu,
  /what\s+can\s+you\s+do/iu,
];

// ---------------------------------------------------------------------------
// GENERATE DRAFT
// ---------------------------------------------------------------------------
const GENERATE_DRAFT_PATTERNS: RegExp[] = [
  /viết\s+(cho\s+tôi|giúp\s+tôi|một|bài|bản\s+thảo|tin|bài\s+viết)/iu,
  /tạo\s+(bản\s+thảo|bài|nội\s+dung|văn\s+bản)/iu,
  /soạn\s+(bài|bản\s+thảo|nội\s+dung|văn\s+bản|tin|thông\s+báo)/iu,
  /dựng\s+(bản\s+thảo|khung|outline)/iu,
  /generate\s+(draft|article|content)/iu,
  /write\s+(me\s+a|a\s+draft|an\s+article)/iu,
];

// ---------------------------------------------------------------------------
// PREFLIGHT
// ---------------------------------------------------------------------------
const PREFLIGHT_PATTERNS: RegExp[] = [
  /rà\s+soát\s+(bản\s+thảo|nội\s+dung|văn\s+bản)/iu,
  /kiểm\s+tra\s+trước\s+xuất/iu,
  /preflight/iu,
  /review\s+(bản\s+thảo|nội\s+dung)/iu,
  /kiểm\s+tra\s+(lỗi|chính\s+tả|văn\s+phong)/iu,
  /lỗi\s+(trong\s+)?bản\s+thảo/iu,
];

// ---------------------------------------------------------------------------
// SOURCE REQUEST
// ---------------------------------------------------------------------------
const SOURCE_PATTERNS: RegExp[] = [
  /nguồn\s+(tư\s+liệu|căn\s+cứ|tài\s+liệu)/iu,
  /thêm\s+nguồn/iu,
  /tài\s+liệu\s+tham\s+khảo/iu,
  /citations?\b/iu,
  /căn\s+cứ\s+(pháp\s+lý|khoa\s+học)/iu,
];

// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Classify the user's intent from the prompt text.
 * hasContext: whether there are selected context blocks.
 *
 * Priority order (hard):
 * 1. greeting
 * 2. help_request
 * 3. context_question  ← checked BEFORE edit verbs to guard advisory phrases
 * 4. generate_draft
 * 5. preflight_request
 * 6. source_request
 * 7. edit_selected_block  ← only if no context_question match
 * 8. general_chat (fallback)
 */
export function classifyCopilotIntent(
  prompt: string,
  hasContext: boolean,
): CopilotIntent {
  const text = normalize(prompt);

  // 1. Greeting — always chat, regardless of context
  if (GREETING_PATTERNS.some((p) => p.test(text))) return "greeting";

  // 2. Help request
  if (HELP_PATTERNS.some((p) => p.test(text))) return "help_request";

  // 3. Context question — checked BEFORE edit verbs.
  //    This prevents "đoạn này ổn không" from leaking into edit_selected_block
  //    even if it somehow contained an edit substring.
  if (CONTEXT_QUESTION_PATTERNS.some((p) => p.test(text))) {
    return "context_question";
  }

  // 4. Generate draft
  if (GENERATE_DRAFT_PATTERNS.some((p) => p.test(text))) return "generate_draft";

  // 5. Preflight
  if (PREFLIGHT_PATTERNS.some((p) => p.test(text))) return "preflight_request";

  // 6. Source request
  if (SOURCE_PATTERNS.some((p) => p.test(text))) return "source_request";

  // 7. Edit intent — only if an explicit edit verb is present
  const hasEditVerb = EDIT_VERBS.some((verb) => text.includes(verb));
  if (hasEditVerb) return "edit_selected_block";

  // 8. Fallback
  return "general_chat";
}

/** Safe advisory fallback for context_question — no AI call, no proposal risk. */
export const CONTEXT_QUESTION_ADVISORY =
  "Đoạn này có thể rà thêm về tính rõ ý, độ mạch lạc, căn cứ số liệu và văn phong. " +
  "Nếu muốn tôi sửa trực tiếp, hãy nhập \"viết lại đoạn này…\" hoặc \"rút gọn đoạn này…\".";

/**
 * Returns a friendly chat reply for non-edit intents.
 * Returns null for intents that should route to the workflow engine.
 */
export function getCopilotChatReply(
  intent: CopilotIntent,
  hasContext: boolean,
): string | null {
  switch (intent) {
    case "greeting":
      return "Chào bạn! Tôi đang hỗ trợ biên tập trong Canvas. Bạn có thể chọn một đoạn rồi yêu cầu viết lại, rút gọn, mở rộng hoặc hỏi về bài viết.";

    case "help_request":
      return (
        "Tôi có thể giúp bạn:\n" +
        "• Viết lại / Rút gọn / Mở rộng một đoạn (chọn đoạn trên Canvas rồi nhập yêu cầu)\n" +
        "• Kiểm tra trước xuất bản — dùng tab Kiểm tra hoặc gõ \"rà soát bản thảo\"\n" +
        "• Tư vấn về chất lượng, lập luận, nguồn tư liệu\n" +
        "• Soạn bản thảo mới — gõ \"tạo bản thảo\" hoặc dùng nút Soạn\n\n" +
        "Bạn muốn bắt đầu từ đâu?"
      );

    case "general_chat":
      if (hasContext) {
        return (
          "Tôi thấy bạn đã chọn một đoạn. Nếu muốn tôi chỉnh sửa, hãy dùng từ như " +
          "\"viết lại\", \"rút gọn\" hoặc \"làm trang trọng hơn\". " +
          "Nếu chỉ muốn hỏi nhận xét, cứ hỏi tự nhiên nhé!"
        );
      }
      return "Tôi đang sẵn sàng giúp bạn chỉnh sửa, kiểm tra hoặc tư vấn nội dung. Bạn muốn làm gì với bản thảo?";

    case "context_question":
      // Advisory fallback — safe, deterministic, no proposal
      return CONTEXT_QUESTION_ADVISORY;

    default:
      // generate_draft / preflight / source / edit_selected_block → route to workflow
      return null;
  }
}
