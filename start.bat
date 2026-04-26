@echo off
echo 🚀 Starting RevenueRadar...
echo.

:: Start backend
echo 📦 Setting up backend...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt -q
echo ✅ Backend dependencies installed

:: Start backend in background
start /B uvicorn main:app --host 0.0.0.0 --port 8000
echo ✅ Backend starting at http://localhost:8000
cd ..

:: Wait for backend
timeout /t 3 /nobreak >nul

:: Start frontend
echo.
echo 🎨 Setting up frontend...
cd frontend
if not exist node_modules (
    npm install --silent
)

:: Create .env.local if missing
if not exist .env.local (
    echo NEXT_PUBLIC_API_URL=http://localhost:8000/api > .env.local
)

echo ✅ Starting frontend at http://localhost:3000
echo.
echo 🌐 RevenueRadar is starting!
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo.

npm run dev
