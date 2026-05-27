const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let code = fs.readFileSync(fullPath, 'utf8');
      
      let modified = false;

      const updatedCode = code.replace(/<button([^>]*)title="([^"]+)"([^>]*)>/g, (match, prefix, title, suffix) => {
        if (match.includes('aria-label=')) return match;
        modified = true;
        return `<button${prefix}title="${title}" aria-label="${title}"${suffix}>`;
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, updatedCode);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.join(process.cwd(), 'src'));
