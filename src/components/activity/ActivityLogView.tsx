import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { ActivityLogEntry, ActivityModule } from '../../types';
import { cn } from '../../lib/utils';
import { Clock, Database, CheckSquare, Edit3, Settings, StickyNote, ChevronRight, X, User } from 'lucide-react';

function formatDistanceToNowVi(date: number) {
  const diffInSeconds = Math.floor((Date.now() - date) / 1000);
  if (diffInSeconds < 60) return "Vừa xong";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
  return new Date(date).toLocaleDateString('vi-VN');
}

interface Props {
  onClose?: () => void;
  onOpenEntity?: (entityType: string, entityId: string) => void;
}

import { getRenderKey } from '../../utils/listKeys';

export function ActivityLogView({ onClose, onOpenEntity }: Props) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActivityModule>('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
        setLoading(false);
        return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'activityLogs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: ActivityLogEntry[] = [];
      snapshot.forEach(doc => docs.push(doc.data() as ActivityLogEntry));
      setLogs(docs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching activity logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = activeTab === 'all' 
    ? logs 
    : logs.filter(log => log.module === activeTab);

  const getModuleIcon = (module: ActivityModule) => {
    switch (module) {
      case 'library': return <Database className="w-4 h-4 text-emerald-600" />;
      case 'task': return <CheckSquare className="w-4 h-4 text-blue-600" />;
      case 'editorial': return <Edit3 className="w-4 h-4 text-purple-600" />;
      case 'note': return <StickyNote className="w-4 h-4 text-amber-600" />;
      case 'system': return <Settings className="w-4 h-4 text-slate-600" />;
      default: return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getModuleLabel = (module: ActivityModule) => {
    switch (module) {
      case 'all': return 'Tất cả';
      case 'library': return 'Kho tư liệu';
      case 'task': return 'Công việc';
      case 'editorial': return 'Biên tập';
      case 'note': return 'Ghi chú';
      case 'system': return 'Hệ thống';
      default: return 'Khác';
    }
  };

  const tabs: ActivityModule[] = ['all', 'library', 'task', 'editorial', 'note', 'system'];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="p-6 border-b border-slate-200 bg-white shrink-0 flex items-center gap-4 justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-600" />
            Nhật ký hoạt động
          </h2>
          <p className="text-xs font-medium text-slate-500 mt-1">Theo dõi các thay đổi trong hệ thống của bạn</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-md hover:bg-slate-200">
             <X className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      <div className="border-b border-slate-200 bg-white px-2 shrink-0 py-2 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 px-4 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-md text-[11px] font-semibold tracking-normal transition-all",
                activeTab === tab
                  ? "bg-[#002D56] text-white shadow-md shadow-[#002D56]/20"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent hover:border-slate-200"
              )}
            >
              {getModuleLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar relative block">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Clock className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-sm font-bold text-slate-400 tracking-normal">Chưa có nhật ký nào</h3>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {filteredLogs.map((log, idx) => (
              <div 
                key={getRenderKey("activity-log", log, idx)} 
                className="bg-white p-4 rounded-md border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-4"
                onClick={() => setSelectedLog(log)}
              >
                <div className="mt-1 shrink-0 p-2 bg-slate-50 rounded-md border border-slate-100">
                  {getModuleIcon(log.module)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h4 className="text-sm font-bold text-slate-800 leading-tight">
                      {log.title}
                    </h4>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap shrink-0">
                      {formatDistanceToNowVi(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3 line-clamp-2">
                    {log.summary}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                       "px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-normal border",
                       log.module === 'library' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                       log.module === 'task' ? "bg-blue-50 text-blue-700 border-blue-100" :
                       log.module === 'editorial' ? "bg-purple-50 text-purple-700 border-purple-100" :
                       log.module === 'note' ? "bg-amber-50 text-amber-700 border-amber-100" :
                       "bg-slate-50 text-slate-700 border-slate-200"
                    )}>
                      {getModuleLabel(log.module)}
                    </span>
                    {log.actor?.displayName && (
                      <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                        <User className="w-3 h-3" /> {log.actor.displayName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-96 bg-white shadow-sm border-l border-slate-200 z-50 flex flex-col animate-in slide-in-from-right-4 duration-300">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
            <h3 className="text-sm font-semibold tracking-normal text-[#002D56]">Chi tiết nhật ký</h3>
            <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-slate-200 rounded-md bg-white shadow-sm">
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
               <div className="flex items-start gap-3 mb-2">
                  <div className="p-2 bg-slate-100 rounded-md shrink-0">
                     {getModuleIcon(selectedLog.module)}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800 leading-tight mb-1">{selectedLog.title}</h4>
                    <p className="text-[11px] font-bold text-slate-400">
                       {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
               </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-md border border-slate-100 text-sm text-slate-700 leading-relaxed font-medium">
               {selectedLog.summary}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-[9px] font-semibold tracking-normal text-slate-400 mb-1">Mô-đun</label>
                  <p className="text-xs font-bold text-slate-700">{getModuleLabel(selectedLog.module)}</p>
               </div>
               <div>
                  <label className="block text-[9px] font-semibold tracking-normal text-slate-400 mb-1">Loại thay đổi</label>
                  <p className="text-xs font-bold text-slate-700">{selectedLog.action}</p>
               </div>
               {selectedLog.entityTitle && (
                  <div className="col-span-2">
                     <label className="block text-[9px] font-semibold tracking-normal text-slate-400 mb-1">Đối tượng/Tệp</label>
                     <p className="text-xs font-bold text-[#002D56]">{selectedLog.entityTitle}</p>
                  </div>
               )}
               {selectedLog.actor?.displayName && (
                  <div className="col-span-2">
                     <label className="block text-[9px] font-semibold tracking-normal text-slate-400 mb-1">Người thực hiện</label>
                     <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> {selectedLog.actor.displayName} ({selectedLog.actor.email})
                     </p>
                  </div>
               )}
            </div>

            {selectedLog.changedFields && selectedLog.changedFields.length > 0 && (
               <div>
                  <label className="block text-[9px] font-semibold tracking-normal text-slate-400 mb-2">Trường dữ liệu đã đổi</label>
                  <div className="flex flex-wrap gap-2">
                     {selectedLog.changedFields.map((f, fIdx) => (
                        <span key={`change-field-${f}-${fIdx}`} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md font-mono">{f}</span>
                     ))}
                  </div>
               </div>
            )}

            {onOpenEntity && selectedLog.entityId && (
               <div className="pt-4 border-t border-slate-100">
                  <button 
                     onClick={() => {
                        onOpenEntity(selectedLog.entityType, selectedLog.entityId!);
                     }}
                     className="w-full py-3 bg-[#002D56] text-white text-[11px] font-semibold tracking-normal rounded-md hover:bg-blue-900 transition-colors shadow-sm"
                  >
                     Xem đối tượng gốc
                  </button>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
