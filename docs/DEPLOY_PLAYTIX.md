# النشر على playtix.app

## الدومين
- **الموقع:** https://playtix.app
- **التطبيق:** https://playtix.app/app/
- **الـ API:** https://playtix.app/api (نفس الدومين)

## رفع المشروع إلى GitHub
المشروع جاهز للرفع. تأكد أن ملف `.env` غير مضاف (موجود في `.gitignore`).

```bash
git add .
git commit -m "Full project - playtix.app"
git push origin main
```

## بعد النشر على Hostinger
1. **Environment Variables:** ضبط `DATABASE_URL` و `BASE_URL=https://playtix.app`
2. **قاعدة البيانات:** استخدام `server/db/DROP_ALL_TABLES.sql` ثم `server/db/CREATE_ALL_TABLES.sql` إن لزم
3. **التحقق:** https://playtix.app/api/health و https://playtix.app/app/

راجع `docs/HOSTINGER_DEPLOY.md` للتفاصيل.
