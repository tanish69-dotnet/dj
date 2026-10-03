import datetime
import hashlib
import json
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from ... import models
from ..routing.engine import find_best_route

# Statuses that still hold stock committed to a demand.
ACTIVE_STATUSES = ("AVAILABLE", "ALLOCATED", "DISPATCHED", "IN_TRANSIT")
# Statuses that end the lifecycle of a dispatch.
CLOSED_STATUSES = ("DELIVERED", "VERIFIED")


def generate_hash(payload: dict, prev_hash: str) -> str:
    data_str = json.dumps(payload) + prev_hash
    return hashlib.sha256(data_str.encode()).hexdigest()


def create_audit_record(
    db: Session,
    actor: str,
    event_type: str,
    payload: dict,
    city: Optional[str] = None,
):
    last_record = db.query(models.AuditRecord).order_by(models.AuditRecord.timestamp.desc()).first()
    prev_hash = last_record.current_hash if last_record else "0" * 64

    new_hash = generate_hash(payload, prev_hash)

    record = models.AuditRecord(
        id=str(uuid.uuid4()),
        timestamp=datetime.datetime.utcnow(),
        actor=actor,
        event_type=event_type,
        payload=json.dumps(payload),
        previous_hash=prev_hash,
        current_hash=new_hash,
        city=city,
    )
    db.add(record)
    db.commit()


def city_location_ids(db: Session, city: Optional[str]) -> Optional[list]:
    """Location ids in the given city, or None when no city filter applies."""
    if not city:
        return None
    return [r[0] for r in db.query(models.Location.id).filter(models.Location.city == city).all()]


def run_allocation(db: Session, city: Optional[str] = None):
    """Allocate stock to unmet demands. When city is provided only that city's
    demands and that city's warehouses are considered, so running the engine
    from a city view cannot mutate any other sector."""
    loc_ids = city_location_ids(db, city)

    q = db.query(models.Demand).filter(models.Demand.status != "MET")
    if loc_ids is not None:
        q = q.filter(models.Demand.location_id.in_(loc_ids))
    demands = q.order_by(models.Demand.severity.desc()).all()

    allocations_made = 0

    for demand in demands:
        inv_q = db.query(models.Inventory).filter(
            models.Inventory.resource_id == demand.resource_id,
            models.Inventory.quantity > 0,
        )
        if loc_ids is not None:
            inv_q = inv_q.filter(models.Inventory.location_id.in_(loc_ids))
        inventories = inv_q.all()

        best_source = None
        best_score = -9999
        best_route = None
        best_explanation = ""

        for inv in inventories:
            route = find_best_route(db, inv.location_id, demand.location_id, city=city)
            if not route:
                continue

            # Simple scoring
            # severity * 10 - travel_time + inventory_quantity * 0.1
            score = (demand.severity * 10) - route["travel_time"] + (inv.quantity * 0.1)

            if score > best_score:
                best_score = score
                best_source = inv
                best_route = route
                best_explanation = (
                    f"Critical demand severity {demand.severity}, travel time {route['travel_time']}, "
                    f"available stock {inv.quantity}."
                )

        if best_source:
            allocate_qty = min(demand.quantity, best_source.quantity)

            allocation = models.Allocation(
                id=str(uuid.uuid4()),
                demand_id=demand.id,
                source_id=best_source.location_id,
                resource_id=demand.resource_id,
                quantity=allocate_qty,
                route_path=json.dumps(best_route["path_edges"]),
                status="AVAILABLE",
                explanation=best_explanation,
                city=city,
                dispatched_at=datetime.datetime.utcnow(),
            )

            best_source.quantity -= allocate_qty
            demand.quantity -= allocate_qty
            if demand.quantity <= 0:
                demand.status = "MET"
            else:
                demand.status = "PARTIAL"

            db.add(allocation)

            create_audit_record(
                db,
                "System",
                "ALLOCATION_CREATED",
                {
                    "allocation_id": allocation.id,
                    "source_id": allocation.source_id,
                    "demand_id": allocation.demand_id,
                    "quantity": allocation.quantity,
                    "city": city,
                },
                city=city,
            )

            allocations_made += 1
            db.commit()

    return allocations_made


def trigger_reallocation(db: Session, city: Optional[str] = None):
    """Invalidate dispatches whose route was cut and re-run the engine. Scoped to
    the same city as the corridor change when one is supplied."""
    q = db.query(models.Allocation).filter(models.Allocation.status.in_(["AVAILABLE", "PENDING"]))
    if city:
        q = q.filter(models.Allocation.city == city)
    active = q.all()

    for alloc in active:
        # Check if route is still valid
        edges = json.loads(alloc.route_path or "[]")
        valid = True
        for edge_id in edges:
            road = db.query(models.Road).filter(models.Road.id == edge_id).first()
            if road and road.status == "BLOCKED":
                valid = False
                break

        if not valid:
            alloc.status = "STALE"
            alloc.explanation = "Route blocked. " + (alloc.explanation or "")

            # Return inventory and demand
            inv = (
                db.query(models.Inventory)
                .filter(
                    models.Inventory.location_id == alloc.source_id,
                    models.Inventory.resource_id == alloc.resource_id,
                )
                .first()
            )
            if inv:
                inv.quantity += alloc.quantity

            demand = db.query(models.Demand).filter(models.Demand.id == alloc.demand_id).first()
            if demand:
                demand.quantity += alloc.quantity
                if demand.status == "MET":
                    demand.status = "PARTIAL"

            create_audit_record(
                db,
                "System",
                "ALLOCATION_STALE",
                {
                    "allocation_id": alloc.id,
                    "reason": "Route blocked",
                    "city": alloc.city,
                },
                city=alloc.city,
            )

            db.commit()

    # Rerun allocation within the same scope
    return run_allocation(db, city=city)