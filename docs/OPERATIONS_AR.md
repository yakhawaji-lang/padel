# عمليات التشغيل — العضويات والحجوزات

دليل سريع لسير العمل وما تفعله عند حدوث مشكلة.

---

## 1. الانضمام للنادي

- **الواجهة:** المستخدم يضغط "انضم للنادي" في صفحة النادي العام.
- **الطلب:** `POST /api/clubs/join` مع `{ clubId, memberId }`.
- **الخادم:** يتحقق من وجود النادي والعضو (أو ينشئ العضو من `app_store` إن لزم)، ثم يضيف الصف في `member_clubs` عبر خدمة العضويات فقط.
- **بعد النجاح:** حدّث الواجهة بـ `refreshClubsFromApi()` وربط العضو بالنادي محلياً حتى يظهر "عضو".

---

## 2. الحجز (من القفل إلى التأكيد)

1. **قفل الشريحة:** `POST /api/bookings/lock` (clubId, courtId, date, startTime, endTime, memberId).
2. **تأكيد الحجز:** `POST /api/bookings/confirm` (lockId + نفس البيانات + totalAmount، واختياري paymentShares).
3. **الخادم:** ينشئ الحجز في `club_bookings` عبر خدمة الحجوزات، يربط القفل بالحجز، يلغي القفل.
4. **بعد النجاح:** استدعاء `getClubById(clubId)` أو `refreshClubsFromApi()` ثم `setClub(...)` حتى تظهر الحجوزات في الصفحة.

---

## 3. إلغاء حجز أو قفل

- **قفل فقط:** `POST /api/bookings/cancel` مع `{ lockId }` → يحرّر القفل.
- **حجز مؤكد:** `POST /api/bookings/cancel` مع `{ bookingId }` → يلغي الحجز (status = cancelled، soft delete) عبر خدمة الحجوزات، ويُدرج في `booking_refunds` إن وُجد.

---

## 4. حذف حجز من لوحة الإدارة

- من واجهة الإدارة: حذف الحجز من قائمة حجوزات النادي ثم حفظ النادي.
- الخادم: `saveClubsToNormalized` يحدّث `club_bookings` (soft delete) **بدون مسح عضويات النادي** — إذا أتت قائمة الأعضاء فارغة، لا يُمسح جدول `member_clubs` لهذا النادي.

---

## 5. إذا اختفت العضوية أو الحجز بعد التحديث (F5)

1. **تحديث البيانات من الخادم:** التأكد أن الواجهة تستدعي `/api/data` (مفاتيح `admin_clubs`, `all_members`, `padel_members`) و**لا** تعتمد على fallback لـ `/api/store` عند الفشل؛ حتى لا تُستبدل البيانات بمخزن قديم.
2. **فحص السلامة:**
   - من الطرفية: `node server/scripts/db-integrity-check.js`
   - أو: `GET http://localhost:4000/api/health/integrity` → إذا وُجدت `issues` (عضويات أو حجوزات يتيمة)، معالجة البيانات أو الربط يدوياً.
3. **إعادة ربط عضو فقد عضويته:** تشغيل `node server/scripts/relink-member-to-best-padel.js` (يربط الأعضاء الذين ليس لهم أي نادي في `member_clubs` بنادي Best Padel، أو العضو بالبريد a@a.com إن وُجد).
4. **مزامنة عضويات الأعضاء:** إن وُجد أعضاء في `members` بدون صفوف في `member_clubs`، استدعاء `GET` أو `POST /api/init-db/sync-member-clubs` لمزامنة الربط من `entities` أو `app_store` أو النادي الوحيد.

---

## 6. الكتابة في الجداول الحرجة

- **member_clubs:** تتم **فقط** عبر:
  - `server/services/membershipService.js` (addMemberToClub، removeMemberFromClub، setMemberClubs، setClubMembers، إلخ)
  - المستدعيات: `POST /api/clubs/join`، `saveMembersToNormalized`، `saveClubsToNormalized`، `removeMemberFromClub`، سكربت relink، واجهة sync-member-clubs.
- **club_bookings (إنشاء/إلغاء/تحديث حالة/انتهاء):** تتم عبر:
  - `server/services/bookingService.js` (createBooking، cancelBooking، updateBookingPayment، updateBookingPaymentDeadline، expireUnpaidBookings)
  - المستدعيات: `POST /api/bookings/confirm`، `POST /api/bookings/cancel`، `POST /api/bookings/record-payment`، `POST /api/bookings/mark-pay-at-club`، و job انتهاء الحجوزات غير المدفوعة.

هذا يضمن نقطة واحدة للتعديل والتدقيق وتجنب فقدان العضويات أو الحجوزات.
