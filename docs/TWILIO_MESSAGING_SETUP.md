# إعداد إرسال الرسائل — PlayTix

دليل إعداد WhatsApp و SMS عبر Twilio أو Authentica (السعودية).

> **إعداد كامل خطوة بخطوة:** راجع [TWILIO_SETUP_COMPLETE.md](./TWILIO_SETUP_COMPLETE.md) — يشمل الرقم +15755776222 وخدمة PlayTix SMS.

---

## نظرة عامة

يدعم PlayTix قناتين للإرسال:

| القناة | الاستخدام | المزودون |
|--------|----------|----------|
| **WhatsApp** | رسائل واتساب (تسجيل، ترحيب نادي، حجوزات) | Twilio |
| **SMS** | رسائل نصية قصيرة | **Authentica** (السعودية — مفضّل) أو Twilio |

اختيار القناة يتم من **لوحة السوبر أدمن** → **الإعدادات** → **قناة الرسائل** (SMS أو WhatsApp).

### أولوية SMS

- إذا وُجد `AUTHENTICA_API_KEY` → يُستخدم **Authentica** (مناسب للسعودية، لا يحتاج NOC).
- وإلا → يُستخدم **Twilio**.

---

## 1. الحصول على بيانات Twilio

1. ادخل إلى [console.twilio.com](https://console.twilio.com)
2. من **Account** → **Account Info** انسخ:
   - **Account SID** (يبدأ بـ `AC`)
   - **Auth Token** (اضغط "Show" لرؤيته)

---

## 2. إعداد WhatsApp عبر Twilio

### 2.1 Sandbox (للتجربة)

1. من Twilio Console: **Messaging** → **Try it out** → **Send a WhatsApp message**
2. اتبع التعليمات لربط رقمك مع Sandbox (مثلاً إرسال "join direction-give" إلى الرقم المعروض)
3. انسخ رقم Sandbox (مثل `+14155238886`)
4. أضف في `.env` أو Environment Variables:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 2.2 رقمك للإنتاج

بعد تفعيل WhatsApp على رقمك (+15755776222):

```env
TWILIO_WHATSAPP_FROM=whatsapp:+15755776222
```

---

## 3. إعداد SMS عبر Twilio Messaging Service

1. من Twilio Console: **Messaging** → **Services** → **Create Messaging Service**
2. اختر اسم (مثل `PlayTix SMS`)
3. اختر **Use Case** (مثل "Verify users" أو "Notify users")
4. أضف **Sender** (رقم Twilio أو Alphanumeric Sender ID حسب الدولة)
5. انسخ **Messaging Service SID** (يبدأ بـ `MG`)
6. أضف في `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx
```

---

## 3.1 إعداد SMS عبر Authentica (السعودية — مفضّل)

Authentica مزود سعودي يدعم SMS للسعودية بدون تعقيدات NOC أو تسجيل Sender ID مع CITC.

1. سجّل في [portal.authentica.sa](https://portal.authentica.sa)
2. أنشئ تطبيق (مثل PlayTix) وفعّل قناة SMS
3. سجّل اسم المرسل (مثل PlayTix) مع Authentica
4. انسخ **API Key** من صفحة التطبيق
5. أضف في `.env`:

```env
AUTHENTICA_API_KEY=your_api_key_from_portal
AUTHENTICA_SENDER_NAME=PlayTix
```

عند وجود `AUTHENTICA_API_KEY`، PlayTix يستخدم Authentica تلقائياً للإرسال إلى السعودية.

---

## 4. توثيق اسم المرسل PlayTix

يُضاف اسم **PlayTix** تلقائياً في نهاية كل رسالة (WhatsApp و SMS) كتوقيع:

```
نص الرسالة...

— PlayTix
```

### تغيير الاسم (اختياري)

للتخصيص، أضف المتغير:

```env
WHATSAPP_SENDER_NAME=PlayTix
```

القيمة الافتراضية هي `PlayTix` إذا لم يُضف المتغير. يمكن تغييرها إلى اسم العلامة التجارية أو النادي.

---

## 5. متغيرات البيئة الكاملة

### WhatsApp فقط

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+15755776222
WHATSAPP_SENDER_NAME=PlayTix
```

### SMS فقط

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx
WHATSAPP_SENDER_NAME=PlayTix
```

### كلاهما (WhatsApp + SMS)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+15755776222
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx
WHATSAPP_SENDER_NAME=PlayTix
```

### رمز الدولة الافتراضي (اختياري)

لتحويل الأرقام المحلية (مثل `05xxxxxxxx`) تلقائياً إلى E.164:

```env
WHATSAPP_DEFAULT_COUNTRY_CODE=966
```

---

## 6. اختيار القناة من لوحة التحكم

1. ادخل إلى **لوحة السوبر أدمن** → **الإعدادات**
2. في قسم **قناة الرسائل** اختر:
   - **واتساب** — لإرسال رسائل التسجيل وترحيب النادي والحجوزات عبر WhatsApp
   - **SMS** — لإرسال نفس الرسائل عبر SMS
3. اضغط **حفظ**

---

## 7. صفحات الاختبار

| الصفحة | الرابط | الوظيفة |
|--------|--------|----------|
| تجربة واتساب | `/app/admin/whatsapp-test` | إرسال رسالة واتساب تجريبية |
| تجربة SMS | `/app/admin/sms-test` | إرسال رسالة SMS تجريبية |

---

## 8. استكشاف الأخطاء

### WhatsApp: "63015" — المستلم غير مسجّل في Sandbox

المستلم يجب أن يرسل "join direction-give" إلى رقم Sandbox أولاً.

### WhatsApp: "63016" — خارج نافذة 24 ساعة

الرسالة النصية الحرة تعمل فقط خلال 24 ساعة من آخر رسالة أرسلها المستلم. استخدم قالب معتمد لبدء المحادثة.

### SMS: "SMS not configured"

تأكد من إضافة `TWILIO_MESSAGING_SERVICE_SID` مع `TWILIO_ACCOUNT_SID` و `TWILIO_AUTH_TOKEN`.

### Invalid phone number

استخدم الرقم مع رمز الدولة (مثل `966501234567` للسعودية). أو أضف `WHATSAPP_DEFAULT_COUNTRY_CODE=966`.

---

## 9. Hostinger — إضافة المتغيرات

1. hPanel → **Node.js** → مشروع PlayTix
2. **Environment Variables**
3. أضف كل متغير (اسم + قيمة)
4. أعد تشغيل التطبيق

---

## 10. ملخص المتغيرات

| المتغير | مطلوب لـ | القيمة الافتراضية | الوصف |
|---------|----------|-------------------|-------|
| `TWILIO_ACCOUNT_SID` | WhatsApp, SMS | — | من Twilio Console |
| `TWILIO_AUTH_TOKEN` | WhatsApp, SMS | — | من Twilio Console |
| `TWILIO_WHATSAPP_FROM` | WhatsApp | — | `whatsapp:+15755776222` (رقمك) |
| `TWILIO_MESSAGING_SERVICE_SID` | SMS | — | من Messaging → Services (MG...) |
| `WHATSAPP_SENDER_NAME` | كلاهما | `PlayTix` | اسم المرسل في نهاية الرسالة |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | كلاهما | `966` | رمز الدولة للأرقام المحلية |
