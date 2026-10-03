# API Specification

## 1. Disasters
- `GET /api/disasters`: List active disasters.
- `GET /api/disasters/{id}`: Get disaster details (affected pop, status).

## 2. Locations & Graph
- `GET /api/locations`: List all nodes (hospitals, warehouses).
- `GET /api/roads`: List all edges (roads) and their statuses.
- `POST /api/roads/{id}/status`: Update road status (OPEN/BLOCKED).

## 3. Resources & Demands
- `GET /api/inventory`: List current supplies at warehouses.
- `GET /api/demands`: List current demands from hospitals.
- `POST /api/demands`: Create a new demand.

## 4. Allocations & Shipments
- `GET /api/allocations`: List current allocations.
- `GET /api/allocations/{id}/explain`: Get explainability data for a specific allocation.
- `POST /api/allocations/recalculate`: Trigger the allocation engine based on current state.
- `GET /api/shipments`: List shipments and their status.
- `POST /api/shipments/{id}/status`: Update shipment state (DISPATCHED, IN TRANSIT, DELIVERED, VERIFIED).

## 5. Audit Ledger
- `GET /api/audit`: List audit records.
- `GET /api/audit/verify`: Returns boolean indicating if the entire hash chain is valid.

## 6. Simulation
- `POST /api/simulation/reset`: Reset database to baseline T+00 state.
- `POST /api/simulation/event`: Trigger a predefined event (e.g., `{"event": "ROAD_BLOCKED", "road_id": "R1"}`).
