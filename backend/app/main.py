from typing import List, Optional

import json
import os

import httpx

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models, schemas
from .database.cities import CITY_SCENARIOS, INDIA_CENTER, OPERATIONAL_CITIES, RESOURCE_CATALOG
from .database.seed import seed_db
from .db import SessionLocal, engine
from .services.allocation.engine import create_audit_record, run_allocation, trigger_reallocation
from .services.gemini.client import gemini_chat, gemini_config_status
from .services.ops_advisor import build_ops_snapshot, deterministic_reply, format_snapshot_for_prompt
from .services.routing.engine import find_alternate_routes
from .services.simulation.engine import process_event, reset_simulation

# ============================================================
# DATABASE INITIALIZATION
# ============================================================

models.Base.metadata.create_all(bind=engine)

# Baseline synthetic demo dataset (versioned, idempotent, audit ledger preserved)
seed_db()

# ============================================================
# STATIC FRONTEND DETECTION
# Opt-in via SERVE_FRONTEND so a local Vite build in frontend/dist never
# shadows the dev server, and the API stays JSON-only for tests. Single-image
# container deploys set SERVE_FRONTEND=1; then "/" returns the app instead of
# the API welcome payload.
# ============================================================

SERVE_FRONTEND = os.environ.get("SERVE_FRONTEND", "").strip().lower() in {"1", "true", "yes", "on"}

_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "dist"
# Docker layout: /app/frontend/dist copied to /app/frontend/dist
_DOCKER_DIST = Path("/app/frontend/dist")
STATIC_DIR = _DOCKER_DIST if _DOCKER_DIST.exists() else _FRONTEND_DIST
INDEX_HTML = STATIC_DIR / "index.html" if SERVE_FRONTEND and STATIC_DIR.is_dir() else None
if INDEX_HTML is not None and not INDEX_HTML.is_file():
    INDEX_HTML = None


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Disaster Relief Allocation API"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# ============================================================
# CITY SCOPING HELPERS
# ============================================================

ACTIVE_DEMAND_STATUSES = ["OPEN", "PARTIAL"]
ACTIVE_ALLOCATION_STATUSES = ["AVAILABLE", "ALLOCATED", "DISPATCHED", "IN_TRANSIT"]
LIVE_INCIDENT_STATUSES = ["ACTIVE", "MONITORING"]

ALLOCATION_LIFECYCLE = ["AVAILABLE", "ALLOCATED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "VERIFIED"]
ROAD_STATUSES = ["OPEN", "BLOCKED"]


def resolve_city(city: Optional[str]) -> Optional[str]:
    """Validate the ?city= selector. None means the national (INDIA) view."""
    if city is None:
        return None
    key = city.strip()
    if key.upper() in ("", "INDIA", "ALL"):
        return None
    if key not in OPERATIONAL_CITIES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown operational city '{city}'. Valid: {', '.join(sorted(OPERATIONAL_CITIES))}"
        )
    return key


def city_location_ids(db: Session, city: Optional[str]) -> Optional[List[str]]:
    if not city:
        return None
    return [r[0] for r in db.query(models.Location.id).filter(models.Location.city == city).all()]


def blocked_id(db: Session, city: str) -> Optional[str]:
    row = (
        db.query(models.Road.id)
        .filter(models.Road.city == city, models.Road.status == "BLOCKED")
        .first()
    )
    return row[0] if row else None


def scoped_demands_query(db: Session, loc_ids: Optional[List[str]]):
    q = db.query(models.Demand)
    if loc_ids is not None:
        q = q.filter(models.Demand.location_id.in_(loc_ids))
    return q


