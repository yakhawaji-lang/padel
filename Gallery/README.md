# Gallery — معرض صور المشروع

مجلد مركزي يحتوي على جميع الصور والشعارات الخاصة بمشروع PlayTix، منظمة حسب المنصة والنوادي.

## الهيكل | Structure

```
Gallery/
├── platform/           # صور المنصة الرئيسية
│   ├── logo/           # شعار PlayTix
│   │   ├── logo-playtix.png
│   │   └── LogoPlayTix1.png
│   ├── homepage/       # صور الصفحة الرئيسية
│   │   ├── banner/     # بنر الصفحة الرئيسية
│   │   └── gallery/    # معرض Experience PlayTix (6 صور)
│   └── assets/         # أصول إضافية (أعلام، أيقونات)
│
└── clubs/              # صور النوادي
    ├── _template/      # قالب لإنشاء مجلد نادي جديد
    │   ├── logo/       # شعار النادي
    │   ├── banner/     # بنر النادي
    │   ├── courts/     # صور الملاعب
    │   └── offers/     # صور العروض
    └── [club-id]/      # مجلد لكل نادي (مثال: club-123)
        ├── logo/
        ├── banner/
        ├── courts/
        └── offers/
```

## المنصة | Platform

| المسار | الوصف | الاستخدام |
|--------|-------|--------|
| `platform/logo/` | شعار PlayTix | الصفحة الرئيسية، تسجيل الدخول، الصفحات القانونية |
| `platform/homepage/banner/` | بنر الصفحة الرئيسية | قسم Hero في الصفحة الرئيسية |
| `platform/homepage/gallery/` | معرض Experience PlayTix | 6 صور في قسم المعرض |
| `platform/assets/` | أصول إضافية | أعلام اللغات، أيقونات |

## النوادي | Clubs

لكل نادي مجلد باسمه `[club-id]` يحتوي على:

| المجلد | الوصف |
|--------|-------|
| `logo/` | شعار النادي |
| `banner/` | بنر صفحة النادي العامة |
| `courts/` | صور الملاعب (ملعب 1، ملعب 2، ...) |
| `offers/` | صور العروض |

**ربط قاعدة البيانات:** عند رفع صور النوادي (شعار، بنر، ملاعب، عروض) من لوحة التحكم، تُحفظ تلقائياً في Gallery ويُخزّن مسار API في قاعدة البيانات. التطبيق يعرض الصور عبر `/api/gallery/serve?path=...`.

## إضافة نادي جديد | Adding a New Club

1. انسخ مجلد `_template` وسمّه `[club-id]` (مثل `hala-padel-club`)
2. أضف الصور في المجلدات المناسبة
3. ارفع الصور من لوحة تحكم النادي أو استخدم الروابط في الإعدادات

## الملفات المرجعية | Reference Files

- `public/logo-playtix.png` ← يُنسخ من `Gallery/platform/logo/`
- `public/homepage/` ← يُنسخ من `Gallery/platform/homepage/`
