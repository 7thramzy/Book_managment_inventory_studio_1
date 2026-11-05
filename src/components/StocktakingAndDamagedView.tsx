import React, { useState } from 'react';
import {
  BookItem,
  DamagedBookRecord,
  DamageReasonType,
  StocktakingLineItem,
  StocktakingSession,
  UserAccount,
  WorkspaceEntity,
} from '../types/inventory';
import {
  ClipboardCheck,
  AlertOctagon,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Share2,
  X,
  Check,
  ScanBarcode,
} from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

interface StocktakingAndDamagedViewProps {
  books: BookItem[];
  workspaces: WorkspaceEntity[];
  activeWorkspaceId: string;
  currentUser: UserAccount;
  stocktakingSessions: StocktakingSession[];
  damagedRecords: DamagedBookRecord[];
  lang: 'ar' | 'en';
  onCreateStocktakingSession: (session: StocktakingSession) => Promise<void>;
  onUpdateStocktakingSession: (session: StocktakingSession) => Promise<void>;
  onReconcileStocktakingSession: (session: StocktakingSession) => Promise<void>;
  onCreateDamagedRecord: (
    record: Omit<DamagedBookRecord, 'id' | 'recordCode' | 'createdAt'>,
    deductFromStock: boolean
  ) => Promise<void>;
  onResolveDamagedRecord: (
    recordId: string,
    nextStatus: 'RESTORED_TO_STOCK' | 'WRITTEN_OFF'
  ) => Promise<void>;
  onOpenScanner?: () => void;
}

