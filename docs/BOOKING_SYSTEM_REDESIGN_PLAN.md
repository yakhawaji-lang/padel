# خطة إعادة هيكلة نظام حجز الملاعب | Booking System Redesign Plan

> **تاريخ الإعداد:** فبراير 2025  
> **النطاق:** التطوير فوق النظام الحالي مع الحفاظ على البيانات والاستقرار

---

## 1. تحليل النظام الحالي (Current Architecture Analysis)

### 1.1 مسار الحجز الحالي

```
العضو → صفحة النادي العامة (/clubs/:clubId) → اختيار وقت من الشبكة
    → فتح Modal الحجز → إدخال البيانات + مشاركة الدفع (اختياري)
    → addBookingToClub() → saveClubs() → POST /api/data
    → saveClubsToNormalized() → كتابة club_bookings + تحديث club بالكامل
```

### 1.2 نقاط الضعف المكتشفة

| المشكلة | التأثير | المصدر |
|---------|---------|--------|
| **لا يوجد Soft Lock** | احتمال حجز نفس الوقت من عدة أعضاء | ClubPublicPage / addBookingToClub |
| **لا يوجد تحقق من التعارض على مستوى DB** | Double Booking ممكن | club_bookings بدون unique constraint |
| **حفظ الحجز فوري بدون مهلة دفع** | الحجز يُعتبر مؤكداً مباشرة | addBookingToClub يضيف مباشرة |
| **لا يوجد Status Workflow** | عدم وضوح مراحل الحجز | status يبقى 'confirmed' فقط |
| **لا يوجد Queue/Background Jobs** | لا إلغاء تلقائي للمهلات | لا يوجد |
| **الحجز المشترك بدون تتبع دفع** | لا معرفة من دفع ومن لم يدفع | booking_payment_shares بدون paid_at |
| **روابط الدعوة بدون Token** | لا ربط آمن بين الدعوة والحجز | getRegisterUrl لا يستخدم token |
| **عدم وجود API مخصص للحجوزات** | حفظ كائن club كامل عند كل حجز | saveClubs يحل محل كل البيانات |

### 1.3 الجداول المستخدمة حالياً

- **club_bookings**: id, club_id, court_id, member_id, booking_date, time_slot, status, data (JSON)
- **booking_payment_shares**: participant_type, member_id, phone, amount, whatsapp_link (بدون paid_at, invite_token)
- **club_settings**: booking_duration, cancellation_policy... (بدون lock_minutes, payment_deadline_minutes)

---

## 2. تصور التعديلات على قاعدة البيانات (Database Changes)

### 2.1 إضافة أعمدة لـ club_settings

```sql
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS lock_minutes INT DEFAULT 10;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS payment_deadline_minutes INT DEFAULT 10;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS split_manage_minutes INT DEFAULT 15;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS split_payment_deadline_minutes INT DEFAULT 30;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS refund_days INT DEFAULT 3;
ALTER TABLE club_settings ADD COLUMN IF NOT EXISTS allow_incomplete_bookings TINYINT(1) DEFAULT 0;
```

### 2.2 تعديل club_bookings

```sql
-- أعمدة جديدة
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS start_time VARCHAR(10) NULL;
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS end_time VARCHAR(10) NULL;
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS locked_at DATETIME NULL;
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS payment_deadline_at DATETIME NULL;
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE club_bookings ADD COLUMN IF NOT EXISTS initiator_member_id VARCHAR(255) NULL;

-- تعديل status ليدعم القيم الجديدة
-- القيم: initiated, locked, pending_payments, partially_paid, confirmed, cancelled, expired

-- فهرس لمنع التعارض (للـ Lock)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cb_slot_lock 
  ON club_bookings (club_id, court_id, booking_date, start_time) 
  WHERE status NOT IN ('cancelled', 'expired');
```

**ملاحظة:** في MySQL لا يوجد `WHERE` في CREATE INDEX. بدلاً من ذلك نستخدم:
- Unique constraint على (club_id, court_id, booking_date, start_time) مع استثناء cancelled/expired في منطق التطبيق
- أو جدول `booking_slot_locks` منفصل للـ Soft Lock

### 2.3 جدول booking_slot_locks (للـ Soft Lock على مستوى DB)

```sql
CREATE TABLE IF NOT EXISTS booking_slot_locks (
  id VARCHAR(64) PRIMARY KEY,
  club_id VARCHAR(255) NOT NULL,
  court_id VARCHAR(255) NOT NULL,
  booking_date DATE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  member_id VARCHAR(255) NOT NULL,
  booking_id VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bsl_slot (club_id, court_id, booking_date, start_time),
  INDEX idx_bsl_expires (expires_at)
);
```

