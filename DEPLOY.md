# نشر المشروع على Vercel و GitHub

هذا المشروع **تطبيق React + Vite** (واجهة أمامية فقط)، وليس خادم Express. لا يوجد `index.js` ولا `app.listen()` — وهذا صحيح لـ Vercel.

---

## الخطة العامة

1. تجهيز المشروع على جهازك  
2. رفعه إلى GitHub  
3. ربطه بـ Vercel وتشغيله  
4. التأكد أن Node.js يعمل  
5. (اختياري) إضافة دومين  

---

## المرحلة 1: تجهيز المشروع على جهازك

### 1️⃣ بنية المشروع (React + Vite)

المشروع يحتوي على:

- **`package.json`** — مع السكربتات:
  - `npm run dev` — تشغيل التطوير محلياً
  - `npm run build` — بناء المشروع للإنتاج
  - `npm run preview` أو `npm start` — معاينة البناء محلياً

- **ملف الدخول للتطبيق:** `index.html` و `src/main.jsx` (وليس Express)

- **`vercel.json`** — إعدادات Vercel:
  - البناء: `npm run build`
  - المجلد الناتج: `dist`
  - إعادة توجيه كل المسارات إلى `index.html` حتى يعمل React Router بشكل صحيح

### 2️⃣ التأكد من Node.js

```bash
node -v
npm -v
```

إذا لم يكن مثبتاً: حمّل من [nodejs.org](https://nodejs.org).

### 3️⃣ تثبيت الاعتماديات وتجربة البناء

```bash
cd c:\padel\padel
npm install
npm run build
```

إذا اكتمل البناء بدون أخطاء، المجلد `dist` سيُنشأ — وهذا ما ستنشره Vercel.

---

## المرحلة 2: رفع المشروع إلى GitHub

1. أنشئ مستودعاً جديداً على [github.com](https://github.com) (مثلاً: `padel-clubs`).
2. لا تختر "Add a README" إذا كان عندك بالفعل ملفات في المشروع.
3. من مجلد المشروع على جهازك:

```bash
cd c:\padel\padel
git init
git add .
git commit -m "Initial commit - Padel clubs platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(استبدل `YOUR_USERNAME` و `YOUR_REPO` باسم المستخدم واسم المستودع.)

---

## المرحلة 3: ربط المشروع بـ Vercel

1. ادخل إلى [vercel.com](https://vercel.com) وسجّل الدخول (يفضل بحساب GitHub).
2. **Add New Project** → اختر المستودع من GitHub.
3. Vercel يكتشف تلقائياً أنه مشروع **Vite**:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. اضغط **Deploy**.
5. بعد انتهاء النشر ستحصل على رابط مثل: `https://your-project.vercel.app`.

لا حاجة لـ `index.js` ولا لـ Express ولا لـ `app.listen()` — Vercel يبني الملفات الثابتة من `dist` ويخدمها.

---

## المرحلة 4: (اختياري) إضافة دومين

من لوحة المشروع في Vercel: **Settings → Domains** ثم أضف دومينك (مثل `padel.example.com`).

---

## ملخص الفرق عن خادم Express

| ما ذكرته (Express) | مشروعك (React + Vite) |
|--------------------|------------------------|
| `index.js` + `app.listen()` | لا يوجد — تطبيق أمامي فقط |
| `"start": "node index.js"` | `"start": "vite preview"` وبناء الإنتاج عبر `npm run build` |
| خادم يعمل باستمرار | Vercel يخدم الملفات من مجلد `dist` (Static) |

المشروع جاهز للنشر على Vercel كما هو بعد إعداد GitHub والربط.
