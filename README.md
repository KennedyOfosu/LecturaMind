# LecturaMind — AI-Powered Teaching Assistant Platform

> **Final Year BSc Project** — Kennedy Ofosu, BSc Information Technology, SIIMT University College, Accra, Ghana, 2026.

LecturaMind is a full-stack web application that serves as an AI-powered Teaching Assistant platform for higher educational institutions. Lecturers upload course materials; students get instant, context-aware answers from an AI chatbot trained on those materials.

---

## Tech Stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Frontend     | React 18 (Vite), TailwindCSS 3                  |
| Backend      | Python 3.10+, Flask, Flask-CORS, Flask-SocketIO |
| Database     | Supabase (PostgreSQL + Storage + Auth)          |
| AI           | OpenAI GPT API (gpt-3.5-turbo)                  |
| Real-time    | Flask-SocketIO + Socket.IO client               |
| File Storage | Supabase Storage Buckets                        |
| Text Extract | pdfplumber (PDF), python-docx (DOCX)            |
| Deployment   | Render (backend) + Vercel (frontend)            |

---

## Features

- 🤖 **AI Chatbot** — Students ask questions; the AI answers using only the uploaded course content
- 📄 **Material Management** — Lecturers upload PDF/DOCX files that are auto-indexed by the AI
- 📢 **Announcements** — Lecturers post course announcements visible to enrolled students
- 📝 **AI Quiz Generator** — AI generates multiple-choice quizzes from course materials
- 👁️ **Live Student Monitor** — Lecturers see who's online in real time (Socket.IO)
- 🎙️ **Live Q&A** — Real-time question-and-answer sessions between lecturer and students
- 💬 **Chat Log Review** — Lecturers review and flag AI conversations per course
- 📊 **Dashboard Analytics** — Queries today, active quizzes, flagged messages at a glance

---

## Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Supabase project (free tier works)
- An OpenAI API key

---

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Open the **SQL Editor** and run all the `CREATE TABLE` statements from `CLAUDE.md` (Database Schema section).
3. Go to **Storage → New Bucket**, create a bucket named `course-materials`, set it to **private**.
4. Note your **Project URL**, **anon key**, and **service role key** from Settings → API.

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # macOS/Linux
venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in:
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_KEY=...
#   OPENAI_API_KEY=...
#   JWT_SECRET=any-long-random-string

# Run the development server
python app.py
```

The backend will start at `http://localhost:5000`.

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and fill in:
#   VITE_API_BASE_URL=http://localhost:5000
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...
#   VITE_SOCKET_URL=http://localhost:5000

# Run the development server
npm run dev
```

The frontend will start at `http://localhost:5173`.

---

### 4. Running Both Servers Together

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend && venv\Scripts\activate && python app.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend && npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## How to Test the AI Chatbot

1. Register a **Lecturer** account and a **Student** account.
2. As the lecturer: create a course, then enrol the student (use their email).
3. As the lecturer: go to Material Uploader, select the course, and upload a PDF or DOCX.
4. As the student: log in, open the course, go to the **AI Chatbot** tab.
5. Ask a question about the content in the uploaded document.

The AI will respond using only the content from the uploaded materials.

---

## Deployment

### Backend (Render)

1. Push the `backend/` folder to a GitHub repo.
2. Create a new **Web Service** on [render.com](https://render.com).
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `gunicorn -k eventlet -w 1 app:app`
5. Add all environment variables from `.env`.

### Frontend (Vercel)

1. Push the `frontend/` folder to a GitHub repo.
2. Import the project into [vercel.com](https://vercel.com).
3. Set framework preset to **Vite**.
4. Add all environment variables from `.env`, updating `VITE_API_BASE_URL` to your Render backend URL.

---

## Screenshots

> _Screenshots to be added after deployment._

---

*Built by Kennedy Ofosu — BSc Information Technology, SIIMT University College, Accra, Ghana, 2026.*
