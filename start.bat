@echo off
echo ===================================================
echo   AeroTwin Ground Control Station (GCS) Launcher
echo ===================================================
echo.

echo [1/2] Starting FastAPI Backend on Port 3000...
start "AeroTwin Backend" cmd /k "uvicorn backend.app.main:app --host 0.0.0.0 --port 3000 --reload"

echo [2/2] Starting Vite Frontend on Port 5173...
start "AeroTwin Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   AeroTwin local execution started successfully!
echo   - Backend API: http://localhost:3000/docs
echo   - GCS HUD Panel: http://localhost:5173
echo ===================================================
pause
