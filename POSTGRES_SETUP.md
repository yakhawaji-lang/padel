# إعداد PostgreSQL لمنصة بادل

## المتطلبات
- Node.js 18+
- PostgreSQL 14+
- أو حساب Supabase/Neon للحصول على PostgreSQL سحابي مجاني

## الخطوات

### 1. إنشاء قاعدة البيانات
```bash
createdb padel
# أو استخدم واجهة pgAdmin / Supabase Dashboard
```

### 2. تهيئة الجداول
```bash
# استخدم connection string
export DATABASE_URL=postgresql://user:password@localhost:5432/padel
npm run db:init
```

أو يدوياً:
```bash
psql $DATABASE_URL -f server/db/schema.sql
```

### 3. تشغيل الخادم (API)
```bash
cd server
npm install
export DATABASE_URL=postgresql://...
npm run dev
```

الخادم يعمل على المنفذ 4000

### 4. تفعيل PostgreSQL في الواجهة
أضف في `.env.local`:
```
VITE_USE_POSTGRES=true
```

### 5. تشغيل التطبيق
```bash
npm run dev
```

Vite سيعمل على المنفذ 3000 ويمرر طلبات `/api` إلى الخادم.

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
