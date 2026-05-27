const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/<HomeWorkspace[^>]*\/>/, `<HomeWorkspace
    user={user}
    profile={profile}
    health={health}
    isAiCoreActive={isAiCoreActive}
    getGreeting={getGreeting}
    getUserDisplayName={getUserDisplayName}
    documents={documents}
    allTasks={allTasks}
    createNewSession={createNewSession}
    setActiveTab={setActiveTab}
    openCreateTask={() => {
      setEditingTask({} as any);
      setActiveModal("task-edit");
    }}
    openAiTaskBuilder={() => {
      // In original code, it was likely another modal, or we can just open chat
      setIsChatOpen(true);
      setChatInput("Tôi muốn lập kế hoạch công việc cho...");
    }}
    setEditingTask={setEditingTask}
    setActiveModal={setActiveModal}
  />`);
fs.writeFileSync('src/App.tsx', code);
