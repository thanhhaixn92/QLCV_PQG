import axios from 'axios';
import { extractPdfText } from './pdfText';
import mammoth from 'mammoth';

import * as xlsx from 'xlsx';

// Generic retry helper for Drive API
export async function retryPromise<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= retries || (error.response?.status && error.response.status < 500 && error.response.status !== 429)) {
        throw error; // Do not retry on client errors (4xx) except 429 Rate Limit
      }
      console.warn(`Retry attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      // Exponential backoff
      delayMs *= 2;
    }
  }
  throw new Error('Unreachable');
}

export function parseDriveUrl(url: string): string | null {
  if (!url) return null;
  
  // Handlers for absolute folder/file links
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9\-_]+)/);
  if (folderMatch) return folderMatch[1];

  const fileMatch = url.match(/\/d\/([a-zA-Z0-9\-_]+)/);
  if (fileMatch) return fileMatch[1];

  const genericMatch = url.match(/[?&]id=([a-zA-Z0-9\-_]+)/);
  if (genericMatch) return genericMatch[1];

  // If already an ID
  if (/^[a-zA-Z0-9\-_]{20,60}$/.test(url)) return url;

  return null;
}

export async function getDriveMetadata(fileId: string, apiKey: string) {
  const fields = 'id, name, mimeType, description, size, iconLink, thumbnailLink, webViewLink, webContentLink, createdTime, modifiedTime, parents, exportLinks, md5Checksum';
  const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    params: {
      fields,
      key: apiKey,
      supportsAllDrives: true
    }
  });
  return response.data;
}

export function buildDrivePreviewUrl(fileId: string, mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.document') return `https://docs.google.com/document/d/${fileId}/preview`;
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
  if (mimeType === 'application/vnd.google-apps.presentation') return `https://docs.google.com/presentation/d/${fileId}/preview`;
  if (mimeType === 'application/vnd.google-apps.folder') return `https://drive.google.com/drive/folders/${fileId}`;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export async function extractDriveContent(fileId: string, mimeType: string, metadata: any, apiKey: string): Promise<{ content: string; contentStatus: 'metadata_only' | 'extracting' | 'extracted' | 'summary_only' | 'unavailable' | 'error' | 'too_large' | 'needs_ocr' | 'ocr_processing' | 'ocr_failed'; error?: string; sourceLimitNote?: string }> {
  const maxChars = 100000;
  const timeout = 60000;
  const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024; // 25MB

  // Fallback to determine if too large before downloading
  if (metadata.size && parseInt(metadata.size) > MAX_DOWNLOAD_BYTES) {
    return {
      content: 'Tệp vượt quá giới hạn đọc tự động. Bạn vẫn có thể mở trực tiếp trên Drive.',
      contentStatus: 'too_large',
      sourceLimitNote: 'Tệp gốc quá lớn để tải tự động.'
    };
  }

  const axiosConfig = {
    timeout,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxBodyLength: MAX_DOWNLOAD_BYTES
  };
  
  try {
    // 1. Google Drive Native Formats (Export)
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportUrl = metadata.exportLinks?.['text/plain'];
      if (exportUrl) {
        const resp = await retryPromise(() => axios.get(`${exportUrl}&key=${apiKey}`, axiosConfig));
        const txt = String(resp.data);
        return { content: txt.length > maxChars ? txt.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : txt, contentStatus: 'extracted' };
      }
    }

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportUrl = metadata.exportLinks?.['text/csv'];
      if (exportUrl) {
        const resp = await retryPromise(() => axios.get(`${exportUrl}&key=${apiKey}`, axiosConfig));
        const txt = String(resp.data);
        return { content: txt.length > maxChars ? txt.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : txt, contentStatus: 'extracted' };
      }
    }

    if (mimeType === 'application/vnd.google-apps.presentation') {
      const exportUrl = metadata.exportLinks?.['text/plain'];
      if (exportUrl) {
        const resp = await retryPromise(() => axios.get(`${exportUrl}&key=${apiKey}`, axiosConfig));
        const txt = String(resp.data);
        return { content: txt.length > maxChars ? txt.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : txt, contentStatus: 'extracted' };
      }
    }

    // 2. Binary Files (Media Download)
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}&supportsAllDrives=true`;

    if (mimeType === 'application/pdf') {
      const resp = await retryPromise(() => axios.get(mediaUrl, { ...axiosConfig, responseType: 'arraybuffer' }));
      const txt = await extractPdfText(Buffer.from(resp.data));
      if (!txt || txt.trim().length === 0) {
        return { content: '', contentStatus: 'needs_ocr', error: 'PDF không có văn bản hoặc có thể là bản quét (PDF Scan).' };
      }
      return { content: txt.length > maxChars ? txt.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : txt, contentStatus: 'extracted' };
    }

    if (mimeType.startsWith('image/')) {
        return { content: '', contentStatus: 'needs_ocr', error: 'Tệp hình ảnh cần dùng AI OCR để đọc nội dung.' };
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const resp = await retryPromise(() => axios.get(mediaUrl, { ...axiosConfig, responseType: 'arraybuffer' }));
      const data = await mammoth.extractRawText({ buffer: Buffer.from(resp.data) });
      const txt = data.value;
      return { content: txt.length > maxChars ? txt.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : txt, contentStatus: 'extracted' };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'text/csv'
    ) {
      const resp = await retryPromise(() => axios.get(mediaUrl, { ...axiosConfig, responseType: 'arraybuffer' }));
      const workbook = xlsx.read(resp.data, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        fullText += `--- Sheet: ${name} ---\n${xlsx.utils.sheet_to_csv(sheet)}\n\n`;
      });
      return { content: fullText.length > maxChars ? fullText.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : fullText, contentStatus: 'extracted' };
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType.startsWith('text/')) {
      const resp = await retryPromise(() => axios.get(mediaUrl, axiosConfig));
      const txt = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      return { 
        content: txt.length > maxChars ? txt.substring(0, maxChars) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]' : txt,
        contentStatus: 'extracted' 
      };
    }

    // Media/Others - No text extraction possible
    return { content: '', contentStatus: 'unavailable' };
  } catch (err: any) {
    if (err.message && err.message.includes('maxContentLength')) {
      return {
        content: 'Tệp vượt quá giới hạn đọc tự động. Bạn vẫn có thể mở trực tiếp trên Drive.',
        contentStatus: 'too_large',
        sourceLimitNote: 'Tệp quá lớn để tải tự động.'
      };
    }
    
    console.error(`[Drive Extraction Error] ${fileId} - ${metadata.name} (size: ${metadata.size}):`, err.message);
    return { 
      content: '', 
      contentStatus: 'error', 
      error: err.response?.data?.error?.message || err.message 
    };
  }
}

export function determineDocumentKind(mimeType: string): string {
  const meta = mimeType.toLowerCase();
  if (meta.includes('spreadsheet') || meta.includes('excel') || meta === 'text/csv') return 'bao_cao';
  if (meta.includes('presentation')) return 'bao_cao'; // Slides often summarized as report context
  if (meta.includes('pdf')) return 'quy_dinh_phap_ly';
  if (meta.includes('word') || meta.includes('document')) return 'van_ban_chi_dao';
  if (meta.includes('image')) return 'khac';
  if (meta.includes('video')) return 'khac';
  if (meta === 'application/vnd.google-apps.folder') return 'khac';
  return 'khac';
}
