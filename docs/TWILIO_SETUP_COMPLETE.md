# إعداد Twilio الكامل — PlayTix

دليل خطوة بخطوة لإعداد WhatsApp و SMS باستخدام الرقم **+1 575 577 6222** وخدمة **PlayTix SMS**.

---

## الرقم والخدمة

| البند | القيمة |
|-------|--------|
| **رقم Twilio** | +1 575 577 6222 |
| **الموقع** | El Rito, NM, US |
| **القدرات** | Voice, SMS, MMS, Fax |
| **خدمة الرسائل (SMS)** | PlayTix SMS |

---

## الخطوات في Twilio Console

### أ. Account SID و Auth Token
1. [console.twilio.com](https://console.twilio.com) → الصفحة الرئيسية
2. انسخ **Account SID** و **Auth Token**

### ب. Messaging Service SID (SMS)
1. **Messaging** → **Services** → **PlayTix SMS**
2. انسخ **SID** (يبدأ بـ MG)
3. تحقق أن الرقم +15755776222 في **Sender Pool**

### ج. WhatsApp
- **Sandbox:** Messaging → Try it out → Send WhatsApp — استخدم +14155238886
- **رقمك:** اتبع [Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up) لتفعيل +15755776222

---

## الخطوة 1: إعدادات Twilio Console

### 1.1 الحصول على Account SID و Auth Token

1. ادخل إلى [console.twilio.com](https://console.twilio.com)
2. من الصفحة الرئيسية أو **Account** → **Account Info**
3. انسخ:
   - **Account SID** (يبدأ بـ `AC`)
   - **Auth Token** (اضغط "Show" لرؤيته)

### 1.2 الحصول على Messaging Service SID (للـ SMS)

1. من القائمة: **Messaging** → **Services**
2. افتح خدمة **PlayTix SMS**
3. انسخ **Messaging Service SID** (يبدأ بـ `MG`)
4. تأكد أن الرقم +15755776222 مضاف في **Sender Pool**

### 1.3 إعداد WhatsApp للرقم +15755776222

**خيار أ: Sandbox (للتجربة السريعة)**

1. **Messaging** → **Try it out** → **Send a WhatsApp message**
2. اتبع التعليمات لربط رقمك (إرسال "join [كلمة]" إلى الرقم المعروض)
3. استخدم رقم Sandbox: `whatsapp:+14155238886`

**خيار ب: تفعيل WhatsApp على رقمك**

1. **Messaging** → **Senders** → **WhatsApp senders**
2. أو اتبع [Twilio WhatsApp Self Sign-up](https://www.twilio.com/docs/whatsapp/self-sign-up)
3. سجّل الرقم +15755776222 مع Meta WhatsApp Business
4. بعد الموافقة استخدم: `whatsapp:+15755776222`

> **ملاحظة:** إذا لم يكن الرقم مفعّلاً لـ WhatsApp بعد، استخدم Sandbox للتجربة.

---

## الخطوة 2: متغيرات البيئة في المشروع

### 2.1 إعداد Hostinger

1. hPanel → **Node.js** → مشروع PlayTix
2. **Environment Variables**
3. أضف المتغيرات التالية:

| المتغير | القيمة | ملاحظة |
|---------|--------|--------|
| `TWILIO_ACCOUNT_SID` | ACxxxxxxxx | من Twilio Console |
| `TWILIO_AUTH_TOKEN` | your_auth_token | من Twilio Console |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+15755776222` | إذا فعّلت WhatsApp على الرقم |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` | أو Sandbox للتجربة |
| `TWILIO_MESSAGING_SERVICE_SID` | MGxxxxxxxx | من PlayTix SMS (SID الخدمة) |
| `WHATSAPP_SENDER_NAME` | `PlayTix` | اختياري — يظهر في نهاية الرسائل |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | `966` | للأرقام السعودية المحلية |

### 2.2 إعداد محلي (.env)

أنشئ أو عدّل ملف `.env` في جذر المشروع:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+15755776222
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx
WHATSAPP_SENDER_NAME=PlayTix
WHATSAPP_DEFAULT_COUNTRY_CODE=966
```

---

## الخطوة 3: إعدادات لوحة التحكم

1. ادخل إلى **لوحة السوبر أدمن** → **الإعدادات**
2. في قسم **قناة الرسائل** اختر:
   - **واتساب** — لاستخدام WhatsApp
   - **SMS** — لاستخدام SMS (عبر Twilio أو Authentica)
3. اضغط **حفظ**

---

## الخطوة 4: صفحات التجربة

| الصفحة | الرابط | الاستخدام |
|--------|--------|-----------|
| تجربة واتساب | `https://playtix.app/app/admin/whatsapp-test` | إرسال رسالة واتساب |
| تجربة SMS | `https://playtix.app/app/admin/sms-test` | إرسال رسالة SMS |

### التحقق من الإعداد

1. ادخل إلى صفحة التجربة
2. أدخل رقم جوال (مثل 966501234567)
3. اكتب رسالة تجريبية
4. اضغط **إرسال**

---

## الخطوة 5: قيود SMS للسعودية

الرقم الأمريكي (+1) قد **لا يدعم** الإرسال إلى السعودية (خطأ 21612).

**الحل:** استخدم **Authentica** للإرسال إلى السعودية:

```env
AUTHENTICA_API_KEY=your_api_key
AUTHENTICA_SENDER_NAME=PlayTix
```

عند وجود `AUTHENTICA_API_KEY`، PlayTix يستخدم Authentica تلقائياً للـ SMS.

---

## الخطوة 6: ترقية الحساب (للإرسال لجميع الأرقام)

- **Trial:** يمكن الإرسال فقط إلى أرقام مُحققة (Verified Caller IDs)
- **Paid:** يمكن الإرسال إلى أي رقم دون تحقق مسبق

للترقية: Twilio Console → **Billing** → **Upgrade**

---

## ملخص سريع

| المطلوب | الإجراء |
|---------|---------|
| SMS | أضف `TWILIO_MESSAGING_SERVICE_SID` (PlayTix SMS) |
| WhatsApp | أضف `TWILIO_WHATSAPP_FROM=whatsapp:+15755776222` (بعد تفعيل الرقم) أو Sandbox |
| السعودية SMS | أضف `AUTHENTICA_API_KEY` |
| اختيار القناة | لوحة السوبر أدمن → الإعدادات → قناة الرسائل |
