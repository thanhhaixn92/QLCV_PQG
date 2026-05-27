const fs = require('fs');

let code = fs.readFileSync('src/components/editorial/EditorWorkspace.tsx', 'utf8');

code = code.replace(
  "import { exportToWord, exportToPdf } from '../../lib/exportUtils';",
  "import { exportToWord } from '../../lib/exportUtils';"
);

code = code.replace(
  "History, AlertCircle\n} from 'lucide-react';",
  "History, AlertCircle, CheckCircle2, FileDown\n} from 'lucide-react';"
);

code = code.replace(
  'await import("./lib/exportUtils");',
  'await import("../../lib/exportUtils");'
);

code = code.replace(
  'await import("./lib/exportUtils");',
  'await import("../../lib/exportUtils");'
);

fs.writeFileSync('src/components/editorial/EditorWorkspace.tsx', code);
