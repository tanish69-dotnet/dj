import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_dashboard():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    assert "affected_population" in response.json()

def test_locations():
    response = client.get("/api/locations")
    assert response.status_code == 200
    assert type(response.json()) == list

def test_audit_verify():
    response = client.get("/api/audit/verify")
    assert response.status_code == 200
    assert "valid" in response.json()
