const fs = require('fs');

let code = fs.readFileSync('src/components/editorial/EditorWorkspace.tsx', 'utf8');

code = code.replace(
  'import { exportToWord } from \'../../lib/exportUtils\';',
  'import { exportToWord, exportToPdf } from \'../../lib/export\';\nimport { TaskType, OutputFormat } from \'../../types\';'
);

code = code.replace(
  "'TaskType', 'taskType', 'formatOptions', 'outputFormat',\n    'OutputFormat', 'setOutputFormat'",
  "'taskType', 'formatOptions', 'outputFormat',\n    'setOutputFormat', 'input'"
);

code = code.replace(
  "CheckCircle, ReactMarkdown\n} from 'lucide-react';",
  "CheckCircle, ReactMarkdown, CheckCircle2\n} from 'lucide-react';"
);

fs.writeFileSync('src/components/editorial/EditorWorkspace.tsx', code);
