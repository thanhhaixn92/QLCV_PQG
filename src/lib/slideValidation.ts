import { SlideOutlineResult, SlideOutlineItem } from "../types/slideOutline";

export interface DeckValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateDeckForExport(outline: SlideOutlineResult): DeckValidationResult {
  const result: DeckValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  if (!outline.slides || outline.slides.length === 0) {
    result.errors.push("Bản phác thảo không có slide nào.");
    result.isValid = false;
    return result;
  }

  if (!outline.title) {
    result.errors.push("Bản phác thảo thiếu tiêu đề (title).");
    result.isValid = false;
  }

  const slideCount = outline.slides.length;
  if (slideCount !== outline.slideCount) {
    result.warnings.push(`Tổng số slide thực tế (${slideCount}) khác với thông tin khái quát (${outline.slideCount}).`);
  }

  outline.slides.forEach((slide, index) => {
    const slideId = `Slide ${slide.slideNumber || index + 1}`;

    if (!slide.title) {
      result.warnings.push(`${slideId} bị thiếu tiêu đề.`);
    }

    if (!slide.keyMessage) {
       result.warnings.push(`${slideId} chưa có thông điệp chính (key message).`);
    }

    if (slide.bullets && slide.bullets.length > 5) {
      result.warnings.push(`${slideId} có nhiều hơn 5 gạch đầu dòng, có thể làm người xem khó đọc.`);
    }

    let totalTextChars = slide.keyMessage ? slide.keyMessage.length : 0;
    if (slide.bullets) {
       for (const bullet of slide.bullets) {
          totalTextChars += bullet.length;
          if (bullet.length > 150) {
             result.warnings.push(`${slideId} có bullet quá dài (hơn 150 ký tự). Bạn nên rút gọn để dễ đọc hơn.`);
          }
       }
    }
    if (totalTextChars > 500) {
       result.warnings.push(`${slideId} có quá nhiều chữ (tổng cộng hơn 500 ký tự). Dễ gây choáng ngợp cho người dùng.`);
    }

    if (!slide.dataOrEvidence || slide.dataOrEvidence.length === 0) {
       result.warnings.push(`${slideId} đang thiếu nguồn kiểm chứng hoặc số liệu (dataOrEvidence). Nên bổ sung để tăng độ tin cậy.`);
    }

    if (slide.cautionNotes && slide.cautionNotes.length > 0) {
      result.warnings.push(`${slideId} có nội dung cần kiểm duyệt/rà soát (cautionNotes).`);
    }
  });

  return result;
}
