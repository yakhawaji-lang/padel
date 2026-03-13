# إعداد البريد الإلكتروني — Email Setup

دليل إعداد إرسال البريد الإلكتروني في PlayTix باستخدام **Resend** أو **Twilio SendGrid**.

---

## 1. ما الذي يُستخدم البريد فيه؟

- **كود التحقق (4 أرقام)** عند تسجيل عضو جديد
- **رسالة ترحيب** بعد إكمال التسجيل
- **رسالة ترحيب** عند انضمام العضو لنادي
- **تفعيل بريد النادي** عند تسجيل نادٍ جديد
- **استعادة كلمة المرور** (كان يعمل مسبقاً عبر Resend)

---

## 2. الخيارات المتاحة

| المزود | البيئة | ملاحظات |
|--------|--------|---------|
| **Resend** | `RESEND_API_KEY` | سهل، يدعم نطاقك بعد التحقق |
| **Twilio SendGrid** | `SENDGRID_API_KEY` | جزء من Twilio، مناسب إن كنت تستخدم Twilio |

---

## 3. إعداد Resend

1. أنشئ حساباً على [resend.com](https://resend.com)
2. من **API Keys** أنشئ مفتاحاً جديداً
3. أضف دومينك وتحقّق منه (مثل `playtix.app`)
4. في Hostinger → **hPanel** → **Node.js** → **Environment Variables** أضف:
   - `RESEND_API_KEY` = `re_xxxxxxxx`
   - `RESEND_FROM` = `PlayTix <noreply@playtix.app>`

---

## 4. إعداد Twilio SendGrid

1. ادخل إلى [sendgrid.com](https://sendgrid.com) (أو من لوحة Twilio)
2. من **Settings** → **API Keys** أنشئ مفتاحاً (Full Access أو Mail Send فقط)
3. تحقق من الدومين في **Sender Authentication**
4. في Hostinger → **hPanel** → **Node.js** → **Environment Variables** أضف:
   - `SENDGRID_API_KEY` = `SG.xxxxxxxx`

---

## 5. إعدادات من لوحة تحكم المنصة

من **لوحة التحكم الرئيسية** → **إعدادات**:

- **المزود**: Resend أو Twilio SendGrid
- **عنوان المرسل**: مثل `PlayTix <noreply@playtix.app>`
- **مفتاح API** (اختياري): إن أردت تخزينه في الإعدادات بدل المتغيرات

---

## 6. صفحة تجربة البريد

من **لوحة التحكم الرئيسية** → **تجربة البريد**:

- أدخل البريد المستلم والموضوع والنص
- اضغط **إرسال** للتحقق من أن الإرسال يعمل

---

## 7. متغيرات البيئة في Hostinger

| المتغير | الوصف |
|---------|-------|
| `RESEND_API_KEY` | مفتاح Resend (من resend.com) |
| `RESEND_FROM` | عنوان المرسل، مثل `PlayTix <noreply@playtix.app>` |
| `SENDGRID_API_KEY` | مفتاح SendGrid (من sendgrid.com أو Twilio) |
| `BASE_URL` | رابط الموقع، مثل `https://playtix.app` |

---

## 8. ما الذي يجب فعله في Twilio؟

البريد **لا يعتمد على Twilio** إلا إذا اخترت **Twilio SendGrid**:

- SendGrid مدمج مع Twilio
- يمكنك استخدام SendGrid مباشرة من [sendgrid.com](https://sendgrid.com) دون حساب Twilio
- إن كان لديك حساب Twilio، يمكنك تفعيل SendGrid من لوحة Twilio

---

## 9. ما الذي يجب فعله في Hostinger؟

1. **hPanel** → **Node.js** → **Environment Variables**
2. أضف المتغيرات المطلوبة (انظر الجدول أعلاه)
3. أعد تشغيل التطبيق (Restart) بعد التعديل
4. تأكد أن الدومين المستخدم في `RESEND_FROM` أو SendGrid مُحقّق

---

## 10. استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| `Email service not configured` | أضف `RESEND_API_KEY` أو `SENDGRID_API_KEY` |
| `verify domain` / `own email` | تحقق من الدومين في Resend أو SendGrid |
| الكود لا يصل | تحقق من صندوق Spam، وتأكد من صحة البريد |
