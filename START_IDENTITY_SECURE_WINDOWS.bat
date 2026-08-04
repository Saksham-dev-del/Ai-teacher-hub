@echo off
setlocal
cd /d "%~dp0backend"
if not exist .env (
  copy .env.example .env >nul
  echo Created backend\.env. Add MongoDB, JWT and Gemini settings if required.
  start notepad .env
  pause
)
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
call npm start
