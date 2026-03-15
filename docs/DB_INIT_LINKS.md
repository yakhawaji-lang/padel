# روابط زراعة قاعدة البيانات — playtix.app

## 1. إنشاء ملف database.config.json على Hostinger

في **File Manager** → `domains/playtix.app/` (خارج public_html)، أنشئ ملف `database.config.json` بالمحتوى:

```json
{
  "url": "mysql://u502561206_padel_user:YOUR_PASSWORD@127.0.0.1/u502561206_padel_db"
}
```
استبدل `YOUR_PASSWORD` بكلمة المرور الفعلية.

ثم **Restart** للتطبيق.

---

## 2. التحقق من الاتصال

افتح في المتصفح:
```
https://playtix.app/api/health
```
يجب أن يعيد: `{"ok":true,"db":true}`

تشخيص (إذا db: false):
```
https://playtix.app/api/db-check
```

---

## 3. زراعة الجداول والحقول

**تهيئة الجداول والبيانات الافتراضية:**
```
https://playtix.app/api/init-db?init=1
```

**إعادة تهيئة كاملة** (يحذف كل البيانات ويعيد الإنشاء):
```
https://playtix.app/api/init-db?reset=1
```

**التحقق من الجداول:**
```
https://playtix.app/api/init-db/tables
```

**ترحيل إعدادات الأندية** (إضافة ملاعب ناقصة، إلخ):
```
https://playtix.app/api/init-db/migrate-club-settings
```

**تهيئة الجداول العلائقية:**
```
https://playtix.app/api/init-db/init-relational
```

**ترحيل إلى الجداول المنظمة:**
```
https://playtix.app/api/init-db/migrate-to-normalized
```

**ترحيل نظام الحجز V2** (جدول `booking_slot_locks` وأعمدة الحجز الجديدة — **مطلوب للحجز**):
```
https://playtix.app/api/init-db/migrate-booking-v2
```

**ترحيل إعدادات الدفع** (جدول `platform_payment_gateways` — **مطلوب لصفحة إعدادات الدفع**):
```
https://playtix.app/api/init-db/migrate-payment-gateways
```

---

## 4. ترتيب التنفيذ (إعداد جديد من الصفر)

1. `https://playtix.app/api/init-db?init=1`
2. `https://playtix.app/api/init-db/migrate-to-normalized`
3. `https://playtix.app/api/init-db/init-relational`
4. `https://playtix.app/api/init-db/migrate-booking-v2`

---

## 5. استكشاف الأخطاء

### خطأ: `Table '...booking_slot_locks' doesn't exist`

**الحل:** نفّذ ترحيل نظام الحجز:
```
https://playtix.app/api/init-db/migrate-booking-v2
```

إذا فشل الرابط، نفّذ SQL يدوياً في **phpMyAdmin** من الملف:
`server/db/migrations/BOOKING_V2_PHPMYADMIN.sql`

---

## 6. بيانات الدخول الافتراضية

- **البريد:** `admin@playtix.app`
- **كلمة المرور:** `Admin@123456`
