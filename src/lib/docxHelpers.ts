import { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";

export const parseTextRuns = (text: string): TextRun[] => {
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

export const processDocxLine = (line: string): Paragraph | null => {
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

export const processMarkdownToDocxChildren = (content: string): any[] => {
  const children: any[] = [];
  const paragraphs = content.split(/\n\s*\n/);
  
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p) continue;
    
    if (p) {
      const lines = p.split('\n').filter(l => l.trim());
      const looksLikeTable = lines.length >= 2 && lines[1].includes('|') && lines[1].includes('-');
      
      if (looksLikeTable) {
        try {
          const tableRows = lines.filter((_, idx) => idx !== 1).map((line, rIndex) => {
            const cells = line.split('|').map(c => c.trim());
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
          lines.forEach(l => {
            const parsedLine = processDocxLine(l);
            if (parsedLine) children.push(parsedLine);
          });
        }
      } else {
        lines.forEach(l => {
          const parsedLine = processDocxLine(l);
          if (parsedLine) children.push(parsedLine);
        });
      }
    }
  }

  return children;
};
