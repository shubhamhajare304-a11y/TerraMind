@echo off
title TerraMind AI Environmental Change Detection Platform
color 0A

echo.
echo  ================================================================
echo    TerraMind - AI Environmental Change Detection Platform
echo    Three Core Modules: Vegetation (VARI) - Water - Land Cover
echo  ================================================================
echo.

REM ── Check Python ──────────────────────────────────────────────────
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Python is not installed or not found in system PATH.
    echo          Please install Python 3.9+ from https://www.python.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Python detected.

REM ── Check Node.js ─────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed or not found in system PATH.
    echo          Please install Node.js 18+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo  [OK] Node.js detected.

REM ── Check npm ─────────────────────────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm is not installed. Please reinstall Node.js.
    echo.
    pause
    exit /b 1
)
echo  [OK] npm detected.

echo.
echo  ----------------------------------------------------------------
echo  [1/2] Starting FastAPI Backend on http://localhost:8000 ...
echo  ----------------------------------------------------------------
start "TerraMind Backend" cmd /k "cd /d %~dp0 && python -m uvicorn server:app --port 8000 || pause"

echo  Waiting for Backend to initialize and load AI model...
set attempts=0
:wait_backend
timeout /t 1 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/study-areas' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    set /a attempts+=1
    if %attempts% lss 25 (
        goto wait_backend
    )
)
echo  [OK] Backend is ready and responding at http://localhost:8000.

echo.
echo  ----------------------------------------------------------------
echo  [2/2] Starting React Vite Frontend on http://localhost:3000 ...
echo  ----------------------------------------------------------------
start "TerraMind Frontend" cmd /k "cd /d %~dp0frontend && npm run dev || pause"

echo  Waiting for Frontend to initialize...
set fattempts=0
:wait_frontend
timeout /t 1 /nobreak >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    set /a fattempts+=1
    if %fattempts% lss 15 (
        goto wait_frontend
    )
)
echo  [OK] Frontend is ready at http://localhost:3000.

echo.
echo  ================================================================
echo   Both services are running successfully!
echo   Opening TerraMind in your browser: http://localhost:3000
echo  ================================================================
echo.
start "" "http://localhost:3000"

echo  Keep the Backend and Frontend terminal windows open while using TerraMind.
echo  To shut down the application, close both windows.
echo.
pause
