PlayTix — مجلد نقل المشروع
========================

بعد تشغيل السكربت من جذر المشروع يظهر هنا:

  • playtix-full-project-transfer.zip — نسخة مضغوطة من المشروع (بدون node_modules و .git ومجلد هذه الحزمة)
  • PLANT_DATABASE_COMBINED.sql — ملف SQL واحد لاستيراد قاعدة جديدة (مخطط + تحديثات آمنة)
  • PLANT_DATABASE.sql — نسخة من server/db/PLANT_DATABASE.sql (دليل التنفيذ خطوة بخطوة)

التشغيل:

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-transfer-pack.ps1

ثم انسخ هذا المجلد كاملاً للجهاز أو الاستضافة الجديدة.
