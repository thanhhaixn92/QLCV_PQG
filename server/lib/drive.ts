import axios from 'axios';
import * as pdfNamespace from 'pdf-parse';
import mammoth from 'mammoth';

const pdf = (pdfNamespace as any).default || pdfNamespace;
import * as xlsx from 'xlsx';

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
  const response = await axios.get(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}&key=${apiKey}`);
  return response.data;
}

export function buildDrivePreviewUrl(fileId: string, mimeType: string): string {
  if (mimeType === 'application/vnd.google-apps.document') return `https://docs.google.com/document/d/${fileId}/preview`;
  if (mimeType === 'application/vnd.google-apps.spreadsheet') return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
  if (mimeType === 'application/vnd.google-apps.presentation') return `https://docs.google.com/presentation/d/${fileId}/preview`;
  if (mimeType === 'application/vnd.google-apps.folder') return `https://drive.google.com/drive/folders/${fileId}`;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export async function extractDriveContent(fileId: string, mimeType: string, metadata: any, apiKey: string): Promise<{ content: string; contentStatus: 'extracted' | 'error' | 'unavailable'; error?: string }> {
  const maxChars = 500000;
  const timeout = 30000;
  const axiosConfig = {
    timeout,
    maxContentLength: 10 * 1024 * 1024, // 10MB
    maxBodyLength: 10 * 1024 * 1024 // 10MB
  };
  
  try {
    // 1. Google Drive Native Formats (Export)
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportUrl = metadata.exportLinks?.['text/plain'];
      if (exportUrl) {
        const resp = await axios.get(`${exportUrl}&key=${apiKey}`, axiosConfig);
        return { content: String(resp.data).substring(0, maxChars), contentStatus: 'extracted' };
      }
    }

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportUrl = metadata.exportLinks?.['text/csv'];
      if (exportUrl) {
        const resp = await axios.get(`${exportUrl}&key=${apiKey}`, axiosConfig);
        return { content: String(resp.data).substring(0, maxChars), contentStatus: 'extracted' };
      }
    }

    if (mimeType === 'application/vnd.google-apps.presentation') {
      const exportUrl = metadata.exportLinks?.['text/plain'];
      if (exportUrl) {
        const resp = await axios.get(`${exportUrl}&key=${apiKey}`, axiosConfig);
        return { content: String(resp.data).substring(0, maxChars), contentStatus: 'extracted' };
      }
    }

    // 2. Binary Files (Media Download)
    const mediaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;

    if (mimeType === 'application/pdf') {
      const resp = await axios.get(mediaUrl, { ...axiosConfig, responseType: 'arraybuffer' });
      const data = await pdf(Buffer.from(resp.data));
      return { content: data.text.substring(0, maxChars), contentStatus: 'extracted' };
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const resp = await axios.get(mediaUrl, { ...axiosConfig, responseType: 'arraybuffer' });
      const data = await mammoth.extractRawText({ buffer: Buffer.from(resp.data) });
      return { content: data.value.substring(0, maxChars), contentStatus: 'extracted' };
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      mimeType === 'text/csv'
    ) {
      const resp = await axios.get(mediaUrl, { ...axiosConfig, responseType: 'arraybuffer' });
      const workbook = xlsx.read(resp.data, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        fullText += `--- Sheet: ${name} ---\n${xlsx.utils.sheet_to_csv(sheet)}\n\n`;
      });
      return { content: fullText.substring(0, maxChars), contentStatus: 'extracted' };
    }

    if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType.startsWith('text/')) {
      const resp = await axios.get(mediaUrl, axiosConfig);
      return { 
        content: (typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data)).substring(0, maxChars),
        contentStatus: 'extracted' 
      };
    }

    // Media/Others - No text extraction possible
    return { content: '', contentStatus: 'unavailable' };
  } catch (err: any) {
    console.error(`[Drive Extraction Error] ${fileId}:`, err.message);
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
