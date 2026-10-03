"""City-selector contract tests.

The frontend city selector is only meaningful if the backend actually isolates
operational data per city. These tests assert that for every configured city.
"""

import json

import pytest
from fastapi.testclient import TestClient

from backend.app.database.cities import CITY_SCENARIOS, OPERATIONAL_CITIES
from backend.app.main import app

client = TestClient(app)

ALL_CITIES = sorted(OPERATIONAL_CITIES)
READ_ENDPOINTS = [
    "/api/dashboard",
    "/api/locations",
    "/api/roads",
    "/api/demands",
    "/api/incidents",
    "/api/inventory",
    "/api/allocations",
    "/api/audit",
]


# ============================================================
# SELECTOR CONTRACT
# ============================================================

def test_cities_endpoint_is_single_source_of_truth():
    response = client.get("/api/cities")
    assert response.status_code == 200
    body = response.json()
    assert sorted(body["cities"]) == ALL_CITIES
    for name, cfg in body["cities"].items():
        assert cfg["population"] > 0
        assert cfg["state"]
    assert body["resources"]


@pytest.mark.parametrize("city", ALL_CITIES)
def test_every_city_has_readable_operational_data(city):
    scenario = CITY_SCENARIOS[city]
    params = {"city": city}

    dashboard = client.get("/api/dashboard", params=params)
    assert dashboard.status_code == 200
    dash = dashboard.json()
    assert dash["city"] == city

    locations = client.get("/api/locations", params=params).json()
    assert locations, f"{city} has no locations"
    assert {loc["city"] for loc in locations} == {city}

    roads = client.get("/api/roads", params=params).json()
    assert roads, f"{city} has no corridors"
    assert {r["city"] for r in roads} == {city}

    demands = client.get("/api/demands", params=params).json()
    assert len(demands) == len(scenario["demands"])

    incidents = client.get("/api/incidents", params=params).json()
    assert len(incidents) == len(scenario["incidents"])
    assert {i["city"] for i in incidents} == {city}

    inventory = client.get("/api/inventory", params=params).json()
    assert {inv["location_id"] for inv in inventory} <= {loc["id"] for loc in locations}

    allocations = client.get("/api/allocations", params=params).json()
    assert {a["city"] for a in allocations} == {city}
    loc_ids = {loc["id"] for loc in locations}
    assert all(a["source_id"] in loc_ids for a in allocations)

    assert dash["total_locations"] == len(locations)
    assert dash["total_roads"] == len(roads)
    assert dash["affected_population"] > 0
    assert dash["active_emergencies"] > 0


@pytest.mark.parametrize("city", ALL_CITIES)
def test_city_reads_never_leak_other_cities(city):
    """A city response may only reference ids that belong to that city."""
    params = {"city": city}
    loc_ids = {loc["id"] for loc in client.get("/api/locations", params=params).json()}
    other_ids = {
        loc["id"]
        for other in ALL_CITIES if other != city
        for loc in client.get("/api/locations", params={"city": other}).json()
    }
    assert not (loc_ids & other_ids)

    for demand in client.get("/api/demands", params=params).json():
        assert demand["location_id"] in loc_ids
        assert demand["city"] == city

    for incident in client.get("/api/incidents", params=params).json():
        assert incident["city"] == city
        assert incident["location_id"] in loc_ids

    for alloc in client.get("/api/allocations", params=params).json():
        assert alloc["city"] == city
        assert alloc["source_id"] in loc_ids
        for edge in json.loads(alloc["route_path"] or "[]"):
            road = client.get("/api/roads", params={"city": city}).json()
            assert any(r["id"] == edge for r in road)


def test_national_view_aggregates_every_city():
    national = client.get("/api/dashboard").json()
    assert national["city"] == "INDIA"
    assert national["total_locations"] == sum(
        client.get("/api/dashboard", params={"city": c}).json()["total_locations"]
        for c in ALL_CITIES
    )
    assert national["total_roads"] == sum(
        client.get("/api/dashboard", params={"city": c}).json()["total_roads"]
        for c in ALL_CITIES
    )
    assert national["pending_demand"] == sum(
        client.get("/api/dashboard", params={"city": c}).json()["pending_demand"]
        for c in ALL_CITIES
    )
    assert national["affected_population"] == sum(
        client.get("/api/dashboard", params={"city": c}).json()["affected_population"]
        for c in ALL_CITIES
    )


