🔥 1. BACKEND SETUP (FastAPI)
1.1. Go to backend folder
cd backend

1.2. Create virtual environment
python -m venv venv

1.3. Activate virtual environment

macOS / Linux:
source venv/bin/activate

Windows (PowerShell):
.\venv\Scripts\Activate.ps1

1.4. Install backend dependencies
(uses your requirements.txt)
pip install -r requirements.txt

1.5. Run the FastAPI server
uvicorn api:app --reload --port 8000

If it runs successfully, you should see:
Uvicorn running on http://127.0.0.1:8000

Backend is done.

🔥 2. FRONTEND SETUP (React + Vite)
2.1. Go to frontend folder
cd ../frontend

2.2. Install all dependencies
(uses package.json)
npm install

2.3. Start frontend dev server
npm run dev

You will see something like:
VITE v7.x.x ready
Local: http://localhost:5173/ (or 5174)

🔥 3. TEST CONNECTION BETWEEN FRONTEND & BACKEND

Make sure:
- Backend is running on port 8000
- Frontend is running on 5173 or 5174

Open http://localhost:5173
Upload CSV → Click analyze → Table should render.

🔥 4. OPTIONAL (If backend cannot connect due to CORS)

Edit api.py:

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Run again:
uvicorn api:app --reload
