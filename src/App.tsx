import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppTabKey,
  AuditFieldDiff,
  AuditLogEntry,
  AutomationAlertItem,
  BookItem,
  DamagedBookRecord,
  EducationalStage,
  FormLookupsConfig,
  InventoryTransaction,
  SchoolEntity,
  SheetsConnectionMethod,
  StocktakingSession,
  SyncConfig,
  SyncLogEntry,
  TransactionSubType,
  TransactionType,
  UserAccount,
  WorkspaceEntity,
} from './types/inventory';
import {
  DEFAULT_FORM_LOOKUPS,
  DEFAULT_ROLE_TAB_MATRIX,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_BOOKS,
  INITIAL_DAMAGED_RECORDS,
  INITIAL_SCHOOLS,
  INITIAL_STOCKTAKING_SESSIONS,
  INITIAL_SYNC_LOGS,
  INITIAL_TRANSACTIONS,
  INITIAL_WORKSPACES,
} from './data/seedData';
import { DriftSqliteClientEngine } from './db/driftEngine';
import { exportBooksToCSV, exportTransactionsToCSV } from './utils/exportReports';
import { BookFormModal } from './components/BookFormModal';
import { TransactionModal } from './components/TransactionModal';
import { PdfReportModal } from './components/PdfReportModal';
import { SyncCenterView } from './components/SyncCenterView';
import { AuthRoleModal } from './components/AuthRoleModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { InventoryTurnoverChart } from './components/InventoryTurnoverChart';
import { BulkAdjustmentModal } from './components/BulkAdjustmentModal';
import { FormConfigView } from './components/FormConfigView';
import { BarcodePrintModal } from './components/BarcodePrintModal';
import { SuperAdminView } from './components/SuperAdminView';
import { StocktakingAndDamagedView } from './components/StocktakingAndDamagedView';
import {
  usePWA,
  PWAInstallModal,
  OfflineStatusFloatingPill,
} from './hooks/usePWA';
import {
  LayoutDashboard,
  BookOpen,
  ArrowLeftRight,
  CloudUpload,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  FileText,
  Sun,
  Moon,
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  Trash2,
  Wifi,
  WifiOff,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  ScanBarcode,
  Layers,
  CheckSquare,
  Square,
  Sliders,
  Printer,
  ClipboardCheck,
  Crown,
  Smartphone,
  MoreHorizontal,
  PenTool,
  Building2,
} from 'lucide-react';

type ActiveSection =
  | 'DASHBOARD'
  | 'CATALOG'
  | 'TRANSACTIONS'
  | 'STOCKTAKING'
  | 'SUPER_ADMIN'
  | 'CONFIG'
  | 'SYNC';

