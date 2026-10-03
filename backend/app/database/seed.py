"""Baseline dataset for the India disaster response command center.

All rows written here are SYNTHETIC DEMO DATA.

The seeder is versioned: bumping ``SEED_VERSION`` rebuilds the operational demo
rows (locations, corridors, stock, incidents, demands, baseline dispatches) so a
database left behind by an older dataset is upgraded to a coherent baseline.

The audit ledger is never rebuilt or truncated — audit records are appended to,
so the SHA-256 chain stays verifiable across reseeds.
"""

import datetime
import json
import uuid

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .. import models
from ..db import engine, SessionLocal
from ..services.allocation.engine import create_audit_record
from ..services.routing.engine import find_best_route
from .cities import CITY_LAYOUT, CITY_SCENARIOS, INDIA_CENTER, OPERATIONAL_CITIES, RESOURCE_CATALOG

SEED_VERSION = "4"

# The original Mumbai layout keeps its historical short IDs so existing backend
# fixtures stay valid; every other city is namespaced with a stable prefix.
_CITY_PREFIX = {city: f"C{i + 1:02d}" for i, city in enumerate(sorted(OPERATIONAL_CITIES))}

# Columns are backfilled automatically by comparing the model metadata against
# the live schema (see ensure_schema), so adding a column to models.py is enough
# to upgrade an existing SQLite file.
_DDL_TYPES = {
    "INTEGER": "INTEGER",
    "BIGINT": "INTEGER",
    "SMALLINT": "INTEGER",
    "FLOAT": "FLOAT",
    "NUMERIC": "FLOAT",
    "BOOLEAN": "BOOLEAN",
    "DATETIME": "DATETIME",
    "DATE": "DATETIME",
    "TIME": "TEXT",
    "TEXT": "VARCHAR",
    "VARCHAR": "VARCHAR",
    "JSON": "TEXT",
}

# Dispatch lifecycle used for baseline history, in per-city rotation so tracking
# views differ between sectors instead of every city showing one AVAILABLE row.
_LIFECYCLE_ROTATION = ["IN_TRANSIT", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "VERIFIED", "IN_TRANSIT"]


def _pid(city: str, node_id: str) -> str:
    return node_id if city == "Mumbai" else f"{_CITY_PREFIX[city]}-{node_id}"


def _rid(city: str, node_id: str) -> str:
    return node_id if city == "Mumbai" else f"{_CITY_PREFIX[city]}-{node_id}"


# ============================================================
# SCHEMA
# ============================================================

def ensure_schema() -> None:
    """Create missing tables and backfill any column declared in models.py but
    absent from an older SQLite file."""
    models.Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, table in models.Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table_name)}
        for column in table.columns:
            if column.name in present:
                continue
            try:
                ddl = _DDL_TYPES.get(column.type.__class__.__name__.upper(), "VARCHAR")
            except AttributeError:
                ddl = "VARCHAR"
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column.name} {ddl}"))


def _current_version(db: Session) -> str:
    row = db.query(models.SeedMeta).filter_by(key="version").first()
    return row.value if row else "0"


def _inflight_slots(rotation_index: int) -> int:
    """How many baseline dispatches a city keeps in flight.

    Rotating 1-3 keeps the tracking view and the ACTIVE ALLOCATIONS KPI
    genuinely different per sector instead of every city reporting one line.
    """
    return 1 + (rotation_index % 3)


def _expected_demo_ids() -> dict:
    """Every identifier this seeder owns.

    Purging keys off these ids as well as the city tag, because rows written
    before Location.city existed still carry a NULL city after the column is
    backfilled and would otherwise survive a rebuild.
    """
    location_ids, road_ids, demand_ids, incident_ids, fund_ids = set(), set(), set(), set(), set()
    for city, layout in CITY_LAYOUT.items():
        scenario = CITY_SCENARIOS[city]
        location_ids.update(_pid(city, n) for n in layout["offsets"])
        road_ids.update(_rid(city, r[0]) for r in layout["roads"])
        demand_ids.update(_rid(city, f"DEM-{i}") for i in range(1, len(scenario["demands"]) + 1))
        incident_ids.update(_rid(city, f"INC-{i}") for i in range(1, len(scenario["incidents"]) + 1))
        fund_ids.add(f"FUND-{_CITY_PREFIX[city]}")
    return {
        "location": location_ids,
        "road": road_ids,
        "demand": demand_ids,
        "incident": incident_ids,
        "fund": fund_ids,
    }


