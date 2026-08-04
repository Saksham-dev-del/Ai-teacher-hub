@echo off
setlocal
cd /d "%~dp0backend"

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo A backend\.env file has been created.
  echo Add your MongoDB URI, JWT/Audit secrets and Gemini key, save it, then run this file again.
  start notepad .env
  pause
  exit /b 0
)

where node >nul 2>nul || (
  echo Node.js was not found. Install Node.js 18 or newer first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies from the official npm registry...
  call npm install --registry=https://registry.npmjs.org/
  if errorlevel 1 (
    echo Dependency installation failed. See backend\NPM_INSTALL_FIX.md.
    pause
    exit /b 1
  )
)

call npm start
endlocal
