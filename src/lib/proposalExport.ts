import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType, PageBreak } from "docx";
import { saveAs } from "file-saver";
import { 
  Proposal, 
  ProposalOutlineItem, 
  ProposalDraft, 
  ProposalSource, 
  ProposalChecklistItem, 
  ProposalDataRequirement,
  ProposalEvidenceLink
} from "../features/proposals/types";
import { jsPDF } from "jspdf";

/**
 * Export Proposal to Word (Docx)
 */
export async function exportProposalToWord(
  proposal: Proposal,
  outlineItems: ProposalOutlineItem[],
  drafts: ProposalDraft[],
  sources: ProposalSource[],
  evidenceLinks: ProposalEvidenceLink[],
  checklistItems: ProposalChecklistItem[],
  dataRequirements: ProposalDataRequirement[]
) {
  const children: any[] = [];

  // 1. Title Page / Header
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
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              width: { size: 50, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true})], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true})], alignment: AlignmentType.CENTER })
              ],
              borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
              width: { size: 50, type: WidthType.PERCENTAGE }
            })
          ]
        })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 } }
    }),
    new Paragraph({ spacing: { after: 1200 } })
  );

  children.push(
    new Paragraph({
      children: [new TextRun({ text: "ĐỀ ÁN", bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: proposal.name.toUpperCase(), bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 1200 }
    })
  );

  // 2. Main content based on outline
  const sortedOutline = [...outlineItems].sort((a, b) => a.order - b.order);
  
  for (const item of sortedOutline) {
    const draft = drafts.find(d => d.outlineItemId === item.id);
    const headingLevel = item.level === 1 ? HeadingLevel.HEADING_1 : item.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
    
    // Add Heading
    children.push(new Paragraph({
      text: `${item.code ? item.code + ' ' : ''}${item.title}`,
      heading: headingLevel,
      spacing: { before: 400, after: 200 }
    }));

    if (draft && draft.content) {
      // Split content into paragraphs
      const lines = draft.content.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, font: "Times New Roman", size: 28 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360, after: 200 }
        }));
      });
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: "[Chưa có nội dung]", italics: true, color: "999999", font: "Times New Roman", size: 28 })],
        spacing: { after: 200 }
      }));
    }
  }

  // 3. Appendices
  children.push(new PageBreak());
  children.push(new Paragraph({
    text: "PHỤ LỤC",
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));

  // Appendix A: Sources
  children.push(new Paragraph({
    text: "Phụ lục 1: Danh mục tài liệu nguồn & Bằng chứng",
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 }
  }));

  if (evidenceLinks.length > 0) {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tên tài liệu", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Loại", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Mục liên kết", bold: true })] })] })
        ]
      })
    ];

    evidenceLinks.forEach(link => {
      const source = sources.find(s => s.id === link.sourceId);
      const target = sortedOutline.find(o => o.id === link.targetId);
      
      tableRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: source?.name || "N/A" })] }),
          new TableCell({ children: [new Paragraph({ text: source?.type?.toUpperCase() || "N/A" })] }),
          new TableCell({ children: [new Paragraph({ text: target ? `${target.code} ${target.title}` : link.targetType })] })
        ]
      }));
    });

    children.push(new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }));
  } else {
    children.push(new Paragraph({ text: "Không có tài liệu nguồn được gắn." }));
  }

  // Appendix B: Checklist
  children.push(new Paragraph({
    text: "Phụ lục 2: Checklist kiểm soát chất lượng",
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 }
  }));

  const checklistRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tiêu chí", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Trạng thái", bold: true })] })] })
      ]
    })
  ];

  checklistItems.forEach(item => {
    checklistRows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: item.title })] }),
        new TableCell({ children: [new Paragraph({ text: item.status === 'pass' ? "Đạt" : item.status === 'needs_review' ? "Chờ duyệt" : "Chưa đạt" })] })
      ]
    }));
  });

  children.push(new Table({
    rows: checklistRows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  }));

  // Appendix C: Missing Data
  const missingData = dataRequirements.filter(d => d.status === 'missing');
  if (missingData.length > 0) {
    children.push(new Paragraph({
      text: "Phụ lục 3: Danh sách số liệu còn thiếu",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 }
    }));

    const dataRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Tên số liệu/Dữ kiện", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Đơn vị chủ trì", bold: true })] })] })
        ]
      })
    ];

    missingData.forEach(item => {
      dataRows.push(new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: item.title })] }),
          new TableCell({ children: [new Paragraph({ text: item.responsibleUnit || "N/A" })] })
        ]
      }));
    });

    children.push(new Table({
      rows: dataRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    }));
  }

  const doc = new Document({
    creator: "VMS Navigator",
    title: proposal.name,
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 28,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: "2cm", right: "2cm", bottom: "2cm", left: "3cm" }
        }
      },
      children: children
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `DeAn_${proposal.name.replace(/\s+/g, '_')}.docx`);
}

/**
 * Export Proposal to PDF
 * Note: Simplistic text-only export using jsPDF as we don't have a headless browser for HTML-to-PDF in client-side easily
 */
export async function exportProposalToPDF(
  proposal: Proposal,
  outlineItems: ProposalOutlineItem[],
  drafts: ProposalDraft[]
) {
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("ĐỀ ÁN", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.text(proposal.name.toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 20;

  const sortedOutline = [...outlineItems].sort((a, b) => a.order - b.order);

  for (const item of sortedOutline) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    const draft = drafts.find(d => d.outlineItemId === item.id);
    
    doc.setFont("times", "bold");
    doc.setFontSize(item.level === 1 ? 14 : 12);
    const title = `${item.code ? item.code + ' ' : ''}${item.title}`;
    doc.text(title, margin, y);
    y += 10;

    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const content = draft && draft.content ? draft.content : "[Chưa có nội dung]";
    const lines = doc.splitTextToSize(content, pageWidth - 2 * margin);
    
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 6;
    }
    y += 4;
  }

  doc.save(`DeAn_${proposal.name.replace(/\s+/g, '_')}.pdf`);
}
