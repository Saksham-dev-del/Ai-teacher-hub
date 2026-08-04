@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".env" (
  echo Creating backend\.env from .env.example...
  copy /Y ".env.example" ".env" >nul
  echo.
  echo IMPORTANT: Add your real GEMINI_API_KEY and JWT_SECRET in backend\.env.
  echo MongoDB must also be running or MONGODB_URI must point to Atlas.
  start notepad ".env"
  echo.
  pause
)

if not exist "node_modules" (
  echo Installing dependencies from the official npm registry...
  call npm config set registry https://registry.npmjs.org/
  call npm install
  if errorlevel 1 goto :error
)

echo Starting AI Teacher Resource Hub Phase 4...
call npm start
goto :eof

:error
echo.
echo Installation failed. Read backend\NPM_INSTALL_FIX.md or run backend\FIX_NPM_INSTALL_WINDOWS.bat.
pause
exit /b 1
