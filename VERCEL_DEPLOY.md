# نشر منصة بادل على Vercel ومزامنة البيانات مع السحابة

هذا الدليل يوضح كيفية نشر التطبيق على Vercel بحيث تُخزّن جميع البيانات في PostgreSQL السحابي، وتتحدّث أي تغييرات محلية مع السحابة.

---

## نظرة عامة

| البيئة | الواجهة | الـ API | قاعدة البيانات |
|--------|---------|---------|----------------|
| **محلي** | localhost:3000 | localhost:4000 | PostgreSQL محلي أو سحابي |
| **إنتاج (Vercel)** | your-app.vercel.app | your-app.vercel.app/api | PostgreSQL سحابي |

**المبدأ:** قاعدة بيانات واحدة في السحابة — أي تحديث من أي جهاز يظهر فوراً على جميع الأجهزة.

---

## الخطوة 1: إنشاء قاعدة بيانات PostgreSQL سحابية

### الخيار أ: Vercel Postgres (مدمج مع Vercel)

1. ادخل إلى [vercel.com](https://vercel.com) → مشروعك → **Storage** → **Create Database**
2. اختر **Postgres** → اتبع الخطوات
3. بعد الإنشاء، من **Connect** انسخ `POSTGRES_URL` أو `DATABASE_URL`

### الخيار ب: Neon (مجاني)

1. ادخل إلى [neon.tech](https://neon.tech) وأنشئ حساباً
2. أنشئ مشروعاً جديداً وقاعدة بيانات
3. من لوحة التحكم انسخ **Connection string** (مثل `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

---

## الخطوة 2: إعداد المتغيرات البيئية في Vercel

1. من مشروعك في Vercel: **Settings** → **Environment Variables**
2. أضف:

| الاسم | القيمة | ملاحظة |
|------|--------|--------|
| `DATABASE_URL` | `postgresql://...` | رابط الاتصال بقاعدة البيانات السحابية |
| `VITE_USE_POSTGRES` | (لا تضف، أو اتركه فارغاً) | النظام يستخدم PostgreSQL افتراضياً |

**مهم:** لا تضف `VITE_USE_POSTGRES=false` — لأن ذلك يغيّر التطبيق إلى وضع التخزين في المتصفح.

---

## الخطوة 3: تهيئة الجداول في قاعدة البيانات السحابية

مرة واحدة فقط، نفّذ السكربت لإنشاء الجداول:

```bash
# ضع رابط قاعدة البيانات السحابية
$env:DATABASE_URL = "postgresql://user:pass@host/db?sslmode=require"
npm run db:init
```

أو استخدم psql مباشرة:

```bash
psql "postgresql://user:pass@host/db?sslmode=require" -f server/db/schema.sql
```

---

## الخطوة 4: النشر على Vercel

1. اربط المشروع بمستودع GitHub (إن لم يكن مربوطاً)
2. تأكد من وجود المتغير `DATABASE_URL` في **Environment Variables**
3. اضغط **Deploy** أو ادفع commit جديد

بعد النشر، الواجهة والـ API ستكون على نفس النطاق، مثلاً:
- الواجهة: `https://your-app.vercel.app`
- الـ API: `https://your-app.vercel.app/api/store` وغيرها

---

## الخطوة 5: التطوير المحلي مع السحابة

للتطوير على جهازك مع استخدام نفس قاعدة البيانات السحابية:

1. أنشئ ملف `.env.local` في جذر المشروع:

```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

2. شغّل:

```bash
npm run postgres:dev
```

أي تعديل من جهازك سيُحفظ مباشرة في السحابة ويظهر على التطبيق المنشور.

---

## الخطوة 6: مزامنة البيانات من المحلي إلى السحابة

إذا كان لديك بيانات في PostgreSQL المحلي وتريد نقلها إلى السحابة:

1. أضف في `.env.local`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel
DATABASE_URL_CLOUD=postgresql://user:pass@host/db?sslmode=require
```

2. نفّذ سكربت المزامنة:

```bash
node scripts/sync-to-cloud.js
```

سيتم نسخ محتوى `app_store`، `matches`، `member_stats`، `tournament_summaries` من المحلي إلى السحابة.

---

## ملخص المسارات

| المسار | الوصف |
|--------|--------|
| `/api/store` | تخزين عام (أندية، أعضاء، إعدادات) |
| `/api/store/:key` | قراءة مفتاح واحد |
| `/api/store/batch` | حفظ دفعة من المفاتيح |
| `/api/matches` | المباريات |
| `/api/member-stats` | إحصائيات الأعضاء |
| `/api/tournament-summaries` | ملخصات البطولات |
| `/api/health` | فحص الاتصال بقاعدة البيانات |

---

## استكشاف الأخطاء

### "Database not configured"
- تأكد من وجود `DATABASE_URL` في متغيرات بيئة Vercel
- أعد النشر بعد تعديل المتغيرات

### البيانات لا تتحدّث بين الأجهزة
- تأكد أنك لا تستخدم `VITE_USE_POSTGRES=false`
- تأكد أن `DATABASE_URL` يشير إلى نفس قاعدة البيانات في كل بيئة

### المزامنة تفشل
- تأكد أن PostgreSQL السحابي يقبل اتصالات من الخارج (عادةً متاح افتراضياً)
- للـ Neon: استخدم رابط الاتصال مع `?sslmode=require`
