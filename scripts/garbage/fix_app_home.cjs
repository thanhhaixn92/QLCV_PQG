const fs = require('fs');

const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /<HomeWorkspace[^>]*\/>/,
  `<HomeWorkspace
    user={user}
    profile={profile}
    health={health}
    isAiCoreActive={isAiCoreActive}
    getGreeting={getGreeting}
    getUserDisplayName={getUserDisplayName}
    documents={documents}
    allTasks={allTasks}
    pendingTasksCount={pendingTasksCount}
    OverdueTasksCount={OverdueTasksCount}
    createNewSession={createNewSession}
    setActiveTab={setActiveTab}
    startQuickAction={startQuickAction}
    quickActions={quickActions}
    openCreateTask={() => {
      setEditingTask({} as any);
      setActiveModal("task-edit");
    }}
    openAiTaskBuilder={() => {
      // Stub or re-implement if needed
      setActiveModal("task-builder" as any);
    }}
  />`
);

fs.writeFileSync('src/App.tsx', updated);
