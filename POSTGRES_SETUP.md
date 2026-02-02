# إعداد PostgreSQL لمنصة بادل

## المتطلبات
- Node.js 18+
- PostgreSQL 14+
- أو حساب Supabase/Neon للحصول على PostgreSQL سحابي مجاني

## طريقة الاستخدام السريعة

```bash
# 1. الإعداد (ينشئ .env.local ويهيئ قاعدة البيانات)
npm run postgres:setup

# 2. التشغيل (خادم API + الواجهة معاً - مهم: استخدم هذا وليس npm run dev وحده)
npm run postgres:dev
```

**مهم**: استخدم `npm run postgres:dev` وليس `npm run dev` وحده، وإلا لن يتصل الخادم بقاعدة البيانات. الحفظ يتم مباشرة إلى PostgreSQL.

---

## الخطوات اليدوية

### 1. إنشاء قاعدة البيانات (اختياري - السكربت ينشئها تلقائياً)
```bash
createdb padel
# أو استخدم واجهة pgAdmin / Supabase Dashboard
```

### 2. تهيئة الجداول
```bash
# Windows:
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel
npm run db:init

# Linux/Mac:
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel
npm run db:init
```

### 3. تفعيل PostgreSQL
السكربت `postgres:setup` ينشئ `.env.local` تلقائياً. أو أضف يدوياً:
```
VITE_USE_POSTGRES=true
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel
```

### 4. التشغيل
```bash
npm run postgres:dev
```
أو في نافذتين منفصلتين:
```bash
npm run server    # المنفذ 4000
npm run dev       # المنفذ 3000
```

## البنية
- `server/` - خادم Express مع PostgreSQL
- `server/db/schema.sql` - تعريف الجداول
- `server/routes/` - نقاط نهاية API
- `src/api/dbClient.js` - عميل API للواجهة

## الجداول
- **app_store** - تخزين مفتاح-قيمة (الأندية، الأعضاء، الإعدادات، الحجوزات)
- **matches** - سجلات المباريات
- **member_stats** - إحصائيات الأعضاء
- **tournament_summaries** - ملخصات البطولات
