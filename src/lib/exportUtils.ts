import { jsPDF } from "jspdf";
import * as htmlToImage from 'html-to-image';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { EditorialIllustration } from "../types";
import { splitParagraphs, isPublishableIllustration, hasUnapprovedPlaceholders } from "./editorialImageUtils";

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

  return { title, body: bodyLines.join('\n') };
}

export async function exportVisualSnapshotPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    const dataUrl = await htmlToImage.toPng(element, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: "#ffffff"
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(dataUrl);
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth;
    const imgHeight = (imgProps.height * pageWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Không thể tạo bản chụp PDF. Vui lòng thử lại sau.');
  }
}

export async function exportToWord(title: string, content: string, filename: string, illustrations: EditorialIllustration[] = []) {
  if (!title.trim() && !content.trim()) {
    throw new Error("Nội dung bài viết trống, không thể xuất.");
  }
  
  const approved = illustrations.filter(isPublishableIllustration);
  
  if (hasUnapprovedPlaceholders(content, approved)) {
    // We can output a warning or just proceed depending on caller. The caller should check preflight.
  }

  const paragraphs = splitParagraphs(content);
  
  const children: Paragraph[] = [];

  // Add Title
  if (title.trim()) {
    children.push(new Paragraph({
      text: title,
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

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p && !(grouped.has(i))) continue;
    
    let heading: any = undefined;
    let text = p;
    let isBullet = false;
    let isNumbered = false;

    if (p.startsWith('### ')) {
      text = p.replace('### ', '');
      heading = HeadingLevel.HEADING_3;
    } else if (p.startsWith('## ')) {
      text = p.replace('## ', '');
      heading = HeadingLevel.HEADING_2;
    } else if (p.startsWith('# ')) {
      text = p.replace('# ', '');
      heading = HeadingLevel.HEADING_1;
    } else if (p.startsWith('- ') || p.startsWith('* ')) {
      text = p.substring(2).trim();
      isBullet = true;
    } else if (/^\d+\. /.test(p)) {
      text = p.replace(/^\d+\. /, '').trim();
      isNumbered = true;
    }

    const textWithoutImages = text.replace(/!\[.*?\]\(.*?\)/g, '');
    const parts = textWithoutImages.split(/(\*\*.*?\*\*)/g);
    const textRuns = parts.reduce((acc: TextRun[], part) => {
      if (!part) return acc;
      if (part.startsWith('**') && part.endsWith('**')) {
        acc.push(new TextRun({ 
          text: part.slice(2, -2), 
          bold: true, 
          font: "Times New Roman", 
          size: 28 
        }));
      } else {
        acc.push(new TextRun({ 
          text: part, 
          font: "Times New Roman", 
          size: 28 
        }));
      }
      return acc;
    }, []);

    if (textRuns.length > 0 || heading) {
      const pOptions: any = {
        children: textRuns,
        heading,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: 360, before: heading ? 400 : 0, after: 200 }
      };

      if (isBullet) {
        pOptions.numbering = { reference: "vms-bullet", level: 0 };
      } else if (isNumbered) {
        pOptions.numbering = { reference: "vms-numbered", level: 0 };
      }

      children.push(new Paragraph(pOptions));
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
