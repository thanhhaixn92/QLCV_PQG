const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');
const block = lines.slice(4848, 5256).join('\n');
fs.writeFileSync('home_block.txt', block);
