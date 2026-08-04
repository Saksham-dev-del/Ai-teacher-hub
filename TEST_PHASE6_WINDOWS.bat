@echo off
setlocal
cd /d "%~dp0backend"

call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 exit /b 1

call npm run test:phase2
if errorlevel 1 exit /b 1
call npm run test:phase3
if errorlevel 1 exit /b 1
call npm run test:phase4
if errorlevel 1 exit /b 1
call npm run test:secure
if errorlevel 1 exit /b 1
call npm run test:phase5
if errorlevel 1 exit /b 1
call npm run test:phase6
if errorlevel 1 exit /b 1
call npm audit --omit=dev

pause
endlocal
