const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
const start = code.indexOf('<HomeWorkspace');
let end = code.indexOf('/>', start);
if (start !== -1 && end !== -1) {
  code = code.substring(0, start) + `<HomeWorkspace
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
                        setIsChatOpen(true);
                        setChatInput("Tôi muốn lập kế hoạch công việc cho...");
                      }}
                      setEditingTask={setEditingTask}
                      setActiveModal={setActiveModal}
                    />` + code.substring(end + 2);
}
fs.writeFileSync('src/App.tsx', code);
