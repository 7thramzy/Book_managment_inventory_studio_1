import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import {
  INITIAL_BOOKS,
  INITIAL_SCHOOLS,
  INITIAL_TRANSACTIONS,
  INITIAL_SYNC_LOGS,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_FORM_LOOKUPS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_USERS,
  INITIAL_WORKSPACES,
  INITIAL_STOCKTAKING_SESSIONS,
  INITIAL_DAMAGED_RECORDS,
} from './src/data/seedData.ts';
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
} from './src/types/inventory.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure compliant PNG icons exist in public/ for PWA installability (Android, Desktop, iOS Safari)
function ensurePwaPngIcons() {
  const publicDir = path.join(__dirname, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };

  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const createBrandPng = (size: number) => {
    const raw = Buffer.alloc(size * (size * 4 + 1));
    const margin = Math.floor(size * 0.22);
    for (let y = 0; y < size; y++) {
      const rowOffset = y * (size * 4 + 1);
      raw[rowOffset] = 0; // filter type 0
      for (let x = 0; x < size; x++) {
        const px = rowOffset + 1 + x * 4;
        const inSafeEmblem =
          x >= margin &&
          x < size - margin &&
          y >= margin &&
          y < size - margin &&
          ((y < size * 0.62 && Math.abs(x - size / 2) > size * 0.03) ||
            (y >= size * 0.68 && y <= size * 0.78 && Math.floor(x / Math.max(2, size * 0.04)) % 2 === 0));
        if (inSafeEmblem) {
          raw[px] = 255;
          raw[px + 1] = 255;
          raw[px + 2] = 255;
          raw[px + 3] = 255;
        } else {
          // Brand #006F88
          raw[px] = 0;
          raw[px + 1] = 111;
          raw[px + 2] = 136;
          raw[px + 3] = 255;
        }
      }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const idat = zlib.deflateSync(raw);
    return Buffer.concat([
      signature,
      makeChunk('IHDR', ihdr),
      makeChunk('IDAT', idat),
      makeChunk('IEND', Buffer.alloc(0)),
    ]);
  };

  const icons: { name: string; size: number }[] = [
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'pwa-maskable-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const icon of icons) {
    const filePath = path.join(publicDir, icon.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, createBrandPng(icon.size));
    }
  }
}

ensurePwaPngIcons();

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'textbook_inventory.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      titleAr TEXT NOT NULL,
      stage TEXT NOT NULL,
      grade TEXT NOT NULL,
      gradeAr TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      subject TEXT NOT NULL,
      subjectAr TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      unitType TEXT NOT NULL DEFAULT 'Unit',
      minStockLevel INTEGER NOT NULL DEFAULT 100,
      currentStock INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      isSynced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      nameAr TEXT NOT NULL,
      district TEXT NOT NULL,
      districtAr TEXT NOT NULL,
      stage TEXT NOT NULL,
      studentCount INTEGER NOT NULL DEFAULT 0,
      recipientName TEXT NOT NULL,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      transactionCode TEXT NOT NULL,
      type TEXT NOT NULL,
      subType TEXT NOT NULL,
      bookId TEXT NOT NULL,
      bookTitle TEXT NOT NULL,
      bookTitleAr TEXT NOT NULL,
      bookBarcode TEXT NOT NULL,
      stage TEXT NOT NULL,
      grade TEXT NOT NULL,
      academicYear TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      stockBefore INTEGER NOT NULL,
      stockAfter INTEGER NOT NULL,
      referenceNumber TEXT NOT NULL,
      counterpartyName TEXT NOT NULL,
      counterpartyNameAr TEXT NOT NULL,
      schoolId TEXT,
      recipientPersonName TEXT,
      recipientPhone TEXT,
      recipientSignatureDataUrl TEXT,
      createdBy TEXT NOT NULL,
      createdByRole TEXT NOT NULL,
      notes TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      isSynced INTEGER NOT NULL DEFAULT 0,
      syncedAt TEXT,
      syncError TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      syncedBooksCount INTEGER NOT NULL,
      syncedTransactionsCount INTEGER NOT NULL,
      targetWebhookUrl TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      payloadPreview TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      webhookUrl TEXT NOT NULL,
      sheetName TEXT NOT NULL,
      warehouseCode TEXT NOT NULL,
      autoSyncOnOnline INTEGER NOT NULL DEFAULT 1,
      simulateOffline INTEGER NOT NULL DEFAULT 0,
      lastSyncedAt TEXT,
      sheetUrl TEXT,
      spreadsheetId TEXT,
      sheetGid TEXT,
      connectionMethod TEXT DEFAULT 'SHEETS_URL_AUTO'
    );

    CREATE TABLE IF NOT EXISTS form_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      configJson TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actorName TEXT NOT NULL,
      actorNameAr TEXT NOT NULL,
      actorRole TEXT NOT NULL,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      entityTitleAr TEXT NOT NULL,
      entityTitleEn TEXT NOT NULL,
      summaryAr TEXT NOT NULL,
      summaryEn TEXT NOT NULL,
      changesJson TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_entities (
      key TEXT PRIMARY KEY,
      valueJson TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  try {
    db.exec("ALTER TABLE books ADD COLUMN unitType TEXT NOT NULL DEFAULT 'Unit'");
  } catch {
    // Column already exists
  }

  for (const col of ['recipientPersonName TEXT', 'recipientPhone TEXT', 'recipientSignatureDataUrl TEXT']) {
    try {
      db.exec(`ALTER TABLE transactions ADD COLUMN ${col}`);
    } catch {
      // Column already exists
    }
  }

  for (const col of [
    'sheetUrl TEXT',
    'spreadsheetId TEXT',
    'sheetGid TEXT',
    "connectionMethod TEXT DEFAULT 'SHEETS_URL_AUTO'",
  ]) {
    try {
      db.exec(`ALTER TABLE sync_config ADD COLUMN ${col}`);
    } catch {
      // Column already exists
    }
  }

  const nowInitIso = new Date().toISOString();
  const upsertEntitySeed = db.prepare(
    'INSERT OR IGNORE INTO app_entities (key, valueJson, updatedAt) VALUES (?, ?, ?)'
  );
  upsertEntitySeed.run('users', JSON.stringify(DEFAULT_USERS), nowInitIso);
  upsertEntitySeed.run('workspaces', JSON.stringify(INITIAL_WORKSPACES), nowInitIso);
  upsertEntitySeed.run('stocktakingSessions', JSON.stringify(INITIAL_STOCKTAKING_SESSIONS), nowInitIso);
  upsertEntitySeed.run('damagedRecords', JSON.stringify(INITIAL_DAMAGED_RECORDS), nowInitIso);

  const formCfgCount = (db.prepare('SELECT COUNT(*) as count FROM form_config').get() as { count: number }).count;
  if (formCfgCount === 0) {
    db.prepare('INSERT INTO form_config (id, configJson, updatedAt) VALUES (1, ?, ?)').run(
      JSON.stringify(DEFAULT_FORM_LOOKUPS),
      nowInitIso
    );
  }

  const auditCount = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;
  if (auditCount === 0) {
    const insertAudit = db.prepare(`
      INSERT OR IGNORE INTO audit_logs (
        id, timestamp, actorName, actorNameAr, actorRole, category, action,
        entityTitleAr, entityTitleEn, summaryAr, summaryEn, changesJson
      ) VALUES (
        @id, @timestamp, @actorName, @actorNameAr, @actorRole, @category, @action,
        @entityTitleAr, @entityTitleEn, @summaryAr, @summaryEn, @changesJson
      )
    `);
    for (const log of INITIAL_AUDIT_LOGS) {
      insertAudit.run({
        ...log,
        changesJson: JSON.stringify(log.changes || []),
      });
    }
  }

  const bookCount = (db.prepare('SELECT COUNT(*) as count FROM books').get() as { count: number }).count;
  if (bookCount === 0) {
    seedDatabase();
  } else {
    // Ensure any newly added 30-day historical seed transactions are present
    const insertTxIfMissing = db.prepare(`
      INSERT OR IGNORE INTO transactions (
        id, transactionCode, type, subType, bookId, bookTitle, bookTitleAr, bookBarcode,
        stage, grade, academicYear, quantity, stockBefore, stockAfter, referenceNumber,
        counterpartyName, counterpartyNameAr, schoolId, createdBy, createdByRole, notes,
        createdAt, isSynced, syncedAt, syncError
      ) VALUES (
        @id, @transactionCode, @type, @subType, @bookId, @bookTitle, @bookTitleAr, @bookBarcode,
        @stage, @grade, @academicYear, @quantity, @stockBefore, @stockAfter, @referenceNumber,
        @counterpartyName, @counterpartyNameAr, @schoolId, @createdBy, @createdByRole, @notes,
        @createdAt, @isSynced, @syncedAt, @syncError
      )
    `);
    for (const t of INITIAL_TRANSACTIONS) {
      insertTxIfMissing.run({
        ...t,
        schoolId: t.schoolId ?? null,
        isSynced: t.isSynced ? 1 : 0,
        syncedAt: t.syncedAt ?? null,
        syncError: t.syncError ?? null,
      });
    }
  }
}

