# الفواتير والمدفوعات (لكل نادي)

## ما الذي يُضاف؟

- جداول **`club_invoice_seq`**, **`club_invoices`**, **`club_invoice_lines`**, **`club_payments`**: ترقيم فواتير لكل نادي، بنود، وسجل قبض مرتبط بالفاتورة مع مفاتيح **idempotency** لتجنب التكرار.
- **`server/services/invoiceService.js`**: إصدار فاتورة مدفوعة بالكامل مع بند واحد وحركة قبض داخل معاملة واحدة.
- **`server/routes/invoices.js`**: 
  - `GET /api/invoices?clubId=&from=&to=&limit=&offset=`
  - `GET /api/invoices/:publicId?clubId=`
- الربط مع الحجوزات في **`server/routes/bookings.js`**:
  - بعد دفع إلكتروني أو غيره (مع `paid_at`): فاتورة لمشاركة الدفع.
  - خيار **الدفع في النادي كالتزام فقط** (`at_club` في `record-payment` بدون `paid_at`): **لا** تُصدَر فاتورة حتى يُعلَم الدفع فعلياً عبر `mark-share-paid-at-club`.
  - بعد **`complete-payment`**: فاتورة للحجز الكامل.

## تهجير قاعدة البيانات

1. نفّذ ملف SQL التالي على قاعدة النادي (phpMyAdmin → SQL أو استيراد الملف):

   - مسار الملف في المشروع: `server/db/migrations/add-club-invoicing-system.sql`

2. رابط الخام (GitHub — استبدل `main` إذا كان الفرع مختلفاً):

   **https://raw.githubusercontent.com/yakhawaji-lang/padel/main/server/db/migrations/add-club-invoicing-system.sql**

3. للمنشآت الجديدة: نفس الجداول مذكورة أيضاً في نهاية **`server/db/schema-normalized.sql`**.

4. أعد تشغيل خادم Node بعد التنفيذ.

## واجهة الإدارة

في تبويب **المحاسبة** يظهر جدول **فواتير النادي** مع تصفية التاريخ نفسها المستخدمة لجدول الحجوزات، وزر لعرض تفاصيل الفاتورة (البنود والقبض).
