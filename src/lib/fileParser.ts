import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export async function parseFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'docx':
      return parseDocx(file);
    case 'xlsx':
    case 'xls':
    case 'csv':
      return parseExcel(file);
    case 'pdf':
      return parsePdf(file);
    case 'txt':
    case 'md':
      return parseText(file);
    default:
      throw new Error('Định dạng file không được hỗ trợ');
  }
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseExcel(file: File): Promise<string> {
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
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
}

async function parseText(file: File): Promise<string> {
  return file.text();
}
