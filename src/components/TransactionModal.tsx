import React, { useState, useEffect, useRef } from 'react';
import {
  BookItem,
  BookUnitType,
  FormLookupsConfig,
  InventoryTransaction,
  SchoolEntity,
  SupplierEntity,
  TransactionSubType,
  TransactionType,
  UserAccount,
} from '../types/inventory';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Check,
  FileText,
  PenTool,
  Eraser,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { ContactPickerModal, PickedContactInfo, usePWA } from '../hooks/usePWA';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType: TransactionType;
  preselectedBookId?: string;
  books: BookItem[];
  schools: SchoolEntity[];
  formConfig: FormLookupsConfig;
  currentUser: UserAccount;
  onUpdateFormConfig: (nextConfig: FormLookupsConfig) => Promise<void>;
  onAddSchool: (school: Partial<SchoolEntity> & { nameAr: string }) => Promise<SchoolEntity>;
  onRecord: (payload: {
    type: TransactionType;
    subType: TransactionSubType;
    bookId: string;
    academicYear: string;
    quantity: number;
    referenceNumber: string;
    counterpartyName: string;
    counterpartyNameAr: string;
    schoolId?: string;
    recipientPersonName?: string;
    recipientPhone?: string;
    recipientSignatureDataUrl?: string;
    createdBy: string;
    createdByRole: UserAccount['role'];
    notes: string;
  }) => Promise<InventoryTransaction>;
  lang: 'ar' | 'en';
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialType,
  preselectedBookId,
  books,
  schools,
  formConfig,
  currentUser,
  onUpdateFormConfig,
  onAddSchool,
  onRecord,
  lang,
}) => {
  const isAr = lang === 'ar';
  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';
  const pwa = usePWA();

  const [type, setType] = useState<TransactionType>(initialType);
  const [subType, setSubType] = useState<TransactionSubType>(
    initialType === 'INBOUND' ? 'PURCHASE_INVOICE' : 'SCHOOL_DISTRIBUTION'
  );
  const [bookId, setBookId] = useState<string>('');
  const [academicYear, setAcademicYear] = useState<string>(
    formConfig.defaults.defaultAcademicYear || '2026/2027'
  );
  const [quantity, setQuantity] = useState<number>(250);
  const [inputUnitType, setInputUnitType] = useState<BookUnitType>('Unit');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [schoolId, setSchoolId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [recipientPersonName, setRecipientPersonName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Touch Signature Pad States
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Inline Quick-Add states for Admin
  const [quickAddEntityOpen, setQuickAddEntityOpen] = useState(false);
  const [newEntityNameAr, setNewEntityNameAr] = useState('');
  const [newEntityDistrictAr, setNewEntityDistrictAr] = useState('إدارة وسط التعليمية');

  const computeAutoReference = (tType: TransactionType, sType: TransactionSubType) => {
    const p = formConfig.prefixes;
    let prefix = p.inboundInvoicePrefix || 'INV-GOV';
    if (tType === 'INBOUND') {
      prefix =
        sType === 'MANUAL_ENTRY'
          ? p.manualAdjustPrefix || 'MAN-ADJ'
          : p.inboundInvoicePrefix || 'INV-GOV';
    } else {
      prefix =
        sType === 'SCHOOL_DISTRIBUTION'
          ? p.outboundSchoolPrefix || 'DSP-SCH'
          : p.outboundDirectPrefix || 'DSP-DIR';
    }
    return `${prefix}-${Math.floor(10000 + Math.random() * 89999)}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    const defaultSub = initialType === 'INBOUND' ? 'PURCHASE_INVOICE' : 'SCHOOL_DISTRIBUTION';
    setType(initialType);
    setSubType(defaultSub);
    const defaultBook = books.find((b) => b.id === preselectedBookId) || books[0];
    if (defaultBook) {
      setBookId(defaultBook.id);
      setAcademicYear(defaultBook.academicYear || formConfig.defaults.defaultAcademicYear);
      setInputUnitType('Unit');
    } else {
      setAcademicYear(formConfig.defaults.defaultAcademicYear || '2026/2027');
      setInputUnitType('Unit');
    }
    if (schools[0]) {
      setSchoolId(schools[0].id);
      setRecipientPersonName(schools[0].recipientName || '');
      setRecipientPhone(schools[0].phone || '');
    }
    const firstSupplier = formConfig.suppliers[0];
    setSupplierName(
      firstSupplier
        ? isAr
          ? firstSupplier.nameAr
          : firstSupplier.name
        : 'الهيئة العامة لشؤون المطابع الأميرية'
    );
    setReferenceNumber(computeAutoReference(initialType, defaultSub));
    setQuantity(
      initialType === 'INBOUND'
        ? formConfig.defaults.defaultInboundQty || 500
        : formConfig.defaults.defaultOutboundQty || 150
    );
    setNotes('');
    setQuickAddEntityOpen(false);
    setHasSignature(false);
    setError(null);
    setTimeout(() => clearSignatureCanvas(), 50);
  }, [isOpen, initialType, preselectedBookId, books, schools, formConfig, isAr]);

  const clearSignatureCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getPointerPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return {
        x: ((t.clientX - rect.left) * canvas.width) / rect.width,
        y: ((t.clientY - rect.top) * canvas.height) / rect.height,
      };
    }
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const startDrawSig = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.strokeStyle = '#006F88';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawingSig(true);
    setHasSignature(true);
  };

  const moveDrawSig = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDrawSig = () => {
    setIsDrawingSig(false);
  };

  const applyQuickStampSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#006F88';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 12, canvas.width - 28, canvas.height - 24);
    ctx.fillStyle = '#006F88';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      recipientPersonName || (isAr ? 'توقيع مستلم معتمد' : 'Verified Recipient Signature'),
      canvas.width / 2,
      42
    );
    ctx.font = '11px monospace';
    ctx.fillText(
      `${referenceNumber} · ${new Date().toLocaleDateString('en-GB')}`,
      canvas.width / 2,
      66
    );
    setHasSignature(true);
  };

  const handleImportRecipientFromContacts = async () => {
    const nativePicked = await pwa.pickNativeContact();
    if (nativePicked) {
      applyRecipientContact(nativePicked);
    } else {
      setContactModalOpen(true);
    }
  };

  const applyRecipientContact = (c: PickedContactInfo) => {
    setRecipientPersonName(c.name);
    setRecipientPhone(c.phone);
  };

  if (!isOpen) return null;

  const selectedBook = books.find((b) => b.id === bookId);
  const selectedSchool = schools.find((s) => s.id === schoolId);

  const stockBefore = selectedBook ? selectedBook.currentStock : 0;
  const isOutbound = type === 'OUTBOUND';
  const unitMultiplier = inputUnitType === 'Dozen' ? 12 : inputUnitType === 'Bundle' ? 25 : 1;
  const rawEnteredCount = Math.max(0, Math.floor(Number(quantity) || 0));
  const numericQty = rawEnteredCount * unitMultiplier;
  const projectedStock = isOutbound ? stockBefore - numericQty : stockBefore + numericQty;
  const exceedsStock = isOutbound && numericQty > stockBefore;
  const dropsBelowMin =
    !exceedsStock && selectedBook && projectedStock <= selectedBook.minStockLevel;
  const usesSchoolSelector =
    (isOutbound && subType === 'SCHOOL_DISTRIBUTION') ||
    (!isOutbound && subType === 'SCHOOL_RETURN');
  const exceedsSchoolQuota =
    isOutbound &&
    subType === 'SCHOOL_DISTRIBUTION' &&
    selectedSchool &&
    selectedSchool.studentCount > 0 &&
    numericQty > selectedSchool.studentCount;

  const matchingNoteTemplates = formConfig.noteTemplates.filter((tpl) => tpl.type === type);

  const handleTypeSwitch = (nextType: TransactionType) => {
    const nextSub = nextType === 'INBOUND' ? 'PURCHASE_INVOICE' : 'SCHOOL_DISTRIBUTION';
    setType(nextType);
    setSubType(nextSub);
    setReferenceNumber(computeAutoReference(nextType, nextSub));
    setQuantity(
      nextType === 'INBOUND'
        ? formConfig.defaults.defaultInboundQty || 500
        : formConfig.defaults.defaultOutboundQty || 150
    );
    setQuickAddEntityOpen(false);
    setError(null);
  };

  const handleSubTypeChange = (nextSub: TransactionSubType) => {
    setSubType(nextSub);
    setReferenceNumber(computeAutoReference(type, nextSub));
  };

  const handleQuickAddEntity = async () => {
    const clean = newEntityNameAr.trim();
    if (!clean) return;

    if (isOutbound && subType === 'SCHOOL_DISTRIBUTION') {
      const createdSchool = await onAddSchool({
        nameAr: clean,
        name: clean,
        districtAr: newEntityDistrictAr.trim() || 'الإدارة التعليمية',
        district: newEntityDistrictAr.trim() || 'Educational Directorate',
        stage: selectedBook?.stage || 'PRIMARY',
        recipientName: recipientPersonName || 'أمين التوريدات المدرسية',
        phone: recipientPhone || '0100-000-0000',
      });
      setSchoolId(createdSchool.id);
    } else {
      const newSup: SupplierEntity = {
        id: `sup-${Date.now()}`,
        code: `PRS-${Math.floor(10 + Math.random() * 89)}`,
        nameAr: clean,
        name: clean,
        type: 'PRINTING_PRESS',
      };
      await onUpdateFormConfig({
        ...formConfig,
        suppliers: [...formConfig.suppliers, newSup],
      });
      setSupplierName(clean);
    }
    setNewEntityNameAr('');
    setQuickAddEntityOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedBook) {
      setError(isAr ? 'يرجى اختيار الكتاب المدرسي.' : 'Please select a textbook.');
      return;
    }

    if (numericQty <= 0) {
      setError(
        isAr ? 'يرجى إدخال كمية صحيحة أكبر من الصفر.' : 'Quantity must be greater than zero.'
      );
      return;
    }

    if (exceedsStock) {
      setError(
        isAr
          ? `عملية مرفوضة: الكمية المطلوب صرفها (${numericQty.toLocaleString()}) تتجاوز الرصيد الفعلي المتاح بالمخزن (${stockBefore.toLocaleString()}). لا يُسمح بالرصيد السالب.`
          : `Validation Error: Requested outbound quantity (${numericQty.toLocaleString()}) exceeds available stock (${stockBefore.toLocaleString()}).`
      );
      return;
    }

    const counterpartyName =
      usesSchoolSelector && selectedSchool ? selectedSchool.name : supplierName;

    const counterpartyNameAr =
      usesSchoolSelector && selectedSchool ? selectedSchool.nameAr : supplierName;

    const sigDataUrl =
      hasSignature && sigCanvasRef.current
        ? sigCanvasRef.current.toDataURL('image/png')
        : undefined;

    const unitNoteSuffix =
      unitMultiplier > 1
        ? isAr
          ? ` [${rawEnteredCount} ${inputUnitType === 'Dozen' ? 'درزن ×12' : 'شدة ×25'} = ${numericQty} نسخة]`
          : ` [${rawEnteredCount} ${inputUnitType}s ×${unitMultiplier} = ${numericQty} copies]`
        : '';

    setSubmitting(true);
    try {
      await onRecord({
        type,
        subType,
        bookId: selectedBook.id,
        academicYear,
        quantity: numericQty,
        referenceNumber,
        counterpartyName,
        counterpartyNameAr,
        schoolId: usesSchoolSelector ? schoolId : undefined,
        recipientPersonName: recipientPersonName.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        recipientSignatureDataUrl: sigDataUrl,
        createdBy: isAr ? currentUser.fullNameAr : currentUser.fullName,
        createdByRole: currentUser.role,
        notes:
          (notes.trim() ||
            (isOutbound
              ? `صرف مخزني معتمد لصالح ${counterpartyNameAr}${
                  recipientPersonName ? ` — المستلم: ${recipientPersonName}` : ''
                }`
              : `توريد مخزني وإضافة للرصيد من ${counterpartyNameAr}`)) + unitNoteSuffix,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الحركة المخزنية');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isOutbound
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {isOutbound ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : (
                <ArrowDownLeft className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                {isOutbound
                  ? isAr
                    ? 'تسجيل إذن صرف وتوزيع مدرسي (مع التوقيع الإلكتروني)'
                    : 'Record Outbound School Distribution (with Touch Signature)'
                  : isAr
                  ? 'تسجيل إذن توريد وإضافة مخزنية (Inbound)'
                  : 'Record Inbound Stock Receipt'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'يدعم استيراد بيانات المندوب من جهات اتصال الهاتف والتوقيع الحي باللمس'
                  : 'Supports PWA Contact Picker and touch digital signature for recipient verification'}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleTypeSwitch('INBOUND')}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                !isOutbound
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isAr ? 'توريد مخزني (+ زيادة الرصيد)' : 'Inbound (+ Stock)'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('OUTBOUND')}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                isOutbound
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isAr ? 'صرف وتوزيع مدرسي (- خصم الرصيد)' : 'Outbound (- Stock)'}
              </span>
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* SubType & Reference Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'نوع المستند المخزني' : 'Transaction Sub-Type'}
              </label>
              {isOutbound ? (
                <select
                  value={subType}
                  onChange={(e) => handleSubTypeChange(e.target.value as TransactionSubType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="SCHOOL_DISTRIBUTION">
                    {isAr ? 'توزيع مدرسي رسمي (School Distribution)' : 'School Distribution'}
                  </option>
                  <option value="DISPENSING">
                    {isAr ? 'صرف مخزني مباشر (Direct Dispensing)' : 'Direct Dispensing'}
                  </option>
                  <option value="SUPPLIER_RETURN">
                    {isAr ? 'مرتجع كتب معيبة للمطبعة (Return to Supplier)' : 'Return to Supplier'}
                  </option>
                  <option value="WAREHOUSE_TRANSFER">
                    {isAr ? 'تحويل مخزني صادر لمستودع فرعي (Outbound Transfer)' : 'Outbound Warehouse Transfer'}
                  </option>
                </select>
              ) : (
                <select
                  value={subType}
                  onChange={(e) => handleSubTypeChange(e.target.value as TransactionSubType)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="PURCHASE_INVOICE">
                    {isAr ? 'فاتورة مشتريات / مطابع (Purchase Invoice)' : 'Purchase Invoice'}
                  </option>
                  <option value="SCHOOL_RETURN">
                    {isAr ? 'مرتجع فائض كتب من مدرسة (School Surplus Return)' : 'School Surplus Return'}
                  </option>
                  <option value="WAREHOUSE_TRANSFER">
                    {isAr ? 'تحويل مخزني وارد من مستودع آخر (Inbound Transfer)' : 'Inbound Warehouse Transfer'}
                  </option>
                  <option value="MANUAL_ENTRY">
                    {isAr ? 'إضافة مخزنية يدوية / تسوية (Manual Entry)' : 'Manual Entry'}
                  </option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'رقم الفاتورة / إذن الصرف (مؤتمت) *' : 'Auto-Numbered Reference *'}
              </label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Book Selector & Configured Academic Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'الكتاب المدرسي *' : 'Select Textbook *'}
              </label>
              <select
                value={bookId}
                onChange={(e) => {
                  setBookId(e.target.value);
                  const bk = books.find((b) => b.id === e.target.value);
                  if (bk) setAcademicYear(bk.academicYear);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.titleAr : b.title} ({b.barcode}) — {isAr ? 'الرصيد:' : 'Stock:'}{' '}
                    {b.currentStock.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isAr ? 'العام الدراسي' : 'Academic Year'}
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {formConfig.academicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Counterparty: School or Supplier Dropdown + Quantity with Unit Multiplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {usesSchoolSelector ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {subType === 'SCHOOL_RETURN'
                      ? isAr
                        ? 'المدرسة المُرجعة للفائض *'
                        : 'Returning School *'
                      : isAr
                      ? 'المدرسة المستلمة *'
                      : 'Receiving School *'}
                  </label>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setQuickAddEntityOpen(!quickAddEntityOpen)}
                      className="text-[11px] font-semibold text-[#006F88] dark:text-cyan-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isAr ? 'مدرسة جديدة' : 'Quick Add School'}</span>
                    </button>
                  )}
                </div>
                <select
                  value={schoolId}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    const sch = schools.find((s) => s.id === e.target.value);
                    if (sch) {
                      setRecipientPersonName(sch.recipientName || '');
                      setRecipientPhone(sch.phone || '');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {isAr ? s.nameAr : s.name} ({s.code}) — {isAr ? `${s.studentCount} طالب` : `${s.studentCount} students`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {subType === 'WAREHOUSE_TRANSFER'
                      ? isAr
                        ? 'المستودع الفرعي / المساحة المخزنية المقابلة *'
                        : 'Counterpart Warehouse *'
                      : isOutbound
                      ? isAr
                        ? 'الجهة المستلمة / المطبعة المرتجع إليها *'
                        : 'Recipient Entity / Press *'
                      : isAr
                      ? 'جهة التوريد / المطبعة المعتمدة *'
                      : 'Approved Supplier / Press *'}
                  </label>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setQuickAddEntityOpen(!quickAddEntityOpen)}
                      className="text-[11px] font-semibold text-[#006F88] dark:text-cyan-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isAr ? 'إضافة جهة جديدة' : 'Quick Add'}</span>
                    </button>
                  )}
                </div>
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {formConfig.suppliers.map((sup) => {
                    const label = isAr ? sup.nameAr : sup.name;
                    return (
                      <option key={sup.id} value={label}>
                        {label} ({sup.code})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isAr ? 'الكمية ووحدة التعبئة *' : 'Quantity & Package Unit *'}
                </label>
                {unitMultiplier > 1 && (
                  <span className="text-[11px] font-mono font-bold text-[#006F88] dark:text-cyan-400">
                    = {numericQty.toLocaleString()} {isAr ? 'نسخة مفردة' : 'copies'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={`flex-1 min-w-0 px-3 py-2 text-sm font-mono tabular-nums rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${
                    exceedsStock
                      ? 'border-red-500'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
                <select
                  value={inputUnitType}
                  onChange={(e) => setInputUnitType(e.target.value as BookUnitType)}
                  className="px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 shrink-0"
                  title={isAr ? 'وحدة إدخال الكمية ومعامل التحويل' : 'Quantity Unit Multiplier'}
                >
                  <option value="Unit">{isAr ? 'كتاب (×1)' : 'Unit (×1)'}</option>
                  <option value="Dozen">{isAr ? 'درزن (×12)' : 'Dozen (×12)'}</option>
                  <option value="Bundle">{isAr ? 'شدة (×25)' : 'Bundle (×25)'}</option>
                </select>
              </div>
            </div>
          </div>

          {/* School Student Quota Validation Banner */}
          {exceedsSchoolQuota && selectedSchool && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-bold">
                  {isAr
                    ? 'تنبيه تجاوز المخصص المدرسي (Quota Alert): '
                    : 'School Quota Exceeded Warning: '}
                </span>
                <span>
                  {isAr
                    ? `الكمية المطلوب صرفها (${numericQty.toLocaleString()} نسخة) تتجاوز إجمالي عدد طلاب "${selectedSchool.nameAr}" المسجل (${selectedSchool.studentCount.toLocaleString()} طالب) بفارق ${(numericQty - selectedSchool.studentCount).toLocaleString()} نسخة إضافية.`
                    : `Dispensed quantity (${numericQty.toLocaleString()} copies) exceeds "${selectedSchool.name}" student count (${selectedSchool.studentCount.toLocaleString()} students) by ${(numericQty - selectedSchool.studentCount).toLocaleString()} copies.`}
                </span>
              </div>
            </div>
          )}

          {/* Inline Quick-Add School or Supplier Box for Admin */}
          {isAdmin && quickAddEntityOpen && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={newEntityNameAr}
                onChange={(e) => setNewEntityNameAr(e.target.value)}
                placeholder={isAr ? 'اسم المدرسة أو الجهة الجديدة' : 'New School / Supplier Name'}
                className="flex-1 w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={handleQuickAddEntity}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isAr ? 'حفظ واختيار' : 'Save & Select'}</span>
              </button>
            </div>
          )}

          {/* Recipient Contact Info + PWA Contact Picker + Touch Digital Signature Pad */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-[#006F88]" />
                <span>
                  {isAr
                    ? 'بيانات المندوب المستلم والتوقيع الإلكتروني باللمس'
                    : 'Recipient Representative & Digital Touch Signature'}
                </span>
              </span>

              <button
                type="button"
                onClick={handleImportRecipientFromContacts}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{isAr ? 'استيراد من جهات اتصال الهاتف' : 'Import from Contacts'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'اسم مندوب الاستلام / التسليم' : 'Representative Name'}
                </label>
                <input
                  type="text"
                  value={recipientPersonName}
                  onChange={(e) => setRecipientPersonName(e.target.value)}
                  placeholder={isAr ? 'مثال: أ. خالد إبراهيم' : 'e.g. Khaled Ibrahim'}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                  {isAr ? 'رقم هاتف المندوب' : 'Representative Phone'}
                </label>
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="0100-000-0000"
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Interactive Touch & Mouse Signature Canvas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  {isAr
                    ? 'وقّع بإصبعك على شاشة الجوال/التابلت أو بالماوس لاعتماد السند:'
                    : 'Sign below using touch or mouse to certify receipt:'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyQuickStampSignature}
                    className="text-[#006F88] dark:text-cyan-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isAr ? 'ختم وتوقيع إلكتروني سريع' : 'Quick Stamp'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearSignatureCanvas}
                    className="text-slate-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>{isAr ? 'مسح' : 'Clear'}</span>
                  </button>
                </div>
              </div>

              <canvas
                ref={sigCanvasRef}
                width={460}
                height={84}
                onMouseDown={startDrawSig}
                onMouseMove={moveDrawSig}
                onMouseUp={endDrawSig}
                onMouseLeave={endDrawSig}
                onTouchStart={startDrawSig}
                onTouchMove={moveDrawSig}
                onTouchEnd={endDrawSig}
                className="w-full h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white cursor-crosshair touch-none"
              />
            </div>
          </div>

          {/* Live Stock Impact Preview */}
          {selectedBook && (
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                exceedsStock
                  ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900'
                  : dropsBelowMin
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    {isAr ? 'الرصيد المتاح' : 'Current Stock'}
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-0.5 block">
                    {stockBefore.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    {isOutbound ? (isAr ? 'المنصرف (-)' : 'Dispensed (-)') : isAr ? 'المورد (+)' : 'Received (+)'}
                  </span>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 block ${
                      isOutbound ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isOutbound ? `-${numericQty.toLocaleString()}` : `+${numericQty.toLocaleString()}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                    {isAr ? 'الرصيد بعد الحركة' : 'Projected Stock'}
                  </span>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 block ${
                      exceedsStock ? 'text-red-600 dark:text-red-400' : 'text-[#006F88] dark:text-cyan-400'
                    }`}
                  >
                    {projectedStock.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes + 1-Click Quick Note Templates */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {isAr ? 'ملاحظات الحركة / محضر الاستلام' : 'Audit Notes / Delivery Remarks'}
              </label>
              {matchingNoteTemplates.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {isAr ? 'قوالب:' : 'Templates:'}
                  </span>
                  {matchingNoteTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setNotes(isAr ? tpl.textAr : tpl.textEn)}
                      className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-[#006F88]/15 hover:text-[#006F88] rounded transition-colors cursor-pointer"
                    >
                      {isAr ? tpl.titleAr : tpl.titleEn}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting || exceedsStock}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg cursor-pointer"
            >
              {submitting
                ? isAr
                  ? 'جارٍ الحفظ...'
                  : 'Saving...'
                : isOutbound
                ? isAr
                  ? 'اعتماد إذن الصرف والتوقيع'
                  : 'Confirm Outbound & Signature'
                : isAr
                ? 'اعتماد التوريد وإضافة الرصيد'
                : 'Confirm Inbound'}
            </button>
          </div>
        </form>
      </div>

      <ContactPickerModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        onSelectContact={applyRecipientContact}
        lang={lang}
      />
    </div>
  );
};
