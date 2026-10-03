"""Scenario engine.

Every event is resolved against live rows in the selected operational city —
never against hardcoded Mumbai identifiers. With no city selected (INDIA) the
engine picks the sector with the most unmet demand so the national view stays
meaningful without touching unrelated data.
"""

import json
import uuid
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from ... import models
from ..allocation.engine import create_audit_record, run_allocation, trigger_reallocation


def _city_of(db: Session, location_id: str) -> Optional[str]:
    row = (
        db.query(models.Location.city)
        .filter(models.Location.id == location_id)
        .first()
    )
    return row[0] if row else None


def _resolve_city(db: Session, city: Optional[str]) -> Optional[str]:
    """Return the requested city, or the busiest sector when running nationally."""
    if city:
        return city

    row = (
        db.query(
            models.Demand.city,
            func.sum(models.Demand.quantity).label("pending"),
        )
        .filter(models.Demand.status.in_(["OPEN", "PARTIAL"]))
        .group_by(models.Demand.city)
        .order_by(func.sum(models.Demand.quantity).desc())
        .limit(1)
        .first()
    )
    return row[0] if row else None


def _worst_demand(db: Session, city: str):
    return (
        db.query(models.Demand)
        .filter(
            models.Demand.city == city,
            models.Demand.status.in_(["OPEN", "PARTIAL"]),
        )
        .order_by(models.Demand.severity.desc(), models.Demand.quantity.desc())
        .first()
    )


def _pick_road(db: Session, city: str, road_id: Optional[str] = None):
    if road_id:
        road = (
            db.query(models.Road)
            .filter(models.Road.id == road_id, models.Road.city == city)
            .first()
        )
        if road:
            return road

    # Prefer a corridor that actually carries an open dispatch, otherwise the
    # busiest corridor in the sector.
    carried = None
    for alloc in (
        db.query(models.Allocation)
        .filter(
            models.Allocation.city == city,
            models.Allocation.status.in_(["AVAILABLE", "PENDING"]),
        )
        .all()
    ):
        for edge in json.loads(alloc.route_path or "[]"):
            road = db.query(models.Road).filter(models.Road.id == edge).first()
            if road and road.city == city and road.status == "OPEN":
                return road
        if carried is None:
            carried = road
    if carried is not None:
        return carried

    return (
        db.query(models.Road)
        .filter(models.Road.city == city, models.Road.status == "OPEN")
        .order_by(models.Road.travel_time.desc())
        .first()
    )


def process_event(event_type: str, db: Session, city: Optional[str] = None):
    target_city = _resolve_city(db, city)

    if not target_city:
        return {"message": "No operational city available for this event", "city": None}

    if event_type == "DEMAND_SPIKE":
        demand = _worst_demand(db, target_city)
        if demand:
            resource_id = demand.resource_id
            location_id = demand.location_id
            severity = min(5, max(demand.severity, 4))
            baseline = demand.quantity
        else:
            # No unmet demand left: spike the worst severity hospital site in the city.
            severity = 5
            location = (
                db.query(models.Location)
                .filter(models.Location.city == target_city, models.Location.type == "HOSPITAL")
                .order_by(models.Location.capacity.desc())
                .first()
            )
            if not location:
                return {"message": f"No hospital site in {target_city}", "city": target_city}
            location_id = location.id
            resource_id = (
                db.query(models.Resource.id).order_by(models.Resource.id).first()[0]
            )
            baseline = 50

        quantity = max(25, baseline or 25)
        db.add(models.Demand(
            id=str(uuid.uuid4()),
            location_id=location_id,
            resource_id=resource_id,
            quantity=quantity,
            severity=severity,
            status="OPEN",
            city=target_city,
        ))
        db.commit()

        create_audit_record(
            db,
            "System",
            "SIMULATION_EVENT",
            {
                "event": "DEMAND_SPIKE",
                "city": target_city,
                "location_id": location_id,
                "resource_id": resource_id,
                "quantity": quantity,
                "severity": severity,
            },
            city=target_city,
        )

        allocations = run_allocation(db, city=target_city)
        return {
            "message": f"Demand spike raised in {target_city} ({quantity} units of {resource_id}); "
                       f"{allocations} new dispatch(es) created.",
            "city": target_city,
        }

    if event_type == "ROAD_BLOCKED":
        road = _pick_road(db, target_city)
        if not road:
            return {"message": f"No open corridor found in {target_city}", "city": target_city}

        road.status = "BLOCKED"
        db.commit()

        create_audit_record(
            db,
            "System",
            "SIMULATION_EVENT",
            {
                "event": "ROAD_BLOCKED",
                "city": target_city,
                "road_id": road.id,
            },
            city=target_city,
        )

        reallocated = trigger_reallocation(db, city=target_city)
        return {
            "message": f"Corridor {road.id} blocked in {target_city}; "
                       f"reallocation produced {reallocated} replacement dispatch(es).",
            "city": target_city,
            "road_id": road.id,
        }

    if event_type == "ROAD_RESTORED":
        road = (
            db.query(models.Road)
            .filter(models.Road.city == target_city, models.Road.status == "BLOCKED")
            .first()
        )
        if not road:
            return {"message": f"No blocked corridor in {target_city}", "city": target_city}
        road.status = "OPEN"
        db.commit()
        create_audit_record(
            db,
            "System",
            "SIMULATION_EVENT",
            {"event": "ROAD_RESTORED", "city": target_city, "road_id": road.id},
            city=target_city,
        )
        reallocated = run_allocation(db, city=target_city)
        return {
            "message": f"Corridor {road.id} reopened in {target_city}; "
                       f"{reallocated} dispatch(es) created.",
            "city": target_city,
            "road_id": road.id,
        }

    return {"message": "Unknown event", "city": target_city}


def reset_simulation(db: Session):
    """Rebuild the baseline demo dataset. The audit ledger is preserved."""
    from ...database.seed import seed_db

    seed_db(force=True)
    return {"message": "Simulation reset to baseline."}