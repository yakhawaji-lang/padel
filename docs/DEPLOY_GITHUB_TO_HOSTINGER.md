# رفع المشروع من GitHub إلى Hostinger

دليل خطوة بخطوة لنشر المشروع الكامل من GitHub إلى Hostinger.

---

## هيكل المشروع على Hostinger

المشروع يجب أن يكون **داخل** `public_html`:

```
domains/playtix.app/
├── database.config.json   ← خارج public_html (يحتوي بيانات الاتصال)
├── .env                   ← خارج public_html (اختياري)
└── public_html/           ← مجلد المشروع كاملاً
    ├── .htaccess
    ├── server.js
    ├── package.json
    ├── dist/
    ├── app/
    ├── api/
    ├── src/
    └── ...
```

**ملاحظة:** `database.config.json` يبقى خارج `public_html` لأنّه يحتوي بيانات حساسة ولا يُرفع مع Git.

---

## ⚠️ الحفاظ على الملفات الموجودة (مهم)

عند النشر من GitHub، الملفات التالية **آمنة ولن تُحذف** لأنها خارج مجلد الاستنساخ:

| الملف/المجلد | الموقع | الحالة |
|--------------|--------|--------|
| `database.config.json` | الجذر (domains/playtix.app/) | آمن — خارج public_html |
| `.env` | الجذر | آمن — خارج public_html |
| `DO_NOT_UPLOAD_HERE` | الجذر | آمن |

**ملاحظة:** إذا كان Hostinger يوفّر خيار **"Pull"** أو **"Update"** بدلاً من **"Clone"**، استخدمه — يحافظ على الملفات غير المتتبعة ولا يستبدل المجلد بالكامل.

**قبل أول نشر:** تأكد أن ملف `.htaccess` مضاف إلى المستودع (`git add .htaccess`) حتى يُرفع مع المشروع ولا يُستبدَل بإعدادات افتراضية.

---

## الخطوة 1: التأكد أن المشروع على GitHub

المستودع: **https://github.com/yakhawaji-lang/padel**

من جهازك المحلي:
```bash
cd C:\padel\padel
git status
git push origin main
```

تأكد أن كل التعديلات مرفوعة (`nothing to commit, working tree clean` و `up to date`).

---

## الخطوة 2: ربط Hostinger بـ GitHub

1. ادخل إلى **hPanel** → **Websites** → اختر **playtix.app**
2. ابحث عن **Node.js** أو **Deploy from Git** أو **Git**
3. اضغط **Connect to GitHub** أو **Import repository**
4. اختر المستودع: **yakhawaji-lang/padel** (أو المسار الصحيح لمستودعك)
5. اختر الفرع: **main**
6. حدد مجلد الوجهة: **public_html** (إذا وُجد خيار تحديد مجلد الوجهة)

---

## الخطوة 3: إعدادات التطبيق

| الإعداد | القيمة |
|--------|--------|
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Node version** | 20.x أو أحدث |
| **Application root** | `public_html` (مهم: التطبيق يعمل من public_html بعد النسخ التلقائي) |

**نسخ تلقائي:** عند تشغيل `npm run build`، يُنفَّذ تلقائياً `postbuild` الذي ينسخ كل الملفات من `nodejs` إلى `public_html`.

---

## الخطوة 4: النشر (Deploy)

1. اضغط **Deploy** أو **Redeploy**
2. انتظر انتهاء البناء (راقب Build logs)
3. بعد النجاح، اضغط **Restart** للتطبيق

---

## الخطوة 5: ما يحدث عند النشر

1. **Hostinger** يستنسخ المشروع في `nodejs`
2. **Build** يشغّل `vite build` ثم `postbuild` ينسخ كل الملفات إلى `public_html`
3. **.htaccess** في `public_html` يوجّه Passenger لتشغيل التطبيق من `public_html`
4. التطبيق يعمل من `public_html` ويخدم الموقع

---

## الخطوة 6: التحقق

1. **API:** https://playtix.app/api/health → يجب أن يعيد `{"ok":true,"db":true}`
2. **التطبيق:** https://playtix.app/app/
3. **تسجيل الدخول:** https://playtix.app/app/admin-login

---

## تحديث المشروع لاحقاً

عند تعديل الكود محلياً:

```bash
cd C:\padel\padel
git add .
git commit -m "وصف التعديل"
git push origin main
```

ثم من Hostinger:
- **Redeploy** أو **Pull** من GitHub
- **Restart** التطبيق

---

## استكشاف الأخطاء

| المشكلة | الحل |
|--------|--------|
| 404 على /app/ | تحقق من Application logs: ابحث عن `[server.js] SPA copied to` |
| لا توجد ملفات في public_html | تأكد أن Git يستنسخ في `public_html` وأن `server.js` ينسخ `dist` إلى `app/` |
| build فشل | راجع Build logs واتأكد من وجود `npm run build` في الإعدادات |
