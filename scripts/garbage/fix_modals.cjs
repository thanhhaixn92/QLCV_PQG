const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace standard static modal wrappers
code = code.replace(/<div className="fixed inset-0.*?z-\[1?[0-9]{2,3}\].*?">/g, (match) => {
  if (match.includes('role=')) return match;
  return match.replace('<div ', '<div role="dialog" aria-modal="true" ');
});

fs.writeFileSync('src/App.tsx', code);
