import { SlideOutlineResult, SlideDeckExportOptions } from "../types/slideOutline";

function sanitizeGammaText(value: string | undefined): string {
  return (value || "")
    .replace(/\[\s*(?:Cần bổ sung|Cần kiểm chứng|Bổ sung)\s*:[^\]]+\]/giu, "[Nội dung cần hoàn thiện]")
    .replace(/\[\s*(?:PLACEHOLDER|—\s*(?:ẢNH|PLACEHOLDER)\s*—)[^\]]*\]/giu, "[Vị trí nội dung minh họa]")
    .trim();
}

export function buildGammaMarkdown(
  outline: SlideOutlineResult,
  options: SlideDeckExportOptions
): string {
  let md = `# ${sanitizeGammaText(outline.title)}\n\n`;
  if (outline.subtitle) md += `*${sanitizeGammaText(outline.subtitle)}*\n\n`;

  if (options.includeSourceSummary && outline.sourceSummary) {
    md += `**Tóm tắt nguồn:**\n${sanitizeGammaText(outline.sourceSummary)}\n\n`;
  }

  md += `---\n\n`;

  outline.slides.forEach((slide) => {
    md += `## Slide ${slide.slideNumber}: ${sanitizeGammaText(slide.title)}\n\n`;

    if (slide.keyMessage) {
      md += `**Thông điệp chính:** ${sanitizeGammaText(slide.keyMessage)}\n\n`;
    }

    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach((b) => {
        md += `- ${sanitizeGammaText(b)}\n`;
      });
      md += `\n`;
    }

    if (options.includeVisualSuggestions && slide.visualSuggestion) {
      md += `> **Gợi ý hình ảnh:** ${sanitizeGammaText(slide.visualSuggestion)}\n\n`;
    }

    if (options.includeSpeakerNotes && slide.speakerNotes) {
      md += `*Speaker Notes:*\n${sanitizeGammaText(slide.speakerNotes)}\n\n`;
    }

    if (options.includeCautionNotes && slide.cautionNotes && slide.cautionNotes.length > 0) {
      md += `**CHÚ Ý RÀ SOÁT / KIỂM CHỨNG:**\n`;
      slide.cautionNotes.forEach((c) => {
        md += `- ⚠️ ${sanitizeGammaText(c)}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  if (outline.closingSuggestion) {
    md += `## Kết thúc\n\n`;
    md += `${sanitizeGammaText(outline.closingSuggestion)}\n`;
  } else {
    md += `## Trân trọng cảm ơn!\n`;
  }

  return md;
}
