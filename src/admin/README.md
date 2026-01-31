# Admin Panel - بوابة التحكم الإدارية

## نظرة عامة

البوابة الإدارية تتيح إدارة متعددة الأندية مع جميع الخصائص والوظائف.

## الميزات

### 1. إدارة الأندية (Clubs Management)
- إنشاء وإدارة عدة أندية
- معلومات كل نادي (اسم، عنوان، اتصالات)
- إعدادات Playtomic API لكل نادي
- إدارة الملاعب

### 2. إدارة البطولات (Tournaments Management)
- عرض جميع البطولات
- إنشاء بطولات جديدة
- تعديل وحذف البطولات
- تتبع حالة البطولات

### 3. أنواع البطولات (Tournament Types)
- إدارة أنواع البطولات المختلفة
- تخصيص كل نوع (King of Court, Social, etc.)
- إضافة أنواع جديدة

### 4. إدارة الأعضاء (Members Management)
- عرض جميع الأعضاء
- إضافة أعضاء جدد
- تعديل معلومات الأعضاء
- إحصائيات الأعضاء

### 5. إدارة الحجوزات (Bookings Management)
- عرض جميع الحجوزات
- إنشاء حجوزات جديدة
- تعديل وحذف الحجوزات
- ربط مع Playtomic API

### 6. إدارة العروض (Offers Management)
- إنشاء عروض خاصة
- إدارة الخصومات
- تحديد صلاحية العروض

### 7. المحاسبة (Accounting)
- تتبع الإيرادات والمصروفات
- تقارير مالية
- حساب الأرباح

## كيفية الوصول

1. افتح التطبيق في المتصفح
2. اذهب إلى: `http://localhost:3000/admin`
3. اختر النادي من القائمة المنسدلة
4. ابدأ في إدارة النظام

## البنية

```
src/admin/
├── AdminApp.jsx          # المكون الرئيسي
├── AdminApp.css          # الأنماط الرئيسية
├── components/
│   ├── AdminSidebar.jsx  # القائمة الجانبية
│   ├── AdminHeader.jsx   # رأس الصفحة
│   └── *.css            # أنماط المكونات
└── pages/
    ├── Dashboard.jsx
    ├── ClubsManagement.jsx
    ├── TournamentsManagement.jsx
    ├── TournamentTypesManagement.jsx
    ├── MembersManagement.jsx
    ├── BookingsManagement.jsx
    ├── OffersManagement.jsx
    ├── AccountingManagement.jsx
    └── *.css
```

## التخزين

جميع البيانات تُحفظ في `localStorage` باستخدام:
- `admin_clubs` - قائمة الأندية
- `admin_settings` - إعدادات البوابة

## التطوير المستقبلي

- نظام مصادقة وأدوار
- تقارير متقدمة
- تصدير البيانات
- إشعارات
- دعم متعدد اللغات كامل
