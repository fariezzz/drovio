@echo off
title Hentikan Drovio Engine
echo Menghentikan Drovio di port 48888...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :48888 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
echo Drovio berhasil dihentikan.
ping 127.0.0.1 -n 2 >nul
