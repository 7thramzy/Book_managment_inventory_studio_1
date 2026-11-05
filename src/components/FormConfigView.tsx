import React, { useState, useMemo } from 'react';
import {
  AuditCategory,
  AuditFieldDiff,
  AuditLogEntry,
  AutomationRuleItem,
  AutomationTriggerType,
  BookItem,
  EducationalStage,
  FormLookupsConfig,
  GradeOption,
  NoteTemplateItem,
  SchoolEntity,
  SubjectOption,
  SupplierEntity,
  UserAccount,
  UserRole,
} from '../types/inventory';
import { DEFAULT_FORM_LOOKUPS } from '../data/seedData';
import { exportAuditLogsToCSV } from '../utils/exportReports';
import {
  Sliders,
  BookOpen,
  Building2,
  Hash,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Star,
  Zap,
  Play,
  Bell,
  Mail,
  History,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface FormConfigViewProps {
  formConfig: FormLookupsConfig;
  books: BookItem[];
  schools: SchoolEntity[];
  auditLogs: AuditLogEntry[];
  currentUser: UserAccount;
  userRole: UserRole;
  onUpdateFormConfig: (nextConfig: FormLookupsConfig) => Promise<void>;
  onExecuteAutomationRules: () => Promise<void>;
  onRecordAudit: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => Promise<void>;
  onAddSchool: (school: Partial<SchoolEntity> & { nameAr: string }) => Promise<SchoolEntity | void>;
  onDeleteSchool: (schoolId: string) => Promise<void>;
  onOpenRoleModal: () => void;
  lang: 'ar' | 'en';
}

type ConfigSubTab =
  | 'ACADEMIC'
  | 'ENTITIES'
  | 'AUTOMATION'
  | 'TEMPLATES'
  | 'AUTOMATION_RULES'
  | 'AUDIT_LOG';

export const FormConfigView: React.FC<FormConfigViewProps> = ({
  formConfig,
  books,
  schools,
  auditLogs,
  currentUser,
  userRole,
  onUpdateFormConfig,
  onExecuteAutomationRules,
  onRecordAudit,
  onAddSchool,
  onDeleteSchool,
  onOpenRoleModal,
  lang,
}) => {
  const isAr = lang === 'ar';
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
  const [subTab, setSubTab] = useState<ConfigSubTab>('AUTOMATION_RULES');

  // Academic & Subjects local inputs
  const [newYear, setNewYear] = useState('');
  const [newSubjAr, setNewSubjAr] = useState('');
  const [newSubjEn, setNewSubjEn] = useState('');
  const [newSubjCode, setNewSubjCode] = useState('');

  const [newGradeStage, setNewGradeStage] = useState<EducationalStage>('PRIMARY');
  const [newGradeAr, setNewGradeAr] = useState('');
  const [newGradeEn, setNewGradeEn] = useState('');
  const [newGradeCode, setNewGradeCode] = useState('');

  // Entities (Schools & Suppliers) local inputs
  const [newSupAr, setNewSupAr] = useState('');
  const [newSupEn, setNewSupEn] = useState('');
  const [newSupCode, setNewSupCode] = useState('');
  const [newSupType, setNewSupType] = useState<SupplierEntity['type']>('PRINTING_PRESS');

  const [newSchAr, setNewSchAr] = useState('');
  const [newSchEn, setNewSchEn] = useState('');
  const [newSchCode, setNewSchCode] = useState('');
  const [newSchDistrictAr, setNewSchDistrictAr] = useState('إدارة وسط التعليمية');
  const [newSchStage, setNewSchStage] = useState<EducationalStage>('PRIMARY');
  const [newSchStudents, setNewSchStudents] = useState(850);
  const [newSchRecipient, setNewSchRecipient] = useState('');
  const [newSchPhone, setNewSchPhone] = useState('');

  // Automation & Defaults local form state
  const [prefixes, setPrefixes] = useState(formConfig.prefixes);
  const [defaults, setDefaults] = useState(formConfig.defaults);

  // Note Templates local inputs
  const [tplType, setTplType] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [tplTitleAr, setTplTitleAr] = useState('');
  const [tplTextAr, setTplTextAr] = useState('');

  // Automation Rules local inputs
  const [isRunningRules, setIsRunningRules] = useState(false);
  const [newRuleTrigger, setNewRuleTrigger] =
    useState<AutomationTriggerType>('REORDER_POINT_PERCENTAGE');
  const [newRuleNameAr, setNewRuleNameAr] = useState('');
  const [newRuleNameEn, setNewRuleNameEn] = useState('');
  const [newRuleParam, setNewRuleParam] = useState<number>(20);
  const [newRuleEmail, setNewRuleEmail] = useState('warehouse-alerts@moe.gov.eg');

  // Audit Log filter & expansion state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<'ALL' | AuditCategory>('ALL');
  const [auditRoleFilter, setAuditRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [expandedAuditIds, setExpandedAuditIds] = useState<string[]>(() =>
    auditLogs.slice(0, 2).map((a) => a.id)
  );

  const rules = formConfig.automationRules || [];
  const alerts = formConfig.automationAlerts || [];
  const unacknowledgedAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (auditCategoryFilter !== 'ALL' && entry.category !== auditCategoryFilter) return false;
      if (auditRoleFilter !== 'ALL' && entry.actorRole !== auditRoleFilter) return false;
      if (!q) return true;
      const inChanges = (entry.changes || []).some(
        (c) =>
          c.labelAr.toLowerCase().includes(q) ||
          c.labelEn.toLowerCase().includes(q) ||
          c.before.toLowerCase().includes(q) ||
          c.after.toLowerCase().includes(q)
      );
      return (
        entry.actorName.toLowerCase().includes(q) ||
        entry.actorNameAr.toLowerCase().includes(q) ||
        entry.entityTitleAr.toLowerCase().includes(q) ||
        entry.entityTitleEn.toLowerCase().includes(q) ||
        entry.summaryAr.toLowerCase().includes(q) ||
        entry.summaryEn.toLowerCase().includes(q) ||
        inChanges
      );
    });
  }, [auditLogs, auditSearch, auditCategoryFilter, auditRoleFilter]);

  const toggleExpandAudit = (id: string) => {
    setExpandedAuditIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Handlers for Academic & Subjects
  const handleAddAcademicYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newYear.trim()) return;
    const clean = newYear.trim();
    if (formConfig.academicYears.includes(clean)) return;
    const nextYears = [...formConfig.academicYears, clean];
    await onUpdateFormConfig({
      ...formConfig,
      academicYears: nextYears,
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'CREATE',
      entityTitleAr: `إضافة عام دراسي جديد (${clean})`,
      entityTitleEn: `Added Academic Year (${clean})`,
      summaryAr: `تمت إضافة العام الدراسي ${clean} إلى قائمة الأعوام الدراسية المتاحة في النماذج.`,
      summaryEn: `Added academic year ${clean} to form dropdown options.`,
      changes: [
        {
          field: 'academicYears',
          labelAr: 'الأعوام الدراسية المعتمدة',
          labelEn: 'Academic Years List',
          before: formConfig.academicYears.join(', '),
          after: nextYears.join(', '),
        },
      ],
    });
    setNewYear('');
  };

  const handleSetDefaultYear = async (yr: string) => {
    if (!isAdmin) return;
    const prevYr = formConfig.defaults.defaultAcademicYear;
    const nextDefaults = { ...formConfig.defaults, defaultAcademicYear: yr };
    setDefaults(nextDefaults);
    await onUpdateFormConfig({
      ...formConfig,
      defaults: nextDefaults,
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'UPDATE',
      entityTitleAr: 'تغيير العام الدراسي الافتراضي للنماذج',
      entityTitleEn: 'Updated Default Form Academic Year',
      summaryAr: `تغيير العام الدراسي الافتراضي من ${prevYr} إلى ${yr}.`,
      summaryEn: `Changed default academic year from ${prevYr} to ${yr}.`,
      changes: [
        {
          field: 'defaultAcademicYear',
          labelAr: 'العام الدراسي الافتراضي',
          labelEn: 'Default Academic Year',
          before: prevYr,
          after: yr,
        },
      ],
    });
  };

  const handleRemoveAcademicYear = async (yr: string) => {
    if (!isAdmin || formConfig.academicYears.length <= 1) return;
    const nextYears = formConfig.academicYears.filter((y) => y !== yr);
    const nextDefault =
      formConfig.defaults.defaultAcademicYear === yr
        ? nextYears[0]
        : formConfig.defaults.defaultAcademicYear;
    await onUpdateFormConfig({
      ...formConfig,
      academicYears: nextYears,
      defaults: { ...formConfig.defaults, defaultAcademicYear: nextDefault },
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'DELETE',
      entityTitleAr: `حذف العام الدراسي (${yr})`,
      entityTitleEn: `Removed Academic Year (${yr})`,
      summaryAr: `تم حذف العام الدراسي ${yr} من قائمة الاختيارات.`,
      summaryEn: `Removed academic year ${yr} from form lookups.`,
      changes: [
        {
          field: 'academicYears',
          labelAr: 'الأعوام الدراسية المعتمدة',
          labelEn: 'Academic Years List',
          before: formConfig.academicYears.join(', '),
          after: nextYears.join(', '),
        },
      ],
    });
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newSubjAr.trim()) return;
    const code = (newSubjCode.trim() || newSubjEn.slice(0, 3) || 'SBJ').toUpperCase().slice(0, 4);
    const newSubject: SubjectOption = {
      id: `sbj-${Date.now()}`,
      ar: newSubjAr.trim(),
      en: newSubjEn.trim() || newSubjAr.trim(),
      code,
    };
    await onUpdateFormConfig({
      ...formConfig,
      subjects: [...formConfig.subjects, newSubject],
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'CREATE',
      entityTitleAr: `مادة دراسية جديدة: ${newSubject.ar} (${newSubject.code})`,
      entityTitleEn: `New Subject: ${newSubject.en} (${newSubject.code})`,
      summaryAr: `إضافة مادة "${newSubject.ar}" برمز باركود (${newSubject.code}) إلى قوائم الدليل.`,
      summaryEn: `Added subject "${newSubject.en}" with barcode code (${newSubject.code}).`,
      changes: [
        {
          field: 'subject',
          labelAr: 'المادة الدراسية المضافة',
          labelEn: 'Added Subject Option',
          before: '—',
          after: `${newSubject.ar} / ${newSubject.en} [${newSubject.code}]`,
        },
      ],
    });
    setNewSubjAr('');
    setNewSubjEn('');
    setNewSubjCode('');
  };

  const handleRemoveSubject = async (id: string) => {
    if (!isAdmin || formConfig.subjects.length <= 1) return;
    const removed = formConfig.subjects.find((s) => s.id === id);
    await onUpdateFormConfig({
      ...formConfig,
      subjects: formConfig.subjects.filter((s) => s.id !== id),
    });
    if (removed) {
      await onRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CONFIG_LOOKUP',
        action: 'DELETE',
        entityTitleAr: `حذف مادة دراسية: ${removed.ar}`,
        entityTitleEn: `Removed Subject: ${removed.en}`,
        summaryAr: `تم حذف المادة الدراسية "${removed.ar}" (${removed.code}) من قوائم التهيئة.`,
        summaryEn: `Removed subject "${removed.en}" (${removed.code}) from lookups.`,
        changes: [
          {
            field: 'subject',
            labelAr: 'المادة المحذوفة',
            labelEn: 'Removed Subject',
            before: `${removed.ar} [${removed.code}]`,
            after: 'محذوف (Deleted)',
          },
        ],
      });
    }
  };

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newGradeAr.trim()) return;
    const newGrade: GradeOption = {
      id: `grd-${Date.now()}`,
      stage: newGradeStage,
      ar: newGradeAr.trim(),
      en: newGradeEn.trim() || newGradeAr.trim(),
      code: (newGradeCode.trim() || 'GX').toUpperCase(),
    };
    await onUpdateFormConfig({
      ...formConfig,
      grades: [...formConfig.grades, newGrade],
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'CREATE',
      entityTitleAr: `إضافة صف دراسي: ${newGrade.ar}`,
      entityTitleEn: `Added Grade: ${newGrade.en}`,
      summaryAr: `إضافة الصف "${newGrade.ar}" (${newGrade.code}) ضمن المرحلة ${newGrade.stage}.`,
      summaryEn: `Added grade "${newGrade.en}" (${newGrade.code}) under ${newGrade.stage}.`,
      changes: [
        {
          field: 'grade',
          labelAr: 'الصف الدراسي المضاف',
          labelEn: 'Added Grade Option',
          before: '—',
          after: `${newGrade.ar} (${newGrade.stage} · ${newGrade.code})`,
        },
      ],
    });
    setNewGradeAr('');
    setNewGradeEn('');
    setNewGradeCode('');
  };

  const handleRemoveGrade = async (id: string) => {
    if (!isAdmin || formConfig.grades.length <= 1) return;
    const removed = formConfig.grades.find((g) => g.id === id);
    await onUpdateFormConfig({
      ...formConfig,
      grades: formConfig.grades.filter((g) => g.id !== id),
    });
    if (removed) {
      await onRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CONFIG_LOOKUP',
        action: 'DELETE',
        entityTitleAr: `حذف صف دراسي: ${removed.ar}`,
        entityTitleEn: `Removed Grade: ${removed.en}`,
        summaryAr: `تم حذف الصف الدراسي "${removed.ar}" من قوائم التهيئة.`,
        summaryEn: `Removed grade "${removed.en}" from lookups.`,
        changes: [
          {
            field: 'grade',
            labelAr: 'الصف المحذوف',
            labelEn: 'Removed Grade',
            before: `${removed.ar} [${removed.code}]`,
            after: 'محذوف (Deleted)',
          },
        ],
      });
    }
  };

  // Handlers for Suppliers & Schools
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newSupAr.trim()) return;
    const newSup: SupplierEntity = {
      id: `sup-${Date.now()}`,
      code: (newSupCode.trim() || `PRS-${Math.floor(10 + Math.random() * 89)}`).toUpperCase(),
      nameAr: newSupAr.trim(),
      name: newSupEn.trim() || newSupAr.trim(),
      type: newSupType,
    };
    await onUpdateFormConfig({
      ...formConfig,
      suppliers: [...formConfig.suppliers, newSup],
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'CREATE',
      entityTitleAr: `إضافة جهة توريد: ${newSup.nameAr}`,
      entityTitleEn: `Added Supplier: ${newSup.name}`,
      summaryAr: `إضافة جهة التوريد "${newSup.nameAr}" (${newSup.code}) إلى قائمة الموردين المعتمدين.`,
      summaryEn: `Added supplier "${newSup.name}" (${newSup.code}) to approved suppliers.`,
      changes: [
        {
          field: 'supplier',
          labelAr: 'جهة التوريد المضافة',
          labelEn: 'Added Supplier Entity',
          before: '—',
          after: `${newSup.nameAr} (${newSup.code} · ${newSup.type})`,
        },
      ],
    });
    setNewSupAr('');
    setNewSupEn('');
    setNewSupCode('');
  };

  const handleRemoveSupplier = async (id: string) => {
    if (!isAdmin || formConfig.suppliers.length <= 1) return;
    const removed = formConfig.suppliers.find((s) => s.id === id);
    await onUpdateFormConfig({
      ...formConfig,
      suppliers: formConfig.suppliers.filter((s) => s.id !== id),
    });
    if (removed) {
      await onRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CONFIG_LOOKUP',
        action: 'DELETE',
        entityTitleAr: `حذف جهة توريد: ${removed.nameAr}`,
        entityTitleEn: `Removed Supplier: ${removed.name}`,
        summaryAr: `تم حذف جهة التوريد "${removed.nameAr}" (${removed.code}).`,
        summaryEn: `Removed supplier "${removed.name}" (${removed.code}).`,
        changes: [
          {
            field: 'supplier',
            labelAr: 'جهة التوريد المحذوفة',
            labelEn: 'Removed Supplier',
            before: `${removed.nameAr} (${removed.code})`,
            after: 'محذوف (Deleted)',
          },
        ],
      });
    }
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newSchAr.trim()) return;
    await onAddSchool({
      nameAr: newSchAr.trim(),
      name: newSchEn.trim() || newSchAr.trim(),
      code: (newSchCode.trim() || `SCH-CAI-${Math.floor(100 + Math.random() * 899)}`).toUpperCase(),
      districtAr: newSchDistrictAr.trim(),
      district: newSchDistrictAr.trim(),
      stage: newSchStage,
      studentCount: Number(newSchStudents) || 600,
      recipientName: newSchRecipient.trim() || 'مسؤول التوريدات بالمدرسة',
      phone: newSchPhone.trim() || '0100-000-0000',
    });
    setNewSchAr('');
    setNewSchEn('');
    setNewSchCode('');
    setNewSchRecipient('');
    setNewSchPhone('');
  };

  // Handlers for Automation & Defaults
  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const diffs: AuditFieldDiff[] = [];
    if (prefixes.barcodePrefix !== formConfig.prefixes.barcodePrefix) {
      diffs.push({
        field: 'barcodePrefix',
        labelAr: 'بادئة الباركود الوزاري',
        labelEn: 'Barcode Prefix',
        before: formConfig.prefixes.barcodePrefix,
        after: prefixes.barcodePrefix,
      });
    }
    if (prefixes.inboundInvoicePrefix !== formConfig.prefixes.inboundInvoicePrefix) {
      diffs.push({
        field: 'inboundInvoicePrefix',
        labelAr: 'بادئة فاتورة التوريد',
        labelEn: 'Inbound Invoice Prefix',
        before: formConfig.prefixes.inboundInvoicePrefix,
        after: prefixes.inboundInvoicePrefix,
      });
    }
    if (prefixes.outboundSchoolPrefix !== formConfig.prefixes.outboundSchoolPrefix) {
      diffs.push({
        field: 'outboundSchoolPrefix',
        labelAr: 'بادئة إذن الصرف المدرسي',
        labelEn: 'School Outbound Prefix',
        before: formConfig.prefixes.outboundSchoolPrefix,
        after: prefixes.outboundSchoolPrefix,
      });
    }
    if (defaults.defaultMinStockLevel !== formConfig.defaults.defaultMinStockLevel) {
      diffs.push({
        field: 'defaultMinStockLevel',
        labelAr: 'الحد الأدنى الافتراضي للمخزون',
        labelEn: 'Default Min Stock Threshold',
        before: String(formConfig.defaults.defaultMinStockLevel),
        after: String(defaults.defaultMinStockLevel),
      });
    }
    if (defaults.defaultOpeningStock !== formConfig.defaults.defaultOpeningStock) {
      diffs.push({
        field: 'defaultOpeningStock',
        labelAr: 'الرصيد الافتتاحي الافتراضي',
        labelEn: 'Default Opening Stock',
        before: String(formConfig.defaults.defaultOpeningStock),
        after: String(defaults.defaultOpeningStock),
      });
    }
    if (defaults.defaultInboundQty !== formConfig.defaults.defaultInboundQty) {
      diffs.push({
        field: 'defaultInboundQty',
        labelAr: 'كمية التوريد الافتراضية (+)',
        labelEn: 'Default Inbound Qty (+)',
        before: String(formConfig.defaults.defaultInboundQty),
        after: String(defaults.defaultInboundQty),
      });
    }
    if (defaults.defaultOutboundQty !== formConfig.defaults.defaultOutboundQty) {
      diffs.push({
        field: 'defaultOutboundQty',
        labelAr: 'كمية الصرف الافتراضية (-)',
        labelEn: 'Default Outbound Qty (-)',
        before: String(formConfig.defaults.defaultOutboundQty),
        after: String(defaults.defaultOutboundQty),
      });
    }

    await onUpdateFormConfig({
      ...formConfig,
      prefixes,
      defaults,
    });

    if (diffs.length > 0) {
      await onRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CONFIG_LOOKUP',
        action: 'UPDATE',
        entityTitleAr: 'تحديث بادئات الترقيم التلقائي والقيم الافتراضية للنماذج',
        entityTitleEn: 'Updated Auto-Numbering Prefixes & Form Defaults',
        summaryAr: `تم تعديل ${diffs.length} من إعدادات الترقيم التلقائي والقيم الافتراضية للنماذج.`,
        summaryEn: `Modified ${diffs.length} numbering prefix and form default parameters.`,
        changes: diffs,
      });
    }
  };

  // Handlers for Note Templates
  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !tplTitleAr.trim() || !tplTextAr.trim()) return;
    const item: NoteTemplateItem = {
      id: `tpl-${Date.now()}`,
      type: tplType,
      titleAr: tplTitleAr.trim(),
      titleEn: tplTitleAr.trim(),
      textAr: tplTextAr.trim(),
      textEn: tplTextAr.trim(),
    };
    await onUpdateFormConfig({
      ...formConfig,
      noteTemplates: [...formConfig.noteTemplates, item],
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'CREATE',
      entityTitleAr: `إضافة قالب ملاحظة سريعة: ${item.titleAr}`,
      entityTitleEn: `Added Quick Note Template: ${item.titleEn}`,
      summaryAr: `إضافة قالب ملاحظات جاهز (${item.type}) بعنوان "${item.titleAr}".`,
      summaryEn: `Added quick note template (${item.type}) titled "${item.titleEn}".`,
      changes: [
        {
          field: 'noteTemplate',
          labelAr: 'نص القالب المضاف',
          labelEn: 'Template Content',
          before: '—',
          after: `${item.titleAr}: ${item.textAr}`,
        },
      ],
    });
    setTplTitleAr('');
    setTplTextAr('');
  };

  const handleRemoveTemplate = async (id: string) => {
    if (!isAdmin) return;
    const removed = formConfig.noteTemplates.find((t) => t.id === id);
    await onUpdateFormConfig({
      ...formConfig,
      noteTemplates: formConfig.noteTemplates.filter((t) => t.id !== id),
    });
    if (removed) {
      await onRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CONFIG_LOOKUP',
        action: 'DELETE',
        entityTitleAr: `حذف قالب ملاحظة: ${removed.titleAr}`,
        entityTitleEn: `Removed Note Template: ${removed.titleEn}`,
        summaryAr: `تم حذف قالب الملاحظات "${removed.titleAr}".`,
        summaryEn: `Removed note template "${removed.titleEn}".`,
        changes: [
          {
            field: 'noteTemplate',
            labelAr: 'القالب المحذوف',
            labelEn: 'Removed Template',
            before: removed.titleAr,
            after: 'محذوف (Deleted)',
          },
        ],
      });
    }
  };

  // Handlers for Automation Rules
  const handleToggleRule = async (rule: AutomationRuleItem) => {
    if (!isAdmin) return;
    const nextEnabled = !rule.enabled;
    const nextRules = rules.map((r) => (r.id === rule.id ? { ...r, enabled: nextEnabled } : r));
    await onUpdateFormConfig({
      ...formConfig,
      automationRules: nextRules,
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'AUTOMATION_RULE',
      action: 'UPDATE',
      entityTitleAr: `${rule.nameAr} (${rule.code})`,
      entityTitleEn: `${rule.nameEn} (${rule.code})`,
      summaryAr: `${nextEnabled ? 'تفعيل' : 'تعطيل'} قاعدة الأتمتة "${rule.nameAr}".`,
      summaryEn: `${nextEnabled ? 'Enabled' : 'Disabled'} automation rule "${rule.nameEn}".`,
      changes: [
        {
          field: 'enabled',
          labelAr: 'حالة تفعيل القاعدة',
          labelEn: 'Rule Active State',
          before: rule.enabled ? 'مفعلة (Enabled)' : 'معطلة (Disabled)',
          after: nextEnabled ? 'مفعلة (Enabled)' : 'معطلة (Disabled)',
        },
      ],
    });
  };

  const handleUpdateRuleParameter = async (
    rule: AutomationRuleItem,
    nextParam: number,
    nextEmail?: string
  ) => {
    if (!isAdmin) return;
    const cleanParam = Math.max(0, Number(nextParam) || 0);
    const cleanEmail = nextEmail !== undefined ? nextEmail.trim() : rule.targetEmail;
    if (cleanParam === rule.parameterValue && cleanEmail === rule.targetEmail) return;

    const diffs: AuditFieldDiff[] = [];
    if (cleanParam !== rule.parameterValue) {
      diffs.push({
        field: 'parameterValue',
        labelAr:
          rule.triggerType === 'REORDER_POINT_PERCENTAGE'
            ? 'نسبة حد إعادة الطلب من المخزون الأقصى (%)'
            : 'عتبة الرصيد المشغلة للقاعدة',
        labelEn:
          rule.triggerType === 'REORDER_POINT_PERCENTAGE'
            ? 'Reorder Point Percentage (%)'
            : 'Stock Trigger Threshold',
        before:
          rule.triggerType === 'REORDER_POINT_PERCENTAGE'
            ? `${rule.parameterValue}%`
            : `${rule.parameterValue}`,
        after:
          rule.triggerType === 'REORDER_POINT_PERCENTAGE'
            ? `${cleanParam}%`
            : `${cleanParam}`,
      });
    }
    if (cleanEmail !== rule.targetEmail) {
      diffs.push({
        field: 'targetEmail',
        labelAr: 'البريد الإلكتروني المستلم للتنبيه',
        labelEn: 'Target Notification Email',
        before: rule.targetEmail || '—',
        after: cleanEmail || '—',
      });
    }

    const nextRules = rules.map((r) =>
      r.id === rule.id
        ? {
            ...r,
            parameterValue: cleanParam,
            targetEmail: cleanEmail,
          }
        : r
    );

    await onUpdateFormConfig({
      ...formConfig,
      automationRules: nextRules,
    });

    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'AUTOMATION_RULE',
      action: 'UPDATE',
      entityTitleAr: `${rule.nameAr} (${rule.code})`,
      entityTitleEn: `${rule.nameEn} (${rule.code})`,
      summaryAr: `تحديث معلمات قاعدة الأتمتة "${rule.nameAr}".`,
      summaryEn: `Updated parameters for automation rule "${rule.nameEn}".`,
      changes: diffs,
    });
  };

  const handleAddAutomationRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const defaultNames: Record<
      AutomationTriggerType,
      { ar: string; en: string; descAr: string; descEn: string; prefix: string }
    > = {
      REORDER_POINT_PERCENTAGE: {
        ar: `احتساب حد إعادة الطلب تلقائياً بنسبة ${newRuleParam}% من الحد الأقصى للمخزون`,
        en: `Auto-calculate reorder point as ${newRuleParam}% of maximum stock`,
        descAr: `يضبط الحد الأدنى للمخزون (minStockLevel) لكل كتاب ليكون ${newRuleParam}% من السعة القصوى المرجعية للصنف.`,
        descEn: `Recalculates textbook minStockLevel as ${newRuleParam}% of reference maximum stock.`,
        prefix: 'AUTO-ROP',
      },
      ZERO_STOCK_NOTIFICATION: {
        ar: `إطلاق إشعار بريد إلكتروني وتنبيه داخلي عند وصول الرصيد إلى ${newRuleParam}`,
        en: `Auto-trigger email notification when stock hits ${newRuleParam}`,
        descAr: `يولّد إشعاراً فورياً في مركز التنبيهات الداخلية إلى ${newRuleEmail} عند وصول الرصيد إلى ${newRuleParam}.`,
        descEn: `Triggers an alert to ${newRuleEmail} in the In-App Alert Center when stock reaches ${newRuleParam}.`,
        prefix: 'AUTO-ZERO',
      },
      CRITICAL_STOCK_BUFFER: {
        ar: `تنبيه مبكر للأصناف الحرجة تحت هامش الأمان (${newRuleParam} نسخة)`,
        en: `Auto-flag critical textbooks below ${newRuleParam} copies safety buffer`,
        descAr: `يرصد الكتب التي ينخفض رصيدها عن ${newRuleParam} نسخة ويسجل تنبيه توريد عاجل.`,
        descEn: `Flags textbooks whose current stock drops below ${newRuleParam} copies.`,
        prefix: 'AUTO-BUF',
      },
      AUTO_ARCHIVE_EXPIRED_YEAR: {
        ar: `فحص الكتب من الطبعات السابقة وإصدار تنبيه جرد سنوي`,
        en: `Flag archival academic year editions for annual stock review`,
        descAr: `يرصد الكتب المسجلة بأعوام دراسية سابقة عن العام الافتراضي لإصدار إشعار مراجعة مخزنية.`,
        descEn: `Detects textbooks belonging to older academic years and logs an audit review alert.`,
        prefix: 'AUTO-ARC',
      },
    };

    const meta = defaultNames[newRuleTrigger];
    const newRule: AutomationRuleItem = {
      id: `rule-${Date.now()}`,
      code: `${meta.prefix}-${Math.floor(10 + Math.random() * 89)}`,
      nameAr: newRuleNameAr.trim() || meta.ar,
      nameEn: newRuleNameEn.trim() || meta.en,
      descriptionAr: meta.descAr,
      descriptionEn: meta.descEn,
      triggerType: newRuleTrigger,
      parameterValue: Math.max(0, Number(newRuleParam) || 0),
      targetEmail: newRuleEmail.trim() || 'warehouse-alerts@moe.gov.eg',
      enabled: true,
      lastRunAt: null,
      lastRunSummaryAr: null,
      lastRunSummaryEn: null,
    };

    await onUpdateFormConfig({
      ...formConfig,
      automationRules: [newRule, ...rules],
    });

    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'AUTOMATION_RULE',
      action: 'CREATE',
      entityTitleAr: `${newRule.nameAr} (${newRule.code})`,
      entityTitleEn: `${newRule.nameEn} (${newRule.code})`,
      summaryAr: `إضافة قاعدة أتمتة جديدة (${newRule.code}) وتخزينها في FormLookupsConfig.`,
      summaryEn: `Created new automation rule (${newRule.code}) stored in FormLookupsConfig.`,
      changes: [
        {
          field: 'rule',
          labelAr: 'قاعدة الأتمتة المضافة',
          labelEn: 'Created Automation Rule',
          before: '—',
          after: `${newRule.nameAr} [Param: ${newRule.parameterValue}, Email: ${newRule.targetEmail}]`,
        },
      ],
    });

    setNewRuleNameAr('');
    setNewRuleNameEn('');
  };

  const handleDeleteRule = async (rule: AutomationRuleItem) => {
    if (!isAdmin) return;
    await onUpdateFormConfig({
      ...formConfig,
      automationRules: rules.filter((r) => r.id !== rule.id),
    });
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'AUTOMATION_RULE',
      action: 'DELETE',
      entityTitleAr: `حذف قاعدة أتمتة: ${rule.nameAr}`,
      entityTitleEn: `Deleted Automation Rule: ${rule.nameEn}`,
      summaryAr: `تم حذف القاعدة (${rule.code}) من إعدادات الأتمتة.`,
      summaryEn: `Removed rule (${rule.code}) from FormLookupsConfig.`,
      changes: [
        {
          field: 'rule',
          labelAr: 'القاعدة المحذوفة',
          labelEn: 'Deleted Rule',
          before: `${rule.nameAr} (${rule.code})`,
          after: 'محذوفة (Deleted)',
        },
      ],
    });
  };

  const handleRunRulesClick = async () => {
    if (!isAdmin || isRunningRules) return;
    setIsRunningRules(true);
    try {
      await onExecuteAutomationRules();
    } finally {
      setIsRunningRules(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    const nextAlerts = alerts.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a));
    await onUpdateFormConfig({
      ...formConfig,
      automationAlerts: nextAlerts,
    });
  };

  const handleClearAcknowledgedAlerts = async () => {
    if (!isAdmin) return;
    const nextAlerts = alerts.filter((a) => !a.acknowledged);
    await onUpdateFormConfig({
      ...formConfig,
      automationAlerts: nextAlerts,
    });
  };

  const handleRestoreDefaults = async () => {
    if (!isAdmin) return;
    setPrefixes(DEFAULT_FORM_LOOKUPS.prefixes);
    setDefaults(DEFAULT_FORM_LOOKUPS.defaults);
    await onUpdateFormConfig(DEFAULT_FORM_LOOKUPS);
    await onRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'UPDATE',
      entityTitleAr: 'استعادة الإعدادات القياسية الافتراضية للتهيئة والأتمتة',
      entityTitleEn: 'Restored Default Form Lookups & Automation Rules',
      summaryAr: 'تمت إعادة ضبط جميع قوائم الاختيار وبادئات الترقيم وقواعد الأتمتة إلى القيم القياسية للوزارة.',
      summaryEn: 'Reset all dropdown lookups, prefixes, defaults, and automation rules to factory Ministry standards.',
      changes: [
        {
          field: 'formConfig',
          labelAr: 'حالة منظومة التهيئة',
          labelEn: 'Configuration Snapshot',
          before: 'إعدادات مخصصة (Customized)',
          after: 'الإعدادات القياسية الافتراضية (Ministry Default Seed)',
        },
      ],
    });
  };

  const subTabs: {
    id: ConfigSubTab;
    ar: string;
    en: string;
    icon: React.FC<{ className?: string }>;
    badgeCount?: number;
  }[] = [
    {
      id: 'AUTOMATION_RULES',
      ar: 'قواعد الأتمتة الذكية',
      en: 'Automation Rules',
      icon: Zap,
      badgeCount: rules.filter((r) => r.enabled).length,
    },
    {
      id: 'AUDIT_LOG',
      ar: 'سجل التدقيق والمساءلة',
      en: 'Audit Log',
      icon: History,
      badgeCount: auditLogs.length,
    },
    {
      id: 'ACADEMIC',
      ar: 'الأعوام والمواد والصفوف',
      en: 'Academic & Subjects',
      icon: BookOpen,
    },
    {
      id: 'ENTITIES',
      ar: 'المدارس وجهات التوريد',
      en: 'Schools & Suppliers',
      icon: Building2,
    },
    {
      id: 'AUTOMATION',
      ar: 'بادئات الترقيم والقيم الافتراضية',
      en: 'Prefixes & Defaults',
      icon: Hash,
    },
    {
      id: 'TEMPLATES',
      ar: 'قوالب الملاحظات الجاهزة',
      en: 'Note Templates',
      icon: FileText,
    },
  ];

  const getCategoryLabel = (cat: AuditCategory) => {
    switch (cat) {
      case 'AUTOMATION_RULE':
        return isAr ? 'قواعد الأتمتة' : 'Automation Rule';
      case 'CONFIG_LOOKUP':
        return isAr ? 'تهيئة المدخلات' : 'Config & Lookups';
      case 'CATALOG_BOOK':
        return isAr ? 'دليل الكتب' : 'Catalog Book';
      case 'INVENTORY_TRANSACTION':
        return isAr ? 'حركة مخزنية' : 'Stock Transaction';
      case 'USER_ACCESS':
        return isAr ? 'صلاحيات المستخدمين' : 'User Access';
      case 'WORKSPACE_STATUS':
        return isAr ? 'حالة المساحات المخزنية' : 'Workspace Status';
      case 'STOCKTAKING_AUDIT':
        return isAr ? 'جرد وتوالف' : 'Stocktaking & Quarantine';
    }
  };

  const getActionLabel = (act: AuditLogEntry['action']) => {
    switch (act) {
      case 'CREATE':
        return isAr ? 'إضافة / إنشاء' : 'Created';
      case 'UPDATE':
        return isAr ? 'تعديل' : 'Updated';
      case 'DELETE':
        return isAr ? 'حذف' : 'Deleted';
      case 'EXECUTE_RULES':
        return isAr ? 'تشغيل قواعد الأتمتة' : 'Executed Rules';
      case 'BULK_ADJUST':
        return isAr ? 'تسوية جماعية' : 'Bulk Adjustment';
      case 'SUSPEND':
        return isAr ? 'إيقاف تنشيط' : 'Suspended';
      case 'ACTIVATE':
        return isAr ? 'إعادة تنشيط' : 'Activated';
      case 'RECONCILE':
        return isAr ? 'تسوية فروق جرد' : 'Stock Reconciled';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Sliders className="w-4 h-4 text-[#006F88]" />
              <span>
                {isAr
                  ? 'محرك تهيئة النماذج وقواعد الأتمتة وسجل المساءلة والتدقيق'
                  : 'Form Lookups, Automation Rules Engine & Accountability Audit Log'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isAr
                ? 'تهيئة المدخلات وقواعد الأتمتة وسجل التدقيق (Config & Governance)'
                : 'Configuration, Automation Rules & Audit Log'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
              {isAr
                ? 'أدر قواعد الأتمتة الذكية (مثل احتساب نقطة إعادة الطلب بنسبة 20% من الحد الأقصى للمخزون أو إرسال تنبيه عند وصول الرصيد إلى 0)، وراجع سجل التدقيق الزمني لجميع التغييرات مع هوية المستخدم والقيم قبل/بعد.'
                : 'Define smart automation rules stored in FormLookupsConfig, trigger batch rule evaluations, and inspect the chronological Audit Log tracking who changed what with before/after diffs.'}
            </p>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={handleRestoreDefaults}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'استعادة القيم القياسية الافتراضية' : 'Restore Default Lookups'}</span>
            </button>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {isAr
                  ? 'عرض للقراءة والتدقيق فقط — تعديل الإعدادات وقواعد الأتمتة حصري لمدير النظام (ADMIN).'
                  : 'Read-Only View — Modifying settings and automation rules is restricted to System Admin (ADMIN).'}
              </span>
              <button
                type="button"
                onClick={onOpenRoleModal}
                className="font-semibold underline whitespace-nowrap cursor-pointer"
              >
                {isAr ? 'التبديل للمدير' : 'Switch to Admin'}
              </button>
            </div>
          )}
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1.5 mt-5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-800 text-[#006F88] dark:text-cyan-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isAr ? tab.ar : tab.en}</span>
                {tab.badgeCount !== undefined && (
                  <span className="font-mono tabular-nums text-[11px] opacity-75">
                    ({tab.badgeCount})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: AUTOMATION RULES ENGINE & IN-APP ALERT CENTER */}
      {subTab === 'AUTOMATION_RULES' && (
        <div className="space-y-6">
          {/* Top Action Bar for Automation Rules */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Zap className="w-4 h-4 text-[#006F88]" />
                <span>
                  {isAr
                    ? `محرك قواعد الأتمتة المخزنة في FormLookupsConfig (${
                        rules.filter((r) => r.enabled).length
                      } قواعد مفعلة من إجمالي ${rules.length})`
                    : `Automation Rules stored in FormLookupsConfig (${
                        rules.filter((r) => r.enabled).length
                      } active of ${rules.length})`}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'قواعد الأتمتة الذكية لإعادة احتساب نقاط الطلب وتنبيهات نفاد المخزون'
                  : 'Smart Inventory Automation Rules & Reorder Point Calibration'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'اضبط النسب المئوية وعتبات التنبيه ثم اضغط "تشغيل القواعد النشطة الآن" لتطبيقها على جميع الكتب وتسجيل النتائج في مركز التنبيهات وسجل التدقيق.'
                  : 'Configure rule thresholds and click "Run Rules Now" to evaluate all textbooks, update reorder points, and log alerts in the In-App Alert Center and Audit Log.'}
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                disabled={isRunningRules || rules.filter((r) => r.enabled).length === 0}
                onClick={handleRunRulesClick}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>
                  {isRunningRules
                    ? isAr
                      ? 'جاري تنفيذ القواعد...'
                      : 'Running Rules...'
                    : isAr
                    ? 'تشغيل القواعد النشطة الآن (Run Rules Now)'
                    : 'Run Rules Now'}
                </span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): Configured Automation Rules + Add New Rule Form */}
            <div className="lg:col-span-7 space-y-4">
              {rules.map((rule) => (
                <AutomationRuleCard
                  key={rule.id}
                  rule={rule}
                  isAdmin={isAdmin}
                  isAr={isAr}
                  onToggle={() => handleToggleRule(rule)}
                  onSaveParams={(param, email) => handleUpdateRuleParameter(rule, param, email)}
                  onDelete={() => handleDeleteRule(rule)}
                />
              ))}

              {/* Add New Automation Rule Form (Admin Only) */}
              {isAdmin && (
                <form
                  onSubmit={handleAddAutomationRule}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {isAr ? 'إضافة قاعدة أتمتة جديدة إلى FormLookupsConfig' : 'Add New Automation Rule'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isAr
                        ? 'اختر نوع المشغل وحدد النسبة المئوية أو العتبة الرقمية والبريد المستلم للتنبيه الداخلي'
                        : 'Select rule trigger type, threshold value, and notification recipient'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                        {isAr ? 'نوع قاعدة الأتمتة (Rule Trigger Type)' : 'Rule Trigger Type'}
                      </label>
                      <select
                        value={newRuleTrigger}
                        onChange={(e) => {
                          const val = e.target.value as AutomationTriggerType;
                          setNewRuleTrigger(val);
                          if (val === 'REORDER_POINT_PERCENTAGE') setNewRuleParam(20);
                          if (val === 'ZERO_STOCK_NOTIFICATION') setNewRuleParam(0);
                          if (val === 'CRITICAL_STOCK_BUFFER') setNewRuleParam(500);
                        }}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      >
                        <option value="REORDER_POINT_PERCENTAGE">
                          {isAr
                            ? 'احتساب نقطة إعادة الطلب تلقائياً كنسبة مئوية (%) من الحد الأقصى للمخزون'
                            : 'Auto-calculate reorder point as X% of maximum stock'}
                        </option>
                        <option value="ZERO_STOCK_NOTIFICATION">
                          {isAr
                            ? 'إطلاق إشعار بريد وتنبيه داخلي تلقائي عند وصول الرصيد إلى 0 (أو عتبة محددة)'
                            : 'Auto-trigger email notification when stock hits 0 (or threshold)'}
                        </option>
                        <option value="CRITICAL_STOCK_BUFFER">
                          {isAr
                            ? 'تنبيه مبكر للأصناف الحرجة تحت هامش الأمان (عدد النسخ)'
                            : 'Auto-flag critical textbooks below safety buffer copies'}
                        </option>
                        <option value="AUTO_ARCHIVE_EXPIRED_YEAR">
                          {isAr
                            ? 'فحص الكتب من الأعوام الدراسية السابقة وإصدار تنبيه جرد'
                            : 'Flag archival academic year editions for stock review'}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                        {isAr ? 'عنوان القاعدة (بالعربية - اختياري)' : 'Custom Rule Title (Arabic)'}
                      </label>
                      <input
                        type="text"
                        value={newRuleNameAr}
                        onChange={(e) => setNewRuleNameAr(e.target.value)}
                        placeholder={
                          newRuleTrigger === 'REORDER_POINT_PERCENTAGE'
                            ? `احتساب حد إعادة الطلب بنسبة ${newRuleParam}% من الحد الأقصى`
                            : `إشعار تلقائي عند وصول الرصيد إلى ${newRuleParam}`
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                        {isAr ? 'عنوان القاعدة (بالإنجليزية - اختياري)' : 'Custom Rule Title (English)'}
                      </label>
                      <input
                        type="text"
                        value={newRuleNameEn}
                        onChange={(e) => setNewRuleNameEn(e.target.value)}
                        placeholder={
                          newRuleTrigger === 'REORDER_POINT_PERCENTAGE'
                            ? `Auto-calculate reorder point as ${newRuleParam}% of max stock`
                            : `Auto-trigger email notification when stock hits ${newRuleParam}`
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                        {newRuleTrigger === 'REORDER_POINT_PERCENTAGE'
                          ? isAr
                            ? 'النسبة المئوية من الحد الأقصى (%)'
                            : 'Percentage of Maximum Stock (%)'
                          : isAr
                          ? 'العتبة الرقمية للرصيد (عدد النسخ)'
                          : 'Stock Threshold (Copies)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={newRuleTrigger === 'REORDER_POINT_PERCENTAGE' ? 100 : 100000}
                        value={newRuleParam}
                        onChange={(e) => setNewRuleParam(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                        {isAr
                          ? 'البريد الإلكتروني المستلم للتنبيه الداخلي'
                          : 'Target Notification Email'}
                      </label>
                      <input
                        type="email"
                        value={newRuleEmail}
                        onChange={(e) => setNewRuleEmail(e.target.value)}
                        placeholder="warehouse-alerts@moe.gov.eg"
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'حفظ وإضافة قاعدة الأتمتة' : 'Add Automation Rule'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Column (5 cols): In-App Alert Center & Live Stock Preview */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#006F88]" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {isAr
                          ? 'مركز التنبيهات والإشعارات الداخلية (In-App Alert Center)'
                          : 'In-App Alert & Notification Center'}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isAr
                        ? `سجل الإشعارات البريدية والتنبيهات المولّدة بواسطة قواعد الأتمتة (${unacknowledgedAlertsCount} غير مقروء)`
                        : `Email & stock alerts triggered by automation rules (${unacknowledgedAlertsCount} unread)`}
                    </p>
                  </div>

                  {isAdmin && alerts.some((a) => a.acknowledged) && (
                    <button
                      type="button"
                      onClick={handleClearAcknowledgedAlerts}
                      className="text-xs text-slate-500 hover:text-red-600 cursor-pointer whitespace-nowrap"
                    >
                      {isAr ? 'مسح المقروء' : 'Clear Read'}
                    </button>
                  )}
                </div>

                {alerts.length === 0 ? (
                  <div className="p-8 text-center space-y-2 text-xs text-slate-500">
                    <Bell className="w-6 h-6 text-slate-400 mx-auto" />
                    <p>
                      {isAr
                        ? 'لا توجد تنبيهات نشطة حالياً. اضغط "تشغيل القواعد النشطة الآن" لفحص الأرصدة وتوليد الإشعارات.'
                        : 'No alerts logged yet. Click "Run Rules Now" to evaluate stock rules.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-[540px] overflow-y-auto">
                    {alerts.map((alrt) => (
                      <div
                        key={alrt.id}
                        className={`p-4 space-y-2 text-xs transition-colors ${
                          alrt.acknowledged
                            ? 'bg-slate-50/50 dark:bg-slate-950/40 opacity-70'
                            : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <AlertTriangle
                              className={`w-3.5 h-3.5 shrink-0 ${
                                alrt.severity === 'CRITICAL'
                                  ? 'text-red-600 dark:text-red-400'
                                  : alrt.severity === 'WARNING'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-[#006F88] dark:text-cyan-400'
                              }`}
                            />
                            <span className="text-slate-900 dark:text-slate-100">
                              {isAr ? alrt.ruleNameAr : alrt.ruleNameEn}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {new Date(alrt.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {isAr ? alrt.messageAr : alrt.messageEn}
                        </p>

                        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5 font-mono truncate">
                            <Mail className="w-3 h-3 shrink-0 text-[#006F88]" />
                            <span className="truncate">{alrt.recipientEmail || 'warehouse@moe.gov.eg'}</span>
                            {alrt.bookBarcode && (
                              <>
                                <span>·</span>
                                <span>{alrt.bookBarcode}</span>
                              </>
                            )}
                          </div>

                          {!alrt.acknowledged && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledgeAlert(alrt.id)}
                              className="text-[#006F88] dark:text-cyan-400 font-semibold hover:underline whitespace-nowrap cursor-pointer"
                            >
                              {isAr ? 'تأكيد القراءة' : 'Acknowledge'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {isAr ? 'إجمالي الكتب الخاضعة للفحص:' : 'Catalog Books Monitored:'}{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {books.length}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSubTab('AUDIT_LOG')}
                  className="font-semibold text-[#006F88] dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'عرض سجل التدقيق الكامل ←' : 'View Audit Log →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: ACCOUNTABILITY AUDIT LOG (CHRONOLOGICAL WITH BEFORE/AFTER DIFFS & FILTERS) */}
      {subTab === 'AUDIT_LOG' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ابحث باسم المسؤول، العنصر المعدل، ملخص العملية، أو القيم قبل/بعد...'
                      : 'Search by user name, modified entity, action summary, or before/after values...'
                  }
                  className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Role Filter */}
                <select
                  value={auditRoleFilter}
                  onChange={(e) => setAuditRoleFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">{isAr ? 'كل الأدوار الوظيفية' : 'All User Roles'}</option>
                  <option value="ADMIN">ADMIN ({isAr ? 'مدير النظام' : 'Admin'})</option>
                  <option value="STOREKEEPER">STOREKEEPER ({isAr ? 'أمين المخزن' : 'Storekeeper'})</option>
                  <option value="AUDITOR">AUDITOR ({isAr ? 'المراجع الداخلي' : 'Auditor'})</option>
                </select>

                {/* CSV Export */}
                <button
                  type="button"
                  onClick={() => exportAuditLogsToCSV(filteredAuditLogs, lang)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#006F88]" />
                  <span>{isAr ? 'تصدير سجل التدقيق CSV' : 'Export Audit CSV'}</span>
                </button>
              </div>
            </div>

            {/* Category Segmented Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                {(
                  [
                    { id: 'ALL', ar: 'كل السجلات', en: 'All Events' },
                    { id: 'AUTOMATION_RULE', ar: 'قواعد الأتمتة', en: 'Automation Rules' },
                    { id: 'CONFIG_LOOKUP', ar: 'تهيئة المدخلات', en: 'Config & Lookups' },
                    { id: 'CATALOG_BOOK', ar: 'دليل الكتب', en: 'Catalog CRUD' },
                    { id: 'INVENTORY_TRANSACTION', ar: 'حركات المخزون', en: 'Stock Movements' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAuditCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      auditCategoryFilter === cat.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {isAr ? cat.ar : cat.en}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {isAr
                  ? `عرض ${filteredAuditLogs.length} من إجمالي ${auditLogs.length} سجل تدقيق`
                  : `Showing ${filteredAuditLogs.length} of ${auditLogs.length} audit records`}
              </span>
            </div>
          </div>

          {/* Chronological Audit Log Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <History className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isAr
                    ? 'لا توجد سجلات تدقيق مطابقة لمعايير التصفية الحالية'
                    : 'No audit log entries match the current filter criteria'}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-3 text-start font-medium">
                        {isAr ? 'التاريخ والوقت' : 'Timestamp'}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {isAr ? 'المسؤول والدور الوظيفي' : 'User & Role'}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {isAr ? 'التصنيف والإجراء' : 'Category & Action'}
                      </th>
                      <th className="px-4 py-3 text-start font-medium">
                        {isAr ? 'العنصر المتأثر وملخص التغيير' : 'Target Entity & Summary'}
                      </th>
                      <th className="px-4 py-3 text-end font-medium">
                        {isAr ? 'الفروقات (قبل / بعد)' : 'Before / After Diff'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredAuditLogs.map((log) => {
                      const isExpanded = expandedAuditIds.includes(log.id);
                      const hasChanges = Array.isArray(log.changes) && log.changes.length > 0;
                      return (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-400">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {new Date(log.timestamp).toLocaleDateString(
                                  isAr ? 'ar-EG' : 'en-US',
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  }
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {new Date(log.timestamp).toLocaleTimeString(
                                  isAr ? 'ar-EG' : 'en-US',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  }
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {isAr ? log.actorNameAr : log.actorName}
                              </div>
                              <div className="text-[11px] font-mono text-[#006F88] dark:text-cyan-400">
                                {log.actorRole}
                              </div>
                            </td>

                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {getCategoryLabel(log.category)}
                              </div>
                              <div
                                className={`text-[11px] font-medium ${
                                  log.action === 'DELETE'
                                    ? 'text-red-600 dark:text-red-400'
                                    : log.action === 'CREATE'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : log.action === 'EXECUTE_RULES'
                                    ? 'text-[#006F88] dark:text-cyan-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {getActionLabel(log.action)}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {isAr ? log.entityTitleAr : log.entityTitleEn}
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                {isAr ? log.summaryAr : log.summaryEn}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-end whitespace-nowrap">
                              {hasChanges ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpandAudit(log.id)}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold text-[#006F88] dark:text-cyan-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span>
                                    {isAr
                                      ? `الفروقات (${log.changes.length})`
                                      : `Diffs (${log.changes.length})`}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-400 font-mono">—</span>
                              )}
                            </td>
                          </tr>

                          {/* Expandable Before vs. After Field Diff Row */}
                          {isExpanded && hasChanges && (
                            <tr className="bg-slate-50/90 dark:bg-slate-950/70">
                              <td colSpan={5} className="px-6 py-3.5">
                                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                                        <th className="px-3.5 py-2 text-start font-medium w-1/3">
                                          {isAr ? 'الحقل / الإعداد المتأثر' : 'Modified Field'}
                                        </th>
                                        <th className="px-3.5 py-2 text-start font-medium w-1/3">
                                          {isAr ? 'القيمة السابقة (Before)' : 'Previous Value (Before)'}
                                        </th>
                                        <th className="px-3.5 py-2 text-start font-medium w-1/3">
                                          {isAr ? 'القيمة الجديدة (After)' : 'Updated Value (After)'}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                                      {log.changes.map((chg, idx) => (
                                        <tr key={`${log.id}-chg-${idx}`}>
                                          <td className="px-3.5 py-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                                            {isAr ? chg.labelAr : chg.labelEn}
                                          </td>
                                          <td className="px-3.5 py-2 text-red-600 dark:text-red-400">
                                            {chg.before || '—'}
                                          </td>
                                          <td className="px-3.5 py-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                                            {chg.after || '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ACADEMIC YEARS, SUBJECTS & STAGE GRADES */}
      {subTab === 'ACADEMIC' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Academic Years Card */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr ? 'الأعوام الدراسية والطبعات' : 'Academic Years & Editions'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'حدد العام الدراسي الافتراضي الذي يُختار تلقائياً عند فتح النماذج'
                  : 'Set the default academic year pre-selected across all forms'}
              </p>
            </div>

            {isAdmin && (
              <form onSubmit={handleAddAcademicYear} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="2029/2030"
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة' : 'Add'}</span>
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {formConfig.academicYears.map((yr) => {
                const isDefault = formConfig.defaults.defaultAcademicYear === yr;
                return (
                  <div
                    key={yr}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center gap-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      <span>{yr}</span>
                      {isDefault && (
                        <span className="text-[11px] font-sans font-medium text-[#006F88] dark:text-cyan-400">
                          · {isAr ? 'افتراضي' : 'Default'}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultYear(yr)}
                            title={isAr ? 'تعيين كعام دراسي افتراضي' : 'Set as default year'}
                            className="px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-[#006F88] bg-slate-100 dark:bg-slate-800 rounded cursor-pointer inline-flex items-center gap-1"
                          >
                            <Star className="w-3 h-3" />
                            <span>{isAr ? 'تعيين افتراضي' : 'Set Default'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAcademicYear(yr)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subjects Lookup Card */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'قائمة المواد الدراسية ورموز الباركود التلقائي'
                  : 'Subjects Lookup & Auto-Barcode Subject Codes'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'تُستخدم هذه القائمة في نموذج الكتاب المدرسي لتوليد كود الباركود الوزاري تلقائياً'
                  : 'Used in the Book Catalog form to populate subject choices and generate standard Ministry barcodes'}
              </p>
            </div>

            {isAdmin && (
              <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  value={newSubjAr}
                  onChange={(e) => setNewSubjAr(e.target.value)}
                  placeholder={isAr ? 'اسم المادة بالعربية (مثال: الفلسفة)' : 'Subject (Arabic)'}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={newSubjEn}
                  onChange={(e) => setNewSubjEn(e.target.value)}
                  placeholder={isAr ? 'الاسم بالإنجليزية (Philosophy)' : 'Subject (English)'}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <input
                  type="text"
                  maxLength={4}
                  value={newSubjCode}
                  onChange={(e) => setNewSubjCode(e.target.value.toUpperCase())}
                  placeholder={isAr ? 'رمز الباركود (PHL)' : 'Code (e.g. PHL)'}
                  className="px-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة مادة دراسية' : 'Add Subject'}</span>
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto">
              {formConfig.subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{sub.ar}</div>
                    <div className="text-[11px] text-slate-500">
                      {sub.en} · <span className="font-mono text-[#006F88] dark:text-cyan-400">{sub.code}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSubject(sub.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Stage Grades Configuration */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isAr
                  ? 'الصفوف الدراسية المعتمدة حسب المرحلة التعليمية'
                  : 'Configured Grades per Educational Stage'}
              </h4>

              {isAdmin && (
                <form onSubmit={handleAddGrade} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <select
                    value={newGradeStage}
                    onChange={(e) => setNewGradeStage(e.target.value as EducationalStage)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="PRIMARY">{isAr ? 'الابتدائية' : 'Primary'}</option>
                    <option value="PREPARATORY">{isAr ? 'الإعدادية' : 'Preparatory'}</option>
                    <option value="SECONDARY">{isAr ? 'الثانوية' : 'Secondary'}</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={newGradeAr}
                    onChange={(e) => setNewGradeAr(e.target.value)}
                    placeholder={isAr ? 'اسم الصف بالعربية' : 'Grade (Arabic)'}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={newGradeEn}
                    onChange={(e) => setNewGradeEn(e.target.value)}
                    placeholder={isAr ? 'الاسم بالإنجليزية' : 'Grade (English)'}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    maxLength={4}
                    value={newGradeCode}
                    onChange={(e) => setNewGradeCode(e.target.value.toUpperCase())}
                    placeholder={isAr ? 'رمز (مثال: KG1)' : 'Code (KG1)'}
                    className="px-2.5 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إضافة صف' : 'Add Grade'}</span>
                  </button>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {formConfig.grades.map((g) => (
                  <div
                    key={g.id}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {isAr ? g.ar : g.en}
                      </span>
                      <span className="block text-[10px] font-mono text-slate-500">
                        {g.stage} · {g.code}
                      </span>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGrade(g.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BENEFICIARY SCHOOLS & PRINTING PRESS SUPPLIERS */}
      {subTab === 'ENTITIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Suppliers & Printing Presses */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'قائمة المطابع وجهات التوريد المعتمدة'
                  : 'Approved Printing Presses & Inbound Suppliers'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'تظهر كقائمة اختيار جاهزة عند تسجيل فواتير التوريد أو التسويات المخزنية'
                  : 'Available as selectable options in Inbound and Bulk Adjustment forms'}
              </p>
            </div>

            {isAdmin && (
              <form onSubmit={handleAddSupplier} className="space-y-2.5">
                <input
                  type="text"
                  required
                  value={newSupAr}
                  onChange={(e) => setNewSupAr(e.target.value)}
                  placeholder={isAr ? 'اسم المطبعة أو جهة التوريد (بالعربية) *' : 'Supplier Name (Arabic) *'}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newSupCode}
                    onChange={(e) => setNewSupCode(e.target.value.toUpperCase())}
                    placeholder={isAr ? 'الكود (PRS-05)' : 'Code (PRS-05)'}
                    className="px-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                  <select
                    value={newSupType}
                    onChange={(e) => setNewSupType(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="PRINTING_PRESS">{isAr ? 'مطبعة معتمدة' : 'Printing Press'}</option>
                    <option value="PUBLISHER">{isAr ? 'دار نشر' : 'Publisher'}</option>
                    <option value="RESERVE_SECTOR">{isAr ? 'مخزن احتياطي' : 'Reserve Sector'}</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إضافة جهة توريد للقائمة' : 'Add Supplier Option'}</span>
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {formConfig.suppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="px-3.5 py-3 flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {isAr ? sup.nameAr : sup.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {sup.code} · {sup.type}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSupplier(sup.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Beneficiary Schools List */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'دليل المدارس المستفيدة من الصرف المخزني'
                  : 'Beneficiary Schools Directory (Outbound Distribution)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'تظهر هذه المدارس في قوائم الاختيار عند تسجيل أذون الصرف المدرسي الفردية أو الجماعية'
                  : 'Populates the Receiving School dropdown in Outbound and Bulk Distribution forms'}
              </p>
            </div>

            {isAdmin && (
              <form
                onSubmit={handleCreateSchool}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              >
                <input
                  type="text"
                  required
                  value={newSchAr}
                  onChange={(e) => setNewSchAr(e.target.value)}
                  placeholder={isAr ? 'اسم المدرسة (بالعربية) *' : 'School Name (Arabic) *'}
                  className="sm:col-span-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  value={newSchCode}
                  onChange={(e) => setNewSchCode(e.target.value.toUpperCase())}
                  placeholder={isAr ? 'كود المدرسة (SCH-701)' : 'School Code'}
                  className="px-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  value={newSchDistrictAr}
                  onChange={(e) => setNewSchDistrictAr(e.target.value)}
                  placeholder={isAr ? 'الإدارة التعليمية' : 'Educational Directorate'}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <select
                  value={newSchStage}
                  onChange={(e) => setNewSchStage(e.target.value as EducationalStage)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="PRIMARY">{isAr ? 'الابتدائية' : 'Primary'}</option>
                  <option value="PREPARATORY">{isAr ? 'الإعدادية' : 'Preparatory'}</option>
                  <option value="SECONDARY">{isAr ? 'الثانوية' : 'Secondary'}</option>
                </select>
                <input
                  type="text"
                  value={newSchRecipient}
                  onChange={(e) => setNewSchRecipient(e.target.value)}
                  placeholder={isAr ? 'اسم مندوب العهدة' : 'Recipient Person'}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <div className="sm:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إضافة مدرسة جديدة للدليل' : 'Add Beneficiary School'}</span>
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              {schools.map((s) => (
                <div
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {isAr ? s.nameAr : s.name}{' '}
                      <span className="font-mono text-[#006F88] dark:text-cyan-400">({s.code})</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {isAr ? s.districtAr : s.district} · {s.recipientName}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onDeleteSchool(s.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: AUTO-NUMBERING PREFIXES & DEFAULT FORM QUANTITIES */}
      {subTab === 'AUTOMATION' && (
        <form
          onSubmit={handleSaveAutomation}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Auto-Numbering Prefixes */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isAr
                    ? 'بادئات التوليد التلقائي للباركود والفواتير وأذون الصرف'
                    : 'Automated Barcode & Document Numbering Prefixes'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr
                    ? 'تُستخدم لتوليد الأكواد المرجعية تلقائياً بمجرد فتح أي نموذج إدخال'
                    : 'Automatically prefixes generated barcodes, invoices, and school distribution slips'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'بادئة الباركود الوزاري (Barcode Prefix)' : 'Barcode Prefix'}
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={prefixes.barcodePrefix}
                    onChange={(e) =>
                      setPrefixes({ ...prefixes, barcodePrefix: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'بادئة فاتورة التوريد (Inbound Invoice)' : 'Inbound Invoice Prefix'}
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={prefixes.inboundInvoicePrefix}
                    onChange={(e) =>
                      setPrefixes({
                        ...prefixes,
                        inboundInvoicePrefix: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'بادئة التسوية اليدوية (Manual Entry)' : 'Manual Entry Prefix'}
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={prefixes.manualAdjustPrefix}
                    onChange={(e) =>
                      setPrefixes({
                        ...prefixes,
                        manualAdjustPrefix: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'بادئة إذن الصرف المدرسي (School Outbound)' : 'School Outbound Prefix'}
                  </label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={prefixes.outboundSchoolPrefix}
                    onChange={(e) =>
                      setPrefixes({
                        ...prefixes,
                        outboundSchoolPrefix: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="text-slate-500 font-medium">
                  {isAr ? 'معاينة الترقيم التلقائي المباشر:' : 'Live Auto-Generated Format Preview:'}
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-200 flex flex-wrap gap-3">
                  <span>
                    Barcode:{' '}
                    <strong className="text-[#006F88] dark:text-cyan-400">
                      {prefixes.barcodePrefix || 'MOE'}-2026-PRI-G4-ARB-42
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Invoice: <strong>{prefixes.inboundInvoicePrefix || 'INV'}-48291</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Dispense: <strong>{prefixes.outboundSchoolPrefix || 'DSP'}-71042</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Form Default Values */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isAr
                    ? 'القيم والكميات الافتراضية عند فتح النماذج'
                    : 'Pre-Filled Default Quantities & Thresholds'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr
                    ? 'تُعبأ هذه القيم تلقائياً في حقول الإدخال لتوفير الوقت وتقليل الأخطاء'
                    : 'Pre-populates form fields on open for rapid warehouse data entry'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'حد الطلب الأدنى الافتراضي للكتاب' : 'Default Min Stock Threshold'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={!isAdmin}
                    value={defaults.defaultMinStockLevel}
                    onChange={(e) =>
                      setDefaults({ ...defaults, defaultMinStockLevel: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'الرصيد الافتتاحي الافتراضي للكتاب الجديد' : 'Default Opening Stock'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={!isAdmin}
                    value={defaults.defaultOpeningStock}
                    onChange={(e) =>
                      setDefaults({ ...defaults, defaultOpeningStock: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'كمية التوريد الافتراضية (+)' : 'Default Inbound Quantity (+)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    disabled={!isAdmin}
                    value={defaults.defaultInboundQty}
                    onChange={(e) =>
                      setDefaults({ ...defaults, defaultInboundQty: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    {isAr ? 'كمية الصرف المدرسي الافتراضية (-)' : 'Default Outbound Quantity (-)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    disabled={!isAdmin}
                    value={defaults.defaultOutboundQty}
                    onChange={(e) =>
                      setDefaults({ ...defaults, defaultOutboundQty: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isAr
                    ? 'حفظ واعتماد إعدادات الأتمتة والقيم الافتراضية'
                    : 'Save Automation & Default Settings'}
                </span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* SUB-TAB 6: QUICK NOTE TEMPLATES */}
      {subTab === 'TEMPLATES' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isAr
                ? 'قوالب الملاحظات الجاهزة للتعبئة بنقرة واحدة داخل النماذج'
                : 'One-Click Quick Note Templates for Inbound & Outbound Forms'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr
                ? 'تظهر هذه القوالب كأزرار اختيار سريع فوق حقل الملاحظات في نافذة التوريد والصرف لتعبئة محضر الفحص أو الاستلام فوراً'
                : 'Rendered as quick-fill buttons above the Notes field in Transaction and Bulk Adjustment modals'}
            </p>
          </div>

          {isAdmin && (
            <form
              onSubmit={handleAddTemplate}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
            >
              <select
                value={tplType}
                onChange={(e) => setTplType(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="INBOUND">{isAr ? 'قالب توريد مخزني (+)' : 'Inbound Template (+)'}</option>
                <option value="OUTBOUND">{isAr ? 'قالب صرف مدرسي (-)' : 'Outbound Template (-)'}</option>
              </select>
              <input
                type="text"
                required
                value={tplTitleAr}
                onChange={(e) => setTplTitleAr(e.target.value)}
                placeholder={isAr ? 'عنوان القالب المختصر (مثال: استلام لجنة فنية)' : 'Short Template Label'}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <input
                type="text"
                required
                value={tplTextAr}
                onChange={(e) => setTplTextAr(e.target.value)}
                placeholder={isAr ? 'النص الكامل للملاحظة الذي سيُدرج في الفورم...' : 'Full note text to insert...'}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'إضافة قالب جاهز' : 'Add Note Template'}</span>
              </button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {formConfig.noteTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                    <span
                      className={
                        tpl.type === 'INBOUND'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      [{tpl.type === 'INBOUND' ? (isAr ? 'توريد' : 'Inbound') : isAr ? 'صرف' : 'Outbound'}]
                    </span>
                    <span>{isAr ? tpl.titleAr : tpl.titleEn}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {isAr ? tpl.textAr : tpl.textEn}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTemplate(tpl.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface AutomationRuleCardProps {
  rule: AutomationRuleItem;
  isAdmin: boolean;
  isAr: boolean;
  onToggle: () => void;
  onSaveParams: (param: number, email?: string) => void;
  onDelete: () => void;
}

const AutomationRuleCard: React.FC<AutomationRuleCardProps> = ({
  rule,
  isAdmin,
  isAr,
  onToggle,
  onSaveParams,
  onDelete,
}) => {
  const [paramVal, setParamVal] = useState<number>(rule.parameterValue);
  const [emailVal, setEmailVal] = useState<string>(rule.targetEmail || '');
  const isDirty =
    Number(paramVal) !== rule.parameterValue ||
    (rule.targetEmail !== undefined && emailVal.trim() !== (rule.targetEmail || ''));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-[#006F88] dark:text-cyan-400">
              {rule.code}
            </span>
            <span>·</span>
            <span
              className={
                rule.enabled
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-400'
              }
            >
              {rule.enabled
                ? isAr
                  ? 'مفعلة (Enabled)'
                  : 'Active'
                : isAr
                ? 'معطلة (Disabled)'
                : 'Disabled'}
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isAr ? rule.nameAr : rule.nameEn}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {isAr ? rule.descriptionAr : rule.descriptionEn}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!isAdmin}
            onClick={onToggle}
            className="text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            title={isAr ? 'تفعيل أو تعطيل القاعدة' : 'Toggle Rule'}
          >
            {rule.enabled ? (
              <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-slate-400" />
            )}
            <span>{rule.enabled ? (isAr ? 'مفعلة' : 'On') : isAr ? 'معطلة' : 'Off'}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={onDelete}
              title={isAr ? 'حذف القاعدة' : 'Delete Rule'}
              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Rule Parameter & Notification Email Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 items-end">
        <div className="sm:col-span-4">
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
            {rule.triggerType === 'REORDER_POINT_PERCENTAGE'
              ? isAr
                ? 'نسبة نقطة إعادة الطلب من الحد الأقصى (%)'
                : 'Reorder Point (% of Max Stock)'
              : isAr
              ? 'عتبة الرصيد المشغلة (عدد النسخ)'
              : 'Trigger Stock Threshold (Copies)'}
          </label>
          <input
            type="number"
            min={0}
            max={rule.triggerType === 'REORDER_POINT_PERCENTAGE' ? 100 : 100000}
            disabled={!isAdmin}
            value={paramVal}
            onChange={(e) => setParamVal(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
        </div>

        <div className="sm:col-span-5">
          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
            {isAr ? 'البريد المستلم للتنبيه الداخلي' : 'Notification Recipient Email'}
          </label>
          <input
            type="email"
            disabled={!isAdmin}
            value={emailVal}
            onChange={(e) => setEmailVal(e.target.value)}
            placeholder="warehouse-alerts@moe.gov.eg"
            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
        </div>

        <div className="sm:col-span-3 flex justify-end">
          {isAdmin && (
            <button
              type="button"
              disabled={!isDirty}
              onClick={() => onSaveParams(paramVal, emailVal)}
              className="w-full px-3 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
            >
              {isAr ? 'حفظ المعلمات' : 'Save Params'}
            </button>
          )}
        </div>
      </div>

      {/* Last Execution Status */}
      {rule.lastRunAt && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <span>
            {isAr
              ? rule.lastRunSummaryAr || 'تم تنفيذ القاعدة بنجاح.'
              : rule.lastRunSummaryEn || 'Rule executed.'}
          </span>
          <span className="font-mono">
            {isAr ? 'آخر تشغيل:' : 'Last run:'}{' '}
            {new Date(rule.lastRunAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
          </span>
        </div>
      )}
    </div>
  );
};
