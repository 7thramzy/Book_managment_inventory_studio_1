# الربط التلقائي عبر رابط Google Sheet والتحكم الديناميكي في ظهور التبويبات حسب الدور

تهدف هذه الترقية إلى تمكين المستخدم من لصق **الرابط العادي لأي ملف Google Sheet** ليقوم النظام تلقائياً باستخراج معرّف الجدول (`Spreadsheet ID`) وربطه بالمزامنة الفورية (سواء عبر واجهة Google Sheets API / OAuth المباشرة أو عبر جسر Apps Script المرتبط تلقائياً بالمعرف)، بالإضافة إلى **إخفاء وإظهار التبويبات في القائمة الجانبية والشريط السفلي للجوال ديناميكياً** حسب الدور الوظيفي أو الصلاحيات المخصصة لكل مستخدم من داخل لوحة السوبر أدمن.

---

## مراجعة المستخدم والقرارات المعتمدة (User Review & Confirmed Decisions)

> [!IMPORTANT]
> تم بناء هذه الخطة بناءً على اختياراتك المعتمدة في جلسة التوضيح:

- **القرار المؤكد 1 (آلية الربط التلقائي بـ Google Sheets):** لصق رابط ملف Google Sheet العادي (`https://docs.google.com/spreadsheets/d/...`) واستخراج المعرّف (`Spreadsheet ID` و `GID`) تلقائياً في الوقت الفعلي، مع دعم المزامنة المباشرة عبر رمز وصول Google OAuth / Sheets API v4 أو عبر Webhook / Apps Script المولّد تلقائياً لهذا المعرّف.
- **القرار المؤكد 2 (إدارة ظهور التبويبات حسب الدور والمستخدم):** توفير مصفوفة تحكم كاملة داخل تبويبة **السوبر أدمن** تتيح تحديد التبويبات الظاهرة افتراضياً لكل دور (`SUPER_ADMIN`, `ADMIN`, `STOREKEEPER`, `AUDITOR`)، مع إمكانية تخصيص التبويبات المسموحة لكل مستخدم على حدة داخل نافذة إضافة/تعديل المستخدم.
- **القرار المؤكد 3 (حماية التوجيه عند تبديل الدور):** إذا قام المستخدم بالتبديل إلى حساب/دور لا يملك صلاحية رؤية التبويبة المفتوحة حالياً، يقوم النظام بتحويله تلقائياً وفوراً إلى **لوحة المتابعة المخزنية (`DASHBOARD`)** مع إظهار إشعار تنبيهي واضح ومنع عرض الواجهة المقيدة برمجياً.

---

## 1. النظرة العامة والقيمة المضافة (Overview & Core Concept)

- **ما الذي يقدمه التحديث:**
  1. **الربط الذكي بالرابط فقط (Paste-and-Connect Sheet URL):** بدلاً من البحث اليدوي عن معرّفات أو كتابة أكواد، يلصق المستخدم رابط الشيت من شريط عنوان المتصفح، فيستخرج النظام `Spreadsheet ID` فوراً، ويتحقق من حالة الرابط، ويوفر خيار المزامنة المباشرة عبر Google Sheets REST API v4 (`spreadsheets.values.append`) أو نسخ كود مربوط مسبقاً بـ `SpreadsheetApp.openById('ID')`.
  2. **قوائم تنقل ذكية مفلترة حسب الصلاحيات (Role-Aware Navigation):** يرى كل موظف في القائمة الجانبية (سطح المكتب) وشريط التنقل السفلي (الجوال والتابلت) التبويبات التي تخص عمله فقط، مما يبسط الواجهة لأمين المخزن والمراجع الداخلي ويحمي لوحات التهيئة والسوبر أدمن.

---

## 2. تجربة المستخدم والتصميم البصري (User Experience & Visual Design)

- **مسار الربط التلقائي بملف Google Sheet:**
  1. يفتح المستخدم تبويبة **المزامنة (`SYNC`)** ويلصق رابط ملف Google Sheet العادي في حقل **"رابط ملف Google Sheet المباشر"**.
  2. يتعرف النظام تلقائياً على المعرّف (`Spreadsheet ID`) ويعرض بطاقة تحقق خضراء تحتوي على المعرّف المستخرج وزر **"فتح الجدول في Google Sheets"** وزر **"فحص الاتصال بالجدول"**.
  3. يختار المستخدم وضع الربط:
     - **ربط مباشر عبر Google Sheets API (OAuth Bearer Token):** إدخال رمز الوصول أو الربط المباشر لدفع صفوف الكتب والحركات فوراً إلى `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{sheet}!A1:append`.
     - **ربط عبر جسر Google Apps Script المؤتمت:** يولّد النظام كوداً جاهزاً يحتوي بداخله على `SpreadsheetApp.openById("EXTRACTED_ID")` مرتبطاً بالجدول الملصق تلقائياً.
