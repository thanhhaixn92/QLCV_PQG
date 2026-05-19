export interface DocumentChunk {
  id?: string;
  documentId: string;
  text: string;
  title?: string;
  keywords: string[];
  pageNumber?: number;
  section?: string;
  createdAt: number;
}