export default function App() {
  // Theme & Language (RTL Arabic default with 1-click English toggle)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('moe_theme_dark') === 'true';
  });
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    return (localStorage.getItem('moe_lang') as 'ar' | 'en') || 'ar';
  });

  // Navigation & Layout state
  const [activeSection, setActiveSection] = useState<ActiveSection>('DASHBOARD');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [mobileMoreDrawerOpen, setMobileMoreDrawerOpen] = useState<boolean>(false);
  const [pwaModalOpen, setPwaModalOpen] = useState<boolean>(false);

  // PWA & Native Mobile Capabilities Hook
  const pwa = usePWA();

  // Users & Workspaces state
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_USERS);
  const [workspaces, setWorkspaces] = useState<WorkspaceEntity[]>(INITIAL_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('moe_active_workspace_id') || INITIAL_WORKSPACES[0].id;
  });

  // Auth & Role state
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('moe_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_USERS[0]; // Super Admin by default so all controls are immediately accessible
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Core Inventory State backed by Drift SQLite Engine
  const [books, setBooks] = useState<BookItem[]>(INITIAL_BOOKS);
  const [schools, setSchools] = useState<SchoolEntity[]>(INITIAL_SCHOOLS);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(INITIAL_TRANSACTIONS);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(INITIAL_SYNC_LOGS);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
  const [formConfig, setFormConfig] = useState<FormLookupsConfig>(DEFAULT_FORM_LOOKUPS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [stocktakingSessions, setStocktakingSessions] = useState<StocktakingSession[]>(
    INITIAL_STOCKTAKING_SESSIONS
  );
  const [damagedRecords, setDamagedRecords] = useState<DamagedBookRecord[]>(INITIAL_DAMAGED_RECORDS);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Feedback banner state
  const [banner, setBanner] = useState<{
    type: 'SUCCESS' | 'WARNING' | 'ERROR';
    message: string;
  } | null>(null);

  // Filter states for Books Catalog
  const [bookSearch, setBookSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'ALL' | EducationalStage>('ALL');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW_STOCK' | 'OPTIMAL'>('ALL');
  const [selectedCatalogBookIds, setSelectedCatalogBookIds] = useState<string[]>([]);

  // Filter states for Transactions
  const [txSearch, setTxSearch] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [txSyncFilter, setTxSyncFilter] = useState<'ALL' | 'SYNCED' | 'PENDING'>('ALL');

  // Modals state
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>('INBOUND');
  const [txPreselectedBookId, setTxPreselectedBookId] = useState<string | undefined>(undefined);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfReportType, setPdfReportType] = useState<'CATALOG' | 'TRANSACTIONS' | 'LOW_STOCK'>('CATALOG');
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [barcodePrintModalOpen, setBarcodePrintModalOpen] = useState(false);
  const [booksForBarcodePrint, setBooksForBarcodePrint] = useState<BookItem[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txPageSize, setTxPageSize] = useState(15);

  const isAr = lang === 'ar';
  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0],
    [workspaces, activeWorkspaceId]
  );
  const isWorkspaceActive = activeWorkspace?.isActive !== false;
  const canEditInventory =
    isWorkspaceActive &&
    currentUser.isActive !== false &&
    (currentUser.role === 'SUPER_ADMIN' ||
      currentUser.role === 'ADMIN' ||
      currentUser.role === 'STOREKEEPER');
  const canDeleteCatalog =
    isWorkspaceActive &&
    currentUser.isActive !== false &&
    (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN');

  // Sync Dark Mode with <html class="dark">
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('moe_theme_dark', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('moe_lang', lang);
  }, [lang]);

  const showToast = useCallback((type: 'SUCCESS' | 'WARNING' | 'ERROR', message: string) => {
    setBanner({ type, message });
    const timer = setTimeout(() => {
      setBanner((prev) => (prev?.message === message ? null : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Initial Bootstrap from SQLite + Local Drift Cache
  useEffect(() => {
    let mounted = true;
    async function init() {
      setIsLoading(true);
      const snap = await DriftSqliteClientEngine.bootstrap(isOfflineSimulated);
      if (!mounted) return;
      setBooks(snap.books);
      setSchools(snap.schools);
      setTransactions(snap.transactions);
      setSyncLogs(snap.syncLogs);
      setSyncConfig(snap.syncConfig);
      setFormConfig(snap.formConfig || DEFAULT_FORM_LOOKUPS);
      setAuditLogs(snap.auditLogs || INITIAL_AUDIT_LOGS);
      setUsers(snap.users || DEFAULT_USERS);
      setWorkspaces(snap.workspaces || INITIAL_WORKSPACES);
      setStocktakingSessions(snap.stocktakingSessions || INITIAL_STOCKTAKING_SESSIONS);
      setDamagedRecords(snap.damagedRecords || INITIAL_DAMAGED_RECORDS);
      setIsLoading(false);
    }
    init();
    return () => {
      mounted = false;
    };
  }, [isOfflineSimulated]);

  // Derived Statistics
  const stats = useMemo(() => {
    const totalTitles = books.length;
    const totalPhysicalCopies = books.reduce((acc, b) => acc + b.currentStock, 0);
    const lowStockBooks = books.filter((b) => b.currentStock <= b.minStockLevel);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysTransactions = transactions.filter((t) => t.createdAt.slice(0, 10) === todayStr);
    const todayInboundQty = todaysTransactions
      .filter((t) => t.type === 'INBOUND')
      .reduce((acc, t) => acc + t.quantity, 0);
    const todayOutboundQty = todaysTransactions
      .filter((t) => t.type === 'OUTBOUND')
      .reduce((acc, t) => acc + t.quantity, 0);

    const unsyncedCount =
      books.filter((b) => !b.isSynced).length + transactions.filter((t) => !t.isSynced).length;

    return {
      totalTitles,
      totalPhysicalCopies,
      lowStockCount: lowStockBooks.length,
      lowStockBooks,
      todaysTransactionsCount: todaysTransactions.length,
      todayInboundQty,
      todayOutboundQty,
      unsyncedCount,
    };
  }, [books, transactions]);

  // Filtered Books
  const filteredBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    return books.filter((b) => {
      if (stageFilter !== 'ALL' && b.stage !== stageFilter) return false;
      if (yearFilter !== 'ALL' && b.academicYear !== yearFilter) return false;
      if (stockFilter === 'LOW_STOCK' && b.currentStock > b.minStockLevel) return false;
      if (stockFilter === 'OPTIMAL' && b.currentStock <= b.minStockLevel) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.titleAr.toLowerCase().includes(q) ||
        b.barcode.toLowerCase().includes(q) ||
        b.subject.toLowerCase().includes(q) ||
        b.subjectAr.toLowerCase().includes(q) ||
        b.gradeAr.toLowerCase().includes(q)
      );
    });
  }, [books, bookSearch, stageFilter, yearFilter, stockFilter]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((t) => {
      if (txTypeFilter !== 'ALL' && t.type !== txTypeFilter) return false;
      if (txSyncFilter === 'SYNCED' && !t.isSynced) return false;
      if (txSyncFilter === 'PENDING' && t.isSynced) return false;
      if (!q) return true;
      return (
        t.transactionCode.toLowerCase().includes(q) ||
        t.bookTitle.toLowerCase().includes(q) ||
        t.bookTitleAr.toLowerCase().includes(q) ||
        t.bookBarcode.toLowerCase().includes(q) ||
        t.referenceNumber.toLowerCase().includes(q) ||
        t.counterpartyName.toLowerCase().includes(q) ||
        t.counterpartyNameAr.toLowerCase().includes(q)
      );
    });
  }, [transactions, txSearch, txTypeFilter, txSyncFilter]);

  // Handlers
  const handleSelectUser = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem('moe_active_user', JSON.stringify(user));
    showToast(
      'SUCCESS',
      isAr
        ? `تم التبديل إلى حساب: ${user.fullNameAr} (${user.role})`
        : `Switched active session to ${user.fullName} (${user.role})`
    );
  };

  const handleRecordAudit = useCallback(
    async (entryInput: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
      const saved = await DriftSqliteClientEngine.appendAuditLog(entryInput, isOfflineSimulated);
      setAuditLogs((prev) => [saved, ...prev]);
    },
    [isOfflineSimulated]
  );

  const handleSaveBook = async (bookData: Partial<BookItem> & { title: string; barcode: string }) => {
    const existingBook = bookData.id ? books.find((b) => b.id === bookData.id) : undefined;
    const { book, savedOffline } = await DriftSqliteClientEngine.upsertBook(bookData, isOfflineSimulated);
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      return exists ? prev.map((b) => (b.id === book.id ? book : b)) : [book, ...prev];
    });

    if (existingBook) {
      const diffs: AuditFieldDiff[] = [];
      if (existingBook.titleAr !== book.titleAr) {
        diffs.push({
          field: 'titleAr',
          labelAr: 'عنوان الكتاب (عربي)',
          labelEn: 'Textbook Title (AR)',
          before: existingBook.titleAr,
          after: book.titleAr,
        });
      }
      if (existingBook.barcode !== book.barcode) {
        diffs.push({
          field: 'barcode',
          labelAr: 'الباركود الوزاري',
          labelEn: 'Barcode',
          before: existingBook.barcode,
          after: book.barcode,
        });
      }
      if (existingBook.minStockLevel !== book.minStockLevel) {
        diffs.push({
          field: 'minStockLevel',
          labelAr: 'الحد الأدنى للمخزون',
          labelEn: 'Min Stock Level',
          before: existingBook.minStockLevel.toLocaleString(),
          after: book.minStockLevel.toLocaleString(),
        });
      }
      if (existingBook.currentStock !== book.currentStock) {
        diffs.push({
          field: 'currentStock',
          labelAr: 'الرصيد الفعلي',
          labelEn: 'Current Stock',
          before: existingBook.currentStock.toLocaleString(),
          after: book.currentStock.toLocaleString(),
        });
      }
      if ((existingBook.unitType || 'Unit') !== (book.unitType || 'Unit')) {
        diffs.push({
          field: 'unitType',
          labelAr: 'وحدة القياس (Unit Type)',
          labelEn: 'Unit Type',
          before: existingBook.unitType || 'Unit',
          after: book.unitType || 'Unit',
        });
      }
      await handleRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CATALOG_BOOK',
        action: 'UPDATE',
        entityTitleAr: `${book.titleAr} (${book.barcode})`,
        entityTitleEn: `${book.title} (${book.barcode})`,
        summaryAr: `تعديل بيانات بطاقة الكتاب "${book.titleAr}" في دليل الأصناف.`,
        summaryEn: `Updated textbook catalog card "${book.title}".`,
        changes: diffs,
      });
    } else {
      await handleRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CATALOG_BOOK',
        action: 'CREATE',
        entityTitleAr: `${book.titleAr} (${book.barcode})`,
        entityTitleEn: `${book.title} (${book.barcode})`,
        summaryAr: `إضافة كتاب مدرسي جديد "${book.titleAr}" برصيد افتتاحي ${book.currentStock.toLocaleString()} نسخة.`,
        summaryEn: `Added new textbook "${book.title}" with opening stock of ${book.currentStock.toLocaleString()} copies.`,
        changes: [
          {
            field: 'currentStock',
            labelAr: 'الرصيد الافتتاحي',
            labelEn: 'Opening Stock',
            before: '0',
            after: book.currentStock.toLocaleString(),
          },
          {
            field: 'minStockLevel',
            labelAr: 'الحد الأدنى للمخزون',
            labelEn: 'Min Stock Level',
            before: '—',
            after: book.minStockLevel.toLocaleString(),
          },
        ],
      });
    }

    showToast(
      savedOffline ? 'WARNING' : 'SUCCESS',
      isAr
        ? `تم حفظ الكتاب "${book.titleAr}" في قاعدة Drift SQLite (${
            savedOffline ? 'وضع بدون إنترنت - بانتظار المزامنة' : 'جاهز للمزامنة'
          }).`
        : `Saved "${book.title}" to Drift SQLite (${savedOffline ? 'Offline Queue' : 'Ready to Sync'}).`
    );
  };

  const handleDeleteBook = async (book: BookItem) => {
    if (!canDeleteCatalog) return;
    await DriftSqliteClientEngine.deleteBook(book.id, isOfflineSimulated);
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setSelectedCatalogBookIds((prev) => prev.filter((id) => id !== book.id));
    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CATALOG_BOOK',
      action: 'DELETE',
      entityTitleAr: `${book.titleAr} (${book.barcode})`,
      entityTitleEn: `${book.title} (${book.barcode})`,
      summaryAr: `حذف الكتاب "${book.titleAr}" نهائياً من دليل الأصناف.`,
      summaryEn: `Deleted textbook "${book.title}" from catalog.`,
      changes: [
        {
          field: 'book',
          labelAr: 'بطاقة الصنف المحذوفة',
          labelEn: 'Deleted Catalog Book',
          before: `${book.titleAr} [الرصيد: ${book.currentStock}]`,
          after: 'محذوف (Deleted)',
        },
      ],
    });
    showToast(
      'SUCCESS',
      isAr
        ? `تم حذف الكتاب "${book.titleAr}" من الدليل.`
        : `Removed "${book.title}" from the catalog.`
    );
  };

  const handleRecordTransaction = async (payload: {
    type: TransactionType;
    subType: InventoryTransaction['subType'];
    bookId: string;
    academicYear: string;
    quantity: number;
    referenceNumber: string;
    counterpartyName: string;
    counterpartyNameAr: string;
    schoolId?: string;
    createdBy: string;
    createdByRole: UserAccount['role'];
    notes: string;
    recipientPersonName?: string;
    recipientPhone?: string;
    recipientSignatureDataUrl?: string;
  }) => {
    const { transaction, book, savedOffline } = await DriftSqliteClientEngine.recordTransaction(
      payload,
      isOfflineSimulated
    );
    setBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
    setTransactions((prev) => [transaction, ...prev]);

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'INVENTORY_TRANSACTION',
      action: 'CREATE',
      entityTitleAr: `${transaction.bookTitleAr} (${transaction.transactionCode})`,
      entityTitleEn: `${transaction.bookTitle} (${transaction.transactionCode})`,
      summaryAr: `${
        transaction.type === 'INBOUND' ? 'توريد مخزني (+)' : 'صرف مدرسي (-)'
      } بكمية ${transaction.quantity.toLocaleString()} نسخة — المستند: ${transaction.referenceNumber}${
        transaction.recipientSignatureDataUrl ? ' (موقع إلكترونياً)' : ''
      }`,
      summaryEn: `${transaction.type} of ${transaction.quantity.toLocaleString()} copies — Ref: ${transaction.referenceNumber}${
        transaction.recipientSignatureDataUrl ? ' (Digitally Signed)' : ''
      }`,
      changes: [
        {
          field: 'currentStock',
          labelAr: 'الرصيد الفعلي للكتاب بالمخزن',
          labelEn: 'Warehouse Stock Level',
          before: transaction.stockBefore.toLocaleString(),
          after: transaction.stockAfter.toLocaleString(),
        },
        {
          field: 'counterparty',
          labelAr: 'الجهة / المدرسة المستفيدة',
          labelEn: 'Counterparty / School',
          before: 'المخزن المركزي',
          after: transaction.counterpartyNameAr,
        },
      ],
    });

    showToast(
      savedOffline ? 'WARNING' : 'SUCCESS',
      isAr
        ? `تم اعتماد الحركة ${transaction.transactionCode}: ${
            transaction.type === 'INBOUND' ? 'توريد (+)' : 'صرف (-)'
          } ${transaction.quantity.toLocaleString()} نسخة. الرصيد الجديد: ${book.currentStock.toLocaleString()}`
        : `Recorded ${transaction.transactionCode}: ${
            transaction.type === 'INBOUND' ? '+' : '-'
          }${transaction.quantity.toLocaleString()} copies. New stock: ${book.currentStock.toLocaleString()}`
    );
    return transaction;
  };

  const handleRecordBatch = async (payload: {
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
  }) => {
    const {
      transactions: newTxs,
      books: updatedBooks,
      savedOffline,
    } = await DriftSqliteClientEngine.recordBatchTransactions(payload, isOfflineSimulated);

    const updatedMap = new Map<string, BookItem>(updatedBooks.map((b) => [b.id, b]));
    setBooks((prev) => prev.map((b) => updatedMap.get(b.id) || b));
    setTransactions((prev) => [...newTxs, ...prev]);
    setSelectedCatalogBookIds([]);

    const totalBatchQty = newTxs.reduce((acc, t) => acc + t.quantity, 0);
    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'INVENTORY_TRANSACTION',
      action: 'BULK_ADJUST',
      entityTitleAr: `تسوية جماعية (${payload.referenceNumber}) لعدد ${newTxs.length} كتب`,
      entityTitleEn: `Bulk Adjustment (${payload.referenceNumber}) across ${newTxs.length} textbooks`,
      summaryAr: `تنفيذ ${
        payload.type === 'INBOUND' ? 'توريد جماعي (+)' : 'صرف جماعي (-)'
      } بإجمالي ${totalBatchQty.toLocaleString()} نسخة لصالح ${payload.counterpartyNameAr}.`,
      summaryEn: `Executed bulk ${payload.type.toLowerCase()} (${totalBatchQty.toLocaleString()} total copies) for ${payload.counterpartyName}.`,
      changes: newTxs.map((t) => ({
        field: t.bookBarcode,
        labelAr: t.bookTitleAr,
        labelEn: t.bookTitle,
        before: t.stockBefore.toLocaleString(),
        after: t.stockAfter.toLocaleString(),
      })),
    });

    showToast(
      savedOffline ? 'WARNING' : 'SUCCESS',
      isAr
        ? `تم تنفيذ التسوية الجماعية بنجاح لعدد ${newTxs.length} كتب بإجمالي ${totalBatchQty.toLocaleString()} نسخة (${
            payload.type === 'INBOUND' ? 'توريد جماعي +' : 'صرف جماعي -'
          }).`
        : `Executed bulk ${payload.type.toLowerCase()} across ${newTxs.length} textbooks (${totalBatchQty.toLocaleString()} total copies).`
    );
  };

  const handleSyncNow = async (
    options?:
      | string
      | {
          customWebhookUrl?: string;
          sheetUrl?: string;
          spreadsheetId?: string;
          googleAccessToken?: string;
          connectionMethod?: SheetsConnectionMethod;
        }
  ) => {
    if (isOfflineSimulated) {
      showToast(
        'WARNING',
        isAr
          ? 'لا يمكن المزامنة أثناء تفعيل وضع محاكاة انقطاع الإنترنت. قم بإلغاء الوضع أولاً.'
          : 'Cannot sync while Offline Simulation is active. Reconnect first.'
      );
      return;
    }
    try {
      const { snapshot, logEntry } = await DriftSqliteClientEngine.syncToGoogleSheets(options);
      setBooks(snapshot.books);
      setTransactions(snapshot.transactions);
      setSyncLogs(snapshot.syncLogs);
      setSyncConfig(snapshot.syncConfig);
      showToast('SUCCESS', logEntry.message);
    } catch (err: any) {
      showToast('ERROR', err.message || 'فشلت عملية المزامنة');
    }
  };

  const handleToggleOffline = async (nextOffline: boolean) => {
    setIsOfflineSimulated(nextOffline);
    if (!nextOffline) {
      showToast(
        'SUCCESS',
        isAr
          ? 'تمت استعادة الاتصال بالشبكة! جاري مزامنة الحركات المحلية غير المتزامنة مع Google Sheets...'
          : 'Network connection restored! Automatically syncing queued offline records to Google Sheets...'
      );
      try {
        const { snapshot } = await DriftSqliteClientEngine.syncToGoogleSheets();
        setBooks(snapshot.books);
        setTransactions(snapshot.transactions);
        setSyncLogs(snapshot.syncLogs);
        setSyncConfig(snapshot.syncConfig);
      } catch {
        // ignore
      }
    } else {
      showToast(
        'WARNING',
        isAr
          ? 'تم تفعيل وضع العمل بدون إنترنت (Offline-First Mode). تُحفظ جميع الحركات في قاعدة Drift SQLite المحلية.'
          : 'Offline-First Mode active. All mutations are stored locally in Drift SQLite with isSynced = false.'
      );
    }
  };

  const handleUpdateSyncConfig = async (partial: Partial<SyncConfig>) => {
    const next = { ...syncConfig, ...partial };
    setSyncConfig(next);
    DriftSqliteClientEngine.saveLocalSnapshot({ syncConfig: next });
    if (!isOfflineSimulated) {
      try {
        await fetch('/api/sync-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(partial),
        });
      } catch {
        // ignore
      }
    }
    showToast(
      'SUCCESS',
      isAr ? 'تم تحديث إعدادات ربط Google Sheets بنجاح.' : 'Updated Google Sheets Webhook settings.'
    );
  };

  const handleUpdateFormConfig = async (nextConfig: FormLookupsConfig) => {
    const saved = await DriftSqliteClientEngine.updateFormConfig(nextConfig, isOfflineSimulated);
    setFormConfig(saved);
    showToast(
      'SUCCESS',
      isAr
        ? 'تم حفظ تهيئة المدخلات والبيانات المؤتمتة بنجاح في قاعدة Drift SQLite.'
        : 'Form lookups and automation settings saved to Drift SQLite.'
    );
  };

  const handleExecuteAutomationRules = async () => {
    const activeRules = (formConfig.automationRules || []).filter((r) => r.enabled);
    if (activeRules.length === 0) return;

    const nowIso = new Date().toISOString();
    let updatedBooksList = [...books];
    const reorderDiffs: AuditFieldDiff[] = [];
    const generatedAlerts: AutomationAlertItem[] = [];

    const nextRules = (formConfig.automationRules || []).map((rule) => {
      if (!rule.enabled) return rule;

      if (rule.triggerType === 'REORDER_POINT_PERCENTAGE') {
        const pct = Math.max(1, Math.min(100, Number(rule.parameterValue) || 20));
        let changedCount = 0;

        updatedBooksList = updatedBooksList.map((b) => {
          // Reference max stock capacity for textbook
          const maxCapacity = Math.max(
            b.currentStock,
            formConfig.defaults.defaultOpeningStock || 1200,
            2500
          );
          const calculatedMin = Math.max(50, Math.round(maxCapacity * (pct / 100)));
          if (calculatedMin !== b.minStockLevel) {
            changedCount++;
            reorderDiffs.push({
              field: b.barcode,
              labelAr: `حد إعادة الطلب (${b.titleAr})`,
              labelEn: `Reorder Point (${b.title})`,
              before: `${b.minStockLevel.toLocaleString()}`,
              after: `${calculatedMin.toLocaleString()} (${pct}% of ${maxCapacity.toLocaleString()})`,
            });
            return {
              ...b,
              minStockLevel: calculatedMin,
              updatedAt: nowIso,
              isSynced: false,
            };
          }
          return b;
        });

        return {
          ...rule,
          lastRunAt: nowIso,
          lastRunSummaryAr: `تم فحص ${updatedBooksList.length} كتب وتحديث حد إعادة الطلب لعدد ${changedCount} كتاب بنسبة ${pct}% من السعة القصوى.`,
          lastRunSummaryEn: `Evaluated ${updatedBooksList.length} books; updated ${changedCount} reorder points at ${pct}% of max stock.`,
        };
      }

      if (rule.triggerType === 'ZERO_STOCK_NOTIFICATION') {
        const threshold = Math.max(0, Number(rule.parameterValue) || 0);
        const matchingBooks = updatedBooksList.filter((b) => b.currentStock <= threshold);
        for (const b of matchingBooks) {
          generatedAlerts.push({
            id: `alrt-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleNameAr: rule.nameAr,
            ruleNameEn: rule.nameEn,
            severity: 'CRITICAL',
            bookBarcode: b.barcode,
            bookTitleAr: b.titleAr,
            bookTitleEn: b.title,
            recipientEmail: rule.targetEmail || 'warehouse-alerts@moe.gov.eg',
            messageAr: `إشعار بريد إلكتروني عاجل إلى ${
              rule.targetEmail || 'warehouse-alerts@moe.gov.eg'
            }: الكتاب "${b.titleAr}" وصل رصيده إلى ${b.currentStock} نسخة (عتبة التنبيه: ${threshold}).`,
            messageEn: `Urgent email notification queued for ${
              rule.targetEmail || 'warehouse-alerts@moe.gov.eg'
            }: "${b.title}" stock hit ${b.currentStock} copies (threshold: ${threshold}).`,
            createdAt: nowIso,
            acknowledged: false,
          });
        }
        return {
          ...rule,
          lastRunAt: nowIso,
          lastRunSummaryAr:
            matchingBooks.length > 0
              ? `تم رصد ${matchingBooks.length} كتاب عند أو تحت عتبة (${threshold}) وإصدار إشعار بريد داخلي.`
              : `تم فحص جميع الكتب — لا توجد أصناف برصيد ${threshold} حالياً.`,
          lastRunSummaryEn:
            matchingBooks.length > 0
              ? `Triggered ${matchingBooks.length} stock-zero email alerts in the In-App Alert Center.`
              : `Scanned catalog — 0 textbooks at or below ${threshold} copies.`,
        };
      }

      if (rule.triggerType === 'CRITICAL_STOCK_BUFFER') {
        const buffer = Math.max(1, Number(rule.parameterValue) || 500);
        const criticalBooks = updatedBooksList.filter((b) => b.currentStock <= buffer);
        for (const b of criticalBooks) {
          generatedAlerts.push({
            id: `alrt-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
            ruleId: rule.id,
            ruleCode: rule.code,
            ruleNameAr: rule.nameAr,
            ruleNameEn: rule.nameEn,
            severity: 'WARNING',
            bookBarcode: b.barcode,
            bookTitleAr: b.titleAr,
            bookTitleEn: b.title,
            recipientEmail: rule.targetEmail || 'procurement-committee@moe.gov.eg',
            messageAr: `إشعار بريد داخلي إلى ${
              rule.targetEmail || 'procurement-committee@moe.gov.eg'
            }: رصيد "${b.titleAr}" هو ${b.currentStock.toLocaleString()} نسخة (تحت هامش الأمان ${buffer.toLocaleString()}).`,
            messageEn: `Alert queued for ${
              rule.targetEmail || 'procurement-committee@moe.gov.eg'
            }: "${b.title}" stock is ${b.currentStock.toLocaleString()} copies (below ${buffer.toLocaleString()} buffer).`,
            createdAt: nowIso,
            acknowledged: false,
          });
        }
        return {
          ...rule,
          lastRunAt: nowIso,
          lastRunSummaryAr: `تم رصد ${criticalBooks.length} كتب تحت هامش الأمان (${buffer} نسخة) وتسجيل الإشعارات.`,
          lastRunSummaryEn: `Flagged ${criticalBooks.length} textbooks below ${buffer}-copy buffer.`,
        };
      }

      // AUTO_ARCHIVE_EXPIRED_YEAR
      const defaultYear = formConfig.defaults.defaultAcademicYear;
      const archivalBooks = updatedBooksList.filter((b) => b.academicYear !== defaultYear);
      for (const b of archivalBooks) {
        generatedAlerts.push({
          id: `alrt-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleNameAr: rule.nameAr,
          ruleNameEn: rule.nameEn,
          severity: 'INFO',
          bookBarcode: b.barcode,
          bookTitleAr: b.titleAr,
          bookTitleEn: b.title,
          recipientEmail: rule.targetEmail || 'audit-unit@moe.gov.eg',
          messageAr: `تنبيه جرد سنوي: الكتاب "${b.titleAr}" مسجل بطبعة العام (${b.academicYear}) برصيد ${b.currentStock} نسخة.`,
          messageEn: `Archival edition notice: "${b.title}" (${b.academicYear}) has ${b.currentStock} copies in stock.`,
          createdAt: nowIso,
          acknowledged: false,
        });
      }
      return {
        ...rule,
        lastRunAt: nowIso,
        lastRunSummaryAr: `تم رصد ${archivalBooks.length} كتب من طبعات دراسية سابقة عن (${defaultYear}).`,
        lastRunSummaryEn: `Identified ${archivalBooks.length} textbooks from non-default academic years.`,
      };
    });

    // Persist any books whose minStockLevel was recalibrated by REORDER_POINT_PERCENTAGE
    if (reorderDiffs.length > 0) {
      setBooks(updatedBooksList);
      DriftSqliteClientEngine.saveLocalSnapshot({ books: updatedBooksList });
      for (const b of updatedBooksList) {
        if (reorderDiffs.some((d) => d.field === b.barcode)) {
          await DriftSqliteClientEngine.upsertBook(b, isOfflineSimulated);
        }
      }
    }

    const nextConfig: FormLookupsConfig = {
      ...formConfig,
      automationRules: nextRules,
      automationAlerts: [...generatedAlerts, ...(formConfig.automationAlerts || [])].slice(0, 60),
      updatedAt: nowIso,
    };

    const savedCfg = await DriftSqliteClientEngine.updateFormConfig(nextConfig, isOfflineSimulated);
    setFormConfig(savedCfg);

    const auditChanges: AuditFieldDiff[] = [
      ...reorderDiffs,
      ...generatedAlerts.map((a) => ({
        field: a.ruleCode,
        labelAr: `تنبيه مولّد (${a.bookTitleAr || a.ruleNameAr})`,
        labelEn: `Generated Alert (${a.bookTitleEn || a.ruleNameEn})`,
        before: 'لا يوجد تنبيه',
        after: `${a.recipientEmail} — ${a.severity}`,
      })),
    ];

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'AUTOMATION_RULE',
      action: 'EXECUTE_RULES',
      entityTitleAr: `تشغيل محرك قواعد الأتمتة (${activeRules.length} قواعد نشطة)`,
      entityTitleEn: `Executed Automation Rules Engine (${activeRules.length} active rules)`,
      summaryAr: `تم تنفيذ ${activeRules.length} قواعد أتمتة: تحديث نقطة إعادة الطلب لعدد ${reorderDiffs.length} كتب، وتوليد ${generatedAlerts.length} إشعار في مركز التنبيهات.`,
      summaryEn: `Ran ${activeRules.length} active rules: recalibrated ${reorderDiffs.length} textbook reorder points and logged ${generatedAlerts.length} alerts.`,
      changes:
        auditChanges.length > 0
          ? auditChanges
          : [
              {
                field: 'executionStatus',
                labelAr: 'نتيجة فحص القواعد',
                labelEn: 'Rule Evaluation Result',
                before: 'قبل الفحص',
                after: 'جميع الحدود مطابقة لمعايير القواعد النشطة',
              },
            ],
    });

    showToast(
      'SUCCESS',
      isAr
        ? `تم تشغيل ${activeRules.length} قواعد أتمتة بنجاح: تحديث ${reorderDiffs.length} حدود إعادة طلب، وتسجيل ${generatedAlerts.length} تنبيه في مركز الإشعارات وسجل التدقيق.`
        : `Executed ${activeRules.length} automation rules: updated ${reorderDiffs.length} reorder points and logged ${generatedAlerts.length} alerts.`
    );
  };

  const handleAddSchool = async (
    schoolInput: Partial<SchoolEntity> & { nameAr: string }
  ): Promise<SchoolEntity> => {
    const school = await DriftSqliteClientEngine.upsertSchool(schoolInput, isOfflineSimulated);
    setSchools((prev) => {
      const exists = prev.some((s) => s.id === school.id);
      return exists ? prev.map((s) => (s.id === school.id ? school : s)) : [...prev, school];
    });
    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'CONFIG_LOOKUP',
      action: 'CREATE',
      entityTitleAr: `إضافة مدرسة مستفيدة: ${school.nameAr} (${school.code})`,
      entityTitleEn: `Added Beneficiary School: ${school.name} (${school.code})`,
      summaryAr: `إضافة المدرسة "${school.nameAr}" ضمن ${school.districtAr} إلى دليل الصرف المدرسي.`,
      summaryEn: `Added school "${school.name}" (${school.district}) to beneficiary directory.`,
      changes: [
        {
          field: 'school',
          labelAr: 'المدرسة المضافة',
          labelEn: 'Added School',
          before: '—',
          after: `${school.nameAr} (${school.code})`,
        },
      ],
    });
    showToast(
      'SUCCESS',
      isAr
        ? `تمت إضافة المدرسة "${school.nameAr}" إلى قائمة الجهات المستفيدة.`
        : `Added school "${school.name}" to beneficiary directory.`
    );
    return school;
  };

  const handleDeleteSchool = async (schoolId: string) => {
    const target = schools.find((s) => s.id === schoolId);
    await DriftSqliteClientEngine.deleteSchool(schoolId, isOfflineSimulated);
    setSchools((prev) => prev.filter((s) => s.id !== schoolId));
    if (target) {
      await handleRecordAudit({
        actorName: currentUser.fullName,
        actorNameAr: currentUser.fullNameAr,
        actorRole: currentUser.role,
        category: 'CONFIG_LOOKUP',
        action: 'DELETE',
        entityTitleAr: `حذف مدرسة مستفيدة: ${target.nameAr}`,
        entityTitleEn: `Removed School: ${target.name}`,
        summaryAr: `تم حذف المدرسة "${target.nameAr}" (${target.code}) من دليل الجهات المستفيدة.`,
        summaryEn: `Removed school "${target.name}" (${target.code}) from directory.`,
        changes: [
          {
            field: 'school',
            labelAr: 'المدرسة المحذوفة',
            labelEn: 'Removed School',
            before: `${target.nameAr} (${target.code})`,
            after: 'محذوف (Deleted)',
          },
        ],
      });
    }
    showToast(
      'SUCCESS',
      isAr ? 'تم حذف المدرسة من قائمة الجهات المستفيدة.' : 'Removed school from directory.'
    );
  };

  const handleResetDemoData = async () => {
    try {
      const res = await fetch('/api/reset-seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books);
        setSchools(data.schools);
        setTransactions(data.transactions);
        setSyncLogs(data.syncLogs);
        setSyncConfig(data.syncConfig);
        if (data.formConfig) setFormConfig(data.formConfig);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
        setUsers(DEFAULT_USERS);
        setWorkspaces(INITIAL_WORKSPACES);
        setStocktakingSessions(INITIAL_STOCKTAKING_SESSIONS);
        setDamagedRecords(INITIAL_DAMAGED_RECORDS);
        DriftSqliteClientEngine.saveLocalSnapshot({
          ...data,
          users: DEFAULT_USERS,
          workspaces: INITIAL_WORKSPACES,
          stocktakingSessions: INITIAL_STOCKTAKING_SESSIONS,
          damagedRecords: INITIAL_DAMAGED_RECORDS,
        });
        showToast(
          'SUCCESS',
          isAr
            ? 'تمت إعادة تهيئة قاعدة البيانات بالبيانات التجريبية الافتراضية.'
            : 'Database reset to initial realistic seed data.'
        );
      }
    } catch {
      showToast('ERROR', 'Failed to reset demo data');
    }
  };

  // Super Admin Handlers: Users & Workspaces
  const handleSaveUser = async (userData: UserAccount, isNew: boolean) => {
    const nextUsers = isNew
      ? [userData, ...users]
      : users.map((u) => (u.id === userData.id ? userData : u));
    setUsers(nextUsers);
    await DriftSqliteClientEngine.updateUsers(nextUsers);
    if (currentUser.id === userData.id) {
      setCurrentUser(userData);
      localStorage.setItem('moe_active_user', JSON.stringify(userData));
    }
    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'USER_ACCESS',
      action: isNew ? 'CREATE' : 'UPDATE',
      entityTitleAr: `${userData.fullNameAr} (${userData.badgeCode})`,
      entityTitleEn: `${userData.fullName} (${userData.badgeCode})`,
      summaryAr: `${isNew ? 'إضافة حساب مستخدم جديد' : 'تعديل صلاحيات حساب المستخدم'} "${userData.fullNameAr}" بدور (${userData.role}).`,
      summaryEn: `${isNew ? 'Created new user account' : 'Updated user account'} "${userData.fullName}" with role (${userData.role}).`,
      changes: [
        {
          field: 'role',
          labelAr: 'الدور الوظيفي والصلاحيات',
          labelEn: 'Role & Permissions',
          before: isNew ? '—' : 'سابق',
          after: `${userData.role} (${(userData.permissions || []).length} صلاحيات)`,
        },
      ],
    });
    showToast(
      'SUCCESS',
      isAr
        ? `تم حفظ بيانات وصلاحيات المستخدم "${userData.fullNameAr}" بنجاح.`
        : `Saved user account "${userData.fullName}" successfully.`
    );
  };

  const handleBulkUpdateUsers = async (nextUsers: UserAccount[]) => {
    setUsers(nextUsers);
    await DriftSqliteClientEngine.updateUsers(nextUsers);
    const updatedActive = nextUsers.find((u) => u.id === currentUser.id);
    if (updatedActive) {
      setCurrentUser(updatedActive);
      localStorage.setItem('moe_active_user', JSON.stringify(updatedActive));
    }
  };

  const handleToggleUserActive = async (targetUser: UserAccount) => {
    const nextActive = targetUser.isActive === false ? true : false;
    const updatedUser: UserAccount = {
      ...targetUser,
      isActive: nextActive,
    };
    const nextUsers = users.map((u) => (u.id === targetUser.id ? updatedUser : u));
    setUsers(nextUsers);
    await DriftSqliteClientEngine.updateUsers(nextUsers);

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'USER_ACCESS',
      action: nextActive ? 'ACTIVATE' : 'SUSPEND',
      entityTitleAr: `${targetUser.fullNameAr} (${targetUser.badgeCode})`,
      entityTitleEn: `${targetUser.fullName} (${targetUser.badgeCode})`,
      summaryAr: `${nextActive ? 'إعادة تنشيط حساب المستخدم' : 'إيقاف تنشيط حساب المستخدم'} "${targetUser.fullNameAr}" بقرار السوبر أدمن.`,
      summaryEn: `${nextActive ? 'Reactivated user account' : 'Suspended user account'} "${targetUser.fullName}".`,
      changes: [
        {
          field: 'isActive',
          labelAr: 'حالة الحساب',
          labelEn: 'Account Status',
          before: nextActive ? 'موقوف (Suspended)' : 'نشط (Active)',
          after: nextActive ? 'نشط (Active)' : 'موقوف (Suspended)',
        },
      ],
    });

    showToast(
      nextActive ? 'SUCCESS' : 'WARNING',
      isAr
        ? `${nextActive ? 'تمت إعادة تنشيط' : 'تم إيقاف تنشيط'} حساب "${targetUser.fullNameAr}".`
        : `${nextActive ? 'Reactivated' : 'Suspended'} account "${targetUser.fullName}".`
    );
  };

  const handleSaveWorkspace = async (wsData: WorkspaceEntity, isNew: boolean) => {
    const nextWorkspaces = isNew
      ? [wsData, ...workspaces]
      : workspaces.map((w) => (w.id === wsData.id ? wsData : w));
    setWorkspaces(nextWorkspaces);
    await DriftSqliteClientEngine.updateWorkspaces(nextWorkspaces);
    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'WORKSPACE_STATUS',
      action: isNew ? 'CREATE' : 'UPDATE',
      entityTitleAr: `${wsData.nameAr} (${wsData.code})`,
      entityTitleEn: `${wsData.name} (${wsData.code})`,
      summaryAr: `${isNew ? 'إنشاء مساحة عمل مخزنية جديدة' : 'تحديث بيانات مساحة العمل المخزنية'} "${wsData.nameAr}".`,
      summaryEn: `${isNew ? 'Created warehouse workspace' : 'Updated warehouse workspace'} "${wsData.name}".`,
      changes: [
        {
          field: 'workspace',
          labelAr: 'بيانات المساحة المخزنية',
          labelEn: 'Workspace Details',
          before: isNew ? '—' : wsData.code,
          after: `${wsData.nameAr} [السعة: ${wsData.capacityCopies.toLocaleString()}]`,
        },
      ],
    });
    showToast(
      'SUCCESS',
      isAr
        ? `تم حفظ المساحة المخزنية "${wsData.nameAr}" بنجاح.`
        : `Saved warehouse workspace "${wsData.name}".`
    );
  };

  const handleToggleWorkspaceActive = async (ws: WorkspaceEntity) => {
    const nextActive = !ws.isActive;
    const updatedWs: WorkspaceEntity = {
      ...ws,
      isActive: nextActive,
      updatedAt: new Date().toISOString(),
    };
    const nextWorkspaces = workspaces.map((w) => (w.id === ws.id ? updatedWs : w));
    setWorkspaces(nextWorkspaces);
    await DriftSqliteClientEngine.updateWorkspaces(nextWorkspaces);

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'WORKSPACE_STATUS',
      action: nextActive ? 'ACTIVATE' : 'SUSPEND',
      entityTitleAr: `${ws.nameAr} (${ws.code})`,
      entityTitleEn: `${ws.name} (${ws.code})`,
      summaryAr: `${nextActive ? 'إعادة تفعيل المساحة المخزنية' : 'إيقاف تنشيط المساحة المخزنية'} "${ws.nameAr}".`,
      summaryEn: `${nextActive ? 'Activated warehouse workspace' : 'Suspended warehouse workspace'} "${ws.name}".`,
      changes: [
        {
          field: 'isActive',
          labelAr: 'حالة المساحة المخزنية',
          labelEn: 'Workspace Status',
          before: nextActive ? 'موقوفة مؤقتاً (Suspended)' : 'نشطة (Active)',
          after: nextActive ? 'نشطة (Active)' : 'موقوفة مؤقتاً (Suspended)',
        },
      ],
    });

    showToast(
      nextActive ? 'SUCCESS' : 'WARNING',
      isAr
        ? `${nextActive ? 'تم تفعيل' : 'تم إيقاف تنشيط'} المساحة المخزنية "${ws.nameAr}".`
        : `${nextActive ? 'Activated' : 'Suspended'} workspace "${ws.name}".`
    );
  };

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    localStorage.setItem('moe_active_workspace_id', wsId);
    const target = workspaces.find((w) => w.id === wsId);
    if (target) {
      showToast(
        target.isActive ? 'SUCCESS' : 'WARNING',
        isAr
          ? `تم التبديل إلى مساحة العمل: ${target.nameAr} (${target.code})`
          : `Switched active workspace to: ${target.name} (${target.code})`
      );
    }
  };

  // Stocktaking & Damaged Quarantine Handlers
  const handleCreateStocktakingSession = async (session: StocktakingSession) => {
    const next = [session, ...stocktakingSessions];
    setStocktakingSessions(next);
    await DriftSqliteClientEngine.updateStocktakingSessions(next);
    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'STOCKTAKING_AUDIT',
      action: 'CREATE',
      entityTitleAr: `${session.titleAr} (${session.sessionCode})`,
      entityTitleEn: `${session.titleEn} (${session.sessionCode})`,
      summaryAr: `فتح جلسة جرد فعلي جديدة (${session.sessionCode}) تشمل ${session.lines.length} كتاب مدرسي.`,
      summaryEn: `Opened physical stocktaking session (${session.sessionCode}) covering ${session.lines.length} textbooks.`,
      changes: [
        {
          field: 'session',
          labelAr: 'جلسة الجرد المفتوحة',
          labelEn: 'Stocktaking Session',
          before: '—',
          after: `${session.titleAr} (${session.lines.length} أصناف)`,
        },
      ],
    });
    showToast(
      'SUCCESS',
      isAr
        ? `تم فتح جلسة الجرد "${session.titleAr}" بنجاح.`
        : `Created stocktaking session "${session.titleEn}".`
    );
  };

  const handleUpdateStocktakingSession = async (session: StocktakingSession) => {
    const next = stocktakingSessions.map((s) => (s.id === session.id ? session : s));
    setStocktakingSessions(next);
    await DriftSqliteClientEngine.updateStocktakingSessions(next);
  };

  const handleReconcileStocktakingSession = async (session: StocktakingSession) => {
    const nowIso = new Date().toISOString();
    const diffs: AuditFieldDiff[] = [];
    const updatedBooksList = books.map((b) => {
      const line = session.lines.find((it) => it.bookId === b.id);
      if (line && line.difference !== 0) {
        diffs.push({
          field: b.barcode,
          labelAr: b.titleAr,
          labelEn: b.title,
          before: b.currentStock.toLocaleString(),
          after: `${line.countedStock.toLocaleString()} (${line.difference > 0 ? '+' : ''}${line.difference})`,
        });
        return {
          ...b,
          currentStock: Math.max(0, line.countedStock),
          updatedAt: nowIso,
          isSynced: false,
        };
      }
      return b;
    });

    const reconciledSession: StocktakingSession = {
      ...session,
      status: 'RECONCILED',
      reconciledAt: nowIso,
    };

    const nextSessions = stocktakingSessions.map((s) =>
      s.id === session.id ? reconciledSession : s
    );

    setBooks(updatedBooksList);
    setStocktakingSessions(nextSessions);
    DriftSqliteClientEngine.saveLocalSnapshot({
      books: updatedBooksList,
      stocktakingSessions: nextSessions,
    });

    for (const b of updatedBooksList) {
      if (diffs.some((d) => d.field === b.barcode)) {
        await DriftSqliteClientEngine.upsertBook(b, isOfflineSimulated);
      }
    }

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'STOCKTAKING_AUDIT',
      action: 'RECONCILE',
      entityTitleAr: `اعتماد وتسوية محضر الجرد (${session.sessionCode})`,
      entityTitleEn: `Reconciled Stocktaking Session (${session.sessionCode})`,
      summaryAr: `تمت مطابقة وتسوية فروق الجرد الفعلي لعدد ${diffs.length} كتب مدرسية في الجلسة "${session.titleAr}".`,
      summaryEn: `Reconciled physical stock variances across ${diffs.length} textbooks in "${session.titleEn}".`,
      changes:
        diffs.length > 0
          ? diffs
          : [
              {
                field: 'reconcile',
                labelAr: 'نتيجة المطابقة',
                labelEn: 'Reconciliation Result',
                before: 'الرصيد الدفتري',
                after: 'مطابق 100% للعد الفعلي',
              },
            ],
    });

    showToast(
      'SUCCESS',
      isAr
        ? `تم اعتماد محضر الجرد (${session.sessionCode}) وتحديث أرصدة ${diffs.length} كتب في المخزن.`
        : `Reconciled session (${session.sessionCode}) and updated ${diffs.length} textbook balances.`
    );
  };

  const handleCreateDamagedRecord = async (
    recordInput: Omit<DamagedBookRecord, 'id' | 'recordCode' | 'createdAt'>,
    deductFromUsableStock: boolean
  ) => {
    const record: DamagedBookRecord = {
      ...recordInput,
      id: `dmg-${Date.now()}`,
      recordCode: `DMG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
      createdAt: new Date().toISOString(),
    };
    const nextRecords = [record, ...damagedRecords];
    setDamagedRecords(nextRecords);
    await DriftSqliteClientEngine.updateDamagedRecords(nextRecords);

    const targetBook = books.find((b) => b.id === record.bookId);
    if (deductFromUsableStock && targetBook) {
      const nextStock = Math.max(0, targetBook.currentStock - record.quantity);
      const updatedBook: BookItem = {
        ...targetBook,
        currentStock: nextStock,
        updatedAt: new Date().toISOString(),
        isSynced: false,
      };
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      await DriftSqliteClientEngine.upsertBook(updatedBook, isOfflineSimulated);
    }

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'STOCKTAKING_AUDIT',
      action: 'CREATE',
      entityTitleAr: `محضر عزل توالف/مرتجعات (${record.recordCode}) — ${record.bookTitleAr}`,
      entityTitleEn: `Quarantine Record (${record.recordCode}) — ${record.bookTitleEn}`,
      summaryAr: `تسجيل ${record.quantity.toLocaleString()} نسخة من "${record.bookTitleAr}" في سجل العزل (${
        deductFromUsableStock ? 'مع خصمها من الرصيد الصالح' : 'بدون خصم من الرصيد الصالح'
      }).`,
      summaryEn: `Logged ${record.quantity.toLocaleString()} copies of "${record.bookTitleEn}" in quarantine.`,
      changes: [
        {
          field: 'quarantineQty',
          labelAr: 'الكمية المعزولة',
          labelEn: 'Quarantined Quantity',
          before: targetBook ? targetBook.currentStock.toLocaleString() : '—',
          after: `${record.quantity.toLocaleString()} نسخة (${record.sourceEntityAr})`,
        },
      ],
    });

    showToast(
      'WARNING',
      isAr
        ? `تم تسجيل محضر العزل (${record.recordCode}) لعدد ${record.quantity} نسخة من "${record.bookTitleAr}".`
        : `Logged quarantine record (${record.recordCode}) for ${record.quantity} copies.`
    );
  };

  const handleResolveDamagedRecord = async (
    recordId: string,
    nextStatus: 'RESTORED_TO_STOCK' | 'WRITTEN_OFF'
  ) => {
    const target = damagedRecords.find((r) => r.id === recordId);
    if (!target) return;

    const updatedRecord: DamagedBookRecord = {
      ...target,
      status: nextStatus,
    };
    const nextRecords = damagedRecords.map((r) => (r.id === recordId ? updatedRecord : r));
    setDamagedRecords(nextRecords);
    await DriftSqliteClientEngine.updateDamagedRecords(nextRecords);

    if (nextStatus === 'RESTORED_TO_STOCK') {
      const book = books.find((b) => b.id === target.bookId);
      if (book) {
        const updatedBook: BookItem = {
          ...book,
          currentStock: book.currentStock + target.quantity,
          updatedAt: new Date().toISOString(),
          isSynced: false,
        };
        setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
        await DriftSqliteClientEngine.upsertBook(updatedBook, isOfflineSimulated);
      }
    }

    await handleRecordAudit({
      actorName: currentUser.fullName,
      actorNameAr: currentUser.fullNameAr,
      actorRole: currentUser.role,
      category: 'STOCKTAKING_AUDIT',
      action: 'UPDATE',
      entityTitleAr: `بت في محضر التوالف (${target.recordCode}) — ${target.bookTitleAr}`,
      entityTitleEn: `Resolved Quarantine Record (${target.recordCode}) — ${target.bookTitleEn}`,
      summaryAr:
        nextStatus === 'RESTORED_TO_STOCK'
          ? `إعادة ${target.quantity} نسخة سليمة من "${target.bookTitleAr}" إلى الرصيد القابل للصرف.`
          : `اعتماد إتلاف واستبعاد نهائي لعدد ${target.quantity} نسخة من "${target.bookTitleAr}".`,
      summaryEn:
        nextStatus === 'RESTORED_TO_STOCK'
          ? `Restored ${target.quantity} copies of "${target.bookTitleEn}" to usable stock.`
          : `Approved permanent write-off of ${target.quantity} damaged copies of "${target.bookTitleEn}".`,
      changes: [
        {
          field: 'status',
          labelAr: 'قرار اللجنة الفنية',
          labelEn: 'Resolution Decision',
          before: 'قيد العزل والفحص (QUARANTINED)',
          after:
            nextStatus === 'RESTORED_TO_STOCK'
              ? 'أعيد للرصيد الصالح (RESTORED_TO_STOCK)'
              : 'تم الإتلاف والاستبعاد (WRITTEN_OFF)',
        },
      ],
    });

    showToast(
      'SUCCESS',
      isAr
        ? nextStatus === 'RESTORED_TO_STOCK'
          ? `تمت إعادة ${target.quantity} نسخة إلى الرصيد الصالح بالمخزن.`
          : `تم اعتماد محضر الإتلاف النهائي للمحضر (${target.recordCode}).`
        : `Updated quarantine record (${target.recordCode}).`
    );
  };

  // Full JSON Database Backup & Restore
  const handleExportFullBackup = () => {
    const snap = DriftSqliteClientEngine.loadLocalSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moe-warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      'SUCCESS',
      isAr
        ? 'تم تصدير النسخة الاحتياطية الكاملة لقاعدة البيانات (JSON) بنجاح.'
        : 'Exported full database JSON backup successfully.'
    );
  };

  const handleImportFullBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || !Array.isArray(parsed.books)) {
          throw new Error('Invalid backup structure');
        }
        DriftSqliteClientEngine.saveLocalSnapshot(parsed);
        setBooks(parsed.books);
        if (parsed.schools) setSchools(parsed.schools);
        if (parsed.transactions) setTransactions(parsed.transactions);
        if (parsed.syncLogs) setSyncLogs(parsed.syncLogs);
        if (parsed.syncConfig) setSyncConfig(parsed.syncConfig);
        if (parsed.formConfig) setFormConfig(parsed.formConfig);
        if (parsed.auditLogs) setAuditLogs(parsed.auditLogs);
        if (parsed.users) setUsers(parsed.users);
        if (parsed.workspaces) setWorkspaces(parsed.workspaces);
        if (parsed.stocktakingSessions) setStocktakingSessions(parsed.stocktakingSessions);
        if (parsed.damagedRecords) setDamagedRecords(parsed.damagedRecords);
        showToast(
          'SUCCESS',
          isAr
            ? 'تمت استعادة النسخة الاحتياطية وتحديث جميع الجداول المحلية بنجاح!'
            : 'Restored full database backup successfully!'
        );
      } catch {
        showToast(
          'ERROR',
          isAr
            ? 'ملف النسخة الاحتياطية غير صالح. تأكد من اختيار ملف JSON صحيح.'
            : 'Invalid backup JSON file.'
        );
      }
    };
    reader.readAsText(file);
  };

  const openTransactionForBook = (type: TransactionType, bookId?: string) => {
    if (!isWorkspaceActive) {
      showToast(
        'WARNING',
        isAr
          ? `المساحة المخزنية الحالية (${activeWorkspace?.nameAr}) موقوفة مؤقتاً بقرار السوبر أدمن.`
          : `Active workspace (${activeWorkspace?.name}) is currently suspended by Super Admin.`
      );
      return;
    }
    if (!canEditInventory) {
      showToast(
        'WARNING',
        isAr
          ? 'حساب المراجع الداخلي (Auditor) مخصص للقراءة والتدقيق فقط. قم بالتبديل إلى دور أمين المخزن أو السوبر أدمن لإجراء حركات.'
          : 'Auditor role is read-only. Switch to Storekeeper, Admin, or Super Admin to record inventory transactions.'
      );
      return;
    }
    setTxModalInitialType(type);
    setTxPreselectedBookId(bookId);
    setTxModalOpen(true);
  };

  const openBulkAdjustmentModal = () => {
    if (!canEditInventory) {
      showToast(
        'WARNING',
        isAr
          ? 'حساب المراجع الداخلي (Auditor) مخصص للقراءة فقط. قم بالتبديل إلى دور أمين المخزن أو السوبر أدمن لتنفيذ تسوية جماعية.'
          : 'Auditor role is read-only. Switch to Storekeeper or Super Admin to perform bulk stock adjustments.'
      );
      return;
    }
    setBulkModalOpen(true);
  };

  const openBarcodePrintStudio = (customBooks?: BookItem[]) => {
    if (customBooks && customBooks.length > 0) {
      setBooksForBarcodePrint(customBooks);
    } else if (selectedCatalogBookIds.length > 0) {
      const selected = books.filter((b) => selectedCatalogBookIds.includes(b.id));
      setBooksForBarcodePrint(selected);
    } else {
      setBooksForBarcodePrint(filteredBooks.slice(0, 6));
    }
    setBarcodePrintModalOpen(true);
  };

  const handleFilterByScannedBarcode = (barcode: string) => {
    if (activeSection === 'TRANSACTIONS') {
      setTxSearch(barcode);
      setTxTypeFilter('ALL');
      setTxSyncFilter('ALL');
    } else {
      setActiveSection('CATALOG');
      setBookSearch(barcode);
      setStageFilter('ALL');
      setYearFilter('ALL');
      setStockFilter('ALL');
    }
    showToast(
      'SUCCESS',
      isAr
        ? `تمت التصفية حسب الباركود الممسوح: ${barcode}`
        : `Filtered records by scanned barcode: ${barcode}`
    );
  };

  const toggleCatalogRowSelection = (bookId: string) => {
    setSelectedCatalogBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const toggleSelectAllFilteredCatalog = () => {
    if (selectedCatalogBookIds.length === filteredBooks.length) {
      setSelectedCatalogBookIds([]);
    } else {
      setSelectedCatalogBookIds(filteredBooks.map((b) => b.id));
    }
  };

  const getStageLabel = (stage: EducationalStage) => {
    if (stage === 'PRIMARY') return isAr ? 'الابتدائية' : 'Primary';
    if (stage === 'PREPARATORY') return isAr ? 'الإعدادية' : 'Preparatory';
    return isAr ? 'الثانوية' : 'Secondary';
  };

  const getUnitTypeLabel = (unitType?: BookItem['unitType']) => {
    switch (unitType) {
      case 'Dozen':
        return isAr ? 'درزن (Dozen)' : 'Dozen (درزن)';
      case 'Bundle':
        return isAr ? 'شدة (Bundle)' : 'Bundle (شدة)';
      case 'Unit':
      default:
        return isAr ? 'كتاب (Unit)' : 'Unit (كتاب)';
    }
  };

  const getSubTypeLabel = (subType: InventoryTransaction['subType']) => {
    switch (subType) {
      case 'PURCHASE_INVOICE':
        return isAr ? 'فاتورة مشتريات / مطابع' : 'Purchase Invoice';
      case 'MANUAL_ENTRY':
        return isAr ? 'إضافة يدوية' : 'Manual Entry';
      case 'SCHOOL_RETURN':
        return isAr ? 'مرتجع فائض من مدرسة' : 'School Surplus Return';
      case 'SCHOOL_DISTRIBUTION':
        return isAr ? 'توزيع مدرسي' : 'School Distribution';
      case 'DISPENSING':
        return isAr ? 'صرف مباشر' : 'Direct Dispensing';
      case 'SUPPLIER_RETURN':
        return isAr ? 'مرتجع معيب للمطبعة' : 'Return to Supplier';
      case 'WAREHOUSE_TRANSFER':
        return isAr ? 'تحويل مخزني بين المستودعات' : 'Warehouse Transfer';
    }
  };

  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / txPageSize));
  const safeTxPage = Math.min(txPage, totalTxPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safeTxPage - 1) * txPageSize,
    safeTxPage * txPageSize
  );

  const quarantinedCount = damagedRecords
    .filter((r) => r.status === 'QUARANTINED')
    .reduce((acc, r) => acc + r.quantity, 0);

  const navItems: {
    id: ActiveSection;
    labelAr: string;
    labelEn: string;
    shortAr: string;
    shortEn: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[] = [
    {
      id: 'DASHBOARD',
      labelAr: 'لوحة المتابعة المخزنية',
      labelEn: 'Warehouse Overview',
      shortAr: 'الرئيسية',
      shortEn: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'CATALOG',
      labelAr: 'دليل الكتب المدرسية',
      labelEn: 'Books Catalog',
      shortAr: 'دليل الكتب',
      shortEn: 'Catalog',
      icon: BookOpen,
      count: books.length,
    },
    {
      id: 'TRANSACTIONS',
      labelAr: 'حركات التوريد والصرف',
      labelEn: 'Transactions Ledger',
      shortAr: 'الحركات',
      shortEn: 'Movements',
      icon: ArrowLeftRight,
      count: transactions.length,
    },
    {
      id: 'STOCKTAKING',
      labelAr: 'الجرد الفعلي والتوالف',
      labelEn: 'Stocktaking & Damaged',
      shortAr: 'الجرد والتوالف',
      shortEn: 'Audit & Damaged',
      icon: ClipboardCheck,
      count: stocktakingSessions.length + damagedRecords.length,
    },
    {
      id: 'SUPER_ADMIN',
      labelAr: 'السوبر أدمن والمستخدمين',
      labelEn: 'Super Admin & Users',
      shortAr: 'السوبر أدمن',
      shortEn: 'Super Admin',
      icon: Crown,
      count: users.length,
    },
    {
      id: 'CONFIG',
      labelAr: 'تهيئة المدخلات والأتمتة',
      labelEn: 'Form & Lookup Config',
      shortAr: 'التهيئة',
      shortEn: 'Config',
      icon: Sliders,
      count: formConfig.subjects.length + schools.length,
    },
    {
      id: 'SYNC',
      labelAr: 'المزامنة و Drift SQLite',
      labelEn: 'Offline & Sheets Sync',
      shortAr: 'المزامنة',
      shortEn: 'Sync',
      icon: CloudUpload,
      count: stats.unsyncedCount,
    },
  ];

  // Dynamic Role & User Tab Visibility Calculation
  const allowedTabsForCurrentUser: AppTabKey[] = useMemo(() => {
    const matrix = formConfig.roleTabMatrix || DEFAULT_ROLE_TAB_MATRIX;
    const roleDefault = matrix[currentUser.role] || DEFAULT_ROLE_TAB_MATRIX[currentUser.role] || ['DASHBOARD'];
    if (currentUser.allowedTabs && currentUser.allowedTabs.length > 0) {
      return currentUser.allowedTabs;
    }
    return roleDefault;
  }, [currentUser, formConfig.roleTabMatrix]);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => allowedTabsForCurrentUser.includes(item.id)),
    [navItems, allowedTabsForCurrentUser]
  );

  // Automatic Redirect & Programmatic Guard when switching to a role/user that cannot access the open tab
  useEffect(() => {
    if (!allowedTabsForCurrentUser.includes(activeSection)) {
      const fallbackTab = allowedTabsForCurrentUser[0] || 'DASHBOARD';
      setActiveSection(fallbackTab);
      showToast(
        'WARNING',
        isAr
          ? `تم إخفاء التبويبة السابقة لأنها غير مخصصة لدورك الوظيفي الحالي (${currentUser.role})، وتم تحويلك تلقائياً إلى لوحة المتابعة الرئيسية.`
          : `The previous tab is hidden for your current role (${currentUser.role}). Automatically redirected to the main dashboard.`
      );
    }
  }, [activeSection, allowedTabsForCurrentUser, currentUser.role, isAr, showToast]);

  const activeNavObj = visibleNavItems.find((n) => n.id === activeSection) || visibleNavItems[0] || navItems[0];

  return (
    <div
      className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Collapsible Sidebar Navigation */}
      <aside
        className={`fixed lg:static inset-y-0 start-0 z-40 flex flex-col bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 transition-transform duration-150 no-print ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'
        } ${
          mobileMenuOpen
            ? 'translate-x-0 w-64'
            : isAr
            ? 'translate-x-full lg:translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-[#006F88] text-white flex items-center justify-center font-bold text-sm shrink-0">
              MOE
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 block truncate">
                  {isAr ? 'مخازن الكتب المدرسية' : 'Textbook Inventory'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  {isAr ? 'نظام Drift SQLite المحلي' : 'Offline-First SQLite ERP'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isAr ? 'طي / توسيع القائمة' : 'Collapse / Expand Sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links (Filtered by Role & User Allowed Tabs) */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#006F88] text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{isAr ? item.labelAr : item.labelEn}</span>
                  )}
                </div>
                {!sidebarCollapsed && item.count !== undefined && (
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      isActive ? 'text-white/90' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active User & Role Card in Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-[#006F88] transition-colors flex items-center justify-between gap-2 text-start cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#006F88]/15 text-[#006F88] dark:text-cyan-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {isAr ? currentUser.fullNameAr : currentUser.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {currentUser.role} · {isAr ? 'تبديل الدور' : 'Switch Role'}
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb Trail on Start + Primary Actions on End */}
        <header className="h-16 px-3 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-6 no-print sticky top-0 z-30">
          {/* Zone 1: Mobile Menu Trigger + Contextual Breadcrumb Trail */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <button
                type="button"
                onClick={() => setActiveSection('SUPER_ADMIN')}
                className="hidden sm:inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 hover:text-[#006F88] whitespace-nowrap cursor-pointer"
                title={isAr ? 'تبديل أو إدارة المساحة المخزنية' : 'Switch or manage warehouse workspace'}
              >
                <Building2 className="w-3.5 h-3.5 text-[#006F88]" />
                <span>
                  {activeWorkspace
                    ? isAr
                      ? `${activeWorkspace.nameAr} (${activeWorkspace.code})`
                      : `${activeWorkspace.name} (${activeWorkspace.code})`
                    : isAr
                    ? 'المخزن المركزي (WH-01)'
                    : 'Central Warehouse (WH-01)'}
                </span>
                {!isWorkspaceActive && (
                  <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 font-bold">
                    {isAr ? 'موقوف' : 'Suspended'}
                  </span>
                )}
              </button>
              <span className="hidden sm:inline">
                {isAr ? (
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                )}
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap truncate">
                {isAr ? activeNavObj.labelAr : activeNavObj.labelEn}
              </span>
            </nav>
          </div>

          {/* Zone 2: Real-Time Connectivity, PWA Hub, Role Switcher, Theme/Lang & Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Offline / Online Real-time Toggle Indicator */}
            <button
              type="button"
              onClick={() => handleToggleOffline(!isOfflineSimulated)}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isOfflineSimulated || !pwa.isOnline
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isAr ? 'انقر لمحاكاة وضع العمل بدون إنترنت' : 'Click to toggle Offline-First simulation'}
            >
              {isOfflineSimulated || !pwa.isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isAr ? 'وضع محلي (Offline)' : 'Offline Mode'}</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {stats.unsyncedCount > 0
                      ? isAr
                        ? `متصل (${stats.unsyncedCount} محلي)`
                        : `Online (${stats.unsyncedCount})`
                      : isAr
                      ? 'متصل ومتزامن'
                      : 'Synced'}
                  </span>
                </>
              )}
            </button>

            {/* In-App PWA Install & Mobile Sensors Hub Button */}
            <button
              type="button"
              onClick={() => setPwaModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#006F88]/10 text-[#006F88] dark:text-cyan-300 hover:bg-[#006F88]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={isAr ? 'تثبيت التطبيق PWA وإدارة التخزين الدائم والحساسات' : 'Install PWA & Manage Device Storage/Sensors'}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {pwa.isInstalled
                  ? isAr
                    ? 'PWA مفعل'
                    : 'PWA Active'
                  : isAr
                  ? 'تثبيت PWA'
                  : 'Install PWA'}
              </span>
            </button>

            {/* Quick Role Selector Button */}
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUser.role === 'SUPER_ADMIN' ? (
                <Crown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-[#006F88] dark:text-cyan-400" />
              )}
              <span className="font-mono text-[11px] sm:text-xs">{currentUser.role}</span>
            </button>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="p-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              title="Switch Language / تغيير اللغة"
            >
              <Languages className="w-4 h-4" />
              <span className="hidden xl:inline">{isAr ? 'EN' : 'عربي'}</span>
            </button>

            {/* Dark/Light Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title={isAr ? 'تبديل المظهر الفاتح / الداكن' : 'Toggle Dark / Light Theme'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Primary CTA Button */}
            {canEditInventory && (
              <button
                type="button"
                onClick={() => openTransactionForBook('OUTBOUND')}
                className="px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {isAr ? 'إذن صرف مدرسي جديد' : 'New Outbound Dispense'}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Workspace Content Container (pb-24 on mobile/tablet so Bottom Nav Bar never overlaps content) */}
        <main
          className={`flex-1 p-3 sm:p-6 pb-24 lg:pb-6 max-w-[1440px] w-full mx-auto space-y-5 sm:space-y-6 ${
            barcodePrintModalOpen || pdfModalOpen ? 'no-print' : ''
          }`}
        >
          {/* Feedback Banner */}
          {banner && (
            <div
              className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${
                banner.type === 'ERROR'
                  ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
                  : banner.type === 'WARNING'
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {banner.type === 'ERROR' || banner.type === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span className="font-medium">{banner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="p-1 hover:opacity-75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Auditor Read-Only Notice */}
          {currentUser.role === 'AUDITOR' && (
            <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-700 dark:text-slate-300">
              <span>
                {isAr
                  ? 'أنت تتصفح النظام بصلاحية "المراجع الداخلي (Auditor)" — وضع الفحص والتدقيق واستخراج التقارير الرسمية فقط.'
                  : 'Active Role: Internal Auditor (Read-Only Inspection & Report Export Mode).'}
              </span>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="text-[#006F88] dark:text-cyan-400 font-semibold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAr ? 'التبديل إلى أمين المخزن / المدير' : 'Switch Role to Edit'}
              </button>
            </div>
          )}

          {/* Quick Action Stats Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1: Total Books & Physical Copies */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{isAr ? 'إجمالي النسخ الفعلية بالمخزن' : 'Total Physical Copies in Stock'}</span>
                <BookOpen className="w-4 h-4 text-[#006F88]" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {stats.totalPhysicalCopies.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.totalTitles} {isAr ? 'عنوان كتاب مدرسي مسجل بالدليل' : 'catalog textbook titles'}
                </div>
              </div>
            </div>

            {/* Stat 2: Low Stock Alerts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{isAr ? 'تنبيهات النواقص (تحت الحد الأدنى)' : 'Low Stock Alerts'}</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                    {stats.lowStockCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {isAr ? 'أصناف تحتاج أمر توريد عاجل' : 'titles require replenishment'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStockFilter('LOW_STOCK');
                    setActiveSection('CATALOG');
                  }}
                  className="text-xs font-semibold text-[#006F88] dark:text-cyan-400 hover:underline whitespace-nowrap cursor-pointer"
                >
                  {isAr ? 'عرض النواقص' : 'Inspect'}
                </button>
              </div>
            </div>

            {/* Stat 3: Today's Transactions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{isAr ? 'حركات اليوم (توريد وصرف)' : "Today's Transactions"}</span>
                <ArrowLeftRight className="w-4 h-4 text-[#006F88]" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  {stats.todaysTransactionsCount}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{stats.todayInboundQty.toLocaleString()}
                  </span>
                  {' · '}
                  <span className="text-amber-600 dark:text-amber-400">
                    -{stats.todayOutboundQty.toLocaleString()}
                  </span>{' '}
                  {isAr ? 'نسخة اليوم' : 'today'}
                </div>
              </div>
            </div>

            {/* Stat 4: Offline Sync Queue & Google Sheets Status */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{isAr ? 'مزامنة Google Sheets (isSynced)' : 'Google Sheets Sync Queue'}</span>
                <CloudUpload className="w-4 h-4 text-[#006F88]" />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                    {stats.unsyncedCount === 0 ? (isAr ? 'متزامن' : 'Synced') : stats.unsyncedCount}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stats.unsyncedCount === 0
                      ? isAr
                        ? 'جميع الحركات مرفوعة'
                        : '0 pending records'
                      : isAr
                      ? 'سجلات محلية بانتظار المزامنة'
                      : 'offline records pending push'}
                  </div>
                </div>
                {stats.unsyncedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSyncNow()}
                    className="text-xs font-semibold text-[#006F88] dark:text-cyan-400 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    {isAr ? 'مزامنة الآن' : 'Sync Now'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((row) => (
                <div
                  key={row}
                  className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              {/* VIEW 1: DASHBOARD OVERVIEW */}
              {activeSection === 'DASHBOARD' && (
                <div className="space-y-6">
                  {/* Action Toolbar & Quick Operations */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {isAr
                          ? 'العمليات المخزنية السريعة والتقارير المعتمدة'
                          : 'Warehouse Quick Actions & Official Reports'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {isAr
                          ? 'سجل فواتير التوريد أو الصرف المدرسي، أو امسح باركود كتاب بالكاميرا، أو نفذ تسوية جماعية لعدة كتب'
                          : 'Record inbound/outbound stock, scan QR/barcodes via camera, or execute bulk multi-book adjustments'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setScannerModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ScanBarcode className="w-4 h-4" />
                        <span>{isAr ? 'مسح باركود / QR بالكاميرا' : 'Scan QR / Barcode'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openBarcodePrintStudio()}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-[#006F88]" />
                        <span>{isAr ? 'طباعة ملصقات الباركود' : 'Print Barcode Labels'}</span>
                      </button>

                      {canEditInventory && (
                        <>
                          <button
                            type="button"
                            onClick={openBulkAdjustmentModal}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Layers className="w-4 h-4 text-[#006F88]" />
                            <span>{isAr ? 'تسوية جماعية (Bulk)' : 'Bulk Adjustment'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openTransactionForBook('INBOUND')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <ArrowDownLeft className="w-4 h-4" />
                            <span>{isAr ? 'توريد مخزني (+)' : 'Inbound (+)'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openTransactionForBook('OUTBOUND')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            <span>{isAr ? 'صرف مدرسي (-)' : 'Outbound (-)'}</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => exportBooksToCSV(books, lang)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPdfReportType('CATALOG');
                          setPdfModalOpen(true);
                        }}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#006F88]" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* 30-Day Inventory Turnover Trends Chart (Recharts LineChart) */}
                  <InventoryTurnoverChart
                    transactions={transactions}
                    lang={lang}
                    darkMode={darkMode}
                  />

                  {/* Two-Column Split: Low Stock Alert Watchlist + Recent Transactions Ledger */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Low Stock Alerts Table */}
                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {isAr
                                ? 'تنبيهات الأرصدة الحرجة والنواقص'
                                : 'Low Stock Replenishment Alerts'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {isAr
                                ? 'الكتب التي وصل رصيدها الفعلي إلى الحد الأدنى أو أقل'
                                : 'Textbooks at or below minimum stock threshold'}
                            </p>
                          </div>
                          {canEditInventory && stats.lowStockBooks.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatalogBookIds(stats.lowStockBooks.map((b) => b.id));
                                setBulkModalOpen(true);
                              }}
                              className="text-xs font-semibold text-[#006F88] dark:text-cyan-400 hover:underline whitespace-nowrap cursor-pointer"
                            >
                              {isAr ? 'توريد جماعي للنواقص' : 'Bulk Restock All'}
                            </button>
                          )}
                        </div>

                        {stats.lowStockBooks.length === 0 ? (
                          <div className="p-8 text-center text-xs text-slate-500">
                            {isAr
                              ? 'جميع أرصدة الكتب المدرسية فوق الحد الأدنى الآمن.'
                              : 'All textbook stock levels are above minimum thresholds.'}
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-200 dark:divide-slate-800">
                            {stats.lowStockBooks.map((b) => (
                              <div
                                key={b.id}
                                className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {isAr ? b.titleAr : b.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    <span className="font-mono">{b.barcode}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span>{isAr ? b.gradeAr : b.grade}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span className="font-mono">{b.academicYear}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-end font-mono tabular-nums">
                                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                      {b.currentStock.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {isAr ? 'حد:' : 'min:'} {b.minStockLevel.toLocaleString()}
                                    </div>
                                  </div>

                                  {canEditInventory && (
                                    <button
                                      type="button"
                                      onClick={() => openTransactionForBook('INBOUND', b.id)}
                                      className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                                    >
                                      {isAr ? '+ توريد' : '+ Restock'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isAr ? 'المدارس المسجلة بمنظومة التوزيع:' : 'Registered Beneficiary Schools:'}{' '}
                          <strong className="font-mono text-slate-800 dark:text-slate-200">{schools.length}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSection('CATALOG')}
                          className="font-semibold text-[#006F88] dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          {isAr ? 'استعراض الدليل الكامل ←' : 'View Full Catalog →'}
                        </button>
                      </div>
                    </div>

                    {/* Recent Transactions Ledger */}
                    <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {isAr
                                ? 'أحدث الحركات المخزنية (توريد وصرف المدارس)'
                                : 'Recent Inventory Movements (Inbound & Outbound)'}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {isAr
                                ? 'دفتر الأستاذ الفوري مع حالة المزامنة السحابية (isSynced)'
                                : 'Live ledger tracking stock before/after and Google Sheets sync status'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveSection('TRANSACTIONS')}
                            className="text-xs font-medium text-[#006F88] dark:text-cyan-400 hover:underline whitespace-nowrap cursor-pointer"
                          >
                            {isAr ? 'كل الحركات' : 'All Transactions'}
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-950/60">
                                <th className="px-4 py-2.5 text-start font-medium">{isAr ? 'رقم الحركة' : 'Code'}</th>
                                <th className="px-4 py-2.5 text-start font-medium">{isAr ? 'الكتاب والجهة' : 'Textbook & Entity'}</th>
                                <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'الكمية' : 'Quantity'}</th>
                                <th className="px-4 py-2.5 text-end font-medium">{isAr ? 'الرصيد بعد' : 'Stock After'}</th>
                                <th className="px-4 py-2.5 text-start font-medium">{isAr ? 'المزامنة' : 'Sync'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {transactions.slice(0, 6).map((t) => (
                                <tr
                                  key={t.id}
                                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {t.transactionCode}
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      {new Date(t.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                      {isAr ? t.bookTitleAr : t.bookTitle}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {getSubTypeLabel(t.subType)} ·{' '}
                                      {isAr ? t.counterpartyNameAr : t.counterpartyName}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-end font-mono tabular-nums font-bold whitespace-nowrap">
                                    <span
                                      className={
                                        t.type === 'INBOUND'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-amber-600 dark:text-amber-400'
                                      }
                                    >
                                      {t.type === 'INBOUND'
                                        ? `+${t.quantity.toLocaleString()}`
                                        : `-${t.quantity.toLocaleString()}`}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-end font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {t.stockAfter.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {t.isSynced ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>{isAr ? 'متزامن' : 'Synced'}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px]">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>{isAr ? 'محلي' : 'Queued'}</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isAr
                            ? 'يتم منع الصرف بالسالب تلقائياً عبر قيود قاعدة البيانات.'
                            : 'Negative stock is strictly prevented by atomic SQLite validation.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveSection('SYNC')}
                          className="font-semibold text-[#006F88] dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          {isAr ? 'إعدادات المزامنة و Google Sheets ←' : 'Configure Sheets Sync →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: BOOKS CATALOG (Full CRUD + Camera Barcode Scanner + Multi-Select Bulk Adjustment) */}
              {activeSection === 'CATALOG' && (
                <div className="space-y-4">
                  {/* Filter & Actions Bar */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Search Input + Camera QR/Barcode Scanner Button */}
                      <div className="flex items-center gap-2 flex-1 max-w-xl">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                          <input
                            type="text"
                            value={bookSearch}
                            onChange={(e) => setBookSearch(e.target.value)}
                            placeholder={
                              isAr
                                ? 'ابحث بعنوان الكتاب، الباركود، المادة، أو الصف...'
                                : 'Search by textbook title, barcode, subject, or grade...'
                            }
                            className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setScannerModalOpen(true)}
                          className="px-3.5 py-2 text-xs font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          title={isAr ? 'مسح الباركود أو QR بالكاميرا' : 'Scan QR or Barcode using camera'}
                        >
                          <ScanBarcode className="w-4 h-4" />
                          <span>{isAr ? 'مسح باركود / QR' : 'Scan Barcode'}</span>
                        </button>
                      </div>

                      {/* Export, Print Barcodes, Bulk Adjustment & Add Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openBarcodePrintStudio()}
                          className="px-3.5 py-2 text-xs font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          title={
                            isAr
                              ? 'طباعة ملصقات الباركود للكتب (الاسم وسنة الكتاب والباركود بالأسفل)'
                              : 'Print textbook barcode labels (Title, Year, and Barcode below)'
                          }
                        >
                          <Printer className="w-4 h-4" />
                          <span>
                            {selectedCatalogBookIds.length > 0
                              ? isAr
                                ? `طباعة الباركود (${selectedCatalogBookIds.length} محدد)`
                                : `Print Barcodes (${selectedCatalogBookIds.length})`
                              : isAr
                              ? 'طباعة ملصقات الباركود'
                              : 'Print Barcodes'}
                          </span>
                        </button>

                        {canEditInventory && (
                          <button
                            type="button"
                            onClick={openBulkAdjustmentModal}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Layers className="w-4 h-4 text-[#006F88]" />
                            <span>
                              {selectedCatalogBookIds.length > 0
                                ? isAr
                                  ? `تسوية جماعية (${selectedCatalogBookIds.length} محدد)`
                                  : `Bulk Adjust (${selectedCatalogBookIds.length} Selected)`
                                : isAr
                                ? 'تسوية جماعية (Bulk)'
                                : 'Bulk Adjustment'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => exportBooksToCSV(filteredBooks, lang)}
                          className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPdfReportType(stockFilter === 'LOW_STOCK' ? 'LOW_STOCK' : 'CATALOG');
                            setPdfModalOpen(true);
                          }}
                          className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#006F88]" />
                          <span>PDF</span>
                        </button>

                        {canEditInventory && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBook(null);
                              setBookModalOpen(true);
                            }}
                            className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{isAr ? 'إضافة كتاب جديد للدليل' : 'Add Textbook'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Segmented Filter Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      {/* Stage Segmented Filter */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                        {(
                          [
                            { id: 'ALL', ar: 'كل المراحل', en: 'All Stages' },
                            { id: 'PRIMARY', ar: 'الابتدائية', en: 'Primary' },
                            { id: 'PREPARATORY', ar: 'الإعدادية', en: 'Preparatory' },
                            { id: 'SECONDARY', ar: 'الثانوية', en: 'Secondary' },
                          ] as const
                        ).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setStageFilter(st.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              stageFilter === st.id
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            {isAr ? st.ar : st.en}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Stock Health Segmented Control */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setStockFilter('ALL')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              stockFilter === 'ALL'
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isAr ? 'الكل' : 'All Stock'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockFilter('LOW_STOCK')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              stockFilter === 'LOW_STOCK'
                                ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isAr ? `النواقص (${stats.lowStockCount})` : `Low Stock (${stats.lowStockCount})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setStockFilter('OPTIMAL')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                              stockFilter === 'OPTIMAL'
                                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isAr ? 'رصيد آمن' : 'Optimal'}
                          </button>
                        </div>

                        {/* Academic Year Filter */}
                        <select
                          value={yearFilter}
                          onChange={(e) => setYearFilter(e.target.value)}
                          className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                        >
                          <option value="ALL">{isAr ? 'كل الأعوام الدراسية' : 'All Academic Years'}</option>
                          {formConfig.academicYears.map((yr) => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Books Catalog Data Grid */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {filteredBooks.length === 0 ? (
                      <div className="p-12 text-center space-y-3">
                        <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {isAr
                            ? 'لا توجد كتب مدرسية مطابقة لمعايير البحث أو التصفية'
                            : 'No textbooks match the current filter criteria'}
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setBookSearch('');
                              setStageFilter('ALL');
                              setYearFilter('ALL');
                              setStockFilter('ALL');
                            }}
                            className="px-3.5 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer"
                          >
                            {isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                              {canEditInventory && (
                                <th className="px-3.5 py-3 text-start w-10">
                                  <button
                                    type="button"
                                    onClick={toggleSelectAllFilteredCatalog}
                                    className="text-slate-500 hover:text-[#006F88] cursor-pointer"
                                    title={isAr ? 'تحديد الكل للتسوية الجماعية' : 'Select all for bulk adjustment'}
                                  >
                                    {selectedCatalogBookIds.length === filteredBooks.length &&
                                    filteredBooks.length > 0 ? (
                                      <CheckSquare className="w-4 h-4 text-[#006F88]" />
                                    ) : (
                                      <Square className="w-4 h-4" />
                                    )}
                                  </button>
                                </th>
                              )}
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'كود الباركود' : 'Barcode'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'عنوان الكتاب والمادة' : 'Textbook Title & Subject'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'المرحلة والصف والعام' : 'Stage · Grade · Year'}</th>
                              <th className="px-4 py-3 text-end font-medium">{isAr ? 'الرصيد الفعلي' : 'Current Stock'}</th>
                              <th className="px-4 py-3 text-end font-medium">{isAr ? 'الحد الأدنى' : 'Min Level'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'الحالة والمزامنة' : 'Health & Sync'}</th>
                              <th className="px-4 py-3 text-end font-medium">{isAr ? 'إجراءات سريعة' : 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredBooks.map((b) => {
                              const isLow = b.currentStock <= b.minStockLevel;
                              const isChecked = selectedCatalogBookIds.includes(b.id);
                              return (
                                <tr
                                  key={b.id}
                                  className={`transition-colors ${
                                    isChecked
                                      ? 'bg-[#006F88]/5 dark:bg-[#006F88]/15'
                                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  {canEditInventory && (
                                    <td className="px-3.5 py-3">
                                      <button
                                        type="button"
                                        onClick={() => toggleCatalogRowSelection(b.id)}
                                        className="text-slate-400 hover:text-[#006F88] cursor-pointer"
                                      >
                                        {isChecked ? (
                                          <CheckSquare className="w-4 h-4 text-[#006F88]" />
                                        ) : (
                                          <Square className="w-4 h-4" />
                                        )}
                                      </button>
                                    </td>
                                  )}
                                  <td className="px-4 py-3 font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {b.barcode}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                                      {isAr ? b.titleAr : b.title}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {isAr ? b.subjectAr : b.subject}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                    <span>{getStageLabel(b.stage)}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span>{isAr ? b.gradeAr : b.grade}</span>
                                    <span aria-hidden="true"> · </span>
                                    <span className="font-mono tabular-nums">{b.academicYear}</span>
                                  </td>
                                  <td className="px-4 py-3 text-end font-mono tabular-nums font-bold text-sm whitespace-nowrap">
                                    <span
                                      className={
                                        isLow
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-slate-900 dark:text-slate-100'
                                      }
                                    >
                                      {b.currentStock.toLocaleString()}
                                    </span>
                                    <div className="text-[10px] font-sans font-normal text-slate-500 dark:text-slate-400">
                                      {getUnitTypeLabel(b.unitType)}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-end font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                    {b.minStockLevel.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center gap-2 text-[11px]">
                                      {isLow ? (
                                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                          <span>{isAr ? 'رصيد منخفض' : 'Low Stock'}</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>{isAr ? 'آمن' : 'Optimal'}</span>
                                        </span>
                                      )}
                                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                                        ·
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400 font-mono">
                                        {b.isSynced ? (isAr ? 'متزامن' : 'Synced') : isAr ? 'محلي' : 'Pending'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-end whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => openBarcodePrintStudio([b])}
                                        title={
                                          isAr
                                            ? 'طباعة ملصق باركود هذا الكتاب'
                                            : 'Print Barcode Label for this Book'
                                        }
                                        className="p-1.5 text-[#006F88] dark:text-cyan-400 hover:bg-[#006F88]/10 rounded transition-colors cursor-pointer"
                                      >
                                        <Printer className="w-3.5 h-3.5" />
                                      </button>
                                      {canEditInventory && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => openTransactionForBook('INBOUND', b.id)}
                                            title={isAr ? 'إضافة توريد لهذا الكتاب' : 'Inbound Stock (+)'}
                                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                                          >
                                            {isAr ? '+ توريد' : '+ In'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => openTransactionForBook('OUTBOUND', b.id)}
                                            title={isAr ? 'صرف مدرسي من هذا الكتاب' : 'Outbound Dispense (-)'}
                                            className="px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                          >
                                            {isAr ? '- صرف' : '- Out'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingBook(b);
                                              setBookModalOpen(true);
                                            }}
                                            title={isAr ? 'تعديل بيانات الكتاب' : 'Edit Book'}
                                            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                      {canDeleteCatalog && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBook(b)}
                                          title={isAr ? 'حذف الكتاب' : 'Delete Book'}
                                          className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: TRANSACTIONS LEDGER (Inbound & Outbound Movements + Camera Barcode Scan + Bulk Adjustment) */}
              {activeSection === 'TRANSACTIONS' && (
                <div className="space-y-4">
                  {/* Filter & Actions Bar */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1">
                      <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3 pointer-events-none" />
                        <input
                          type="text"
                          value={txSearch}
                          onChange={(e) => setTxSearch(e.target.value)}
                          placeholder={
                            isAr
                              ? 'ابحث برقم الحركة، اسم الكتاب، الباركود، أو المدرسة...'
                              : 'Search by transaction code, book, barcode, or school...'
                          }
                          className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setScannerModalOpen(true)}
                        className="px-3 py-2 text-xs font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ScanBarcode className="w-4 h-4" />
                        <span>{isAr ? 'مسح باركود / QR' : 'Scan Barcode'}</span>
                      </button>

                      {/* Segmented Type Filter */}
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setTxTypeFilter('ALL')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            txTypeFilter === 'ALL'
                              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isAr ? 'الكل' : 'All'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxTypeFilter('INBOUND')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            txTypeFilter === 'INBOUND'
                              ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isAr ? 'توريد (+)' : 'Inbound (+)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTxTypeFilter('OUTBOUND')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            txTypeFilter === 'OUTBOUND'
                              ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isAr ? 'صرف (-)' : 'Outbound (-)'}
                        </button>
                      </div>

                      {/* Sync Filter */}
                      <select
                        value={txSyncFilter}
                        onChange={(e) => setTxSyncFilter(e.target.value as any)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
                      >
                        <option value="ALL">{isAr ? 'كل حالات المزامنة' : 'All Sync States'}</option>
                        <option value="SYNCED">{isAr ? 'متزامن مع Google Sheets' : 'Synced'}</option>
                        <option value="PENDING">{isAr ? 'بانتظار المزامنة (isSynced=false)' : 'Pending Offline'}</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canEditInventory && (
                        <button
                          type="button"
                          onClick={openBulkAdjustmentModal}
                          className="px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5 text-[#006F88]" />
                          <span>{isAr ? 'تسوية جماعية' : 'Bulk Adjust'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => exportTransactionsToCSV(filteredTransactions, lang)}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPdfReportType('TRANSACTIONS');
                          setPdfModalOpen(true);
                        }}
                        className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#006F88]" />
                        <span>PDF</span>
                      </button>
                      {canEditInventory && (
                        <>
                          <button
                            type="button"
                            onClick={() => openTransactionForBook('INBOUND')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <ArrowDownLeft className="w-4 h-4" />
                            <span>{isAr ? '+ توريد جديد' : '+ New Inbound'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openTransactionForBook('OUTBOUND')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                            <span>{isAr ? '- صرف مدرسي' : '- New Outbound'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Transactions Ledger Table */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {filteredTransactions.length === 0 ? (
                      <div className="p-12 text-center space-y-2">
                        <ArrowLeftRight className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {isAr ? 'لا توجد حركات مخزنية مطابقة للبحث' : 'No matching inventory transactions'}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400">
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'رقم الحركة والتاريخ' : 'Code & Date'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'نوع المستند' : 'Type'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'الكتاب المدرسي' : 'Textbook'}</th>
                              <th className="px-4 py-3 text-end font-medium">{isAr ? 'الرصيد قبل' : 'Before'}</th>
                              <th className="px-4 py-3 text-end font-medium">{isAr ? 'الكمية' : 'Delta'}</th>
                              <th className="px-4 py-3 text-end font-medium">{isAr ? 'الرصيد بعد' : 'After'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'الجهة / المدرسة والمستند' : 'School / Supplier & Ref'}</th>
                              <th className="px-4 py-3 text-start font-medium">{isAr ? 'حالة المزامنة' : 'Sync Status'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {paginatedTransactions.map((t) => (
                              <tr
                                key={t.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <td className="px-4 py-3 font-mono tabular-nums whitespace-nowrap">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {t.transactionCode}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {new Date(t.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div
                                    className={`font-semibold ${
                                      t.type === 'INBOUND'
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-700 dark:text-amber-400'
                                    }`}
                                  >
                                    {t.type === 'INBOUND'
                                      ? isAr
                                        ? 'توريد مخزني (+)'
                                        : 'Inbound (+)'
                                      : isAr
                                      ? 'صرف مدرسي (-)'
                                      : 'Outbound (-)'}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{getSubTypeLabel(t.subType)}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {isAr ? t.bookTitleAr : t.bookTitle}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono">
                                    {t.bookBarcode} · {t.academicYear}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-end font-mono tabular-nums text-slate-500 whitespace-nowrap">
                                  {t.stockBefore.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-end font-mono tabular-nums font-bold text-sm whitespace-nowrap">
                                  <span
                                    className={
                                      t.type === 'INBOUND'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }
                                  >
                                    {t.type === 'INBOUND'
                                      ? `+${t.quantity.toLocaleString()}`
                                      : `-${t.quantity.toLocaleString()}`}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-end font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                  {t.stockAfter.toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {isAr ? t.counterpartyNameAr : t.counterpartyName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono">{t.referenceNumber}</span>
                                    <span>·</span>
                                    <span>{t.createdBy}</span>
                                    {t.recipientPersonName && (
                                      <>
                                        <span>·</span>
                                        <span className="text-[#006F88] dark:text-cyan-400 font-medium">
                                          {isAr
                                            ? `المستلم: ${t.recipientPersonName}`
                                            : `Recipient: ${t.recipientPersonName}`}
                                        </span>
                                      </>
                                    )}
                                    {t.recipientSignatureDataUrl && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                                        <PenTool className="w-2.5 h-2.5" />
                                        {isAr ? 'موقع إلكترونياً' : 'Signed'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {t.isSynced ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>isSynced: true</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>isSynced: false</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Pagination Bar for Scalability */}
                        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 text-slate-500">
                            <span>
                              {isAr
                                ? `عرض ${(safeTxPage - 1) * txPageSize + 1} - ${Math.min(
                                    safeTxPage * txPageSize,
                                    filteredTransactions.length
                                  )} من إجمالي ${filteredTransactions.length} حركة`
                                : `Showing ${(safeTxPage - 1) * txPageSize + 1} - ${Math.min(
                                    safeTxPage * txPageSize,
                                    filteredTransactions.length
                                  )} of ${filteredTransactions.length} transactions`}
                            </span>
                            <select
                              value={txPageSize}
                              onChange={(e) => {
                                setTxPageSize(Number(e.target.value));
                                setTxPage(1);
                              }}
                              className="px-2 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            >
                              <option value={15}>{isAr ? '15 / صفحة' : '15 / page'}</option>
                              <option value={30}>{isAr ? '30 / صفحة' : '30 / page'}</option>
                              <option value={50}>{isAr ? '50 / صفحة' : '50 / page'}</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeTxPage <= 1}
                              onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                            >
                              {isAr ? 'السابق' : 'Prev'}
                            </button>
                            <span className="px-2 font-mono font-semibold text-slate-700 dark:text-slate-300">
                              {safeTxPage} / {totalTxPages}
                            </span>
                            <button
                              type="button"
                              disabled={safeTxPage >= totalTxPages}
                              onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                            >
                              {isAr ? 'التالي' : 'Next'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 4: PHYSICAL STOCKTAKING SESSIONS & DAMAGED/RETURNED BOOKS QUARANTINE */}
              {activeSection === 'STOCKTAKING' && allowedTabsForCurrentUser.includes('STOCKTAKING') && (
                <StocktakingAndDamagedView
                  books={books}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  currentUser={currentUser}
                  stocktakingSessions={stocktakingSessions}
                  damagedRecords={damagedRecords}
                  lang={lang}
                  onCreateStocktakingSession={handleCreateStocktakingSession}
                  onUpdateStocktakingSession={handleUpdateStocktakingSession}
                  onReconcileStocktakingSession={handleReconcileStocktakingSession}
                  onCreateDamagedRecord={handleCreateDamagedRecord}
                  onResolveDamagedRecord={handleResolveDamagedRecord}
                  onOpenScanner={() => setScannerModalOpen(true)}
                />
              )}

              {/* VIEW 5: SUPER ADMIN CONTROL CENTER (USERS, ROLES, TAB VISIBILITY, WORKSPACES, AUDIT & BACKUP) */}
              {activeSection === 'SUPER_ADMIN' && allowedTabsForCurrentUser.includes('SUPER_ADMIN') && (
                <SuperAdminView
                  users={users}
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  currentUser={currentUser}
                  books={books}
                  transactions={transactions}
                  auditLogs={auditLogs}
                  formConfig={formConfig}
                  lang={lang}
                  onSaveUser={handleSaveUser}
                  onToggleUserActive={handleToggleUserActive}
                  onSwitchUser={handleSelectUser}
                  onSaveWorkspace={handleSaveWorkspace}
                  onToggleWorkspaceActive={handleToggleWorkspaceActive}
                  onSelectActiveWorkspace={handleSelectWorkspace}
                  onUpdateFormConfig={handleUpdateFormConfig}
                  onBulkUpdateUsers={handleBulkUpdateUsers}
                  onExportFullBackup={handleExportFullBackup}
                  onImportFullBackup={handleImportFullBackup}
                />
              )}

              {/* VIEW 6: FORM INPUTS, DROPDOWN LOOKUPS, AUTOMATION RULES & AUDIT LOG */}
              {activeSection === 'CONFIG' && allowedTabsForCurrentUser.includes('CONFIG') && (
                <FormConfigView
                  formConfig={formConfig}
                  books={books}
                  schools={schools}
                  auditLogs={auditLogs}
                  currentUser={currentUser}
                  userRole={currentUser.role}
                  lang={lang}
                  onUpdateFormConfig={handleUpdateFormConfig}
                  onExecuteAutomationRules={handleExecuteAutomationRules}
                  onRecordAudit={handleRecordAudit}
                  onAddSchool={handleAddSchool}
                  onDeleteSchool={handleDeleteSchool}
                  onOpenRoleModal={() => setAuthModalOpen(true)}
                />
              )}

              {/* VIEW 7: OFFLINE SYNC & GOOGLE SHEETS WEBHOOK CENTER */}
              {activeSection === 'SYNC' && allowedTabsForCurrentUser.includes('SYNC') && (
                <SyncCenterView
                  books={books}
                  transactions={transactions}
                  syncLogs={syncLogs}
                  syncConfig={syncConfig}
                  isOfflineSimulated={isOfflineSimulated}
                  onToggleOffline={handleToggleOffline}
                  onSyncNow={handleSyncNow}
                  onUpdateConfig={handleUpdateSyncConfig}
                  onResetDemoData={handleResetDemoData}
                  userRole={currentUser.role}
                  lang={lang}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile & Tablet More Options Sheet (for Config, Sync, and PWA Install) */}
      {mobileMoreDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden flex items-end justify-center no-print"
          onClick={() => setMobileMoreDrawerOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl border-t border-slate-200 dark:border-slate-800 p-4 pb-8 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {isAr ? 'أقسام إضافية وإعدادات PWA والجهاز' : 'More Modules & PWA Settings'}
              </span>
              <button
                type="button"
                onClick={() => setMobileMoreDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {allowedTabsForCurrentUser.includes('CONFIG') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('CONFIG');
                    setMobileMoreDrawerOpen(false);
                  }}
                  className={`p-3.5 rounded-xl border text-start flex items-center gap-3 cursor-pointer ${
                    activeSection === 'CONFIG'
                      ? 'border-[#006F88] bg-[#006F88]/10 text-[#006F88] dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <Sliders className="w-5 h-5 text-[#006F88] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {isAr ? 'التهيئة والأتمتة' : 'Form & Rules'}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {isAr ? 'القواعد وسجل التدقيق' : 'Rules & Audit Log'}
                    </div>
                  </div>
                </button>
              )}

              {allowedTabsForCurrentUser.includes('SYNC') && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection('SYNC');
                    setMobileMoreDrawerOpen(false);
                  }}
                  className={`p-3.5 rounded-xl border text-start flex items-center gap-3 cursor-pointer ${
                    activeSection === 'SYNC'
                      ? 'border-[#006F88] bg-[#006F88]/10 text-[#006F88] dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <CloudUpload className="w-5 h-5 text-[#006F88] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {isAr ? 'المزامنة و SQLite' : 'Sync & SQLite'}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {stats.unsyncedCount} {isAr ? 'بانتظار الرفع' : 'pending'}
                    </div>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMoreDrawerOpen(false);
                  setPwaModalOpen(true);
                }}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-start flex items-center gap-3 cursor-pointer"
              >
                <Smartphone className="w-5 h-5 text-[#006F88] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {isAr ? 'تثبيت PWA والحساسات' : 'PWA & Device Hub'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {isAr ? 'التخزين الدائم والعمل أوفلاين' : 'Offline & Storage'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMoreDrawerOpen(false);
                  setScannerModalOpen(true);
                }}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-start flex items-center gap-3 cursor-pointer"
              >
                <ScanBarcode className="w-5 h-5 text-[#006F88] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">
                    {isAr ? 'مسح باركود سريع' : 'Quick Scan'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {isAr ? 'كاميرا الجوال / التابلت' : 'Camera Scanner'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Bottom Navigation Bar for Mobile & Tablet (lg:hidden) */}
      <nav
        aria-label={isAr ? 'شريط التنقل السفلي للجوال والتابلت' : 'Mobile & Tablet Bottom Navigation'}
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1.5 py-1.5 flex items-center justify-around shadow-lg no-print"
      >
        {visibleNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setMobileMoreDrawerOpen(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-colors cursor-pointer min-w-0 relative ${
                isActive
                  ? 'text-[#006F88] dark:text-cyan-400 bg-[#006F88]/10 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-1 truncate max-w-full">
                {isAr ? item.shortAr : item.shortEn}
              </span>
              {item.id === 'STOCKTAKING' && quarantinedCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 end-3" />
              )}
            </button>
          );
        })}

        {/* 6th Button: More (Config, Sync, PWA) */}
        <button
          type="button"
          onClick={() => setMobileMoreDrawerOpen(!mobileMoreDrawerOpen)}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-colors cursor-pointer min-w-0 relative ${
            activeSection === 'CONFIG' || activeSection === 'SYNC' || mobileMoreDrawerOpen
              ? 'text-[#006F88] dark:text-cyan-400 bg-[#006F88]/10 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
          }`}
        >
          <MoreHorizontal className="w-5 h-5 shrink-0" />
          <span className="text-[10px] mt-1 truncate max-w-full">
            {isAr ? 'المزيد' : 'More'}
          </span>
          {stats.unsyncedCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 end-3" />
          )}
        </button>
      </nav>

      {/* Floating Offline Status Pill */}
      <OfflineStatusFloatingPill
        isOffline={!pwa.isOnline || isOfflineSimulated}
        lang={lang}
      />

      {/* PWA Install & Native Capabilities Modal */}
      <PWAInstallModal
        isOpen={pwaModalOpen}
        onClose={() => setPwaModalOpen(false)}
        lang={lang}
        onMarkInstalled={() => {
          showToast(
            'SUCCESS',
            isAr
              ? 'تم تفعيل وضع التطبيق المستقل (PWA) بنجاح!'
              : 'Standalone PWA mode activated!'
          );
        }}
      />

      {/* Modals */}
      <BookFormModal
        isOpen={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        onSave={handleSaveBook}
        initialBook={editingBook}
        formConfig={formConfig}
        userRole={currentUser.role}
        onUpdateFormConfig={handleUpdateFormConfig}
        onOpenPrintModal={(previewBook) => {
          setBookModalOpen(false);
          openBarcodePrintStudio([previewBook]);
        }}
        lang={lang}
      />

      <BarcodePrintModal
        isOpen={barcodePrintModalOpen}
        onClose={() => setBarcodePrintModalOpen(false)}
        books={books}
        initialBooks={booksForBarcodePrint}
        lang={lang}
      />

      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        initialType={txModalInitialType}
        preselectedBookId={txPreselectedBookId}
        books={books}
        schools={schools}
        currentUser={currentUser}
        formConfig={formConfig}
        onUpdateFormConfig={handleUpdateFormConfig}
        onAddSchool={handleAddSchool}
        onRecord={handleRecordTransaction}
        lang={lang}
      />

      <BarcodeScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        books={books}
        canEditInventory={canEditInventory}
        onFilterByBarcode={handleFilterByScannedBarcode}
        onQuickTransaction={openTransactionForBook}
        lang={lang}
      />

      <BulkAdjustmentModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        books={books}
        schools={schools}
        currentUser={currentUser}
        formConfig={formConfig}
        preselectedBookIds={selectedCatalogBookIds}
        onRecordBatch={handleRecordBatch}
        lang={lang}
      />

      <PdfReportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        reportType={pdfReportType}
        books={filteredBooks.length > 0 ? filteredBooks : books}
        transactions={filteredTransactions.length > 0 ? filteredTransactions : transactions}
        currentUser={currentUser}
        lang={lang}
      />

      <AuthRoleModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        users={users}
        onSelectUser={handleSelectUser}
        lang={lang}
      />
    </div>
  );
}
