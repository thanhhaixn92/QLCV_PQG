import { EditorialIllustration } from '../types';
import { isPublishableIllustration } from './editorialImageUtils';

export interface EditorialPublishAudit {
  approvedCount: number;
  suggestedCount: number;
  rejectedCount: number;
  errorCount: number;
  failedQualityCount: number;
  canExportWithImages: boolean;
  warnings: string[];
}

export function getPublishableIllustrations(images: EditorialIllustration[] = []): EditorialIllustration[] {
  return images.filter(isPublishableIllustration);
}

export function auditEditorialPublish(images: EditorialIllustration[] = []): EditorialPublishAudit {
  const approvedCount = images.filter(i => i.reviewStatus === 'approved').length;
  const suggestedCount = images.filter(i => i.reviewStatus === 'suggested').length;
  const rejectedCount = images.filter(i => i.reviewStatus === 'rejected').length;
  const errorCount = images.filter(i => i.status === 'error').length;
  const failedQualityCount = images.filter(i => i.qualityStatus === 'failed').length;
  const warnings: string[] = [];

  if (suggestedCount > 0) warnings.push(`Còn ${suggestedCount} hình đang chờ duyệt, chưa đưa vào bản xuất chính thức.`);
  if (rejectedCount > 0) warnings.push(`Có ${rejectedCount} hình đã bị loại.`);
  if (errorCount > 0) warnings.push(`Có ${errorCount} hình bị lỗi cần dọn.`);
  if (failedQualityCount > 0) warnings.push(`Có ${failedQualityCount} hình không đạt hậu kiểm chất lượng.`);

  return {
    approvedCount,
    suggestedCount,
    rejectedCount,
    errorCount,
    failedQualityCount,
    canExportWithImages: approvedCount > 0,
    warnings,
  };
}
