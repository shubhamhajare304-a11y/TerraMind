@echo off
title TerraMind - AI Environmental Change Detection Platform
color 0A

echo.
echo  ==============================================================
echo   TerraMind - AI Environmental Change Detection Platform
echo   Version 2.5  ^|  EuroSAT ResNet-50  ^|  VARI ^| Optical Water
echo  ==============================================================
echo.

REM ── Check Python ──────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python not found in PATH.
    echo          Please install Python 3.9+ and add it to PATH.
    echo.
    pause
    exit /b 1
)
echo  [OK] Python found.

REM ── Check Node.js ─────────────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found in PATH.
    echo          Please install Node.js 18+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js found.

REM ── Check npm ─────────────────────────────────────────────────────
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)
echo  [OK] npm found.

echo.
echo  [1/2] Starting TerraMind Backend (FastAPI on port 8000)...
start "TerraMind Backend" cmd /k "cd /d %~dp0 && echo Backend starting... && uvicorn server:app --port 8000 --reload"

echo  [2/2] Starting TerraMind Frontend (React/Vite on port 3000)...
start "TerraMind Frontend" cmd /k "cd /d %~dp0frontend && echo Frontend starting... && npm run dev"

echo.
echo  Waiting for services to initialize...
timeout /t 5 /nobreak >nul

echo.
echo  ==============================================================
echo   Both servers are starting in separate windows.
echo.
echo   Backend API  : http://localhost:8000
echo   Frontend App : http://localhost:3000
echo.
echo   Opening TerraMind in your browser...
echo  ==============================================================
echo.

timeout /t 3 /nobreak >nul
start http://localhost:3000

echo  TerraMind is running. Close the backend/frontend windows to stop.
echo.
pause
