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

let code = fs.readFileSync('src/components/editorial/EditorWorkspace.tsx', 'utf8');
code = code.replace(
  '  const {\n  } = props;',
  `  const {\n    ${missingPropsEd.join(', ')}\n  } = props;`
);

let importStr = `import {\n  ChevronDown, Files, Globe, Type, FileUp, Search, Loader2, Database,\n  FileText, X, ShieldCheck, User, Calendar, FileDown, CheckCircle,\n  Target, Target as Plus, Link as LinkIcon, Trash2, Edit3, Image as ImageIcon,\n  Save, Sparkles, CheckSquare, Zap, Target as Crosshair, Clock, Check, Copy, History, AlertCircle\n} from 'lucide-react';\nimport ReactMarkdown from 'react-markdown';\nimport { EditorialKindSelector } from './EditorialKindSelector';\nimport { EditorialInputForm } from './EditorialInputForm';\nimport { EditorialPreflightPanel } from './EditorialPreflightPanel';\nimport { exportToWord } from '../../lib/exportUtils';\n`;

code = code.replace(/import {.*?} from 'lucide-react';/s, importStr);
fs.writeFileSync('src/components/editorial/EditorWorkspace.tsx', code);
