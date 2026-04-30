import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Rename selectedDocIds to selectedSourceDocIds
content = content.replace(/const \[selectedDocIds, setSelectedDocIds\] = useState<string\[\]>\(\[\]\);/, 'const [selectedSourceDocIds, setSelectedSourceDocIds] = useState<string[]>([]);\n  const [bulkSelectedDocIds, setBulkSelectedDocIds] = useState<string[]>([]);');

content = content.replace(/linkedDocumentIds: selectedDocIds,/g, 'linkedDocumentIds: selectedSourceDocIds,');
content = content.replace(/documentIds: selectedDocIds,/g, 'documentIds: selectedSourceDocIds,');
content = content.replace(/selectedDocIds\.length/g, 'selectedSourceDocIds.length');
content = content.replace(/selectedDocIds\.join/g, 'selectedSourceDocIds.join');
content = content.replace(/selectedDocIds\.includes/g, 'selectedSourceDocIds.includes');
content = content.replace(/setSelectedDocIds/g, 'setSelectedSourceDocIds');

// Restore the bulk selected logic for the delete button
// Search for bulk delete function: handleBulkDeleteDocs
const handleBulkDelOld = `    if (selectedSourceDocIds.length === 0) return;
    if (!confirm(\`Bạn có chắc chắn muốn xóa \${selectedSourceDocIds.length} tài liệu đã chọn?\`)) return;`;
const handleBulkDelNew = `    if (bulkSelectedDocIds.length === 0) return;
    if (!confirm(\`Bạn có chắc chắn muốn xóa \${bulkSelectedDocIds.length} tài liệu đã chọn khỏi hệ thống?\`)) return;`;
content = content.replace(handleBulkDelOld, handleBulkDelNew);

content = content.replace(/for \(const id of selectedSourceDocIds\) {/g, 'for (const id of bulkSelectedDocIds) {');
content = content.replace(/const updated = prev\.filter\(d => !selectedSourceDocIds\.includes\(d\.id\)\);/g, 'const updated = prev.filter(d => !bulkSelectedDocIds.includes(d.id));\n         setBulkSelectedDocIds([]);');

// The toolbar delete button around line 4930
const toolbarBtnOld = `{selectedSourceDocIds.length > 0 && (
                     <button 
                       onClick={handleBulkDeleteDocs}
                       className="px-4 py-2 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                     >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa ({selectedSourceDocIds.length})
                     </button>
                  )}`;
const toolbarBtnNew = `{bulkSelectedDocIds.length > 0 && (
                     <button 
                       onClick={handleBulkDeleteDocs}
                       className="px-4 py-2 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                     >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa ({bulkSelectedDocIds.length})
                     </button>
                  )}`;
content = content.replace(toolbarBtnOld, toolbarBtnNew);

// Add checkbox for bulk selection on the document card
// We will replace the hover opacity class
content = content.replace('className="flex items-center gap-1 relative z-10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"', 'className="flex items-center gap-1 relative z-10 opacity-100 transition-all"');

// And add a bulk select checkbox to the document card next to the others?
const actionBtns = `                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedSourceDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                 }}`;
const newActionBtns = `                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setBulkSelectedDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                 }}
                                 className={cn(
                                   "p-2 rounded-xl transition-all active:scale-90 shadow-sm border",
                                   bulkSelectedDocIds.includes(doc.id) ? "bg-red-500 text-white border-red-400" : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                 )}
                                 title={bulkSelectedDocIds.includes(doc.id) ? "Bỏ chọn xóa" : "Chọn để xóa"}
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setSelectedSourceDocIds(prev => prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]);
                                 }}`;
content = content.replace(actionBtns, newActionBtns);


fs.writeFileSync('src/App.tsx', content);
