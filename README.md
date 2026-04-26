# 🚀 RevenueRadar — AI-Powered Revenue Intelligence Platform

> A full-stack SaaS analytics platform with AI chatbot, revenue forecasting, anomaly detection, and interactive dashboards.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [API Reference](#api-reference)
- [Features](#features)
- [Configuration](#configuration)
- [Deployment](#deployment)

---

## Overview

RevenueRadar helps businesses analyze revenue trends, identify performance drivers, detect anomalies, and generate AI-powered insights. Upload any CSV with revenue data and instantly get:

- 📊 **Interactive KPI Dashboard** — Total revenue, ratings, trends
- 📈 **Revenue Analytics** — By location, cuisine, time period
- 🔍 **Insights Engine** — Correlation analysis, key drivers
- 🤖 **AI Chatbot** — Natural language → SQL → insights
- 📅 **Forecasting** — ML-based revenue projections with confidence intervals
- 🔔 **Alerts** — Auto-detected anomalies and performance warnings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Charts | Recharts |
| Backend | FastAPI (Python) |
| Database | In-memory (Pandas) / BigQuery (production) |
| AI | Anthropic Claude API (optional) / Rule-based fallback |
| Forecasting | Polynomial regression (statsmodels) |
| Deployment | Vercel (frontend) + Cloud Run (backend) |

---

## Project Structure

```
revenueradar/
├── backend/                  # FastAPI Python backend
│   ├── main.py               # App entry point
│   ├── config.py             # Environment config
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container config
│   ├── routers/
│   │   ├── upload.py         # CSV upload & processing
│   │   ├── kpis.py           # KPI & analytics endpoints
│   │   ├── insights.py       # Correlation & driver analysis
│   │   ├── forecasting.py    # Revenue forecasting
│   │   ├── chat.py           # AI chatbot (NL → SQL)
│   │   └── alerts.py         # Anomaly detection
│   └── services/
│       └── datastore.py      # In-memory data store + mock data
│
├── frontend/                 # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Redirects to /dashboard
│   │   ├── globals.css       # Design system & CSS variables
│   │   └── dashboard/
│   │       ├── layout.tsx    # Dashboard layout with sidebar
│   │       ├── page.tsx      # Overview page
│   │       ├── analytics/    # Revenue analytics
│   │       ├── insights/     # Insights & drivers
│   │       ├── forecasting/  # Revenue forecasting
│   │       ├── alerts/       # Alerts & anomalies
│   │       └── chat/         # AI chatbot
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx   # Navigation sidebar
│   │   │   └── Header.tsx    # Page header + filters
│   │   └── ui/
│   │       ├── KPICard.tsx   # Metric cards
│   │       └── UploadSection.tsx  # CSV upload UI
│   └── lib/
│       └── api.ts            # API client functions
│
└── sample_data.csv           # Sample restaurant revenue data
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- Git

### 1. Clone / Extract the project

```bash
cd revenueradar
```

### 2. Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and edit env file (optional)
cp .env.example .env

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

### 3. Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy env file
cp .env.local.example .env.local

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:3000**

### 4. Open the App

Visit **http://localhost:3000** — you'll see the dashboard pre-loaded with mock restaurant data.

**To upload your own data:** Click "Import CSV" in the sidebar or drag & drop a CSV file on the Overview page.

---

## Backend Setup

### Environment Variables (`backend/.env`)

```env
# GCP (optional — only needed for BigQuery)
GCP_PROJECT_ID=your-gcp-project-id
BIGQUERY_DATASET=revenue_radar
BIGQUERY_TABLE=sales_data

# AI Chatbot (optional — enables Claude-powered responses)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Set false to use BigQuery instead of in-memory mock data
USE_MOCK_DATA=true
```

### Running with Docker

```bash
cd backend
docker build -t revenueradar-api .
docker run -p 8000:8000 --env-file .env revenueradar-api
```

---

## Frontend Setup

### Environment Variables (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

For production, set this to your deployed backend URL.

### Build for Production

```bash
cd frontend
npm run build
npm start
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Upload

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload-csv` | Upload a CSV file |

### KPIs & Analytics

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/kpis` | `location`, `cuisine` | KPI summary metrics |
| GET | `/revenue-by-location` | `location`, `cuisine` | Revenue grouped by location |
| GET | `/revenue-by-cuisine` | `location`, `cuisine` | Revenue grouped by cuisine |
| GET | `/revenue-trend` | `location`, `cuisine` | Monthly revenue trend |
| GET | `/top-entities` | `limit`, `location`, `cuisine` | Top performers ranking |
| GET | `/filters/options` | — | Available filter values |

### Insights

| Method | Endpoint | Description |
|---|---|---|
| GET | `/correlation` | Correlation matrix between all numeric features |
| GET | `/drivers` | Top revenue drivers ranked by correlation |
| GET | `/seasonal-patterns` | Monthly seasonal revenue averages |

### Forecasting

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/forecast` | `periods` (default: 6) | Revenue forecast with confidence intervals |

### AI Chatbot

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/chat-query` | `{ message, history }` | Natural language query |

### Alerts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/alerts` | Get auto-detected + custom alerts |
| POST | `/alerts/create` | Create a custom alert |

---

## Features

### 📁 CSV Upload & Processing
- Drag-and-drop or click-to-browse upload
- Auto column name normalization (snake_case)
- Missing value handling
- Date/month column auto-detection
- Revenue column auto-detection

### 📊 KPI Dashboard
- Total revenue, avg rating, avg service quality
- Best performing location and cuisine
- Month-over-month growth
- Revenue trend chart
- Revenue by location (bar chart)
- Revenue by cuisine (pie/donut chart)
- Top restaurants ranking table

### 🔍 Analytics Page
- Tabbed interface: Trend / By Location / By Cuisine / Ranking
- Interactive bar, line, and horizontal bar charts
- Filterable by location and cuisine
- Full ranking table with all metrics

### 💡 Insights Page
- Revenue driver correlation analysis
- Visual impact bars with direction indicators
- Seasonal revenue pattern chart
- Top 3 driver insight cards with plain-English explanations

### 📅 Forecasting Page
- Adjustable forecast horizon (3/6/9/12 months)
- Polynomial regression model
- ±10% confidence interval shading
- Actual vs. forecast combined chart
- Monthly forecast breakdown table

### 🤖 AI Chat Assistant
- Natural language questions answered in plain English
- Rule-based NL→SQL query engine
- Optional Claude AI integration for richer responses
- Data tables returned with results
- SQL query viewer (toggle)
- Confidence score display
- Sample question shortcuts

### 🔔 Alerts & Anomaly Detection
- Statistical anomaly detection (Z-score based)
- Revenue drop/spike alerts
- Underperforming location detection
- Low reservation warnings
- Severity levels (high/medium/low)
- Custom alert creation

---

## Configuration

### Adding BigQuery (Production)

1. Create a GCP project and BigQuery dataset
2. Set `USE_MOCK_DATA=false` in `.env`
3. Set `GCP_PROJECT_ID`, `BIGQUERY_DATASET`, `BIGQUERY_TABLE`
4. Authenticate: `gcloud auth application-default login`
5. The upload endpoint will write to BigQuery, all queries will read from it

### Adding Claude AI

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Set `ANTHROPIC_API_KEY=your-key` in `backend/.env`
3. The chatbot will automatically use Claude for richer, more contextual responses
4. Falls back to rule-based engine if key is not set

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npx vercel deploy
```

Set env variable `NEXT_PUBLIC_API_URL` to your backend URL in Vercel dashboard.

### Backend → GCP Cloud Run

```bash
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT/revenueradar-api
gcloud run deploy revenueradar-api \
  --image gcr.io/YOUR_PROJECT/revenueradar-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="USE_MOCK_DATA=false,GCP_PROJECT_ID=YOUR_PROJECT"
```

---

## Sample Data

A sample CSV (`sample_data.csv`) is included with 30 rows of restaurant revenue data. Upload it to test all features immediately.

**Required columns for best experience:**
- `name` — Entity name
- `location` — Geographic region
- `cuisine` — Category/type
- `rating` — Score (0-5)
- `revenue` — Revenue figure (required)
- `marketing_budget` — Marketing spend
- `service_quality_score` — Quality score
- `weekend_reservations` / `weekday_reservations`
- `month` — Date column (YYYY-MM-DD format)

Any CSV with a `revenue` column will work — the platform auto-detects column types.

---

## License

MIT — free to use and modify.