def _purge_demo_rows(db: Session) -> None:
    """Remove operational demo rows for the configured cities.

    audit_records and seed_meta are intentionally untouched, so the SHA-256
    chain stays verifiable across reseeds.
    """
    ids = _expected_demo_ids()
    cities = list(OPERATIONAL_CITIES)

    loc_ids = set(ids["location"])
    loc_ids.update(
        r[0]
        for r in db.query(models.Location.id).filter(models.Location.city.in_(cities)).all()
    )

    demand_ids = set(ids["demand"])
    demand_ids.update(
        r[0]
        for r in db.query(models.Demand.id).filter(models.Demand.location_id.in_(loc_ids)).all()
    )

    if loc_ids:
        alloc_filter = models.Allocation.source_id.in_(loc_ids)
        if demand_ids:
            alloc_filter = alloc_filter | models.Allocation.demand_id.in_(demand_ids)
        db.query(models.Allocation).filter(alloc_filter).delete(synchronize_session=False)

    db.query(models.Demand).filter(models.Demand.id.in_(demand_ids)).delete(
        synchronize_session=False
    )
    if loc_ids:
        db.query(models.Inventory).filter(models.Inventory.location_id.in_(loc_ids)).delete(
            synchronize_session=False
        )
        db.query(models.Road).filter(
            (models.Road.source_id.in_(loc_ids)) | (models.Road.target_id.in_(loc_ids))
        ).delete(synchronize_session=False)
        db.query(models.Incident).filter(models.Incident.location_id.in_(loc_ids)).delete(
            synchronize_session=False
        )
        db.query(models.Location).filter(models.Location.id.in_(loc_ids)).delete(
            synchronize_session=False
        )

    if ids["road"]:
        db.query(models.Road).filter(models.Road.id.in_(ids["road"])).delete(
            synchronize_session=False
        )
    if ids["incident"]:
        db.query(models.Incident).filter(models.Incident.id.in_(ids["incident"])).delete(
            synchronize_session=False
        )

    # Tag-based sweep catches any leftovers for the configured cities.
    db.query(models.Incident).filter(models.Incident.city.in_(cities)).delete(
        synchronize_session=False
    )
    db.query(models.Road).filter(models.Road.city.in_(cities)).delete(synchronize_session=False)
    db.query(models.Demand).filter(models.Demand.city.in_(cities)).delete(synchronize_session=False)
    db.query(models.Allocation).filter(models.Allocation.city.in_(cities)).delete(
        synchronize_session=False
    )
    db.query(models.Location).filter(models.Location.city.in_(cities)).delete(
        synchronize_session=False
    )
    db.query(models.Fund).filter(
        (models.Fund.city.in_(cities)) | (models.Fund.id.in_(ids["fund"]))
    ).delete(synchronize_session=False)

    db.commit()


# ============================================================
# CITY SEEDING
# ============================================================

def _seed_resources(db: Session) -> None:
    for res_id, name, category in RESOURCE_CATALOG:
        if not db.query(models.Resource).filter_by(id=res_id).first():
            db.add(models.Resource(id=res_id, name=name, category=category))


