# 🏥 ITERYX — Smart Hospital Triage & Bed Management System

> **AI-powered clinical triage + real-time bed orchestration to eliminate wait-time deaths in Indian hospitals.**

---

## 📌 Problem Statement

Current hospital OPD queues follow a **first-come-first-served (FCFS)** model, causing critically ill patients to wait behind mild cases — leading to preventable deterioration and deaths. Bed allocation is a **manual, phone-call-driven process** that causes dangerous delays in emergency admissions, especially when wards are near capacity.

---

## 💡 Solution Overview

ITERYX solves this with three tightly integrated capabilities:

- **🧠 AI Clinical Triage** — An ML model scores patients on arrival using vitals + symptoms, automatically prioritizing critical cases to the top of the doctor's queue.
- **🗺️ Live Bed Map + Predictive Allocation** — A real-time ward-level bed map combined with an ML model that predicts upcoming vacancies, enabling pre-allocation of beds _before_ they are physically free.
- **🔗 Unified OPD-to-IPD Orchestration** — A seamless pipeline from registration → triage → OPD queue → doctor consultation → bed reservation → admission → discharge, all updating in real time via Socket.IO.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PATIENT FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Patient Registration ──► Triage API ──► ML Model 1 ──► OPD Queue  │
│                            (vitals +      (XGBoost      (sorted by  │
│                             symptoms)      scoring)      priority)  │
│                                                                     │
│  Doctor Dashboard ◄──── Socket.IO ◄──── Queue Update Event          │
│       (live queue)     (real-time)      (auto-broadcast)            │
│                                                                     │
│  Doctor admits ──► Bed Pre-Allocate ──► ML Model 2 ──► Bed Reserved │
│    patient          API                 (vacancy        (status =   │
│                                          predictor)     reserved)   │
│                                                                     │
│  Bed Map ◄──────── Socket.IO ◄──────── Bed Status Update Event      │
│  (live grid)       (real-time)         (auto-broadcast)             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer      | Technology                | Purpose                              |
|------------|---------------------------|--------------------------------------|
| Frontend   | Next.js 14 + Tailwind CSS | Dashboard UI                         |
| Backend    | FastAPI (Python)          | REST API + Socket.IO server          |
| Database   | PostgreSQL 15             | Relational data storage              |
| Cache      | Redis 7                   | Real-time bed state + pub/sub        |
| ML         | XGBoost + scikit-learn    | Triage scoring + bed vacancy prediction |
| DevOps     | Docker + docker-compose   | One-command setup                    |

---

## 🚀 Setup Instructions

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/) installed
- Git installed

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Raaghavks/ITERYX.git
cd ITERYX

# 2. Copy environment config
cp .env.example .env

# 3. Build and start all services
docker compose up --build

# 4. Train ML models (first time only)
docker exec iteryx-backend python backend/ml/train_models.py

# 5. Seed sample data (first time only)
docker exec iteryx-backend python backend/seed_data.py

# 6. Open the dashboard
#    → http://localhost:3000
```

> **Note:** Step 3 starts PostgreSQL, Redis, the FastAPI backend, and the Next.js frontend — all in one command.

### Local Run Checklist

If you are not using Docker, make sure all of the following are available before starting the app:

- PostgreSQL 15 running on `localhost:5432`
- Redis 7 running on `localhost:6379`
- Python dependencies installed with `pip install -r backend/requirements.txt`
- Frontend dependencies installed with `npm install` inside `frontend`
- `.env` created from `.env.example`

---

## 👥 Team & Branch Ownership

| Member | Branch                      | Owns                                       |
|--------|-----------------------------|---------------------------------------------|
| M1     | `feature/ml-triage`         | ML models + triage API                      |
| M2     | `feature/backend-beds`      | Beds + admissions API + Socket.IO           |
| M3     | `feature/frontend-opd`      | OPD registration + Doctor queue pages       |
| M4     | `feature/frontend-bedmap`   | Bed map + Admin dashboard pages             |
| M5     | `feature/devops-deploy`     | Docker + seed data + deployment             |
| M6     | `feature/presentation`      | Documentation + presentation deck           |

---

## 🔀 Git Workflow

All team members follow this workflow:

```bash
# 1. Always pull main before starting work
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main

# 2. Work on your branch, commit with clear messages
git add .
git commit -m "feat: triage scoring endpoint working"

# 3. Push and raise a Pull Request on GitHub
git push origin feature/your-branch

# 4. One teammate reviews → approves → merge to main

# 5. Everyone pulls main after each merge
git checkout main
git pull origin main
```

### Commit Message Conventions

| Prefix     | Use When                           |
|------------|------------------------------------|
| `feat:`    | Adding a new feature               |
| `fix:`     | Fixing a bug                       |
| `docs:`    | Documentation changes              |
| `refactor:`| Code restructuring (no new feature)|
| `test:`    | Adding or updating tests           |
| `chore:`   | Build scripts, config, tooling     |

---

## 📄 API Contract

The **[API_CONTRACT.md](./API_CONTRACT.md)** is the single source of truth for all frontend ↔ backend communication. It documents:

- **12 REST endpoints** with full request/response JSON schemas
- **4 Socket.IO events** with payloads and trigger conditions
- Common data models, error formats, and status codes

> ⚠️ Both backend and frontend teams **must** develop against this contract. Any changes require team-wide agreement.

---

## 🎬 Live Demo Script (for Judges)

Follow these 5 steps to demonstrate the full system in under 3 minutes:

### Step 1 — Register a mild case
Register a patient with **mild fever** (temperature: 99.5°F, SpO2: 98%, normal vitals).
→ System assigns **LOW** priority. Patient appears **last** in the doctor's queue.

### Step 2 — Register a critical case (watch the magic)
Register a patient with **SpO2 = 87%** and symptom **"breathing difficulty" (severity 5)**.
→ System auto-calculates **CRITICAL** priority (score ≥ 80).
→ Patient **jumps to #1** in the Doctor Queue — **live update via Socket.IO**.
→ 🚨 Emergency alert fires to all connected dashboards.

### Step 3 — Doctor admits the critical patient
Doctor clicks **"Admit Patient"** → Ward selector opens showing:
- Current bed availability per ward
- **ML-predicted vacancies** for the next 6h / 12h / 24h

### Step 4 — Reserve a bed (watch real-time bed map)
Click **"Reserve Bed"** for ICU →
→ The corresponding bed cell on the **Bed Map turns yellow** (reserved) in real time.
→ All other connected dashboards update simultaneously.

### Step 5 — Admin KPIs update live
Switch to **Admin Dashboard** →
→ Occupancy percentage **increases live**.
→ Available beds count **decreases**.
→ All KPIs reflect the reservation instantly.

---

## 📁 Project Structure

```
ITERYX/
├── backend/               # FastAPI server, ML models, Socket.IO
├── frontend/              # Next.js 14 dashboard
├── docker-compose.yml     # One-command orchestration
├── .env.example           # Environment variable template
├── API_CONTRACT.md        # Frontend ↔ Backend contract
└── README.md              # ← You are here
```

---

## 📜 License

This project is developed as part of an academic hackathon / capstone project.

---

> Built with ❤️ by **Team ITERYX**
