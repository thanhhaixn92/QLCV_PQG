import type {
  DocumentPreflightContext,
  DocumentPreflightIssue,
  DocumentPreflightSeverity,
  DocumentStandardRule,
  DocumentStandardRuleCategory,
} from "../../types/editorialDocumentStandards";
import {
  countWords,
  detectAdministrativeHeaderHints,
  detectAiSuggestionMarkers,
  detectFigureCaptionHints,
  detectPossibleNumericClaims,
  detectRawMarkdownMarkers,
  detectStandaloneGarbageText,
  detectTableCaptionHints,
  detectTechnicalMarkers,
  hasLegalOrPolicyClaim,
  hasSourceHintNear,
  isHeadingCapitalizationInconsistent,
  looksLikeConclusion,
  looksLikeDataTable,
} from "./documentStandardUtils";

export const DOCUMENT_STANDARD_RULE_CATEGORIES: DocumentStandardRuleCategory[] = [
  "content_structure",
  "language_quality",
  "administrative_format",
  "table_format",
  "figure_format",
  "source_evidence",
  "export_safety",
];

function hasAnySectionText(context: DocumentPreflightContext, keywords: readonly string[]): boolean {
  const haystack = [
    context.normalizedText,
    ...context.headings.map((heading) => heading.text),
    ...context.paragraphs.map((paragraph) => paragraph.text),
  ].join("\n").toLocaleLowerCase("vi-VN");
  return keywords.some((keyword) => haystack.includes(keyword.toLocaleLowerCase("vi-VN")));
}

function issue(
  context: DocumentPreflightContext,
  ruleId: string,
  category: DocumentStandardRuleCategory,
  severity: DocumentPreflightSeverity,
  message: string,
  suggestion: string,
  targetHint: string,
): DocumentPreflightIssue {
  return {
    id: `${context.profileId}:${ruleId}:${targetHint}`.replace(/\s+/gu, "-"),
    severity,
    category,
    message,
    suggestion,
    targetHint,
    ruleId,
    profileId: context.profileId,
  };
}

function longParagraphThreshold(context: DocumentPreflightContext, role?: string): number {
  if (role === "sapo") return 95;

  switch (context.profileId) {
    case "website_article":
    case "news_article":
    case "company_intro_article":
      return 180;
    case "administrative_report":
    case "kpi_data_report":
    case "official_dispatch":
    case "meeting_minutes":
    case "work_plan":
    case "summary_sheet":
      return 245;
    default:
      return 220;
  }
}

function groupedLongParagraphIssues(context: DocumentPreflightContext): DocumentPreflightIssue[] {
  const matches = context.paragraphs
    .filter((paragraph) => (paragraph.role ?? "body") === "body" || paragraph.role === "sapo")
    .map((paragraph, index) => {
      const wordCount = countWords(paragraph.text);
      return {
        paragraph,
        index,
        wordCount,
        threshold: longParagraphThreshold(context, paragraph.role),
      };
    })
    .filter((match) => match.wordCount > match.threshold);

  if (matches.length === 0) return [];

  const longest = matches.reduce((current, match) => (match.wordCount > current.wordCount ? match : current), matches[0]);
  const severity: DocumentPreflightSeverity = longest.wordCount >= longest.threshold + 90 ? "warning" : "info";
  const articleLike = ["website_article", "news_article", "company_intro_article"].includes(context.profileId);
  const scopeText = articleLike ? "website/bản tin" : "báo cáo/văn bản hành chính";

  return [
    issue(
      context,
      "long_paragraph",
      "content_structure",
      severity,
      `Có ${matches.length} đoạn tương đối dài so với ngưỡng ${scopeText}.`,
      `Đoạn dài nhất khoảng ${longest.wordCount} từ; có thể tách thành 2 đoạn hoặc chuyển một phần thành danh sách/bảng nếu cần tăng khả năng đọc.`,
      `long-paragraphs-${matches.length}`,
    ),
  ];
}

