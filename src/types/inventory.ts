export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STOREKEEPER' | 'AUDITOR';

export type AppTabKey =
  | 'DASHBOARD'
  | 'CATALOG'
  | 'TRANSACTIONS'
  | 'STOCKTAKING'
  | 'SUPER_ADMIN'
  | 'CONFIG'
  | 'SYNC';

export type UserPermissionKey =
  | 'MANAGE_USERS'
  | 'MANAGE_WORKSPACES'
  | 'CATALOG_WRITE'
  | 'TRANSACTIONS_WRITE'
  | 'STOCKTAKING_APPROVE'
  | 'DAMAGED_QUARANTINE'
  | 'CONFIG_WRITE'
  | 'EXPORT_REPORTS';

export interface UserAccount {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  fullNameAr: string;
  role: UserRole;
  department: string;
  departmentAr: string;
  badgeCode: string;
  email?: string;
  phone?: string;
  workspaceId?: string;
  isActive?: boolean;
  permissions?: UserPermissionKey[];
  allowedTabs?: AppTabKey[];
  lastLoginAt?: string;
}

export interface WorkspaceEntity {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  location: string;
  locationAr: string;
  managerNameAr: string;
  phone: string;
  capacityCopies: number;
  isActive: boolean;
  notesAr?: string;
  updatedAt: string;
}

export interface StocktakingLineItem {
  bookId: string;
  bookTitleAr: string;
  bookTitleEn: string;
  bookBarcode: string;
  systemStock: number;
  countedStock: number;
  difference: number;
  note?: string;
}

export interface StocktakingSession {
  id: string;
  sessionCode: string;
  titleAr: string;
  titleEn: string;
  workspaceId: string;
  status: 'IN_PROGRESS' | 'RECONCILED';
  createdBy: string;
  createdAt: string;
  reconciledAt?: string | null;
  lines: StocktakingLineItem[];
}

export type DamageReasonType =
  | 'PRINTING_DEFECT'
  | 'TRANSPORT_DAMAGE'
  | 'SCHOOL_SURPLUS_RETURN'
  | 'STORAGE_WEAR';

export type DamagedRecordStatus = 'QUARANTINED' | 'RESTORED_TO_STOCK' | 'WRITTEN_OFF';

export interface DamagedBookRecord {
  id: string;
  recordCode: string;
  bookId: string;
  bookTitleAr: string;
  bookTitleEn: string;
  bookBarcode: string;
  quantity: number;
  reason: DamageReasonType;
  sourceEntityAr: string;
  status: DamagedRecordStatus;
  reportedBy: string;
  createdAt: string;
  notes: string;
}

export type EducationalStage = 'PRIMARY' | 'PREPARATORY' | 'SECONDARY';

export type BookUnitType = 'Unit' | 'Dozen' | 'Bundle';

export interface BookItem {
  id: string;
  title: string;
  titleAr: string;
  stage: EducationalStage;
  grade: string;
  gradeAr: string;
  academicYear: string;
  subject: string;
  subjectAr: string;
  barcode: string;
  unitType?: BookUnitType;
  minStockLevel: number;
  currentStock: number;
  updatedAt: string;
  isSynced: boolean;
}

export interface SchoolEntity {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  district: string;
  districtAr: string;
  stage: EducationalStage;
  studentCount: number;
  recipientName: string;
  phone: string;
}

export interface SupplierEntity {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  type: 'PRINTING_PRESS' | 'RESERVE_SECTOR' | 'PUBLISHER';
}

export interface SubjectOption {
  id: string;
  en: string;
  ar: string;
  code: string;
}

export interface GradeOption {
  id: string;
  stage: EducationalStage;
  en: string;
  ar: string;
  code: string;
}

export interface NoteTemplateItem {
  id: string;
  type: 'INBOUND' | 'OUTBOUND';
  titleAr: string;
  titleEn: string;
  textAr: string;
  textEn: string;
}

export interface NumberingPrefixes {
  barcodePrefix: string;
  inboundInvoicePrefix: string;
  manualAdjustPrefix: string;
  outboundSchoolPrefix: string;
  outboundDirectPrefix: string;
  bulkInboundPrefix: string;
  bulkOutboundPrefix: string;
}

export interface FormDefaultValues {
  defaultAcademicYear: string;
  defaultStage: EducationalStage;
  defaultMinStockLevel: number;
  defaultOpeningStock: number;
  defaultInboundQty: number;
  defaultOutboundQty: number;
  defaultBulkQty: number;
}

