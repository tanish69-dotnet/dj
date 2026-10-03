from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .db import Base

# Column defaults are only applied to newly inserted rows. Existing rows are
# backfilled by the versioned seeder in app/database/seed.py.


class Location(Base):
    __tablename__ = "locations"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String)  # WAREHOUSE, HOSPITAL, RELIEF_CENTER
    lat = Column(Float)
    lng = Column(Float)
    capacity = Column(Integer)
    city = Column(String, default="Mumbai", index=True)      # SYNTHETIC DEMO city metadata
    state = Column(String, default="Maharashtra")


class Road(Base):
    __tablename__ = "roads"
    id = Column(String, primary_key=True, index=True)
    source_id = Column(String, ForeignKey("locations.id"))
    target_id = Column(String, ForeignKey("locations.id"))
    distance = Column(Float)
    travel_time = Column(Float)
    status = Column(String)  # OPEN, BLOCKED
    city = Column(String, index=True)  # operational sector this corridor belongs to


class Resource(Base):
    __tablename__ = "resources"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    category = Column(String)


class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(String, primary_key=True, index=True)
    location_id = Column(String, ForeignKey("locations.id"))
    resource_id = Column(String, ForeignKey("resources.id"))
    quantity = Column(Integer)


class Demand(Base):
    __tablename__ = "demands"
    id = Column(String, primary_key=True, index=True)
    location_id = Column(String, ForeignKey("locations.id"))
    resource_id = Column(String, ForeignKey("resources.id"))
    quantity = Column(Integer)
    severity = Column(Integer)
    status = Column(String)  # OPEN, PARTIAL, MET
    city = Column(String, index=True)  # operational sector the request belongs to
    incident_id = Column(String, ForeignKey("incidents.id"))


class Allocation(Base):
    __tablename__ = "allocations"
    id = Column(String, primary_key=True, index=True)
    demand_id = Column(String, ForeignKey("demands.id"))
    source_id = Column(String, ForeignKey("locations.id"))
    resource_id = Column(String, ForeignKey("resources.id"))
    quantity = Column(Integer)
    route_path = Column(String)  # JSON string array
    status = Column(String)  # AVAILABLE, DISPATCHED, IN_TRANSIT, DELIVERED, VERIFIED, STALE
    explanation = Column(String)
    city = Column(String, index=True)  # operational sector the dispatch belongs to
    dispatched_at = Column(DateTime)


class Incident(Base):
    """Operational emergency tracked independently of an individual resource request."""

    __tablename__ = "incidents"
    id = Column(String, primary_key=True, index=True)
    city = Column(String, index=True)
    state = Column(String)
    title = Column(String)
    category = Column(String)  # EARTHQUAKE, FLOOD, LANDSLIDE, CYCLONE, HEATWAVE
    severity = Column(Integer)  # 1..5
    status = Column(String)  # ACTIVE, MONITORING, RESOLVED
    affected_population = Column(Integer)
    location_id = Column(String, ForeignKey("locations.id"))
    resource_id = Column(String, ForeignKey("resources.id"))
    opened_at = Column(DateTime)


class AuditRecord(Base):
    __tablename__ = "audit_records"
    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime)
    actor = Column(String)
    event_type = Column(String)
    payload = Column(String)  # JSON string
    previous_hash = Column(String)
    current_hash = Column(String)
    city = Column(String, index=True)  # operational sector, NULL = national/system-wide


class Fund(Base):
    __tablename__ = "funds"
    id = Column(String, primary_key=True, index=True)
    category = Column(String)
    total_amount = Column(Float)
    allocated_amount = Column(Float)
    city = Column(String, index=True)  # NULL = national pool


class SeedMeta(Base):
    """Tracks the demo dataset revision so an upgraded seed can rebuild a
    coherent baseline without discarding the audit ledger."""

    __tablename__ = "seed_meta"
    key = Column(String, primary_key=True)
    value = Column(String)