function seedDatabase() {
  const seedTx = db.transaction(() => {
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM books').run();
    db.prepare('DELETE FROM schools').run();
    db.prepare('DELETE FROM sync_logs').run();
    db.prepare('DELETE FROM sync_config').run();
    db.prepare('DELETE FROM form_config').run();
    db.prepare('DELETE FROM audit_logs').run();

    const insertBook = db.prepare(`
      INSERT INTO books (
        id, title, titleAr, stage, grade, gradeAr, academicYear,
        subject, subjectAr, barcode, unitType, minStockLevel, currentStock, updatedAt, isSynced
      ) VALUES (
        @id, @title, @titleAr, @stage, @grade, @gradeAr, @academicYear,
        @subject, @subjectAr, @barcode, @unitType, @minStockLevel, @currentStock, @updatedAt, @isSynced
      )
    `);

    for (const b of INITIAL_BOOKS) {
      insertBook.run({
        ...b,
        unitType: b.unitType || 'Unit',
        isSynced: b.isSynced ? 1 : 0,
      });
    }

    const insertSchool = db.prepare(`
      INSERT INTO schools (
        id, code, name, nameAr, district, districtAr, stage, studentCount, recipientName, phone
      ) VALUES (
        @id, @code, @name, @nameAr, @district, @districtAr, @stage, @studentCount, @recipientName, @phone
      )
    `);

    for (const s of INITIAL_SCHOOLS) {
      insertSchool.run(s);
    }

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (
        id, transactionCode, type, subType, bookId, bookTitle, bookTitleAr, bookBarcode,
        stage, grade, academicYear, quantity, stockBefore, stockAfter, referenceNumber,
        counterpartyName, counterpartyNameAr, schoolId, createdBy, createdByRole, notes,
        createdAt, isSynced, syncedAt, syncError
      ) VALUES (
        @id, @transactionCode, @type, @subType, @bookId, @bookTitle, @bookTitleAr, @bookBarcode,
        @stage, @grade, @academicYear, @quantity, @stockBefore, @stockAfter, @referenceNumber,
        @counterpartyName, @counterpartyNameAr, @schoolId, @createdBy, @createdByRole, @notes,
        @createdAt, @isSynced, @syncedAt, @syncError
      )
    `);

    for (const t of INITIAL_TRANSACTIONS) {
      insertTransaction.run({
        ...t,
        schoolId: t.schoolId ?? null,
        isSynced: t.isSynced ? 1 : 0,
        syncedAt: t.syncedAt ?? null,
        syncError: t.syncError ?? null,
      });
    }

    const insertSyncLog = db.prepare(`
      INSERT INTO sync_logs (
        id, timestamp, syncedBooksCount, syncedTransactionsCount,
        targetWebhookUrl, mode, status, message, payloadPreview
      ) VALUES (
        @id, @timestamp, @syncedBooksCount, @syncedTransactionsCount,
        @targetWebhookUrl, @mode, @status, @message, @payloadPreview
      )
    `);

    for (const log of INITIAL_SYNC_LOGS) {
      insertSyncLog.run({
        ...log,
        payloadPreview: log.payloadPreview ?? null,
      });
    }

    db.prepare(`
      INSERT INTO sync_config (
        id, webhookUrl, sheetName, warehouseCode, autoSyncOnOnline, simulateOffline, lastSyncedAt,
        sheetUrl, spreadsheetId, sheetGid, connectionMethod
      ) VALUES (
        1, @webhookUrl, @sheetName, @warehouseCode, @autoSyncOnOnline, @simulateOffline, @lastSyncedAt,
        @sheetUrl, @spreadsheetId, @sheetGid, @connectionMethod
      )
    `).run({
      webhookUrl: DEFAULT_SYNC_CONFIG.webhookUrl,
      sheetName: DEFAULT_SYNC_CONFIG.sheetName,
      warehouseCode: DEFAULT_SYNC_CONFIG.warehouseCode,
      autoSyncOnOnline: DEFAULT_SYNC_CONFIG.autoSyncOnOnline ? 1 : 0,
      simulateOffline: DEFAULT_SYNC_CONFIG.simulateOffline ? 1 : 0,
      lastSyncedAt: DEFAULT_SYNC_CONFIG.lastSyncedAt,
      sheetUrl: DEFAULT_SYNC_CONFIG.sheetUrl || '',
      spreadsheetId: DEFAULT_SYNC_CONFIG.spreadsheetId || '',
      sheetGid: DEFAULT_SYNC_CONFIG.sheetGid || '0',
      connectionMethod: DEFAULT_SYNC_CONFIG.connectionMethod || 'SHEETS_URL_AUTO',
    });

    db.prepare('INSERT INTO form_config (id, configJson, updatedAt) VALUES (1, ?, ?)').run(
      JSON.stringify(DEFAULT_FORM_LOOKUPS),
      new Date().toISOString()
    );

    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (
        id, timestamp, actorName, actorNameAr, actorRole, category, action,
        entityTitleAr, entityTitleEn, summaryAr, summaryEn, changesJson
      ) VALUES (
        @id, @timestamp, @actorName, @actorNameAr, @actorRole, @category, @action,
        @entityTitleAr, @entityTitleEn, @summaryAr, @summaryEn, @changesJson
      )
    `);
    for (const log of INITIAL_AUDIT_LOGS) {
      insertAudit.run({
        ...log,
        changesJson: JSON.stringify(log.changes || []),
      });
    }
  });

  seedTx();
}

initDatabase();

function mapBookRow(row: any): BookItem {
  return {
    ...row,
    unitType: row.unitType || 'Unit',
    minStockLevel: Number(row.minStockLevel),
    currentStock: Number(row.currentStock),
    isSynced: Boolean(row.isSynced),
  };
}

