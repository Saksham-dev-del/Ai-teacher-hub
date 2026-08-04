@echo off
setlocal
cd /d "%~dp0"
echo.
echo [1/5] Stopping Node.js processes that may lock node_modules...
taskkill /F /IM node.exe >nul 2>&1

echo [2/5] Removing old node_modules...
if exist node_modules rmdir /S /Q node_modules
if exist node_modules powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath 'node_modules' -Recurse -Force -ErrorAction SilentlyContinue"

echo [3/5] Setting the official npm registry...
call npm config set registry https://registry.npmjs.org/

echo [4/5] Verifying npm cache...
call npm cache verify

echo [5/5] Installing dependencies...
call npm install --registry=https://registry.npmjs.org/

if errorlevel 1 (
  echo.
  echo Installation failed. Close VS Code, terminals, File Explorer previews, and antivirus scans, then run this file as Administrator.
  pause
  exit /b 1
)

echo.
echo Dependencies installed successfully.
echo Run: npm start
pause
