import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker using CDN for compatibility
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_PAGES = 80;
const MAX_CHARS = 500000;

export async function parseFile(file: File): Promise<string> {
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error(`Dung lượng file quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Giới hạn tối đa là 10MB.`);
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md'];

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error('Định dạng file không được hỗ trợ. Chỉ nhận: .pdf, .docx, .xlsx, .xls, .csv, .txt, .md');
  }

  let text = '';
  switch (extension) {
    case 'docx':
      text = await parseDocx(file);
      break;
    case 'xlsx':
    case 'xls':
    case 'csv':
      text = await parseExcel(file);
      break;
    case 'pdf':
      text = await parsePdf(file);
      break;
    case 'txt':
    case 'md':
      text = await parseText(file);
      break;
    default:
      throw new Error('Hệ thống không thể xử lý định dạng này');
  }

  // Content Clipping
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + '\n\n[Nội dung đã được rút gọn để tránh vượt giới hạn lưu trữ.]';
  }

  return text;
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseExcel(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  let fullText = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    fullText += `--- Sheet: ${sheetName} ---\n`;
    fullText += XLSX.utils.sheet_to_txt(worksheet);
    fullText += '\n\n';
  });
  
  return fullText;
}

async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  const pagesToRead = Math.min(pdf.numPages, MAX_PDF_PAGES);
  
  for (let i = 1; i <= pagesToRead; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
    
    // Stop early if character limit exceeded
    if (fullText.length > MAX_CHARS) break;
  }
  
  if (fullText.trim().length === 0) {
    throw new Error('Không thể đọc chữ từ file PDF (có thể đây là file scan/ảnh). Vui lòng dùng file chứa văn bản (text-based PDF).');
  }

  if (pdf.numPages > MAX_PDF_PAGES) {
    fullText += `\n\n[Tài liệu quá dài, chỉ trích xuất nội dung của ${MAX_PDF_PAGES} trang đầu tiên.]`;
  }
  
  return fullText;
}

async function parseText(file: File): Promise<string> {
  return file.text();
}
