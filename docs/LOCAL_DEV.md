# تشغيل التطبيق محلياً

## الطريقة 1: وضع الإنتاج (npm start)

```powershell
npm start
```

ثم افتح:
- **الصفحة الرئيسية:** http://localhost:4000/app/
- **تسجيل دخول الإدارة:** http://localhost:4000/app/admin-login

---

## الطريقة 2: وضع التطوير (أفضل للتطوير)

**الطرفية 1 – تشغيل الـ API:**
```powershell
npm run dev:api
```

**الطرفية 2 – تشغيل الواجهة:**
```powershell
npm run dev
```

ثم افتح:
- **الصفحة الرئيسية:** http://localhost:3000/app/
- **تسجيل دخول الإدارة:** http://localhost:3000/app/admin-login

---

## استكشاف الأخطاء

1. **صفحة فارغة:** جرّب تحديث الصفحة بقوة (Ctrl+Shift+R أو Ctrl+F5).
2. **404:** تأكد أن الرابط يحتوي على `/app/` (مثل `/app/admin-login`).
3. **خطأ API:** تأكد أن ملف `.env` يحتوي على `DATABASE_URL` وأن الـ API يعمل على المنفذ 4000.
