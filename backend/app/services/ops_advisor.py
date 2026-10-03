import json
import re
from collections import Counter
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_

from .. import models

ACTIVE_DEMAND = {"OPEN", "PARTIAL"}
LIVE_INCIDENT = {"ACTIVE", "MONITORING"}

def _city_location_ids(db: Session, city: Optional[str]):
    if not city:
        return None
    return [r[0] for r in db.query(models.Location.id).filter(models.Location.city == city).all()]

def build_ops_snapshot(db: Session, city: Optional[str]):
    loc_ids = _city_location_ids(db, city)
    scope = city or "INDIA"

    inc_q = db.query(models.Incident)
    if loc_ids is not None:
        inc_q = inc_q.filter((models.Incident.city == city) | (models.Incident.location_id.in_(loc_ids)))
    incidents = inc_q.order_by(models.Incident.severity.desc()).all()
    live_incidents = [i for i in incidents if i.status in LIVE_INCIDENT]

    dem_q = db.query(models.Demand)
    if loc_ids is not None:
        dem_q = dem_q.filter(models.Demand.location_id.in_(loc_ids))
    demands = dem_q.order_by(models.Demand.severity.desc(), models.Demand.quantity.desc()).all()
    open_demands = [d for d in demands if d.status in ACTIVE_DEMAND]
    critical_demands = [d for d in open_demands if (d.severity or 0) >= 4]

    inv_q = db.query(models.Inventory)
    if loc_ids is not None:
        inv_q = inv_q.filter(models.Inventory.location_id.in_(loc_ids))
    inventory = inv_q.all()

    res_map = {r.id: r for r in db.query(models.Resource).all()}
    loc_map = {l.id: l for l in db.query(models.Location).all()}

    alloc_q = db.query(models.Allocation)
    if loc_ids is not None:
        demand_ids = [d.id for d in demands]
        # An allocation is in scope when its source or its demand is in scope,
        # mirroring main.py::scoped_allocations_query.
        clauses = []
        if loc_ids:
            clauses.append(models.Allocation.source_id.in_(loc_ids))
        if demand_ids:
            clauses.append(models.Allocation.demand_id.in_(demand_ids))
        if clauses:
            alloc_q = alloc_q.filter(or_(*clauses))
    allocations = alloc_q.all()

    road_q = db.query(models.Road)
    if loc_ids is not None:
        road_q = road_q.filter(models.Road.source_id.in_(loc_ids) | models.Road.target_id.in_(loc_ids))
    roads = road_q.all()
    blocked_roads = [r for r in roads if r.status == "BLOCKED"]

    # per-resource pressure
    inv_by_res = {}
    for row in inventory:
        inv_by_res.setdefault(row.resource_id, 0)
        inv_by_res[row.resource_id] += row.quantity or 0
    dem_by_res = {}
    for d in open_demands:
        dem_by_res.setdefault(d.resource_id, 0)
        dem_by_res[d.resource_id] += d.quantity or 0

    shortages = []
    for rid, need in dem_by_res.items():
        have = inv_by_res.get(rid, 0)
        # committed
        allocated = sum(a.quantity or 0 for a in allocations if a.resource_id == rid and a.status in ("ALLOCATED","DISPATCHED","IN_TRANSIT"))
        available = max(0, have - allocated)
        coverage = min(100, round((available / need) * 100)) if need else 100
        if coverage < 100:
            shortages.append({"resource_id": rid, "name": res_map.get(rid).name if res_map.get(rid) else rid, "category": res_map.get(rid).category if res_map.get(rid) else "?", "have": have, "available": available, "need": need, "coverage": coverage, "allocated": allocated})

    shortages.sort(key=lambda x: x["coverage"])

    stale_allocs = [a for a in allocations if a.status == "STALE"]
    at_risk = []
    blocked_ids = {r.id for r in blocked_roads}
    for a in allocations:
        if a.status in ("AVAILABLE", "ALLOCATED", "DISPATCHED", "IN_TRANSIT"):
            try:
                path = json.loads(a.route_path or "[]")
                if any(pid in blocked_ids for pid in path):
                    at_risk.append(a)
            except (TypeError, ValueError):
                continue

    total_affected = sum(i.affected_population or 0 for i in live_incidents)

    return {
        "scope": scope,
        "city": city,
        "incidents": incidents,
        "live_incidents": live_incidents,
        "demands": demands,
        "open_demands": open_demands,
        "critical_demands": critical_demands,
        "inventory": inventory,
        "allocations": allocations,
        "roads": roads,
        "blocked_roads": blocked_roads,
        "shortages": shortages,
        "stale_allocs": stale_allocs,
        "at_risk_allocs": at_risk,
        "res_map": res_map,
        "loc_map": loc_map,
        "total_affected": total_affected,
        "inv_by_res": inv_by_res,
        "dem_by_res": dem_by_res,
    }


