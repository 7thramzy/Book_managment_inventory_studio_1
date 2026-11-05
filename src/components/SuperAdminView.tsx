import React, { useState, useMemo } from 'react';
import {
  AppTabKey,
  AuditLogEntry,
  BookItem,
  FormLookupsConfig,
  InventoryTransaction,
  UserAccount,
  UserPermissionKey,
  UserRole,
  WorkspaceEntity,
} from '../types/inventory';
import { DEFAULT_ROLE_TAB_MATRIX } from '../data/seedData';
import {
  ShieldAlert,
  Users,
  Building2,
  FileBarChart2,
  HardDrive,
  Plus,
  Edit3,
  Power,
  QrCode,
  Printer,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Share2,
  Phone,
  X,
  Sparkles,
  LayoutGrid,
  Eye,
  EyeOff,
} from 'lucide-react';
import { BarcodeSvgGraphic } from './BarcodePrintModal';
import { ContactPickerModal, PickedContactInfo, usePWA } from '../hooks/usePWA';

interface SuperAdminViewProps {
  users: UserAccount[];
  workspaces: WorkspaceEntity[];
  activeWorkspaceId: string;
  currentUser: UserAccount;
  books: BookItem[];
  transactions: InventoryTransaction[];
  auditLogs: AuditLogEntry[];
  formConfig: FormLookupsConfig;
  lang: 'ar' | 'en';
  onSaveUser: (user: UserAccount, isNew: boolean) => Promise<void>;
  onToggleUserActive: (user: UserAccount) => Promise<void>;
  onSwitchUser: (user: UserAccount) => void;
  onSaveWorkspace: (ws: WorkspaceEntity, isNew: boolean) => Promise<void>;
  onToggleWorkspaceActive: (ws: WorkspaceEntity) => Promise<void>;
  onSelectActiveWorkspace: (workspaceId: string) => void;
  onUpdateFormConfig: (next: FormLookupsConfig) => Promise<void>;
  onBulkUpdateUsers?: (nextUsers: UserAccount[]) => Promise<void>;
  onExportFullBackup: () => void;
  onImportFullBackup: (file: File) => void;
}

export const ALL_NAVIGATION_TABS: { key: AppTabKey; ar: string; en: string }[] = [
  { key: 'DASHBOARD', ar: 'لوحة المتابعة المخزنية', en: 'Warehouse Overview' },
  { key: 'CATALOG', ar: 'دليل الكتب المدرسية', en: 'Books Catalog' },
  { key: 'TRANSACTIONS', ar: 'حركات التوريد والصرف', en: 'Transactions Ledger' },
  { key: 'STOCKTAKING', ar: 'الجرد الفعلي والتوالف', en: 'Stocktaking & Damaged' },
  { key: 'SUPER_ADMIN', ar: 'السوبر أدمن والمستخدمين', en: 'Super Admin & Users' },
  { key: 'CONFIG', ar: 'تهيئة المدخلات والأتمتة', en: 'Form & Lookup Config' },
  { key: 'SYNC', ar: 'المزامنة و Google Sheets', en: 'Offline & Sheets Sync' },
];

