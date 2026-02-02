# نشر منصة بادل على Vercel — خطوة بخطوة

دليل تفصيلي لنشر التطبيق على Vercel مع قاعدة بيانات PostgreSQL سحابية.

---

## المتطلبات قبل البدء

- [ ] حساب على [GitHub](https://github.com)
- [ ] المشروع مرفوع على مستودع GitHub
- [ ] حساب على [Vercel](https://vercel.com) (يمكن تسجيل الدخول بحساب GitHub)

---

# الجزء الأول: إنشاء قاعدة البيانات السحابية

## الخطوة 1: إنشاء حساب وقاعدة بيانات على Neon (مجاني)

### 1.1 إنشاء الحساب

1. ادخل إلى **https://neon.tech**
2. اضغط **Sign Up**
3. اختر **Continue with GitHub** (أو البريد الإلكتروني)
4. أكمل التسجيل والدخول إلى لوحة التحكم

### 1.2 إنشاء مشروع وقاعدة بيانات

1. من الصفحة الرئيسية اضغط **New Project**
2. أدخل **Project name** (مثل: `padel-db`)
3. اختر **Region** الأقرب لك (مثل: `East US`)
4. اضغط **Create Project**

### 1.3 نسخ رابط الاتصال

1. بعد إنشاء المشروع ستظهر لوحة التحكم
2. ابحث عن خانة **Connection string** أو **Postgres**
3. انسخ الرابط الذي يبدأ بـ `postgresql://`
   - يكون بالشكل: `postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require`
4. احتفظ بهذا الرابط — ستستخدمه في الخطوات التالية

---

# الجزء الثاني: ربط المشروع بـ Vercel ونشره

## الخطوة 2: إنشاء مشروع Vercel وربطه بـ GitHub

### 2.1 الدخول إلى Vercel

1. ادخل إلى **https://vercel.com**
2. اضغط **Log In** واختر **Continue with GitHub**
3. أذن لـ Vercel بالوصول إلى مستودعاتك (إن طُلب منك ذلك)

### 2.2 إضافة مشروع جديد

1. من لوحة التحكم اضغط **Add New...** ثم **Project**
2. ستظهر قائمة بمستودعات GitHub
3. ابحث عن مستودع **padel** (أو اسم مستودعك)
4. اضغط **Import** بجانب المستودع

### 2.3 إعدادات المشروع قبل النشر

في صفحة الإعدادات:

| الحقل | القيمة | ملاحظة |
|-------|--------|--------|
| **Framework Preset** | Vite | عادةً يُكتشف تلقائياً |
| **Root Directory** | `./` | اتركه كما هو إن كان المشروع في الجذر |
| **Build Command** | `npm run build` | افتراضي |
| **Output Directory** | `dist` | افتراضي |

**لا تضغط Deploy الآن** — نحتاج إضافة متغير قاعدة البيانات أولاً.

---

## الخطوة 3: إضافة متغير قاعدة البيانات

### 3.1 فتح إعدادات المتغيرات

1. في نفس صفحة الإعدادات، انزل إلى قسم **Environment Variables**
2. أو بعد إنشاء المشروع: **Settings** → **Environment Variables**

### 3.2 إضافة DATABASE_URL

1. في خانة **Key** اكتب: `DATABASE_URL`
2. في خانة **Value** الصق رابط PostgreSQL من Neon (الذي نسخته في الخطوة 1.3)
3. تأكد أن الرابط يحتوي على `?sslmode=require` في النهاية
4. اختر **Production** و **Preview** و **Development** (كل البيئات)
5. اضغط **Save**

**مثال للقيمة:**
```
postgresql://neondb_owner:xxxxxxxx@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## الخطوة 4: نشر المشروع

### 4.1 النشر الأول

1. إذا كنت في صفحة الإعدادات، اضغط **Deploy**
2. انتظر انتهاء البناء (عادةً 1–3 دقائق)
3. عند النجاح ستظهر رسالة **Congratulations!** مع رابط المشروع

### 4.2 الحصول على رابط التطبيق

1. الرابط يكون بالشكل: `https://padel-xxx.vercel.app`
2. احفظ هذا الرابط — هو رابط التطبيق المنشور

---

## الخطوة 5: تهيئة الجداول في قاعدة البيانات

**مرة واحدة فقط** بعد النشر الأول.

### 5.1 على Windows (PowerShell)

1. افتح PowerShell في مجلد المشروع
2. نفّذ (استبدل الرابط برابط Neon الحقيقي):

```powershell
$env:DATABASE_URL = "postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
npm run db:init
```

### 5.2 على Mac/Linux

```bash
export DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
npm run db:init
```

### 5.3 التأكد من النجاح

يجب أن تظهر رسالة: **Database initialized successfully**

---

# الجزء الثالث: التحقق والنشرات التالية

## الخطوة 6: التحقق من عمل التطبيق

1. افتح رابط المشروع: `https://your-app.vercel.app`
2. جرّب إنشاء نادي أو تسجيل عضو
3. افتح التطبيق من جهاز آخر أو متصفح آخر — يجب أن تظهر نفس البيانات

### فحص الاتصال بقاعدة البيانات

افتح في المتصفح:
```
https://your-app.vercel.app/api/health
```

يجب أن ترى: `{"ok":true,"db":true}`

---

## الخطوة 7: النشرات التالية (بعد تعديل الكود)

1. عدّل الكود على جهازك
2. نفّذ:
   ```bash
   git add .
   git commit -m "وصف التعديل"
   git push
   ```
3. Vercel سيعيد النشر تلقائياً (إن كان الربط مع GitHub مفعّلاً)

---

# ملخص سريع

| الخطوة | الإجراء |
|--------|---------|
| 1 | إنشاء قاعدة بيانات على Neon ونسخ رابط الاتصال |
| 2 | إنشاء مشروع Vercel وربطه بمستودع GitHub |
| 3 | إضافة `DATABASE_URL` في Environment Variables |
| 4 | Deploy |
| 5 | تشغيل `npm run db:init` مع رابط قاعدة البيانات |

---

# استكشاف الأخطاء

### رسالة "Database not configured"
- تأكد من إضافة `DATABASE_URL` في Vercel
- أعد النشر: **Deployments** → **⋯** بجانب آخر نشر → **Redeploy**

### التطبيق يعمل لكن البيانات لا تُحفظ
- تأكد أنك نفذت `npm run db:init` برابط قاعدة البيانات السحابية
- تأكد أن `/api/health` يعيد `{"db":true}`

### لا يوجد متغير VITE_USE_POSTGRES
- لا تضيفه — النظام يستخدم PostgreSQL افتراضياً
- إن أضفته وقيمته `false`، سيحفظ في المتصفح فقط

### خطأ `getaddrinfo ENOTFOUND base` أو 500
1. **أعد النشر بعد تعديل المتغيرات** — المتغيرات لا تُطبَّق حتى إعادة النشر  
   **Deployments** → **⋯** → **Redeploy**
2. تأكد أن `DATABASE_URL` يحتوي على الرابط الكامل من Neon (المضيف مثل `ep-xxx.neon.tech`)
3. لا تترك قيم مكانية مثل `base` أو `your-host` — استخدم الرابط الحقيقي من لوحة Neon
4. جرّب إضافة `POSTGRES_URL` بنفس القيمة إن كان `DATABASE_URL` لا يعمل

---

# مزامنة البيانات بين المحلي والسحابة

## الإعداد

أضف في `.env.local`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel
DATABASE_URL_CLOUD=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
```

---

## من المحلي → السحابة

لنقل بياناتك المحلية إلى قاعدة البيانات السحابية:

```bash
npm run sync-to-cloud
```

---

## من السحابة → المحلي

لسحب البيانات من السحابة إلى PostgreSQL المحلي:

```bash
npm run sync-from-cloud
```

---

## ملخص

| الأمر | الاتجاه | الاستخدام |
|-------|---------|-----------|
| `npm run sync-to-cloud` | المحلي → السحابة | نقل بيانات التطوير المحلي للسحابة |
| `npm run sync-from-cloud` | السحابة → المحلي | سحب بيانات الإنتاج للمحلي |
