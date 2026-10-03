import pytest
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app import main
from backend.app.main import app
from backend.app.services.ops_advisor import deterministic_reply

client = TestClient(app)


@pytest.fixture
def no_provider(monkeypatch):
    monkeypatch.delenv("GEMINI_WEB2API_BASE_URL", raising=False)
    monkeypatch.delenv("GEMINI_WEB2API_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_WEB2API_MODEL", raising=False)


def test_ai_status_reports_missing_provider(no_provider):
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["mode"] == "deterministic"
    assert body["degraded"] is True
    assert body["scope"] == "INDIA"
    assert "GEMINI_WEB2API_BASE_URL" in body["missing_env"]
    assert "GEMINI_WEB2API_API_KEY" in body["missing_env"]


def test_ai_status_rejects_placeholder_provider(monkeypatch):
    monkeypatch.setenv("GEMINI_WEB2API_BASE_URL", "http://127.0.0.1:8081/v1")
    monkeypatch.setenv("GEMINI_WEB2API_API_KEY", "sk-gemini")
    body = client.get("/api/ai/status").json()
    assert body["configured"] is False
    assert body["mode"] == "deterministic"


def test_ai_chat_returns_200_without_provider(no_provider):
    """Regression: the assistant used to return 500 when Gemini was unreachable."""
    response = client.post("/api/ai/chat", json={"message": "which resources are under pressure?"})
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["degraded"] is True
    assert body["source"] == "deterministic_ops_advisor"
    assert body["model"] is None
    assert body["reply"].strip()
    assert "OPERATIONS BRIEF" in body["reply"]


def test_ai_chat_facts_match_database(no_provider):
    body = client.post("/api/ai/chat", json={"message": "give me an operational overview"}).json()
    facts = body["facts"]
    dashboard = client.get("/api/dashboard").json()
    incidents = client.get("/api/incidents").json()
    demands = client.get("/api/demands").json()
    roads = client.get("/api/roads").json()

    live = [i for i in incidents if i["status"] in ("ACTIVE", "MONITORING")]
    open_demands = [d for d in demands if d["status"] in ("OPEN", "PARTIAL")]
    blocked = [r for r in roads if r["status"] == "BLOCKED"]

    assert facts["live_incidents"] == len(live)
    assert facts["open_demands"] == len(open_demands)
    assert facts["blocked_roads"] == len(blocked)
    assert facts["affected_population"] == sum(i["affected_population"] or 0 for i in live)
    assert facts["affected_population"] == dashboard["affected_population"]


def test_ai_chat_is_city_scoped(no_provider):
    city = "Guwahati"
    body = client.post("/api/ai/chat", json={"message": "which routes are blocked?", "city": city}).json()
    assert body["scope"] == city
    national = client.post("/api/ai/chat", json={"message": "which routes are blocked?"}).json()
    assert national["scope"] == "INDIA"
    assert body["facts"]["live_incidents"] < national["facts"]["live_incidents"]
    assert body["facts"]["blocked_roads"] <= national["facts"]["blocked_roads"]


def test_ai_chat_routes_intent_to_matching_section(no_provider):
    allocations = client.post("/api/ai/chat", json={"message": "Which allocations are at risk?"}).json()
    assert "ALLOCATION STATUS" in allocations["reply"]

    routes = client.post("/api/ai/chat", json={"message": "which routes are blocked?"}).json()
    assert "ROUTE CONDITIONS" in routes["reply"]
    assert "ALLOCATION STATUS" not in routes["reply"]

    demand = client.post("/api/ai/chat", json={"message": "where is demand highest?"}).json()
    assert "DEMAND HOTSPOTS" in demand["reply"]

    stock = client.post("/api/ai/chat", json={"message": "what resources are under pressure?"}).json()
    assert "RESOURCE PRESSURE" in stock["reply"]


def test_ai_chat_requires_question(no_provider):
    response = client.post("/api/ai/chat", json={"message": "   "})
    assert response.status_code == 422


def test_ai_chat_rejects_unknown_city(no_provider):
    response = client.post("/api/ai/chat", json={"message": "status?", "city": "Atlantis"})
    assert response.status_code == 404


