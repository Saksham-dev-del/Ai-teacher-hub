@echo off
setlocal
cd /d "%~dp0backend"
if not exist .env (
  copy .env.example .env >nul
  echo Created backend\.env. Add MongoDB URI, JWT secret and Gemini API key, then save it.
  notepad .env
)
call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 pause & exit /b 1
call npm run test:secure
if errorlevel 1 pause & exit /b 1
call npm start
pause
