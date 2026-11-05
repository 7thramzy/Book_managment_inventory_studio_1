import { AuditLogEntry, BookItem, InventoryTransaction } from '../types/inventory';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export function exportBooksToCSV(books: BookItem[], lang: 'ar' | 'en' = 'ar') {
  const headers =
    lang === 'ar'
      ? [
          'كود الباركود',
          'عنوان الكتاب (عربي)',
          'عنوان الكتاب (إنجليزي)',
          'المرحلة التعليمية',
          'الصف الدراسي',
          'العام الدراسي',
          'المادة الدراسية',
          'الرصيد الحالي',
          'الحد الأدنى للمخزون',
          'حالة الرصيد',
          'حالة المزامنة (Google Sheets)',
          'آخر تحديث',
        ]
      : [
          'Barcode',
          'Book Title (EN)',
          'Book Title (AR)',
          'Educational Stage',
          'Grade',
          'Academic Year',
          'Subject',
          'Current Stock',
          'Min Stock Level',
          'Stock Status',
          'Sync Status',
          'Last Updated',
        ];

  const rows = books.map((b) => {
    const isLow = b.currentStock <= b.minStockLevel;
    const statusLabel =
      lang === 'ar'
        ? b.currentStock === 0
          ? 'نافد'
          : isLow
          ? 'رصيد منخفض (حرج)'
          : 'متوفر (آمن)'
        : b.currentStock === 0
        ? 'Out of Stock'
        : isLow
        ? 'Low Stock Alert'
        : 'Optimal';

    return [
      b.barcode,
      lang === 'ar' ? b.titleAr : b.title,
      lang === 'ar' ? b.title : b.titleAr,
      b.stage,
      lang === 'ar' ? b.gradeAr : b.grade,
      b.academicYear,
      lang === 'ar' ? b.subjectAr : b.subject,
      b.currentStock,
      b.minStockLevel,
      statusLabel,
      b.isSynced ? (lang === 'ar' ? 'تمت المزامنة' : 'Synced') : lang === 'ar' ? 'بانتظار المزامنة' : 'Pending Sync',
      new Date(b.updatedAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
    ].map(escapeCsvCell);
  });

  // Prepend UTF-8 BOM (\uFEFF) so Arabic characters render cleanly in Microsoft Excel
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csvContent, `textbook_catalog_inventory_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
}

export function exportTransactionsToCSV(transactions: InventoryTransaction[], lang: 'ar' | 'en' = 'ar') {
  const headers =
    lang === 'ar'
      ? [
          'رقم الحركة',
          'التاريخ والوقت',
          'نوع الحركة',
          'التصنيف الفرعي',
          'كود الكتاب',
          'اسم الكتاب',
          'العام الدراسي',
          'الكمية',
          'الرصيد قبل الحركة',
          'الرصيد بعد الحركة',
          'رقم المستند / الفاتورة',
          'الجهة (المدرسة / المورد)',
          'المسؤول',
          'حالة المزامنة',
          'ملاحظات',
        ]
      : [
          'Transaction Code',
          'Timestamp',
          'Type',
          'Sub-Type',
          'Book Barcode',
          'Book Title',
          'Academic Year',
          'Quantity',
          'Stock Before',
          'Stock After',
          'Reference #',
          'School / Supplier',
          'Recorded By',
          'Sync Status',
          'Notes',
        ];

  const rows = transactions.map((t) => [
    t.transactionCode,
    new Date(t.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
    t.type === 'INBOUND' ? (lang === 'ar' ? 'توريد مخزني (+)' : 'INBOUND (+)') : lang === 'ar' ? 'صرف مدرسي (-)' : 'OUTBOUND (-)',
    t.subType,
    t.bookBarcode,
    lang === 'ar' ? t.bookTitleAr : t.bookTitle,
    t.academicYear,
    t.quantity,
    t.stockBefore,
    t.stockAfter,
    t.referenceNumber,
    lang === 'ar' ? t.counterpartyNameAr : t.counterpartyName,
    t.createdBy,
    t.isSynced ? (lang === 'ar' ? 'تمت المزامنة' : 'Synced') : lang === 'ar' ? 'محلي (غير متزامن)' : 'Pending Offline',
    t.notes,
  ].map(escapeCsvCell));

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csvContent, `warehouse_transactions_ledger_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
}

export function exportAuditLogsToCSV(auditLogs: AuditLogEntry[], lang: 'ar' | 'en' = 'ar') {
  const headers =
    lang === 'ar'
      ? [
          'معرف السجل',
          'التاريخ والوقت',
          'المسؤول',
          'الدور الوظيفي',
          'التصنيف',
          'نوع الإجراء',
          'العنصر المتأثر',
          'ملخص التغيير',
          'التفاصيل (قبل -> بعد)',
        ]
      : [
          'Audit ID',
          'Timestamp',
          'User Name',
          'Role',
          'Category',
          'Action',
          'Target Entity',
          'Summary',
          'Field Changes (Before -> After)',
        ];

  const rows = auditLogs.map((log) => {
    const diffsFormatted = (log.changes || [])
      .map((c) => `${lang === 'ar' ? c.labelAr : c.labelEn}: [${c.before}] -> [${c.after}]`)
      .join(' | ');
    return [
      log.id,
      new Date(log.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US'),
      lang === 'ar' ? log.actorNameAr : log.actorName,
      log.actorRole,
      log.category,
      log.action,
      lang === 'ar' ? log.entityTitleAr : log.entityTitleEn,
      lang === 'ar' ? log.summaryAr : log.summaryEn,
      diffsFormatted,
    ].map(escapeCsvCell);
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(csvContent, `warehouse_audit_log_${dateStamp}.csv`, 'text/csv;charset=utf-8;');
}

