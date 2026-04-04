-- =============================================================================
-- إدراج يدوي لدعوة الدفع pay-invite (جدول booking_payment_shares)
-- Manual insert for a pay-invite row when the link says "not in database"
--
-- شروط واجهة البرمجة GET /api/bookings/invite/:token:
-- - يجب أن يوجد صف في club_bookings بنفس (booking_id, club_id) و deleted_at IS NULL
-- - invite_token يطابق الرابط تماماً: inv_ + 32 حرفاً hex (أحرف صغيرة)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) اعثر على حجزاً صالحاً (عدّل WHERE حسب ناديك)
-- ---------------------------------------------------------------------------
-- SELECT id AS booking_id,
--        club_id,
--        booking_date,
--        start_time,
--        end_time,
--        status,
--        deleted_at
-- FROM club_bookings
-- WHERE deleted_at IS NULL
--   AND club_id = 'ضع_معرف_النادي_هنا'
-- ORDER BY updated_at DESC
-- LIMIT 20;

-- ---------------------------------------------------------------------------
-- 2) تحقق أن التوكن غير مستخدم من قبل (اختياري)
-- ---------------------------------------------------------------------------
-- SELECT id, booking_id, club_id, invite_token, phone, amount, paid_at, removed_at
-- FROM booking_payment_shares
-- WHERE invite_token = 'ضع_نفس_التوكن_من_الرابط';

-- ---------------------------------------------------------------------------
-- 3) عيّن القيم — يجب أن تطابق الرابط الذي تفتحه في المتصفح
-- ---------------------------------------------------------------------------
SET @club_id       := 'YOUR_CLUB_ID';     -- معرف النادي (نفس club_bookings.club_id)
SET @booking_id    := 'YOUR_BOOKING_ID';  -- معرف الحجز (نفس club_bookings.id)
SET @invite_token  := 'inv_0123456789abcdef0123456789abcdef';  -- من الرابط بعد /pay-invite/
SET @phone         := '+966501234567';    -- رقم الضيف (كما في الدعوة)
SET @amount        := 50.00;              -- مبلغ الحصة
SET @participant   := 'unregistered';     -- pay-invite عادة: unregistered | أو registered لمسجّل غير منضم

-- ---------------------------------------------------------------------------
-- 4) إدراج الصف
-- ---------------------------------------------------------------------------
INSERT INTO booking_payment_shares (
  booking_id,
  club_id,
  participant_type,
  member_id,
  member_name,
  phone,
  amount,
  whatsapp_link,
  invite_token,
  paid_at,
  payment_method,
  removed_at
) VALUES (
  @booking_id,
  @club_id,
  @participant,
  NULL,
  NULL,
  @phone,
  @amount,
  NULL,
  @invite_token,
  NULL,
  NULL,
  NULL
);

-- =============================================================================
-- بديل: إن وُجدت حصة لنفس الرقم لكن بدون invite_token أو بتوكن قديم
-- =============================================================================
-- UPDATE booking_payment_shares
-- SET invite_token = @invite_token,
--     removed_at = NULL,
--     paid_at = NULL,
--     amount = @amount,
--     participant_type = @participant
-- WHERE booking_id = @booking_id
--   AND club_id = @club_id
--   AND phone = @phone
-- ORDER BY id DESC
-- LIMIT 1;

-- =============================================================================
-- توليد توكن جديد (إن أردت رابطاً جديداً بدل إصلاح القديم)
-- نفّذ في MySQL 8+ ثم انسخ الناتج إلى @invite_token والرابط
-- =============================================================================
-- SELECT CONCAT('inv_', LOWER(MD5(CONCAT(UUID(), RAND(), NOW())))) AS new_invite_token;
