const fs = require('fs');

const block = fs.readFileSync('home_block.txt', 'utf8');

const componentCode = `import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Database, Bot, HardDrive, ShieldCheck, PieChart, Play,
  FolderLock, RefreshCw, Layers, Edit3, ClipboardList, PenTool, BarChart3, Search, Image, ArrowRight, CheckSquare, FileText, Library, CheckCircle2, Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TaskType, OutputFormat, WritingStyle } from '../../types';

export const HomeWorkspace = (props: any) => {
  const {
    user, profile, health, isAiCoreActive, getGreeting, getUserDisplayName,
    documents, allTasks, pendingTasksCount, OverdueTasksCount, createNewSession,
    setActiveTab, startQuickAction, quickActions,
    openCreateTask, openAiTaskBuilder
  } = props;

  return (
    <>
\${block}
    </>
  );
};
`;

fs.writeFileSync('src/components/home/HomeWorkspace.tsx', componentCode);
