# نشر PlayTix على Hostinger Business

## المتطلبات
- Hostinger Business (يدعم Node.js)
- مستودع GitHub
- قاعدة بيانات MySQL (من Hostinger)

---

## الخطوة 1: إنشاء قاعدة بيانات MySQL

1. hPanel → **Databases** → **Management**
2. **Create Database**
3. أدخل:
   - Database name: `padel_db`
   - Username: `padel_user`
   - Password: كلمة مرور قوية
4. احفظ: اسم القاعدة، المستخدم، كلمة المرور
5. **DATABASE_URL:** `mysql://username:password@localhost/database_name`  
   (عدّل حسب بياناتك. رمّز الأحرف الخاصة في كلمة المرور: `@` → `%40`, `%` → `%25`)

---

## الخطوة 2: نشر تطبيق Node.js

1. hPanel → **Websites** → **Add Website** → **Node.js Web App**
2. **Import Git repository** → **Connect with GitHub**
3. اختر المستودع `yakhawaji-lang/padel` والفرع `main`
4. إعدادات البناء:
   - Framework: **Vite**
   - Node: **18.x**
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
5. **Environment variables** → Add:
   - **Name:** `DATABASE_URL`
   - **Value:** رابط MySQL من الخطوة 1
6. **Deploy**

---

## الخطوة 3: تهيئة الجداول

بعد النشر، استدعِ:

```
POST https://your-site.hostingersite.com/api/init-db
```

مثال عبر curl:
```bash
curl -X POST https://khaki-yak-622008.hostingersite.com/api/init-db
```

---

## الخطوة 4: ربط الدومين

1. إعدادات التطبيق → **Domains** → أضف `playtix.app`
2. في Vercel (أو مسجّل الدومين): **Configure** → عدّل DNS ليشير إلى Hostinger

---

## ملاحظات

- **Build:** `npm run build` يبني الواجهة إلى `dist/`
- **Start:** `npm start` يشغّل Express (API + ملفات `dist/`)
- التطبيق يعمل مع **MySQL** فقط على Hostinger
