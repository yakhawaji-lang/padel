# تكوين Webhook واتساب — خطوة بخطوة

دليل إعداد Webhook لاستقبال رسائل واتساب في Playtix.

---

## إعداد متغيرات البيئة

### إذا كنت تستخدم **Hostinger** (السيرفر مرتبط بـ GitHub)

1. في لوحة Hostinger، ادخل إلى **الاستضافة** أو **التطبيق** الذي يشغّل مشروع Playtix (Node.js).
2. ابحث عن **متغيرات البيئة (Environment Variables)** أو **.env** في مجلد المشروع على السيرفر.
3. أضف أو عدّل الملف `.env` في المجلد الرئيسي للمشروع (نفس المجلد الذي فيه `server/`) وأضف:

```env
WHATSAPP_VERIFY_TOKEN=playtix_whatsapp_verify
# من Meta (WhatsApp → API Setup) — أضفهما على السيرفر فقط ولا ترفعهما إلى Git:
WHATSAPP_ACCESS_TOKEN=...   # رمز الوصول من لوحة Meta (لا ترفعه إلى Git)
WHATSAPP_PHONE_NUMBER_ID=...   # معرف رقم الهاتف من نفس الصفحة
```

4. تأكد أن **السيرفر (Node)** يعمل وأن الطلبات إلى `https://playtix.app/api/*` تصل إلى تطبيق Express (إما عبر reverse proxy مثل Nginx أو من إعدادات الاستضافة).
5. أعد تشغيل تطبيق Node بعد تعديل `.env` إذا لزم.

### إذا كنت تستخدم **Vercel**

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

## التأكد من أن الموقع يعمل

1. تأكد أن التطبيق منشور ويعمل على `https://playtix.app` (أو الدومين الذي تستخدمه).
2. جرّب فتح الرابط في المتصفح:
   - `https://playtix.app/api/whatsapp-webhook`  
   - المتوقع: **403** أو **405** (لأن ميتا يرسل GET مع معاملات التحقق؛ فتح الرابط بدونها يعيد رفضاً). إذا حصلت على **404** فالمسار غير مفعّل على السيرفر.
3. إن كنت على Hostinger: تأكد أن مسار `/api/whatsapp-webhook` يوجّه إلى تطبيق Node (مجلد `server/`، المسار مُعرّف في `server/index.js`).

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
4. تحقق من السجلات (على Hostinger: سجلات Node/PM2 أو السيرفر؛ على Vercel: **Logs**) لرؤية استلام الحدث

---

## الخطوات التالية (بعد نجاح التحقق) — Hostinger / أي استضافة

1. **الاشتراك في حقل الرسائل:** في صفحة Webhook في Meta، فعّل الاشتراك في الحقل **messages** (وأيضاً **message_deliveries** أو **message_reads** إن رغبت).
2. **الحصول على التوكن ورقم الهاتف:** من **WhatsApp** → **API Setup** انسخ:
   - **Phone number ID** → ضعه في `WHATSAPP_PHONE_NUMBER_ID` في `.env` على Hostinger.
   - **Access token** (مؤقت للاختبار) → ضعه في `WHATSAPP_ACCESS_TOKEN` في `.env`.
3. **تحديث .env على Hostinger:** أضف القيمتين في ملف `.env` في مجلد المشروع على السيرفر (أو من لوحة التحكم إن وُجد)، ثم أعد تشغيل تطبيق Node.
4. **إرسال الرسائل من النظام:** استخدم واجهة WhatsApp Cloud API من السيرفر (مثلاً عند تأكيد حجز) بإرسال طلب إلى `https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages` مع الـ Access token.

---

## استكشاف الأخطاء: "Object with ID does not exist" أو "missing permissions"

عند إرسال رسالة واتساب من النظام أو من صفحة التجربة، إن ظهر خطأ مثل:
**"Unsupported post request. Object with ID '...' does not exist, cannot be loaded due to missing permissions"**

تحقق من التالي:

