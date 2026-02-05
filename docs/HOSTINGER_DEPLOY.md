# نشر PlayTix على Hostinger — playtix.app

## دليل بناء الموقع من الصفر خطوة بخطوة

---

## نظرة عامة

| البند | القيمة |
|-------|--------|
| **الدومين** | `playtix.app` |
| **المنصة** | Hostinger Business (Cloud Hosting أو VPS يدعم Node.js) |
| **قاعدة البيانات** | MySQL (من Hostinger) |
| **المكدس** | Node.js 18+، React/Vite، Express |

---

## المرحلة 0: بناء محلي (اختياري — للتجربة قبل النشر)

```bash
git clone https://github.com/YOUR_USER/padel.git
cd padel
npm install
```

أنشئ ملف `.env` (انسخ من `.env.example`) وضع:
```
DATABASE_URL=mysql://root:@localhost:3306/padel_db
VITE_USE_POSTGRES=true
```

```bash
npm run build
npm start
```

افتح `http://localhost:4000` — التطبيق يعمل محلياً.

---

## المرحلة 0: المتطلبات المسبقة

- [ ] حساب Hostinger Business أو VPS
- [ ] الدومين `playtix.app` مُسجَّل ومُوجَّه إلى Hostinger (أو جاهز للربط)
- [ ] مستودع GitHub للمشروع
- [ ] معرفة بيانات MySQL من hPanel

---

## المرحلة 1: إنشاء قاعدة بيانات MySQL

### 1.1 الدخول إلى لوحة التحكم
1. hPanel → **Databases** → **MySQL Databases**
2. اضغط **Create New Database**

### 1.2 إدخال البيانات
| الحقل | مثال | ملاحظة |
|-------|------|--------|
| Database name | `u502561206_padel_db` | Hostinger يضيف بادئة تلقائياً |
| Username | `u502561206_padel_user` | |
| Password | كلمة مرور قوية | احفظها |

### 1.3 الحصول على بيانات الاتصال
- من **Remote MySQL** أو **Manage** انسخ:
  - **Host:** `srv2069.hstgr.io` أو `localhost` أو `127.0.0.1`
  - اسم القاعدة والمستخدم

### 1.4 صيغة DATABASE_URL
```
mysql://USERNAME:PASSWORD@HOST/DATABASE_NAME
```

**أمثلة:**
```
mysql://u502561206_padel_user:MyPass123@srv2069.hstgr.io/u502561206_padel_db
mysql://u502561206_padel_user:MyPass123@127.0.0.1/u502561206_padel_db
```

**تحذيرات مهمة:**
- عند ظهور `Access denied @'::1'` → استخدم `127.0.0.1` بدلاً من `localhost` (تفادي IPv6)
- رمّز الأحرف الخاصة: `@` → `%40`، `%` → `%25`، `#` → `%23`

---

## المرحلة 2: إعداد التطبيق Node.js على Hostinger

### 2.1 إنشاء تطبيق Node.js
1. hPanel → **Websites** → اختر الموقع (أو أنشئ موقعاً جديداً)
2. **Node.js** أو **Add Website** → **Node.js Web App**
3. اختر الدومين `playtix.app` أو أضفه لاحقاً

### 2.2 ربط مستودع GitHub
1. **Deploy from Git** / **Import Git repository**
2. **Connect with GitHub** واختر المستودع والفرع (`main`)

### 2.3 إعدادات البناء

| الإعداد | القيمة |
|---------|--------|
| Framework preset | Express |
| Entry file | `server.js` |
| Node version | 20.x |
| Build command | `npm run build` |
| Start command | `npm start` |
| Root directory | (اتركه فارغاً إن كان المشروع في الجذر) |

### 2.4 متغيرات البيئة (Environment Variables)

| Name | Value |
|------|-------|
| `DATABASE_URL` | `mysql://USER:PASS@127.0.0.1/DATABASE` ← استبدل بالقيم الفعلية |
| `VITE_USE_POSTGRES` | `true` |
| `BASE_URL` | `https://playtix.app/app` |

**اختياري — استعادة كلمة المرور (Resend):**
| Name | Value |
|------|-------|
| `RESEND_API_KEY` | مفتاح API من resend.com |
| `RESEND_FROM` | `PlayTix <noreply@playtix.app>` (بعد التحقق من الدومين) |

### 2.5 النشر
اضغط **Deploy** وانتظر اكتمال البناء. راقب **Build logs** للتأكد من عدم وجود أخطاء.

---

## المرحلة 3: تهيئة قاعدة البيانات

### 3.1 التحقق من الاتصال
افتح في المتصفح:
```
https://playtix.app/api/health
```
يجب أن يعيد: `{"ok":true,"db":true}`

### 3.2 التشخيص (إذا كانت db: false)
```
https://playtix.app/api/db-check
```
- `hasUrl: false` → أضف `DATABASE_URL` في Environment variables
- `ENOTFOUND HOST` → استبدل أي placeholder بـ HOST الفعلي
- `Access denied @'::1'` → استخدم `127.0.0.1` بدلاً من `localhost`

