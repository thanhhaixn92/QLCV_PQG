const fs = require('fs');

const missingProps = [
  'closeMobileDrawer', 'setIsAddingLibrary', 'libraryCollections', 'setActiveLibraryId',
  'activeLibraryId', 'documents', 'setEditingCollection', 'requestConfirmAsync',
  'deleteLibraryCollection', 'librarySearchQuery', 'setLibrarySearchQuery',
  'bulkSelectedDocIds', 'deleteSelectedDocuments', 'repairLegacyDriveLinks',
  'setIsAddingText', 'setIsAddingLink', 'fileInputRef', 'libraryFilters',
  'setLibraryFilters', 'DOCUMENT_KIND_LABELS', 'toast', 'apiFetchJson',
  'getChatAuthToken', 'backgroundTasks', 'setBackgroundTasks', 'filteredDocs',
  'getDocTypeLabel', 'setBulkSelectedDocIds', 'setDocumentMenuDocId',
  'documentMenuDocId', 'handleAnalyzeDocument', 'isAnalyzing', 'getDocumentOpenUrl',
  'handleSyncDriveFolder', 'isSyncingDrive', 'setEditingDocument', 'setDocEditForm',
  'setIsEditingDocModalOpen', 'archiveDocument', 'removeDocument', 'formatLibraryDate',
  'openDocumentPreview', 'setIsPickingTaskForDoc'
];

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const propsStr = missingProps.map(p => `${p}={${p}}`).join('\n                      ');
appCode = appCode.replace(
  '                    <LibraryWorkspace />',
  `                    <LibraryWorkspace \n                      ${propsStr}\n                    />`
);

let importStr = `import { LibraryWorkspace } from "./components/library/LibraryWorkspace";\n`;
appCode = importStr + appCode;

fs.writeFileSync('src/App.tsx', appCode);
