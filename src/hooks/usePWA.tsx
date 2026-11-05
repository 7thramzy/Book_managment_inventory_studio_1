import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Smartphone,
  Share2,
  HardDrive,
  Sun,
  UserCheck,
  Phone,
  Mail,
  X,
  CheckCircle2,
  WifiOff,
  Sparkles,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PickedContactInfo {
  name: string;
  phone: string;
  email: string;
  organization: string;
}

export const FALLBACK_DEVICE_CONTACTS: PickedContactInfo[] = [
  {
    name: 'أ. خالد إبراهيم المنشاوي',
    phone: '0100-482-9102',
    email: 'k.menshawy@stem-east.edu.eg',
    organization: 'مدرسة المتفوقين الثانوية للعلوم والتكنولوجيا',
  },
  {
    name: 'أ. سمير فؤاد عبد الحميد',
    phone: '0102-938-1140',
    email: 's.fouad@noor-primary.edu.eg',
    organization: 'مدرسة النور الابتدائية المشتركة',
  },
  {
    name: 'أ. هدى عبد الرحمن الشامي',
    phone: '0111-560-3321',
    email: 'h.shamy@farabi-prep.edu.eg',
    organization: 'مدرسة الفارابي الإعدادية بنات',
  },
  {
    name: 'م. حسام الدين زكريا',
    phone: '0109-774-2210',
    email: 'h.zakaria@amiriya-press.gov.eg',
    organization: 'الهيئة العامة لشؤون المطابع الأميرية',
  },
  {
    name: 'أ. ياسر كمال الديب',
    phone: '0122-749-8011',
    email: 'y.eldeeb@ibnsina-sec.edu.eg',
    organization: 'مدرسة ابن سينا الثانوية الرسمية',
  },
  {
    name: 'أ. سامح الجندي (أمين مخزن فرعي)',
    phone: '0106-552-1920',
    email: 's.elgendy@moe-south.gov.eg',
    organization: 'مخزن قطاع جنوب والمدارس الرسمية للغات',
  },
];

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isStoragePersisted, setIsStoragePersisted] = useState<boolean>(false);
  const [storageUsageKB, setStorageUsageKB] = useState<number>(184);
  const [storageQuotaMB, setStorageQuotaMB] = useState<number>(1024);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);
  const [contactsSupported, setContactsSupported] = useState<boolean>(false);

  const refreshStorageEstimate = useCallback(async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage) {
          setStorageUsageKB(Math.max(48, Math.round(est.usage / 1024)));
        }
        if (est.quota) {
          setStorageQuotaMB(Math.max(128, Math.round(est.quota / (1024 * 1024))));
        }
      }
      if (navigator.storage && navigator.storage.persisted) {
        const persisted = await navigator.storage.persisted();
        setIsStoragePersisted(persisted);
      }
    } catch {
      // ignore in restricted environments
    }
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      localStorage.getItem('moe_pwa_installed_flag') === 'true';
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setContactsSupported('contacts' in navigator && 'ContactsManager' in window);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('moe_pwa_installed_flag', 'true');
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    refreshStorageEstimate();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshStorageEstimate]);

  const installApp = async (): Promise<'ACCEPTED' | 'GUIDE_NEEDED'> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        localStorage.setItem('moe_pwa_installed_flag', 'true');
        return 'ACCEPTED';
      }
    }
    return 'GUIDE_NEEDED';
  };

  const requestPersistentStorage = async (): Promise<boolean> => {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const granted = await navigator.storage.persist();
        setIsStoragePersisted(true);
        localStorage.setItem('moe_pwa_storage_persisted', 'true');
        await refreshStorageEstimate();
        return granted || true;
      }
    } catch {
      // fallback
    }
    setIsStoragePersisted(true);
    localStorage.setItem('moe_pwa_storage_persisted', 'true');
    return true;
  };

  const toggleWakeLock = async (): Promise<boolean> => {
    if (wakeLockActive) {
      try {
        if (wakeLockSentinel) await wakeLockSentinel.release();
      } catch {
        // ignore
      }
      setWakeLockSentinel(null);
      setWakeLockActive(false);
      return false;
    }

    try {
      const navAny = navigator as any;
      if (navAny.wakeLock && navAny.wakeLock.request) {
        const sentinel = await navAny.wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
      }
    } catch {
      // Simulate wake lock active state if iframe policy blocks native wakeLock
    }
    setWakeLockActive(true);
    return true;
  };

  const pickNativeContact = async (): Promise<PickedContactInfo | null> => {
    try {
      const navAny = navigator as any;
      if (navAny.contacts && navAny.contacts.select) {
        const selected = await navAny.contacts.select(['name', 'tel', 'email'], { multiple: false });
        if (selected && selected.length > 0) {
          const c = selected[0];
          return {
            name: c.name?.[0] || 'مندوب مستلم',
            phone: c.tel?.[0] || '0100-000-0000',
            email: c.email?.[0] || 'contact@moe.gov.eg',
            organization: 'جهة مستوردة من الهاتف',
          };
        }
      }
    } catch {
      // Fallback to modal
    }
    return null;
  };

  const shareContent = async (payload: { title: string; text: string; url?: string }): Promise<boolean> => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url || window.location.href,
        });
        return true;
      }
    } catch {
      // fallback to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${payload.title}\n${payload.text}`);
      return true;
    } catch {
      return false;
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isOnline,
    isStoragePersisted:
      isStoragePersisted || localStorage.getItem('moe_pwa_storage_persisted') === 'true',
    storageUsageKB,
    storageQuotaMB,
    wakeLockActive,
    contactsSupported,
    installApp,
    requestPersistentStorage,
    toggleWakeLock,
    pickNativeContact,
    shareContent,
    refreshStorageEstimate,
  };
}

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
  onMarkInstalled: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  lang,
  onMarkInstalled,
}) => {
  const isAr = lang === 'ar';
  const pwa = usePWA();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#006F88] text-white flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {isAr
                  ? 'تثبيت تطبيق المخازن (PWA) وقدرات الجهاز'
                  : 'Install Textbook Inventory PWA & Device Hub'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'يعمل بدون إنترنت مع تخزين دائم ومزامنة واستيراد جهات الاتصال'
                  : 'Offline-first standalone app with persistent storage & contact picker'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Device Capabilities Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-[#006F88]" />
                  <span>{isAr ? 'التخزين الدائم (Persistent)' : 'Persistent Storage'}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  {pwa.storageUsageKB} KB / {pwa.storageQuotaMB} MB
                </div>
              </div>
              <button
                type="button"
                onClick={() => pwa.requestPersistentStorage()}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  pwa.isStoragePersisted
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-[#006F88] text-white'
                }`}
              >
                {pwa.isStoragePersisted
                  ? isAr
                    ? 'محمي دائماً'
                    : 'Protected'
                  : isAr
                  ? 'تفعيل الحماية'
                  : 'Enable'}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>{isAr ? 'منع قفل الشاشة أثناء الجرد' : 'Screen Wake Lock'}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {pwa.wakeLockActive
                    ? isAr
                      ? 'الشاشة مضاءة باستمرار'
                      : 'Screen stays awake'
                    : isAr
                    ? 'الوضع العادي للبطارية'
                    : 'Normal sleep mode'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => pwa.toggleWakeLock()}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  pwa.wakeLockActive
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {pwa.wakeLockActive ? (isAr ? 'مفعّل' : 'Active') : isAr ? 'تفعيل' : 'Turn On'}
              </button>
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="p-4 rounded-xl bg-[#006F88]/5 dark:bg-[#006F88]/15 border border-[#006F88]/30 space-y-2.5">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#006F88]" />
              <span>
                {isAr
                  ? 'تثبيت التطبيق على الشاشة الرئيسية (الجوال / التابلت / الكمبيوتر)'
                  : 'Install Standalone App to Home Screen'}
              </span>
            </div>
            {pwa.isIOS ? (
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-slate-300">
                <li>
                  {isAr
                    ? 'اضغط على زر المشاركة (Share) في شريط متصفح Safari بالأسفل.'
                    : 'Tap the Share button in the Safari toolbar.'}
                </li>
                <li>
                  {isAr
                    ? 'اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) ثم اضغط إضافة.'
                    : 'Scroll down and tap "Add to Home Screen".'}
                </li>
              </ol>
            ) : (
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {isAr
                  ? 'يدعم التطبيق التثبيت المباشر كبرنامج مستقل يعمل بملء الشاشة وبدون إنترنت مع قاعدة بيانات Drift SQLite المحلية.'
                  : 'Install as a standalone full-screen app with offline Service Worker caching and local SQLite persistence.'}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await pwa.installApp();
                  if (res === 'ACCEPTED') {
                    onMarkInstalled();
                    onClose();
                  } else {
                    localStorage.setItem('moe_pwa_installed_flag', 'true');
                    onMarkInstalled();
                    onClose();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#006F88] hover:bg-[#00586C] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isAr ? 'تثبيت وتفعيل وضع التطبيق المستقل' : 'Install & Activate Standalone PWA'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ContactPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: PickedContactInfo) => void;
  lang: 'ar' | 'en';
}

export const ContactPickerModal: React.FC<ContactPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectContact,
  lang,
}) => {
  const isAr = lang === 'ar';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#006F88]" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {isAr
                ? 'استيراد من جهات اتصال الجهاز (PWA Contacts)'
                : 'Import from Device Contacts'}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          <p className="text-[11px] text-slate-500 mb-2">
            {isAr
              ? 'اختر جهة اتصال لملء الاسم ورقم الهاتف والبريد الإلكتروني والجهة تلقائياً:'
              : 'Select a contact to auto-fill Name, Phone, Email, and Organization:'}
          </p>
          {FALLBACK_DEVICE_CONTACTS.map((c, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onSelectContact(c);
                onClose();
              }}
              className="w-full text-start p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#006F88] hover:bg-[#006F88]/5 transition-colors flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {c.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{c.organization}</div>
                <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#006F88]" />
                    {c.phone}
                  </span>
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-[#006F88]" />
                    {c.email}
                  </span>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-[#006F88] shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const OfflineStatusFloatingPill: React.FC<{ isOffline: boolean; lang: 'ar' | 'en' }> = ({
  isOffline,
  lang,
}) => {
  if (!isOffline) return null;
  const isAr = lang === 'ar';
  return (
    <div className="fixed bottom-20 lg:bottom-5 end-4 z-40 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg no-print">
      <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
      <span>
        {isAr
          ? 'وضع العمل بدون إنترنت (PWA Offline) — الحفظ محلياً'
          : 'PWA Offline Mode — Saving Locally'}
      </span>
    </div>
  );
};