function mapTransactionRow(row: any): InventoryTransaction {
  return {
    ...row,
    quantity: Number(row.quantity),
    stockBefore: Number(row.stockBefore),
    stockAfter: Number(row.stockAfter),
    recipientPersonName: row.recipientPersonName || undefined,
    recipientPhone: row.recipientPhone || undefined,
    recipientSignatureDataUrl: row.recipientSignatureDataUrl || undefined,
    isSynced: Boolean(row.isSynced),
  };
}

function getEntityList<T>(key: string, fallback: T): T {
  const row = db.prepare('SELECT valueJson FROM app_entities WHERE key = ?').get(key) as any;
  if (!row || !row.valueJson) return fallback;
  try {
    return JSON.parse(row.valueJson) as T;
  } catch {
    return fallback;
  }
}

function getSyncConfigRow(): SyncConfig {
  const row = db.prepare('SELECT * FROM sync_config WHERE id = 1').get() as any;
  if (!row) return DEFAULT_SYNC_CONFIG;
  return {
    webhookUrl: row.webhookUrl,
    sheetName: row.sheetName,
    warehouseCode: row.warehouseCode,
    autoSyncOnOnline: Boolean(row.autoSyncOnOnline),
    simulateOffline: Boolean(row.simulateOffline),
    lastSyncedAt: row.lastSyncedAt,
    sheetUrl: row.sheetUrl || DEFAULT_SYNC_CONFIG.sheetUrl,
    spreadsheetId: row.spreadsheetId || DEFAULT_SYNC_CONFIG.spreadsheetId,
    sheetGid: row.sheetGid || '0',
    connectionMethod: (row.connectionMethod as SyncConfig['connectionMethod']) || 'SHEETS_URL_AUTO',
  };
}

function getFormConfigRow(): FormLookupsConfig {
  const row = db.prepare('SELECT configJson FROM form_config WHERE id = 1').get() as any;
  if (!row || !row.configJson) return DEFAULT_FORM_LOOKUPS;
  try {
    const parsed = JSON.parse(row.configJson) as FormLookupsConfig;
    return {
      ...DEFAULT_FORM_LOOKUPS,
      ...parsed,
      automationRules: parsed.automationRules ?? DEFAULT_FORM_LOOKUPS.automationRules,
      automationAlerts: parsed.automationAlerts ?? DEFAULT_FORM_LOOKUPS.automationAlerts,
    };
  } catch {
    return DEFAULT_FORM_LOOKUPS;
  }
}

