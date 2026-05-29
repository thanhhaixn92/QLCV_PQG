import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import { Shield, Users, Database, HardDrive, Search, Loader2, Lock, Unlock, History, AlertCircle, Settings2, Bot } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../../lib/firebase';
import { getRenderKey } from '../../utils/listKeys';

interface Props {
  profile: UserProfile | null;
  requestConfirmAsync: (msg: string) => Promise<boolean>;
}

export function AdminWorkspace({ profile, requestConfirmAsync }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'data' | 'storage' | 'stats' | 'system'>('users');

  if (profile?.role !== 'admin') {
    return (
      <div className="flex-1 p-8 text-center text-red-500 bg-white rounded-lg shadow border border-red-200 m-8">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Không có quyền truy cập</h2>
        <p className="mt-2">Bạn cần có quyền quản trị viên (Admin) để xem trang này.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white px-8 py-6 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Workspace</h1>
            <p className="text-sm text-slate-500">Khu vực quản trị hệ thống và kiểm soát truy cập</p>
          </div>
        </div>
        
        <div className="flex gap-4 mt-6 overflow-x-auto pb-2 custom-scrollbar">
          {[
            { id: 'users', label: 'Quản lý Người dùng', icon: Users },
            { id: 'storage', label: 'Quản lý File & Dung lượng', icon: HardDrive },
            { id: 'system', label: 'Trạng thái hệ thống', icon: Settings2 },
            { id: 'stats', label: 'Thống kê & Audit Logs', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                activeSubTab === tab.id 
                  ? 'bg-[#002D56] text-white shadow' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {activeSubTab === 'users' && <AdminUserList currentAdmin={profile} />}
        {activeSubTab === 'storage' && <AdminStorageView requestConfirmAsync={requestConfirmAsync} />}
        {activeSubTab === 'system' && <AdminSystemView requestConfirmAsync={requestConfirmAsync} />}
        {activeSubTab === 'stats' && <AdminAuditLogs />}
      </div>
    </div>
  );
}

async function adminFetch(endpoint: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Chưa đăng nhập");
  const token = await user.getIdToken();
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || data.error || 'Lỗi xử lý yêu cầu.');
  }
  return data;
}

function AdminUserList({ currentAdmin }: { currentAdmin: UserProfile }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminFetch('/api/admin/users');
      setUsers(data.users || []);
    } catch(err: any) {
      toast.error('Lỗi lấy danh sách user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateRole = async (uid: string, newRole: string) => {
    try {
      await adminFetch(`/api/admin/users/${uid}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole })
      });
      toast.success('Đã cập nhật quyền hạn');
      await fetchUsers();
    } catch (err: any) {
      toast.error('Lỗi đổi quyền: ' + err.message);
    }
  };

  const handleToggleLock = async (uid: string, locked: boolean) => {
    try {
      await adminFetch(`/api/admin/users/${uid}/lock`, {
        method: 'POST',
        body: JSON.stringify({ disabled: locked })
      });
      toast.success(locked ? 'Đã khóa tài khoản' : 'Đã mở khóa');
      await fetchUsers();
    } catch (err: any) {
      toast.error('Lỗi khóa tài khoản: ' + err.message);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 font-semibold tracking-wide">Người dùng</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Email</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Phân quyền</th>
            <th className="px-6 py-4 font-semibold tracking-wide">Trạng thái</th>
            <th className="px-6 py-4 font-semibold tracking-wide text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {users.map(u => (
            <tr key={u.uid} className={u.disabled ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
              <td className="px-6 py-4">
                <div className="font-semibold text-slate-900">{u.displayName || 'Chưa cập nhật'}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{u.uid}</div>
              </td>
              <td className="px-6 py-4">{u.email}</td>
              <td className="px-6 py-4">
                <select 
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-[#002D56] outline-none"
                  value={u.role}
                  onChange={(e) => handleUpdateRole(u.uid, e.target.value)}
                  disabled={u.uid === currentAdmin.uid}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="editor">Editor</option>
                  <option value="user">User</option>
                  <option value="readonly">Read-only</option>
                </select>
              </td>
              <td className="px-6 py-4">
                {u.disabled ? (
                   <span className="inline-flex items-center gap-1 text-red-600 bg-red-100 px-2 py-1 rounded-md text-xs font-bold"><Lock className="w-3 h-3" /> Bị khoá</span>
                ) : (
                   <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md text-xs font-bold"><Unlock className="w-3 h-3" /> Hoạt động</span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                <button 
                  onClick={() => handleToggleLock(u.uid, !u.disabled)}
                  disabled={u.uid === currentAdmin.uid}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    u.uid === currentAdmin.uid ? 'opacity-50 cursor-not-allowed bg-slate-100' :
                    u.disabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {u.disabled ? 'Mở khóa' : 'Khóa'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminDataView() {
  return (
    <div className="bg-white p-8 rounded-lg border border-slate-200 shadow-sm text-center">
       <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
       <h3 className="text-lg font-bold text-slate-700">Database Tools</h3>
       <p className="text-slate-500 mt-2">Tính năng dọn dẹp Document, Task rác đang được phát triển.</p>
    </div>
  );
}

function AdminSystemView({ requestConfirmAsync }: { requestConfirmAsync: (msg: string) => Promise<boolean> }) {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setHealthData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const handleBackup = async () => {
    try {
      const res = await adminFetch('/api/admin/system/backup', { method: 'POST' });
      toast.success(res.message);
    } catch(e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  const handleCleanup = async () => {
    if (!(await requestConfirmAsync('Hành động này sẽ xoá mềm các log hoạt động cũ hơn 180 ngày. Bạn có chắc chắn?'))) return;
    try {
      const res = await adminFetch('/api/admin/system/cleanup', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays: 180 })
      });
      toast.success(res.message);
    } catch(e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${healthData?.firestoreReady ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Database</h3>
          </div>
          <p className="text-sm text-slate-600">Trạng thái: <span className="font-semibold">{healthData?.firestoreReady ? 'Sẵn sàng' : 'Lỗi kết nối'}</span></p>
          <p className="text-xs text-slate-400 mt-2 truncate">ID: {healthData?.firestoreDatabaseId}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${healthData?.hasGeminiKey || healthData?.hasSystemGeminiKey ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">AI Services</h3>
          </div>
          <p className="text-sm text-slate-600">Trạng thái: <span className="font-semibold">{healthData?.hasSystemGeminiKey ? 'Sẵn sàng (System Key)' : 'Chờ cấu hình'}</span></p>
          <p className="text-xs text-slate-400 mt-2">API được thiết lập qua biến môi trường.</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${healthData?.hasGoogleDriveKey ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800">Cổng Google Drive</h3>
          </div>
          <p className="text-sm text-slate-600">Trạng thái: <span className="font-semibold">{healthData?.hasGoogleDriveKey ? 'Sẵn sàng' : 'Chưa thiết lập'}</span></p>
          <p className="text-xs text-slate-400 mt-2">Dùng để Import tập tin.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm overflow-hidden relative">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-[#002D56]" /> Vận hành bảo trì
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="border border-slate-100 p-5 rounded-lg bg-slate-50 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Backup dữ liệu</h4>
                <p className="text-xs text-slate-500 mb-4">Ghi nhận yêu cầu sao lưu toàn bộ Collection quan trọng (mô phỏng).</p>
                <button onClick={handleBackup} className="bg-[#002D56] text-white px-4 py-2 rounded text-xs font-bold hover:bg-slate-800 transition-colors">
                   Yêu cầu Backup
                </button>
              </div>
           </div>
           
           <div className="border border-slate-100 p-5 rounded-lg bg-slate-50 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Dọn dẹp hệ thống</h4>
                <p className="text-xs text-slate-500 mb-4">Ghi nhận yêu cầu xoá mềm các Activity Logs cũ (mô phỏng).</p>
                <button onClick={handleCleanup} className="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded text-xs font-bold transition-colors">
                   Yêu cầu dọn dẹp
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function AdminStorageView({ requestConfirmAsync }: { requestConfirmAsync: (msg: string) => Promise<boolean> }) {
  const [stats, setStats] = useState<{ fileCount: number; totalSize: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/admin/storage')
      .then(d => setStats({ fileCount: d.fileCount, totalSize: d.totalSize }))
      .catch(e => toast.error('Lỗi: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleClean = async () => {
    if (!(await requestConfirmAsync('Bạn có chắc muốn dọn dẹp các tệp cũ không? Hành động này không thể hoàn tác.'))) return;
    try {
      await adminFetch('/api/admin/storage/clean', { method: 'DELETE' });
      toast.success('Đã dọn dẹp');
    } catch(e: any) {
      toast.error('Lỗi: ' + e.message);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="bg-white p-8 rounded-lg border border-slate-200 shadow-sm text-center">
       <HardDrive className="w-12 h-12 text-[#002D56] mx-auto mb-4" />
       <h3 className="text-xl font-bold text-slate-700">Storage Explorer</h3>
       <div className="mt-6 flex flex-col items-center justify-center space-y-4">
         <div className="bg-blue-50 text-blue-900 rounded-lg p-4 w-64 border border-blue-100">
            <div className="text-3xl font-bold">{(stats?.totalSize ? stats.totalSize / (1024 * 1024) : 0).toFixed(2)} MB</div>
            <div className="text-xs font-semibold tracking-wide opacity-70 mt-1">Tổng dung lượng (Illustrations)</div>
         </div>
         <div className="bg-slate-50 text-slate-700 rounded-lg p-4 w-64 border border-slate-200">
            <div className="text-3xl font-bold">{stats?.fileCount || 0}</div>
            <div className="text-xs font-semibold tracking-wide opacity-70 mt-1">Tổng số tệp</div>
         </div>
       </div>

       <div className="mt-8">
          <button 
            onClick={handleClean}
            className="flex items-center gap-2 mx-auto bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg font-semibold transition-colors"
          >
             <AlertCircle className="w-4 h-4" /> Dọn dẹp tệp rác
          </button>
       </div>
    </div>
  );
}

function AdminAuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/admin/stats')
      .then(d => setLogs(d.auditLogs || []))
      .catch(e => toast.error('Lỗi tải audit logs: ' + e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="w-5 h-5 text-[#002D56]" /> Audit Logs gần đây</h3>
      {logs.length === 0 ? (
         <div className="text-slate-500 italic p-4 text-center border border-dashed rounded-lg">Chưa có hoạt động quản trị viên nào.</div>
      ) : (
        <div className="space-y-3">
          {logs.map((log: any, idx: number) => (
             <div key={getRenderKey("admin-log", log, idx)} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                   <div className="font-semibold text-slate-800 text-sm">Hành động: <span className="text-[#002D56] tracking-wide text-xs ml-1 bg-blue-100 px-2 py-0.5 rounded">{log.action}</span></div>
                   <div className="text-xs text-slate-500 mt-1">Từ Admin: <span className="font-mono">{log.adminUid}</span> &rarr; User: <span className="font-mono">{log.targetUid}</span></div>
                   {log.role && <div className="text-xs text-slate-500 mt-1">Role mới: <span className="font-bold text-emerald-600">{log.role}</span></div>}
                </div>
                <div className="text-xs text-slate-400 md:text-right mt-2 md:mt-0 font-medium">
                   {new Date(log.timestamp).toLocaleString('vi-VN')}
                </div>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