### 3.3 تهيئة الجداول
**من المتصفح (الأسهل):**
```
https://playtix.app/api/init-db?init=1
```

**إعادة تهيئة كاملة (حذف كل البيانات وإعادة الإنشاء):**
```
https://playtix.app/api/init-db?reset=1
```
⚠️ يحذف جميع البيانات في `u502561206_padel_db` ويعيد إنشاء الجداول والبيانات الافتراضية.

**من PowerShell:**
```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db?init=1"
```

**أو POST:**
```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db" -Method POST
```

### 3.4 التحقق من الجداول
```
https://playtix.app/api/init-db/tables
```
تأكد أن كل الجداول تظهر `exists: true`.

### 3.5 ترحيل إعدادات الأندية (إن وُجدت أندية قديمة)
إذا كان لديك أندية من نسخة سابقة، أضف الحقول الناقصة لـ Club Settings:
```powershell
Invoke-RestMethod -Uri "https://playtix.app/api/init-db/migrate-club-settings" -Method POST
```

### 3.6 تسجيل الدخول كمدير منصة
- **البريد:** `2@2.com`
- **كلمة المرور:** `123456`
- **الرابط:** `https://playtix.app/app/admin-login`

---

## المرحلة 4: ربط الدومين playtix.app

### 4.1 من لوحة Hostinger
1. إعدادات التطبيق Node.js → **Domains**
2. أضف `playtix.app` و `www.playtix.app` (اختياري)

### 4.2 من مسجّل الدومين (Namecheap, Cloudflare, إلخ)
- **A record:** يشير إلى عنوان IP المُعرَّض في Hostinger Domains
- أو استخدم **Nameservers** الخاصة بـ Hostinger
- انتظر انتشار DNS (عادة 15 دقيقة — 48 ساعة)

---

## المرحلة 5: ملف database.config.json (خارج public_html)

على Hostinger، الطريقة الموصى بها لضمان قراءة الاتصال: إنشاء الملف **خارج** `public_html` حتى لا يُحذف عند كل Deploy من GitHub.

### الهيكل المطلوب
```
domains/
  playtix.app/
    database.config.json   ← هنا (خارج public_html)
    public_html/           ← مجلد النشر من Git
      ...
```

### الخطوات
1. hPanel → **File Manager**
2. ادخل إلى مجلد الدومين: `domains/playtix.app`
3. **لا تدخل** إلى `public_html` — ابقَ في مجلد `playtix.app`
4. أنشئ ملفاً باسم `database.config.json`
5. المحتوى:
```json
{"url": "mysql://USERNAME:PASSWORD@127.0.0.1/DATABASE_NAME"}
```
6. احفظ ثم **Restart** للتطبيق

التطبيق يبحث عن الملف في المجلد الأب لـ `public_html` تلقائياً.

---

## استكشاف الأخطاء

### 503 Service Unavailable
1. **Application logs** — ابحث عن `[server.js] Starting...` و `Padel API running on`
2. **Build logs** — تأكد أن البناء نجح (✓ built)
3. **Entry file** = `server.js`، **Start command** = `npm start`
4. تأكد أن خطة الاستضافة تدعم Node.js (Cloud Hosting أو VPS)

### قاعدة البيانات لا تتصل
- استخدم `/api/db-check` للتشخيص
- راجع صيغة `DATABASE_URL` (يبدأ بـ `mysql://`)
- جرّب `127.0.0.1` بدلاً من `localhost`
- جرّب `database.config.json` كبديل

### ملف .env يُحذف
لا تعتمد على `.env` في Hostinger. استخدم **Environment variables** أو `database.config.json`.

---

## ملخص الروابط — playtix.app

| الرابط | الوصف |
|--------|-------|
| `https://playtix.app/` | يُحوّل إلى `/app/` |
| `https://playtix.app/app/` | التطبيق الرئيسي |
| `https://playtix.app/app/admin-login` | دخول مدير المنصة |
| `https://playtix.app/api/health` | فحص الحالة وقاعدة البيانات |
| `https://playtix.app/api/db-check` | تشخيص قاعدة البيانات |
| `https://playtix.app/api/init-db?init=1` | تهيئة الجداول (من المتصفح) |
| `https://playtix.app/api/init-db?reset=1` | إعادة تهيئة كاملة (حذف وإعادة إنشاء) |
| `https://playtix.app/api/init-db/tables` | التحقق من وجود الجداول |
| `https://playtix.app/api/init-db/migrate-club-settings` | ترحيل إعدادات الأندية (POST) |

---

## الجداول التي يتم إنشاؤها

| الجدول | الوظيفة |
|--------|---------|
| `entities` | الأندية، الأعضاء، مدراء المنصة |
| `app_settings` | الإعدادات، اللغة، الجلسات |
| `app_store` | ترحيل من نسخ قديمة |
| `matches` | مباريات البطولات |
| `member_stats` | إحصائيات الأعضاء |
| `tournament_summaries` | ملخصات البطولات |