def test_unknown_city_is_rejected_not_silently_ignored():
    for endpoint in READ_ENDPOINTS:
        response = client.get(endpoint, params={"city": "Atlantis"})
        assert response.status_code == 404, f"{endpoint} accepted an unknown city"
        assert "Unknown operational city" in response.json()["detail"]


def test_india_alias_resolves_to_national_scope():
    assert client.get("/api/dashboard", params={"city": "INDIA"}).json()["city"] == "INDIA"
    assert client.get("/api/dashboard", params={"city": ""}).json()["city"] == "INDIA"


# ============================================================
# DIFFERENTIATION
# ============================================================

def test_kpis_differ_between_cities():
    """The whole point of the selector: switching cities must change the numbers."""
    dashboards = {c: client.get("/api/dashboard", params={"city": c}).json() for c in ALL_CITIES}

    # The command-center KPIs must not be constant across the selector.
    for field in (
        "affected_population",
        "pending_demand",
        "resources_available",
        "active_allocations",
        "active_emergencies",
        "active_incidents",
    ):
        values = [d[field] for d in dashboards.values()]
        assert len(set(values)) >= 3, f"{field} is effectively constant: {sorted(set(values))}"

    assert len({d["affected_population"] for d in dashboards.values()}) > 10

    # Corridor counts follow each city's topology, so only non-constancy is
    # guaranteed — four- and five-node cities cap out at 6 and 10 corridors.
    road_counts = {d["total_roads"] for d in dashboards.values()}
    assert len(road_counts) >= 3
    assert max(road_counts) > min(road_counts)

    incident_shapes = {
        (d["active_incidents"], d["critical_cases"], d["critical_demands"])
        for d in dashboards.values()
    }
    assert len(incident_shapes) > 5


def test_scenario_blueprint_matches_live_rows():
    blueprint = client.get("/api/scenario/blueprint").json()
    assert sorted(blueprint) == ALL_CITIES
    for city, row in blueprint.items():
        scenario = CITY_SCENARIOS[city]
        assert row["incidents"] == len(scenario["incidents"])
        assert row["demands"] == len(scenario["demands"])
        assert row["scenario"]["blocked_corridor"] == scenario.get("blocked_road")
        assert row["open_demands"] > 0


def test_blocked_corridor_is_visible_where_declared():
    blueprint = client.get("/api/scenario/blueprint").json()
    for city, scenario in CITY_SCENARIOS.items():
        blocked = client.get("/api/roads", params={"city": city}).json()
        actual = [r["id"] for r in blocked if r["status"] == "BLOCKED"]
        declared = scenario.get("blocked_road")
        if declared:
            assert len(actual) == 1, f"{city} should have exactly one blocked corridor"
            assert blueprint[city]["scenario"]["blocked_corridor_id"] == actual[0]
            assert actual[0].endswith(declared)
        else:
            assert actual == [], f"{city} should have no blocked corridor"
            assert blueprint[city]["scenario"]["blocked_corridor_id"] is None


def test_tracking_lifecycle_uses_real_allocation_statuses():
    seen = set()
    for city in ALL_CITIES:
        for alloc in client.get("/api/allocations", params={"city": city}).json():
            assert alloc["status"] in (
                "AVAILABLE", "ALLOCATED", "DISPATCHED", "IN_TRANSIT",
                "DELIVERED", "VERIFIED", "STALE",
            )
            assert alloc["quantity"] > 0
            assert alloc["dispatched_at"] is not None
            seen.add(alloc["status"])
    assert {"IN_TRANSIT", "DISPATCHED"} & seen, "no in-flight dispatch in the baseline"
    assert {"DELIVERED", "VERIFIED"} & seen, "no closed dispatch history in the baseline"


# ============================================================
# CITY-SCOPED ACTIONS
# ============================================================

def test_run_allocation_is_city_scoped():
    before = {
        c: client.get("/api/dashboard", params={"city": c}).json()["active_allocations"]
        for c in ALL_CITIES
    }
    target = "Chennai"
    response = client.post("/api/allocations/run", params={"city": target})
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == target
    assert body["allocations_created"] > 0, "baseline has unmet demand that should be allocatable"

    after = {
        c: client.get("/api/dashboard", params={"city": c}).json()["active_allocations"]
        for c in ALL_CITIES
    }
    assert after[target] > before[target]
    for city in ALL_CITIES:
        if city != target:
            assert after[city] == before[city], f"{city} changed while running {target}"

    # Unmet demand is consumed only where it was declared.
    for demand in client.get("/api/demands", params={"city": target}).json():
        assert demand["city"] == target


