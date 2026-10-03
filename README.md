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

## Screenshots
*(Placeholder for screenshots)*

## Future Scope
- Integration with external APIs (maps, government datasets).
- Advanced mathematical optimization (MILP).
- Full distributed ledger technology.
