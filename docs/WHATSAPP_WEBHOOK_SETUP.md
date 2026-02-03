# تكوين Webhook واتساب — خطوة بخطوة

دليل إعداد Webhook لاستقبال رسائل واتساب في Playtix.

---

## الخطوة 1: إضافة متغيرات البيئة في Vercel

1. ادخل إلى [vercel.com](https://vercel.com) → مشروعك
2. **Settings** → **Environment Variables**
3. أضف المتغيرات التالية:

| الاسم | القيمة | البيئة |
|------|--------|--------|
| `WHATSAPP_VERIFY_TOKEN` | `playtix_whatsapp_verify` (أو نص سري آخر) | Production, Preview, Development |
| `WHATSAPP_ACCESS_TOKEN` | رمز الوصول من Meta | Production, Preview, Development |
| `WHATSAPP_PHONE_NUMBER_ID` | معرف رقم الهاتف من Meta | Production, Preview, Development |

4. احفظ واضغط **Redeploy** لتفعيل المتغيرات الجديدة

---

## الخطوة 2: التأكد من النشر

1. تأكد أن التطبيق منشور على `playtix.app`
2. إن كنت تستخدم دومين فرعي (مثل `padel-xxx.vercel.app`) استخدمه في الخطوة التالية

---

## الخطوة 3: تكوين Webhook في Meta

1. ادخل إلى [developers.facebook.com](https://developers.facebook.com)
2. افتح تطبيق **Playtix**
3. من القائمة الجانبية: **WhatsApp** → **التكوين (Configuration)**
4. انزل إلى قسم **Webhook**
5. اضغط **تحقق وحفظ**

### أدخل القيم التالية:

| الحقل | القيمة |
|-------|--------|
| **عنوان URL الاستدعاء (Callback URL)** | `https://playtix.app/api/whatsapp-webhook` |
| **تحقق من الرمز (Verify Token)** | `playtix_whatsapp_verify` (نفس قيمة WHATSAPP_VERIFY_TOKEN) |

6. اضغط **تحقق وحفظ**
7. إن نجح التحقق، ستظهر رسالة تأكيد

---

## الخطوة 4: الاشتراك في الحقول (Fields)

بعد نجاح التحقق:

1. في نفس صفحة التكوين، ابحث عن **الحقول (Fields)** أو **اشتراكات Webhook**
2. فعّل الحقل **messages** لاستقبال الرسائل الواردة وحالاتها
3. (اختياري) فعّل **account_alerts** للتنبيهات

---

## الخطوة 5: الاختبار

1. من لوحة Meta: **WhatsApp** → **API Setup**
2. أضف رقم هاتفك في حقل **إلى (To)**
3. أرسل رسالة واتساب من جوالك إلى الرقم التجريبي
4. تحقق من سجلات Vercel (**Logs**) لرؤية استلام الحدث

---

## ملاحظات

- **التطبيق غير منشور:** Meta يرسل اختبارات فقط من لوحة التطبيق. لن تصل رسائل حقيقية حتى ينشر التطبيق.
- **التحقق فشل:** تأكد أن `WHATSAPP_VERIFY_TOKEN` في Vercel يطابق تماماً ما أدخلته في Meta.
- **404:** تأكد أن المسار `/api/whatsapp-webhook` يعمل (جرّب فتح الرابط في المتصفح — سيعيد 405 أو 403 وهو متوقع).
