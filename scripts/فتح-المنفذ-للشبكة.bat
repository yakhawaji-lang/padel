@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
echo ============================================
echo   فتح المنفذ 3000 للوصول من أجهزة أخرى
echo ============================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo يجب تشغيل هذا الملف كمسؤول.
    echo انقر يمين على الملف واختر "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo إضافة قاعدة جدار الحماية...
netsh advfirewall firewall add rule name="Vite Padel 3000" dir=in action=allow protocol=TCP localport=3000
if %errorLevel% neq 0 (
    echo فشل. جرّب من wf.msc يدوياً.
    pause
    exit /b 1
)

echo.
echo تم بنجاح. المنفذ 3000 مفتوح.
echo.
echo من الجهاز الآخر افتح المتصفح واكتب:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    echo   http://!IP!:3000/app/
    goto :done
)
:done
echo.
echo إن لم يعمل: تأكد أن كلا الجهازين على نفس الواي فاي وليس شبكة الضيوف.
pause
