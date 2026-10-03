# Technical Design Document

## A. System Architecture

Frontend (React + Vite)
↓
API (FastAPI REST endpoints)
↓
Business Logic (Services)
↓
Allocation Engine (Constraint-based heuristics)
↓
Routing Engine (NetworkX for deterministic graph routing)
↓
Simulation Engine (Event-based simulator)
↓
Database (PostgreSQL / SQLite)
↓
Audit Ledger (SHA-256 hash chaining)

## B. Recommended Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide icons, Leaflet (maps), Recharts.
- **Backend**: Python, FastAPI, Pydantic, SQLAlchemy.
- **Database**: PostgreSQL (SQLite for easy offline hackathon dev).
- **Optimization/Routing**: Python, NetworkX.
- **Audit**: Python hashlib (SHA-256).

## C. Major Modules

- `frontend/`: UI, dashboard, maps, tracking visualization.
- `backend/app/api/`: REST endpoints.
- `backend/app/services/allocation/`: Logic for prioritizing and assigning resources.
- `backend/app/services/routing/`: NetworkX shortest path and edge status management.
- `backend/app/services/simulation/`: Event sequencer for the hackathon demo.
- `backend/app/services/audit/`: Hashing and ledger verification.

## D. Database Schema

Entities to implement:
- `disasters`: id, name, location, status
- `locations`: id, lat, lng, type (hospital, warehouse)
- `resources`: id, name, type
- `inventory`: id, location_id, resource_id, quantity
- `demands`: id, location_id, resource_id, amount, priority, status
- `allocations`: id, demand_id, source_id, resource_id, amount, status
- `routes`: id, source_id, destination_id, path_json, distance, travel_time
- `roads` (Graph Edges): id, node_a, node_b, distance, status (OPEN, BLOCKED)
- `shipments`: id, allocation_id, route_id, status (AVAILABLE, DISPATCHED, IN TRANSIT, DELIVERED, VERIFIED)
- `audit_records`: id, timestamp, actor, event_type, payload, previous_hash, current_hash

## E. API Specification

- `GET /api/dashboard`: Overall KPIs and disaster status.
- `POST /api/simulation/event`: Trigger a simulation event (e.g., road blocked).
- `GET /api/allocations`: List current allocations.
- `GET /api/allocations/{id}/explain`: Get explanation for an allocation decision.
- `POST /api/allocations/recalculate`: Trigger allocation engine.
- `GET /api/routing/{src}/{dest}`: Get current best route.
- `POST /api/shipments/{id}/status`: Update shipment status (creates audit record).
- `GET /api/audit/verify`: Verify the integrity of the hash chain.
