import React, { useState } from 'react';
import { UserAccount } from '../types/inventory';
import { DEFAULT_USERS } from '../data/seedData';
import { ShieldCheck, KeyRound, X, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

interface AuthRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  users?: UserAccount[];
  onSelectUser: (user: UserAccount) => void;
  lang: 'ar' | 'en';
}

export const AuthRoleModal: React.FC<AuthRoleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users = DEFAULT_USERS,
  onSelectUser,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [username, setUsername] = useState(currentUser.username);
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const matched = users.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        (u.password || 'password123') === password
    );
    if (!matched) {
      setError(
        isAr
          ? 'بيانات الدخول غير صحيحة. استخدم أحد الحسابات المعتمدة أدناه (كلمة المرور الافتراضية: password123).'
          : 'Invalid credentials. Select one of the verified accounts below (default password: password123).'
      );
      return;
    }
    if (matched.isActive === false) {
      setError(
        isAr
          ? `تم إيقاف تنشيط الحساب "${matched.fullNameAr}" بواسطة السوبر أدمن. يرجى إعادة تفعيله من تبويبة السوبر أدمن.`
          : `Account "${matched.fullName}" has been suspended by Super Admin.`
      );
      return;
    }
    onSelectUser(matched);
    onClose();
  };

  const getRolePermissionsLabel = (role: UserAccount['role']) => {
    if (role === 'SUPER_ADMIN') {
      return isAr
        ? 'صلاحيات السوبر أدمن الشاملة: إدارة المستخدمين والأدوار، تفعيل وإيقاف المساحات المخزنية، الجرد، والنسخ الاحتياطي'
        : 'Supreme Governance: Manage Users & Roles, Activate/Suspend Workspaces, Full Audit & Backup';
    }
    if (role === 'ADMIN') {
      return isAr
        ? 'صلاحيات مدير المخزن: إدارة دليل الكتب، التوريد والصرف، تهيئة المدخلات، وإعدادات المزامنة'
        : 'Full Access: Catalog CRUD, Inbound/Outbound Stock, Form Lookups & Sync Webhook Config';
    }
    if (role === 'STOREKEEPER') {
      return isAr
        ? 'صلاحيات أمين المخزن: إضافة وتعديل الكتب، تسجيل فواتير التوريد وأذون صرف المدارس، والمزامنة'
        : 'Warehouse Ops: Manage Books Catalog, Record Inbound & Outbound Transactions, Sync & Export';
    }
    return isAr
      ? 'صلاحيات المراجع الداخلي (قراءة وفحص وجرد): استعراض الأرصدة، فحص سجل الحركات، وتصدير تقارير CSV / PDF'
      : 'Audit Access: Inspect Stock Balances, Audit Transaction Ledgers, Export CSV & PDF Reports';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl overflow-hidden shadow-xl my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#006F88]" />
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'المصادقة المحلية والتبديل بين الأدوار (Super Admin / RBAC)'
                  : 'Local Authentication & Role-Based Access Control'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'اختر أي مستخدم نشط للتبديل الفوري أو سجّل الدخول باسم المستخدم وكلمة المرور'
                  : 'Switch active role immediately or sign in with credentials'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Role Switch Cards */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAr ? 'الحسابات والأدوار المسجلة بالنظام:' : 'Registered System Accounts:'}
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map((u) => {
                const isSelected = u.id === currentUser.id;
                const isSuspended = u.isActive === false;
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={isSuspended}
                    onClick={() => {
                      if (isSuspended) return;
                      onSelectUser(u);
                      onClose();
                    }}
                    className={`w-full text-start p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                      isSuspended
                        ? 'opacity-60 bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900 cursor-not-allowed'
                        : isSelected
                        ? 'bg-[#006F88]/10 border-[#006F88] dark:bg-[#006F88]/20 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <span>{isAr ? u.fullNameAr : u.fullName}</span>
                        <span className="text-[11px] font-mono text-[#006F88] dark:text-cyan-400">
                          ({u.role})
                        </span>
                        {isSuspended && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {isAr ? 'موقوف' : 'Suspended'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {getRolePermissionsLabel(u.role)}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[#006F88] shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standard Username / Password Form */}
          <form
            onSubmit={handleLoginSubmit}
            className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <KeyRound className="w-4 h-4 text-[#006F88]" />
              <span>
                {isAr
                  ? 'أو تسجيل الدخول عبر اسم المستخدم وكلمة المرور:'
                  : 'Or Sign In with Local Username & Password:'}
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {isAr
                    ? 'اسم المستخدم (superadmin / admin / storekeeper)'
                    : 'Username (superadmin / admin / storekeeper)'}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors cursor-pointer"
              >
                {isAr ? 'تحقق وتسجيل الدخول' : 'Authenticate Session'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