### 2.4 تعديل booking_payment_shares

```sql
ALTER TABLE booking_payment_shares ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64) NULL UNIQUE;
ALTER TABLE booking_payment_shares ADD COLUMN IF NOT EXISTS paid_at DATETIME NULL;
ALTER TABLE booking_payment_shares ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255) NULL;
```

### 2.5 جدول refunds

```sql
CREATE TABLE IF NOT EXISTS booking_refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  member_id VARCHAR(255) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  expected_by_date DATE NULL,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_br_booking (booking_id, club_id)
);
```

### 2.6 جدول member_favorites (أعضاء مفضلين للمشاركة)

```sql
CREATE TABLE IF NOT EXISTS member_favorites (
  member_id VARCHAR(255) NOT NULL,
  favorite_member_id VARCHAR(255) NOT NULL,
  club_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, favorite_member_id, club_id)
);
```

---

## 3. خطة التنفيذ (Execution Plan)

### المرحلة 1: قاعدة البيانات والـ API (أساس آمن)
**المدة المقترحة: أسبوع**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 1.1 | إنشاء ملفات Migration SQL (ترحيل آمن) | `server/db/migrations/` |
| 1.2 | إضافة API مخصص للحجوزات: POST /api/bookings/lock, confirm, cancel | `server/routes/bookings.js` |
| 1.3 | تطبيق منطق Lock في DB (booking_slot_locks) | `server/db/bookingLock.js` |
| 1.4 | منع التعارض في INSERT/UPDATE للحجوزات | `normalizedData.js` أو routes |

### المرحلة 2: Soft Lock و Status Workflow
**المدة: أسبوع**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 2.1 | عند النقر على وقت: إنشاء Lock فوراً عبر API | `ClubPublicPage.jsx` |
| 2.2 | عرض الحجوزات المحجوزة (قيد الإجراء) بلون مختلف | `ClubPublicPage.jsx`, CSS |
| 2.3 | إلغاء Lock تلقائياً بعد 10 دقائق (Cron أو Queue) | `server/jobs/expireLocks.js` |
| 2.4 | تطبيق Status Workflow (Initiated → Locked → ...) | Backend + Frontend |

### المرحلة 3: الحجز المشترك المحسّن
**المدة: أسبوع**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 3.1 | إضافة member_favorites وواجهة الإضافة | `BookingPaymentShare.jsx`, API |
| 3.2 | إنشاء رابط دعوة مع Token وتوجيه لصفحة الدفع | `getRegisterUrl` + route |
| 3.3 | تتبع paid_at في booking_payment_shares | Backend |
| 3.4 | مهلة 15 دقيقة لإدارة المشاركين + 30 للدفع | Jobs |

### المرحلة 4: مهلات الحجز والـ Jobs
**المدة: أسبوع**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 4.1 | إعداد Bull/BullMQ أو جدول jobs بسيط | `server/jobs/` |
| 4.2 | Job: انتهاء صلاحية Locks | كل دقيقة |
| 4.3 | Job: انتهاء صلاحية الحجوزات غير المكتملة | كل 5 دقائق |
| 4.4 | جدولة Cron على الخادم أو استخدام Hostinger Cron | - |

### المرحلة 5: لوحة العضو والإدارة
**المدة: أسبوع**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 5.1 | تحسين MyBookingsPage: حالة الحجز، من دفع، إعادة إرسال دعوة | `MyBookingsPage.jsx` |
| 5.2 | صفحة إعدادات الحجز للنادي (المهلات، السياسات) | `ClubSettings.jsx` |
| 5.3 | لوحة إدارة الحجوزات المتقدمة مع Timeline | `ClubBookingsManagement.jsx` |
| 5.4 | إمكانية قبول حجز غير مكتمل، تعديل المهلات | Admin API |

### المرحلة 6: الإلغاء والاسترداد
**المدة: أسبوع**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 6.1 | آلية إلغاء واضحة وحساب الاسترداد | Backend |
| 6.2 | جدول refunds وتتبع الحالة | DB + API |
| 6.3 | إشعار "سيتم استرداد المبلغ خلال X أيام" | Frontend |

### المرحلة 7: الأمان والأداء
**المدة: 3–5 أيام**

| الخطوة | المهمة | الملفات |
|--------|--------|---------|
| 7.1 | Payment Idempotency (idempotency_key) | API |
| 7.2 | Audit Logs للعمليات الحساسة | `audit_log` |
| 7.3 | Caching لجدول الأوقات المتاحة | Redis أو في الذاكرة |
| 7.4 | Rate limiting على API الحجز | Express middleware |