export const StocktakingAndDamagedView: React.FC<StocktakingAndDamagedViewProps> = ({
  books,
  workspaces,
  activeWorkspaceId,
  currentUser,
  stocktakingSessions,
  damagedRecords,
  lang,
  onCreateStocktakingSession,
  onUpdateStocktakingSession,
  onReconcileStocktakingSession,
  onCreateDamagedRecord,
  onResolveDamagedRecord,
  onOpenScanner,
}) => {
  const isAr = lang === 'ar';
  const pwa = usePWA();
  const canEdit =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'STOREKEEPER';

  const [subTab, setSubTab] = useState<'STOCKTAKING' | 'DAMAGED'>('STOCKTAKING');
  const [activeSessionId, setActiveSessionId] = useState<string>(
    stocktakingSessions[0]?.id || ''
  );

  // Damaged Book Modal State
  const [dmgModalOpen, setDmgModalOpen] = useState(false);
  const [dmgBookId, setDmgBookId] = useState(books[0]?.id || '');
  const [dmgQuantity, setDmgQuantity] = useState(10);
  const [dmgReason, setDmgReason] = useState<DamageReasonType>('TRANSPORT_DAMAGE');
  const [dmgSourceAr, setDmgSourceAr] = useState('لجنة الفحص والاستلام بالمخزن');
  const [dmgNotes, setDmgNotes] = useState('');
  const [dmgDeductStock, setDmgDeductStock] = useState(true);

  const activeSession =
    stocktakingSessions.find((s) => s.id === activeSessionId) || stocktakingSessions[0];

  const handleStartNewSession = async () => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
    const lines: StocktakingLineItem[] = books.map((b) => ({
      bookId: b.id,
      bookTitleAr: b.titleAr,
      bookTitleEn: b.title,
      bookBarcode: b.barcode,
      systemStock: b.currentStock,
      countedStock: b.currentStock,
      difference: 0,
      note: 'مطابق للرصيد الدفتري',
    }));

    const newSess: StocktakingSession = {
      id: `stk-sess-${Date.now()}`,
      sessionCode: `JRD-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
      titleAr: `لجنة الجرد الفعلي والمطابقة — ${ws ? ws.nameAr : 'المخزن المركزي'}`,
      titleEn: `Physical Stocktaking Session — ${ws ? ws.name : 'Central Hub'}`,
      workspaceId: ws?.id || 'ws-central-01',
      status: 'IN_PROGRESS',
      createdBy: isAr ? currentUser.fullNameAr : currentUser.fullName,
      createdAt: new Date().toISOString(),
      reconciledAt: null,
      lines,
    };

    await onCreateStocktakingSession(newSess);
    setActiveSessionId(newSess.id);
  };

  const handleUpdateCountedStock = async (
    bookId: string,
    countedVal: number,
    customNote?: string
  ) => {
    if (!activeSession || activeSession.status === 'RECONCILED') return;
    const clamped = Math.max(0, Math.floor(Number(countedVal) || 0));
    const nextLines = activeSession.lines.map((line) => {
      if (line.bookId !== bookId) return line;
      const diff = clamped - line.systemStock;
      const autoNote =
        customNote !== undefined
          ? customNote
          : diff === 0
          ? 'مطابق تماماً للرصيد الدفتري'
          : diff < 0
          ? `عجز فعلي بمقدار ${Math.abs(diff)} نسخة`
          : `زيادة فعلية بمقدار +${diff} نسخة`;
      return {
        ...line,
        countedStock: clamped,
        difference: diff,
        note: autoNote,
      };
    });

    await onUpdateStocktakingSession({
      ...activeSession,
      lines: nextLines,
    });
  };

  const handleCreateDamagedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bk = books.find((b) => b.id === dmgBookId) || books[0];
    if (!bk || dmgQuantity <= 0) return;

    await onCreateDamagedRecord(
      {
        bookId: bk.id,
        bookTitleAr: bk.titleAr,
        bookTitleEn: bk.title,
        bookBarcode: bk.barcode,
        quantity: Math.max(1, Math.floor(Number(dmgQuantity))),
        reason: dmgReason,
        sourceEntityAr: dmgSourceAr.trim() || 'فحص المخزن',
        status: 'QUARANTINED',
        reportedBy: isAr ? currentUser.fullNameAr : currentUser.fullName,
        notes:
          dmgNotes.trim() ||
          `تم عزل ${dmgQuantity} نسخة في مخزن التوالف والمرتجعات للفحص الفني.`,
      },
      dmgDeductStock
    );
    setDmgModalOpen(false);
    setDmgNotes('');
  };

  const getReasonLabel = (r: DamageReasonType) => {
    switch (r) {
      case 'PRINTING_DEFECT':
        return isAr ? 'عيوب طباعة وتجليد' : 'Printing Defect';
      case 'TRANSPORT_DAMAGE':
        return isAr ? 'تلف نقل وشحن' : 'Transport Damage';
      case 'SCHOOL_SURPLUS_RETURN':
        return isAr ? 'فائض مرتجع من مدرسة' : 'School Surplus Return';
      case 'STORAGE_WEAR':
        return isAr ? 'تلف تخزين / رطوبة' : 'Storage Wear';
    }
  };

  const quarantinedTotalCopies = damagedRecords
    .filter((d) => d.status === 'QUARANTINED')
    .reduce((acc, d) => acc + d.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isAr
              ? 'لجان الجرد الفعلي ومطابقة العجز والزيادة + عزل الكتب التالفة والمرتجعة'
              : 'Physical Stocktaking Reconciliation & Damaged Books Quarantine'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAr
              ? 'مطابقة الأرصدة الدفترية بالعدّ الفعلي بالمخزن، وتسجيل الكتب التالفة أو المرتجعة من المدارس وعزلها عن التوزيع'
              : 'Reconcile physical inventory counts against system stock and quarantine damaged or returned copies'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3 py-2 text-xs font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4" />
              <span>{isAr ? 'مسح باركود للجرد' : 'Scan Barcode'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleStartNewSession}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'بدء محضر جرد فعلي جديد' : 'New Stocktaking Session'}</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => setDmgModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 hover:bg-amber-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{isAr ? 'تسجيل كتب تالفة / مرتجعة' : 'Log Damaged / Returned'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setSubTab('STOCKTAKING')}
          className={`py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'STOCKTAKING'
              ? 'bg-[#006F88] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>
            {isAr
              ? `لجان الجرد الفعلي والمطابقة (${stocktakingSessions.length})`
              : `Physical Stocktaking (${stocktakingSessions.length})`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('DAMAGED')}
          className={`py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            subTab === 'DAMAGED'
              ? 'bg-[#006F88] text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          <span>
            {isAr
              ? `سجل التوالف والمرتجعات المعزولة (${quarantinedTotalCopies} نسخة)`
              : `Damaged & Returns Quarantine (${quarantinedTotalCopies})`}
          </span>
        </button>
      </div>

      {/* TAB 1: PHYSICAL STOCKTAKING & RECONCILIATION */}
      {subTab === 'STOCKTAKING' && activeSession && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={activeSession.id}
                  onChange={(e) => setActiveSessionId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {stocktakingSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sessionCode} — {isAr ? s.titleAr : s.titleEn}
                    </option>
                  ))}
                </select>

                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${
                    activeSession.status === 'RECONCILED'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {activeSession.status === 'RECONCILED'
                    ? isAr
                      ? 'تم اعتماد المطابقة وتسوية الأرصدة'
                      : 'Reconciled & Applied'
                    : isAr
                    ? 'قيد الجرد والعدّ الفعلي'
                    : 'In Progress'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isAr ? 'رئيس لجنة الجرد:' : 'Audit Lead:'} {activeSession.createdBy} ·{' '}
                {new Date(activeSession.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  pwa.shareContent({
                    title: activeSession.titleAr,
                    text: `محضر جرد رقم ${activeSession.sessionCode} — الحالة: ${activeSession.status}`,
                  })
                }
                className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-[#006F88]" />
                <span>{isAr ? 'مشاركة المحضر' : 'Share'}</span>
              </button>

              {activeSession.status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  onClick={() => onReconcileStocktakingSession(activeSession)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isAr
                      ? 'اعتماد الجرد وتحديث أرصدة المخزن تلقائياً'
                      : 'Approve & Reconcile Stock'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="px-4 py-3 text-start">{isAr ? 'الكتاب والباركود' : 'Textbook & Barcode'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'الرصيد الدفتري' : 'System Stock'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'العدّ الفعلي بالمخزن' : 'Physical Count'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'الفرق (عجز / زيادة)' : 'Variance'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'ملاحظات لجنة الجرد' : 'Audit Note'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeSession.lines.map((line) => {
                  const isEditable = activeSession.status === 'IN_PROGRESS';
                  return (
                    <tr key={line.bookId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {isAr ? line.bookTitleAr : line.bookTitleEn}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{line.bookBarcode}</div>
                      </td>
                      <td className="px-4 py-3 text-end font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                        {line.systemStock.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {isEditable ? (
                          <input
                            type="number"
                            min={0}
                            value={line.countedStock}
                            onChange={(e) =>
                              handleUpdateCountedStock(line.bookId, Number(e.target.value))
                            }
                            className="w-24 px-2.5 py-1.5 text-end font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-[#006F88]"
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                            {line.countedStock.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-mono tabular-nums font-bold">
                        <span
                          className={
                            line.difference === 0
                              ? 'text-slate-500'
                              : line.difference > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {line.difference === 0
                            ? '0 (مطابق)'
                            : line.difference > 0
                            ? `+${line.difference} (زيادة)`
                            : `${line.difference} (عجز)`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isEditable ? (
                          <input
                            type="text"
                            value={line.note || ''}
                            onChange={(e) =>
                              handleUpdateCountedStock(
                                line.bookId,
                                line.countedStock,
                                e.target.value
                              )
                            }
                            className="w-full min-w-[180px] px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                          />
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400">{line.note}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DAMAGED & RETURNED BOOKS QUARANTINE REGISTRY */}
      {subTab === 'DAMAGED' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="px-4 py-3 text-start">{isAr ? 'رقم المحضر والتاريخ' : 'Record Code'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الكتاب والباركود' : 'Textbook'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'الكمية المعزولة' : 'Qty'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'سبب التلف / المرتجع والجهة' : 'Reason & Source'}</th>
                  <th className="px-4 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 text-end">{isAr ? 'إجراء لجنة الفحص' : 'Resolution'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {damagedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {rec.recordCode}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(rec.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {isAr ? rec.bookTitleAr : rec.bookTitleEn}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">{rec.bookBarcode}</div>
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                      {rec.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {getReasonLabel(rec.reason)} · {rec.sourceEntityAr}
                      </div>
                      <div className="text-[11px] text-slate-500">{rec.notes}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {rec.status === 'QUARANTINED' ? (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          {isAr ? 'معزول بالفحص' : 'Quarantined'}
                        </span>
                      ) : rec.status === 'RESTORED_TO_STOCK' ? (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          {isAr ? 'أُعيد للرصيد الصالح' : 'Restored to Stock'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                          {isAr ? 'مستبعد / تالف نهائي' : 'Written Off'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      {rec.status === 'QUARANTINED' && canEdit ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onResolveDamagedRecord(rec.id, 'RESTORED_TO_STOCK')}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{isAr ? 'إعادة للرصيد الصالح' : 'Restore'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onResolveDamagedRecord(rec.id, 'WRITTEN_OFF')}
                            className="px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{isAr ? 'استبعاد نهائي' : 'Write Off'}</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {isAr ? 'تم البتّ' : 'Resolved'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: LOG NEW DAMAGED / RETURNED BOOK RECORD */}
      {dmgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'تسجيل محضر كتب تالفة أو مرتجعة وعزلها'
                  : 'Log Damaged or Returned Textbooks'}
              </h3>
              <button
                type="button"
                onClick={() => setDmgModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDamagedSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">{isAr ? 'الكتاب المدرسي *' : 'Textbook *'}</label>
                <select
                  value={dmgBookId}
                  onChange={(e) => setDmgBookId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.titleAr : b.title} ({b.barcode}) — {isAr ? 'الرصيد:' : 'Stock:'}{' '}
                      {b.currentStock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'عدد النسخ *' : 'Quantity *'}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={dmgQuantity}
                    onChange={(e) => setDmgQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">{isAr ? 'سبب العزل / الإرجاع' : 'Reason'}</label>
                  <select
                    value={dmgReason}
                    onChange={(e) => setDmgReason(e.target.value as DamageReasonType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="TRANSPORT_DAMAGE">
                      {isAr ? 'تلف نقل وشحن' : 'Transport Damage'}
                    </option>
                    <option value="PRINTING_DEFECT">
                      {isAr ? 'عيوب طباعة وتجليد' : 'Printing Defect'}
                    </option>
                    <option value="SCHOOL_SURPLUS_RETURN">
                      {isAr ? 'فائض مرتجع من مدرسة' : 'School Surplus Return'}
                    </option>
                    <option value="STORAGE_WEAR">
                      {isAr ? 'تلف تخزين / رطوبة' : 'Storage Wear'}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">{isAr ? 'الجهة الواردة منها / اللجنة' : 'Source Entity'}</label>
                <input
                  type="text"
                  value={dmgSourceAr}
                  onChange={(e) => setDmgSourceAr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dmgDeductStock}
                  onChange={(e) => setDmgDeductStock(e.target.checked)}
                  className="rounded text-[#006F88]"
                />
                <span>
                  {isAr
                    ? 'خصم هذه النسخ فوراً من الرصيد الصالح للتوزيع وعزلها في مخزن التوالف'
                    : 'Deduct copies from usable stock and move to quarantine'}
                </span>
              </label>

              <div>
                <label className="block font-medium mb-1">{isAr ? 'تفاصيل الفحص الفني' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={dmgNotes}
                  onChange={(e) => setDmgNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDmgModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white font-semibold cursor-pointer"
                >
                  {isAr ? 'تسجيل المحضر وعزل النسخ' : 'Save Quarantine Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
