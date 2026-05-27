const fs = require('fs');

let code = fs.readFileSync('src/components/editorial/EditorWorkspace.tsx', 'utf8');

code = code.replace(
  "import { exportToWord, exportToPdf } from '../../lib/export';",
  "import { exportToWord, exportToPdf } from '../../lib/exportUtils';"
);

code = code.replace(
  "CheckCircle, ReactMarkdown, CheckCircle2\n} from 'lucide-react';",
  "CheckCircle, ReactMarkdown, CheckCircle2, FileDown\n} from 'lucide-react';"
);

code = code.replace(/import \{ exportToWord \} from '\.\/lib\/exportUtils';/g, '');

fs.writeFileSync('src/components/editorial/EditorWorkspace.tsx', code);
