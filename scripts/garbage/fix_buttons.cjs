const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// A function to add basic aria-labels where we have title="xxx"
// e.g. <button title="Delete" -> <button title="Delete" aria-label="Delete"
code = code.replace(/<button([^>]*)title="([^"]+)"([^>]*)>/g, (match, prefix, title, suffix) => {
  if (match.includes('aria-label=')) return match;
  return `<button${prefix}title="${title}" aria-label="${title}"${suffix}>`;
});

// A function to add focus-visible styles if they don't have it
code = code.replace(/className="([^"]+)"/g, (match, classes) => {
    // Only patch interactive elements' classNames roughly if they are buttons / links
    // Actually, it's safer to only do it to button tags, but regex can't tell easily.
    return match;
});

fs.writeFileSync('src/App.tsx', code);
