const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const block = lines.slice(5266, 7102).join('\n');
fs.writeFileSync('editor_block.txt', block);
