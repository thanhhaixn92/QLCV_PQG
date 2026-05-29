import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell, BorderStyle, WidthType } from "docx";
import { saveAs } from "file-saver";
import { EditorialIllustration } from "../types";
import { splitParagraphs, isPublishableIllustration, hasUnapprovedPlaceholders } from "./editorialImageUtils";
import { normalizeVietnameseText } from "./exportContentNormalizer";

async function fetchImageAsBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const arr = await response.arrayBuffer();
  return new Uint8Array(arr);
}

export function extractExportTitle(input: string, output: string): { title: string, body: string } {
  let title = "BÀI VIẾT";
  let bodyLines = output.split('\n');

  // Find first H1
  const h1Index = bodyLines.findIndex(l => l.trim().startsWith('# '));
  if (h1Index !== -1) {
    let rawTitle = bodyLines[h1Index];
    rawTitle = rawTitle.replace(/^#\s+/, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/!\[.*?\]\(.*?\)/g, '').trim();
    if (rawTitle) {
      title = rawTitle;
      bodyLines.splice(h1Index, 1);
    }
  } else {
    // Find first non-empty line
    const nonEmptyIndex = bodyLines.findIndex(l => l.trim().length > 0 && !l.trim().startsWith('!'));
    if (nonEmptyIndex !== -1) {
      let rawTitle = bodyLines[nonEmptyIndex];
      rawTitle = rawTitle.replace(/^[#-]+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/!\[.*?\]\(.*?\)/g, '').trim();
      if (rawTitle) {
        title = rawTitle;
        bodyLines.splice(nonEmptyIndex, 1);
      }
    }
  }

  // Fallback for weird titles
  if (title.toUpperCase().startsWith("NGÀNH H")) {
    title = title.replace(/^NGÀNH H(\S+)?\s*/i, '').trim() || "BÀI VIẾT";
  }

  return { title: normalizeVietnameseText(title), body: bodyLines.join('\n') };
}

export async function exportToWord(title: string, content: string, filename: string, illustrations: EditorialIllustration[] = [], kind?: string) {
  if (!title.trim() && !content.trim()) {
    throw new Error("Nội dung bài viết trống, không thể xuất.");
  }
  
  const approved = illustrations.filter(isPublishableIllustration);
  
  // Normalize entire body content
  const normalizedContent = normalizeVietnameseText(content);
  const paragraphs = splitParagraphs(normalizedContent);
  
  const children: any[] = [];

  // Template System Headers
  if (kind === 'official_letter' || kind === 'administrative_report' || kind === 'announcement' || kind === 'plan' || kind === 'meeting_minutes') {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: "TỔNG CÔNG TY BẢO ĐẢM ATHH MIỀN BẮC"})], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: "CÔNG TY TNHH MTV HOA TIÊU HÀNG HẢI MIỀN BẮC", bold: true})], alignment: AlignmentType.CENTER })
                ],
                borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                width: { size: 50, type: WidthType.PERCENTAGE }
              }),
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true})], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true})], alignment: AlignmentType.CENTER })
                ],
                borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
                width: { size: 50, type: WidthType.PERCENTAGE }
              })
            ]
          })
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } }
      }),
      new Paragraph({ spacing: { after: 600 } })
    );
  }

  // Add Title
  if (title.trim()) {
    children.push(new Paragraph({
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 32 })],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }));
  }

  const grouped = new Map<number, EditorialIllustration[]>();
  approved.forEach(img => {
    const arr = grouped.get(img.paragraphIndex) || [];
    arr.push(img);
    grouped.set(img.paragraphIndex, arr);
  });

  const parseTextRuns = (text: string): TextRun[] => {
    const textWithoutImages = text.replace(/!\[.*?\]\(.*?\)/g, '');
    const tokenRegex = /(\*\*.*?\*\*|\*[^*]+\*|_{1,2}[^_]+_{1,2})/g;
    const parts = textWithoutImages.split(tokenRegex);
    
    return parts.reduce((acc: TextRun[], part) => {
      if (!part) return acc;
      let bold = false;
      let italics = false;
      let cleanText = part;

      if (part.startsWith('**') && part.endsWith('**')) {
        bold = true;
        cleanText = part.slice(2, -2);
      } else if (part.startsWith('__') && part.endsWith('__')) {
        bold = true;
        cleanText = part.slice(2, -2);
      } else if (part.startsWith('*') && part.endsWith('*')) {
        italics = true;
        cleanText = part.slice(1, -1);
      } else if (part.startsWith('_') && part.endsWith('_')) {
        italics = true;
        cleanText = part.slice(1, -1);
      }

      if (cleanText) {
        acc.push(new TextRun({ 
          text: cleanText, 
          bold,
          italics,
          font: "Times New Roman", 
          size: 28 
        }));
      }
      return acc;
    }, []);
  };

  const processLine = (line: string): Paragraph | null => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let heading: any = undefined;
    let text = trimmed;
    let isBullet = false;
    let isNumbered = false;

    if (text.startsWith('### ')) {
      text = text.replace('### ', '');
      heading = HeadingLevel.HEADING_3;
    } else if (text.startsWith('## ')) {
      text = text.replace('## ', '');
      heading = HeadingLevel.HEADING_2;
    } else if (text.startsWith('# ')) {
      text = text.replace('# ', '');
      heading = HeadingLevel.HEADING_1;
    } else if (text.startsWith('- ') || text.startsWith('* ')) {
      text = text.substring(2).trim();
      isBullet = true;
    } else if (/^\d+\.\s+/.test(text)) {
      text = text.replace(/^\d+\.\s+/, '').trim();
      isNumbered = true;
    }

    const textRuns = parseTextRuns(text);
    if (textRuns.length === 0 && !heading) return null;

    const pOptions: any = {
      children: textRuns,
      heading,
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, before: heading ? 400 : 0, after: isBullet || isNumbered ? 100 : 200 }
    };

    if (!heading && !isBullet && !isNumbered && !text.startsWith('Tên báo cáo:') && !text.startsWith('THÔNG BÁO')) {
       pOptions.indent = { firstLine: 567 }; // 1cm approx
    }

    if (isBullet) {
      pOptions.numbering = { reference: "vms-bullet", level: 0 };
    } else if (isNumbered) {
      pOptions.numbering = { reference: "vms-numbered", level: 0 };
    }

    return new Paragraph(pOptions);
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p && !(grouped.has(i))) continue;
    
    if (p) {
      const lines = p.split('\n').filter(l => l.trim());
      const looksLikeTable = lines.length >= 2 && lines[1].includes('|') && lines[1].includes('-');
      
      if (looksLikeTable) {
        try {
          const tableRows = lines.filter((_, idx) => idx !== 1).map((line, rIndex) => {
            const cells = line.split('|').map(c => c.trim());
            // Remove empty outer cells common in markdown tables `| A | B |` -> ['', 'A', 'B', '']
            if (cells.length > 0 && cells[0] === '') cells.shift();
            if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
            
            return new TableRow({
              children: cells.map(c => new TableCell({
                children: [
                  new Paragraph({ 
                    children: [new TextRun({ 
                      text: c.replace(/\*\*/g, ""), 
                      bold: rIndex === 0, 
                      font: "Times New Roman", 
                      size: 28 
                    })],
                    alignment: rIndex === 0 ? AlignmentType.CENTER : AlignmentType.LEFT
                  })
                ],
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                shading: rIndex === 0 ? { fill: "f5f5f5" } : undefined
              }))
            });
          });
          
          children.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            }
          }));
          children.push(new Paragraph({ spacing: { after: 200 } })); // Add spacing after table
        } catch (e) {
          // If table parsing fails, fallback to line-by-line
          lines.forEach(l => {
            const parsedLine = processLine(l);
            if (parsedLine) children.push(parsedLine);
          });
        }
      } else {
        lines.forEach(l => {
          const parsedLine = processLine(l);
          if (parsedLine) children.push(parsedLine);
        });
      }
    }

    // Insert Images for this paragraph
    const pImgs = grouped.get(i) || [];
    for (const img of pImgs) {
      try {
        const imageData = await fetchImageAsBuffer(img.url);
        children.push(new Paragraph({
          children: [
            new ImageRun({
              data: imageData,
              transformation: {
                width: 500,
                height: 300,
              }
            } as any)
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 100 }
        }));
        
        children.push(new Paragraph({
          children: [
            new TextRun({ 
              text: `Ảnh minh họa${img.caption ? `: ${img.caption}` : ''}`, 
              font: "Times New Roman", 
              size: 22,
              italics: true 
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }));
      } catch (err) {
        console.warn("Could not include image in Word export:", img.url, err);
      }
    }
  }

  const doc = new Document({
    creator: "VMS Navigator",
    title: title || "Bài viết",
    description: "Tài liệu xuất từ VMS Navigator",
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 28,
            color: "000000",
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "vms-bullet",
          levels: [
            {
              level: 0,
              format: "bullet",
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
        {
          reference: "vms-numbered",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: "2cm",
            right: "2cm",
            bottom: "2cm",
            left: "2.5cm",
          },
        },
      },
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  if (blob.size === 0) throw new Error("File DOCX sinh ra bị lỗi (0 bytes).");
  saveAs(blob, `${filename}.docx`);
}
