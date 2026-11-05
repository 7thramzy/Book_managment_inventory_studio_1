import React, { useState, useMemo } from 'react';
import {
  BookItem,
  InventoryTransaction,
  SheetsConnectionMethod,
  SyncConfig,
  SyncLogEntry,
  UserRole,
} from '../types/inventory';
import {
  DriftSqliteClientEngine,
  extractSpreadsheetIdFromUrl,
} from '../db/driftEngine';
import {
  CloudUpload,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Database,
  FileCode2,
  RefreshCw,
  Link2,
  ExternalLink,
  KeyRound,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface SyncCenterViewProps {
  books: BookItem[];
  transactions: InventoryTransaction[];
  syncLogs: SyncLogEntry[];
  syncConfig: SyncConfig;
  isOfflineSimulated: boolean;
  onToggleOffline: (next: boolean) => void;
  onSyncNow: (
    options?:
      | string
      | {
          customWebhookUrl?: string;
          sheetUrl?: string;
          spreadsheetId?: string;
          googleAccessToken?: string;
          connectionMethod?: SheetsConnectionMethod;
        }
  ) => Promise<void>;
  onUpdateConfig: (partial: Partial<SyncConfig>) => Promise<void>;
  onResetDemoData: () => Promise<void>;
  userRole: UserRole;
  lang: 'ar' | 'en';
}

export const SyncCenterView: React.FC<SyncCenterViewProps> = ({
  books,
  transactions,
  syncLogs,
  syncConfig,
  isOfflineSimulated,
  onToggleOffline,
  onSyncNow,
  onUpdateConfig,
  onResetDemoData,
  userRole,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [sheetUrlInput, setSheetUrlInput] = useState(
    syncConfig.sheetUrl ||
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'
  );
  const [connectionMethod, setConnectionMethod] = useState<SheetsConnectionMethod>(
    syncConfig.connectionMethod || 'SHEETS_URL_AUTO'
  );
  const [googleAccessToken, setGoogleAccessToken] = useState(syncConfig.googleAccessToken || '');
  const [webhookInput, setWebhookInput] = useState(syncConfig.webhookUrl);
  const [sheetNameInput, setSheetNameInput] = useState(syncConfig.sheetName);

  const [syncing, setSyncing] = useState(false);
  const [verifyingSheet, setVerifyingSheet] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{
    valid: boolean;
    message: string;
    spreadsheetId?: string;
    sheetTitle?: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptCode, setShowScriptCode] = useState(false);

  const unsyncedBooks = books.filter((b) => !b.isSynced);
  const unsyncedTransactions = transactions.filter((t) => !t.isSynced);
  const totalUnsynced = unsyncedBooks.length + unsyncedTransactions.length;

  const canModifySettings =
    userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'STOREKEEPER';

  // Live automatic extraction of Spreadsheet ID & GID as soon as the user pastes any Google Sheet URL
  const parsedSheetInfo = useMemo(
    () => extractSpreadsheetIdFromUrl(sheetUrlInput),
    [sheetUrlInput]
  );

  const activeSpreadsheetId =
    parsedSheetInfo.spreadsheetId || syncConfig.spreadsheetId || '';

  const handleVerifyAndBindSheetUrl = async () => {
    if (!parsedSheetInfo.spreadsheetId) {
      setVerifyFeedback({
        valid: false,
        message: isAr
          ? 'الرابط المدخل لا يحتوي على معرف Google Sheet صالح. الصق رابط الشيت العادي من المتصفح.'
          : 'Invalid Google Sheet URL. Paste the standard link from your browser address bar.',
      });
      return;
    }

    setVerifyingSheet(true);
    setVerifyFeedback(null);
    try {
      const result = await DriftSqliteClientEngine.verifyGoogleSheetUrl({
        sheetUrl: sheetUrlInput,
        spreadsheetId: parsedSheetInfo.spreadsheetId,
        googleAccessToken: googleAccessToken.trim() || undefined,
      });

      await onUpdateConfig({
        sheetUrl: result.sheetUrl || sheetUrlInput,
        spreadsheetId: result.spreadsheetId,
        sheetGid: result.gid || parsedSheetInfo.gid || '0',
        connectionMethod,
        googleAccessToken: googleAccessToken.trim() || undefined,
        sheetName: sheetNameInput,
        webhookUrl: webhookInput,
      });

      setVerifyFeedback({
        valid: true,
        spreadsheetId: result.spreadsheetId,
        sheetTitle: result.sheetTitle,
        message: isAr ? result.messageAr : result.messageEn,
      });
    } catch (err: any) {
      setVerifyFeedback({
        valid: false,
        message: err.message || (isAr ? 'تعذر التحقق من رابط الشيت' : 'Failed to verify Sheet URL'),
      });
    } finally {
      setVerifyingSheet(false);
    }
  };

  const handleTriggerSync = async () => {
    if (isOfflineSimulated) return;
    setSyncing(true);
    try {
      await onSyncNow({
        customWebhookUrl: webhookInput,
        sheetUrl: sheetUrlInput,
        spreadsheetId: activeSpreadsheetId,
        googleAccessToken: googleAccessToken.trim() || undefined,
        connectionMethod,
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateConfig({
      webhookUrl: webhookInput,
      sheetName: sheetNameInput,
      sheetUrl: sheetUrlInput,
      spreadsheetId: activeSpreadsheetId,
      sheetGid: parsedSheetInfo.gid || '0',
      connectionMethod,
      googleAccessToken: googleAccessToken.trim() || undefined,
    });
  };

  const handleCopyScript = () => {
    const code = DriftSqliteClientEngine.getGoogleAppsScriptTemplate(
      sheetNameInput || 'Ministry_Textbooks_Ledger_2026',
      activeSpreadsheetId
    );
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await onResetDemoData();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Status & Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Database className="w-4 h-4 text-[#006F88]" />
              <span>Drift SQLite (WAL) + IndexedDB Local Store</span>
              <span aria-hidden="true">·</span>
              <span>
                {isOfflineSimulated
                  ? isAr
                    ? 'وضع العمل بدون إنترنت نشط (التخزين المحلي)'
                    : 'Offline Mode Active (Local Queueing)'
                  : isAr
                  ? 'متصل وجاهز للمزامنة التلقائية مع Google Sheets'
                  : 'Online & Ready for Google Sheets Auto-Sync'}
              </span>
              {activeSpreadsheetId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Sheet ID: {activeSpreadsheetId.slice(0, 14)}...
                  </span>
                </>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isAr
                ? 'مركز الربط التلقائي مع Google Sheets وإدارة المزامنة السحابية (Drift SQLite)'
                : 'Automatic Google Sheets URL Binding & Offline Persistence Center'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              {isAr
                ? 'فقط الصق رابط ملف Google Sheet العادي وسيقوم النظام باستخراج معرف الجدول (Spreadsheet ID) تلقائياً وربطه بمحرك المزامنة عبر الرابط المباشر أو Google Sheets API v4 أو Apps Script المولّد تلقائياً.'
                : 'Simply paste your standard Google Sheet link to auto-extract the Spreadsheet ID and sync via direct URL, Google Sheets REST API v4, or auto-bound Apps Script.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleOffline(!isOfflineSimulated)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                isOfflineSimulated
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              {isOfflineSimulated ? (
                <WifiOff className="w-4 h-4" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-600" />
              )}
              <span>
                {isOfflineSimulated
                  ? isAr
                    ? 'إلغاء محاكاة انقطاع الإنترنت (العودة للاتصال)'
                    : 'Disable Offline Simulation (Reconnect)'
                  : isAr
                  ? 'محاكاة انقطاع الإنترنت (Offline Mode)'
                  : 'Simulate Offline Mode'}
              </span>
            </button>

            <button
              type="button"
              disabled={syncing || isOfflineSimulated}
              onClick={handleTriggerSync}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CloudUpload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
              <span>
                {syncing
                  ? isAr
                    ? 'جارٍ المزامنة مع Google Sheets...'
                    : 'Syncing to Google Sheets...'
                  : isAr
                  ? `مزامنة الآن (${totalUnsynced} سجل معلق)`
                  : `Sync Now (${totalUnsynced} Pending)`}
              </span>
            </button>
          </div>
        </div>

        {/* Queue Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              {isAr
                ? 'حركات مخزنية بانتظار المزامنة (isSynced = false)'
                : 'Pending Offline Transactions (isSynced = false)'}
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1 block">
              {unsyncedTransactions.length}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              {isAr
                ? 'بطاقات كتب معدلة محلياً (isSynced = false)'
                : 'Modified Catalog Records (isSynced = false)'}
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1 block">
              {unsyncedBooks.length}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              {isAr ? 'آخر مزامنة ناجحة مع Google Sheets' : 'Last Verified Google Sheets Sync'}
            </span>
            <span className="text-sm font-semibold text-[#006F88] dark:text-cyan-400 font-mono tabular-nums mt-2 block">
              {syncConfig.lastSyncedAt
                ? new Date(syncConfig.lastSyncedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')
                : isAr
                ? 'لم تتم المزامنة بعد'
                : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Pending Offline Records Table & Automatic Google Sheet Link Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Pending Records Queue */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'طابور السجلات المحلية غير المتزامنة (Offline Sync Queue)'
                  : 'Unsynced Local Records Queue (isSynced = false)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'تُرفع هذه السجلات تلقائياً بنظام Delta-Replay فور عودة الاتصال أو الضغط على زر المزامنة'
                  : 'Automatically pushed to Google Sheets upon reconnection'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {totalUnsynced} {isAr ? 'عنصر' : 'items'}
            </span>
          </div>

          {totalUnsynced === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'جميع السجلات المحلية متطابقة ومتزامنة بالكامل مع Google Sheets'
                  : 'All Local Drift SQLite Records Are Fully Synced'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {isAr
                  ? 'جرب تفعيل "محاكاة انقطاع الإنترنت" ثم قم بإضافة حركة توريد أو صرف لاختبار طابور المزامنة المحلي.'
                  : 'Try enabling "Simulate Offline Mode" and recording an Inbound or Outbound transaction to test the offline sync queue.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {unsyncedTransactions.map((t) => (
                <div
                  key={t.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      <span className="font-mono tabular-nums text-[#006F88] dark:text-cyan-400">
                        {t.transactionCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{isAr ? t.bookTitleAr : t.bookTitle}</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {t.type === 'INBOUND'
                        ? isAr
                          ? 'توريد مخزني'
                        : 'Inbound'
                        : isAr
                        ? 'صرف مدرسي'
                        : 'Outbound'}{' '}
                      · {isAr ? t.counterpartyNameAr : t.counterpartyName} ·{' '}
                      <span className="font-mono tabular-nums">
                        {t.type === 'INBOUND' ? `+${t.quantity}` : `-${t.quantity}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>isSynced: false</span>
                  </div>
                </div>
              ))}

              {unsyncedBooks.map((b) => (
                <div
                  key={b.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                      <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {b.barcode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{isAr ? b.titleAr : b.title}</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {isAr ? 'تحديث رصيد الكتاب:' : 'Catalog Stock Update:'}{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {b.currentStock.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>isSynced: false</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Automatic Google Sheet Link Binding & Apps Script Generator */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#006F88]" />
                <span>
                  {isAr
                    ? 'الربط التلقائي بملف Google Sheet عبر لصق الرابط فقط'
                    : '1-Step Automatic Google Sheet Link Binding'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAr
                  ? 'الصق رابط ملف Google Sheet العادي هنا ليقوم النظام باستخراج المعرف (Spreadsheet ID) وربطه أوتوماتيكياً'
                  : 'Paste your standard Google Sheet URL below to auto-extract the Spreadsheet ID and bind instantly'}
              </p>
            </div>
            {activeSpreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${activeSpreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 text-[11px] font-semibold text-[#006F88] dark:text-cyan-300 bg-[#006F88]/10 hover:bg-[#006F88]/20 rounded-lg inline-flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{isAr ? 'فتح الشيت' : 'Open Sheet'}</span>
              </a>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Step 1: Paste Standard Google Sheet Link */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isAr
                    ? '1. رابط ملف Google Sheet المباشر (Paste Sheet URL)'
                    : '1. Paste Standard Google Sheet Link'}
                </label>
                {parsedSheetInfo.spreadsheetId ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {isAr ? 'تم استخراج المعرف تلقائياً' : 'Auto-Extracted ID'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{isAr ? 'بانتظار رابط شيت صحيح' : 'Paste valid Sheet URL'}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  disabled={!canModifySettings}
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0"
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                />
                {canModifySettings && (
                  <button
                    type="button"
                    disabled={verifyingSheet || !parsedSheetInfo.spreadsheetId}
                    onClick={handleVerifyAndBindSheetUrl}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] disabled:opacity-50 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {verifyingSheet
                        ? isAr
                          ? 'جارٍ الفحص والربط...'
                          : 'Verifying...'
                        : isAr
                        ? 'ربط وفحص تلقائي'
                        : 'Auto-Verify & Bind'}
                    </span>
                  </button>
                )}
              </div>

              {/* Auto-Extracted Metadata Bar */}
              {parsedSheetInfo.spreadsheetId && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono truncate">
                    <span className="text-slate-400">
                      {isAr ? 'معرف الجدول المستخرج (Spreadsheet ID):' : 'Extracted Spreadsheet ID:'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-[#006F88] dark:text-cyan-400">
                      {parsedSheetInfo.spreadsheetId}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">
                    GID: {parsedSheetInfo.gid || '0'}
                  </span>
                </div>
              )}

              {verifyFeedback && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                    verifyFeedback.valid
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                  }`}
                >
                  {verifyFeedback.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{verifyFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Step 2: Connection Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                {isAr
                  ? '2. آلية المزامنة مع الشيت المستخرج'
                  : '2. Synchronization Mode for Linked Sheet'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'SHEETS_URL_AUTO',
                      ar: 'ربط تلقائي بالرابط',
                      en: 'Auto Sheet URL Link',
                      subAr: 'استخراج المعرف والمزامنة مباشرة',
                      subEn: 'Zero-config URL bridge',
                    },
                    {
                      id: 'DIRECT_API_TOKEN',
                      ar: 'Google Sheets API v4',
                      en: 'Direct Sheets API v4',
                      subAr: 'كتابة مباشرة عبر OAuth Token',
                      subEn: 'Direct REST API append',
                    },
                    {
                      id: 'WEBHOOK_URL',
                      ar: 'Apps Script Webhook',
                      en: 'Apps Script Webhook',
                      subAr: 'سكربت مربوط بمعرف الشيت',
                      subEn: 'Auto-bound openById script',
                    },
                  ] as const
                ).map((m) => {
                  const active = connectionMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!canModifySettings}
                      onClick={() => setConnectionMethod(m.id)}
                      className={`p-2.5 rounded-lg border text-start transition-colors cursor-pointer ${
                        active
                          ? 'border-[#006F88] bg-[#006F88]/10 text-slate-900 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold">{isAr ? m.ar : m.en}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {isAr ? m.subAr : m.subEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional Input for Direct Google OAuth Token */}
            {connectionMethod === 'DIRECT_API_TOKEN' && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#006F88]" />
                  <span>
                    {isAr
                      ? 'رمز وصول Google OAuth Bearer Token (كتابة مباشرة عبر Sheets API v4)'
                      : 'Google OAuth Access Token (Scope: spreadsheets)'}
                  </span>
                </label>
                <input
                  type="password"
                  disabled={!canModifySettings}
                  value={googleAccessToken}
                  onChange={(e) => setGoogleAccessToken(e.target.value)}
                  placeholder="ya29.a0AfH6SM..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <p className="text-[11px] text-slate-500">
                  {isAr
                    ? `سيقوم الخادم بالكتابة مباشرة في الجدول (${activeSpreadsheetId.slice(0, 12)}...) عبر نقطة النهاية الرسمية spreadsheets.values.append.`
                    : `Directly appends rows to spreadsheet (${activeSpreadsheetId.slice(0, 12)}...) via Google Sheets REST API v4.`}
                </p>
              </div>
            )}

            {/* Conditional Input for Custom Apps Script Webhook */}
            {connectionMethod === 'WEBHOOK_URL' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'رابط Google Apps Script Web App' : 'Apps Script Web App URL'}
                </label>
                <input
                  type="url"
                  disabled={!canModifySettings}
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {isAr
                  ? 'اسم ورقة العمل داخل الشيت (Sheet Tab Prefix)'
                  : 'Target Sheet Tab Prefix'}
              </label>
              <input
                type="text"
                disabled={!canModifySettings}
                value={sheetNameInput}
                onChange={(e) => setSheetNameInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#006F88]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScriptCode(!showScriptCode)}
                className="text-xs font-medium text-[#006F88] dark:text-cyan-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode2 className="w-4 h-4" />
                <span>
                  {showScriptCode
                    ? isAr
                      ? 'إخفاء كود Apps Script المربوط تلقائياً بمعرف الشيت'
                      : 'Hide Auto-Bound Apps Script'
                    : isAr
                    ? 'عرض كود Apps Script المربوط تلقائياً بمعرف الشيت'
                    : 'View Auto-Bound Apps Script (openById)'}
                </span>
              </button>

              {canModifySettings && (
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#006F88] hover:bg-[#00586C] rounded-lg transition-colors cursor-pointer"
                >
                  {isAr ? 'حفظ إعدادات الربط التلقائي' : 'Save Sheet Link Config'}
                </button>
              )}
            </div>
          </form>

          {showScriptCode && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">
                  Code.gs — Auto-Bound to ID: {activeSpreadsheetId.slice(0, 14)}...
                </span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {copiedScript ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedScript ? (isAr ? 'تم النسخ' : 'Copied') : isAr ? 'نسخ الكود' : 'Copy Code'}
                  </span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-56">
                {DriftSqliteClientEngine.getGoogleAppsScriptTemplate(
                  sheetNameInput,
                  activeSpreadsheetId
                )}
              </pre>
            </div>
          )}

          {(userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'إعادة تهيئة البيانات التجريبية الافتراضية'
                  : 'Reset SQLite Database to Default Seed'}
              </span>
              <button
                type="button"
                disabled={resetting}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span>{isAr ? 'إعادة ضبط البيانات' : 'Reset Demo Seed'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sync History Audit Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isAr
              ? 'سجل عمليات المزامنة السابقة (Sync Audit History)'
              : 'Google Sheets Synchronization Audit Log'}
          </h3>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {syncLogs.map((log) => (
            <div
              key={log.id}
              className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="font-medium text-slate-900 dark:text-slate-100">{log.message}</div>
                <div className="text-slate-500 dark:text-slate-400 font-mono">
                  [{log.mode}] {log.targetWebhookUrl} · {log.syncedTransactionsCount} tx ·{' '}
                  {log.syncedBooksCount} books
                </div>
              </div>
              <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                {new Date(log.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
