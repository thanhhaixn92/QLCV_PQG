export async function extractPdfText(buffer: Buffer): Promise<string> {
  const mod: any = await import('pdf-parse');

  if (typeof mod.default === 'function') {
    const data = await mod.default(buffer);
    return data?.text || '';
  }

  if (typeof mod.PDFParse === 'function') {
    const parser = new mod.PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result?.text || String(result || '');
    } finally {
      await parser.destroy?.();
    }
  }

  if (typeof mod === 'function') {
    const data = await mod(buffer);
    return data?.text || '';
  }

  throw new Error('Không nhận diện được API pdf-parse hiện tại.');
}