const ALL_PERMISSIONS: { key: UserPermissionKey; ar: string; en: string }[] = [
  { key: 'MANAGE_USERS', ar: 'إدارة المستخدمين والأدوار', en: 'Manage Users & Roles' },
  { key: 'MANAGE_WORKSPACES', ar: 'إدارة وتفعيل المساحات المخزنية', en: 'Manage Workspaces' },
  { key: 'CATALOG_WRITE', ar: 'إضافة وتعديل دليل الكتب', en: 'Catalog Write Access' },
  { key: 'TRANSACTIONS_WRITE', ar: 'تسجيل التوريد والصرف المدرسي', en: 'Record Transactions' },
  { key: 'STOCKTAKING_APPROVE', ar: 'اعتماد محاضر الجرد الفعلي', en: 'Approve Stocktaking' },
  { key: 'DAMAGED_QUARANTINE', ar: 'إدارة سجل التوالف والمرتجعات', en: 'Manage Damaged Stock' },
  { key: 'CONFIG_WRITE', ar: 'تهيئة المدخلات وقواعد الأتمتة', en: 'Configure Lookups & Rules' },
  { key: 'EXPORT_REPORTS', ar: 'تصدير ومشاركة التقارير الرسمية', en: 'Export Official Reports' },
];

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  users,
  workspaces,
  activeWorkspaceId,
  currentUser,
  books,
  transactions,
  auditLogs,
  formConfig,
  lang,
  onSaveUser,
  onToggleUserActive,
  onSwitchUser,
  onSaveWorkspace,
  onToggleWorkspaceActive,
  onSelectActiveWorkspace,
  onUpdateFormConfig,
  onBulkUpdateUsers,
  onExportFullBackup,
  onImportFullBackup,
}) => {
  const isAr = lang === 'ar';
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';
  const pwa = usePWA();

  const [subTab, setSubTab] = useState<
    'USERS' | 'TAB_VISIBILITY' | 'WORKSPACES' | 'AUDIT_REPORTS' | 'PWA_STORAGE'
  >('USERS');

  const roleTabMatrix: Record<UserRole, AppTabKey[]> = useMemo(
    () => ({
      ...DEFAULT_ROLE_TAB_MATRIX,
      ...(formConfig.roleTabMatrix || {}),
    }),
    [formConfig.roleTabMatrix]
  );

  // User Form State
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('password123');
  const [uFullNameAr, setUFullNameAr] = useState('');
  const [uFullNameEn, setUFullNameEn] = useState('');
  const [uRole, setURole] = useState<UserRole>('STOREKEEPER');
  const [uDeptAr, setUDeptAr] = useState('عنبر التوريد والصرف المدرسي');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uWorkspaceId, setUWorkspaceId] = useState(workspaces[0]?.id || 'ws-central-01');
  const [uPermissions, setUPermissions] = useState<UserPermissionKey[]>([
    'CATALOG_WRITE',
    'TRANSACTIONS_WRITE',
    'EXPORT_REPORTS',
  ]);
  const [uAllowedTabs, setUAllowedTabs] = useState<AppTabKey[]>(
    DEFAULT_ROLE_TAB_MATRIX.STOREKEEPER
  );

  // Workspace Form State
  const [wsFormOpen, setWsFormOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<WorkspaceEntity | null>(null);
  const [wsCode, setWsCode] = useState('');
  const [wsNameAr, setWsNameAr] = useState('');
  const [wsNameEn, setWsNameEn] = useState('');
  const [wsLocationAr, setWsLocationAr] = useState('');
  const [wsManagerAr, setWsManagerAr] = useState('');
  const [wsPhone, setWsPhone] = useState('');
  const [wsCapacity, setWsCapacity] = useState(50000);
  const [wsNotesAr, setWsNotesAr] = useState('');

  // Contact Picker Modal State
  const [contactModalTarget, setContactModalTarget] = useState<'USER' | 'WORKSPACE' | null>(null);

  // Printable User ID Badge Modal
  const [badgeModalUser, setBadgeModalUser] = useState<UserAccount | null>(null);

  // Audit Report Filter
  const [reportFilterRole, setReportFilterRole] = useState<'ALL' | UserRole>('ALL');

  const openNewUserModal = () => {
    setEditingUser(null);
    setUUsername('');
    setUPassword('password123');
    setUFullNameAr('');
    setUFullNameEn('');
    setURole('STOREKEEPER');
    setUDeptAr('عنبر التوريد والصرف المدرسي');
    setUEmail('');
    setUPhone('');
    setUWorkspaceId(workspaces[0]?.id || 'ws-central-01');
    setUPermissions(['CATALOG_WRITE', 'TRANSACTIONS_WRITE', 'DAMAGED_QUARANTINE', 'EXPORT_REPORTS']);
    setUAllowedTabs([...(roleTabMatrix.STOREKEEPER || DEFAULT_ROLE_TAB_MATRIX.STOREKEEPER)]);
    setUserFormOpen(true);
  };

  const openEditUserModal = (u: UserAccount) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUPassword(u.password || 'password123');
    setUFullNameAr(u.fullNameAr);
    setUFullNameEn(u.fullName);
    setURole(u.role);
    setUDeptAr(u.departmentAr);
    setUEmail(u.email || '');
    setUPhone(u.phone || '');
    setUWorkspaceId(u.workspaceId || workspaces[0]?.id || 'ws-central-01');
    setUPermissions(
      u.permissions || ['CATALOG_WRITE', 'TRANSACTIONS_WRITE', 'EXPORT_REPORTS']
    );
    setUAllowedTabs(
      u.allowedTabs?.length
        ? [...u.allowedTabs]
        : [...(roleTabMatrix[u.role] || DEFAULT_ROLE_TAB_MATRIX[u.role])]
    );
    setUserFormOpen(true);
  };

  const handleRolePresetChange = (nextRole: UserRole) => {
    setURole(nextRole);
    setUAllowedTabs([...(roleTabMatrix[nextRole] || DEFAULT_ROLE_TAB_MATRIX[nextRole])]);
    if (nextRole === 'SUPER_ADMIN') {
      setUPermissions(ALL_PERMISSIONS.map((p) => p.key));
    } else if (nextRole === 'ADMIN') {
      setUPermissions([
        'CATALOG_WRITE',
        'TRANSACTIONS_WRITE',
        'STOCKTAKING_APPROVE',
        'DAMAGED_QUARANTINE',
        'CONFIG_WRITE',
        'EXPORT_REPORTS',
      ]);
    } else if (nextRole === 'STOREKEEPER') {
      setUPermissions(['CATALOG_WRITE', 'TRANSACTIONS_WRITE', 'DAMAGED_QUARANTINE', 'EXPORT_REPORTS']);
    } else {
      setUPermissions(['STOCKTAKING_APPROVE', 'EXPORT_REPORTS']);
    }
  };

  const togglePermission = (perm: UserPermissionKey) => {
    setUPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleUserAllowedTab = (tabKey: AppTabKey) => {
    setUAllowedTabs((prev) => {
      if (prev.includes(tabKey)) {
        // Always keep at least 1 visible tab (DASHBOARD fallback)
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== tabKey);
      }
      return [...prev, tabKey];
    });
  };

  const handleToggleRoleMatrixTab = async (role: UserRole, tabKey: AppTabKey) => {
    if (!isSuperAdmin) return;
    const currentTabs = roleTabMatrix[role] || DEFAULT_ROLE_TAB_MATRIX[role];
    let nextTabs: AppTabKey[];
    if (currentTabs.includes(tabKey)) {
      if (currentTabs.length <= 1) return; // Keep at least 1 tab visible
      nextTabs = currentTabs.filter((t) => t !== tabKey);
    } else {
      nextTabs = [...currentTabs, tabKey];
    }

    const nextMatrix: Record<UserRole, AppTabKey[]> = {
      ...roleTabMatrix,
      [role]: nextTabs,
    };

    await onUpdateFormConfig({
      ...formConfig,
      roleTabMatrix: nextMatrix,
    });

    // Also synchronize users of that role so the change takes effect immediately on role/user switch
    if (onBulkUpdateUsers) {
      const updatedUsers = users.map((u) =>
        u.role === role ? { ...u, allowedTabs: nextTabs } : u
      );
      await onBulkUpdateUsers(updatedUsers);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uFullNameAr.trim() || !uUsername.trim()) return;
    const rolePrefix =
      uRole === 'SUPER_ADMIN'
        ? 'SUP'
        : uRole === 'ADMIN'
        ? 'ADM'
        : uRole === 'STOREKEEPER'
        ? 'STK'
        : 'AUD';

    const userObj: UserAccount = {
      id: editingUser?.id || `usr-${Date.now()}`,
      username: uUsername.trim().toLowerCase(),
      password: uPassword.trim() || 'password123',
      fullNameAr: uFullNameAr.trim(),
      fullName: uFullNameEn.trim() || uFullNameAr.trim(),
      role: uRole,
      departmentAr: uDeptAr.trim() || 'إدارة المخازن',
      department: editingUser?.department || uDeptAr.trim(),
      badgeCode: editingUser?.badgeCode || `${rolePrefix}-${Math.floor(100 + Math.random() * 899)}`,
      email: uEmail.trim() || `${uUsername.trim().toLowerCase()}@moe.gov.eg`,
      phone: uPhone.trim() || '0100-000-0000',
      workspaceId: uWorkspaceId,
      isActive: editingUser ? editingUser.isActive !== false : true,
      permissions: uPermissions,
      allowedTabs: uAllowedTabs.length > 0 ? uAllowedTabs : ['DASHBOARD'],
    };

    await onSaveUser(userObj, !editingUser);
    setUserFormOpen(false);
  };

  const openNewWorkspaceModal = () => {
    setEditingWs(null);
    setWsCode(`WH-SEC-0${workspaces.length + 1}`);
    setWsNameAr('');
    setWsNameEn('');
    setWsLocationAr('');
    setWsManagerAr('');
    setWsPhone('');
    setWsCapacity(50000);
    setWsNotesAr('');
    setWsFormOpen(true);
  };

  const openEditWorkspaceModal = (ws: WorkspaceEntity) => {
    setEditingWs(ws);
    setWsCode(ws.code);
    setWsNameAr(ws.nameAr);
    setWsNameEn(ws.name);
    setWsLocationAr(ws.locationAr);
    setWsManagerAr(ws.managerNameAr);
    setWsPhone(ws.phone);
    setWsCapacity(ws.capacityCopies);
    setWsNotesAr(ws.notesAr || '');
    setWsFormOpen(true);
  };

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsNameAr.trim() || !wsCode.trim()) return;
    const nextWs: WorkspaceEntity = {
      id: editingWs?.id || `ws-${Date.now()}`,
      code: wsCode.trim().toUpperCase(),
      nameAr: wsNameAr.trim(),
      name: wsNameEn.trim() || wsNameAr.trim(),
      locationAr: wsLocationAr.trim() || 'المنطقة التعليمية',
      location: editingWs?.location || wsLocationAr.trim(),
      managerNameAr: wsManagerAr.trim() || 'مدير المخزن الفرعي',
      phone: wsPhone.trim() || '0100-000-0000',
      capacityCopies: Math.max(1000, Number(wsCapacity) || 50000),
      isActive: editingWs ? editingWs.isActive : true,
      notesAr: wsNotesAr.trim(),
      updatedAt: new Date().toISOString(),
    };
    await onSaveWorkspace(nextWs, !editingWs);
    setWsFormOpen(false);
  };

  const handleTriggerContactImport = async (target: 'USER' | 'WORKSPACE') => {
    const nativePicked = await pwa.pickNativeContact();
    if (nativePicked) {
      applyPickedContact(target, nativePicked);
    } else {
      setContactModalTarget(target);
    }
  };

  const applyPickedContact = (target: 'USER' | 'WORKSPACE', c: PickedContactInfo) => {
    if (target === 'USER') {
      setUFullNameAr(c.name);
      setUFullNameEn(c.name);
      setUPhone(c.phone);
      setUEmail(c.email);
      setUDeptAr(c.organization);
    } else {
      setWsManagerAr(c.name);
      setWsPhone(c.phone);
      if (!wsNameAr) setWsNameAr(c.organization);
    }
  };

  // Super Admin Compliance & Activity Summary per User
  const userAuditSummary = useMemo(() => {
    return users
      .filter((u) => reportFilterRole === 'ALL' || u.role === reportFilterRole)
      .map((u) => {
        const userTxs = transactions.filter(
          (t) =>
            t.createdBy.includes(u.fullNameAr) ||
            t.createdBy.includes(u.fullName) ||
            t.createdByRole === u.role
        );
        const userAudits = auditLogs.filter(
          (a) => a.actorNameAr === u.fullNameAr || a.actorName === u.fullName
        );
        const ws = workspaces.find((w) => w.id === u.workspaceId);
        return {
          user: u,
          txCount: userTxs.length,
          auditCount: userAudits.length,
          workspaceNameAr: ws?.nameAr || 'المخزن المركزي',
          lastActionAt: userAudits[0]?.timestamp || userTxs[0]?.createdAt || null,
        };
      });
  }, [users, transactions, auditLogs, workspaces, reportFilterRole]);

  const getRoleBadgeStyle = (role: UserRole) => {
    if (role === 'SUPER_ADMIN')
      return 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800';
    if (role === 'ADMIN')
      return 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
    if (role === 'STOREKEEPER')
      return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#006F88] text-white flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'مركز تحكم السوبر أدمن والحوكمة الشاملة (Super Admin Control Center)'
                  : 'Super Admin Governance, Users & Workspaces Control Center'}
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-[#006F88]/15 text-[#006F88] dark:text-cyan-300">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isAr
                ? 'إدارة المستخدمين والأدوار، تفعيل أو إيقاف تنشيط أي مستخدم أو مساحة مخزنية، تقارير المراجعة الرقابية، وخصائص PWA'
                : 'Manage users and roles, activate/suspend any user or warehouse workspace, inspect audit reports, and manage PWA storage'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={openNewUserModal}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isAr ? 'إضافة مستخدم جديد' : 'Add New User'}</span>
              </button>
              <button
                type="button"
                onClick={openNewWorkspaceModal}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-[#006F88]" />
                <span>{isAr ? 'إضافة مساحة مخزنية' : 'Add Workspace'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        {(
          [
            {
              id: 'USERS',
              ar: `المستخدمون والصلاحيات (${users.length})`,
              en: `Users & Roles (${users.length})`,
              icon: Users,
            },
            {
              id: 'TAB_VISIBILITY',
              ar: 'التحكم في ظهور التبويبات حسب الدور',
              en: 'Role & Tab Visibility Matrix',
              icon: LayoutGrid,
            },
            {
              id: 'WORKSPACES',
              ar: `المساحات والمخازن (${workspaces.length})`,
              en: `Workspaces & Hubs (${workspaces.length})`,
              icon: Building2,
            },
            {
              id: 'AUDIT_REPORTS',
              ar: 'تقارير المراجعة والمساءلة',
              en: 'Super Admin Audit Reports',
              icon: FileBarChart2,
            },
            {
              id: 'PWA_STORAGE',
              ar: 'خصائص PWA والنسخ الاحتياطي',
              en: 'PWA Capabilities & Backup',
              icon: HardDrive,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                active
                  ? 'bg-[#006F88] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{isAr ? tab.ar : tab.en}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: USERS & ROLES MANAGEMENT */}
      {subTab === 'USERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((u) => {
            const isActive = u.isActive !== false;
            const isCurrentSession = u.id === currentUser.id;
            const assignedWs = workspaces.find((w) => w.id === u.workspaceId) || workspaces[0];

            return (
              <div
                key={u.id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-5 flex flex-col justify-between gap-4 transition-all ${
                  !isActive
                    ? 'border-red-300 dark:border-red-900/70 opacity-80 bg-red-50/20 dark:bg-red-950/10'
                    : isCurrentSession
                    ? 'border-[#006F88] ring-1 ring-[#006F88]/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {isAr ? u.fullNameAr : u.fullName}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${getRoleBadgeStyle(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                        {!isActive && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                            {isAr ? 'موقوف مؤقتاً (Suspended)' : 'Deactivated'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isAr ? u.departmentAr : u.department} ·{' '}
                        <span className="font-mono">{u.badgeCode}</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBadgeModalUser(u)}
                      title={isAr ? 'طباعة بطاقة المستخدم ورمز QR' : 'Print User QR ID Card'}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#006F88]/15 text-[#006F88] dark:text-cyan-400 transition-colors cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Contact & Assigned Workspace Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-[#006F88] shrink-0" />
                      <span className="truncate">
                        {assignedWs ? (isAr ? assignedWs.nameAr : assignedWs.name) : 'المخزن المركزي'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono truncate">
                      <Phone className="w-3.5 h-3.5 text-[#006F88] shrink-0" />
                      <span>{u.phone || '0100-000-0000'}</span>
                    </div>
                  </div>

                  {/* Permissions Chips */}
                  <div className="flex flex-wrap gap-1">
                    {(u.permissions || ['EXPORT_REPORTS']).map((perm) => {
                      const pObj = ALL_PERMISSIONS.find((x) => x.key === perm);
                      return (
                        <span
                          key={perm}
                          className="px-2 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {pObj ? (isAr ? pObj.ar : pObj.en) : perm}
                        </span>
                      );
                    })}
                  </div>

                  {/* Allowed Navigation Tabs Chips */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                      <Eye className="w-3 h-3 text-[#006F88]" />
                      <span>
                        {isAr ? 'التبويبات الظاهرة لهذا الحساب:' : 'Visible Navigation Tabs:'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(u.allowedTabs?.length
                        ? u.allowedTabs
                        : roleTabMatrix[u.role] || DEFAULT_ROLE_TAB_MATRIX[u.role]
                      ).map((tabKey) => {
                        const tabInfo = ALL_NAVIGATION_TABS.find((t) => t.key === tabKey);
                        return (
                          <span
                            key={tabKey}
                            className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#006F88]/10 text-[#006F88] dark:text-cyan-300 border border-[#006F88]/20"
                          >
                            {tabInfo ? (isAr ? tabInfo.ar : tabInfo.en) : tabKey}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {isActive && !isCurrentSession && (
                      <button
                        type="button"
                        onClick={() => onSwitchUser(u)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg cursor-pointer"
                      >
                        {isAr ? 'دخول بهذا الحساب' : 'Switch to User'}
                      </button>
                    )}
                    {isCurrentSession && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isAr ? 'الجلسة النشطة حالياً' : 'Active Session'}
                      </span>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditUserModal(u)}
                        className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تعديل' : 'Edit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleUserActive(u)}
                        className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer ${
                          isActive
                            ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>
                          {isActive
                            ? isAr
                              ? 'إيقاف تنشيط'
                              : 'Deactivate'
                            : isAr
                            ? 'إعادة تفعيل'
                            : 'Activate'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 1B: ROLE & USER NAVIGATION TAB VISIBILITY MATRIX */}
      {subTab === 'TAB_VISIBILITY' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#006F88]" />
                <span>
                  {isAr
                    ? 'مصفوفة إظهار وإخفاء التبويبات حسب الدور الوظيفي (Dynamic Tab Visibility Matrix)'
                    : 'Dynamic Role-Based Navigation Tab Visibility Matrix'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'حدد التبويبات التي تظهر أو تختفي في القائمة الجانبية والشريط السفلي لكل دور وظيفي. عند تبديل الدور إلى حساب لا يملك صلاحية التبويبة المفتوحة يتم تحويله تلقائياً للوحة المتابعة.'
                  : 'Toggle which navigation tabs appear or hide in the sidebar and mobile bottom bar per role.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-3 text-start">
                    {isAr ? 'التبويبة في النظام' : 'Navigation Tab'}
                  </th>
                  {(['SUPER_ADMIN', 'ADMIN', 'STOREKEEPER', 'AUDITOR'] as UserRole[]).map((r) => (
                    <th key={r} className="px-4 py-3 text-center font-mono">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {ALL_NAVIGATION_TABS.map((tab) => (
                  <tr
                    key={tab.key}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {isAr ? tab.ar : tab.en}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">{tab.key}</div>
                    </td>
                    {(['SUPER_ADMIN', 'ADMIN', 'STOREKEEPER', 'AUDITOR'] as UserRole[]).map(
                      (role) => {
                        const visible = (
                          roleTabMatrix[role] || DEFAULT_ROLE_TAB_MATRIX[role]
                        ).includes(tab.key);
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <button
                              type="button"
                              disabled={!isSuperAdmin}
                              onClick={() => handleToggleRoleMatrixTab(role, tab.key)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                visible
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {visible ? (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'ظاهر' : 'Visible'}</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  <span>{isAr ? 'مخفي' : 'Hidden'}</span>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      }
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: WORKSPACES / WAREHOUSES MANAGEMENT */}
      {subTab === 'WORKSPACES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((ws) => {
            const isSelectedWs = ws.id === activeWorkspaceId;
            return (
              <div
                key={ws.id}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-5 flex flex-col justify-between gap-4 ${
                  !ws.isActive
                    ? 'border-amber-300 dark:border-amber-900/70 bg-amber-50/20 dark:bg-amber-950/10'
                    : isSelectedWs
                    ? 'border-[#006F88] ring-1 ring-[#006F88]/30'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          {ws.code}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {isAr ? ws.nameAr : ws.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {isAr ? ws.locationAr : ws.location}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md shrink-0 ${
                        ws.isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {ws.isActive
                        ? isAr
                          ? 'مساحة نشطة'
                          : 'Active Hub'
                        : isAr
                        ? 'موقوفة مؤقتاً'
                        : 'Suspended'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {isAr ? 'المدير المسؤول:' : 'Hub Manager:'}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {ws.managerNameAr}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {isAr ? 'السعة الاستيعابية:' : 'Storage Capacity:'}
                      </span>
                      <span className="font-mono font-bold text-[#006F88] dark:text-cyan-400">
                        {ws.capacityCopies.toLocaleString()} {isAr ? 'نسخة' : 'copies'}
                      </span>
                    </div>
                  </div>

                  {ws.notesAr && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{ws.notesAr}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={!ws.isActive}
                    onClick={() => onSelectActiveWorkspace(ws.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      isSelectedWs
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#006F88]/10 text-[#006F88] dark:text-cyan-300 hover:bg-[#006F88]/20 disabled:opacity-40'
                    }`}
                  >
                    {isSelectedWs
                      ? isAr
                        ? 'المساحة المختارة حالياً'
                        : 'Currently Selected'
                      : isAr
                      ? 'الدخول لهذه المساحة المخزنية'
                      : 'Switch to Workspace'}
                  </button>

                  {isSuperAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditWorkspaceModal(ws)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تعديل' : 'Edit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleWorkspaceActive(ws)}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer ${
                          ws.isActive
                            ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100'
                            : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>
                          {ws.isActive
                            ? isAr
                              ? 'إيقاف تنشيط المساحة'
                              : 'Suspend Hub'
                            : isAr
                            ? 'تفعيل المساحة'
                            : 'Activate Hub'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 3: SUPER ADMIN AUDIT & COMPLIANCE REPORTS */}
      {subTab === 'AUDIT_REPORTS' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isAr
                    ? 'تقرير الرقابة والمساءلة لأداء المستخدمين والمساحات المخزنية'
                    : 'Super Admin User & Workspace Accountability Report'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'إحصاء شامل لعدد الحركات المخزنية والتعديلات التي نفذها كل مستخدم وحالة حسابه'
                    : 'Summary of transactions and configuration changes per user and workspace'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={reportFilterRole}
                  onChange={(e) => setReportFilterRole(e.target.value as any)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="ALL">{isAr ? 'كل الأدوار الوظيفية' : 'All Roles'}</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="STOREKEEPER">STOREKEEPER</option>
                  <option value="AUDITOR">AUDITOR</option>
                </select>

                <button
                  type="button"
                  onClick={() =>
                    pwa.shareContent({
                      title: isAr ? 'تقرير مراجعة السوبر أدمن' : 'Super Admin Audit Report',
                      text: isAr
                        ? `تقرير حوكمة المخازن: ${users.length} مستخدمين، ${workspaces.length} مساحات مخزنية، ${auditLogs.length} سجل تدقيق.`
                        : `Warehouse Governance Report: ${users.length} users, ${workspaces.length} workspaces.`,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مشاركة التقرير' : 'Share Report'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                    <th className="px-4 py-3 text-start">{isAr ? 'المستخدم والرمز' : 'User & Badge'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'الدور والمساحة' : 'Role & Workspace'}</th>
                    <th className="px-4 py-3 text-end">{isAr ? 'الحركات المسجلة' : 'Transactions'}</th>
                    <th className="px-4 py-3 text-end">{isAr ? 'عمليات التدقيق' : 'Audit Logs'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {userAuditSummary.map((row) => (
                    <tr key={row.user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {isAr ? row.user.fullNameAr : row.user.fullName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          @{row.user.username} · {row.user.badgeCode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-[#006F88] dark:text-cyan-400">
                          {row.user.role}
                        </span>
                        <div className="text-[11px] text-slate-500">{row.workspaceNameAr}</div>
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-slate-900 dark:text-slate-100">
                        {row.txCount}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-[#006F88] dark:text-cyan-400">
                        {row.auditCount}
                      </td>
                      <td className="px-4 py-3">
                        {row.user.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isAr ? 'نشط' : 'Active'}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{isAr ? 'موقوف' : 'Suspended'}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: PWA CAPABILITIES & FULL DATABASE BACKUP */}
      {subTab === 'PWA_STORAGE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#006F88]" />
              <span>
                {isAr
                  ? 'النسخ الاحتياطي الشامل واستعادة قاعدة البيانات (JSON Snapshot)'
                  : 'Full Database Backup & Restore'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isAr
                ? 'يتيح للسوبر أدمن تصدير نسخة احتياطية مشفرة وكاملة تضم الكتب، الحركات، المدارس، المستخدمين، المساحات المخزنية، وسجلات المراجعة للعمل بها على أي جهاز آخر حتى بدون إنترنت.'
                : 'Export a complete portable snapshot of all books, transactions, users, workspaces, and audit logs.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onExportFullBackup}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isAr ? 'تصدير نسخة احتياطية كاملة (JSON)' : 'Export Full Backup'}</span>
              </button>

              <label className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4 text-[#006F88]" />
                <span>{isAr ? 'استيراد واستعادة نسخة' : 'Restore Backup JSON'}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportFullBackup(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#006F88]" />
              <span>
                {isAr
                  ? 'حالة تخزين PWA المتقدم وحساسات الجهاز'
                  : 'PWA Persistent Storage & Native Sensors'}
              </span>
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span>{isAr ? 'حماية التخزين الدائم (navigator.storage.persist):' : 'Persistent Storage:'}</span>
                <button
                  type="button"
                  onClick={() => pwa.requestPersistentStorage()}
                  className="px-2.5 py-1 rounded bg-[#006F88] text-white font-semibold text-[11px] cursor-pointer"
                >
                  {pwa.isStoragePersisted ? (isAr ? 'مفعّل ومحمي' : 'Persisted') : isAr ? 'تفعيل الآن' : 'Enable'}
                </button>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span>{isAr ? 'إبقاء الشاشة مضاءة أثناء المسح والجرد (Wake Lock):' : 'Screen Wake Lock:'}</span>
                <button
                  type="button"
                  onClick={() => pwa.toggleWakeLock()}
                  className={`px-2.5 py-1 rounded font-semibold text-[11px] cursor-pointer ${
                    pwa.wakeLockActive
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {pwa.wakeLockActive ? (isAr ? 'نشط الآن' : 'Active') : isAr ? 'تشغيل' : 'Turn On'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT USER ACCOUNT */}
      {userFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl my-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingUser
                  ? isAr
                    ? 'تعديل بيانات وصلاحيات المستخدم'
                    : 'Edit User Account & Permissions'
                  : isAr
                  ? 'إضافة مستخدم جديد وتعيين الصلاحيات'
                  : 'Create New User & Assign Role'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerContactImport('USER')}
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isAr ? 'استيراد من جهات الاتصال' : 'Import Contact'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الاسم الكامل (بالعربية) *' : 'Full Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={uFullNameAr}
                    onChange={(e) => setUFullNameAr(e.target.value)}
                    placeholder="مثال: أ. كريم عبد العزيز"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'اسم الدخول (Username) *' : 'Username *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={uUsername}
                    onChange={(e) => setUUsername(e.target.value)}
                    placeholder="karim.store"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الدور الوظيفي (Role)' : 'System Role'}
                  </label>
                  <select
                    value={uRole}
                    onChange={(e) => handleRolePresetChange(e.target.value as UserRole)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (سوبر أدمن)</option>
                    <option value="ADMIN">ADMIN (مدير مخزن)</option>
                    <option value="STOREKEEPER">STOREKEEPER (أمين مخزن)</option>
                    <option value="AUDITOR">AUDITOR (مراجع داخلي)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'المساحة المخزنية المعينة' : 'Assigned Workspace'}
                  </label>
                  <select
                    value={uWorkspaceId}
                    onChange={(e) => setUWorkspaceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {isAr ? ws.nameAr : ws.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'رقم الهاتف' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    placeholder="0100-000-0000"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'الإدارة / القسم' : 'Department'}
                  </label>
                  <input
                    type="text"
                    value={uDeptAr}
                    onChange={(e) => setUDeptAr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {isAr ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    placeholder="user@moe.gov.eg"
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  {isAr ? 'مصفوفة الصلاحيات الدقيقة لهذا المستخدم:' : 'Granular User Permissions:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = uPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`p-2.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#006F88]/10 border-[#006F88] text-slate-900 dark:text-slate-100 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.key)}
                          className="rounded border-slate-300 text-[#006F88]"
                        />
                        <span>{isAr ? perm.ar : perm.en}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Custom Allowed Navigation Tabs for this User */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  {isAr
                    ? 'التبويبات المسموح بظهورها لهذا المستخدم في القوائم:'
                    : 'Visible Navigation Tabs for This User:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_NAVIGATION_TABS.map((tab) => {
                    const checked = uAllowedTabs.includes(tab.key);
                    return (
                      <label
                        key={tab.key}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500/60 text-slate-900 dark:text-slate-100 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUserAllowedTab(tab.key)}
                            className="rounded border-slate-300 text-[#006F88]"
                          />
                          <span>{isAr ? tab.ar : tab.en}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-75">{tab.key}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUserFormOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white font-semibold cursor-pointer"
                >
                  {isAr ? 'حفظ بيانات المستخدم' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT WORKSPACE */}
      {wsFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-xl my-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingWs
                  ? isAr
                    ? 'تعديل بيانات المساحة المخزنية'
                    : 'Edit Warehouse Workspace'
                  : isAr
                  ? 'إضافة مساحة مخزنية / فرع جديد'
                  : 'Add New Warehouse Workspace'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTriggerContactImport('WORKSPACE')}
                  className="px-2.5 py-1 text-[11px] font-semibold text-[#006F88] bg-[#006F88]/10 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isAr ? 'استيراد مسؤول من جهات الاتصال' : 'Import Manager'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleWorkspaceSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'كود المساحة *' : 'Hub Code *'}</label>
                  <input
                    type="text"
                    required
                    value={wsCode}
                    onChange={(e) => setWsCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">{isAr ? 'اسم المساحة المخزنية *' : 'Workspace Name *'}</label>
                  <input
                    type="text"
                    required
                    value={wsNameAr}
                    onChange={(e) => setWsNameAr(e.target.value)}
                    placeholder="مثال: مخزن التوزيع الفرعي - إدارة شرق"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'الموقع الجغرافي' : 'Location'}</label>
                  <input
                    type="text"
                    value={wsLocationAr}
                    onChange={(e) => setWsLocationAr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'السعة الاستيعابية (نسخة)' : 'Capacity (Copies)'}</label>
                  <input
                    type="number"
                    min={1000}
                    value={wsCapacity}
                    onChange={(e) => setWsCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'اسم المسؤول / أمين العهدة' : 'Manager Name'}</label>
                  <input
                    type="text"
                    value={wsManagerAr}
                    onChange={(e) => setWsManagerAr(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'هاتف التواصل' : 'Phone'}</label>
                  <input
                    type="text"
                    value={wsPhone}
                    onChange={(e) => setWsPhone(e.target.value)}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">{isAr ? 'ملاحظات تشغيلية' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={wsNotesAr}
                  onChange={(e) => setWsNotesAr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWsFormOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white font-semibold cursor-pointer"
                >
                  {isAr ? 'حفظ المساحة المخزنية' : 'Save Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE USER ID BADGE WITH QR LOGIN CODE */}
      {badgeModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 no-print">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'بطاقة التعريف الرسمية للمستخدم' : 'Official User QR ID Badge'}
              </span>
              <button
                type="button"
                onClick={() => setBadgeModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 rounded-xl border-2 border-[#006F88] bg-white text-slate-950 space-y-3">
              <div className="text-[11px] font-bold text-[#006F88] uppercase tracking-wider">
                {isAr ? 'وزارة التربية والتعليم — مخازن الكتب' : 'Ministry of Education — Warehouse ID'}
              </div>
              <div className="text-base font-bold">{badgeModalUser.fullNameAr}</div>
              <div className="text-xs text-slate-600">{badgeModalUser.departmentAr}</div>
              <div className="inline-block px-3 py-0.5 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                {badgeModalUser.role} · {badgeModalUser.badgeCode}
              </div>
              <div className="pt-2">
                <BarcodeSvgGraphic
                  value={`USER:${badgeModalUser.username}:${badgeModalUser.badgeCode}`}
                  type="QR"
                  height={88}
                />
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  @{badgeModalUser.username}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-2 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{isAr ? 'طباعة بطاقة الهوية (Print ID)' : 'Print User Badge'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVICE CONTACTS PICKER MODAL */}
      <ContactPickerModal
        isOpen={contactModalTarget !== null}
        onClose={() => setContactModalTarget(null)}
        onSelectContact={(c) => {
          if (contactModalTarget) applyPickedContact(contactModalTarget, c);
        }}
        lang={lang}
      />
    </div>
  );
};