def format_snapshot_for_prompt(snap: dict) -> str:
    lines = []
    lines.append(f"SCOPE: {snap['scope']}")
    lines.append(f"LIVE INCIDENTS: {len(snap['live_incidents'])} / {len(snap['incidents'])} total | AFFECTED: {snap['total_affected']:,}")
    for i in snap["live_incidents"][:5]:
        loc = snap["loc_map"].get(i.location_id)
        loc_name = loc.name if loc else i.location_id
        lines.append(f"  - {i.title} [{i.category} SEV{i.severity} {i.status}] @ {loc_name} ({i.affected_population:,} exposed)")
    lines.append(f"OPEN DEMANDS: {len(snap['open_demands'])} (critical {len(snap['critical_demands'])})")
    for d in snap["open_demands"][:6]:
        loc = snap["loc_map"].get(d.location_id)
        loc_name = loc.name if loc else d.location_id
        res = snap["res_map"].get(d.resource_id)
        res_name = res.name if res else d.resource_id
        lines.append(f"  - {d.id[:8]} {res_name} x{d.quantity} SEV{d.severity} {d.status} @ {loc_name}")
    lines.append(f"BLOCKED ROADS: {len(snap['blocked_roads'])} / {len(snap['roads'])}")
    for r in snap["blocked_roads"][:5]:
        src = snap["loc_map"].get(r.source_id)
        tgt = snap["loc_map"].get(r.target_id)
        lines.append(f"  - {r.id}: {src.name if src else r.source_id} -> {tgt.name if tgt else r.target_id} ({r.travel_time} min)")
    if snap["shortages"]:
        lines.append("SHORTAGES (coverage <100%):")
        for s in snap["shortages"][:6]:
            lines.append(f"  - {s['resource_id']} {s['name']} need {s['need']} have {s['have']} avail {s['available']} cov {s['coverage']}%")
    else:
        lines.append("SHORTAGES: none - all open demand covered")
    lines.append(f"ALLOCATIONS: {len(snap['allocations'])} total | STALE {len(snap['stale_allocs'])} | AT-RISK (blocked route) {len(snap['at_risk_allocs'])}")
    for a in snap["stale_allocs"][:3]:
        lines.append(f"  - STALE {a.id[:8]} {a.resource_id} x{a.quantity} {a.status} route {a.route_path}")
    for a in snap["at_risk_allocs"][:3]:
        lines.append(f"  - AT-RISK {a.id[:8]} {a.resource_id} x{a.quantity} {a.status} route {a.route_path}")
    return "\n".join(lines)


