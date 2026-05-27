const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const newApp = [
  ...lines.slice(0, 5352),
  '                    <HistoryWorkspace',
  '                      historySearchQuery={historySearchQuery}',
  '                      setHistorySearchQuery={setHistorySearchQuery}',
  '                      createNewSession={createNewSession}',
  '                      sessions={sessions}',
  '                      cleanDisplayTitle={cleanDisplayTitle}',
  '                      loadSession={loadSession}',
  '                      requestConfirmAsync={requestConfirmAsync}',
  '                      user={user}',
  '                      setSessions={setSessions}',
  '                      logActivity={logActivity}',
  '                    />',
  ...lines.slice(5534)
].join('\n');

let finalApp = `import { HistoryWorkspace } from "./components/history/HistoryWorkspace";\n` + newApp;

fs.writeFileSync('src/App.tsx', finalApp);
