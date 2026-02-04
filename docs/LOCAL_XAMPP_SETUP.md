# تشغيل PlayTix محلياً مع MySQL (XAMPP)

## المتطلبات

- Node.js 18+
- XAMPP Control Panel v3.3.0 (أو أحدث)
- مشروع PlayTix

---

## الخطوة 1: تشغيل MySQL في XAMPP

1. افتح **XAMPP Control Panel**
2. اضغط **Start** بجانب **MySQL**
3. تأكد أن المنفذ 3306 يعمل (يظهر باللون الأخضر)

---

## الخطوة 2: إنشاء قاعدة البيانات

1. افتح المتصفح واذهب إلى: **http://localhost/phpmyadmin**
2. اضغط **New** (قاعدة بيانات جديدة)
3. اسم القاعدة: `padel_db`
4. Collation: `utf8mb4_unicode_ci`
5. اضغط **Create**

---

## الخطوة 3: إعداد ملف .env

في ملف `.env` في جذر المشروع، تأكد من وجود:

```
DATABASE_URL=mysql://root:@localhost:3306/padel_db
```

- إذا كان لـ root كلمة مرور، استخدم: `mysql://root:كلمة_المرور@localhost:3306/padel_db`
- إذا واجهت رموزاً خاصة في كلمة المرور، رمّزها (مثال: `@` → `%40`)

---

## الخطوة 4: تهيئة الجداول

من PowerShell في مجلد المشروع:

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/init-db" -Method POST
```

أو افتح المتصفح: **http://localhost:4000/api/init-db** (يُفضّل استخدام POST من أدوات التطوير).

---

## الخطوة 5: تشغيل التطبيق

### الطريقة الأولى: نافذتان في الطرفية

**النافذة الأولى — تشغيل واجهة البرمجة (API):**
```powershell
cd c:\padel\padel
npm run dev:api
```

**النافذة الثانية — تشغيل الواجهة الأمامية:**
```powershell
cd c:\padel\padel
npm run dev
```

### الطريقة الثانية: تهيئة ثم تشغيل كامل

1. شغّل `dev:api` أولاً
2. نفّذ تهيئة قاعدة البيانات (الخطوة 4)
3. شغّل `npm run dev`
4. افتح: **http://localhost:3000/app/**

---

## التحقق من الاتصال

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health"
```

المتوقع: `ok: True`, `db: True`

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| `db: False` | تأكد أن MySQL يعمل في XAMPP وأن `DATABASE_URL` صحيح |
| `ECONNREFUSED` | شغّل MySQL من XAMPP |
| كلمة مرور root | غيّر الرابط إلى `mysql://root:YOUR_PASSWORD@localhost:3306/padel_db` |
| قاعدة غير موجودة | أنشئ `padel_db` من phpMyAdmin |

---

## الخطوة التالية

بعد التأكد أن كل شيء يعمل محلياً، يمكنك الانتقال إلى النشر على Hostinger.
