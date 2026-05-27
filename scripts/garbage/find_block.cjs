const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const block = lines.slice(7334, 8120).join('\n');
fs.writeFileSync('block.txt', block);


