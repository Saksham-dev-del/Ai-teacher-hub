@echo off
setlocal
cd /d "%~dp0backend"
if not exist .env (
  copy .env.example .env >nul
  echo Created backend\.env. Add MONGODB_URI, JWT_SECRET, AUDIT_HASH_SECRET and GEMINI_API_KEY before using live features.
  notepad .env
)
echo Installing dependencies from the official npm registry...
call npm config set registry https://registry.npmjs.org/
call npm install --registry=https://registry.npmjs.org/
if errorlevel 1 goto :error
echo Running Phase 7 and Phase 8 tests...
call npm run test:phase78
if errorlevel 1 goto :error
echo Starting AI Teacher Resource Hub Phase 8...
call npm start
goto :eof
:error
echo.
echo Setup failed. Review the error above.
pause
