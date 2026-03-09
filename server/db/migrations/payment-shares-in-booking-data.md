# Payment Shares — لا تغيير في الجداول

## التخزين

يتم تخزين `paymentShares` داخل عمود `data` (JSON) في جدول `club_bookings` الموجود في قاعدة البيانات `u502561206_padel_db`.

**لا حاجة لإنشاء جداول أو حقول جديدة.** البنية الحالية تدعم الحقل.

## بنية paymentShares في data

```json
{
  "paymentShares": [
    {
      "type": "registered",
      "memberId": "member-123",
      "memberName": "أحمد",
      "amount": 45.5
    },
    {
      "type": "unregistered",
      "phone": "+966501234567",
      "amount": 45.5,
      "whatsappLink": "https://wa.me/966501234567?text=..."
    }
  ]
}
```

## التحقق من التخزين

```sql
SELECT id, club_id, data FROM club_bookings WHERE JSON_EXTRACT(data, '$.paymentShares') IS NOT NULL;
```
