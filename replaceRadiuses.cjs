const fs = require('fs');

const files = [
  'src/App.tsx',
  'src/components/FloatingChatbox.tsx',
  'src/components/TaskEditModal.tsx',
  'src/components/activity/ActivityLogView.tsx',
  'src/components/UserProfileSection.tsx'
];

function replaceRadiuses(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace rounded-[XXpx] with rounded-md
  content = content.replace(/rounded-\[([0-9]+)px\]/g, 'rounded-md');
  
  // Replace rounded-3xl with rounded-lg
  content = content.replace(/rounded-3xl/g, 'rounded-lg');
  
  // Replace rounded-2xl with rounded-md
  content = content.replace(/rounded-2xl/g, 'rounded-md');

  // Replace rounded-xl with rounded-md
  content = content.replace(/rounded-xl/g, 'rounded-md');

  // Replace rounded-full with rounded-md, but keep rounded-full 
  // for things that are explicitly circles like w-8 h-8 rounded-full.
  // Actually, we should be careful with rounded-full because of avatars and icons.
  // Let's only replace rounded-full in buttons and badges.
  content = content.replace(/rounded-full/g, (match, offset, string) => {
    // If it's something like w-8 h-8 rounded-full, or w-4 h-4 rounded-full, keep it.
    const before = string.substring(Math.max(0, offset - 30), offset);
    if (/w-\d+/.test(before) && /h-\d+/.test(before)) {
      return 'rounded-full'; // likely a circle
    }
    // Also keep if it's rounded-full on absolute dots (w-2 h-2, etc.)
    if (/badge|dot|circle/i.test(before)) {
      return 'rounded-full';
    }
    return 'rounded-md';
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Processed', filePath);
}

files.forEach(replaceRadiuses);
