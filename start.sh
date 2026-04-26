#!/bin/bash

echo "🚀 Starting RevenueRadar..."
echo ""

# Check dependencies
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 required. Install from python.org"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install from nodejs.org"; exit 1; }

# Start backend
echo "📦 Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt -q
echo "✅ Backend dependencies installed"

# Start backend in background
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "✅ Backend running at http://localhost:8000 (PID: $BACKEND_PID)"

cd ..

# Start frontend
echo ""
echo "🎨 Setting up frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install --silent
fi
echo "✅ Frontend dependencies installed"

# Create .env.local if missing
if [ ! -f ".env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
fi

echo "✅ Starting frontend at http://localhost:3000"
echo ""
echo "🌐 RevenueRadar is starting up!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

npm run dev &
FRONTEND_PID=$!

# Handle Ctrl+C
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
