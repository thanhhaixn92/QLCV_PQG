import { SlideOutlineResult, SlideDeckExportOptions } from "../types/slideOutline";

export function buildGammaMarkdown(
  outline: SlideOutlineResult,
  options: SlideDeckExportOptions
): string {
  let md = `# ${outline.title}\n\n`;
  if (outline.subtitle) md += `*${outline.subtitle}*\n\n`;

  if (options.includeSourceSummary && outline.sourceSummary) {
    md += `**Tóm tắt nguồn:**\n${outline.sourceSummary}\n\n`;
  }

  md += `---\n\n`;

  outline.slides.forEach((slide) => {
    md += `## Slide ${slide.slideNumber}: ${slide.title}\n\n`;

    if (slide.keyMessage) {
      md += `**Thông điệp chính:** ${slide.keyMessage}\n\n`;
    }

    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach((b) => {
        md += `- ${b}\n`;
      });
      md += `\n`;
    }

    if (options.includeVisualSuggestions && slide.visualSuggestion) {
      md += `> **Gợi ý hình ảnh:** ${slide.visualSuggestion}\n\n`;
    }

    if (options.includeSpeakerNotes && slide.speakerNotes) {
      md += `*Speaker Notes:*\n${slide.speakerNotes}\n\n`;
    }

    if (options.includeCautionNotes && slide.cautionNotes && slide.cautionNotes.length > 0) {
      md += `**CHÚ Ý RÀ SOÁT / KIỂM CHỨNG:**\n`;
      slide.cautionNotes.forEach((c) => {
        md += `- ⚠️ ${c}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  if (outline.closingSuggestion) {
    md += `## Kết thúc\n\n`;
    md += `${outline.closingSuggestion}\n`;
  } else {
    md += `## Trân trọng cảm ơn!\n`;
  }

  return md;
}
