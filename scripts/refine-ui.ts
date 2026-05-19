import * as fs from 'fs';
import * as path from 'path';

function walkDir(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Reduce uppercase / tracking
    content = content.replace(/uppercase tracking-widest/g, 'font-medium text-xs text-slate-500');
    content = content.replace(/uppercase tracking-wider/g, 'tracking-wide');
    
    // Some buttons should keep uppercase but maybe not all labels.
    // Let's just remove 'uppercase' from text-[10px] and text-[11px] if it feels too much?
    // Instruction: "Giảm font-black, uppercase, tracking-widest không cần thiết."
    content = content.replace(/font-black/g, 'font-bold');
    
    // Change large border radius to lg for b2b feel
    content = content.replace(/rounded-2xl/g, 'rounded-lg');
    content = content.replace(/rounded-xl/g, 'rounded-lg');
    
    // Reduce heavy shadows
    content = content.replace(/shadow-lg/g, 'shadow-sm');
    content = content.replace(/shadow-xl/g, 'shadow-md');
    content = content.replace(/shadow-2xl/g, 'shadow-md');

    // Sidebar specifically requested: desktop full, tablet compact, mobile drawer.
    // This is a layout change.

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated: ' + filePath);
    }
  }
});
