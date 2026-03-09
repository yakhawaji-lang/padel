# نشر PlayTix — GitHub + Hostinger (إعداد كامل من الصفر)

دليل شامل لرفع المشروع إلى GitHub وربطه مع Hostinger وزراعة قاعدة البيانات.

---

## الهيكل المطلوب على Hostinger

```
domains/playtix.app/
├── database.config.json    ← خارج public_html (لا يتأثر بالتحديثات من Git)
├── .env                    ← اختياري (أو استخدم Environment Variables)
└── public_html/            ← مجلد المشروع من GitHub
    ├── .htaccess
    ├── server.js
    ├── package.json
    ├── dist/
    ├── app/
    ├── node_modules/
    └── ...
```

**مهم:** `database.config.json` يجب أن يكون في `domains/playtix.app/` (خارج `public_html`) حتى لا يُحذف أو يُستبدَل عند كل تحديث من GitHub.

---

## المرحلة 1: تجهيز المشروع للرفع إلى GitHub

### 1.1 التحقق من الملفات المستثناة

تأكد أن `.gitignore` يستثني الملفات الحساسة:

```
.env
.env.local
database.config.json
node_modules/
dist/
deploy-public_html/
```

### 1.2 رفع المشروع

```bash
cd C:\padel\padel
git status
git add .
git commit -m "Prepare for Hostinger deployment"
git push origin main
```

