@echo off
setlocal
cd /d "%~dp0backend"
call npm install
if errorlevel 1 exit /b 1
call npm run test:phase9
if errorlevel 1 exit /b 1
call npm run test:phase10
if errorlevel 1 exit /b 1
call npm audit --omit=dev
pause