1. **استخدام Phone number ID الصحيح (وليس WABA ID)**  
   في [developers.facebook.com](https://developers.facebook.com) → تطبيقك → **WhatsApp** → **API Setup** ستجد:
   - **WhatsApp Business Account ID** (معرف الحساب) — **لا تستخدمه** في `WHATSAPP_PHONE_NUMBER_ID`.
   - **Phone number ID** (معرف رقم الهاتف) — رقم مختلف، يظهر بجانب رقم الهاتف الاختباري. **هذا** هو الذي تضعه في `WHATSAPP_PHONE_NUMBER_ID` في `.env`.

2. **صلاحيات التوكن (Access token)**  
   التوكن يجب أن يضم صلاحيات مثل:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
   - `business_management`  
   أنشئ توكناً من **System User** في Business Settings وربطه بتطبيقك مع هذه الصلاحيات، أو استخدم التوكن من API Setup مع التأكد من الصلاحيات.

3. **انتهاء التوكن المؤقت**  
   التوكن المؤقت من لوحة API Setup ينتهي بعد مدة (مثلاً 24 ساعة). للاستخدام الدائم أنشئ **System User** في Meta Business Suite وولّد توكناً دائماً وضعه في `WHATSAPP_ACCESS_TOKEN`.

4. **رقم الهاتف مسجّل ومفعّل**  
   من API Setup تأكد أن رقم واتساب التجاري بحالة "Connected" أو "Registered" وليس "Pending" أو غير مسجّل.

---

## الرسالة "تم الإرسال بنجاح" لكنها لم تصل إلى واتساب

إذا ظهرت رسالة نجاح من النظام لكن المستلم لم يستقبل الرسالة:

1. **وضع الاختبار (Test mode):** في التطبيق غير المنشور، يمكنك الإرسال **فقط** إلى أرقام أضفتها كمتلقين اختبار. من **WhatsApp** → **API Setup** في لوحة Meta أضف رقم الجوال المستهدف في قائمة المتلقين الاختبارين (حقل "To" أو "Manage phone number list" / إضافة رقم للاختبار).
2. **نافذة 24 ساعة:** الرسالة النصية الحرة (غير القالب) تُسلّم فقط خلال **24 ساعة** من آخر رسالة أرسلها المستلم إلى رقم واتساب الأعمال. إذا المستلم لم يرسل رسالة مسبقاً، استخدم **قالب رسالة (Message Template)** معتمد من Meta لبدء المحادثة، ثم يمكنك إرسال رسائل حرة خلال الـ 24 ساعة التالية.
3. **تنسيق الرقم:** استخدم الرقم مع رمز الدولة (مثل `966501234567` للسعودية). يمكنك ضبط `WHATSAPP_DEFAULT_COUNTRY_CODE=966` في `.env` لتحويل الأرقام المحلية (مثل 05xxxxxxxx) تلقائياً.
4. **حالة التوصيل في السجلات:** تفعيل الاشتراك في حقل **messages** في Webhook يسمح باستقبال أحداث الحالة (مثل `failed`, `delivered`). راجع سجلات السيرفر لرؤية `[WhatsApp] Status ...` وأي `errors` إن وُجدت.

---

## ملاحظات

- **التطبيق غير منشور:** Meta يرسل اختبارات فقط من لوحة التطبيق. لن تصل رسائل حقيقية حتى ينشر التطبيق.
- **التحقق فشل:** تأكد أن `WHATSAPP_VERIFY_TOKEN` في بيئة التشغيل (Hostinger أو Vercel) يطابق **تماماً** ما أدخلته في Meta.
- **404:** تأكد أن المسار `/api/whatsapp-webhook` يعمل (جرّب فتح الرابط في المتصفح — سيعيد 405 أو 403 وهو متوقع).
- **Hostinger:** إذا كان الـ frontend من GitHub والـ API على نفس الدومين، تأكد أن الـ reverse proxy يوجّه `/api/*` إلى منفذ تطبيق Node (مثلاً 4000).
