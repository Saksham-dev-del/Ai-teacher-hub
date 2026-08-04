@echo off
setlocal
cd /d "%~dp0backend"
call npm config set registry https://registry.npmjs.org/
call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 goto :error
call npm run test:phase2
if errorlevel 1 goto :error
call npm run test:phase3
if errorlevel 1 goto :error
call npm run test:phase4
if errorlevel 1 goto :error
call npm run test:secure
if errorlevel 1 goto :error
call npm run test:phase5
if errorlevel 1 goto :error
call npm run test:phase6
if errorlevel 1 goto :error
call npm run test:phase7
if errorlevel 1 goto :error
call npm run test:phase8
if errorlevel 1 goto :error
call npm audit --omit=dev
pause
goto :eof
:error
echo.
echo One or more tests failed.
pause
