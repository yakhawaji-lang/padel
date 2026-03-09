# خطة تنفيذ نظام حجز الملاعب — إعادة هيكلة احترافية

> **الإصدار:** 2.0  
> **التاريخ:** فبراير 2025

---

## 1. تحليل النظام الحالي

### 1.1 ما هو منفّذ حالياً

| المكوّن | الحالة | الملاحظات |
|---------|--------|-----------|
| Soft Lock (booking_slot_locks) | ✅ | يعمل، مهلة 10 دقائق |
| API الحجز (lock, confirm, cancel) | ✅ | موجود |
| Idempotency | ✅ | في /confirm |
| Rate Limiting | ✅ | 30 طلب/دقيقة |
| Slot Cache | ✅ | 30 ثانية |
| Jobs (expire locks + unpaid) | ✅ | كل 60 ثانية |
| الأعضاء المفضلين | ✅ | member_favorites |
| رابط الدعوة | ✅ | /pay-invite/:token |
| refund_days | ⚠️ | ثابت 3 في الكود — يجب من الإعدادات |
| Status Workflow | ⚠️ | partially_paid غير مكتمل (لا تحديث paid_at) |
| مهلة 15 دقيقة للمشاركين | ❌ | غير مفعّلة |
| لوحة العضو المتقدمة | ⚠️ | أساسية — لا إعادة إرسال، لا تتبع الدافعين |
| لوحة الإدارة (Timeline) | ❌ | غير موجودة |
| تحديث فوري | ❌ | يحتاج إعادة تحميل |
| سياسة allow_incomplete | ❌ | غير مستخدمة |

### 1.2 الفجوات الحرجة

1. **refund_days**: مُصلّب بقيمة 3 — يجب قراءته من club_settings
2. **split_manage_minutes**: غير مستخدم — المهلة للإضافة قبل التأكيد
3. **paid_at / paid_amount**: لا يتم تحديثهما عند تسجيل الدفع
4. **expireUnpaidBookings**: يحدّث status فقط ولا يحرّر الـ lock ولا يُنشئ refund
5. **ClubSettings**: إعدادات split_manage_minutes و split_payment_deadline قد لا تُحفظ في DB

---

## 2. تصور التعديلات على قاعدة البيانات

### 2.1 التحقق من الجداول الحالية

```sql
-- التحقق من وجود الأعمدة
SELECT COLUMN_NAME FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'club_settings' 
AND COLUMN_NAME IN ('lock_minutes', 'split_manage_minutes', 'split_payment_deadline_minutes', 'refund_days');

SELECT COLUMN_NAME FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'booking_payment_shares' 
AND COLUMN_NAME IN ('paid_at', 'invite_token', 'payment_reference');
```

### 2.2 Migrations إضافية (إن لزم)

```sql
-- إن لم تكن موجودة
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS split_manage_minutes INT DEFAULT 15;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE booking_refunds ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL;
```

### 2.3 Status Workflow المعتمد

```
initiated → locked → pending_payments → partially_paid → confirmed
                ↘                    ↘                ↗
                  cancelled / expired
```

---

## 3. خطة التنفيذ (مراحل)

### المرحلة A: إصلاحات أساسية (أولوية عالية)

| # | المهمة | الملفات |
|---|--------|---------|
| A1 | جلب refund_days من club_settings عند الإلغاء | server/routes/bookings.js |
| A2 | استخدام split_payment_deadline_minutes من الإعدادات | server/routes/bookings.js |
| A3 | تحسين expireUnpaidBookings: تحرير lock + refund إن لزم | server/jobs/bookingJobs.js |
| A4 | API لتسجيل الدفع (تحديث paid_at و paid_amount) | server/routes/bookings.js |

### المرحلة B: الحجز المشترك المحسّن

| # | المهمة | الملفات |
|---|--------|---------|
| B1 | عرض من دفع في MyBookingsPage | MyBookingsPage.jsx |
| B2 | إعادة إرسال رابط الدعوة | MyBookingsPage + API |
| B3 | دعم إضافة مشاركين بعد التأكيد (ضمن المهلة) | Backend + Frontend |

### المرحلة C: لوحة الإدارة

| # | المهمة | الملفات |
|---|--------|---------|
| C1 | Timeline للحجز (من Lock إلى Confirmed) | ClubBookingsManagement.jsx |
| C2 | قبول حجز غير مكتمل (allow_incomplete) | API + UI |
| C3 | تعديل مهلة الدفع يدوياً | API + UI |

### المرحلة D: تجربة المستخدم

| # | المهمة | الملفات |
|---|--------|---------|
| D1 | ألوان أوضح في شبكة الحجوزات | ClubPublicPage.css |
| D2 | عداد تنازلي للمهلة في Modal الحجز | ClubPublicPage.jsx |
| D3 | رسالة "سيتم الاسترداد خلال X أيام" مع X من الإعدادات | MyBookingsPage.jsx |

---

## 4. مخاطر متوقعة

| المخاطرة | الاحتمال | التأثير | التخفيف |
|----------|----------|---------|---------|
| تعارض club_settings القديمة | منخفض | منخفض | استخدام القيم الافتراضية عند غياب الأعمدة |
| حجوزات قديمة بدون payment_deadline_at | متوسط | منخفض | Job يتجاهل الحجوزات بدون deadline |
| ضغط عالٍ على DB | منخفض | متوسط | Caching و Indexes موجودة |

---

## 5. اقتراحات إضافية

1. **Webhook أو SSE** لتحديث الحالة فوراً دون إعادة تحميل
2. **دفع إلكتروني** عبر بوابة (Tap, Moyasar) لتحديث paid_at تلقائياً
3. **إشعارات** قبل انتهاء المهلة

---

## 6. ترتيب التنفيذ الفعلي

يُنفَّذ أولاً: **المرحلة A** (إصلاحات أساسية) ثم **D1, D3** لتحسين UX مباشرة.

---

## 7. التنفيذ المكتمل (فبراير 2025)

### تم تنفيذه في هذه الجلسة:

| # | المهمة | الملف |
|---|--------|-------|
| A1 | refund_days من club_settings | server/routes/bookings.js, server/db/bookingSettings.js |
| A2 | split_payment_deadline_minutes من الإعدادات | server/routes/bookings.js |
| A3 | تحسين expireUnpaidBookings (تحرير lock + invalidate cache) | server/jobs/bookingJobs.js |
| A4 | API record-payment (تحديث paid_at، paid_amount، status) | server/routes/bookings.js |
| B1 | عرض المشاركين وحالة الدفع في MyBookingsPage | MyBookingsPage.jsx |
| B2 | زر إعادة إرسال الدعوة (رابط WhatsApp) | MyBookingsPage.jsx |
| D3 | رسالة الاسترداد مع X أيام من الإعدادات | MyBookingsPage.jsx |
| PayInvite | زر "قمت بدفع حصتي" لتسجيل الدفع | PayInvitePage.jsx |
| DB | إضافة id, invite_token, paid_at لـ payment shares في الاستعلام | normalizedData.js |
| DB | Migrations لـ club_settings | server/db/migrations/booking-system-v3-settings.sql |

### تشغيل Migration (إن لزم):
```sql
ALTER TABLE club_settings ADD COLUMN split_manage_minutes INT DEFAULT 15;
ALTER TABLE club_settings ADD COLUMN split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE club_settings ADD COLUMN refund_days INT DEFAULT 3;
ALTER TABLE club_settings ADD COLUMN allow_incomplete_bookings TINYINT(1) DEFAULT 0;
```
