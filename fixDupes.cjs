const fs = require('fs');

const files = [
  'src/App.tsx',
  'src/components/TaskEditModal.tsx',
  'src/components/FloatingChatbox.tsx',
];

function fixDupes(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/rounded-md sm:rounded-md/g, 'rounded-md lg:rounded-lg');
  content = content.replace(/rounded-lg sm:rounded-lg/g, 'rounded-lg');

  fs.writeFileSync(filePath, content, 'utf8');
}

files.forEach(fixDupes);