- **مسار التحكم في التبويبات من السوبر أدمن:**
  1. في تبويبة **السوبر أدمن (`SUPER_ADMIN`)**، يظهر قسم جديد بعنوان **"مصفوفة ظهور التبويبات حسب الدور (Role Tab Visibility Matrix)"** بالإضافة إلى إمكانية تخصيص التبويبات لكل مستخدم داخل نافذة تعديل المستخدم.
  2. تنعكس أي تغييرات فوراً على القائمة الجانبية (`Sidebar`) والشريط السفلي للجوال (`Bottom Navigation Bar`) مع حفظ الإعدادات في قاعدة `Drift SQLite + IndexedDB`.

---

## 3. القرارات الهندسية والمفاضلات (Key Product Decisions & Trade-Offs)

- **القرار 1: الجمع بين استخراج `Spreadsheet ID` والمزامنة المزدوجة (Sheets API v4 + Apps Script Bridge)**
  - *الأسلوب المختار:* دعم لصق الرابط القياسي `docs.google.com/spreadsheets/d/{ID}/edit` واستخراج `{ID}` تلقائياً، ثم إتاحة الدفع المباشر عبر Google Sheets v4 REST API (عند توفر OAuth Access Token) أو عبر Webhook.
  - *السبب:* يمنح المستخدم أسهل تجربة ممكنة ("أعطيه الرابط بس") مع مرونة العمل في البيئات الحكومية المغلقة أو الحسابات الشخصية.
- **القرار 2: أولوية صلاحيات التبويبات (User Override > Role Default Matrix)**
  - *الأسلوب المختار:* إذا حُددت للمستخدم قائمة `allowedTabs` مخصصة في ملفه الشخصي يتم اعتمادها؛ وإلا يتم الرجوع إلى مصفوفة التبويبات الافتراضية الخاصة بدوره الوظيفي (`roleTabMatrix[user.role]`).
  - *السبب:* يجمع بين سرعة الإدارة الجماعية للأدوار والمرونة الفردية لمنح أمين مخزن محدد صلاحية رؤية تبويبة إضافية عند الحاجة.

---

## 4. المعمارية التقنية واستراتيجية البيانات (Technical Architecture & Data Strategy)

### المخطط المعماري لتدفق الربط والصلاحيات

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Super Admin Tab Visibility Matrix                        │
│  Role Defaults:                                                            │
│  • SUPER_ADMIN : [DASHBOARD, CATALOG, TRANSACTIONS, STOCKTAKING,           │
│                   SUPER_ADMIN, CONFIG, SYNC]                               │
│  • ADMIN       : [DASHBOARD, CATALOG, TRANSACTIONS, STOCKTAKING,           │
│                   CONFIG, SYNC]                                            │
│  • STOREKEEPER : [DASHBOARD, CATALOG, TRANSACTIONS, STOCKTAKING, SYNC]     │
│  • AUDITOR     : [DASHBOARD, CATALOG, TRANSACTIONS, STOCKTAKING]           │
│  + Per-User Override: user.allowedTabs[]                                   │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                 Navigation & Route Guard Layer (App.tsx)                   │
│  1. Filters Desktop Sidebar (`navItems`) & Mobile Bottom Bar (`lg:hidden`) │
│  2. Active Route Watcher (`useEffect`):                                    │
│     If `!allowedTabs.includes(activeSection)` ──► Redirect to `DASHBOARD`  │
│     + Trigger Warning Toast Notification                                   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│             Automatic Google Sheet URL Parser & Sync Engine                │
│  Input: "https://docs.google.com/spreadsheets/d/1AbC...xyz/edit#gid=0"     │
│     │                                                                      │
│     ├──► Regex Parser extracts `spreadsheetId` = "1AbC...xyz" & `gid`="0"  │
│     │                                                                      │
│     ├──► Mode A: Direct Google Sheets API v4 (`POST /api/sync`)            │
│     │    Appends rows to `sheets.googleapis.com/v4/spreadsheets/{id}/...`  │
│     │                                                                      │
│     └──► Mode B: Auto-Bound Apps Script (`SpreadsheetApp.openById(id)`)    │
│          & Live Sheet Reachability Probe (`GET /api/sheets/verify`)        │
└────────────────────────────────────────────────────────────────────────────┘
```

### تحديثات نموذج البيانات والحالة (Data Model & State)

1. **`AppTabKey` و `RoleTabMatrix`:**
   - تعريف المفاتيح السبعة للتبويبات: `'DASHBOARD' | 'CATALOG' | 'TRANSACTIONS' | 'STOCKTAKING' | 'SUPER_ADMIN' | 'CONFIG' | 'SYNC'`.
   - إضافة `allowedTabs?: AppTabKey[]` إلى واجهة `UserAccount`.
   - إضافة `roleTabMatrix?: Record<UserRole, AppTabKey[]>` إلى إعدادات النظام المحفوظة في SQLite و IndexedDB.
2. **تحديثات `SyncConfig` للربط التلقائي بالرابط:**
   - إضافة الحقول التالية إلى `SyncConfig`:
     - `sheetUrl?: string` (الرابط الكامل الذي يلصقه المستخدم).
     - `spreadsheetId?: string` (المعرّف المستخرج تلقائياً).
     - `googleAccessToken?: string` (رمز الوصول الاختياري للكتابة المباشرة عبر Google Sheets API v4).
     - `connectionMethod?: 'SHEETS_URL_AUTO' | 'DIRECT_API_TOKEN' | 'WEBHOOK_URL'`.
