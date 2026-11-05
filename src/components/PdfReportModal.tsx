import React from 'react';
import { BookItem, InventoryTransaction, UserAccount } from '../types/inventory';
import { Printer, Download, X, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: 'CATALOG' | 'TRANSACTIONS' | 'LOW_STOCK';
  books: BookItem[];
  transactions: InventoryTransaction[];
  currentUser: UserAccount;
  lang: 'ar' | 'en';
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  reportType,
  books,
  transactions,
  currentUser,
  lang,
}) => {
  if (!isOpen) return null;

  const isAr = lang === 'ar';
  const lowStockBooks = books.filter((b) => b.currentStock <= b.minStockLevel);
  const displayBooks = reportType === 'LOW_STOCK' ? lowStockBooks : books;
  const totalCopies = displayBooks.reduce((sum, b) => sum + b.currentStock, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPrintableDocument = () => {
    const reportEl = document.getElementById('printable-ministry-report');
    if (!reportEl) return;
    const htmlDoc = `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8" />
  <title>${isAr ? 'تقرير رسمي - مخازن الكتب المدرسية' : 'Official School Textbook Inventory Report'}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 28px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: ${isAr ? 'right' : 'left'}; }
    th { background: #f1f5f9; font-weight: 700; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #006F88; padding-bottom: 14px; margin-bottom: 18px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 36px; text-align: center; }
    .num { font-family: monospace; }
  </style>
</head>
<body>
  ${reportEl.innerHTML}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ministry_inventory_report_${reportType.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Modal Action Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 no-print">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-[#006F88]" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'معاينة وتصدير التقرير الرسمي (PDF / طباعة معتمدة)'
                  : 'Official Warehouse Report Preview & PDF Export'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'جاهز للطباعة المباشرة إلى PDF أو حفظ نسخة رسمية موثقة بتوقيعات المسؤولين'
                  : 'Formatted for direct Save-as-PDF printing or standalone official archive'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isAr ? 'طباعة / حفظ كملف PDF' : 'Print / Save as PDF'}</span>
            </button>
            <button
              onClick={handleDownloadPrintableDocument}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isAr ? 'تنزيل نموذج الطباعة' : 'Download Printable File'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 overflow-y-auto bg-white text-slate-900" id="printable-ministry-report">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-[#006F88]">
            <div>
              <p className="text-xs font-semibold text-[#006F88]">
                {isAr
                  ? 'وزارة التربية والتعليم — الإدارة المركزية لشؤون الكتب والمخازن'
                  : 'Ministry of Education — Central Textbook Warehouse Directorate'}
              </p>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {reportType === 'CATALOG'
                  ? isAr
                    ? 'بيان جرد أرصدة الكتب المدرسية بالمخزن المركزي'
                    : 'Central Warehouse Textbook Stock Audit Report'
                  : reportType === 'LOW_STOCK'
                  ? isAr
                    ? 'تقرير النواقص والأرصدة الحرجة للكتب المدرسية'
                    : 'Critical Low-Stock Alert & Replenishment Report'
                  : isAr
                  ? 'دفتر أستاذ الحركات المخزنية (توريد وصرف المدارس)'
                  : 'Official Inbound & Outbound Inventory Transactions Ledger'}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                {isAr ? 'كود المخزن: WH-CENTRAL-01 · محرك البيانات: Drift SQLite' : 'Warehouse: WH-CENTRAL-01 · Engine: Drift SQLite'}
              </p>
            </div>

            <div className="text-xs text-slate-600 space-y-1 sm:text-end font-mono tabular-nums">
              <div>
                {isAr ? 'تاريخ الإصدار:' : 'Issued:'} {new Date().toLocaleString(isAr ? 'ar-EG' : 'en-US')}
              </div>
              <div>
                {isAr ? 'حرره:' : 'Prepared By:'} {isAr ? currentUser.fullNameAr : currentUser.fullName} ({currentUser.role})
              </div>
              <div>
                {isAr ? 'رقم المرجع:' : 'Report ID:'} RPT-{new Date().getFullYear()}-{String(Date.now()).slice(-5)}
              </div>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-3 gap-4 my-5 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block">
                {isAr ? 'إجمالي الأصناف المشمولة بالتقرير' : 'Total Catalog Titles Included'}
              </span>
              <span className="text-base font-bold text-slate-900 font-mono tabular-nums mt-0.5 block">
                {reportType === 'TRANSACTIONS' ? transactions.length : displayBooks.length}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                {isAr ? 'إجمالي النسخ الفعلية بالمخزن' : 'Total Physical Copies in Stock'}
              </span>
              <span className="text-base font-bold text-[#006F88] font-mono tabular-nums mt-0.5 block">
                {totalCopies.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">
                {isAr ? 'أصناف تحت الحد الأدنى (حرج)' : 'Titles Below Minimum Threshold'}
              </span>
              <span className="text-base font-bold text-amber-700 font-mono tabular-nums mt-0.5 block">
                {lowStockBooks.length}
              </span>
            </div>
          </div>

          {/* Report Table */}
          {reportType !== 'TRANSACTIONS' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 px-3 py-2 text-start">{isAr ? 'الباركود' : 'Barcode'}</th>
                    <th className="border border-slate-300 px-3 py-2 text-start">{isAr ? 'عنوان الكتاب' : 'Book Title'}</th>
                    <th className="border border-slate-300 px-3 py-2 text-start">{isAr ? 'المرحلة / الصف' : 'Stage / Grade'}</th>
                    <th className="border border-slate-300 px-3 py-2 text-start">{isAr ? 'العام الدراسي' : 'Academic Year'}</th>
                    <th className="border border-slate-300 px-3 py-2 text-end">{isAr ? 'الرصيد الفعلي' : 'Current Stock'}</th>
                    <th className="border border-slate-300 px-3 py-2 text-end">{isAr ? 'الحد الأدنى' : 'Min Level'}</th>
                    <th className="border border-slate-300 px-3 py-2 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayBooks.map((b) => {
                    const isLow = b.currentStock <= b.minStockLevel;
                    return (
                      <tr key={b.id} className="border-b border-slate-200">
                        <td className="border border-slate-300 px-3 py-2 font-mono tabular-nums">{b.barcode}</td>
                        <td className="border border-slate-300 px-3 py-2 font-medium">
                          {isAr ? b.titleAr : b.title}
                        </td>
                        <td className="border border-slate-300 px-3 py-2">
                          {isAr ? b.gradeAr : b.grade}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 font-mono tabular-nums">{b.academicYear}</td>
                        <td className="border border-slate-300 px-3 py-2 text-end font-mono tabular-nums font-semibold">
                          {b.currentStock.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-end font-mono tabular-nums text-slate-600">
                          {b.minStockLevel.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 px-3 py-2">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {isAr ? 'تحت الحد الأدنى' : 'Low Stock'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isAr ? 'رصيد آمن' : 'Optimal'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th className="border border-slate-300 px-2.5 py-2 text-start">{isAr ? 'رقم الحركة' : 'Code'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-start">{isAr ? 'النوع' : 'Type'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-start">{isAr ? 'الكتاب' : 'Book'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-end">{isAr ? 'الكمية' : 'Qty'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-end">{isAr ? 'الرصيد بعد' : 'Stock After'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-start">{isAr ? 'الجهة / المدرسة' : 'Counterparty'}</th>
                    <th className="border border-slate-300 px-2.5 py-2 text-start">{isAr ? 'المستند' : 'Ref #'}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-slate-200">
                      <td className="border border-slate-300 px-2.5 py-2 font-mono tabular-nums">{t.transactionCode}</td>
                      <td className="border border-slate-300 px-2.5 py-2 font-mono tabular-nums">
                        {new Date(t.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-medium">
                        {t.type === 'INBOUND' ? (isAr ? 'توريد (+)' : 'Inbound (+)') : isAr ? 'صرف (-)' : 'Outbound (-)'}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2">{isAr ? t.bookTitleAr : t.bookTitle}</td>
                      <td className="border border-slate-300 px-2.5 py-2 text-end font-mono tabular-nums font-semibold">
                        {t.type === 'INBOUND' ? `+${t.quantity.toLocaleString()}` : `-${t.quantity.toLocaleString()}`}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 text-end font-mono tabular-nums">
                        {t.stockAfter.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2">
                        {isAr ? t.counterpartyNameAr : t.counterpartyName}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-mono tabular-nums">{t.referenceNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Official Signatures Block */}
          <div className="grid grid-cols-3 gap-6 mt-10 pt-6 border-t border-slate-200 text-xs text-center">
            <div>
              <p className="font-semibold text-slate-800">{isAr ? 'أمين المخزن المختص' : 'Storekeeper Signature'}</p>
              <p className="text-slate-500 mt-1">أ. محمود عبد القادر</p>
              <div className="mt-6 border-b border-dashed border-slate-400 w-40 mx-auto" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{isAr ? 'المراجع الداخلي والتفتيش' : 'Internal Auditor'}</p>
              <p className="text-slate-500 mt-1">أ. نادية الشافعي</p>
              <div className="mt-6 border-b border-dashed border-slate-400 w-40 mx-auto" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">{isAr ? 'اعتماد مدير عام المخازن' : 'Warehouse Director Approval'}</p>
              <p className="text-slate-500 mt-1">م. طارق المنصور</p>
              <div className="mt-6 border-b border-dashed border-slate-400 w-40 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
