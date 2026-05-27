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

let code = fs.readFileSync('src/components/library/LibraryWorkspace.tsx', 'utf8');
code = code.replace(
  '  const {\n    // Destructure all needed props from props\n  } = props;',
  `  const { \n    ${missingProps.join(', ')}\n  } = props;`
);

fs.writeFileSync('src/components/library/LibraryWorkspace.tsx', code);
