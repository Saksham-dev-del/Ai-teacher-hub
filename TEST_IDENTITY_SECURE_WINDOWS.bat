@echo off
setlocal
cd /d "%~dp0backend"
if not exist node_modules call npm install
call npm run test:identity
if errorlevel 1 exit /b 1
call npm run test:secure
if errorlevel 1 exit /b 1
call npm run test:factual-face
