@echo off
title TerraMind AI
echo.
echo  ========================================
echo    🌍 TerraMind AI - Starting...
echo  ========================================
echo.

echo  [1/2] Starting Backend (FastAPI :8000)...
start "TerraMind Backend" cmd /k "cd /d %~dp0 && uvicorn server:app --reload --port 8000"

echo  [2/2] Starting Frontend (React :3000)...
start "TerraMind Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo  ========================================
echo    ✅ Both servers are running!
echo.
echo    Open in browser: http://localhost:3000
echo  ========================================
echo.

start http://localhost:3000
