import React, { useState, useEffect, useMemo } from 'react';
import {
  BookItem,
  EducationalStage,
  FormLookupsConfig,
  SchoolEntity,
  TransactionSubType,
  TransactionType,
  UserAccount,
} from '../types/inventory';
import {
  X,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  CheckSquare,
  Square,
  FileText,
} from 'lucide-react';

interface BulkAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookItem[];
  schools: SchoolEntity[];
  formConfig: FormLookupsConfig;
  currentUser: UserAccount;
  preselectedBookIds?: string[];
  onRecordBatch: (payload: {
    type: TransactionType;
    subType: TransactionSubType;
    academicYear: string;
    referenceNumber: string;
    counterpartyName: string;
    counterpartyNameAr: string;
    schoolId?: string;
    createdBy: string;
    createdByRole: UserAccount['role'];
    notes: string;
    items: { bookId: string; quantity: number }[];
  }) => Promise<void>;
  lang: 'ar' | 'en';
}

export const BulkAdjustmentModal: React.FC<BulkAdjustmentModalProps> = ({
  isOpen,
  onClose,
  books,
  schools,
  formConfig,
  currentUser,
  preselectedBookIds = [],
  onRecordBatch,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [type, setType] = useState<TransactionType>('INBOUND');
  const [subType, setSubType] = useState<TransactionSubType>('PURCHASE_INVOICE');
  const [academicYear, setAcademicYear] = useState<string>(
    formConfig.defaults.defaultAcademicYear || '2026/2027'
  );
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [schoolId, setSchoolId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<'ALL' | EducationalStage>('ALL');
  const [uniformQty, setUniformQty] = useState<number>(formConfig.defaults.defaultBulkQty || 300);

  // Map of selected bookId -> quantity
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setType('INBOUND');
    setSubType('PURCHASE_INVOICE');
    setAcademicYear(formConfig.defaults.defaultAcademicYear || '2026/2027');
    const inPrefix = formConfig.prefixes.bulkInboundPrefix || 'BLK-INV';
    setReferenceNumber(`${inPrefix}-${Math.floor(10000 + Math.random() * 89999)}`);
    if (schools[0]) setSchoolId(schools[0].id);
    const firstSup = formConfig.suppliers[0];
    setSupplierName(
      firstSup
        ? isAr
          ? firstSup.nameAr
          : firstSup.name
        : 'الهيئة العامة لشؤون المطابع الأميرية'
    );
    setUniformQty(formConfig.defaults.defaultBulkQty || 300);
    setNotes('');
    setSearchQuery('');
    setStageFilter('ALL');
    setError(null);

    const defQty = formConfig.defaults.defaultBulkQty || 300;
    const initialMap: Record<string, number> = {};
    if (preselectedBookIds.length > 0) {
      for (const id of preselectedBookIds) {
        initialMap[id] = defQty;
      }
    } else {
      const lowStock = books.filter((b) => b.currentStock <= b.minStockLevel);
      for (const b of lowStock) {
        initialMap[b.id] = defQty;
      }
    }
    setSelectedQuantities(initialMap);
  }, [isOpen, preselectedBookIds, books, schools, formConfig, isAr]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((b) => {
      if (stageFilter !== 'ALL' && b.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.titleAr.toLowerCase().includes(q) ||
        b.barcode.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        b.subjectAr.toLowerCase().includes(q)
      );
    });
  }, [books, searchQuery, stageFilter]);

  if (!isOpen) return null;

  const isOutbound = type === 'OUTBOUND';
  const selectedIds = Object.keys(selectedQuantities);
  const selectedBooksList = books.filter((b) => selectedQuantities[b.id] !== undefined);
  const matchingTemplates = formConfig.noteTemplates.filter((t) => t.type === type);

  const invalidOutboundBooks = isOutbound
    ? selectedBooksList.filter((b) => (selectedQuantities[b.id] || 0) > b.currentStock)
    : [];

  const totalBatchCopies = selectedIds.reduce(
    (sum, id) => sum + Math.max(0, Math.floor(Number(selectedQuantities[id]) || 0)),
    0
  );

  const handleModeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    setSubType(nextType === 'INBOUND' ? 'PURCHASE_INVOICE' : 'SCHOOL_DISTRIBUTION');
    const prefix =
      nextType === 'INBOUND'
        ? formConfig.prefixes.bulkInboundPrefix || 'BLK-INV'
        : formConfig.prefixes.bulkOutboundPrefix || 'BLK-DSP';
    setReferenceNumber(`${prefix}-${Math.floor(10000 + Math.random() * 89999)}`);
    setError(null);
  };

  const toggleBookSelection = (book: BookItem) => {
    setSelectedQuantities((prev) => {
      const next = { ...prev };
      if (next[book.id] !== undefined) {
        delete next[book.id];
      } else {
        next[book.id] = Math.max(1, uniformQty || 200);
      }
      return next;
    });
  };

  const handleQuantityChange = (bookId: string, val: number) => {
    setSelectedQuantities((prev) => ({
      ...prev,
      [bookId]: Math.max(1, Math.floor(Number(val) || 0)),
    }));
  };

  const handleApplyUniformQuantity = () => {
    const validQty = Math.max(1, Math.floor(Number(uniformQty) || 100));
    setSelectedQuantities((prev) => {
      const next: Record<string, number> = {};
      for (const id of Object.keys(prev)) {
        next[id] = validQty;
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedQuantities((prev) => {
      const next = { ...prev };
      for (const b of filteredCatalog) {
        if (next[b.id] === undefined) {
          next[b.id] = Math.max(1, uniformQty || 200);
        }
      }
      return next;
    });
  };

  const handleSelectLowStockOnly = () => {
    const next: Record<string, number> = {};
    for (const b of books) {
      if (b.currentStock <= b.minStockLevel) {
        next[b.id] = Math.max(100, b.minStockLevel - b.currentStock + 200);
      }
    }
    setSelectedQuantities(next);
  };

  const handleClearSelection = () => {
    setSelectedQuantities({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError(
        isAr
          ? 'يرجى تحديد كتاب واحد على الأقل من الجدول لتنفيذ التسوية الجماعية.'
          : 'Please select at least one textbook to perform a bulk stock adjustment.'
      );
      return;
    }

    if (invalidOutboundBooks.length > 0) {
      const firstBad = invalidOutboundBooks[0];
      setError(
        isAr
          ? `عملية مرفوضة: الكمية المطلوبة للكتاب "${firstBad.titleAr}" (${selectedQuantities[firstBad.id].toLocaleString()}) تتجاوز الرصيد المتاح (${firstBad.currentStock.toLocaleString()}).`
          : `Validation Error: Requested quantity for "${firstBad.title}" (${selectedQuantities[firstBad.id].toLocaleString()}) exceeds available stock (${firstBad.currentStock.toLocaleString()}).`
      );
      return;
    }

    const selectedSchool = schools.find((s) => s.id === schoolId);
    const counterpartyName = isOutbound
      ? subType === 'SCHOOL_DISTRIBUTION' && selectedSchool
        ? selectedSchool.name
        : supplierName
      : supplierName;

    const counterpartyNameAr = isOutbound
      ? subType === 'SCHOOL_DISTRIBUTION' && selectedSchool
        ? selectedSchool.nameAr
        : supplierName
      : supplierName;

    const items = selectedIds.map((id) => ({
      bookId: id,
      quantity: Math.max(1, Math.floor(Number(selectedQuantities[id]) || 1)),
    }));

    setSubmitting(true);
    try {
      await onRecordBatch({
        type,
        subType,
        academicYear,
        referenceNumber,
        counterpartyName,
        counterpartyNameAr,
        schoolId: isOutbound && subType === 'SCHOOL_DISTRIBUTION' ? schoolId : undefined,
        createdBy: isAr ? currentUser.fullNameAr : currentUser.fullName,
        createdByRole: currentUser.role,
        notes:
          notes.trim() ||
          (isOutbound
            ? `إذن صرف جماعي لعدد ${items.length} أصناف لصالح ${counterpartyNameAr}`
            : `توريد مخزني جماعي لعدد ${items.length} أصناف من ${counterpartyNameAr}`),
        items,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تنفيذ التسوية المخزنية الجماعية');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#006F88]/10 text-[#006F88] dark:text-cyan-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'التسوية المخزنية الجماعية (توريد أو صرف دفعة كتب متعددة)'
                  : 'Bulk Inventory Adjustment (Batch Inbound / Outbound)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'حدد عدة كتب مدرسية في آن واحد لتنفيذ إذن توريد جماعي أو صرف مجمع للمدارس بحركة ذرية واحدة'
                  : 'Select multiple textbooks simultaneously to execute a batch inbound receipt or school distribution'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Batch Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => handleModeSwitch('INBOUND')}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                !isOutbound
                  ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{isAr ? 'توريد جماعي (+ زيادة أرصدة الكتب المحددة)' : 'Batch Inbound (+ Increase Stock)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('OUTBOUND')}
              className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                isOutbound
                  ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{isAr ? 'صرف وتوزيع جماعي (- خصم من الكتب المحددة)' : 'Batch Outbound (- Decrease Stock)'}</span>
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Batch Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'نوع المستند الجماعي' : 'Batch Document Type'}
              </label>
              {isOutbound ? (
                <select
                  value={subType}
                  onChange={(e) => setSubType(e.target.value as TransactionSubType)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="SCHOOL_DISTRIBUTION">{isAr ? 'توزيع مدرسي مجمع' : 'School Distribution'}</option>
                  <option value="DISPENSING">{isAr ? 'صرف مخزني مباشر' : 'Direct Dispensing'}</option>
                </select>
              ) : (
                <select
                  value={subType}
                  onChange={(e) => setSubType(e.target.value as TransactionSubType)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="PURCHASE_INVOICE">{isAr ? 'فاتورة توريد مطابع' : 'Purchase Invoice'}</option>
                  <option value="MANUAL_ENTRY">{isAr ? 'تسوية جردية يدوية' : 'Manual Adjustment'}</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'رقم المستند المرجعي *' : 'Batch Reference # *'}
              </label>
              <input
                type="text"
                required
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isOutbound && subType === 'SCHOOL_DISTRIBUTION'
                  ? isAr
                    ? 'المدرسة المستلمة *'
                    : 'Receiving School *'
                  : isAr
                  ? 'جهة التوريد / المستلم *'
                  : 'Supplier / Counterparty *'}
              </label>
              {isOutbound && subType === 'SCHOOL_DISTRIBUTION' ? (
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {isAr ? s.nameAr : s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {formConfig.suppliers.map((sup) => {
                    const label = isAr ? sup.nameAr : sup.name;
                    return (
                      <option key={sup.id} value={label}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'العام الدراسي' : 'Academic Year'}
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {formConfig.academicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selection Toolbar & Uniform Quantity Helper */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isAr ? 'تصفية الكتب...' : 'Filter books...'}
                    className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>

                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="ALL">{isAr ? 'كل المراحل' : 'All Stages'}</option>
                  <option value="PRIMARY">{isAr ? 'الابتدائية' : 'Primary'}</option>
                  <option value="PREPARATORY">{isAr ? 'الإعدادية' : 'Preparatory'}</option>
                  <option value="SECONDARY">{isAr ? 'الثانوية' : 'Secondary'}</option>
                </select>

                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  {isAr ? 'تحديد الكل' : 'Select All'}
                </button>

                <button
                  type="button"
                  onClick={handleSelectLowStockOnly}
                  className="px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 cursor-pointer"
                >
                  {isAr ? 'تحديد النواقص فقط' : 'Select Low Stock'}
                </button>

                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    {isAr ? 'إلغاء التحديد' : 'Clear'}
                  </button>
                )}
              </div>

              {/* Uniform Quantity Setter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {isAr ? 'كمية موحدة:' : 'Uniform Qty:'}
                </span>
                <input
                  type="number"
                  min={1}
                  value={uniformQty}
                  onChange={(e) => setUniformQty(Number(e.target.value))}
                  className="w-20 px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <button
                  type="button"
                  onClick={handleApplyUniformQuantity}
                  className="px-3 py-1.5 text-xs font-semibold text-[#006F88] dark:text-cyan-400 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isAr ? 'تطبيق على المحدد' : 'Apply to Selected'}
                </button>
              </div>
            </div>
          </div>

          {/* Multi-Select Books Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3.5 py-2.5 text-start w-10">{isAr ? 'تحديد' : 'Pick'}</th>
                  <th className="px-3.5 py-2.5 text-start">{isAr ? 'الكتاب والباركود' : 'Textbook & Barcode'}</th>
                  <th className="px-3.5 py-2.5 text-end">{isAr ? 'الرصيد الحالي' : 'Current Stock'}</th>
                  <th className="px-3.5 py-2.5 text-center w-36">
                    {isOutbound ? (isAr ? 'كمية الصرف (-)' : 'Dispense Qty (-)') : isAr ? 'كمية التوريد (+)' : 'Inbound Qty (+)'}
                  </th>
                  <th className="px-3.5 py-2.5 text-end">{isAr ? 'الرصيد المتوقع' : 'Projected Stock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredCatalog.map((b) => {
                  const isSelected = selectedQuantities[b.id] !== undefined;
                  const qty = selectedQuantities[b.id] || 0;
                  const projected = isOutbound ? b.currentStock - qty : b.currentStock + qty;
                  const isInvalid = isSelected && isOutbound && qty > b.currentStock;

                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors ${
                        isInvalid
                          ? 'bg-red-50/70 dark:bg-red-950/40'
                          : isSelected
                          ? 'bg-[#006F88]/5 dark:bg-[#006F88]/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3.5 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleBookSelection(b)}
                          className="text-[#006F88] dark:text-cyan-400 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td
                        className="px-3.5 py-2.5 cursor-pointer"
                        onClick={() => toggleBookSelection(b)}
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {isAr ? b.titleAr : b.title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {b.barcode} · {isAr ? b.gradeAr : b.grade}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-end font-mono tabular-nums font-semibold">
                        {b.currentStock.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        {isSelected ? (
                          <input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => handleQuantityChange(b.id, Number(e.target.value))}
                            className={`w-28 px-2.5 py-1 text-center font-mono tabular-nums rounded border bg-white dark:bg-slate-900 ${
                              isInvalid
                                ? 'border-red-500 text-red-600 font-bold'
                                : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100'
                            }`}
                          />
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-end font-mono tabular-nums">
                        {isSelected ? (
                          <span
                            className={`font-bold ${
                              isInvalid
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-[#006F88] dark:text-cyan-400'
                            }`}
                          >
                            {projected.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">{b.currentStock.toLocaleString()}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Batch Summary & Validation Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-4 font-mono tabular-nums">
              <span>
                {isAr ? 'عدد الأصناف المحددة:' : 'Selected Books:'}{' '}
                <strong className="text-slate-900 dark:text-slate-100">{selectedIds.length}</strong>
              </span>
              <span>·</span>
              <span>
                {isAr ? 'إجمالي النسخ في الدفعة:' : 'Total Batch Copies:'}{' '}
                <strong className="text-[#006F88] dark:text-cyan-400">
                  {totalBatchCopies.toLocaleString()}
                </strong>
              </span>
            </div>

            {invalidOutboundBooks.length > 0 ? (
              <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? `يوجد ${invalidOutboundBooks.length} كتاب يتجاوز الرصيد الفعلي المتاح!`
                    : `${invalidOutboundBooks.length} book(s) exceed available physical stock!`}
                </span>
              </div>
            ) : selectedIds.length > 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? 'جميع الأرصدة والكميات المحددة جاهزة للاعتماد الفوري'
                    : 'All batch quantities validated and ready for atomic commit'}
                </span>
              </div>
            ) : null}
          </div>

          {/* Notes + 1-Click Quick Templates */}
          <div className="space-y-1.5">
            {matchingTemplates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {isAr ? 'قوالب ملاحظات سريعة:' : 'Quick Note Templates:'}
                </span>
                {matchingTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setNotes(isAr ? tpl.textAr : tpl.textEn)}
                    className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 hover:bg-[#006F88]/15 hover:text-[#006F88] rounded cursor-pointer"
                  >
                    {isAr ? tpl.titleAr : tpl.titleEn}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isAr
                  ? 'ملاحظات الدفعة الجماعية (اختياري - أو انقر على أحد القوالب السريعة أعلاه)...'
                  : 'Optional batch audit notes (or click a quick template above)...'
              }
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting || selectedIds.length === 0 || invalidOutboundBooks.length > 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              {submitting
                ? isAr
                  ? 'جارٍ تنفيذ الدفعة...'
                  : 'Committing Batch...'
                : isOutbound
                ? isAr
                  ? `اعتماد الصرف الجماعي (${selectedIds.length} كتب)`
                  : `Commit Batch Outbound (${selectedIds.length} Books)`
                : isAr
                ? `اعتماد التوريد الجماعي (${selectedIds.length} كتب)`
                : `Commit Batch Inbound (${selectedIds.length} Books)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