def _fake_snapshot():
    """Minimal snapshot with one stale and one blocked-route allocation."""
    road = SimpleNamespace(id="R-BLOCKED", source_id="L1", target_id="L2",
                           status="BLOCKED", distance=5.0, travel_time=12.0, city="Guwahati")
    stale = SimpleNamespace(id="ALLOC-STALE", resource_id="RES-WATER", quantity=100,
                            status="STALE", route_path="[]", city="Guwahati", demand_id="D1")
    risky = SimpleNamespace(id="ALLOC-RISKY", resource_id="RES-WATER", quantity=50,
                            status="IN_TRANSIT", route_path='["R-BLOCKED"]', city="Guwahati",
                            demand_id="D2")
    shortage_res = SimpleNamespace(id="RES-WATER", name="Potable Water", category="WATER")
    return {
        "scope": "Guwahati",
        "city": "Guwahati",
        "incidents": [],
        "live_incidents": [],
        "demands": [],
        "open_demands": [],
        "critical_demands": [],
        "inventory": [],
        "allocations": [stale, risky],
        "roads": [road],
        "blocked_roads": [road],
        "shortages": [{"resource_id": "RES-WATER", "name": "Potable Water", "category": "WATER",
                       "have": 10, "available": 10, "need": 100, "coverage": 10, "allocated": 0}],
        "stale_allocs": [stale],
        "at_risk_allocs": [risky],
        "res_map": {"RES-WATER": shortage_res},
        "loc_map": {},
        "total_affected": 0,
        "inv_by_res": {"RES-WATER": 10},
        "dem_by_res": {"RES-WATER": 100},
    }


def test_deterministic_reply_reports_stale_and_at_risk():
    reply = deterministic_reply("which allocations are at risk or stale?", _fake_snapshot())
    assert "ALLOCATION STATUS" in reply
    assert "STALE" in reply
    assert "AT-RISK" in reply
    assert "R-BLOCKED" in reply


def test_deterministic_reply_reports_shortages_with_action():
    reply = deterministic_reply("what resources are under pressure?", _fake_snapshot())
    assert "RESOURCE PRESSURE" in reply
    assert "Potable Water" in reply
    assert "RECOMMENDED ACTION" in reply


def test_intent_matching_is_word_bounded():
    """'allocations' contains the substring 'location'; intents must not collide."""
    reply = deterministic_reply("Which allocations are at risk?", _fake_snapshot())
    assert "ALLOCATION STATUS" in reply
    assert "LIVE INCIDENTS" not in reply


def test_deterministic_reply_falls_back_to_brief_for_unknown_question():
    reply = deterministic_reply("hello", _fake_snapshot())
    assert "OPERATIONS BRIEF" in reply
    assert "Ask follow-ups" in reply


def test_ai_chat_falls_back_when_provider_errors(monkeypatch, no_provider):
    """A configured-but-broken provider degrades instead of returning 500."""

    async def boom(message: str):
        raise RuntimeError("upstream 503")

    monkeypatch.setattr(main, "gemini_chat", boom)
    monkeypatch.setenv("GEMINI_WEB2API_BASE_URL", "https://gemini.example.internal/v1")
    monkeypatch.setenv("GEMINI_WEB2API_API_KEY", "configured-key")

    body = client.post("/api/ai/chat", json={"message": "which routes are blocked?"}).json()
    assert body["success"] is True
    assert body["degraded"] is True
    assert body["source"] == "deterministic_ops_advisor"
    assert "upstream 503" in body["reason"]
    assert "ROUTE CONDITIONS" in body["reply"]


def test_ai_chat_uses_provider_when_available(monkeypatch, no_provider):
    async def fake_chat(message: str):
        assert "LIVE OPERATIONAL SNAPSHOT" in message
        return "provider answer"

    monkeypatch.setattr(main, "gemini_chat", fake_chat)
    monkeypatch.setenv("GEMINI_WEB2API_BASE_URL", "https://gemini.example.internal/v1")
    monkeypatch.setenv("GEMINI_WEB2API_API_KEY", "configured-key")
    monkeypatch.setenv("GEMINI_WEB2API_MODEL", "gemini-2.5-pro")

    body = client.post("/api/ai/chat", json={"message": "which routes are blocked?"}).json()
    assert body["degraded"] is False
    assert body["source"] == "gemini"
    assert body["model"] == "gemini-2.5-pro"
    assert body["reply"] == "provider answer"