export const DOCUMENT_STANDARD_RULES: DocumentStandardRule[] = [
  {
    id: "missing_title",
    category: "content_structure",
    defaultSeverity: "warning",
    description: "Detects documents without a clear title.",
    run: (context) => {
      const firstHeading = context.headings[0]?.text;
      const firstParagraph = context.paragraphs[0]?.text;
      const title = context.title || firstHeading || firstParagraph;
      return title && countWords(title) <= 24
        ? []
        : [
            issue(
              context,
              "missing_title",
              "content_structure",
              "warning",
              "Thiếu tiêu đề rõ ràng.",
              "Bổ sung tiêu đề ngắn, rõ chủ đề và phù hợp loại văn bản.",
              "document-title",
            ),
          ];
    },
  },
  {
    id: "missing_sapo_lead",
    category: "content_structure",
    defaultSeverity: "info",
    description: "Detects missing sapo/lead for article-like profiles.",
    run: (context) =>
      context.profile?.requiresSapo && !context.sapo
        ? [
            issue(
              context,
              "missing_sapo_lead",
              "content_structure",
              "info",
              "Có thể bổ sung sapo/lead.",
              "Nếu dùng cho website/bản tin, bổ sung sapo 2–3 câu để tóm tắt thông tin chính và giá trị của bài viết.",
              "document-sapo",
            ),
          ]
        : [],
  },
  {
    id: "sapo_too_short",
    category: "content_structure",
    defaultSeverity: "info",
    description: "Detects very short sapo/lead text.",
    run: (context) =>
      context.sapo && countWords(context.sapo) < 18
        ? [
            issue(
              context,
              "sapo_too_short",
              "content_structure",
              "info",
              "Sapo/lead quá ngắn.",
              "Mở rộng sapo để nêu đủ ai, việc gì, ý nghĩa hoặc điểm chính.",
              "document-sapo",
            ),
          ]
        : [],
  },
  {
    id: "long_paragraph",
    category: "content_structure",
    defaultSeverity: "info",
    description: "Detects paragraphs that are likely too long for review or mobile reading.",
    run: groupedLongParagraphIssues,
  },
  {
    id: "very_short_orphan_paragraph",
    category: "content_structure",
    defaultSeverity: "info",
    description: "Detects unusually short standalone body paragraphs.",
    run: (context) =>
      context.paragraphs
        .filter((paragraph) => (paragraph.role ?? "body") === "body")
        .filter((paragraph) => countWords(paragraph.text) > 0 && countWords(paragraph.text) <= 3)
        .map((paragraph, index) =>
          issue(
            context,
            "very_short_orphan_paragraph",
            "content_structure",
            "info",
            "Đoạn văn rất ngắn, có thể bị lẻ ý.",
            "Kiểm tra xem đoạn này là tiêu đề, chú thích, nhãn mục hay phần thừa cần gộp/xóa.",
            paragraph.id ?? `short-paragraph-${index + 1}`,
          ),
        ),
  },
  {
    id: "missing_required_conclusion",
    category: "content_structure",
    defaultSeverity: "warning",
    description: "Detects missing conclusion when profile requires it.",
    run: (context) => {
      const hasConclusion = Boolean(context.conclusion) || context.paragraphs.some((paragraph) => looksLikeConclusion(paragraph.text));
      return context.profile?.requiresConclusion && !hasConclusion
        ? [
            issue(
              context,
              "missing_required_conclusion",
              "content_structure",
              "warning",
              "Thiếu phần kết luận/kết thúc theo chuẩn loại văn bản.",
              "Bổ sung kết luận, kiến nghị hoặc đoạn tổ chức thực hiện phù hợp.",
              "document-conclusion",
            ),
          ]
        : [];
    },
  },
  {
    id: "missing_report_sections",
    category: "content_structure",
    defaultSeverity: "warning",
    description: "Detects missing report/data-report sections required by the selected profile.",
    run: (context) => {
      const checks = [
        [context.profile.requiresResultsSection, ["kết quả", "ket qua", "tình hình", "tinh hinh"], "Thiếu mục kết quả/tình hình.", "Bổ sung phần tình hình hoặc kết quả đạt được.", "report-results"],
        [context.profile.requiresAssessmentSection, ["đánh giá", "danh gia", "nhận định", "nhan dinh"], "Thiếu mục đánh giá.", "Bổ sung phần đánh giá, nhận định hoặc phân tích kết quả.", "report-assessment"],
        [context.profile.requiresDataSection, ["số liệu", "so lieu", "kpi", "chỉ tiêu", "chi tieu", "bảng"], "Thiếu phần số liệu/chỉ tiêu.", "Bổ sung bảng hoặc danh sách số liệu/chỉ tiêu kèm nguồn.", "report-data"],
        [context.profile.requiresRecommendationSection, ["kiến nghị", "kien nghi", "phương hướng", "phuong huong", "đề xuất", "de xuat"], "Thiếu phương hướng/kiến nghị.", "Bổ sung phần phương hướng, kiến nghị hoặc đề xuất xử lý.", "report-recommendation"],
      ] as const;
      return checks
        .filter(([required, keywords]) => Boolean(required) && !hasAnySectionText(context, keywords))
        .map(([, , message, suggestion, targetHint]) => issue(context, "missing_report_sections", "content_structure", "warning", message, suggestion, targetHint));
    },
  },
  {
    id: "user_facing_placeholder",
    category: "content_structure",
    defaultSeverity: "warning",
    description: "Detects approved user-facing placeholders that still need completion.",
    run: (context) => Array.from(context.normalizedText.matchAll(/\[Cần\s+(?:bổ sung|ghi|xác minh)[^\]]*\]/giu)).slice(0, 12).map((match) =>
      issue(
        context,
        "user_facing_placeholder",
        "content_structure",
        "warning",
        "Cần hoàn thiện nội dung placeholder.",
        "Bổ sung dữ liệu thật, nguồn hoặc xác minh thông tin trước khi xuất bản chính thức.",
        `placeholder@${match.index ?? 0}`,
      ),
    ),
  },
  {
    id: "raw_markdown_marker",
    category: "language_quality",
    defaultSeverity: "warning",
    description: "Detects raw Markdown markers left in final content.",
    run: (context) =>
      detectRawMarkdownMarkers(context.normalizedText).map((match) =>
        issue(
          context,
          "raw_markdown_marker",
          "language_quality",
          "warning",
          "Còn marker Markdown thô trong nội dung.",
          "Chuyển marker Markdown thành định dạng văn bản thật hoặc loại bỏ khỏi nội dung xuất bản.",
          match.targetHint,
        ),
      ),
  },
  {
    id: "ai_suggestion_marker",
    category: "language_quality",
    defaultSeverity: "warning",
    description: "Detects AI suggestion labels left in final content.",
    run: (context) =>
      detectAiSuggestionMarkers(context.normalizedText).map((match) =>
        issue(
          context,
          "ai_suggestion_marker",
          "language_quality",
          "warning",
          "Còn marker gợi ý AI trong nội dung.",
          "Xóa nhãn gợi ý AI hoặc chuyển thành nội dung biên tập đã duyệt.",
          match.targetHint,
        ),
      ),
  },
  {
    id: "technical_placeholder_marker",
    category: "language_quality",
    defaultSeverity: "warning",
    description: "Detects technical placeholders or editor markers.",
    run: (context) =>
      detectTechnicalMarkers(context.normalizedText).map((match) =>
        issue(
          context,
          "technical_placeholder_marker",
          "language_quality",
          "warning",
          "Còn marker kỹ thuật/placeholder trong nội dung.",
          "Thay marker bằng nội dung biên tập hoàn chỉnh hoặc placeholder trình bày chuyên nghiệp.",
          match.targetHint,
        ),
      ),
  },
  {
    id: "double_punctuation",
    category: "language_quality",
    defaultSeverity: "info",
    description: "Detects duplicated punctuation.",
    run: (context) => {
      const matches = Array.from(context.normalizedText.matchAll(/[!?.,;:]{2,}/gu));
      return matches.map((match) =>
        issue(
          context,
          "double_punctuation",
          "language_quality",
          "info",
          "Có dấu câu bị lặp.",
          "Rà soát và giữ một dấu câu phù hợp.",
          `punctuation@${match.index ?? 0}`,
        ),
      );
    },
  },
  {
    id: "standalone_garbage_text",
    category: "language_quality",
    defaultSeverity: "warning",
    description: "Detects standalone garbage leftovers such as Bb.",
    run: (context) =>
      detectStandaloneGarbageText(context.paragraphs).map((match) =>
        issue(
          context,
          "standalone_garbage_text",
          "language_quality",
          "warning",
          "Có đoạn chữ thừa không rõ nghĩa.",
          "Xóa hoặc thay bằng nội dung có nghĩa nếu đây chỉ là chữ sót lại khi biên tập.",
          match.targetHint,
        ),
      ),
  },
  {
    id: "inconsistent_heading_capitalization",
    category: "language_quality",
    defaultSeverity: "info",
    description: "Detects inconsistent capitalization in headings.",
    run: (context) =>
      context.headings
        .filter((heading) => isHeadingCapitalizationInconsistent(heading.text))
        .map((heading, index) =>
          issue(
            context,
            "inconsistent_heading_capitalization",
            "language_quality",
            "info",
            "Viết hoa tiêu đề/mục chưa nhất quán.",
            "Chuẩn hóa kiểu viết hoa của tiêu đề trong toàn văn bản.",
            heading.id ?? `heading-${index + 1}`,
          ),
        ),
  },
  {
    id: "missing_administrative_header_parts",
    category: "administrative_format",
    defaultSeverity: "warning",
    description: "Detects missing administrative header components.",
    run: (context) => {
      if (!context.profile?.requiresAdministrativeHeader) return [];
      const hints = detectAdministrativeHeaderHints(context.normalizedText, context.metadata);
      const checks = [
        [hints.hasOrganizationName, "Thiếu tên cơ quan/tổ chức.", "Bổ sung tên cơ quan/tổ chức ban hành.", "organization-name"],
        [hints.hasNationalHeader, "Thiếu quốc hiệu.", "Bổ sung dòng quốc hiệu theo thể thức hành chính.", "national-header"],
        [hints.hasMotto, "Thiếu tiêu ngữ.", "Bổ sung dòng Độc lập - Tự do - Hạnh phúc.", "motto"],
        [hints.hasPlaceDateLine, "Thiếu dòng địa danh/ngày tháng.", "Bổ sung dòng địa danh, ngày tháng năm ban hành.", "place-date-line"],
      ] as const;
      return checks
        .filter(([ok]) => !ok)
        .map(([, message, suggestion, targetHint]) =>
          issue(context, "missing_administrative_header_parts", "administrative_format", "warning", message, suggestion, targetHint),
        );
    },
  },
  {
    id: "missing_document_number_symbol",
    category: "administrative_format",
    defaultSeverity: "warning",
    description: "Detects missing document number/symbol for profiles that require it.",
    run: (context) => {
      const hints = detectAdministrativeHeaderHints(context.normalizedText, context.metadata);
      return context.profile?.requiresDocumentNumber && !hints.hasDocumentNumberOrSymbol
        ? [
            issue(
              context,
              "missing_document_number_symbol",
              "administrative_format",
              "warning",
              "Thiếu số/ký hiệu văn bản.",
              "Bổ sung số và ký hiệu văn bản theo quy chuẩn của đơn vị.",
              "document-number-symbol",
            ),
          ]
        : [];
    },
  },
  {
    id: "missing_recipient_line",
    category: "administrative_format",
    defaultSeverity: "warning",
    description: "Detects missing recipient line for official dispatch.",
    run: (context) => {
      const hints = detectAdministrativeHeaderHints(context.normalizedText, context.metadata);
      return context.profile?.requiresRecipientLine && !hints.hasRecipientLine
        ? [
            issue(
              context,
              "missing_recipient_line",
              "administrative_format",
              "warning",
              "Thiếu dòng nơi nhận/kính gửi.",
              "Bổ sung dòng Kính gửi hoặc Nơi nhận phù hợp với công văn.",
              "recipient-line",
            ),
          ]
        : [];
    },
  },
  {
    id: "missing_signature_block",
    category: "administrative_format",
    defaultSeverity: "warning",
    description: "Detects missing signature block.",
    run: (context) => {
      const hints = detectAdministrativeHeaderHints(context.normalizedText, context.metadata);
      return context.profile?.requiresSignatureBlock && !hints.hasSignatureBlock
        ? [
            issue(
              context,
              "missing_signature_block",
              "administrative_format",
              "warning",
              "Thiếu khối chữ ký.",
              "Bổ sung chức danh, họ tên người ký và thông tin ký ban hành nếu cần.",
              "signature-block",
            ),
          ]
        : [];
    },
  },
  {
    id: "heading_numbering_inconsistency",
    category: "administrative_format",
    defaultSeverity: "info",
    description: "Detects mixed heading numbering styles.",
    run: (context) => {
      const roman = context.headings.some((heading) => /^\s*[IVXLCDM]+\./u.test(heading.text));
      const decimal = context.headings.some((heading) => /^\s*\d+(?:\.\d+)*[.)]/u.test(heading.text));
      const alpha = context.headings.some((heading) => /^\s*[a-z]\)/iu.test(heading.text));
      return [roman, decimal, alpha].filter(Boolean).length >= 2
        ? [
            issue(
              context,
              "heading_numbering_inconsistency",
              "administrative_format",
              "info",
              "Đánh số đề mục có dấu hiệu chưa nhất quán.",
              "Rà soát hệ thống mục I, 1, a hoặc 1.1 để thống nhất theo cấp đề mục.",
              "heading-numbering",
            ),
          ]
        : [];
    },
  },
  {
    id: "table_format_checks",
    category: "table_format",
    defaultSeverity: "warning",
    description: "Checks required table captions, notes, source hints and default visual standards.",
    run: (context) =>
      context.tables.flatMap((table, index) => {
        const target = table.id ?? `table-${index + 1}`;
        const captionHints = detectTableCaptionHints(table, context.normalizedText);
        const expected = context.profile?.metadata || {};
        const issues: DocumentPreflightIssue[] = [];
        if (!captionHints.hasCaption) {
          issues.push(issue(context, "table_missing_caption", "table_format", "warning", "Bảng thiếu chú thích/tiêu đề.", "Bổ sung caption bảng ở phía trên bảng.", target));
        }
        if (captionHints.hasCaption && captionHints.captionPosition !== "above") {
          issues.push(issue(context, "table_caption_not_above", "table_format", "warning", "Caption bảng không nằm phía trên.", "Đặt caption bảng phía trên theo chuẩn trình bày.", target));
        }
        if (looksLikeDataTable(table) && !captionHints.hasSourceOrNote) {
          issues.push(issue(context, "table_missing_source_note", "table_format", "warning", "Bảng dữ liệu thiếu nguồn/ghi chú.", "Bổ sung nguồn hoặc ghi chú cho bảng có số liệu.", target));
        }
        if (table.headerBold === false && expected.tableHeaderBold) {
          issues.push(issue(context, "table_header_should_be_bold", "table_format", "info", "Header bảng nên in đậm.", "Định dạng hàng tiêu đề bảng bằng chữ đậm.", target));
        }
        if (table.fontSize && expected.tableFontSize && table.fontSize !== expected.tableFontSize) {
          issues.push(issue(context, "table_font_size_should_be_13", "table_format", "info", "Cỡ chữ bảng nên là 13.", "Đặt cỡ chữ bảng theo profile chuẩn.", target));
        }
        if (table.lineHeight && expected.tableLineHeight && table.lineHeight !== expected.tableLineHeight) {
          issues.push(issue(context, "table_line_height_should_be_1_15", "table_format", "info", "Giãn dòng bảng nên là 1.15.", "Đặt line-height bảng theo profile chuẩn.", target));
        }
        if (table.borderColor && expected.tableBorder === "black" && table.borderColor.toLocaleLowerCase("en-US") !== "black") {
          issues.push(issue(context, "table_border_should_be_black", "table_format", "info", "Đường viền bảng nên màu đen.", "Đặt border bảng màu đen để bảo đảm in A4 rõ ràng.", target));
        }
        if (table.backgroundColor && expected.tableBackground === "white" && table.backgroundColor.toLocaleLowerCase("en-US") !== "white") {
          issues.push(issue(context, "table_background_should_be_white", "table_format", "info", "Nền bảng mặc định nên là trắng.", "Dùng nền trắng nếu không có chủ đích thiết kế khác.", target));
        }
        return issues;
      }),
  },
  {
    id: "figure_format_checks",
    category: "figure_format",
    defaultSeverity: "warning",
    description: "Checks figure captions, sources and placeholder quality.",
    run: (context) =>
      context.figures.flatMap((figure, index) => {
        const target = figure.id ?? `figure-${index + 1}`;
        const captionHints = detectFigureCaptionHints(figure, context.normalizedText);
        const issues: DocumentPreflightIssue[] = [];
        if (!captionHints.hasCaption) {
          issues.push(issue(context, "figure_missing_caption", "figure_format", "warning", "Hình/ảnh thiếu caption.", "Bổ sung caption phía dưới hình/ảnh.", target));
        }
        if (captionHints.hasCaption && captionHints.captionPosition !== "below") {
          issues.push(issue(context, "figure_caption_not_below", "figure_format", "warning", "Caption hình/ảnh không nằm phía dưới.", "Đặt caption hình/ảnh phía dưới theo chuẩn trình bày.", target));
        }
        if (!captionHints.hasSourceOrNote) {
          issues.push(issue(context, "figure_missing_source_note", "figure_format", "info", "Hình/ảnh thiếu nguồn/ghi chú.", "Bổ sung nguồn ảnh hoặc ghi chú nếu ảnh không do đơn vị tự sản xuất.", target));
        }
        if (figure.placeholderText && detectTechnicalMarkers(figure.placeholderText).length > 0) {
          issues.push(issue(context, "figure_placeholder_technical_marker", "figure_format", "warning", "Placeholder hình còn marker kỹ thuật.", "Dùng placeholder chuyên nghiệp, không hiển thị marker kỹ thuật thô.", target));
        }
        return issues;
      }),
  },
  {
    id: "source_evidence_checks",
    category: "source_evidence",
    defaultSeverity: "info",
    description: "Detects claims that may need source hints.",
    run: (context) => {
      const numericIssues = detectPossibleNumericClaims(context.normalizedText).slice(0, 12).map((match) =>
        issue(
          context,
          "numeric_claim_without_source_hint",
          "source_evidence",
          "info",
          "Có số liệu hoặc mốc thời gian có thể cần nguồn.",
          "Bổ sung nguồn/dẫn chứng gần số liệu nếu đây là thông tin quan trọng.",
          match.targetHint,
        ),
      );
      const legalIssue = hasLegalOrPolicyClaim(context.normalizedText) && !hasSourceHintNear(context.normalizedText, 0, context.normalizedText.length)
        ? [
            issue(
              context,
              "legal_policy_claim_without_source_hint",
              "source_evidence",
              "warning",
              "Có nhận định pháp lý/chính sách nhưng chưa thấy nguồn/căn cứ.",
              "Bổ sung căn cứ pháp lý, trích dẫn văn bản hoặc nguồn kiểm chứng.",
              "legal-policy-claim",
            ),
          ]
        : [];
      return [...numericIssues, ...legalIssue];
    },
  },
  {
    id: "export_safety_markers",
    category: "export_safety",
    defaultSeverity: "blocker",
    description: "Detects Copilot/editor UI markers that must not leak into printable/export content.",
    run: (context) => {
      const checks = [
        [/\b(?:copilot|trợ lý biên tập|hỏi ai)\b/iu, "Copilot UI marker không được nằm trong nội dung in/xuất.", "Loại bỏ nhãn Copilot khỏi #printable-article trước khi xuất.", "copilot-ui-marker"],
        [/\b(?:pill|highlight|selected block|đang chọn)\b/iu, "Marker pill/highlight không được xuất hiện trong nội dung xuất.", "Đảm bảo UI chọn block nằm ngoài nội dung export hoặc được loại trừ.", "pill-highlight-marker"],
        [/\b(?:toolbar|editor toolbar|thanh công cụ|placeholder nhập nội dung)\b/iu, "Toolbar/editor placeholder không được xuất hiện trong nội dung xuất.", "Loại bỏ placeholder/toolbar khỏi vùng nội dung export.", "toolbar-editor-marker"],
        [/\b(?:command dock|context strip|sửa trên canvas|sua tren canvas)\b/iu, "Marker UI biên tập không được nằm trong nội dung xuất.", "Loại bỏ nhãn Command Dock/Context Strip/Sửa trên Canvas khỏi nội dung trước khi xuất.", "editor-ui-marker"],
        [/\bnhập nội dung…?\b/iu, "Placeholder UI nhập nội dung không được nằm trong nội dung xuất.", "Chỉ dùng placeholder này trong editor, không lưu vào nội dung thật.", "editor-placeholder-text"],
        [/data-export-exclude/iu, "Có marker data-export-exclude trong text content.", "Export layer nên bỏ qua element data-export-exclude; nếu marker xuất hiện dạng text thì cần loại bỏ.", "data-export-exclude-text"],
        [/contenteditable/iu, "Có marker contenteditable trong text content.", "Không để thuộc tính DOM/editor lọt vào nội dung xuất.", "contenteditable-text"],
      ] as const;
      return checks
        .filter(([pattern]) => pattern.test(context.normalizedText))
        .map(([, message, suggestion, targetHint]) =>
          issue(context, "export_safety_markers", "export_safety", "blocker", message, suggestion, targetHint),
        );
    },
  },
];

export function getDocumentStandardRules(): DocumentStandardRule[] {
  return DOCUMENT_STANDARD_RULES;
}
