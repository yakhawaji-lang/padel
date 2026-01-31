# بيانات النوادي (نسخة احتياطية)

الملف `seed-clubs.json` (إن وُجد) يحتوي على نسخة من بيانات النوادي المُصدَّرة من Supabase.

## تصدير البيانات إلى الملف

من جذر المشروع (بعد ضبط `.env.local`):

```bash
node scripts/export-clubs.js
```

سيُنشأ أو يُحدَّث الملف `data/seed-clubs.json`. بعدها أضف الملف وارفع إلى GitHub:

```bash
git add data/seed-clubs.json
git commit -m "Backup clubs data"
git push origin main
```

بهذا يكون المشروع مع نسخة من البيانات مرفوعاً إلى GitHub.
