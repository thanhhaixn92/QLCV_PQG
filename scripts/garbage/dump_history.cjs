const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const block = lines.slice(5352, 5534).join('\n');
fs.writeFileSync('history_block.txt', block);
