# نشر PlayTix على Hostinger Business

## الخطوة الثانية: رفع النظام مع قواعد البيانات إلى Hostinger عبر GitHub

---

## المتطلبات
- Hostinger Business (يدعم Node.js)
- مستودع GitHub متصل
- قاعدة بيانات MySQL (من Hostinger)

---

## 1️⃣ إنشاء قاعدة بيانات MySQL

1. ادخل إلى **hPanel** → **Databases** → **Databases** أو **MySQL Databases**
2. **Create New Database**
3. أدخل:
   - **Database name:** مثلاً `u502561206_padel_db` (Hostinger يضيف بادئة تلقائياً)
   - **Username:** مثلاً `u502561206_padel_user`
   - **Password:** كلمة مرور قوية واحفظها
4. من **Remote MySQL** أو **Manage** انسخ:
   - **Host:** غالباً `srv2069.hstgr.io` أو `localhost` (استخدم الهوست البعيد إن وُجد)
   - اسم القاعدة والمستخدم
5. صيغة **DATABASE_URL:**
   ```
   mysql://USERNAME:PASSWORD@HOST_FACTUAL/DATABASE_NAME
   ```
   - **مثال صحيح:** `mysql://u502561206_padel_user:كلمة_المرور@srv2069.hstgr.io/u502561206_padel_db`
   - **إذا ظهر Access denied @'::1':** استخدم `127.0.0.1` بدلاً من `localhost` (لتفادي IPv6)
   - رمّز الأحرف الخاصة في كلمة المرور: `@` → `%40` و `%` → `%25`

---

## 2️⃣ ربط GitHub والنشر

1. hPanel → **Websites** → موقعك → **Node.js** (أو **Add Website** → **Node.js Web App**)
2. **Deploy from Git** / **Import Git repository**
3. **Connect with GitHub** واختر المستودع والفرع (مثلاً `main`)
4. إعدادات البناء:
   | الإعداد | القيمة |
   |---------|--------|
   | **Framework preset** | Express |
   | **Entry file** | `server.js` |
   | **Node version** | 20.x |
   | **Build command** | `npm run build` |
   | **Start command** | `npm start` |
5. **Environment variables** → Add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | `mysql://u502561206_padel_user:PASSWORD@srv2069.hstgr.io/u502561206_padel_db` ← **استبدل PASSWORD وعدّل الهوست إذا لزم** |
   | `VITE_USE_POSTGRES` | `true` |
6. **Deploy**

---

## 3️⃣ تهيئة جداول قاعدة البيانات

بعد اكتمال النشر بنجاح:

### من المتصفح (الأسهل):
افتح الرابط في المتصفح:
```
https://your-site.hostingersite.com/api/init-db?init=1
```
مثال للموقع الحالي: `https://palegreen-armadillo-385480.hostingersite.com/api/init-db?init=1`

### PowerShell:
```powershell
Invoke-RestMethod -Uri "https://your-site.hostingersite.com/api/init-db" -Method POST
```

### curl:
```bash
curl -X POST https://your-site.hostingersite.com/api/init-db
```

### التحقق من الاتصال:
```powershell
Invoke-RestMethod -Uri "https://your-site.hostingersite.com/api/health"
```
يجب أن يعيد: `{"ok":true,"db":true}`

### التحقق من الجداول:
```powershell
Invoke-RestMethod -Uri "https://your-site.hostingersite.com/api/init-db/tables"
```
يعرض حالة كل جدول (entities, app_settings, matches, ...). إذا ظهر `exists: false` لأي جدول، أعد تنفيذ `POST /api/init-db`.

### إنشاء مدير المنصة الافتراضي (إن لم يوجد):
```powershell
Invoke-RestMethod -Uri "https://your-site.hostingersite.com/api/init-db/seed-platform-owner" -Method POST
```
- البريد: `2@2.com`
- كلمة المرور: `123456`

---

## 4️⃣ الجداول التي يتم إنشاؤها

| الجدول | الوظيفة |
|--------|---------|
| `entities` | الأندية، الأعضاء، مدراء المنصة |
| `app_settings` | الإعدادات، اللغة، الجلسات |
| `app_store` | ترحيل من نسخ قديمة |
| `matches` | مباريات البطولات |
| `member_stats` | إحصائيات الأعضاء |
| `tournament_summaries` | ملخصات البطولات |

---

## 5️⃣ ربط الدومين (اختياري)

1. إعدادات التطبيق → **Domains** → أضف دومينك (مثلاً `playtix.app`)
2. عند مسجّل الدومين عدّل **DNS** ليشير إلى Hostinger

---

## استكشاف الأخطاء

### 503 Service Unavailable (الخادم غير متاح)
1. **Application logs** في لوحة Node.js — ابحث عن `[server.js] Starting...` و `Padel API running on`
2. **Build logs** — البناء ناجح (✓ built) لكن 503 يعني أن العملية تتوقف بعد البناء. راجع آخر أسطر في السجلات
3. **مسار الملفات:** تأكد أن **Entry file** = `server.js` و **Start command** = `npm start`
4. **نوع الاستضافة:** Node.js يعمل على **Cloud Hosting** و **VPS** — إذا كان الموقع على استضافة مشتركة قديمة قد لا يدعم Node.js. تحقق من خطة الاستضافة
5. **File manager** → ابحث عن `stderr.log` أو `error.log` في مجلد التطبيق

### قاعدة البيانات لا تتصل — أو خطأ `getaddrinfo ENOTFOUND HOST`
```powershell
Invoke-RestMethod -Uri "https://your-site.hostingersite.com/api/db-check"
```
- `hasUrl: false` → أضف `DATABASE_URL` في Environment variables
- `looksMysql: false` → الرابط يجب أن يبدأ بـ `mysql://`
- **ENOTFOUND HOST** = استخدمت كلمة `HOST` حرفياً في الرابط. غيّرها إلى العنوان الفعلي من hPanel
- **Access denied @'::1'** = استخدم `127.0.0.1` بدلاً من `localhost` في DATABASE_URL (لتفادي IPv6)

### ملف .env يُحذف
لا تعتمد على ملف `.env` في Hostinger. استخدم **Environment variables** أو **الطريقة البديلة** أدناه.

### الحل البديل: ملف database.config.json
إذا لم تُقرأ Environment Variables:

**مهم:** الملف يجب أن يكون خارج مجلد النشر حتى لا يُحذف عند كل نشر من GitHub.

1. hPanel → **File Manager** → ادخل إلى مجلد الدومين (مثل `domains/palegreen-armadillo-385480.hostingersite.com`)
2. **لا تدخل** إلى `public_html` — أنشئ الملف في مجلد الدومين نفسه (فوق `public_html`)
3. أنشئ ملفاً باسم `database.config.json`
4. ضع المحتوى:
   ```json
   {"url": "mysql://u502561206_padel_user:كلمة_المرور@127.0.0.1/u502561206_padel_db"}
   ```
5. استبدل `كلمة_المرور` بكلمة المرور الفعلية
6. احفظ ثم **Restart** للتطبيق

**مسار بديل:** إن لم يتوفّر، جرّب `public_html/database.config.json` — قد يُستبدل عند النشر.

---

## ملخص الروابط

| الروابط | الوصف |
|---------|-------|
| `/` | يُحوّل إلى `/app/` |
| `/app/` | التطبيق الرئيسي |
| `/api/health` | فحص الحالة وقاعدة البيانات |
| `/api/init-db` | تهيئة الجداول (POST) |
| `/api/init-db/seed-platform-owner` | إنشاء المدير الافتراضي (POST) |
| `/api/init-db/tables` | التحقق من وجود الجداول (GET) |
