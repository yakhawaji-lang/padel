# نقل الملفات من nodejs إلى public_html

عندما يستنسخ Hostinger المشروع من GitHub في مجلد `nodejs`، يجب نقل الملفات إلى `public_html` ليعمل الموقع.

---

## الطريقة 1: File Manager (الأسهل)

### الخطوة 1: نسخ المحتويات
1. ادخل إلى **hPanel** → **File Manager**
2. افتح مجلد **nodejs**
3. حدّد **كل** الملفات والمجلدات داخل nodejs (Ctrl+A أو Select All)
4. اضغط **Copy** أو **نسخ**
5. انتقل إلى مجلد **public_html**
6. اضغط **Paste** أو **لصق**

### الخطوة 2: استبدال الملفات الموجودة
- إذا وُجدت ملفات قديمة في public_html، استبدلها أو احذفها قبل اللصق
- احتفظ بملف **.htaccess** في public_html (أو سيُنسخ من المشروع)

### الخطوة 3: التحقق
يجب أن يكون هيكل public_html كالتالي:
```
public_html/
├── .htaccess
├── server.js
├── package.json
├── index.html
├── dist/
├── app/
├── src/
├── server/
├── api/
├── public/
├── node_modules/
└── ...
```

### الخطوة 4: حذف المجلدات الفارغة (إن وُجدت)
- إذا بقي مجلد `.builds` في public_html، اتركه — Hostinger قد يحتاجه

### الخطوة 5: إعادة تشغيل التطبيق
من **Node.js** في hPanel → **Restart**

---

## الطريقة 2: سكربت (إن وُجد SSH أو Terminal)

إذا كان لديك وصول SSH أو Terminal على Hostinger:

```bash
cd ~/domains/playtix.app/nodejs
npm run copy-to-public-html
cd ../public_html
npm install
```

ثم **Restart** التطبيق. (السكربت لا ينسخ node_modules لتسريع النسخ؛ npm install ينشئه في public_html)

---

## الطريقة 3: ضغط ثم استخراج (للمجلدات الكبيرة)

1. في **nodejs**، حدّد كل الملفات
2. اضغط **Compress** → اختر **ZIP**
3. انتقل إلى **public_html**
4. ارفع ملف الـ ZIP أو انسخه إلى public_html
5. اضغط **Extract** لاستخراج المحتويات
6. احذف ملف الـ ZIP بعد الاستخراج
7. **Restart** التطبيق

---

## ملاحظات مهمة

- **لا تنقل** مجلد `nodejs` نفسه — انقل **محتوياته** فقط إلى public_html
- **database.config.json** يبقى في الجذر (domains/playtix.app/) خارج public_html
- بعد النقل، تأكد أن `.htaccess` في public_html يحتوي:
  ```
  PassengerAppRoot /home/u502561206/domains/playtix.app/public_html
  ```

---

## التحقق من عمل الموقع

- https://playtix.app/app/
- https://playtix.app/api/health
