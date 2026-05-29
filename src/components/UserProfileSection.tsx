import React, { useState, useEffect } from 'react';
import { User, Shield, Briefcase, Phone, Tag, Save, CheckCircle2 } from 'lucide-react';
import { UserProfile, TASK_CATEGORIES } from '../types';
import toast from 'react-hot-toast';

interface UserProfileSectionProps {
  user: any;
  profile: UserProfile | null;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
}

export const UserProfileSection: React.FC<UserProfileSectionProps> = ({ user, profile, onSave }) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    displayName: '',
    title: '',
    department: '',
    phone: '',
    avatarText: '',
    defaultAssigneeName: '',
    defaultTaskCategoryCode: 'LV_DH'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        title: profile.title || '',
        department: profile.department || '',
        phone: profile.phone || '',
        avatarText: profile.avatarText || '',
        defaultAssigneeName: profile.defaultAssigneeName || '',
        defaultTaskCategoryCode: profile.defaultTaskCategoryCode || 'LV_DH'
      });
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        displayName: user.displayName || user.email?.split('@')[0] || '',
        avatarText: (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()
      }));
    }
  }, [profile, user]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success('Đã cập nhật thông tin cá nhân.');
    } catch (err: any) {
      toast.error('Lỗi lưu hồ sơ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-md border border-slate-200 p-8 text-center flex flex-col items-center">
            <div className="w-24 h-24 rounded-md bg-[#002D56] text-white flex items-center justify-center text-3xl font-semibold mb-4 shadow-md shadow-[#002D56]/20">
              {formData.avatarText || (formData.displayName?.[0] || 'U').toUpperCase()}
            </div>
            <h3 className="text-xl font-semibold text-slate-800 tracking-tight">{formData.displayName || 'Người dùng'}</h3>
            <p className="text-sm font-bold text-slate-400 tracking-normal mt-1">{formData.title || 'Chưa cập nhật chức danh'}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-semibold tracking-wide flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Đã xác thực
              </span>
              <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-semibold tracking-wide">
                {user?.isAnonymous ? "Khách (Anonymous)" : (user?.email || "Chưa có email")}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 rounded-md p-6 text-white overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-125 transition-transform duration-500">
                <Shield className="w-24 h-24" />
             </div>
             <p className="text-[10px] font-semibold tracking-normal text-white/40 mb-2 relative z-10">Bảo mật hệ thống</p>
             <h4 className="text-lg font-bold mb-4 relative z-10 leading-tight">Dữ liệu của bạn được mã hóa an toàn</h4>
             <button className="text-[10px] font-semibold uppercase bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md transition-all relative z-10">
                Xem chi tiết
             </button>
          </div>
        </div>

        {/* Right Column: Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-md border border-slate-200 p-8">
            <div className="flex items-center gap-3 mb-8">
               <div className="p-3 bg-blue-50 rounded-md">
                  <User className="w-6 h-6 text-[#002D56]" />
               </div>
               <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Hồ sơ cá nhân</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Họ và tên</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md pl-11 pr-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Chữ cái đại diện</label>
                <input 
                  type="text" 
                  maxLength={2}
                  value={formData.avatarText}
                  onChange={e => setFormData({ ...formData, avatarText: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                  placeholder="VD: NV"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Chức danh</label>
                <div className="relative">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md pl-11 pr-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                    placeholder="VD: Chuyên viên CNTT"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Phòng ban</label>
                <input 
                  type="text" 
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                  placeholder="VD: Phòng Kế hoạch - Kinh doanh"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Số điện thoại</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md pl-11 pr-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                    placeholder="09xx..."
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100 my-8" />

            <div className="flex items-center gap-3 mb-6">
               <div className="p-3 bg-orange-50 rounded-md">
                  <Tag className="w-6 h-6 text-orange-600" />
               </div>
               <h3 className="text-xl font-semibold text-slate-800 tracking-tight">Thiết lập mặc định</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Người nhận việc mặc định</label>
                <input 
                  type="text" 
                  value={formData.defaultAssigneeName}
                  onChange={e => setFormData({ ...formData, defaultAssigneeName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                  placeholder="Tên người nhận việc..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 tracking-normal ml-1">Lĩnh vực mặc định</label>
                <select 
                  value={formData.defaultTaskCategoryCode}
                  onChange={e => setFormData({ ...formData, defaultTaskCategoryCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-5 py-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#002D56]/10"
                >
                  {TASK_CATEGORIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#002D56] text-white px-10 py-4 rounded-md text-xs font-semibold tracking-normal shadow-sm hover:shadow-[#002D56]/20 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-md animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                LƯU THÔNG TIN CÁ NHÂN
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