---

## 4. مخاطر متوقعة (Risks)

| المخاطرة | الاحتمال | التأثير | التخفيف |
|----------|----------|---------|---------|
| تعارض مع بيانات حجوزات قديمة | متوسط | متوسط | Migration يملأ start_time من time_slot، status='confirmed' للحجوزات القديمة |
| Redis غير متاح على Hostinger | عالٍ | متوسط | استخدام جدول booking_slot_locks بدلاً من Redis للـ Lock |
| Cron غير مُعد على الاستضافة | متوسط | عالٍ | توثيق إعداد Cron، أو استخدام خدمة خارجية (cron-job.org) |
| تغيير سلوك addBookingToClub يؤثر على تدفقات أخرى | متوسط | عالٍ | الحفاظ على addBookingToClub للتوافق، وإضافة addBookingWithLock كمسار جديد |
| ازدحام عند فتح عدة نوافذ للحجز | منخفض | منخفض | Lock يمنع Double Booking؛ تحسين UX لإظهار "قيد الإجراء" |

---

## 5. اقتراحات تحسين إضافية

1. **تحديث فوري (Real-time):** استخدام Server-Sent Events أو WebSocket لعرض تغيير حالة الحجز دون إعادة تحميل.
2. **دفع إلكتروني:** ربط بوابة دفع (Tap, Moyasar، إلخ) لإكمال الدفع فعلياً بدلاً من "تأكيد" فقط.
3. **إشعارات:** إرسال إشعار عند قرب انتهاء مهلة الدفع، وعند إلغاء الحجز.
4. **نسخ احتياطي:** أتمتة نسخ احتياطي لجدول club_bookings قبل تشغيل Migration.
5. **اختبارات:** إضافة اختبارات تكاملية لسيناريوهات الحجز والـ Lock.

---

## 6. التوافق مع النظام الحالي (Backward Compatibility)

- الحجوزات القديمة: قراءة `time_slot` كـ start_time إذا كان start_time فارغاً.
- status القديم: معالجة القيم غير المعرّفة كـ `confirmed`.
- addBookingToClub: يبقى موجوداً ويُستخدم للتوافق؛ يمكن تحويله داخلياً إلى المسار الجديد.
- club_bookings.data: الإبقاء على الحقول الإضافية في JSON للتوافق.

---

## 7. الملفات الرئيسية المتأثرة

| الملف | التعديل |
|-------|---------|
| `src/pages/ClubPublicPage.jsx` | Lock عند النقر، عرض الحالات، مهلات |
| `src/components/BookingPaymentShare.jsx` | المفضلة، روابط Token |
| `src/pages/MyBookingsPage.jsx` | حالة الحجز، الدافعين، إعادة إرسال |
| `src/storage/adminStorage.js` | addBookingWithLock، updateBookingStatus |
| `server/routes/bookings.js` | جديد |
| `server/db/normalizedData.js` | دعم الحقول الجديدة |
| `server/db/migrations/` | ملفات SQL جديدة |
| `server/jobs/` | مجلد جديد للـ Background Jobs |
| `src/admin/pages/ClubSettings.jsx` | إعدادات المهلات |
| `src/admin/pages/ClubBookingsManagement.jsx` | Timeline، إدارة متقدمة |

---

---

## 8. التنفيذ المكتمل (Completed Implementation)

تم تنفيذ المراحل التالية:

### تم تنفيذه:
1. **Phase 1:** Migration SQL، Booking API (`/api/bookings/lock`, `confirm`, `cancel`, `locks`)
2. **Phase 2:** Soft Lock في ClubPublicPage، عرض الحالات (available / in-progress / booked)
3. **Phase 4:** Background Jobs (expire locks كل 60 ثانية)
4. **Phase 5:** إعدادات الحجز في ClubSettings (lock minutes، refund days، إلخ)
5. **Phase 6:** إلغاء الحجز وإنشاء سجل refund

### تشغيل Migration:
```bash
npm run db:migrate:booking-v2
# أو عبر API:
# GET/POST https://playtix.app/api/init-db/migrate-booking-v2
```

### ملفات جديدة/معدلة:
- `server/db/bookingMigration.js` - Migration
- `server/db/bookingLock.js` - منطق الـ Lock
- `server/routes/bookings.js` - API الحجوزات
- `server/jobs/bookingJobs.js` - Jobs انتهاء الصلاحية
- `src/pages/ClubPublicPage.jsx` - تدفق الحجز مع Lock
- `src/pages/MyBookingsPage.jsx` - عرض الحالة والإلغاء
- `src/admin/pages/ClubSettings.jsx` - إعدادات المهلات
