# PlayTix — بناء حزمة نقل المشروع + ملف SQL مجمّد لزراعة القاعدة
# التشغيل من جذر المشروع:  powershell -File scripts/build-transfer-pack.ps1

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

$exportDir = Join-Path $root 'export'
if (-not (Test-Path $exportDir)) {
  New-Item -ItemType Directory -Path $exportDir | Out-Null
}

$createAll = Join-Path $root 'server\db\CREATE_ALL_TABLES.sql'
$syncExtra = Join-Path $root 'server\db\migrations\phpmyadmin-create-missing-tables-and-columns.sql'
$combinedOut = Join-Path $exportDir 'PLANT_DATABASE_COMBINED.sql'

if (-not (Test-Path $createAll)) { throw "Missing: $createAll" }
if (-not (Test-Path $syncExtra)) { throw "Missing: $syncExtra" }

$banner = @"
-- ============================================================================
-- PlayTix — PLANT_DATABASE_COMBINED.sql (ملف مجمّد لزراعة قاعدة جديدة)
-- يُولَّد تلقائياً بواسطة scripts/build-transfer-pack.ps1 — لا تعدّل يدوياً
-- الجزء 1: CREATE_ALL_TABLES.sql  |  الجزء 2: جداول/أعمدة إضافية آمنة للتكرار
-- بعد الاستيراد: اضبط DATABASE_URL وشغّل npm install على الخادم/الجهاز الجديد
-- ============================================================================

"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($combinedOut, $banner, $utf8NoBom)
Add-Content -Path $combinedOut -Value (Get-Content -Path $createAll -Raw -Encoding UTF8)
Add-Content -Path $combinedOut -Value "`n`n-- ============ End part 1 / begin part 2 migrations ============`n`n"
Add-Content -Path $combinedOut -Value (Get-Content -Path $syncExtra -Raw -Encoding UTF8)

Write-Host "Wrote: $combinedOut"

$zipName = 'playtix-full-project-transfer.zip'
$zipPath = Join-Path $exportDir $zipName
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# tar مدمج في Windows 10+ — استثناءات لتقليل الحجم
$tarArgs = @(
  '-c', '-a', '-f', $zipPath,
  '--exclude=node_modules',
  '--exclude=.git',
  '--exclude=dist',
  '--exclude=dist-ssr',
  '--exclude=.cursor',
  "--exclude=$zipName",
  '-C', $root,
  '.'
)
& tar @tarArgs
if ($LASTEXITCODE -ne 0) { throw "tar failed with exit $LASTEXITCODE" }

Write-Host "Wrote: $zipPath"
Write-Host "Done. Copy export/ folder to the new machine or host."
