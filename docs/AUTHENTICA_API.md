# Authentica API — إرسال SMS مخصص

مرجع سريع لـ [Authentica](https://portal.authentica.sa) API المستخدم في PlayTix.

---

## إرسال SMS مخصص

**Endpoint:** `POST https://api.authentica.sa/api/v2/send-sms`

### Headers

| Header | القيمة |
|--------|--------|
| `X-Authorization` | API Key من portal.authentica.sa |
| `Accept` | application/json |
| `Content-Type` | application/json |

### Body

```json
{
  "phone": "+9665XXXXXXXX",
  "message": "نص الرسالة",
  "sender_name": "PlayTix"
}
```

### ملاحظات

- **phone:** رقم دولي بصيغة E.164 (مثل +966501234567)
- **sender_name:** يجب أن يكون مسجلاً لدى Authentica
- راجع [authenticasa.apib](authenticasa.apib) للتوثيق الكامل