def scoped_allocations_query(db: Session, loc_ids: Optional[List[str]]):
    from sqlalchemy import or_ as _or
    q = db.query(models.Allocation)
    if loc_ids is not None:
        demand_ids = [
            r[0] for r in scoped_demands_query(db, loc_ids).with_entities(models.Demand.id).all()
        ]
        clauses = []
        if loc_ids:
            clauses.append(models.Allocation.source_id.in_(loc_ids))
        if demand_ids:
            clauses.append(models.Allocation.demand_id.in_(demand_ids))
        if clauses:
            q = q.filter(_or(*clauses))
        else:
            q = q.filter(models.Allocation.id == None)  # type: ignore
    return q


# ============================================================
# AI OPERATIONS ASSISTANT
# Behaviour: when the Gemini Web2API provider is configured the request is
# answered by the model, grounded with a live database snapshot. When the
# provider is unconfigured or errors, the endpoint degrades to the same
# deterministic, database-derived advisor instead of failing, and the response
# is flagged with source/degraded metadata so the UI never presents generated
# fallback text as an LLM answer.
# ============================================================

class GeminiRequest(BaseModel):
    message: str
    city: Optional[str] = None


def _describe_provider_error(exc: Exception) -> str:
    name = type(exc).__name__
    detail = str(exc).strip()
    if isinstance(exc, httpx.TimeoutException):
        return f"{name}: AI provider timed out"
    return f"{name}: {detail}" if detail else name


def _ai_snapshot_facts(snap: dict) -> dict:
    return {
        "live_incidents": len(snap["live_incidents"]),
        "open_demands": len(snap["open_demands"]),
        "critical_demands": len(snap["critical_demands"]),
        "blocked_roads": len(snap["blocked_roads"]),
        "shortages": len(snap["shortages"]),
        "stale_allocations": len(snap["stale_allocs"]),
        "at_risk_allocations": len(snap["at_risk_allocs"]),
        "affected_population": snap["total_affected"],
    }


def _ai_missing_env(cfg: dict) -> List[str]:
    return [
        name
        for name, ok in (
            ("GEMINI_WEB2API_BASE_URL", cfg["base_url_set"]),
            ("GEMINI_WEB2API_API_KEY", cfg["api_key_set"]),
        )
        if not ok
    ]


@app.get("/api/ai/status")
def ai_status(city: Optional[str] = Query(None)):
    """Report whether the LLM provider is usable, without calling it."""
    cfg = gemini_config_status()
    return {
        "scope": resolve_city(city) or "INDIA",
        "provider": "gemini-web2api",
        "model": cfg["model"],
        "configured": cfg["configured"],
        "base_url_set": cfg["base_url_set"],
        "api_key_set": cfg["api_key_set"],
        "degraded": not cfg["configured"],
        "mode": "ai" if cfg["configured"] else "deterministic",
        "missing_env": _ai_missing_env(cfg),
    }


@app.post("/api/ai/chat")
async def ai_chat(request: GeminiRequest, db: Session = Depends(get_db)):
    message = (request.message or "").strip()
    if not message:
        raise HTTPException(status_code=422, detail="Question must not be empty.")

    city = resolve_city(request.city)
    snap = build_ops_snapshot(db, city)
    facts = _ai_snapshot_facts(snap)
    scope = snap["scope"]
    deterministic_text = deterministic_reply(message, snap)

    cfg = gemini_config_status()
    if not cfg["configured"]:
        return {
            "success": True,
            "degraded": True,
            "source": "deterministic_ops_advisor",
            "model": None,
            "scope": scope,
            "reason": (
                "AI provider not configured. Answer computed directly from live "
                "operational records."
            ),
            "missing_env": _ai_missing_env(cfg),
            "facts": facts,
            "reply": deterministic_text,
        }

    prompt = (
        "You are the operations assistant for a disaster relief coordination "
        "platform. Answer using ONLY the operational snapshot below. Never "
        "invent locations, resources, quantities, or incidents. If the snapshot "
        "does not contain the answer, say what data is missing.\n\n"
        f"LIVE OPERATIONAL SNAPSHOT ({scope}):\n{format_snapshot_for_prompt(snap)}\n\n"
        f"QUESTION: {message}\n\n"
        "Give a short, precise operational answer with concrete next actions."
    )

    try:
        reply = await gemini_chat(prompt)
        provider_error = None
    except Exception as exc:  # provider/network failure -> deterministic fallback
        reply = deterministic_text
        provider_error = _describe_provider_error(exc)[:300]

    return {
        "success": True,
        "degraded": provider_error is not None,
        "source": "deterministic_ops_advisor" if provider_error else "gemini",
        "model": cfg["model"] if provider_error is None else None,
        "scope": scope,
        "reason": (
            f"AI provider unreachable ({provider_error}). Answer computed "
            "directly from live operational records."
            if provider_error
            else None
        ),
        "facts": facts,
        "reply": reply,
    }


