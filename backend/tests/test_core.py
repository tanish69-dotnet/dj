import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db import Base
from backend.app import models
from backend.app.services.allocation.engine import run_allocation, trigger_reallocation, create_audit_record
from backend.app.services.routing.engine import find_best_route
import json

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def seed_test_data(db):
    h1 = models.Location(id="H1", name="H1", type="HOSPITAL", lat=0, lng=0, capacity=100)
    w1 = models.Location(id="W1", name="W1", type="WAREHOUSE", lat=1, lng=1, capacity=100)
    db.add_all([h1, w1])
    
    r1 = models.Road(id="R1", source_id="W1", target_id="H1", distance=5.0, travel_time=10.0, status="OPEN")
    db.add(r1)
    
    res = models.Resource(id="RES1", name="Blood", category="Med")
    db.add(res)
    
    inv = models.Inventory(id="INV1", location_id="W1", resource_id="RES1", quantity=50)
    db.add(inv)
    
    dem = models.Demand(id="DEM1", location_id="H1", resource_id="RES1", quantity=20, severity=5, status="OPEN")
    db.add(dem)
    db.commit()

def test_allocation_constraints(db):
    seed_test_data(db)
    
    allocations_made = run_allocation(db)
    assert allocations_made == 1
    
    alloc = db.query(models.Allocation).first()
    assert alloc is not None
    assert alloc.quantity == 20
    assert alloc.status == "AVAILABLE"
    
    # Check inventory deducted
    inv = db.query(models.Inventory).first()
    assert inv.quantity == 30
    
    # Check demand met
    dem = db.query(models.Demand).first()
    assert dem.status == "MET"
    assert dem.quantity == 0

def test_dynamic_reallocation_and_route_block(db):
    seed_test_data(db)
    run_allocation(db)
    
    alloc = db.query(models.Allocation).first()
    assert alloc.status == "AVAILABLE"
    
    # Block road
    road = db.query(models.Road).first()
    road.status = "BLOCKED"
    db.commit()
    
    # Trigger reallocation
    trigger_reallocation(db)
    
    # The previous allocation should be STALE
    allocs = db.query(models.Allocation).all()
    stale_alloc = [a for a in allocs if a.status == "STALE"][0]
    assert stale_alloc.id == alloc.id
    
    # Inventory should be refunded because there's no alternate route in this setup
    inv = db.query(models.Inventory).first()
    assert inv.quantity == 50
    
    dem = db.query(models.Demand).first()
    assert dem.quantity == 20
    assert dem.status == "PARTIAL"

def test_audit_ledger(db):
    create_audit_record(db, "System", "TEST", {"data": 1})
    create_audit_record(db, "System", "TEST2", {"data": 2})
    
    records = db.query(models.AuditRecord).order_by(models.AuditRecord.timestamp.asc()).all()
    assert len(records) == 2
    
    import hashlib
    # Verify chain
    assert records[0].previous_hash == "0"*64
    expected_hash_0 = hashlib.sha256((records[0].payload + records[0].previous_hash).encode()).hexdigest()
    assert records[0].current_hash == expected_hash_0
    
    assert records[1].previous_hash == records[0].current_hash
    expected_hash_1 = hashlib.sha256((records[1].payload + records[1].previous_hash).encode()).hexdigest()
    assert records[1].current_hash == expected_hash_1
