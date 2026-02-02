# Padel Tournament - King of the Court

A simple frontend application for managing a padel tournament with a "King of the Court" format.

## Features

- **Team Management**: Add/remove teams (default 12 teams)
- **4 Courts**: Divide teams across 4 courts
- **King of the Court**: Winners stay on court until defeated
- **Smart Scheduling**: Ensures no team plays the same opponent twice during group stage
- **3 Matches Per Team**: Each team plays exactly 3 matches in the group stage
- **Scoring System**: Tracks wins, losses, and games won (sets are 6 games)
- **15-Minute Matches**: Timer for each match
- **Standings**: Automatically displays top 4 teams after group stage completion

## How to Run

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:3000`

## How to Use

1. **Setup Teams**: 
   - Default 12 teams are created automatically
   - Click "+ Add Team" to add more teams
   - Click "−" to remove a team
   - Edit team names by clicking on them

2. **Start Matches**:
   - Click "Assign Teams to Courts" to fill all 4 courts
   - Each match has a 15-minute timer

3. **Record Results**:
   - Enter the number of games won by each team (0-6)
   - Click the winner button to record the match
   - Winner stays on court (King of the Court format)

4. **View Standings**:
   - After all teams complete 3 matches, standings automatically appear
   - Top 4 teams are displayed based on:
     - Wins (primary)
     - Games won (secondary tiebreaker)

## Build for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` folder. You can deploy this folder to any web server or run it on another laptop.

## قاعدة بيانات PostgreSQL

يمكن تشغيل النظام بالكامل على PostgreSQL بدلاً من تخزين المتصفح. راجع [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) للتفاصيل.

```bash
# تهيئة قاعدة البيانات
npm run db:init

# تشغيل الخادم (في نافذة منفصلة)
npm run server

# في .env.local
VITE_USE_POSTGRES=true
DATABASE_URL=postgresql://user:password@localhost:5432/padel
```

## مزامنة البيانات بين الأجهزة (Vercel وجميع الأجهزة)

عند عدم استخدام PostgreSQL، يمكن ربط التطبيق بـ Supabase. اتبع [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

## رفع المشروع مع البيانات إلى GitHub

1. تصدير البيانات من Supabase إلى ملف في المشروع:  
   `npm run export-data`  
   (يتطلّب `.env.local` مع مفاتيح Supabase؛ يُنشأ `data/seed-clubs.json`).
2. رفع الكود والملف:  
   `git add .` ثم `git commit -m "Project with data backup"` ثم `git push origin main`.

