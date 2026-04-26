import { jsPDF } from "jspdf";
import * as htmlToImage from 'html-to-image';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun } from "docx";
import { saveAs } from "file-saver";
import { EditorialIllustration } from "../types";
import { splitParagraphs, isPublishableIllustration } from "./editorialImageUtils";

async function fetchImageAsBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  const arr = await response.arrayBuffer();
  return new Uint8Array(arr);
}

export async function exportToPDF(elementId: string, filename: string) {
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
    throw new Error('Không thể tạo file PDF. Vui lòng thử lại sau.');
  }
}

export async function exportToWord(title: string, content: string, filename: string, illustrations: EditorialIllustration[] = []) {
  const approved = illustrations.filter(isPublishableIllustration);
  const paragraphs = splitParagraphs(content);
  
  const children: any[] = [];

  // Add Title
  children.push(new Paragraph({
    text: title.toUpperCase(),
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));

  const grouped = new Map<number, EditorialIllustration[]>();
  approved.forEach(img => {
    const arr = grouped.get(img.paragraphIndex) || [];
    arr.push(img);
    grouped.set(img.paragraphIndex, arr);
  });

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    
    // Determine the style of paragraph
    let heading: any = undefined;
    let text = p;
    let isListValue = false;
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
      text = p.substring(2);
      isListValue = true;
      isBullet = true;
    } else if (/^\d+\. /.test(p)) {
      text = p.replace(/^\d+\. /, '');
      isListValue = true;
      isNumbered = true;
    }

    // Process bold text and strip images
    const textWithoutImages = text.replace(/!\[.*?\]\(.*?\)/g, '');
    const parts = textWithoutImages.split(/(\*\*.*?\*\*)/g);
    const textRuns = parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return new TextRun({ 
          text: part.slice(2, -2), 
          bold: true, 
          font: "Times New Roman", 
          size: 28 
        });
      }
      return new TextRun({ 
        text: part, 
        font: "Times New Roman", 
        size: 28 
      });
    });

    children.push(new Paragraph({
      children: textRuns,
      heading,
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, before: heading ? 400 : 0, after: 200 },
      bullet: isBullet ? { level: 0 } : undefined,
      numbering: isNumbered ? { reference: 'my-numbering', level: 0 } : undefined,
    }));

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
    sections: [{
      properties: {},
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}
