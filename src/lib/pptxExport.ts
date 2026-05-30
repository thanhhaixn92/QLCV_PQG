import PptxGenJS from "pptxgenjs";
import { SlideOutlineResult, SlideDeckExportOptions } from "../types/slideOutline";
import { SLIDE_THEMES } from "./slideThemes";

const VIETNAMESE_SAFE_FONT = "Arial";

const resolveVietnameseFont = (font?: string) => {
  if (!font) return VIETNAMESE_SAFE_FONT;
  return /^(Arial|Calibri|Aptos|Tahoma|Verdana)$/i.test(font) ? font : VIETNAMESE_SAFE_FONT;
};

const sanitizeFileName = (str: string) => {
  // Translate Vietnamese characters to Latin
  const noAccents = str.normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/đ/g, 'd').replace(/Đ/g, 'D');
  // Remove non-alphanumeric (allow space, dash, underscore)
  return noAccents.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
};

export async function exportSlideOutlineToPptx(
  outline: SlideOutlineResult,
  options: SlideDeckExportOptions
): Promise<void> {
  const pptx = new PptxGenJS();
  
  const theme = SLIDE_THEMES[options.theme || "vms_enterprise"];
  
  // Set Presentation metadata
  pptx.author = "VMS Navigator AI";
  pptx.company = "Hoa Tiêu Miền Bắc";
  pptx.title = outline.title;
  pptx.layout = "LAYOUT_WIDE";
  
  // Define Master Slide for Title
  pptx.defineSlideMaster({
    title: "TITLE_SLIDE",
    background: { color: theme.colors.primary },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: "100%", fill: { color: theme.colors.primary } } }
    ]
  });

  // Define Master Slide for Content
  pptx.defineSlideMaster({
    title: "CONTENT_SLIDE",
    background: { color: theme.colors.background },
    slideNumber: { x: "90%", y: "92%", w: "10%", h: 0.3, fontSize: 10, color: theme.colors.mutedText, align: "right" },
    objects: [
      // Top header line
      { rect: { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: theme.colors.primary } } },
      // Footer
      { rect: { x: 0, y: "90%", w: "100%", h: 0.5, fill: { color: theme.colors.secondary } } },
      { text: { text: outline.title, options: { x: 0.5, y: "92%", w: "60%", h: 0.3, fontSize: 10, color: theme.colors.mutedText, italic: true } } }
    ]
  });

  // 1. Title Slide
  const titleSlide = pptx.addSlide({ masterName: "TITLE_SLIDE" });
  titleSlide.addText(outline.title, {
    x: 1, y: 2, w: 8, h: 1.5,
    fontSize: 44, color: "FFFFFF", bold: true, align: "center", valign: "middle", fontFace: resolveVietnameseFont(theme.fonts.heading)
  });
  if (outline.subtitle) {
    titleSlide.addText(outline.subtitle, {
      x: 1, y: 3.5, w: 8, h: 1,
      fontSize: 24, color: "E2E8F0", align: "center", valign: "top", fontFace: resolveVietnameseFont(theme.fonts.body)
    });
  }

  // Add all other slides
  outline.slides.forEach((slide) => {
    const s = pptx.addSlide({ masterName: "CONTENT_SLIDE" });
    
    // Slide Title
    s.addText(slide.title, {
      x: 0.5, y: 0.4, w: 9, h: 0.8,
      fontSize: 32, color: theme.colors.primary, bold: true, fontFace: resolveVietnameseFont(theme.fonts.heading)
    });

    // Content logic
    let contentX = 0.5;
    let contentY = 1.4;
    let contentW = 9;
    
    const hasVisual = options.includeVisualSuggestions && !!slide.visualSuggestion;
    
    if (hasVisual) {
       contentW = 5.2;
       
       s.addText("[Gợi ý Ảnh] \n" + slide.visualSuggestion, {
          x: 6, y: 1.4, w: 3.5, h: 3.8,
          fontSize: 14, color: theme.colors.mutedText, italic: true, align: "center", valign: "middle",
          fill: { color: theme.colors.secondary },
          line: { color: theme.colors.primary, width: 1, dashType: "dash" }
       });
    }

    if (slide.keyMessage) {
        s.addText(slide.keyMessage, {
            x: contentX, y: contentY, w: contentW, h: 0.5,
            fontSize: 16, color: theme.colors.accent, bold: true, italic: true, fontFace: resolveVietnameseFont(theme.fonts.body)
        });
        contentY += 0.8;
    }

    if (slide.bullets && slide.bullets.length > 0) {
        // Warning layout for excessively long slides
        let displayBullets = slide.bullets;
        let showWarning = false;
        
        // Soft limit: > 5 bullets is too congested for a single standard slide
        if (displayBullets.length > 5) {
           displayBullets = displayBullets.slice(0, 5);
           displayBullets.push("... (Còn tiếp - Vui lòng xem ở phần Ghi chú/Speaker Notes)");
           showWarning = true;
        }

        const fontSize = displayBullets.length > 4 ? 18 : 22;
        
        s.addText(displayBullets.map(b => ({ text: b })), {
            x: contentX, y: contentY, w: contentW, h: 3.5,
            fontSize: fontSize, color: theme.colors.text, bullet: true,
            valign: "top", fontFace: resolveVietnameseFont(theme.fonts.body), lineSpacing: 24
        });
        
        if (showWarning) {
            s.addText("⚠️ Slide bị giới hạn dòng để đảm bảo tính thẩm mỹ.", {
                x: contentX, y: 4.8, w: contentW, h: 0.3,
                fontSize: 12, color: "FF0000", italic: true, fontFace: resolveVietnameseFont(theme.fonts.body)
            });
        }
    }

    // Speaker Notes
    let notes = "";
    if (options.includeSpeakerNotes && slide.speakerNotes) {
        notes += "🎤 KỊCH BẢN THUYẾT TRÌNH:\n" + slide.speakerNotes + "\n\n";
    }
    if (options.includeCautionNotes && slide.cautionNotes && slide.cautionNotes.length > 0) {
        notes += "⚠️ CHÚ Ý QUAN TRỌNG:\n" + slide.cautionNotes.map(n => "- " + n).join("\n") + "\n\n";
    }
    // If we cut off bullets, put them all in notes!
    if (slide.bullets && slide.bullets.length > 5) {
        notes += "📝 CHI TIẾT NỘI DUNG (Bị ẩn khỏi slide do quá dài):\n" + slide.bullets.map(n => "- " + n).join("\n") + "\n";
    }
    
    if (notes) {
        s.addNotes(notes);
    }
  });

  // Closing Slide
  const closingSlideText = outline.closingSuggestion || "Trân trọng cảm ơn!";
  const closingSlide = pptx.addSlide({ masterName: "TITLE_SLIDE" });
  closingSlide.addText(closingSlideText, {
    x: 1, y: 2, w: 8, h: 2,
    fontSize: 40, color: "FFFFFF", bold: true, align: "center", valign: "middle", fontFace: resolveVietnameseFont(theme.fonts.heading)
  });

  // Save the presentation
  const prefix = "PhacThaoSlide_";
  const nameFragment = outline.title ? sanitizeFileName(outline.title) : "KhongTen";
  const fileName = `${prefix}${nameFragment}_${Date.now()}.pptx`;
  
  await pptx.writeFile({ fileName });
}
