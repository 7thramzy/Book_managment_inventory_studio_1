import {
  AuditLogEntry,
  BookItem,
  DamagedBookRecord,
  FormLookupsConfig,
  InventoryTransaction,
  SchoolEntity,
  StocktakingSession,
  SyncConfig,
  SyncLogEntry,
  UserAccount,
  WorkspaceEntity,
} from '../types/inventory';
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
} from '../data/seedData';

export function extractSpreadsheetIdFromUrl(urlOrId: string): {
  spreadsheetId: string | null;
  gid: string | null;
} {
  const trimmed = (urlOrId || '').trim();
  if (!trimmed) return { spreadsheetId: null, gid: null };

  // Match standard Google Sheets URL: https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/);
  if (urlMatch && urlMatch[1]) {
    return {
      spreadsheetId: urlMatch[1],
      gid: gidMatch ? gidMatch[1] : '0',
    };
  }

  // Fallback: if user pasted a raw Spreadsheet ID directly (25-60 alphanumeric/-/_ chars, no slashes)
  if (/^[a-zA-Z0-9-_]{20,64}$/.test(trimmed)) {
    return {
      spreadsheetId: trimmed,
      gid: '0',
    };
  }

  return { spreadsheetId: null, gid: null };
}

const STORAGE_KEYS = {
  BOOKS: 'drift_sqlite_books_v1',
  SCHOOLS: 'drift_sqlite_schools_v1',
  TRANSACTIONS: 'drift_sqlite_transactions_v1',
  SYNC_LOGS: 'drift_sqlite_sync_logs_v1',
  SYNC_CONFIG: 'drift_sqlite_sync_config_v1',
  FORM_CONFIG: 'drift_sqlite_form_config_v1',
  AUDIT_LOGS: 'drift_sqlite_audit_logs_v1',
  USERS: 'drift_sqlite_users_v2',
  WORKSPACES: 'drift_sqlite_workspaces_v1',
  STOCKTAKING: 'drift_sqlite_stocktaking_v1',
  DAMAGED: 'drift_sqlite_damaged_v1',
};

export interface DriftSnapshot {
  books: BookItem[];
  schools: SchoolEntity[];
  transactions: InventoryTransaction[];
  syncLogs: SyncLogEntry[];
  syncConfig: SyncConfig;
  formConfig: FormLookupsConfig;
  auditLogs: AuditLogEntry[];
  users: UserAccount[];
  workspaces: WorkspaceEntity[];
  stocktakingSessions: StocktakingSession[];
  damagedRecords: DamagedBookRecord[];
}

const IDB_NAME = 'MOE_Drift_IndexedDB_v1';
const IDB_STORE = 'drift_collections';

function openDriftIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeIndexedDB<T>(key: string, value: T): Promise<void> {
  const db = await openDriftIndexedDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  // Always mirror full high-resolution payload asynchronously into IndexedDB (unlimited quota)
  void writeIndexedDB(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError fallback: if transactions exceed 5MB localStorage due to Base64 signatures,
    // keep only the 25 most recent signatures in localStorage while IndexedDB + SQLite retain 100%
    if (key === STORAGE_KEYS.TRANSACTIONS && Array.isArray(value)) {
      try {
        const compact = (value as unknown as InventoryTransaction[]).map((t, idx) =>
          idx > 25 && t.recipientSignatureDataUrl
            ? { ...t, recipientSignatureDataUrl: undefined }
            : t
        );
        localStorage.setItem(key, JSON.stringify(compact));
      } catch {
        // IndexedDB still holds the complete dataset
      }
    }
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const rawUser = localStorage.getItem('moe_active_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as UserAccount;
      if (parsed.role) headers['X-User-Role'] = parsed.role;
      if (parsed.id) headers['X-User-Id'] = parsed.id;
    }
    const activeWsId = localStorage.getItem('moe_active_workspace_id') || 'ws-central-01';
    const workspaces = readLocal<WorkspaceEntity[]>(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    const ws = workspaces.find((w) => w.id === activeWsId);
    headers['X-Workspace-Active'] = ws ? String(ws.isActive) : 'true';
  } catch {
    // ignore
  }
  return headers;
}

export class DriftSqliteClientEngine {
  static loadLocalSnapshot(): DriftSnapshot {
    const books = readLocal<BookItem[]>(STORAGE_KEYS.BOOKS, INITIAL_BOOKS);
    const schools = readLocal<SchoolEntity[]>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
    const transactions = readLocal<InventoryTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    const syncLogs = readLocal<SyncLogEntry[]>(STORAGE_KEYS.SYNC_LOGS, INITIAL_SYNC_LOGS);
    const rawSyncConfig = readLocal<SyncConfig>(STORAGE_KEYS.SYNC_CONFIG, DEFAULT_SYNC_CONFIG);
    const syncConfig: SyncConfig = {
      ...DEFAULT_SYNC_CONFIG,
      ...rawSyncConfig,
    };
    const rawFormConfig = readLocal<FormLookupsConfig>(STORAGE_KEYS.FORM_CONFIG, DEFAULT_FORM_LOOKUPS);
    const formConfig: FormLookupsConfig = {
      ...DEFAULT_FORM_LOOKUPS,
      ...rawFormConfig,
      automationRules: rawFormConfig.automationRules ?? DEFAULT_FORM_LOOKUPS.automationRules,
      automationAlerts: rawFormConfig.automationAlerts ?? DEFAULT_FORM_LOOKUPS.automationAlerts,
      roleTabMatrix: {
        ...DEFAULT_ROLE_TAB_MATRIX,
        ...(rawFormConfig.roleTabMatrix || {}),
      },
    };
    const auditLogs = readLocal<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    const users = readLocal<UserAccount[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
    const workspaces = readLocal<WorkspaceEntity[]>(STORAGE_KEYS.WORKSPACES, INITIAL_WORKSPACES);
    const stocktakingSessions = readLocal<StocktakingSession[]>(
      STORAGE_KEYS.STOCKTAKING,
      INITIAL_STOCKTAKING_SESSIONS
    );
    const damagedRecords = readLocal<DamagedBookRecord[]>(STORAGE_KEYS.DAMAGED, INITIAL_DAMAGED_RECORDS);

    return {
      books,
      schools,
      transactions,
      syncLogs,
      syncConfig,
      formConfig,
      auditLogs,
      users,
      workspaces,
      stocktakingSessions,
      damagedRecords,
    };
  }

  static saveLocalSnapshot(snapshot: Partial<DriftSnapshot>): void {
    if (snapshot.books) writeLocal(STORAGE_KEYS.BOOKS, snapshot.books);
    if (snapshot.schools) writeLocal(STORAGE_KEYS.SCHOOLS, snapshot.schools);
    if (snapshot.transactions) writeLocal(STORAGE_KEYS.TRANSACTIONS, snapshot.transactions);
    if (snapshot.syncLogs) writeLocal(STORAGE_KEYS.SYNC_LOGS, snapshot.syncLogs);
    if (snapshot.syncConfig) writeLocal(STORAGE_KEYS.SYNC_CONFIG, snapshot.syncConfig);
    if (snapshot.formConfig) writeLocal(STORAGE_KEYS.FORM_CONFIG, snapshot.formConfig);
    if (snapshot.auditLogs) writeLocal(STORAGE_KEYS.AUDIT_LOGS, snapshot.auditLogs);
    if (snapshot.users) writeLocal(STORAGE_KEYS.USERS, snapshot.users);
    if (snapshot.workspaces) writeLocal(STORAGE_KEYS.WORKSPACES, snapshot.workspaces);
    if (snapshot.stocktakingSessions) writeLocal(STORAGE_KEYS.STOCKTAKING, snapshot.stocktakingSessions);
    if (snapshot.damagedRecords) writeLocal(STORAGE_KEYS.DAMAGED, snapshot.damagedRecords);
  }

  static async bootstrap(isOfflineSimulated: boolean): Promise<DriftSnapshot> {
    const localSnap = this.loadLocalSnapshot();
    if (isOfflineSimulated || !navigator.onLine) {
      return localSnap;
    }
    try {
      // BUG-04 Fix: If there are unsynced offline books or transactions locally, reconcile them to the server FIRST
      // so a page reload (F5) never wipes offline mutations.
      const unsyncedLocalBooks = localSnap.books.filter((b) => !b.isSynced);
      const unsyncedLocalTxs = localSnap.transactions.filter((t) => !t.isSynced);
      if (unsyncedLocalBooks.length > 0 || unsyncedLocalTxs.length > 0) {
        try {
          await fetch('/api/sync', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              offlineBooks: unsyncedLocalBooks,
              offlineTransactions: unsyncedLocalTxs,
            }),
          });
        } catch {
          // If auto-reconciliation fails, we will merge unsynced records below
        }
      }

      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Server bootstrap failed');
      const data = await res.json();
      const rawCfg = data.formConfig || DEFAULT_FORM_LOOKUPS;

      // Ensure any still-unsynced local transactions or books are preserved if sync didn't complete
      const serverTxIds = new Set((data.transactions as InventoryTransaction[]).map((t) => t.id));
      const preservedOfflineTxs = unsyncedLocalTxs.filter((t) => !serverTxIds.has(t.id));
      const mergedTransactions = [...preservedOfflineTxs, ...(data.transactions as InventoryTransaction[])];

      const serverBookIds = new Set((data.books as BookItem[]).map((b) => b.id));
      const preservedOfflineBooks = unsyncedLocalBooks.filter((b) => !serverBookIds.has(b.id));
      const mergedBooks = [...preservedOfflineBooks, ...(data.books as BookItem[])];

      const snapshot: DriftSnapshot = {
        books: mergedBooks,
        schools: data.schools,
        transactions: mergedTransactions,
        syncLogs: data.syncLogs,
        syncConfig: {
          ...DEFAULT_SYNC_CONFIG,
          ...data.syncConfig,
          simulateOffline: isOfflineSimulated,
        },
        formConfig: {
          ...DEFAULT_FORM_LOOKUPS,
          ...rawCfg,
          automationRules: rawCfg.automationRules ?? DEFAULT_FORM_LOOKUPS.automationRules,
          automationAlerts: rawCfg.automationAlerts ?? DEFAULT_FORM_LOOKUPS.automationAlerts,
          roleTabMatrix: {
            ...DEFAULT_ROLE_TAB_MATRIX,
            ...(rawCfg.roleTabMatrix || {}),
          },
        },
        auditLogs: data.auditLogs || INITIAL_AUDIT_LOGS,
        users: data.users?.length ? data.users : localSnap.users?.length ? localSnap.users : DEFAULT_USERS,
        workspaces: data.workspaces?.length
          ? data.workspaces
          : localSnap.workspaces?.length
          ? localSnap.workspaces
          : INITIAL_WORKSPACES,
        stocktakingSessions: data.stocktakingSessions?.length
          ? data.stocktakingSessions
          : localSnap.stocktakingSessions?.length
          ? localSnap.stocktakingSessions
          : INITIAL_STOCKTAKING_SESSIONS,
        damagedRecords: data.damagedRecords?.length
          ? data.damagedRecords
          : localSnap.damagedRecords?.length
          ? localSnap.damagedRecords
          : INITIAL_DAMAGED_RECORDS,
      };
      this.saveLocalSnapshot(snapshot);
      return snapshot;
    } catch {
      return localSnap;
    }
  }

  static async upsertBook(
    bookInput: Partial<BookItem> & { title: string; barcode: string },
    isOffline: boolean
  ): Promise<{ book: BookItem; savedOffline: boolean }> {
    const snap = this.loadLocalSnapshot();
    const isEdit = Boolean(bookInput.id && snap.books.some((b) => b.id === bookInput.id));
    const nowIso = new Date().toISOString();

    // Check duplicate barcode locally
    const duplicate = snap.books.find(
      (b) => b.barcode.toUpperCase() === bookInput.barcode.trim().toUpperCase() && b.id !== bookInput.id
    );
    if (duplicate) {
      throw new Error(`الباركود "${bookInput.barcode}" مسجل مسبقاً لكتاب آخر (${duplicate.titleAr}).`);
    }

    const localBook: BookItem = {
      id: bookInput.id || `bk-${Date.now()}`,
      title: bookInput.title.trim(),
      titleAr: (bookInput.titleAr || bookInput.title).trim(),
      stage: bookInput.stage || 'PRIMARY',
      grade: bookInput.grade || 'Grade 1',
      gradeAr: bookInput.gradeAr || bookInput.grade || 'الصف الأول',
      academicYear: bookInput.academicYear || '2026/2027',
      subject: bookInput.subject || 'General',
      subjectAr: bookInput.subjectAr || bookInput.subject || 'عام',
      barcode: bookInput.barcode.trim().toUpperCase(),
      unitType: bookInput.unitType || 'Unit',
      minStockLevel: Math.max(0, Number(bookInput.minStockLevel) ?? 100),
      currentStock: Math.max(0, Number(bookInput.currentStock) ?? 0),
      updatedAt: nowIso,
      isSynced: false,
    };

    if (!isOffline && navigator.onLine) {
      try {
        const url = isEdit ? `/api/books/${localBook.id}` : '/api/books';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: getAuthHeaders(),
          body: JSON.stringify(localBook),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to save book');
        }
        const { book } = await res.json();
        const nextBooks = isEdit
          ? snap.books.map((b) => (b.id === book.id ? book : b))
          : [book, ...snap.books];
        this.saveLocalSnapshot({ books: nextBooks });
        return { book, savedOffline: false };
      } catch (err: any) {
        if (
          err.message?.includes('Barcode') ||
          err.message?.includes('الباركود') ||
          err.message?.includes('RBAC_FORBIDDEN') ||
          err.message?.includes('WORKSPACE_SUSPENDED')
        ) {
          throw err;
        }
        // Fallback to local Drift store if network dropped
      }
    }

    const nextBooks = isEdit
      ? snap.books.map((b) => (b.id === localBook.id ? localBook : b))
      : [localBook, ...snap.books];
    this.saveLocalSnapshot({ books: nextBooks });
    return { book: localBook, savedOffline: true };
  }

  static async deleteBook(bookId: string, isOffline: boolean): Promise<void> {
    const snap = this.loadLocalSnapshot();
    const nextBooks = snap.books.filter((b) => b.id !== bookId);
    this.saveLocalSnapshot({ books: nextBooks });

    if (!isOffline && navigator.onLine) {
      try {
        await fetch(`/api/books/${bookId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      } catch {
        // Already deleted in local Drift store
      }
    }
  }

  static async recordTransaction(
    payload: {
      type: 'INBOUND' | 'OUTBOUND';
      subType: InventoryTransaction['subType'];
      bookId: string;
      academicYear: string;
      quantity: number;
      referenceNumber: string;
      counterpartyName: string;
      counterpartyNameAr: string;
      schoolId?: string;
      createdBy: string;
      createdByRole: InventoryTransaction['createdByRole'];
      notes: string;
    },
    isOffline: boolean
  ): Promise<{ transaction: InventoryTransaction; book: BookItem; savedOffline: boolean }> {
    const snap = this.loadLocalSnapshot();
    const targetBook = snap.books.find((b) => b.id === payload.bookId);
    if (!targetBook) {
      throw new Error('الكتاب المحدد غير موجود في دليل الأصناف.');
    }

    const qty = Math.floor(Number(payload.quantity));
    if (!qty || qty <= 0) {
      throw new Error('يرجى إدخال كمية صحيحة أكبر من الصفر.');
    }

    const stockBefore = Number(targetBook.currentStock);
    const isOutbound = payload.type === 'OUTBOUND';

    // Strict Outbound Stock Validation (prevents negative stock both online & offline)
    if (isOutbound && qty > stockBefore) {
      throw new Error(
        `لا يمكن صرف ${qty.toLocaleString()} نسخة من "${targetBook.titleAr}". الرصيد المتاح حالياً في المخزن هو ${stockBefore.toLocaleString()} نسخة فقط.`
      );
    }

    const stockAfter = isOutbound ? stockBefore - qty : stockBefore + qty;
    const nowIso = new Date().toISOString();
    const trxCode = `${isOutbound ? 'OUT' : 'INB'}-${new Date().getFullYear()}-${String(
      Math.floor(1000 + Math.random() * 9000)
    )}`;

    const localTrx: InventoryTransaction = {
      id: `trx-${Date.now()}`,
      transactionCode: trxCode,
      type: payload.type,
      subType: payload.subType,
      bookId: targetBook.id,
      bookTitle: targetBook.title,
      bookTitleAr: targetBook.titleAr,
      bookBarcode: targetBook.barcode,
      stage: targetBook.stage,
      grade: targetBook.grade,
      academicYear: payload.academicYear || targetBook.academicYear,
      quantity: qty,
      stockBefore,
      stockAfter,
      referenceNumber: payload.referenceNumber.trim() || trxCode,
      counterpartyName: payload.counterpartyName.trim(),
      counterpartyNameAr: (payload.counterpartyNameAr || payload.counterpartyName).trim(),
      schoolId: payload.schoolId,
      recipientPersonName: (payload as any).recipientPersonName,
      recipientPhone: (payload as any).recipientPhone,
      recipientSignatureDataUrl: (payload as any).recipientSignatureDataUrl,
      createdBy: payload.createdBy,
      createdByRole: payload.createdByRole,
      notes: payload.notes.trim(),
      createdAt: nowIso,
      isSynced: false,
      syncedAt: null,
      syncError: null,
    };

    // BUG-06 Fix: Preserve targetBook.academicYear instead of overwriting catalog metadata
    const updatedBook: BookItem = {
      ...targetBook,
      currentStock: stockAfter,
      updatedAt: nowIso,
      isSynced: false,
    };

    if (!isOffline && navigator.onLine) {
      try {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(localTrx),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Transaction rejected by SQLite engine');
        }
        const serverResult = await res.json();
        const nextBooks = snap.books.map((b) => (b.id === serverResult.book.id ? serverResult.book : b));
        const nextTransactions = [serverResult.transaction, ...snap.transactions];
        this.saveLocalSnapshot({ books: nextBooks, transactions: nextTransactions });
        return {
          transaction: serverResult.transaction,
          book: serverResult.book,
          savedOffline: false,
        };
      } catch (err: any) {
        if (
          err.message?.includes('INSUFFICIENT_STOCK') ||
          err.message?.includes('لا يمكن صرف') ||
          err.message?.includes('RBAC_FORBIDDEN') ||
          err.message?.includes('WORKSPACE_SUSPENDED')
        ) {
          throw err;
        }
        // If network error, fall through to local Drift SQLite persistence
      }
    }

    const nextBooks = snap.books.map((b) => (b.id === updatedBook.id ? updatedBook : b));
    const nextTransactions = [localTrx, ...snap.transactions];
    this.saveLocalSnapshot({ books: nextBooks, transactions: nextTransactions });
    return {
      transaction: localTrx,
      book: updatedBook,
      savedOffline: true,
    };
  }

  static async recordBatchTransactions(
    payload: {
      type: 'INBOUND' | 'OUTBOUND';
      subType: InventoryTransaction['subType'];
      academicYear: string;
      referenceNumber: string;
      counterpartyName: string;
      counterpartyNameAr: string;
      schoolId?: string;
      createdBy: string;
      createdByRole: InventoryTransaction['createdByRole'];
      notes: string;
      items: { bookId: string; quantity: number }[];
    },
    isOffline: boolean
  ): Promise<{
    transactions: InventoryTransaction[];
    books: BookItem[];
    savedOffline: boolean;
  }> {
    const snap = this.loadLocalSnapshot();
    const isOutbound = payload.type === 'OUTBOUND';
    const nowIso = new Date().toISOString();

    if (!payload.items || payload.items.length === 0) {
      throw new Error('يرجى اختيار كتاب واحد على الأقل لتنفيذ التسوية الجماعية.');
    }

    // 1. Validate all items in the batch first (atomic validation)
    const localCreatedTransactions: InventoryTransaction[] = [];
    const updatedBookMap = new Map<string, BookItem>();

    for (let idx = 0; idx < payload.items.length; idx++) {
      const item = payload.items[idx];
      const targetBook = snap.books.find((b) => b.id === item.bookId);
      if (!targetBook) {
        throw new Error('أحد الكتب المحددة غير موجود في دليل الأصناف.');
      }

      const qty = Math.floor(Number(item.quantity));
      if (!qty || qty <= 0) {
        throw new Error(`يرجى إدخال كمية صحيحة أكبر من الصفر للكتاب "${targetBook.titleAr}".`);
      }

      const stockBefore = Number(targetBook.currentStock);
      if (isOutbound && qty > stockBefore) {
        throw new Error(
          `لا يمكن صرف ${qty.toLocaleString()} نسخة من "${targetBook.titleAr}". الرصيد المتاح حالياً هو ${stockBefore.toLocaleString()} نسخة فقط.`
        );
      }

      const stockAfter = isOutbound ? stockBefore - qty : stockBefore + qty;
      const trxCode = `${isOutbound ? 'OUT' : 'INB'}-BLK-${new Date().getFullYear()}-${String(
        Math.floor(1000 + Math.random() * 9000)
      )}-${idx + 1}`;

      const localTrx: InventoryTransaction = {
        id: `trx-blk-${Date.now()}-${idx}`,
        transactionCode: trxCode,
        type: payload.type,
        subType: payload.subType,
        bookId: targetBook.id,
        bookTitle: targetBook.title,
        bookTitleAr: targetBook.titleAr,
        bookBarcode: targetBook.barcode,
        stage: targetBook.stage,
        grade: targetBook.grade,
        academicYear: payload.academicYear || targetBook.academicYear,
        quantity: qty,
        stockBefore,
        stockAfter,
        referenceNumber: payload.referenceNumber.trim() || trxCode,
        counterpartyName: payload.counterpartyName.trim(),
        counterpartyNameAr: (payload.counterpartyNameAr || payload.counterpartyName).trim(),
        schoolId: payload.schoolId,
        createdBy: payload.createdBy,
        createdByRole: payload.createdByRole,
        notes: payload.notes.trim(),
        createdAt: nowIso,
        isSynced: false,
        syncedAt: null,
        syncError: null,
      };

      const updatedBook: BookItem = {
        ...targetBook,
        currentStock: stockAfter,
        updatedAt: nowIso,
        isSynced: false,
      };

      localCreatedTransactions.push(localTrx);
      updatedBookMap.set(updatedBook.id, updatedBook);
    }

    if (!isOffline && navigator.onLine) {
      try {
        const res = await fetch('/api/transactions/batch', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Batch transaction rejected by SQLite engine');
        }
        const serverResult = await res.json();
        const serverBookMap = new Map<string, BookItem>(
          (serverResult.books as BookItem[]).map((b) => [b.id, b])
        );
        const nextBooks = snap.books.map((b) => serverBookMap.get(b.id) || b);
        const nextTransactions = [...(serverResult.transactions as InventoryTransaction[]), ...snap.transactions];
        this.saveLocalSnapshot({ books: nextBooks, transactions: nextTransactions });
        return {
          transactions: serverResult.transactions,
          books: serverResult.books,
          savedOffline: false,
        };
      } catch (err: any) {
        if (
          err.message?.includes('INSUFFICIENT_STOCK') ||
          err.message?.includes('لا يمكن صرف') ||
          err.message?.includes('RBAC_FORBIDDEN') ||
          err.message?.includes('WORKSPACE_SUSPENDED')
        ) {
          throw err;
        }
        // Fallback to local Drift SQLite store
      }
    }

    const nextBooks = snap.books.map((b) => updatedBookMap.get(b.id) || b);
    const nextTransactions = [...localCreatedTransactions, ...snap.transactions];
    this.saveLocalSnapshot({ books: nextBooks, transactions: nextTransactions });
    return {
      transactions: localCreatedTransactions,
      books: Array.from(updatedBookMap.values()),
      savedOffline: true,
    };
  }

  static async syncToGoogleSheets(
    customWebhookUrlOrOptions?:
      | string
      | {
          customWebhookUrl?: string;
          sheetUrl?: string;
          spreadsheetId?: string;
          googleAccessToken?: string;
          connectionMethod?: SyncConfig['connectionMethod'];
        }
  ): Promise<{
    snapshot: DriftSnapshot;
    logEntry: SyncLogEntry;
  }> {
    const snap = this.loadLocalSnapshot();
    const offlineBooks = snap.books.filter((b) => !b.isSynced);
    const offlineTransactions = snap.transactions.filter((t) => !t.isSynced);

    const opts =
      typeof customWebhookUrlOrOptions === 'string'
        ? { customWebhookUrl: customWebhookUrlOrOptions }
        : customWebhookUrlOrOptions || {};

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offlineBooks,
        offlineTransactions,
        customWebhookUrl: opts.customWebhookUrl ?? snap.syncConfig.webhookUrl,
        sheetUrl: opts.sheetUrl ?? snap.syncConfig.sheetUrl,
        spreadsheetId: opts.spreadsheetId ?? snap.syncConfig.spreadsheetId,
        googleAccessToken: opts.googleAccessToken ?? snap.syncConfig.googleAccessToken,
        connectionMethod: opts.connectionMethod ?? snap.syncConfig.connectionMethod,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'فشل الاتصال بخادم المزامنة');
    }

    const data = await res.json();
    const updatedSnapshot: DriftSnapshot = {
      books: data.books,
      schools: snap.schools,
      transactions: data.transactions,
      syncLogs: data.syncLogs,
      syncConfig: {
        ...snap.syncConfig,
        ...data.syncConfig,
      },
      formConfig: snap.formConfig,
      auditLogs: snap.auditLogs,
      users: snap.users,
      workspaces: snap.workspaces,
      stocktakingSessions: snap.stocktakingSessions,
      damagedRecords: snap.damagedRecords,
    };
    this.saveLocalSnapshot(updatedSnapshot);
    return {
      snapshot: updatedSnapshot,
      logEntry: data.logEntry,
    };
  }

  static async verifyGoogleSheetUrl(payload: {
    sheetUrl: string;
    spreadsheetId?: string;
    googleAccessToken?: string;
  }): Promise<{
    valid: boolean;
    spreadsheetId: string;
    gid: string;
    sheetUrl?: string;
    sheetTitle?: string;
    mode: string;
    messageAr: string;
    messageEn: string;
  }> {
    const res = await fetch('/api/sheets/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'تعذر التحقق من رابط Google Sheet');
    }
    return data;
  }

  static async appendAuditLog(
    entryInput: Omit<AuditLogEntry, 'id' | 'timestamp'>,
    isOffline: boolean
  ): Promise<AuditLogEntry> {
    const snap = this.loadLocalSnapshot();
    const entry: AuditLogEntry = {
      ...entryInput,
      id: `aud-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      timestamp: new Date().toISOString(),
    };
    const nextAuditLogs = [entry, ...snap.auditLogs].slice(0, 250);
    this.saveLocalSnapshot({ auditLogs: nextAuditLogs });

    if (!isOffline && navigator.onLine) {
      try {
        const res = await fetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (res.ok) {
          const { auditLog } = await res.json();
          return auditLog;
        }
      } catch {
        // Already saved locally in Drift store
      }
    }
    return entry;
  }

  static async updateFormConfig(
    nextConfig: FormLookupsConfig,
    isOffline: boolean
  ): Promise<FormLookupsConfig> {
    const updated: FormLookupsConfig = {
      ...nextConfig,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalSnapshot({ formConfig: updated });

    if (!isOffline && navigator.onLine) {
      try {
        const res = await fetch('/api/form-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        if (res.ok) {
          const data = await res.json();
          this.saveLocalSnapshot({ formConfig: data.formConfig });
          return data.formConfig;
        }
      } catch {
        // Saved locally in Drift store
      }
    }
    return updated;
  }

  static async upsertSchool(
    schoolInput: Partial<SchoolEntity> & { nameAr: string },
    isOffline: boolean
  ): Promise<SchoolEntity> {
    const snap = this.loadLocalSnapshot();
    const localSchool: SchoolEntity = {
      id: schoolInput.id || `sch-${Date.now()}`,
      code: (schoolInput.code || `SCH-CAI-${Math.floor(100 + Math.random() * 899)}`).trim().toUpperCase(),
      name: (schoolInput.name || schoolInput.nameAr).trim(),
      nameAr: schoolInput.nameAr.trim(),
      district: (schoolInput.district || schoolInput.districtAr || 'Central Directorate').trim(),
      districtAr: (schoolInput.districtAr || schoolInput.district || 'الإدارة التعليمية المركزية').trim(),
      stage: schoolInput.stage || 'PRIMARY',
      studentCount: Math.max(0, Number(schoolInput.studentCount) || 600),
      recipientName: (schoolInput.recipientName || 'أمين التوريدات المدرسية').trim(),
      phone: (schoolInput.phone || '0100-000-0000').trim(),
    };

    const exists = snap.schools.some((s) => s.id === localSchool.id);
    const nextSchools = exists
      ? snap.schools.map((s) => (s.id === localSchool.id ? localSchool : s))
      : [localSchool, ...snap.schools];
    this.saveLocalSnapshot({ schools: nextSchools });

    if (!isOffline && navigator.onLine) {
      try {
        const res = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localSchool),
        });
        if (res.ok) {
          const { school } = await res.json();
          return school;
        }
      } catch {
        // Already saved locally
      }
    }
    return localSchool;
  }

  static async deleteSchool(schoolId: string, isOffline: boolean): Promise<void> {
    const snap = this.loadLocalSnapshot();
    const nextSchools = snap.schools.filter((s) => s.id !== schoolId);
    this.saveLocalSnapshot({ schools: nextSchools });

    if (!isOffline && navigator.onLine) {
      try {
        await fetch(`/api/schools/${schoolId}`, { method: 'DELETE' });
      } catch {
        // Already removed locally
      }
    }
  }

  static async updateUsers(users: UserAccount[]): Promise<UserAccount[]> {
    this.saveLocalSnapshot({ users });
    if (navigator.onLine) {
      try {
        await fetch('/api/entities/users', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ items: users }),
        });
      } catch {
        // Stored locally in Drift + IndexedDB
      }
    }
    return users;
  }

  static async updateWorkspaces(workspaces: WorkspaceEntity[]): Promise<WorkspaceEntity[]> {
    this.saveLocalSnapshot({ workspaces });
    if (navigator.onLine) {
      try {
        await fetch('/api/entities/workspaces', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ items: workspaces }),
        });
      } catch {
        // Stored locally in Drift + IndexedDB
      }
    }
    return workspaces;
  }

  static async updateStocktakingSessions(
    stocktakingSessions: StocktakingSession[]
  ): Promise<StocktakingSession[]> {
    this.saveLocalSnapshot({ stocktakingSessions });
    if (navigator.onLine) {
      try {
        await fetch('/api/entities/stocktakingSessions', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ items: stocktakingSessions }),
        });
      } catch {
        // Stored locally in Drift + IndexedDB
      }
    }
    return stocktakingSessions;
  }

  static async updateDamagedRecords(
    damagedRecords: DamagedBookRecord[]
  ): Promise<DamagedBookRecord[]> {
    this.saveLocalSnapshot({ damagedRecords });
    if (navigator.onLine) {
      try {
        await fetch('/api/entities/damagedRecords', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ items: damagedRecords }),
        });
      } catch {
        // Stored locally in Drift + IndexedDB
      }
    }
    return damagedRecords;
  }

  static getGoogleAppsScriptTemplate(sheetName: string, spreadsheetId?: string): string {
    const cleanId = (spreadsheetId || '').trim();
    const openSheetLine = cleanId
      ? `var ss = SpreadsheetApp.openById("${cleanId}");`
      : `var ss = payload.spreadsheetId ? SpreadsheetApp.openById(payload.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();`;

    return `/**
 * Google Apps Script Auto-Bound Receiver for School Textbook Inventory System
 * نظام إدارة مخازن الكتب المدرسية - الربط التلقائي عبر معرف الشيت (Spreadsheet ID)
 *
 * Linked Spreadsheet ID: ${cleanId || 'Auto-Detected from Payload / Active Sheet'}
 *
 * Deployment Steps:
 * 1. Open your Google Sheet -> Extensions -> Apps Script
 * 2. Paste this script and click Deploy -> New deployment -> Web app
 * 3. Execute as: "Me", Who has access: "Anyone"
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    ${openSheetLine}
    
    // 1. Append Inventory Transactions Ledger
    var txSheet = ss.getSheetByName("${sheetName}_Transactions") || ss.insertSheet("${sheetName}_Transactions");
    if (txSheet.getLastRow() === 0) {
      txSheet.appendRow([
        "Transaction Code", "Date", "Type", "SubType", "Barcode",
        "Book Title (AR)", "Stage", "Grade", "Academic Year",
        "Quantity", "Stock Before", "Stock After", "Reference #",
        "School / Supplier", "Recipient Name", "Recorded By", "Notes"
      ]);
    }
    
    var transactions = payload.transactions || [];
    transactions.forEach(function(trx) {
      txSheet.appendRow([
        trx.transactionCode, trx.createdAt, trx.type, trx.subType, trx.bookBarcode,
        trx.bookTitleAr, trx.stage, trx.grade, trx.academicYear,
        trx.quantity, trx.stockBefore, trx.stockAfter, trx.referenceNumber,
        trx.counterpartyNameAr, trx.recipientPersonName || "", trx.createdBy, trx.notes
      ]);
    });

    // 2. Upsert Books Catalog Stock Snapshot (with UnitType)
    var catalogSheet = ss.getSheetByName("${sheetName}_Catalog") || ss.insertSheet("${sheetName}_Catalog");
    if (catalogSheet.getLastRow() === 0) {
      catalogSheet.appendRow([
        "Barcode", "Title (AR)", "Title (EN)", "Stage", "Grade",
        "Academic Year", "Subject", "Unit Type", "Current Stock", "Min Stock Level", "Updated At"
      ]);
    }

    var books = payload.books || [];
    books.forEach(function(bk) {
      catalogSheet.appendRow([
        bk.barcode, bk.titleAr, bk.title, bk.stage, bk.gradeAr || bk.grade,
        bk.academicYear, bk.subjectAr || bk.subject, bk.unitType || "Unit",
        bk.currentStock, bk.minStockLevel, bk.updatedAt
      ]);
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: "SUCCESS",
      spreadsheetId: ss.getId(),
      syncedTransactions: transactions.length,
      syncedBooks: books.length,
      syncedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "ERROR",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
  }
}
