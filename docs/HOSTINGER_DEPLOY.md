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
   - **تحذير:** لا تضع كلمة `HOST` حرفياً! استبدلها بعنوان MySQL الفعلي من hPanel (مثل `srv2069.hstgr.io` أو `localhost`)
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

### PowerShell (Windows):
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

### 503 أو الصفحة بيضاء
1. **Deployments** → أحدث نشر → **Build logs**: تأكد من `[server.js] Starting...` و `Padel API running on`
2. **File manager** → `public_html/stderr.log` لأخطاء التشغيل
3. تأكد من **Environment variables** ووجود `DATABASE_URL` الصحيح

### قاعدة البيانات لا تتصل — أو خطأ `getaddrinfo ENOTFOUND HOST`
```powershell
Invoke-RestMethod -Uri "https://your-site.hostingersite.com/api/db-check"
```
- `hasUrl: false` → أضف `DATABASE_URL` في Environment variables
- `looksMysql: false` → الرابط يجب أن يبدأ بـ `mysql://`
- **ENOTFOUND HOST** = استخدمت كلمة `HOST` حرفياً في الرابط. غيّرها إلى العنوان الفعلي من hPanel:
  - غالباً: `srv2069.hstgr.io` أو `localhost`
  - من hPanel → Databases → Manage → انسخ Host
  - مثال صحيح: `mysql://u502561206_padel_user:YAkhawaji1978@srv2069.hstgr.io/u502561206_padel_db`

### ملف .env يُحذف
لا تعتمد على ملف `.env` في Hostinger. استخدم **Environment variables** من إعدادات تطبيق Node.js فقط.

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