def deterministic_reply(message: str, snap: dict) -> str:
    q = (message or "").lower()
    scope = snap["scope"]

    def section(title, body):
        return f"{title}\n{body}"

    # helper formatters
    def fmt_shortages():
        if not snap["shortages"]:
            return "No resource is currently under pressure in this scope. All open demand is covered by available stock."
        out = []
        for s in snap["shortages"]:
            out.append(f"- {s['name']} ({s['resource_id']}, {s['category']}): need {s['need']}, stock {s['have']}, available {s['available']}, coverage {s['coverage']}%")
        return "\n".join(out)

    def fmt_blocked():
        if not snap["blocked_roads"]:
            return "No roads are currently blocked in this scope. All corridors are OPEN."
        out = []
        for r in snap["blocked_roads"]:
            src = snap["loc_map"].get(r.source_id)
            tgt = snap["loc_map"].get(r.target_id)
            out.append(f"- {r.id}: {src.name if src else r.source_id} -> {tgt.name if tgt else r.target_id} | {r.distance} km, {r.travel_time} min [{r.status}] (city {r.city})")
        return "\n".join(out)

    def fmt_demands():
        if not snap["open_demands"]:
            return "No open demands in this scope."
        out = []
        for d in snap["open_demands"][:8]:
            loc = snap["loc_map"].get(d.location_id)
            res = snap["res_map"].get(d.resource_id)
            out.append(f"- {res.name if res else d.resource_id} x{d.quantity} SEV{d.severity} {d.status} @ {loc.name if loc else d.location_id} (demand {d.id[:8]}, incident {d.incident_id or '-'})")
        if len(snap["open_demands"]) > 8:
            out.append(f"... and {len(snap['open_demands'])-8} more")
        return "\n".join(out)

    def fmt_incidents():
        if not snap["live_incidents"]:
            return "No live incidents (ACTIVE/MONITORING) in this scope."
        out = []
        for i in snap["live_incidents"]:
            loc = snap["loc_map"].get(i.location_id)
            out.append(f"- {i.title} | {i.category} SEV{i.severity} {i.status} @ {loc.name if loc else i.location_id} - {i.affected_population:,} exposed (city {i.city})")
        return "\n".join(out)

    def fmt_allocations():
        allocs = snap["allocations"]
        if not allocs:
            return "No allocations in this scope."
        # group by status
        cnt = Counter(a.status for a in allocs)
        lines = [f"Total {len(allocs)} allocations: " + ", ".join(f"{k} {v}" for k, v in cnt.items())]
        if snap["stale_allocs"]:
            lines.append(f"STALE (needs reallocation): {len(snap['stale_allocs'])}")
            for a in snap["stale_allocs"][:5]:
                lines.append(f"  - {a.id[:8]} {a.resource_id} x{a.quantity} {a.status} route {a.route_path} city {a.city}")
        if snap["at_risk_allocs"]:
            lines.append(f"AT-RISK (route uses blocked corridor): {len(snap['at_risk_allocs'])}")
            for a in snap["at_risk_allocs"][:5]:
                lines.append(f"  - {a.id[:8]} {a.resource_id} x{a.quantity} {a.status} route {a.route_path}")
        # delayed = ALLOCATED/DISPATCHED stuck?
        delayed = [a for a in allocs if a.status in ("ALLOCATED","DISPATCHED")]
        if delayed:
            lines.append(f"DELAYED/PENDING DISPATCH: {len(delayed)}")
            for a in delayed[:4]:
                lines.append(f"  - {a.id[:8]} {a.resource_id} x{a.quantity} {a.status} -> demand {a.demand_id[:8]}")
        return "\n".join(lines)

    def fmt_resources():
        inv = snap["inventory"]
        if not inv:
            return "No inventory records in this scope."
        # summarize per resource
        lines = []
        for rid, have in snap["inv_by_res"].items():
            need = snap["dem_by_res"].get(rid, 0)
            res = snap["res_map"].get(rid)
            name = res.name if res else rid
            lines.append(f"- {name} ({rid}): stock {have}, open demand {need}")
        return "\n".join(lines)

    # Intent routing. Keyword matching is anchored on word boundaries: plain
    # substring tests mis-fire (e.g. "allocations" contains "location").
    def has(*words):
        for w in words:
            if re.search(rf"\b{re.escape(w)}\b", q):
                return True
        return False

    is_pressure = has("pressure", "shortage", "shortages", "short", "stock", "inventory", "supplies", "surplus", "deficit")
    is_risk = has("risk", "risky", "stale", "delayed", "delay", "stuck", "failing", "reallocate", "unverified")
    is_route = has("route", "routes", "road", "roads", "corridor", "corridors", "blocked", "detour", "alternate", "connectivity")
    is_demand = has("demand", "demands", "need", "needs", "shortfall", "gap")
    is_incident = has("incident", "incidents", "emergency", "emergencies", "disaster", "affected", "hospital", "flood", "earthquake", "cyclone", "landslide", "heatwave", "sitrep", "situation")
    is_allocation = has("allocation", "allocations", "allocated", "dispatch", "dispatched", "shipment", "shipments", "delivery", "delivered", "vehicle", "truck", "fleet", "verified")
    is_overview = has("overview", "status", "operational", "operations", "summary", "brief", "briefing", "happening", "command", "center", "everything", "health")
    is_location = has("location", "locations", "where")

    def at_risk_lines():
        return "\n".join(
            f"- {a.id[:8]} {a.resource_id} x{a.quantity} {a.status} route {a.route_path}"
            for a in snap["at_risk_allocs"][:5]
        )

    # Priority order: narrow questions win over broad ones. Optional sections are
    # appended only when they have content.
    sections = (
        (is_route and not is_pressure, [
            ("ROUTE CONDITIONS:", fmt_blocked()),
            ("ALLOCATIONS AT RISK (blocked route):", at_risk_lines() if snap["at_risk_allocs"] else None),
        ]),
        (is_allocation or is_risk, [
            ("ALLOCATION STATUS:", fmt_allocations()),
            ("RESOURCE PRESSURE:", fmt_shortages()),
            ("BLOCKED CORRIDORS AFFECTING ROUTES:", fmt_blocked() if snap["blocked_roads"] else None),
        ]),
        (is_demand and not is_pressure, [
            ("DEMAND HOTSPOTS (highest severity/quantity first):", fmt_demands()),
            ("SHORTAGES:", fmt_shortages()),
        ]),
        (is_pressure, [
            ("RESOURCE PRESSURE:", fmt_shortages()),
            ("PER-RESOURCE STOCK:", fmt_resources()),
            ("DEMANDS DRIVING PRESSURE:", fmt_demands()),
        ]),
        (is_overview, [
            ("LIVE INCIDENTS:", fmt_incidents()),
            ("OPEN DEMANDS:", fmt_demands()),
            ("ROUTE CONDITIONS:", fmt_blocked()),
            ("RESOURCE PRESSURE:", fmt_shortages()),
            ("ALLOCATIONS:", fmt_allocations()),
        ]),
        (is_incident or is_location, [
            ("LIVE INCIDENTS:", fmt_incidents()),
            ("AFFECTED POPULATION:", f"{snap['total_affected']:,} currently exposed across {len(snap['live_incidents'])} live incidents"),
        ]),
    )

    parts = [f"OPERATIONS BRIEF — {scope} | LIVE {len(snap['live_incidents'])} incidents, {len(snap['open_demands'])} open demands, {len(snap['blocked_roads'])} blocked corridors, {snap['total_affected']:,} exposed"]

    matched = None
    for condition, items in sections:
        if condition:
            matched = items
            break

    if matched is None:
        matched = [
            ("LIVE INCIDENTS:", fmt_incidents()),
            ("OPEN DEMANDS:", fmt_demands()),
            ("BLOCKED CORRIDORS:", fmt_blocked()),
            ("RESOURCE PRESSURE:", fmt_shortages()),
            ("ALLOCATIONS:", fmt_allocations()),
        ]
        parts.append("Ask follow-ups like: 'which resources are under pressure?', 'which allocations are at risk?', 'which routes are blocked?', 'where is demand highest?'")

    for item in matched:
        if not item or not item[1]:
            continue
        parts.append(section(item[0], item[1]))

    # add actionable next step
    if snap["shortages"]:
        worst = snap["shortages"][0]
        parts.append(f"RECOMMENDED ACTION: Prioritize {worst['name']} ({worst['resource_id']}) — coverage {worst['coverage']}% is lowest. Consider rerouting from surplus warehouses or triggering demand reallocation.")
    elif snap["at_risk_allocs"]:
        parts.append(f"RECOMMENDED ACTION: {len(snap['at_risk_allocs'])} allocation(s) route through a blocked corridor. Re-run the routing/allocation engine to pick a feasible corridor.")
    elif snap["blocked_roads"]:
        parts.append("RECOMMENDED ACTION: Blocked corridors detected. Run the allocation engine or trigger alternate routing for at-risk shipments.")
    elif snap["stale_allocs"]:
        parts.append("RECOMMENDED ACTION: Stale allocations present. Re-run the allocation engine to reassign via feasible routes.")

    return "\n\n".join(parts)
