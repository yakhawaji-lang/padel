# رفع ملفات التطبيق إلى public_html يدوياً

> **استعادة الملفات المحذوفة:** إذا حُذفت ملفات الموقع بعد Deploy من GitHub، السبب أن Git يستبدل المجلد بمحتويات المستودع (التي لا تحتوي `dist/` أو `app/` المبنية). استعد الملفات بتشغيل `npm run prepare-public-html` محلياً ثم رفع محتويات `deploy-public_html/` إلى Hostinger يدوياً (انظر الأسفل).

إذا لم تظهر ملفات التطبيق في `public_html` تلقائياً، اتبع هذه الخطوات:

## 1. تشغيل السكربت محلياً

من مجلد المشروع على جهازك:

```bash
npm run prepare-public-html
```

سيقوم السكربت بـ:
- بناء المشروع (`npm run build`)
- إنشاء مجلد `deploy-public_html/` بالمحتوى التالي:

```
deploy-public_html/
├── index.html      ← تحويل إلى /app/
└── app/
    ├── index.html  ← التطبيق الرئيسي
    ├── assets/     ← ملفات JS و CSS
    └── logo-playtix.png (إن وُجد)
```

## 2. رفع الملفات إلى Hostinger

### الطريقة أ: File Manager

1. ادخل إلى **hPanel** → **File Manager**
2. انتقل إلى `domains/playtix.app/public_html/`
3. احذف أو انسخ احتياطياً للملفات القديمة (احتفظ بـ `.htaccess` و `.builds` إن لزم)
4. ارفع **محتويات** مجلد `deploy-public_html/` (وليس المجلد نفسه):
   - `index.html` → في جذر public_html
   - مجلد `app/` بالكامل → داخل public_html

### الطريقة ب: ضغط ثم رفع (أسهل)

1. من جهازك، اضغط مجلد `deploy-public_html` إلى ملف zip
2. في Hostinger File Manager: ادخل إلى `public_html` → **Upload**
3. ارفع ملف الـ zip
4. انقر بزر الماوس الأيمن على الملف → **Extract** → استخرج داخل `public_html`

## 3. التحقق

بعد الرفع، يجب أن يكون الهيكل:

```
public_html/
├── index.html
├── app/
│   ├── index.html
│   └── assets/
│       ├── index-xxx.js
│       ├── index-xxx.css
│       └── ...
├── .htaccess      (إن وُجد)
└── .builds/       (إن وُجد)
```

ثم جرّب: **https://playtix.app/app/**

---

## استعادة الملفات بعد حذفها (مثلاً Deploy من GitHub)

عند **Deploy من GitHub** أو **Pull**، Hostinger يستبدل مجلد النشر بمحتويات المستودع. المستودع لا يحتوي على الملفات المبنية (`dist/`, `app/`) لأنها تُنشأ أثناء البناء. إذا فشل البناء أو كان الهيكل مختلفاً، قد يظهر الموقع فارغاً.

**الحل السريع:**

1. من جهازك، شغّل:
   ```bash
   cd C:\padel\padel
   npm run prepare-public-html
   ```
2. ارفع **محتويات** مجلد `deploy-public_html/` إلى `domains/playtix.app/public_html/` عبر File Manager (أو zip ثم استخراج).
3. احتفظ بـ `.htaccess` و `.builds` و `node_modules` و `server.js` إن وُجدت — لا تُستبدل إلا `index.html` ومجلد `app/`.

**لتجنب المشكلة لاحقاً:** استخدم الرفع اليدوي لملفات الواجهة (`deploy-public_html`) بعد كل تحديث بدلاً من الاعتماد على Deploy من GitHub لتعبئة `public_html` بالكامل.