تأكد أن المستودع محدث على GitHub: [https://github.com/yakhawaji-lang/padel](https://github.com/yakhawaji-lang/padel)

---

## المرحلة 2: إنشاء قاعدة بيانات MySQL في Hostinger

### 2.1 الدخول إلى لوحة التحكم

1. hPanel → **Databases** → **MySQL Databases**
2. اضغط **Create New Database**

### 2.2 إدخال البيانات

| الحقل | مثال | ملاحظة |
|-------|------|--------|
| Database name | `u502561206_padel_db` | Hostinger يضيف بادئة تلقائياً |
| Username | `u502561206_padel_user` | |
| Password | كلمة مرور قوية | احفظها في مكان آمن |

### 2.3 الحصول على بيانات الاتصال

من **Manage** أو **phpMyAdmin**:
- **Host:** استخدم `127.0.0.1` (وليس `localhost` — يتفادى مشاكل IPv6)
- **Database:** الاسم الكامل (مثل `u502561206_padel_db`)
- **Username:** الاسم الكامل
- **Password:** كلمة المرور التي أنشأتها

### 2.4 صيغة الرابط

```
mysql://USERNAME:PASSWORD@127.0.0.1/DATABASE_NAME
```

**مثال:**
```
mysql://u502561206_padel_user:MySecurePass123@127.0.0.1/u502561206_padel_db
```

**تحذير:** إذا كانت كلمة المرور تحتوي أحرفاً خاصة، رمّزها:
- `@` → `%40`
- `%` → `%25`
- `#` → `%23`

---

## المرحلة 3: إنشاء ملف database.config.json (خارج public_html)

### 3.1 الموقع الصحيح

الملف يجب أن يكون في **`domains/playtix.app/`** وليس داخل `public_html`.

### 3.2 الخطوات

1. hPanel → **File Manager**
2. ادخل إلى مجلد الدومين: `domains/playtix.app`
3. **لا تدخل** إلى `public_html` — ابقَ في مجلد `playtix.app`
4. اضغط **+ New File**
5. اسم الملف: `database.config.json`
6. المحتوى:

```json
{
  "url": "mysql://USERNAME:PASSWORD@127.0.0.1/DATABASE_NAME"
}
```

7. استبدل `USERNAME`، `PASSWORD`، `DATABASE_NAME` بالقيم الفعلية من المرحلة 2
8. احفظ الملف

### 3.3 التحقق

التطبيق يبحث عن الملف تلقائياً في المجلد الأب لـ `public_html`. عند تشغيل التطبيق من `public_html`، سيجد `../database.config.json`.

---

## المرحلة 4: ربط Hostinger بـ GitHub

### 4.1 إنشاء تطبيق Node.js

1. hPanel → **Websites** → اختر الموقع (playtix.app)
2. ابحث عن **Node.js** أو **Deploy from Git** أو **Git**
3. اضغط **Connect to GitHub** أو **Import repository**

### 4.2 إعداد الاستنساخ

| الإعداد | القيمة |
|---------|--------|
| Repository | `yakhawaji-lang/padel` |
| Branch | `main` |
| Root directory | `public_html` (أو المجلد الذي يحدده Hostinger) |

### 4.3 إعدادات البناء والتشغيل

| الإعداد | القيمة |
|---------|--------|
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Entry file** | `server.js` |
| **Node version** | 20.x أو أحدث |

### 4.4 متغيرات البيئة (اختياري)

إذا فضّلت استخدام Environment Variables بدلاً من `database.config.json`:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `mysql://USER:PASS@127.0.0.1/DB_NAME` |
| `BASE_URL` | `https://playtix.app` |
| `BASE_PATH` | `/app` |

**ملاحظة:** إذا وُجد `database.config.json` في المكان الصحيح، لا حاجة لـ `DATABASE_URL` في Environment Variables.

---

## المرحلة 5: النشر الأول

### 5.1 تنفيذ Deploy

1. اضغط **Deploy** أو **Redeploy**
2. انتظر اكتمال البناء (راقب Build logs)
3. بعد النجاح، اضغط **Restart** للتطبيق

### 5.2 ما يحدث عند البناء

1. Hostinger يستنسخ المشروع من GitHub
2. يشغّل `npm run build` (Vite build + postbuild)
3. `server.js` ينسخ `dist/` إلى `app/` داخل `public_html`
4. التطبيق يبدأ ويقرأ `database.config.json` من المجلد الأب

---

## المرحلة 6: تهيئة قاعدة البيانات

### 6.1 التحقق من الاتصال

افتح في المتصفح:
```
https://playtix.app/api/health
```
يجب أن يعيد: `{"ok":true,"db":true}`

### 6.2 التشخيص (إذا كانت db: false)

```
https://playtix.app/api/db-check
```

| المشكلة | الحل |
|---------|------|
| `hasConnectionString: false` | أنشئ `database.config.json` في `domains/playtix.app/` |
| `Access denied @'::1'` | استخدم `127.0.0.1` بدلاً من `localhost` |
| `Connect timed out` | راجع Remote MySQL في hPanel — أضف `127.0.0.1` أو `%` |

### 6.3 تهيئة الجداول

**من المتصفح:**
```
https://playtix.app/api/init-db?init=1
```

يُنشئ الجداول والبيانات الافتراضية (مدير المنصة).

### 6.4 إعادة تهيئة كاملة (اختياري)

⚠️ يحذف جميع البيانات:
```
https://playtix.app/api/init-db?reset=1
```

### 6.5 التحقق من الجداول

```
https://playtix.app/api/init-db/tables
```

### 6.6 ترحيل إعدادات الأندية (إن وُجدت)

```
https://playtix.app/api/init-db/migrate-club-settings
```

---

## المرحلة 7: التحقق النهائي

| الرابط | النتيجة المتوقعة |
|--------|------------------|
| `https://playtix.app/` | تحويل إلى `/app/` |
| `https://playtix.app/app/` | الصفحة الرئيسية |
| `https://playtix.app/app/admin-login` | صفحة دخول المدير |
| `https://playtix.app/api/health` | `{"ok":true,"db":true}` |

### بيانات الدخول الافتراضية

- **البريد:** `admin@playtix.app`
- **كلمة المرور:** `Admin@123456`

---

## التحديثات القادمة

عند تعديل المشروع محلياً:

```bash
git add .
git commit -m "وصف التعديل"
git push origin main
```

ثم من Hostinger:
- **Redeploy** أو **Pull** من GitHub
- **Restart** التطبيق

**ملف `database.config.json` آمن** — لن يتأثر لأنه خارج `public_html`.

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| 503 Service Unavailable | راجع Application logs — تأكد من `npm start` و `server.js` |
| db: false | أنشئ `database.config.json` في `domains/playtix.app/` |
| 404 على /app/ | تأكد من وجود مجلد `app/` وملف `index.html` |
| database.config.json يُحذف | ضعه في `domains/playtix.app/` وليس داخل `public_html` |

---

## ملخص الروابط

| الرابط | الوصف |
|--------|-------|
| `https://playtix.app/api/health` | فحص الحالة وقاعدة البيانات |
| `https://playtix.app/api/db-check` | تشخيص قاعدة البيانات |
| `https://playtix.app/api/init-db?init=1` | تهيئة الجداول |
| `https://playtix.app/api/init-db?reset=1` | إعادة تهيئة كاملة |
| `https://playtix.app/api/init-db/tables` | التحقق من الجداول |
