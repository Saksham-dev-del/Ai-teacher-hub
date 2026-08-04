@echo off
setlocal
cd /d "%~dp0backend"
if not exist .env (
  copy .env.example .env >nul
  echo A new backend\.env file was created. Add MongoDB and Gemini settings, save it, then run this file again.
  start notepad .env
  pause
  exit /b 0
)
call npm install
if errorlevel 1 exit /b 1
call npm start
