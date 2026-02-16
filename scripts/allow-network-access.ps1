# فتح المنفذ 3000 في جدار حماية Windows للوصول من أجهزة أخرى على الشبكة
# شغّل هذا السكربت كمسؤول: انقر يمين على PowerShell واختر "Run as Administrator" ثم نفّذ:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
#   & ".\scripts\allow-network-access.ps1"

$ruleName = "Vite Dev Padel Port 3000"
$port = 3000

$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "القاعدة موجودة مسبقاً: $ruleName"
    exit 0
}

New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow
Write-Host "تمت إضافة قاعدة جدار الحماية. المنفذ $port مفتوح للاتصالات الواردة."
Write-Host "جرّب من الجهاز الآخر: http://192.168.8.72:3000/app/"
