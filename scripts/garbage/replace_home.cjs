const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');
const lines = code.split('\n');

const newApp = [
  ...lines.slice(0, 4848),
  '                    <HomeWorkspace',
  '                      user={user}',
  '                      profile={profile}',
  '                      health={health}',
  '                      isAiCoreActive={isAiCoreActive}',
  '                      getGreeting={getGreeting}',
  '                      getUserDisplayName={getUserDisplayName}',
  '                      documents={documents}',
  '                      allTasks={allTasks}',
  '                      pendingTasksCount={pendingTasksCount}',
  '                      OverdueTasksCount={OverdueTasksCount}',
  '                      createNewSession={createNewSession}',
  '                      setActiveTab={setActiveTab}',
  '                      startQuickAction={startQuickAction}',
  '                      quickActions={quickActions}',
  '                    />',
  ...lines.slice(5256)
].join('\n');

let finalApp = `import { HomeWorkspace } from "./components/home/HomeWorkspace";\n` + newApp;

fs.writeFileSync('src/App.tsx', finalApp);