export type AutomationTriggerType =
  | 'REORDER_POINT_PERCENTAGE'
  | 'ZERO_STOCK_NOTIFICATION'
  | 'CRITICAL_STOCK_BUFFER'
  | 'AUTO_ARCHIVE_EXPIRED_YEAR';

export interface AutomationRuleItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  triggerType: AutomationTriggerType;
  parameterValue: number;
  targetEmail?: string;
  enabled: boolean;
  lastRunAt?: string | null;
  lastRunSummaryAr?: string | null;
  lastRunSummaryEn?: string | null;
}

export interface AutomationAlertItem {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleNameAr: string;
  ruleNameEn: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  bookBarcode?: string;
  bookTitleAr?: string;
  bookTitleEn?: string;
  recipientEmail?: string;
  messageAr: string;
  messageEn: string;
  createdAt: string;
  acknowledged: boolean;
}

export interface FormLookupsConfig {
  academicYears: string[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  suppliers: SupplierEntity[];
  noteTemplates: NoteTemplateItem[];
  prefixes: NumberingPrefixes;
  defaults: FormDefaultValues;
  automationRules: AutomationRuleItem[];
  automationAlerts: AutomationAlertItem[];
  roleTabMatrix?: Record<UserRole, AppTabKey[]>;
  updatedAt: string;
}

export type AuditCategory =
  | 'CONFIG_LOOKUP'
  | 'AUTOMATION_RULE'
  | 'CATALOG_BOOK'
  | 'INVENTORY_TRANSACTION'
  | 'USER_ACCESS'
  | 'WORKSPACE_STATUS'
  | 'STOCKTAKING_AUDIT';

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXECUTE_RULES'
  | 'BULK_ADJUST'
  | 'SUSPEND'
  | 'ACTIVATE'
  | 'RECONCILE';

export interface AuditFieldDiff {
  field: string;
  labelAr: string;
  labelEn: string;
  before: string;
  after: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorNameAr: string;
  actorRole: UserRole;
  category: AuditCategory;
  action: AuditActionType;
  entityTitleAr: string;
  entityTitleEn: string;
  summaryAr: string;
  summaryEn: string;
  changes: AuditFieldDiff[];
}

export type TransactionType = 'INBOUND' | 'OUTBOUND';

export type TransactionSubType =
  | 'PURCHASE_INVOICE'
  | 'MANUAL_ENTRY'
  | 'SCHOOL_RETURN'
  | 'SCHOOL_DISTRIBUTION'
  | 'DISPENSING'
  | 'SUPPLIER_RETURN'
  | 'WAREHOUSE_TRANSFER';

export interface InventoryTransaction {
  id: string;
  transactionCode: string;
  type: TransactionType;
  subType: TransactionSubType;
  bookId: string;
  bookTitle: string;
  bookTitleAr: string;
  bookBarcode: string;
  stage: EducationalStage;
  grade: string;
  academicYear: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceNumber: string;
  counterpartyName: string;
  counterpartyNameAr: string;
  schoolId?: string;
  recipientPersonName?: string;
  recipientPhone?: string;
  recipientSignatureDataUrl?: string;
  createdBy: string;
  createdByRole: UserRole;
  notes: string;
  createdAt: string;
  isSynced: boolean;
  syncedAt?: string | null;
  syncError?: string | null;
}

export type SheetsConnectionMethod = 'SHEETS_URL_AUTO' | 'DIRECT_API_TOKEN' | 'WEBHOOK_URL';

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  syncedBooksCount: number;
  syncedTransactionsCount: number;
  targetWebhookUrl: string;
  mode: 'LIVE_WEBHOOK' | 'LOCAL_SHEETS_BRIDGE' | 'DIRECT_SHEETS_API' | 'SHEETS_URL_AUTO';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  message: string;
  payloadPreview?: string;
}

export interface SyncConfig {
  webhookUrl: string;
  sheetName: string;
  warehouseCode: string;
  autoSyncOnOnline: boolean;
  simulateOffline: boolean;
  lastSyncedAt: string | null;
  sheetUrl?: string;
  spreadsheetId?: string;
  sheetGid?: string;
  googleAccessToken?: string;
  connectionMethod?: SheetsConnectionMethod;
}
