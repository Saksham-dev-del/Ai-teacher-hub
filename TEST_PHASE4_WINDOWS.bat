@echo off
setlocal
cd /d "%~dp0backend"
if not exist "node_modules" call npm install
call npm run test:phase2 || goto :error
call npm run test:phase3 || goto :error
call npm run test:phase4 || goto :error
echo.
echo All Phase 2, Phase 3 and Phase 4 automated tests passed.
pause
exit /b 0
:error
echo.
echo A test failed. Review the error above.
pause
exit /b 1