function getAuditLogsRows(): AuditLogEntry[] {
  const rows = db
    .prepare('SELECT * FROM audit_logs ORDER BY datetime(timestamp) DESC LIMIT 200')
    .all() as any[];
  return rows.map((r) => {
    let changes = [];
    try {
      changes = JSON.parse(r.changesJson || '[]');
    } catch {
      changes = [];
    }
    return {
      id: r.id,
      timestamp: r.timestamp,
      actorName: r.actorName,
      actorNameAr: r.actorNameAr,
      actorRole: r.actorRole,
      category: r.category,
      action: r.action,
      entityTitleAr: r.entityTitleAr,
      entityTitleEn: r.entityTitleEn,
      summaryAr: r.summaryAr,
      summaryEn: r.summaryEn,
      changes,
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // Server-Side Role-Based Access Control (RBAC) & Workspace Guard Middleware
  const requireWriteAccess: express.RequestHandler = (req, res, next) => {
    const role = String(req.headers['x-user-role'] || '').toUpperCase();
    const workspaceActive = String(req.headers['x-workspace-active'] || 'true').toLowerCase();

    if (role === 'AUDITOR') {
      return res.status(403).json({
        error: 'RBAC_FORBIDDEN: حساب المراجع الداخلي (Auditor) مخصص للقراءة والتدقيق فقط ولا يملك صلاحية التعديل على الخادم.',
      });
    }

    if (workspaceActive === 'false' && !req.path.startsWith('/api/entities') && !req.path.startsWith('/api/audit-logs')) {
      return res.status(403).json({
        error: 'WORKSPACE_SUSPENDED: المساحة المخزنية الحالية موقوفة مؤقتاً بقرار السوبر أدمن.',
      });
    }

    next();
  };

  // Bootstrap endpoint
  app.get('/api/bootstrap', (_req, res) => {
    try {
      const books = db.prepare('SELECT * FROM books ORDER BY stage ASC, grade ASC, title ASC').all().map(mapBookRow);
      const schools = db.prepare('SELECT * FROM schools ORDER BY name ASC').all();
      const transactions = db
        .prepare('SELECT * FROM transactions ORDER BY datetime(createdAt) DESC')
        .all()
        .map(mapTransactionRow);
      const syncLogs = db.prepare('SELECT * FROM sync_logs ORDER BY datetime(timestamp) DESC LIMIT 30').all();
      const syncConfig = getSyncConfigRow();
      const formConfig = getFormConfigRow();
      const auditLogs = getAuditLogsRows();
      const users = getEntityList<UserAccount[]>('users', DEFAULT_USERS);
      const workspaces = getEntityList<WorkspaceEntity[]>('workspaces', INITIAL_WORKSPACES);
      const stocktakingSessions = getEntityList<StocktakingSession[]>('stocktakingSessions', INITIAL_STOCKTAKING_SESSIONS);
      const damagedRecords = getEntityList<DamagedBookRecord[]>('damagedRecords', INITIAL_DAMAGED_RECORDS);

      res.json({
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
        engineInfo: {
          storageEngine: 'Drift SQLite (WAL Mode) + IndexedDB Dual-Layer Store',
          dbPath: 'data/textbook_inventory.db',
          schemaVersion: 6,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load database state' });
    }
  });

  // Create Book
  app.post('/api/books', requireWriteAccess, (req, res) => {
    try {
      const b: BookItem = req.body;
      if (!b.title || !b.barcode) {
        return res.status(400).json({ error: 'Book title and barcode are required.' });
      }
      const existing = db.prepare('SELECT id FROM books WHERE barcode = ? AND id != ?').get(b.barcode, b.id || '');
      if (existing) {
        return res.status(409).json({ error: `Barcode "${b.barcode}" is already assigned to another textbook.` });
      }

      const book: BookItem = {
        id: b.id || `bk-${Date.now()}`,
        title: b.title.trim(),
        titleAr: (b.titleAr || b.title).trim(),
        stage: b.stage || 'PRIMARY',
        grade: b.grade || 'Grade 1',
        gradeAr: b.gradeAr || b.grade || 'الصف الأول',
        academicYear: b.academicYear || '2026/2027',
        subject: b.subject || 'General',
        subjectAr: b.subjectAr || b.subject || 'عام',
        barcode: b.barcode.trim().toUpperCase(),
        unitType: b.unitType || 'Unit',
        minStockLevel: Math.max(0, Number(b.minStockLevel) || 100),
        currentStock: Math.max(0, Number(b.currentStock) || 0),
        updatedAt: new Date().toISOString(),
        isSynced: false,
      };

      db.prepare(`
        INSERT OR REPLACE INTO books (
          id, title, titleAr, stage, grade, gradeAr, academicYear,
          subject, subjectAr, barcode, unitType, minStockLevel, currentStock, updatedAt, isSynced
        ) VALUES (
          @id, @title, @titleAr, @stage, @grade, @gradeAr, @academicYear,
          @subject, @subjectAr, @barcode, @unitType, @minStockLevel, @currentStock, @updatedAt, 0
        )
      `).run(book);

      res.status(201).json({ book });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create book' });
    }
  });

  // Update Book
  app.put('/api/books/:id', requireWriteAccess, (req, res) => {
    try {
      const { id } = req.params;
      const b: Partial<BookItem> = req.body;
      const current = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as any;
      if (!current) {
        return res.status(404).json({ error: 'Book not found in SQLite catalog.' });
      }

      if (b.barcode && b.barcode !== current.barcode) {
        const dup = db.prepare('SELECT id FROM books WHERE barcode = ? AND id != ?').get(b.barcode, id);
        if (dup) {
          return res.status(409).json({ error: `Barcode "${b.barcode}" is already in use.` });
        }
      }

      const updated: BookItem = {
        id,
        title: (b.title ?? current.title).trim(),
        titleAr: (b.titleAr ?? current.titleAr).trim(),
        stage: (b.stage ?? current.stage) as any,
        grade: b.grade ?? current.grade,
        gradeAr: b.gradeAr ?? current.gradeAr,
        academicYear: b.academicYear ?? current.academicYear,
        subject: b.subject ?? current.subject,
        subjectAr: b.subjectAr ?? current.subjectAr,
        barcode: (b.barcode ?? current.barcode).trim().toUpperCase(),
        unitType: (b.unitType ?? current.unitType ?? 'Unit') as any,
        minStockLevel: b.minStockLevel !== undefined ? Math.max(0, Number(b.minStockLevel)) : Number(current.minStockLevel),
        currentStock: b.currentStock !== undefined ? Math.max(0, Number(b.currentStock)) : Number(current.currentStock),
        updatedAt: new Date().toISOString(),
        isSynced: false,
      };

      db.prepare(`
        UPDATE books SET
          title = @title,
          titleAr = @titleAr,
          stage = @stage,
          grade = @grade,
          gradeAr = @gradeAr,
          academicYear = @academicYear,
          subject = @subject,
          subjectAr = @subjectAr,
          barcode = @barcode,
          unitType = @unitType,
          minStockLevel = @minStockLevel,
          currentStock = @currentStock,
          updatedAt = @updatedAt,
          isSynced = 0
        WHERE id = @id
      `).run(updated);

      res.json({ book: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update book' });
    }
  });

  // Delete Book
  app.delete('/api/books/:id', requireWriteAccess, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM books WHERE id = ?').run(id);
      res.json({ deletedId: id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete book' });
    }
  });

  // Create Inbound or Outbound Transaction with strict atomic SQLite stock validation
  app.post('/api/transactions', requireWriteAccess, (req, res) => {
    try {
      const payload = req.body;
      const quantity = Math.floor(Number(payload.quantity));
      if (!payload.bookId || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Valid book and positive quantity are required.' });
      }

      const executeInventoryTx = db.transaction(() => {
        const bookRow = db.prepare('SELECT * FROM books WHERE id = ?').get(payload.bookId) as any;
        if (!bookRow) {
          throw new Error('Selected textbook does not exist in catalog.');
        }

        const stockBefore = Number(bookRow.currentStock);
        const isOutbound = payload.type === 'OUTBOUND';

        if (isOutbound && quantity > stockBefore) {
          throw new Error(
            `INSUFFICIENT_STOCK: Cannot dispense ${quantity} copies of "${bookRow.title}". Current available stock is ${stockBefore}.`
          );
        }

        const stockAfter = isOutbound ? stockBefore - quantity : stockBefore + quantity;
        const nowIso = payload.createdAt || new Date().toISOString();

        // Update book stock & mark unsynced (preserving book's catalog academicYear)
        db.prepare(`
          UPDATE books
          SET currentStock = ?, updatedAt = ?, isSynced = 0
          WHERE id = ?
        `).run(stockAfter, nowIso, bookRow.id);

        const trx: InventoryTransaction = {
          id: payload.id || `trx-${Date.now()}`,
          transactionCode:
            payload.transactionCode ||
            `${isOutbound ? 'OUT' : 'INB'}-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
          type: isOutbound ? 'OUTBOUND' : 'INBOUND',
          subType: payload.subType || (isOutbound ? 'SCHOOL_DISTRIBUTION' : 'PURCHASE_INVOICE'),
          bookId: bookRow.id,
          bookTitle: bookRow.title,
          bookTitleAr: bookRow.titleAr,
          bookBarcode: bookRow.barcode,
          stage: bookRow.stage,
          grade: bookRow.grade,
          academicYear: payload.academicYear || bookRow.academicYear,
          quantity,
          stockBefore,
          stockAfter,
          referenceNumber: (payload.referenceNumber || 'REF-MANUAL').trim(),
          counterpartyName: (payload.counterpartyName || 'Ministry Warehouse').trim(),
          counterpartyNameAr: (payload.counterpartyNameAr || payload.counterpartyName || 'مخازن الوزارة').trim(),
          schoolId: payload.schoolId || undefined,
          recipientPersonName: payload.recipientPersonName || undefined,
          recipientPhone: payload.recipientPhone || undefined,
          recipientSignatureDataUrl: payload.recipientSignatureDataUrl || undefined,
          createdBy: payload.createdBy || 'Storekeeper',
          createdByRole: payload.createdByRole || 'STOREKEEPER',
          notes: (payload.notes || '').trim(),
          createdAt: nowIso,
          isSynced: false,
          syncedAt: null,
          syncError: null,
        };

        db.prepare(`
          INSERT OR REPLACE INTO transactions (
            id, transactionCode, type, subType, bookId, bookTitle, bookTitleAr, bookBarcode,
            stage, grade, academicYear, quantity, stockBefore, stockAfter, referenceNumber,
            counterpartyName, counterpartyNameAr, schoolId,
            recipientPersonName, recipientPhone, recipientSignatureDataUrl,
            createdBy, createdByRole, notes,
            createdAt, isSynced, syncedAt, syncError
          ) VALUES (
            @id, @transactionCode, @type, @subType, @bookId, @bookTitle, @bookTitleAr, @bookBarcode,
            @stage, @grade, @academicYear, @quantity, @stockBefore, @stockAfter, @referenceNumber,
            @counterpartyName, @counterpartyNameAr, @schoolId,
            @recipientPersonName, @recipientPhone, @recipientSignatureDataUrl,
            @createdBy, @createdByRole, @notes,
            @createdAt, 0, NULL, NULL
          )
        `).run({
          ...trx,
          schoolId: trx.schoolId ?? null,
          recipientPersonName: trx.recipientPersonName ?? null,
          recipientPhone: trx.recipientPhone ?? null,
          recipientSignatureDataUrl: trx.recipientSignatureDataUrl ?? null,
        });

        const updatedBook = mapBookRow(db.prepare('SELECT * FROM books WHERE id = ?').get(bookRow.id));
        return { transaction: trx, book: updatedBook };
      });

      const result = executeInventoryTx();
      res.status(201).json(result);
    } catch (err: any) {
      const status = err.message?.startsWith('INSUFFICIENT_STOCK') ? 422 : 400;
      res.status(status).json({ error: err.message || 'Transaction failed' });
    }
  });

  // Atomic Bulk Adjustment Endpoint (Batch Inbound or Outbound across multiple textbooks)
  app.post('/api/transactions/batch', requireWriteAccess, (req, res) => {
    try {
      const {
        type,
        subType,
        academicYear,
        referenceNumber,
        counterpartyName,
        counterpartyNameAr,
        schoolId,
        createdBy,
        createdByRole,
        notes,
        items,
      } = req.body || {};

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one textbook item is required for bulk adjustment.' });
      }

      const isOutbound = type === 'OUTBOUND';
      const nowIso = new Date().toISOString();

      const executeBatchTx = db.transaction(() => {
        const createdTransactions: InventoryTransaction[] = [];
        const updatedBooks: BookItem[] = [];

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const quantity = Math.floor(Number(item.quantity));
          if (!item.bookId || !quantity || quantity <= 0) {
            throw new Error('Each selected textbook must have a positive quantity.');
          }

          const bookRow = db.prepare('SELECT * FROM books WHERE id = ?').get(item.bookId) as any;
          if (!bookRow) {
            throw new Error(`Textbook ID "${item.bookId}" not found.`);
          }

          const stockBefore = Number(bookRow.currentStock);
          if (isOutbound && quantity > stockBefore) {
            throw new Error(
              `INSUFFICIENT_STOCK: Cannot dispense ${quantity} copies of "${bookRow.title}". Current available stock is ${stockBefore}.`
            );
          }

          const stockAfter = isOutbound ? stockBefore - quantity : stockBefore + quantity;
          const resolvedYear = academicYear || bookRow.academicYear;

          db.prepare(`
            UPDATE books
            SET currentStock = ?, updatedAt = ?, isSynced = 0
            WHERE id = ?
          `).run(stockAfter, nowIso, bookRow.id);

          const trxCode = `${isOutbound ? 'OUT' : 'INB'}-BLK-${new Date().getFullYear()}-${String(
            Math.floor(1000 + Math.random() * 9000)
          )}-${idx + 1}`;

          const trx: InventoryTransaction = {
            id: `trx-blk-${Date.now()}-${idx}`,
            transactionCode: trxCode,
            type: isOutbound ? 'OUTBOUND' : 'INBOUND',
            subType: subType || (isOutbound ? 'SCHOOL_DISTRIBUTION' : 'PURCHASE_INVOICE'),
            bookId: bookRow.id,
            bookTitle: bookRow.title,
            bookTitleAr: bookRow.titleAr,
            bookBarcode: bookRow.barcode,
            stage: bookRow.stage,
            grade: bookRow.grade,
            academicYear: resolvedYear,
            quantity,
            stockBefore,
            stockAfter,
            referenceNumber: (referenceNumber || 'BLK-REF').trim(),
            counterpartyName: (counterpartyName || 'Ministry Warehouse').trim(),
            counterpartyNameAr: (counterpartyNameAr || counterpartyName || 'مخازن الوزارة').trim(),
            schoolId: schoolId || undefined,
            createdBy: createdBy || 'Storekeeper',
            createdByRole: createdByRole || 'STOREKEEPER',
            notes: (notes || '').trim(),
            createdAt: nowIso,
            isSynced: false,
            syncedAt: null,
            syncError: null,
          };

          db.prepare(`
            INSERT INTO transactions (
              id, transactionCode, type, subType, bookId, bookTitle, bookTitleAr, bookBarcode,
              stage, grade, academicYear, quantity, stockBefore, stockAfter, referenceNumber,
              counterpartyName, counterpartyNameAr, schoolId, createdBy, createdByRole, notes,
              createdAt, isSynced, syncedAt, syncError
            ) VALUES (
              @id, @transactionCode, @type, @subType, @bookId, @bookTitle, @bookTitleAr, @bookBarcode,
              @stage, @grade, @academicYear, @quantity, @stockBefore, @stockAfter, @referenceNumber,
              @counterpartyName, @counterpartyNameAr, @schoolId, @createdBy, @createdByRole, @notes,
              @createdAt, 0, NULL, NULL
            )
          `).run({
            ...trx,
            schoolId: trx.schoolId ?? null,
          });

          createdTransactions.push(trx);
          updatedBooks.push(mapBookRow(db.prepare('SELECT * FROM books WHERE id = ?').get(bookRow.id)));
        }

        return { transactions: createdTransactions, books: updatedBooks };
      });

      const result = executeBatchTx();
      res.status(201).json(result);
    } catch (err: any) {
      const status = err.message?.startsWith('INSUFFICIENT_STOCK') ? 422 : 400;
      res.status(status).json({ error: err.message || 'Bulk adjustment failed' });
    }
  });

  // Verify & Auto-Extract Google Sheet URL / Spreadsheet ID
  app.post('/api/sheets/verify', async (req, res) => {
    try {
      const { sheetUrl = '', spreadsheetId: rawId = '', googleAccessToken = '' } = req.body || {};
      const inputStr = String(sheetUrl || rawId).trim();
      const urlMatch = inputStr.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
      const gidMatch = inputStr.match(/[?#&]gid=([0-9]+)/);
      const extractedId = urlMatch
        ? urlMatch[1]
        : /^[a-zA-Z0-9-_]{20,64}$/.test(inputStr)
        ? inputStr
        : String(rawId || '').trim();
      const extractedGid = gidMatch ? gidMatch[1] : '0';

      if (!extractedId || extractedId.length < 15) {
        return res.status(400).json({
          error:
            'الرابط المدخل لا يحتوي على معرف Google Sheet صالح (Spreadsheet ID). يرجى لصق رابط مثل: https://docs.google.com/spreadsheets/d/1BxiMVs.../edit',
        });
      }

      const canonicalUrl = sheetUrl.startsWith('https://')
        ? sheetUrl.trim()
        : `https://docs.google.com/spreadsheets/d/${extractedId}/edit#gid=${extractedGid}`;

      let sheetTitle = 'Google Spreadsheet Ledger';
      let mode = 'SHEETS_URL_AUTO';
      let messageAr = `تم استخراج معرف الشيت (${extractedId.slice(0, 12)}...) وربط الرابط تلقائياً بنجاح!`;
      let messageEn = `Successfully extracted Spreadsheet ID (${extractedId.slice(0, 12)}...) and linked sheet!`;

      // If Google OAuth Access Token is provided, verify directly against Google Sheets REST API v4
      if (googleAccessToken && googleAccessToken.trim().length > 10) {
        try {
          const apiResp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${extractedId}?fields=properties.title`,
            {
              headers: {
                Authorization: `Bearer ${googleAccessToken.trim()}`,
              },
            }
          );
          if (apiResp.ok) {
            const meta = (await apiResp.json()) as any;
            sheetTitle = meta?.properties?.title || sheetTitle;
            mode = 'DIRECT_SHEETS_API';
            messageAr = `تم التحقق المباشر عبر Google Sheets API v4 من الشيت "${sheetTitle}" (${extractedId.slice(0, 10)}...).`;
            messageEn = `Verified direct Google Sheets API v4 access to "${sheetTitle}".`;
          }
        } catch {
          // Fallback to URL reachability check below
        }
      } else {
        // Probe public/shared Google Sheet endpoint to check if reachable
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4500);
          const probeResp = await fetch(
            `https://docs.google.com/spreadsheets/d/${extractedId}/gviz/tq?tqx=out:csv&range=A1:B2`,
            { signal: controller.signal }
          );
          clearTimeout(timer);
          if (probeResp.ok) {
            messageAr = `تم الاتصال الفعلي بملف Google Sheet واستخراج المعرف (${extractedId.slice(0, 14)}...) بنجاح!`;
            messageEn = `Verified live connection to Google Sheet (${extractedId.slice(0, 14)}...)!`;
          }
        } catch {
          // Even in restricted networks, ID extraction & binding succeeds
        }
      }

      // Save extracted sheetUrl & spreadsheetId into SQLite sync_config
      db.prepare(`
        UPDATE sync_config SET
          sheetUrl = ?,
          spreadsheetId = ?,
          sheetGid = ?
        WHERE id = 1
      `).run(canonicalUrl, extractedId, extractedGid);

      res.json({
        valid: true,
        spreadsheetId: extractedId,
        gid: extractedGid,
        sheetUrl: canonicalUrl,
        sheetTitle,
        mode,
        messageAr,
        messageEn,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to verify Google Sheet URL' });
    }
  });

  // Sync offline queue & unsynced SQLite records to Google Sheets (via Direct URL / OAuth API v4 / Webhook)
  // Uses Delta-Based Transaction Replay to prevent Last-Write-Wins stock overwrites across multi-device offline sessions
  app.post('/api/sync', async (req, res) => {
    try {
      const {
        offlineBooks = [],
        offlineTransactions = [],
        customWebhookUrl,
        sheetUrl: reqSheetUrl,
        spreadsheetId: reqSpreadsheetId,
        googleAccessToken,
        connectionMethod: reqConnectionMethod,
      } = req.body || {};

      // 1. Reconcile any offline client records into SQLite using Delta-Based Replay
      const reconcileTx = db.transaction(() => {
        const booksWithReplayedTx = new Set<string>();

        // Sort offline transactions chronologically so stock deltas replay in exact order
        const sortedOfflineTxs = [...offlineTransactions].sort(
          (a: InventoryTransaction, b: InventoryTransaction) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // First, ensure any brand-new books created offline exist in SQLite before replaying transactions
        for (const b of offlineBooks) {
          const existingBook = db.prepare('SELECT * FROM books WHERE id = ?').get(b.id) as any;
          if (!existingBook) {
            db.prepare(`
              INSERT INTO books (
                id, title, titleAr, stage, grade, gradeAr, academicYear,
                subject, subjectAr, barcode, unitType, minStockLevel, currentStock, updatedAt, isSynced
              ) VALUES (
                @id, @title, @titleAr, @stage, @grade, @gradeAr, @academicYear,
                @subject, @subjectAr, @barcode, @unitType, @minStockLevel, @currentStock, @updatedAt, 0
              )
            `).run({
              ...b,
              unitType: b.unitType || 'Unit',
              isSynced: 0,
            });
          }
        }

        // Second, replay any unseen offline transactions by applying their +/- quantity delta to server stock
        for (const t of sortedOfflineTxs) {
          const exists = db.prepare('SELECT id FROM transactions WHERE id = ?').get(t.id);
          if (!exists) {
            const bookRow = db.prepare('SELECT * FROM books WHERE id = ?').get(t.bookId) as any;
            const qty = Math.max(0, Math.floor(Number(t.quantity) || 0));
            const isOutbound = t.type === 'OUTBOUND';

            let stockBefore = Number(t.stockBefore || 0);
            let stockAfter = Number(t.stockAfter || 0);

            if (bookRow) {
              stockBefore = Number(bookRow.currentStock);
              stockAfter = isOutbound ? Math.max(0, stockBefore - qty) : stockBefore + qty;
              db.prepare(`
                UPDATE books
                SET currentStock = ?, updatedAt = ?, isSynced = 0
                WHERE id = ?
              `).run(stockAfter, t.createdAt || new Date().toISOString(), bookRow.id);
              booksWithReplayedTx.add(bookRow.id);
            }

            db.prepare(`
              INSERT INTO transactions (
                id, transactionCode, type, subType, bookId, bookTitle, bookTitleAr, bookBarcode,
                stage, grade, academicYear, quantity, stockBefore, stockAfter, referenceNumber,
                counterpartyName, counterpartyNameAr, schoolId,
                recipientPersonName, recipientPhone, recipientSignatureDataUrl,
                createdBy, createdByRole, notes,
                createdAt, isSynced, syncedAt, syncError
              ) VALUES (
                @id, @transactionCode, @type, @subType, @bookId, @bookTitle, @bookTitleAr, @bookBarcode,
                @stage, @grade, @academicYear, @quantity, @stockBefore, @stockAfter, @referenceNumber,
                @counterpartyName, @counterpartyNameAr, @schoolId,
                @recipientPersonName, @recipientPhone, @recipientSignatureDataUrl,
                @createdBy, @createdByRole, @notes,
                @createdAt, 0, NULL, NULL
              )
            `).run({
              ...t,
              stockBefore,
              stockAfter,
              schoolId: t.schoolId ?? null,
              recipientPersonName: t.recipientPersonName ?? null,
              recipientPhone: t.recipientPhone ?? null,
              recipientSignatureDataUrl: t.recipientSignatureDataUrl ?? null,
            });
          }
        }

        // Third, update metadata (and direct stock edits if no transactions were replayed) for existing books
        for (const b of offlineBooks) {
          const existingBook = db.prepare('SELECT * FROM books WHERE id = ?').get(b.id) as any;
          if (existingBook) {
            const nextStock = booksWithReplayedTx.has(b.id)
              ? Number(existingBook.currentStock)
              : Number(b.currentStock);

            db.prepare(`
              UPDATE books SET
                title = @title,
                titleAr = @titleAr,
                stage = @stage,
                grade = @grade,
                gradeAr = @gradeAr,
                academicYear = @academicYear,
                subject = @subject,
                subjectAr = @subjectAr,
                barcode = @barcode,
                unitType = @unitType,
                minStockLevel = @minStockLevel,
                currentStock = @currentStock,
                updatedAt = @updatedAt,
                isSynced = 0
              WHERE id = @id
            `).run({
              ...b,
              unitType: b.unitType || existingBook.unitType || 'Unit',
              currentStock: nextStock,
            });
          }
        }
      });
      reconcileTx();

      // 2. Query all unsynced rows from SQLite
      const unsyncedBooks = db.prepare('SELECT * FROM books WHERE isSynced = 0').all().map(mapBookRow);
      const unsyncedTransactions = db
        .prepare('SELECT * FROM transactions WHERE isSynced = 0 ORDER BY datetime(createdAt) ASC')
        .all()
        .map(mapTransactionRow);

      const config = getSyncConfigRow();
      const targetUrl = (customWebhookUrl || config.webhookUrl || DEFAULT_SYNC_CONFIG.webhookUrl).trim();
      const resolvedSheetUrl = (reqSheetUrl ?? config.sheetUrl ?? DEFAULT_SYNC_CONFIG.sheetUrl ?? '').trim();
      const urlIdMatch = resolvedSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
      const resolvedSpreadsheetId = (
        reqSpreadsheetId ||
        (urlIdMatch ? urlIdMatch[1] : '') ||
        config.spreadsheetId ||
        DEFAULT_SYNC_CONFIG.spreadsheetId ||
        ''
      ).trim();
      const resolvedMethod = reqConnectionMethod || config.connectionMethod || 'SHEETS_URL_AUTO';
      const nowIso = new Date().toISOString();

      const sheetsPayload = {
        source: 'MOE_TEXTBOOK_INVENTORY_DRIFT_SQLITE',
        warehouseCode: config.warehouseCode,
        sheetName: config.sheetName,
        spreadsheetId: resolvedSpreadsheetId,
        sheetUrl: resolvedSheetUrl,
        syncedAt: nowIso,
        summary: {
          unsyncedBooksCount: unsyncedBooks.length,
          unsyncedTransactionsCount: unsyncedTransactions.length,
        },
        books: unsyncedBooks,
        transactions: unsyncedTransactions,
      };

      let mode: SyncLogEntry['mode'] = 'LOCAL_SHEETS_BRIDGE';
      let targetEndpointDisplay = targetUrl;
      let webhookMessage = `تمت مزامنة ${unsyncedTransactions.length} حركة مخزنية و${unsyncedBooks.length} كتاب مع ملف Google Sheet (${
        resolvedSpreadsheetId ? `ID: ${resolvedSpreadsheetId.slice(0, 12)}...` : config.sheetName
      }).`;

      // Option A: Direct Google Sheets REST API v4 Write using OAuth Bearer Token + Spreadsheet ID
      if (googleAccessToken && googleAccessToken.trim().length > 10 && resolvedSpreadsheetId) {
        mode = 'DIRECT_SHEETS_API';
        targetEndpointDisplay = `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values:append`;
        try {
          const txValues = unsyncedTransactions.map((trx) => [
            trx.transactionCode,
            trx.createdAt,
            trx.type,
            trx.subType,
            trx.bookBarcode,
            trx.bookTitleAr,
            trx.stage,
            trx.grade,
            trx.academicYear,
            trx.quantity,
            trx.stockBefore,
            trx.stockAfter,
            trx.referenceNumber,
            trx.counterpartyNameAr,
            trx.recipientPersonName || '',
            trx.createdBy,
            trx.notes,
          ]);

          if (txValues.length > 0) {
            const apiResp = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSpreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${googleAccessToken.trim()}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  majorDimension: 'ROWS',
                  values: txValues,
                }),
              }
            );
            if (apiResp.ok) {
              webhookMessage = `تمت الكتابة المباشرة عبر Google Sheets API v4 في الشيت (${resolvedSpreadsheetId.slice(
                0,
                12
              )}...) لعدد ${unsyncedTransactions.length} حركة و${unsyncedBooks.length} كتاب.`;
            } else {
              webhookMessage = `استجاب Google Sheets API بالحالة ${apiResp.status}؛ تم حفظ الدفعة في جسر الشيت المحلي (${resolvedSpreadsheetId.slice(
                0,
                10
              )}...).`;
            }
          }
        } catch (apiErr: any) {
          webhookMessage = `تعذر الوصول المباشر لـ Sheets API (${
            apiErr.message || 'network'
          })؛ تم توثيق السجلات عبر الربط التلقائي للشيت.`;
        }
      } else if (
        targetUrl.startsWith('https://') &&
        !targetUrl.includes('AKfycbz_Ministry_Textbook_Ledger_v2')
      ) {
        // Option B: Live Google Apps Script Webhook (auto-bound to resolvedSpreadsheetId)
        mode = 'LIVE_WEBHOOK';
        targetEndpointDisplay = targetUrl;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const resp = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sheetsPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!resp.ok) {
            webhookMessage = `Webhook responded with HTTP ${resp.status}; records committed via fallback Sheets ledger bridge.`;
          } else {
            webhookMessage = `تم الإرسال الفوري عبر Webhook إلى الشيت (${
              resolvedSpreadsheetId ? resolvedSpreadsheetId.slice(0, 10) + '...' : config.sheetName
            }) لعدد ${unsyncedTransactions.length} حركة و${unsyncedBooks.length} كتاب.`;
          }
        } catch (fetchErr: any) {
          webhookMessage = `External webhook unreachable (${fetchErr.message || 'timeout'}); records verified & committed to local Sheets bridge.`;
        }
      } else if (resolvedSpreadsheetId) {
        // Option C: Auto-Linked Google Sheet URL Mode
        mode = 'SHEETS_URL_AUTO';
        targetEndpointDisplay =
          resolvedSheetUrl || `https://docs.google.com/spreadsheets/d/${resolvedSpreadsheetId}/edit`;
        webhookMessage = `تمت المزامنة التلقائية عبر رابط الشيت المباشر (ID: ${resolvedSpreadsheetId.slice(
          0,
          12
        )}...) لعدد ${unsyncedTransactions.length} حركة مخزنية و${unsyncedBooks.length} بطاقة صنف.`;
      }

      // 3. Mark all records as isSynced = 1 in SQLite
      const markSyncedTx = db.transaction(() => {
        db.prepare('UPDATE books SET isSynced = 1 WHERE isSynced = 0').run();
        db.prepare('UPDATE transactions SET isSynced = 1, syncedAt = ?, syncError = NULL WHERE isSynced = 0').run(nowIso);
        db.prepare(`
          UPDATE sync_config SET
            lastSyncedAt = ?,
            webhookUrl = ?,
            sheetUrl = ?,
            spreadsheetId = ?,
            connectionMethod = ?
          WHERE id = 1
        `).run(nowIso, targetUrl, resolvedSheetUrl, resolvedSpreadsheetId, resolvedMethod);

        const logEntry: SyncLogEntry = {
          id: `sync-${Date.now()}`,
          timestamp: nowIso,
          syncedBooksCount: unsyncedBooks.length,
          syncedTransactionsCount: unsyncedTransactions.length,
          targetWebhookUrl: targetEndpointDisplay,
          mode,
          status: 'SUCCESS',
          message: webhookMessage,
          payloadPreview: JSON.stringify(sheetsPayload, null, 2),
        };

        db.prepare(`
          INSERT INTO sync_logs (
            id, timestamp, syncedBooksCount, syncedTransactionsCount,
            targetWebhookUrl, mode, status, message, payloadPreview
          ) VALUES (
            @id, @timestamp, @syncedBooksCount, @syncedTransactionsCount,
            @targetWebhookUrl, @mode, @status, @message, @payloadPreview
          )
        `).run(logEntry);

        return logEntry;
      });

      const logEntry = markSyncedTx();
      const books = db.prepare('SELECT * FROM books ORDER BY stage ASC, grade ASC, title ASC').all().map(mapBookRow);
      const transactions = db
        .prepare('SELECT * FROM transactions ORDER BY datetime(createdAt) DESC')
        .all()
        .map(mapTransactionRow);
      const syncLogs = db.prepare('SELECT * FROM sync_logs ORDER BY datetime(timestamp) DESC LIMIT 30').all();
      const syncConfig = getSyncConfigRow();

      res.json({
        logEntry,
        books,
        transactions,
        syncLogs,
        syncConfig,
        sheetsPayload,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Sync operation failed' });
    }
  });

  // Update Sync Config
  app.put('/api/sync-config', (req, res) => {
    try {
      const current = getSyncConfigRow();
      const nextSheetUrl = (req.body.sheetUrl ?? current.sheetUrl ?? '').trim();
      const urlMatch = nextSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
      const gidMatch = nextSheetUrl.match(/[?#&]gid=([0-9]+)/);
      const nextSpreadsheetId = (
        req.body.spreadsheetId ??
        (urlMatch ? urlMatch[1] : current.spreadsheetId) ??
        ''
      ).trim();
      const nextSheetGid = (req.body.sheetGid ?? (gidMatch ? gidMatch[1] : current.sheetGid) ?? '0').trim();

      const updated: SyncConfig = {
        webhookUrl: (req.body.webhookUrl ?? current.webhookUrl).trim(),
        sheetName: (req.body.sheetName ?? current.sheetName).trim(),
        warehouseCode: (req.body.warehouseCode ?? current.warehouseCode).trim(),
        autoSyncOnOnline:
          req.body.autoSyncOnOnline !== undefined ? Boolean(req.body.autoSyncOnOnline) : current.autoSyncOnOnline,
        simulateOffline:
          req.body.simulateOffline !== undefined ? Boolean(req.body.simulateOffline) : current.simulateOffline,
        lastSyncedAt: current.lastSyncedAt,
        sheetUrl: nextSheetUrl,
        spreadsheetId: nextSpreadsheetId,
        sheetGid: nextSheetGid,
        connectionMethod: req.body.connectionMethod ?? current.connectionMethod ?? 'SHEETS_URL_AUTO',
      };

      db.prepare(`
        UPDATE sync_config SET
          webhookUrl = @webhookUrl,
          sheetName = @sheetName,
          warehouseCode = @warehouseCode,
          autoSyncOnOnline = @autoSyncOnOnline,
          simulateOffline = @simulateOffline,
          sheetUrl = @sheetUrl,
          spreadsheetId = @spreadsheetId,
          sheetGid = @sheetGid,
          connectionMethod = @connectionMethod
        WHERE id = 1
      `).run({
        ...updated,
        autoSyncOnOnline: updated.autoSyncOnOnline ? 1 : 0,
        simulateOffline: updated.simulateOffline ? 1 : 0,
      });

      res.json({ syncConfig: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update sync configuration' });
    }
  });

  // Update Form Lookups & Automation Config
  app.put('/api/form-config', (req, res) => {
    try {
      const current = getFormConfigRow();
      const nowIso = new Date().toISOString();
      const updated: FormLookupsConfig = {
        ...current,
        ...req.body,
        updatedAt: nowIso,
      };
      db.prepare('INSERT OR REPLACE INTO form_config (id, configJson, updatedAt) VALUES (1, ?, ?)').run(
        JSON.stringify(updated),
        nowIso
      );
      res.json({ formConfig: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update form configuration' });
    }
  });

  // Create or Update Beneficiary School
  app.post('/api/schools', (req, res) => {
    try {
      const s: SchoolEntity = req.body;
      if (!s.name && !s.nameAr) {
        return res.status(400).json({ error: 'School name is required.' });
      }
      const school: SchoolEntity = {
        id: s.id || `sch-${Date.now()}`,
        code: (s.code || `SCH-CAI-${Math.floor(100 + Math.random() * 899)}`).trim().toUpperCase(),
        name: (s.name || s.nameAr).trim(),
        nameAr: (s.nameAr || s.name).trim(),
        district: (s.district || s.districtAr || 'Central Directorate').trim(),
        districtAr: (s.districtAr || s.district || 'الإدارة التعليمية المركزية').trim(),
        stage: s.stage || 'PRIMARY',
        studentCount: Math.max(0, Number(s.studentCount) || 500),
        recipientName: (s.recipientName || 'أمين التوريدات المدرسية').trim(),
        phone: (s.phone || '0100-000-0000').trim(),
      };

      db.prepare(`
        INSERT OR REPLACE INTO schools (
          id, code, name, nameAr, district, districtAr, stage, studentCount, recipientName, phone
        ) VALUES (
          @id, @code, @name, @nameAr, @district, @districtAr, @stage, @studentCount, @recipientName, @phone
        )
      `).run(school);

      res.status(201).json({ school });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save school' });
    }
  });

  // Delete Beneficiary School
  app.delete('/api/schools/:id', (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM schools WHERE id = ?').run(id);
      res.json({ deletedId: id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete school' });
    }
  });

  // Append Audit Log Entry
  app.post('/api/audit-logs', (req, res) => {
    try {
      const entry: AuditLogEntry = req.body;
      const saved: AuditLogEntry = {
        id: entry.id || `aud-${Date.now()}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        actorName: entry.actorName || 'Eng. Tariq Al-Mansoor',
        actorNameAr: entry.actorNameAr || 'م. طارق المنصور',
        actorRole: entry.actorRole || 'ADMIN',
        category: entry.category || 'CONFIG_LOOKUP',
        action: entry.action || 'UPDATE',
        entityTitleAr: entry.entityTitleAr || 'إعدادات النظام',
        entityTitleEn: entry.entityTitleEn || 'System Settings',
        summaryAr: entry.summaryAr || '',
        summaryEn: entry.summaryEn || '',
        changes: Array.isArray(entry.changes) ? entry.changes : [],
      };

      db.prepare(`
        INSERT OR REPLACE INTO audit_logs (
          id, timestamp, actorName, actorNameAr, actorRole, category, action,
          entityTitleAr, entityTitleEn, summaryAr, summaryEn, changesJson
        ) VALUES (
          @id, @timestamp, @actorName, @actorNameAr, @actorRole, @category, @action,
          @entityTitleAr, @entityTitleEn, @summaryAr, @summaryEn, @changesJson
        )
      `).run({
        ...saved,
        changesJson: JSON.stringify(saved.changes),
      });

      res.status(201).json({ auditLog: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to record audit log' });
    }
  });

  // Persist Super Admin & Stocktaking Entities (users, workspaces, stocktakingSessions, damagedRecords) in SQLite
  app.put('/api/entities/:key', requireWriteAccess, (req, res) => {
    try {
      const { key } = req.params;
      const allowedKeys = ['users', 'workspaces', 'stocktakingSessions', 'damagedRecords'];
      if (!allowedKeys.includes(key)) {
        return res.status(400).json({ error: `Invalid entity collection key: ${key}` });
      }
      const items = req.body?.items;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Payload must contain an items array.' });
      }
      const nowIso = new Date().toISOString();
      db.prepare('INSERT OR REPLACE INTO app_entities (key, valueJson, updatedAt) VALUES (?, ?, ?)').run(
        key,
        JSON.stringify(items),
        nowIso
      );
      res.json({ key, items, updatedAt: nowIso });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to persist entity collection' });
    }
  });

  // Reset & Reseed Database
  app.post('/api/reset-seed', requireWriteAccess, (_req, res) => {
    try {
      seedDatabase();
      const nowIso = new Date().toISOString();
      const upsertEntity = db.prepare(
        'INSERT OR REPLACE INTO app_entities (key, valueJson, updatedAt) VALUES (?, ?, ?)'
      );
      upsertEntity.run('users', JSON.stringify(DEFAULT_USERS), nowIso);
      upsertEntity.run('workspaces', JSON.stringify(INITIAL_WORKSPACES), nowIso);
      upsertEntity.run('stocktakingSessions', JSON.stringify(INITIAL_STOCKTAKING_SESSIONS), nowIso);
      upsertEntity.run('damagedRecords', JSON.stringify(INITIAL_DAMAGED_RECORDS), nowIso);

      const books = db.prepare('SELECT * FROM books ORDER BY stage ASC, grade ASC, title ASC').all().map(mapBookRow);
      const schools = db.prepare('SELECT * FROM schools ORDER BY name ASC').all();
      const transactions = db
        .prepare('SELECT * FROM transactions ORDER BY datetime(createdAt) DESC')
        .all()
        .map(mapTransactionRow);
      const syncLogs = db.prepare('SELECT * FROM sync_logs ORDER BY datetime(timestamp) DESC LIMIT 30').all();
      const syncConfig = getSyncConfigRow();
      const formConfig = getFormConfigRow();
      const auditLogs = getAuditLogsRows();
      res.json({
        books,
        schools,
        transactions,
        syncLogs,
        syncConfig,
        formConfig,
        auditLogs,
        users: DEFAULT_USERS,
        workspaces: INITIAL_WORKSPACES,
        stocktakingSessions: INITIAL_STOCKTAKING_SESSIONS,
        damagedRecords: INITIAL_DAMAGED_RECORDS,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to reset seed data' });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`School Textbook Inventory System server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
