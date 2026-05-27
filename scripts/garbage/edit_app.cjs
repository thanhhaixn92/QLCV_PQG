const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const newApp = [
  ...lines.slice(0, 7334),
  '                    <LibraryWorkspace />',
  ...lines.slice(8120)
].join('\n');

fs.writeFileSync('src/App.tsx', newApp);
