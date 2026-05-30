import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { ARTICLE_EXPORT_STYLE, cmToTwip } from "./exportArticleModel";
import { saveAs } from "file-saver";
import { SlideOutlineResult, SlideDeckExportOptions } from "../types/slideOutline";

export async function exportSlideOutlineToWord(
  outline: SlideOutlineResult,
  options: SlideDeckExportOptions
) {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "SLIDE OUTLINE",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  children.push(
    new Paragraph({
      text: outline.title,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    })
  );

  if (outline.subtitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: outline.subtitle, italics: true, color: "666666" })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
  }

  if (options.includeSourceSummary && outline.sourceSummary) {
    children.push(
      new Paragraph({
        text: "Tóm tắt nguồn:",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      })
    );
    children.push(
      new Paragraph({
        text: outline.sourceSummary,
        spacing: { after: 400 }
      })
    );
  }

  // Handout
  if (outline.handout) {
    children.push(
      new Paragraph({
        text: "Tài liệu phát tay (Handout)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );
    children.push(
      new Paragraph({
        text: outline.handout,
        spacing: { after: 400 }
      })
    );
  }

  // Expected Q&A
  if (outline.expectedQA && outline.expectedQA.length > 0) {
    children.push(
      new Paragraph({
        text: "Q&A Dự kiến (Hỏi - Đáp)",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );
    outline.expectedQA.forEach((qa, idx) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Hỏi: ${qa.question}`, bold: true, color: "002D56", font: ARTICLE_EXPORT_STYLE.font.body, size: ARTICLE_EXPORT_STYLE.sizePt.body * 2 })
          ],
          spacing: { before: 100, after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Đáp: ${qa.answer}`, color: "333333", font: ARTICLE_EXPORT_STYLE.font.body, size: ARTICLE_EXPORT_STYLE.sizePt.body * 2 })
          ],
          spacing: { after: 200 }
        })
      );
    });
  }

  // Slides
  outline.slides.forEach((slide) => {
    children.push(
      new Paragraph({
        text: `Slide ${slide.slideNumber}: ${slide.title || "Untitled"}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    if (slide.keyMessage) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Thông điệp chính: ", bold: true }),
            new TextRun({ text: slide.keyMessage, font: ARTICLE_EXPORT_STYLE.font.body, size: ARTICLE_EXPORT_STYLE.sizePt.body * 2 })
          ],
          spacing: { after: 200 }
        })
      );
    }

    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach((b) => {
        children.push(
          new Paragraph({
            text: b,
            bullet: { level: 0 },
            spacing: { after: 100 }
          })
        );
      });
      children.push(new Paragraph({ text: "", spacing: { after: 100 } })); // Spacer
    }

    if (options.includeVisualSuggestions && slide.visualSuggestion) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Gợi ý hình ảnh: ", bold: true, color: "0052cc" }),
            new TextRun({ text: slide.visualSuggestion, color: "0052cc" })
          ],
          spacing: { after: 200 }
        })
      );
    }

    if (options.includeSpeakerNotes && slide.speakerNotes) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Lời dẫn (Speaker Notes):\n", bold: true, color: "4fac5c" }),
            new TextRun({ text: slide.speakerNotes, color: "4fac5c" })
          ],
          spacing: { after: 200 }
        })
      );
    }

    if (options.includeCautionNotes && slide.cautionNotes && slide.cautionNotes.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "CHÚ Ý RÀ SOÁT / KIỂM CHỨNG:",
              bold: true,
              color: "d32f2f"
            })
          ],
          spacing: { before: 100, after: 100 }
        })
      );
      slide.cautionNotes.forEach((c) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: "[Chú ý] ", color: "d32f2f", bold: true }),
              new TextRun({ text: c, color: "d32f2f" })
            ],
            bullet: { level: 0 },
            spacing: { after: 100 }
          })
        );
      });
    }
    
    // Add page break or separator
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "--------------------------------------------------------",
            color: "CCCCCC"
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 }
      })
    );
  });

  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: ARTICLE_EXPORT_STYLE.font.body, size: ARTICLE_EXPORT_STYLE.sizePt.h1 * 2, bold: true, color: "0F172A", underline: { type: "none" } },
          paragraph: { spacing: { before: 280, after: 200 }, keepNext: true, keepLines: true, alignment: AlignmentType.CENTER },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: ARTICLE_EXPORT_STYLE.font.body, size: ARTICLE_EXPORT_STYLE.sizePt.h2 * 2, bold: true, color: "0F172A", underline: { type: "none" } },
          paragraph: { spacing: { before: 240, after: 160 }, keepNext: true, keepLines: true },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: ARTICLE_EXPORT_STYLE.font.body, size: ARTICLE_EXPORT_STYLE.sizePt.h3 * 2, bold: true, color: "0F172A", underline: { type: "none" } },
          paragraph: { spacing: { before: 200, after: 120 }, keepNext: true, keepLines: true },
        },
      ],
      default: {
        document: {
          run: {
            font: ARTICLE_EXPORT_STYLE.font.body,
            size: ARTICLE_EXPORT_STYLE.sizePt.body * 2,
            color: "000000",
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: cmToTwip(ARTICLE_EXPORT_STYLE.page.widthCm), height: cmToTwip(ARTICLE_EXPORT_STYLE.page.heightCm), orientation: "portrait" },
          margin: {
            top: cmToTwip(ARTICLE_EXPORT_STYLE.page.marginsCm.top),
            right: cmToTwip(ARTICLE_EXPORT_STYLE.page.marginsCm.right),
            bottom: cmToTwip(ARTICLE_EXPORT_STYLE.page.marginsCm.bottom),
            left: cmToTwip(ARTICLE_EXPORT_STYLE.page.marginsCm.left),
          },
        },
      },
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  const safeFilename = ("Outline_" + outline.title.replace(/[^a-zA-Z0-9]/g, '_')).substring(0, 50);
  saveAs(blob, `${safeFilename}.docx`);
}
