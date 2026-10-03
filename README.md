# Intelligent and Transparent Disaster Relief Resource Allocation

## Overview
A constraint-aware engine that dynamically allocates scarce emergency resources based on changing real-world conditions, providing deterministic explainable allocations and a tamper-evident audit ledger.

## Problem
Static resource allocations fail during disasters when conditions (demand, road status, hospital capacities) change rapidly. Existing solutions lack transparency and adaptability.

## Solution
This platform dynamically computes and reallocates resources based on constraints (supply, demand, road graph). It ensures explainability for every decision and maintains a SHA-256 hash-chained audit ledger for transparency.

## Architecture & Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Leaflet.
- **Backend**: Python, FastAPI.
- **Database**: SQLite (for Hackathon offline mode).
- **Core logic**: NetworkX (routing), custom heuristic scoring (allocation).

## Setup & Running (Local Offline Mode)

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Demo Scenario
1. T+00: Baseline disaster scenario initialized.
2. Demand spike occurs; resources allocated.
3. Primary route blocked (simulated event).
4. System automatically reallocates and finds alternate route.
5. Shipment tracked to delivery.
6. Audit ledger verified.

## AI Operations Assistant

`POST /api/ai/chat` answers questions about live operational state. It always
resolves its facts from the database for the requested city scope (`city` is
`INDIA`/omitted for the national view) — nothing is invented client-side.

The assistant runs in one of two modes, and the response always reports which:

- **ai** — a Gemini Web2API-compatible provider is configured and answered.
- **deterministic** — no provider is configured, or the provider failed. The
  endpoint still returns `200` with a database-derived operational brief
  (`degraded: true`, `source: "deterministic_ops_advisor"`) instead of erroring.

Optional server-side environment variables:

| Variable | Purpose |
| --- | --- |
| `GEMINI_WEB2API_BASE_URL` | Base URL of the OpenAI-compatible provider, e.g. `https://gemini.example.com/v1`. Loopback/placeholder URLs are rejected. |
| `GEMINI_WEB2API_API_KEY` | Provider bearer token. Never sent to the browser. |
| `GEMINI_WEB2API_MODEL` | Model id; defaults to `gemini-2.0-flash`. |

Set them in the Render dashboard for the `dj` service (`render.yaml` declares
them with `sync: false`, so blueprint updates never overwrite your values).
`GET /api/ai/status` reports the current mode without calling the provider, and
the UI header shows `READY — <model>` or `DEGRADED — DATA ADVISOR`.

## Deployment

The image built from `Dockerfile` is **single-service**: FastAPI serves `/api/*`
and the compiled Vite bundle from the same origin. That means one URL, no CORS
setup, and no `VITE_API_URL` to configure by hand.

### Docker (local or any container host)
```bash
docker build -t dj .
docker run -p 8000:8000 dj          # http://localhost:8000
```
Or with Compose (adds a named volume so the SQLite file survives rebuilds):
```bash
docker compose up --build
```

### Render
Push the repo, then on Render: **New → Blueprint** and select this repository.
`render.yaml` is auto-detected and provisions the single Docker service with
`autoDeploy: true`.

If you specifically want the React app on a Render static site and the API on a
separate Python service, use `render-split.yaml` instead. That layout derives
the API host from the backend service at build time, so there is still no manual
env-var step.

### Other hosts
Any platform that runs a container and respects `PORT` works unchanged. For a
split frontend/backend deploy on a platform that does not shell out during the
build, set `VITE_API_URL` to the public API base (ending in `/api`) before the
frontend build — it is a build-time constant, not a runtime one.

## Screenshots
*(Placeholder for screenshots)*

## Future Scope
- Integration with external APIs (maps, government datasets).
- Advanced mathematical optimization (MILP).
- Full distributed ledger technology.
