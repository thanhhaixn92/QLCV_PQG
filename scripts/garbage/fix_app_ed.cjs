const fs = require('fs');

const missingPropsEd = [
  'setTaskType', 'user', 'selectedSourceDocIds', 'documents', 'setIsPickingFromLibrary',
  'handleSaveSlideOutline', 'handleCreateTaskFromSlideOutline', 'safeParseSlideOutline',
  'output', 'TASK_GROUPS', 'TaskType', 'taskType', 'formatOptions', 'outputFormat',
  'OutputFormat', 'setOutputFormat', 'setSourceActiveTab', 'sourceActiveTab',
  'searchQuery', 'setSearchQuery', 'handleWebSearch', 'isLoading', 'searchResults',
  'getHostname', 'addSearchResultAsSource', 'newTextName', 'setNewTextName',
  'newTextContent', 'setNewTextContent', 'saveToLibrary', 'setSaveToLibrary',
  'handleAddText', 'newLinkUrl', 'setNewLinkUrl', 'handleAddLink', 'isParsing',
  'fileInputRef', 'getDocTypeLabel', 'getSourceTypeLabel', 'toggleDocSelection',
  'setInput', 'setOutput', 'setError', 'editorialKind', 'setEditorialKind',
  'isBuildingTasks', 'handleBuildTasks', 'handleProcess', 'builtTasks', 'setBuiltTasks',
  'saveBuiltTasks', 'persistTask', 'toast', 'error', 'outputRef', 'setIsEditing',
  'isEditing', 'currentSessionId', 'sessions', 'handleCopy', 'copySuccess',
  'saveCurrentToSession', 'handleLocalIllustrationScan', 'isPlanningImages',
  'handleAIIllustrationSuggestions', 'setSelectingParagraphForImage',
  'auditEditorialPublish', 'illustrations', 'requestConfirmAsync', 'logActivity',
  'stripResolvedPlaceholders', 'removeBrokenMarkdownImages', 'imagePlans',
  'approveAllValidIllustrations', 'clearErrorImages', 'handleManualUpload',
  'approveIllustration', 'rejectIllustration', 'setIllustrations', 'contentReview',
  'isPublishableIllustration', 'updateImageLoadStatus',
  'insertApprovedIllustrationsForPlainExport'
];

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const propsStr = missingPropsEd.map(p => `${p}={${p}}`).join('\n                      ');
appCode = appCode.replace(
  '                    <EditorWorkspace />',
  `                    <EditorWorkspace \n                      ${propsStr}\n                    />`
);

let importStr = `import { EditorWorkspace } from "./components/editorial/EditorWorkspace";\n`;
appCode = importStr + appCode;

fs.writeFileSync('src/App.tsx', appCode);