def _seed_city(db: Session, city: str, rotation_index: int) -> int:
    cfg = OPERATIONAL_CITIES[city]
    layout = CITY_LAYOUT[city]
    scenario = CITY_SCENARIOS[city]
    created = 0

    # ---- Locations ----
    for node_id, (dlat, dlng, base_name, loc_type, capacity) in layout["offsets"].items():
        db.add(models.Location(
            id=_pid(city, node_id),
            name=f"{base_name} ({city})",
            type=loc_type,
            lat=round(cfg["lat"] + dlat, 4),
            lng=round(cfg["lng"] + dlng, 4),
            capacity=capacity,
            city=city,
            state=cfg["state"],
        ))
        created += 1
    db.flush()

    # ---- Corridors ----
    for node_id, src, tgt, dist, travel, status in layout["roads"]:
        final_status = "BLOCKED" if node_id == scenario.get("blocked_road") else status
        db.add(models.Road(
            id=_rid(city, node_id),
            source_id=_pid(city, src),
            target_id=_pid(city, tgt),
            distance=dist,
            travel_time=travel,
            status=final_status,
            city=city,
        ))
        created += 1
    db.flush()

    # ---- Incidents ----
    incident_ids: list[str] = []
    for idx, inc in enumerate(scenario["incidents"], start=1):
        inc_id = _rid(city, f"INC-{idx}")
        incident_ids.append(inc_id)
        db.add(models.Incident(
            id=inc_id,
            city=city,
            state=cfg["state"],
            title=inc["title"],
            category=inc["category"],
            severity=inc["severity"],
            status=inc["status"],
            affected_population=inc["affected_population"],
            location_id=_pid(city, inc["node"]),
            resource_id=inc["resource"],
            opened_at=datetime.datetime.utcnow() - datetime.timedelta(days=idx),
        ))
        created += 1
    db.flush()

    # ---- Stock (gross quantities, before baseline dispatch commitments) ----
    for node_id, res_id, qty in scenario["stock"]:
        db.add(models.Inventory(
            id=str(uuid.uuid4()),
            location_id=_pid(city, node_id),
            resource_id=res_id,
            quantity=qty,
        ))
        created += 1
    db.flush()

    # ---- Demands ----
    for idx, dmd in enumerate(scenario["demands"], start=1):
        node_id = dmd["node"]
        # Link the request to the live incident driving it when one exists there.
        linked = next(
            (inc["resource"] for inc in scenario["incidents"]
             if inc["node"] == node_id and inc["resource"] == dmd["resource"]),
            None,
        )
        inc_id = None
        if linked:
            inc_idx = next(
                i for i, inc in enumerate(scenario["incidents"], start=1)
                if inc["node"] == node_id and inc["resource"] == dmd["resource"]
            )
            inc_id = _rid(city, f"INC-{inc_idx}")

        db.add(models.Demand(
            id=_rid(city, f"DEM-{idx}"),
            location_id=_pid(city, node_id),
            resource_id=dmd["resource"],
            quantity=dmd["quantity"],
            severity=dmd["severity"],
            status="OPEN",
            city=city,
            incident_id=inc_id,
        ))
        created += 1
    db.flush()

    # ---- Baseline dispatch history ----
    # Each pre-existing dispatch is committed through the real routing engine so
    # route_path matches the live corridor network, then stock and demand state
    # are normalised from the dispatches that were actually created.
    inflight_slots = _inflight_slots(rotation_index)
    inflight_seen = 0
    for idx, dmd in enumerate(scenario["demands"], start=1):
        prealloc = dmd.get("prealloc")
        if not prealloc:
            continue

        demand = db.query(models.Demand).filter_by(id=_rid(city, f"DEM-{idx}")).first()
        source_id = _pid(city, prealloc["source"])
        inv = (
            db.query(models.Inventory)
            .filter_by(location_id=source_id, resource_id=dmd["resource"])
            .first()
        )
        if not demand or not inv:
            continue

        route = find_best_route(db, source_id, demand.location_id, city=city)
        if not route:
            # Destination is currently unreachable (cut corridor) — the demand
            # legitimately stays pending until a dispatch is feasible.
            continue

        qty = min(prealloc["qty"], demand.quantity, inv.quantity)
        if qty <= 0:
            continue

        status = prealloc["status"]
        if status in ("DELIVERED", "VERIFIED") and inflight_seen < inflight_slots:
            status = "IN_TRANSIT" if inflight_seen % 2 == 0 else "DISPATCHED"
        if status not in ("DELIVERED", "VERIFIED"):
            inflight_seen += 1

        db.add(models.Allocation(
            id=str(uuid.uuid4()),
            demand_id=demand.id,
            source_id=source_id,
            resource_id=dmd["resource"],
            quantity=qty,
            route_path=json.dumps(route["path_edges"]),
            status=status,
            explanation=(
                f"Baseline {status.lower()} commitment for severity {demand.severity} demand; "
                f"travel time {route['travel_time']} via {' -> '.join(route['path_edges'])}."
            ),
            city=city,
            dispatched_at=datetime.datetime.utcnow() - datetime.timedelta(hours=idx + 1),
        ))
        created += 1
    db.flush()

    # ---- Funds ----
    db.add(models.Fund(
        id=f"FUND-{_CITY_PREFIX[city]}",
        category="Relief Operations",
        total_amount=round(cfg["population"] / 900, 2),
        allocated_amount=round(cfg["population"] / 1800, 2),
        city=city,
    ))
    created += 1

    return created


