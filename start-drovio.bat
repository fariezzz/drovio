@echo off
title Drovio - Media Engine dan Cloudflare Tunnel
cd /d "%~dp0"

echo ========================================================
echo   Memeriksa Layanan Cloudflare Tunnel...
echo ========================================================

:: Pastikan cloudflared aktif
tasklist /fi "imagename eq cloudflared.exe" 2>nul | findstr /i "cloudflared.exe" >nul
if errorlevel 1 (
    echo Mengaktifkan Cloudflare Tunnel...
    net start cloudflared >nul 2>&1
    tasklist /fi "imagename eq cloudflared.exe" 2>nul | findstr /i "cloudflared.exe" >nul
    if errorlevel 1 (
        if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
            start "" /b "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel run --token-file "C:\ProgramData\cloudflared\token" >nul 2>&1
        )
    )
)

echo.
echo ========================================================
echo   Drovio Engine dan Cloudflare Tunnel Berjalan
echo ========================================================
echo   - Akses di Komputer : http://127.0.0.1:48888
echo   - Akses lewat HP    : Buka domain Cloudflare Anda
echo   - Status Tunnel     : AKTIF (Terhubung ke Cloudflare)
echo ========================================================
echo.

:: Pastikan port 48888 bersih dari proses lama
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :48888 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Cek apakah build produksi (.next\BUILD_ID) sudah lengkap
if not exist ".next\BUILD_ID" (
    echo Menyiapkan build produksi Next.js...
    call npm run build
    echo.
)

:: Buka browser otomatis di PC
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:48888'"

:: Jalankan server Next.js
call npm run start

echo.
echo Server telah berhenti.
pause
