const fs = require('fs');

const block = fs.readFileSync('block.txt', 'utf8');

const componentCode = `import React from 'react';
import { 
  Layers, Plus, User, Briefcase, Edit3, Users, Database, BookOpen, Trash2, 
  Search, ExternalLink, Clock, Folder, CheckSquare, Eye, FileText, Image as ImageIcon,
  MoreVertical, Share2, Activity, Link as LinkIcon, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { DocumentSource, TASK_CATEGORIES } from '../../types';

export const LibraryWorkspace = (props: any) => {
  const {
    // Destructure all needed props from props
  } = props;

  return (
${block}
  );
};
`;

fs.writeFileSync('src/components/library/LibraryWorkspace.tsx', componentCode);
