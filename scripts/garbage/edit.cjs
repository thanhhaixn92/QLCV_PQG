const fs = require('fs');
const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');
const start = 5244; // line 5245 (0-based 5244)
const end = 5653; // line 5653 (0-based 5652)

const newLines = `                    <TasksTabWorkspace 
                      taskStats={taskStats}
                      filteredTasks={filteredTasks}
                      taskFilters={taskFilters}
                      setTaskFilters={setTaskFilters}
                      openTaskEditor={openTaskEditor}
                      handleDeleteTask={handleDeleteTask}
                      updateTaskStatus={updateTaskStatus}
                      documents={documents}
                    />`.split('\n');

lines.splice(start, end - start, ...newLines);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log('done');
