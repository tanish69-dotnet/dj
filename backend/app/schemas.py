from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class LocationBase(BaseModel):
    id: str
    name: str
    type: str
    lat: float
    lng: float
    capacity: int
    city: Optional[str] = None
    state: Optional[str] = None


class Location(LocationBase):
    class Config:
        from_attributes = True


class RoadBase(BaseModel):
    id: str
    source_id: str
    target_id: str
    distance: float
    travel_time: float
    status: str
    city: Optional[str] = None


class Road(RoadBase):
    class Config:
        from_attributes = True


class ResourceBase(BaseModel):
    id: str
    name: str
    category: str


class InventoryBase(BaseModel):
    id: str
    location_id: str
    resource_id: str
    quantity: int


class DemandBase(BaseModel):
    id: str
    location_id: str
    resource_id: str
    quantity: int
    severity: int
    status: str
    city: Optional[str] = None
    incident_id: Optional[str] = None


class AllocationBase(BaseModel):
    id: str
    demand_id: str
    source_id: str
    resource_id: str
    quantity: int
    route_path: str
    status: str
    explanation: str
    city: Optional[str] = None
    dispatched_at: Optional[datetime] = None


class IncidentBase(BaseModel):
    id: str
    city: Optional[str] = None
    state: Optional[str] = None
    title: str
    category: str
    severity: int
    status: str
    affected_population: int
    location_id: Optional[str] = None
    resource_id: Optional[str] = None
    opened_at: Optional[datetime] = None


class Resource(ResourceBase):
    class Config:
        from_attributes = True


class Inventory(InventoryBase):
    class Config:
        from_attributes = True


class Demand(DemandBase):
    class Config:
        from_attributes = True


class Allocation(AllocationBase):
    class Config:
        from_attributes = True


class Incident(IncidentBase):
    class Config:
        from_attributes = True


class AuditRecordBase(BaseModel):
    id: str
    timestamp: datetime
    actor: str
    event_type: str
    payload: str
    previous_hash: str
    current_hash: str
    city: Optional[str] = None


class AuditRecord(AuditRecordBase):
    class Config:
        from_attributes = True


class FundBase(BaseModel):
    id: str
    category: str
    total_amount: float
    allocated_amount: float
    city: Optional[str] = None


class Fund(FundBase):
    class Config:
        from_attributes = True