def _reconcile_state(db: Session) -> int:
    """Derive inventory and demand state from the allocations that exist.

    Guarantees the baseline is internally consistent no matter which dispatches
    were actually created (an unreachable destination leaves its demand pending).
    """
    touched = 0

    for demand in db.query(models.Demand).all():
        committed = (
            db.query(models.Allocation)
            .filter(models.Allocation.demand_id == demand.id)
            .all()
        )
        # Only live dispatches hold stock. Stale dispatches were refunded.
        held = sum(a.quantity for a in committed if a.status != "STALE")
        remaining = max(0, demand.quantity - held)
        status = "MET" if remaining == 0 else ("PARTIAL" if held > 0 else "OPEN")
        if demand.quantity != remaining or demand.status != status:
            demand.quantity = remaining
            demand.status = status
            touched += 1

    for inv in db.query(models.Inventory).all():
        committed = (
            db.query(models.Allocation)
            .filter(
                models.Allocation.source_id == inv.location_id,
                models.Allocation.resource_id == inv.resource_id,
            )
            .all()
        )
        held = sum(a.quantity for a in committed if a.status != "STALE")
        restored = sum(a.quantity for a in committed if a.status == "STALE")
        expected = max(0, inv.quantity - held + restored)
        if inv.quantity != expected:
            inv.quantity = expected
            touched += 1

    db.commit()
    return touched


def _append_baseline_audit(db: Session, cities: list) -> None:
    for city in cities:
        create_audit_record(
            db,
            "System",
            "BASELINE_SEEDED",
            {
                "city": city,
                "populations": OPERATIONAL_CITIES[city]["population"],
                "seed_version": SEED_VERSION,
            },
            city=city,
        )

    # Record the baseline dispatches so the ledger explains existing history.
    for alloc in db.query(models.Allocation).order_by(models.Allocation.city).all():
        create_audit_record(
            db,
            "System",
            "ALLOCATION_CREATED",
            {
                "allocation_id": alloc.id,
                "source_id": alloc.source_id,
                "demand_id": alloc.demand_id,
                "quantity": alloc.quantity,
                "city": alloc.city,
                "baseline": True,
            },
            city=alloc.city,
        )


def _seed_funds(db: Session) -> None:
    if not db.query(models.Fund).filter_by(city=None).first():
        national_pop = sum(v["population"] for v in OPERATIONAL_CITIES.values())
        db.add(models.Fund(
            id="FUND-NATIONAL",
            category="National Disaster Response Fund",
            total_amount=round(national_pop / 700, 2),
            allocated_amount=round(national_pop / 1500, 2),
            city=None,
        ))


# ============================================================
# ENTRY POINT
# ============================================================

def seed_db(force: bool = False):
    ensure_schema()
    db = SessionLocal()
    try:
        version = _current_version(db)
        needs_rebuild = force or version != SEED_VERSION

        if needs_rebuild:
            _purge_demo_rows(db)

        _seed_resources(db)
        db.commit()

        cities = sorted(OPERATIONAL_CITIES.keys())
        existing = {c for c in cities if db.query(models.Location).filter_by(city=c).first()}

        for idx, city in enumerate(cities):
            if city in existing and not needs_rebuild:
                continue
            _seed_city(db, city, idx)
            db.commit()

        # Only meaningful right after a baseline rebuild: the freshly inserted
        # demands still carry their gross requirement, so state can be derived
        # from the baseline dispatches. Re-running it on live data would
        # double-count dispatches already settled through the API.
        if needs_rebuild:
            _reconcile_state(db)

        _seed_funds(db)
        db.commit()

        if needs_rebuild:
            _append_baseline_audit(db, cities)
            db.query(models.SeedMeta).filter_by(key="version").delete()
            db.add(models.SeedMeta(key="version", value=SEED_VERSION))
            db.commit()

        missing = [c for c in cities if not db.query(models.Location).filter_by(city=c).first()]
        if needs_rebuild:
            print(
                f"Database seeded (v{SEED_VERSION}) with INDIA synthetic demo data "
                f"across {len(cities)} operational cities."
            )
        elif missing:
            print(f"Database re-seeded missing cities: {', '.join(missing)}")
        else:
            print("Database already seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()