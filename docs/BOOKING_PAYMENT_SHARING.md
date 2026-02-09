# مشاركة الدفع للحجوزات | Booking Payment Sharing

## الوظيفة
تمكين المستخدم من مشاركة دفع حجز الملعب مع أعضاء مسجلين أو غير مسجلين في المنصة.

## التخزين في قاعدة البيانات u502561206_padel_db

يتم التخزين في **مكانين** معاً لضمان التوافق والاستعلام:

### 1. جدول `booking_payment_shares` (جدول مستقل)
- تخزين منظم لكل مشارك في الدفع
- مناسب للاستعلامات والتقارير
- يُقرأ منه أولاً عند تحميل الحجوزات

### 2. عمود `data` (JSON) في `club_bookings`
- تُخزَّن نسخة في `club_bookings.data.paymentShares` للتوافق
- يستخدم كاحتياطي عند عدم وجود جدول `booking_payment_shares`

**عند الحفظ:** يتم الكتابة إلى كلا المكانين. **عند القراءة:** يُفضَّل جدول `booking_payment_shares`، وإن لم يكن موجوداً يُستخدم JSON.

### رابط إنشاء الجدول في u502561206_padel_db

**رابط مباشر لتنزيل وتشغيل SQL على u502561206_padel_db:**
- [add-booking-payment-shares-table.sql](https://github.com/yakhawaji-lang/padel/blob/main/server/db/migrations/add-booking-payment-shares-table.sql)
- رابط Raw: `https://raw.githubusercontent.com/yakhawaji-lang/padel/main/server/db/migrations/add-booking-payment-shares-table.sql`

**أو نفّذ الأمر:**
```bash
mysql -u USER -p u502561206_padel_db < server/db/migrations/add-booking-payment-shares-table.sql
```

### بنية جدول booking_payment_shares
| العمود | النوع | الوصف |
|--------|-------|-------|
| id | INT AUTO_INCREMENT | مفتاح أساسي |
| booking_id | VARCHAR(255) | معرف الحجز |
| club_id | VARCHAR(255) | معرف النادي |
| participant_type | ENUM | 'registered' أو 'unregistered' |
| member_id | VARCHAR(255) NULL | معرف العضو (للمسجلين) |
| member_name | VARCHAR(255) NULL | اسم العضو |
| phone | VARCHAR(50) NULL | رقم الجوال (لغير المسجلين) |
| amount | DECIMAL(10,2) | مبلغ المشاركة |
| whatsapp_link | TEXT NULL | رابط واتساب |
| created_at | DATETIME | تاريخ الإنشاء |

## المميزات
- مشاركة مع أعضاء مسجلين (اختيار من قائمة أعضاء النادي)
- مشاركة مع غير مسجلين: اختيار رقم من جهات الاتصال (Contact Picker API) أو إدخال يدوي
- إنشاء رابط واتساب لدعوة غير المسجل للتسجيل والمشاركة
- تقسيم بالتساوي أو تحديد مبلغ محدد لكل مشارك
- التحقق: مجموع المشاركات لا يتجاوز سعر الحجز