def test_simulation_demand_spike_lands_in_selected_city():
    target = "Guwahati"
    before = {
        c: client.get("/api/dashboard", params={"city": c}).json()["pending_demand"]
        for c in ALL_CITIES
    }
    response = client.post("/api/simulation/event", params={"event_type": "DEMAND_SPIKE", "city": target})
    assert response.status_code == 200
    assert response.json()["city"] == target
    assert target in response.json()["message"]

    after = {
        c: client.get("/api/dashboard", params={"city": c}).json()["pending_demand"]
        for c in ALL_CITIES
    }
    for city in ALL_CITIES:
        if city != target:
            assert after[city] == before[city], f"{city} changed during a {target} spike"

    # The new request belongs to the selected city only.
    spiked = [d for d in client.get("/api/demands", params={"city": target}).json()]
    assert all(d["city"] == target for d in spiked)


def test_simulation_road_block_resolves_real_corridor_in_city():
    target = "Pune"
    roads = client.get("/api/roads", params={"city": target}).json()
    response = client.post("/api/simulation/event", params={"event_type": "ROAD_BLOCKED", "city": target})
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == target
    assert body["road_id"] in {r["id"] for r in roads}

    blocked = {r["id"] for r in client.get("/api/roads", params={"city": target}).json() if r["status"] == "BLOCKED"}
    assert body["road_id"] in blocked

    # No other city was touched.
    for other in ALL_CITIES:
        if other != target:
            assert not any(
                r["id"] == body["road_id"]
                for r in client.get("/api/roads", params={"city": other}).json()
            )


def test_simulation_road_restored_is_scoped():
    target = "Jaipur"
    client.post("/api/simulation/event", params={"event_type": "ROAD_BLOCKED", "city": target})
    assert client.get("/api/dashboard", params={"city": target}).json()["blocked_roads"] >= 1
    response = client.post("/api/simulation/event", params={"event_type": "ROAD_RESTORED", "city": target})
    assert response.status_code == 200
    assert response.json()["city"] == target
    assert client.get("/api/dashboard", params={"city": target}).json()["blocked_roads"] == 0


def test_road_status_endpoint_validates_and_scopes():
    road = next(
        r for r in client.get("/api/roads", params={"city": "Varanasi"}).json()
        if r["status"] == "OPEN"
    )
    bad = client.post(f"/api/roads/{road['id']}/status", params={"status": "SLUSHY"})
    assert bad.status_code == 400

    missing = client.post("/api/roads/NOPE/status", params={"status": "BLOCKED"})
    assert missing.status_code == 404

    ok = client.post(f"/api/roads/{road['id']}/status", params={"status": "BLOCKED"})
    assert ok.status_code == 200
    assert ok.json()["city"] == "Varanasi"
    assert client.get("/api/dashboard", params={"city": "Varanasi"}).json()["blocked_roads"] >= 1

    client.post(f"/api/roads/{road['id']}/status", params={"status": "OPEN"})


def test_allocation_status_transitions_are_validated():
    alloc = client.get("/api/allocations", params={"city": "Kolkata"}).json()[0]
    assert client.post(
        f"/api/allocations/{alloc['id']}/status", params={"status": "TELEPORTED"}
    ).status_code == 400
    assert client.post(
        "/api/allocations/not-a-real-id/status", params={"status": "DISPATCHED"}
    ).status_code == 404


def test_funds_are_city_scoped():
    national = client.get("/api/funds").json()
    assert any(f["city"] is None for f in national)
    assert len(national) == len(ALL_CITIES) + 1

    scoped = client.get("/api/funds", params={"city": "Nagpur"}).json()
    assert len(scoped) == 1
    assert scoped[0]["city"] == "Nagpur"
    assert scoped[0]["total_amount"] > 0


def test_audit_chain_stays_valid_after_city_actions():
    assert client.get("/api/audit/verify").json()["valid"] is True
    client.post("/api/allocations/run", params={"city": "Surat"})
    assert client.get("/api/audit/verify").json()["valid"] is True
    city_audit = client.get("/api/audit", params={"city": "Surat"}).json()
    assert city_audit
    assert all(r["city"] == "Surat" for r in city_audit)