# ============================================================
# CITIES (operational regions — synthetic demo)
# ============================================================

@app.get("/api/cities")
def get_cities():
    return {
        "india_center": INDIA_CENTER,
        "cities": {
            name: {
                "state": v["state"],
                "lat": v["lat"],
                "lng": v["lng"],
                "population": v["population"],
            }
            for name, v in OPERATIONAL_CITIES.items()
        },
        "resources": [
            {"id": rid, "name": name, "category": cat} for rid, name, cat in RESOURCE_CATALOG
        ],
    }


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def read_root():

    # Single-image deploys open this URL in a browser, so hand back the app.
    # API-only mode (no Vite build) keeps the JSON welcome payload.
    if INDEX_HTML is not None:
        return FileResponse(str(INDEX_HTML))

    return {
        "message": "Welcome to the Disaster Relief Resource Allocation API"
    }


# ============================================================
# DASHBOARD
# ============================================================

@app.get("/api/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    loc_ids = city_location_ids(db, city)

    # --- Incidents ---
    inc_q = db.query(models.Incident)
    if loc_ids is not None:
        inc_q = inc_q.filter(
            (models.Incident.city == city)
            | (models.Incident.location_id.in_(loc_ids))
        )
    live_incidents = inc_q.filter(models.Incident.status.in_(LIVE_INCIDENT_STATUSES)).all()

    affected_pop = sum(i.affected_population or 0 for i in live_incidents)
    active_incidents = len([i for i in live_incidents if i.status == "ACTIVE"])
    critical_cases = len([i for i in live_incidents if (i.severity or 0) >= 4])
    total_incidents = inc_q.count()

    # --- Demands ---
    demand_q = scoped_demands_query(db, loc_ids)
    unmet_q = demand_q.filter(models.Demand.status.in_(ACTIVE_DEMAND_STATUSES))

    active_emergencies = unmet_q.count()
    pending_demand = (
        unmet_q.with_entities(func.coalesce(func.sum(models.Demand.quantity), 0)).scalar()
    )
    critical_demands = unmet_q.filter(models.Demand.severity >= 4).count()

    # --- Allocations ---
    alloc_q = scoped_allocations_query(db, loc_ids)
    active_allocations = alloc_q.filter(
        models.Allocation.status.in_(ACTIVE_ALLOCATION_STATUSES)
    ).count()
    delivered_allocations = alloc_q.filter(
        models.Allocation.status.in_(["DELIVERED", "VERIFIED"])
    ).count()
    total_allocations = alloc_q.count()

    # --- Inventory ---
    inv_q = db.query(models.Inventory)
    if loc_ids is not None:
        inv_q = inv_q.filter(models.Inventory.location_id.in_(loc_ids))
    resources_available = (
        inv_q.with_entities(func.coalesce(func.sum(models.Inventory.quantity), 0)).scalar()
    )

    # --- Network ---
    loc_q = db.query(models.Location)
    if city:
        loc_q = loc_q.filter(models.Location.city == city)
    total_locations = loc_q.count()

    road_q = db.query(models.Road)
    if loc_ids is not None:
        road_q = road_q.filter(
            models.Road.source_id.in_(loc_ids) | models.Road.target_id.in_(loc_ids)
        )
    total_roads = road_q.count()
    blocked_roads = road_q.filter(models.Road.status == "BLOCKED").count()

    return {
        "city": city or "INDIA",
        "affected_population": int(affected_pop),
        "active_incidents": active_incidents,
        "total_incidents": total_incidents,
        "critical_cases": critical_cases,
        "critical_demands": critical_demands,
        "active_allocations": active_allocations,
        "delivered_allocations": delivered_allocations,
        "total_allocations": total_allocations,
        "active_emergencies": active_emergencies,
        "resources_available": int(resources_available),
        "pending_demand": int(pending_demand),
        "total_locations": total_locations,
        "total_roads": total_roads,
        "blocked_roads": blocked_roads,
    }


# ============================================================
# LOCATIONS
# ============================================================

@app.get(
    "/api/locations",
    response_model=List[schemas.Location]
)
def get_locations(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    q = db.query(models.Location)
    if city:
        q = q.filter(models.Location.city == city)
    return q.order_by(models.Location.city, models.Location.id).all()


# ============================================================
# ROADS
# ============================================================

@app.get(
    "/api/roads",
    response_model=List[schemas.Road]
)
def get_roads(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    loc_ids = city_location_ids(db, city)
    q = db.query(models.Road)
    if loc_ids is not None:
        q = q.filter(
            models.Road.source_id.in_(loc_ids) | models.Road.target_id.in_(loc_ids)
        )
    return q.order_by(models.Road.city, models.Road.id).all()


@app.post("/api/roads/{road_id}/status")
def update_road_status(
    road_id: str,
    status: str = Query(...),
    db: Session = Depends(get_db)
):

    status = status.strip().upper()
    if status not in ROAD_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid road status '{status}'. Valid: {', '.join(ROAD_STATUSES)}",
        )

    road = (
        db.query(models.Road)
        .filter(models.Road.id == road_id)
        .first()
    )

    if not road:

        raise HTTPException(
            status_code=404,
            detail="Road not found"
        )

    previous = road.status
    road.status = status

    db.commit()

    create_audit_record(
        db,
        "Admin",
        "ROAD_STATUS_CHANGED",
        {
            "road_id": road_id,
            "from": previous,
            "status": status,
            "city": road.city,
        },
        city=road.city,
    )

    # Reallocate within the affected sector only
    reallocated = 0
    if previous != status:
        reallocated = trigger_reallocation(db, city=road.city) if status == "BLOCKED" \
            else run_allocation(db, city=road.city)

    return {
        "message": f"Road {road_id} set to {status}",
        "city": road.city,
        "reallocated": reallocated,
    }


# ============================================================
# DEMANDS
# ============================================================

@app.get(
    "/api/demands",
    response_model=List[schemas.Demand]
)
def get_demands(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    loc_ids = city_location_ids(db, city)
    q = scoped_demands_query(db, loc_ids)
    return q.order_by(
        models.Demand.status.desc(), models.Demand.severity.desc(), models.Demand.id
    ).all()


# ============================================================
# INCIDENTS
# ============================================================

@app.get(
    "/api/incidents",
    response_model=List[schemas.Incident]
)
def get_incidents(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    loc_ids = city_location_ids(db, city)
    q = db.query(models.Incident)
    if loc_ids is not None:
        q = q.filter(
            (models.Incident.city == city)
            | (models.Incident.location_id.in_(loc_ids))
        )
    return q.order_by(
        models.Incident.city, models.Incident.status, models.Incident.severity.desc()
    ).all()


# ============================================================
# RESOURCES + INVENTORY (read-only; no logic changes)
# ============================================================

@app.get(
    "/api/resources",
    response_model=List[schemas.Resource]
)
def get_resources(
    db: Session = Depends(get_db)
):

    return (
        db.query(models.Resource)
        .order_by(models.Resource.id)
        .all()
    )


@app.get(
    "/api/inventory",
    response_model=List[schemas.Inventory]
)
def get_inventory(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    loc_ids = city_location_ids(db, city)
    q = db.query(models.Inventory)
    if loc_ids is not None:
        q = q.filter(models.Inventory.location_id.in_(loc_ids))
    return q.order_by(models.Inventory.location_id, models.Inventory.resource_id).all()


# ============================================================
# ALLOCATIONS
# ============================================================

@app.get(
    "/api/allocations",
    response_model=List[schemas.Allocation]
)
def get_allocations(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    loc_ids = city_location_ids(db, city)
    q = scoped_allocations_query(db, loc_ids)
    return q.order_by(models.Allocation.city, models.Allocation.dispatched_at.desc()).all()


@app.post("/api/allocations/run")
def api_run_allocations(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):

    city = resolve_city(city)
    allocs = run_allocation(db, city=city)

    return {
        "message": f"Created {allocs} new allocations",
        "city": city or "INDIA",
        "allocations_created": allocs,
    }


@app.get("/api/allocations/{alloc_id}/routes")
def get_allocation_routes(
    alloc_id: str,
    db: Session = Depends(get_db)
):
    """Primary corridor actually used by a dispatch plus genuinely different
    fallback corridors, so the map never labels the same path as an alternate."""

    alloc = (
        db.query(models.Allocation)
        .filter(models.Allocation.id == alloc_id)
        .first()
    )
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")

    demand = db.query(models.Demand).filter(models.Demand.id == alloc.demand_id).first()
    target_id = demand.location_id if demand else None
    if not target_id:
        raise HTTPException(status_code=409, detail="Allocation has no resolvable destination")

    primary = json.loads(alloc.route_path or "[]")
    candidates = find_alternate_routes(db, alloc.source_id, target_id, city=alloc.city, limit=5)

    alternates = [
        {
            "path_edges": route["path_edges"],
            "travel_time": route["travel_time"],
        }
        for route in candidates
        if route["path_edges"] != primary
    ][:2]

    return {
        "allocation_id": alloc.id,
        "city": alloc.city,
        "source_id": alloc.source_id,
        "destination_id": target_id,
        "primary": {"path_edges": primary},
        "alternates": alternates,
    }


@app.post(
    "/api/allocations/{alloc_id}/status"
)
def update_allocation_status(
    alloc_id: str,
    status: str = Query(...),
    db: Session = Depends(get_db)
):

    status = status.strip().upper()
    if status not in ALLOCATION_LIFECYCLE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid allocation status '{status}'. "
                f"Valid: {', '.join(ALLOCATION_LIFECYCLE)}"
            ),
        )

    alloc = (
        db.query(models.Allocation)
        .filter(models.Allocation.id == alloc_id)
        .first()
    )

    if not alloc:

        raise HTTPException(
            status_code=404,
            detail="Allocation not found"
        )

    previous = alloc.status
    if previous in ("DELIVERED", "VERIFIED"):
        raise HTTPException(
            status_code=409,
            detail=f"Allocation already closed at status {previous}",
        )
    if status in ("DISPATCHED", "IN_TRANSIT") and alloc.dispatched_at is None:
        import datetime as _dt
        alloc.dispatched_at = _dt.datetime.utcnow()

    alloc.status = status

    db.commit()

    create_audit_record(
        db,
        "Logistics",
        f"ALLOCATION_STATUS_{status}",
        {
            "allocation_id": alloc_id,
            "from": previous,
            "to": status,
            "city": alloc.city,
        },
        city=alloc.city,
    )

    return {
        "message": f"Status updated to {status}",
        "city": alloc.city,
    }


# ============================================================
# FUNDS
# ============================================================

@app.get("/api/funds")
def get_funds(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    q = db.query(models.Fund)
    if city:
        q = q.filter(models.Fund.city == city)
    rows = q.order_by(models.Fund.city.is_(None), models.Fund.id).all()
    return [
        {
            "id": f.id,
            "category": f.category,
            "total_amount": f.total_amount,
            "allocated_amount": f.allocated_amount,
            "city": f.city,
        }
        for f in rows
    ]


# ============================================================
# AUDIT
# ============================================================

@app.get(
    "/api/audit",
    response_model=List[schemas.AuditRecord]
)
def get_audit(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    city = resolve_city(city)
    q = db.query(models.AuditRecord)
    if city:
        q = q.filter(models.AuditRecord.city == city)
    return q.order_by(models.AuditRecord.timestamp.desc()).all()


@app.get("/api/audit/verify")
def verify_audit(
    db: Session = Depends(get_db)
):

    import hashlib

    records = (
        db.query(models.AuditRecord)
        .order_by(models.AuditRecord.timestamp.asc())
        .all()
    )

    prev_hash = "0" * 64

    valid = True

    for r in records:

        if r.previous_hash != prev_hash:

            valid = False
            break

        data_str = (
            r.payload +
            prev_hash
        )

        calc_hash = hashlib.sha256(
            data_str.encode()
        ).hexdigest()

        if r.current_hash != calc_hash:
            valid = False
            break

        prev_hash = r.current_hash

    return {
        "valid": valid,
        "total_records": len(records)
    }


# ============================================================
# SIMULATION
# ============================================================

@app.post("/api/simulation/event")
def run_simulation_event(
    event_type: str = Query(...),
    city: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    city = resolve_city(city)
    return process_event(event_type.strip().upper(), db, city=city)


@app.post("/api/simulation/reset")
def run_simulation_reset(
    db: Session = Depends(get_db)
):
    return reset_simulation(db)


@app.get("/api/scenario/blueprint")
def get_scenario_blueprint(
    db: Session = Depends(get_db),
    city: Optional[str] = Query(None),
):
    """Per-city incident/demand composition, used to confirm the selector is
    backed by real differentiated data."""
    city = resolve_city(city)
    cities = [city] if city else sorted(OPERATIONAL_CITIES.keys())
    out = {}
    for c in cities:
        incidents = db.query(models.Incident).filter(models.Incident.city == c).all()
        demands = scoped_demands_query(db, city_location_ids(db, c)).all()
        out[c] = {
            "state": OPERATIONAL_CITIES[c]["state"],
            "population": OPERATIONAL_CITIES[c]["population"],
            "incidents": len(incidents),
            "live_incidents": len([i for i in incidents if i.status in LIVE_INCIDENT_STATUSES]),
            "affected_population": sum(
                i.affected_population or 0 for i in incidents if i.status in LIVE_INCIDENT_STATUSES
            ),
            "demands": len(demands),
            "open_demands": len([d for d in demands if d.status in ACTIVE_DEMAND_STATUSES]),
            "critical_demands": len(
                [d for d in demands if d.status in ACTIVE_DEMAND_STATUSES and (d.severity or 0) >= 4]
            ),
            "pending_units": sum(
                d.quantity for d in demands if d.status in ACTIVE_DEMAND_STATUSES
            ),
            "scenario": {
                "blocked_corridor": CITY_SCENARIOS[c].get("blocked_road"),
                "blocked_corridor_id": blocked_id(db, c),
                "declared_incidents": len(CITY_SCENARIOS[c]["incidents"]),
                "declared_demands": len(CITY_SCENARIOS[c]["demands"]),
            },
        }
    return out


# ============================================================
# STATIC FRONTEND (for single-image Docker deploy)
# Registered last so every /api/* route above keeps priority. "/" is handled by
# read_root; this catch-all covers hashed assets, public files and deep links.
# ============================================================

if INDEX_HTML is not None:
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Let /api/* and /docs etc. fall through to FastAPI's own routes
        if full_path.startswith("api/") or full_path in ("docs", "openapi.json", "redoc"):
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        # SPA fallback: any unknown non-API path renders the client router
        return FileResponse(str(INDEX_HTML))
