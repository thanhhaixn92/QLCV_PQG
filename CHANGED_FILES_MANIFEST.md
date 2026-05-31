# CHANGED FILES MANIFEST

Package: feat/article-table-block-foundation v2
Purpose: Apply production changed files for ArticleDocument/A4 Preview table foundation before Draft Library redesign.

Included files:
- src/lib/publishing/articleDocumentAdapter.ts
- src/lib/publishing/articleExportModel.ts
- src/lib/publishing/articleExportAdapter.ts
- src/lib/publishing/htmlExport.ts
- src/components/editorial/A4PrintPreview.tsx
- src/index.css

Excluded from AI Studio runtime ZIP:
- scripts/smoke-table-block.mjs (development smoke-test helper; not needed for AI Studio runtime apply)

Safety notes:
- No package.json/package-lock.json changes.
- No server.ts changes.
- No metadata.json changes.
- No .env or secret files.
- No Firebase/Auth/Task/API key files.
- No generated PDF/DOCX/ZIP/test output files.
