import { EditorialExportModel } from '../types/editorial';
import { EDITORIAL_KIND_CONFIG } from './editorialTemplates';

export interface EditorialValidationResult {
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export function validateEditorialContent(model: EditorialExportModel): EditorialValidationResult {
  const result: EditorialValidationResult = {
    errors: [],
    warnings: [],
    suggestions: [],
  };

  if (!model) {
    result.errors.push("Nội dung trống.");
    return result;
  }

  const config = EDITORIAL_KIND_CONFIG[model.kind];
  if (!config) {
    result.errors.push(`Loại tài liệu không hợp lệ: ${model.kind}`);
    return result;
  }

  for (const field of config.requiredFields) {
    if (!model[field as keyof EditorialExportModel] || (Array.isArray(model[field as keyof EditorialExportModel]) && (model[field as keyof EditorialExportModel] as any[]).length === 0)) {
      result.errors.push(`Thiếu trường dữ liệu bắt buộc: ${field}`);
    }
  }

  if (!model.title || model.title.trim() === '') {
    result.errors.push("Tiêu đề không được để trống.");
  }

  if (model.kind === 'website_article' || model.kind === 'news' || model.kind === 'press_release') {
    if (!model.sapo) {
      result.warnings.push("Bài viết truyền thông nên có phần Sapo (mở đầu).");
    }
  }

  if (model.kind === 'official_letter' || model.kind === 'administrative_report' || model.kind === 'announcement') {
    if (!model.recipients || model.recipients.length === 0) {
      result.warnings.push("Văn bản hành chính nên có phần Nơi nhận.");
    }
    if (!model.signerName && !model.signerTitle) {
      result.warnings.push("Văn bản hành chính nên có thông tin Người ký.");
    }
  }

  if (model.kind === 'plan' || model.kind === 'meeting_minutes') {
    if (!model.tasks || model.tasks.length === 0) {
      result.warnings.push(`Tài liệu loại này (${config.label}) nên có phân công nhiệm vụ cụ thể.`);
    }
  }

  // Check for placeholders in any text field
  const contentStr = JSON.stringify(model);
  if (contentStr.includes('[Cần') || contentStr.includes('[cần') || contentStr.includes('...')) {
    result.warnings.push("Vẫn còn phần chưa hoàn thiện (placeholder như [Cần bổ sung], ...)");
  }

  return result;
}
