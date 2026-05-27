import React, { useState, useEffect } from 'react';
import { Folder, File, Loader2, Search, RefreshCw, ExternalLink, ChevronRight, Hash } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { auth } from '../lib/firebase';

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  iconLink?: string;
  modifiedTime?: string;
}

interface DriveFolderBrowserProps {
  folderId: string;
  folderName: string;
  onImportFile?: (file: DriveItem) => void;
  onSyncFolder?: (folderId: string, name: string) => void;
}

export const DriveFolderBrowser: React.FC<DriveFolderBrowserProps> = ({ 
  folderId, 
  folderName,
  onImportFile,
  onSyncFolder
}) => {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [path, setPath] = useState<{id: string, name: string}[]>([{id: folderId, name: folderName}]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  const fetchContents = async (id: string, pageToken?: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      toast.error('Vui lòng đăng nhập.');
      setLoading(false);
      return;
    }
    
    if (pageToken) setLoadingMore(true);
    else setLoading(true);
    
    try {
      const url = `/api/drive/folder-contents?folderId=${encodeURIComponent(id)}${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Lỗi tải nội dung thư mục');
      
      if (pageToken) {
        setItems(prev => [...prev, ...(data.files || [])]);
      } else {
        setItems(data.files || []);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchContents(folderId);
  }, [folderId]);

  const handleNavigate = (item: DriveItem) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      setPath(prev => [...prev, {id: item.id, name: item.name}]);
      fetchContents(item.id);
    }
  };

  const handleBack = (index: number) => {
    const newPath = path.slice(0, index + 1);
    setPath(newPath);
    fetchContents(newPath[newPath.length - 1].id);
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-md shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <Folder className="w-4 h-4 text-[#002D56] shrink-0" />
          <div className="flex items-center text-[10px] font-bold tracking-tight text-slate-500 overflow-x-auto no-scrollbar whitespace-nowrap">
            {path.map((p, i) => (
              <React.Fragment key={`path-${p.id}-${i}`}>
                <button 
                  onClick={() => handleBack(i)}
                  className={cn("hover:text-[#002D56] transition-colors", i === path.length - 1 ? "text-[#002D56]" : "")}
                >
                  {p.name}
                </button>
                {i < path.length - 1 && <ChevronRight className="w-3 h-3 mx-1 text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
           {onSyncFolder && (
             <button 
               onClick={() => onSyncFolder(path[path.length - 1].id, path[path.length - 1].name)}
               className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-md transition-all group"
               title="Đồng bộ toàn bộ thư mục này"
             >
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
             </button>
           )}
           <a 
             href={`https://drive.google.com/drive/folders/${path[path.length - 1].id}`}
             target="_blank"
             rel="noreferrer"
             className="p-2 hover:bg-blue-50 text-blue-600 rounded-md transition-all"
             title="Mở trong Google Drive"
           >
              <ExternalLink className="w-3.5 h-3.5" />
           </a>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm trong thư mục..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border-none rounded-md text-[11px] font-bold focus:ring-1 focus:ring-[#002D56]/10"
          />
        </div>
        <div className="text-[9px] font-bold text-slate-400 tracking-tight">
          {filteredItems.length} mục
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="h-40 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#002D56] animate-spin" />
            <span className="text-[10px] font-bold text-slate-400 font-medium text-xs text-slate-500">Đang đọc Drive...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center p-8 text-center">
            <Folder className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-[10px] font-bold text-slate-400 uppercase">Thư mục trống hoặc không tìm thấy mục nào</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredItems.map((item, idx) => {
              const kind = item.mimeType === 'application/vnd.google-apps.folder' ? 'drive_folder' : 'drive_file';
              return (
                <div 
                  key={`${kind}:${item.id}:${idx}`}
                  className="group flex items-center justify-between p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => item.mimeType === 'application/vnd.google-apps.folder' ? handleNavigate(item) : undefined}
                >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-8 h-8 rounded flex items-center justify-center shrink-0",
                    item.mimeType === 'application/vnd.google-apps.folder' ? "bg-blue-50 text-blue-500" : "bg-slate-50 text-slate-400"
                  )}>
                    {item.mimeType === 'application/vnd.google-apps.folder' ? <Folder className="w-4.5 h-4.5" /> : <File className="w-4.5 h-4.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-700 truncate group-hover:text-[#002D56] transition-colors">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-medium text-slate-400 tracking-tight">
                        {item.mimeType === 'application/vnd.google-apps.folder' ? 'Thư mục' : item.mimeType.split('.').pop()}
                      </span>
                      {item.size && (
                        <>
                          <span className="text-slate-200">•</span>
                          <span className="text-[9px] font-mono text-slate-400">{(parseInt(item.size)/1024/1024).toFixed(1)} MB</span>
                        </>
                      )}
                      {item.modifiedTime && (
                        <>
                          <span className="text-slate-200">•</span>
                          <span className="text-[9px] font-mono text-slate-400">{new Date(item.modifiedTime).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   {item.mimeType !== 'application/vnd.google-apps.folder' && onImportFile && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); onImportFile(item); }}
                       className="p-1.5 hover:bg-white text-slate-400 hover:text-[#002D56] rounded border border-transparent hover:border-slate-200 transition-all shadow-sm"
                       title="Import tài liệu này"
                     >
                       <RefreshCw className="w-3.5 h-3.5" />
                     </button>
                   )}
                   <a 
                     href={`https://drive.google.com/open?id=${item.id}`}
                     target="_blank"
                     rel="noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-600 rounded border border-transparent hover:border-slate-200 transition-all shadow-sm"
                     title="Xem trên Drive"
                   >
                     <ExternalLink className="w-3.5 h-3.5" />
                   </a>
                  </div>
                </div>
              );
            })}
            {nextPageToken && (
               <div className="p-4 flex justify-center">
                 <button 
                   onClick={() => fetchContents(path[path.length - 1].id, nextPageToken)}
                   disabled={loadingMore}
                   className="bg-slate-50 text-slate-500 px-4 py-2 rounded-md text-[10px] font-bold tracking-normal hover:bg-slate-100 transition-colors flex items-center gap-2"
                 >
                   {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                   Tải thêm
                 </button>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
