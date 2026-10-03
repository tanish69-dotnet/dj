# Database Schema

(Using PostgreSQL / SQLite for Hackathon)

## `locations`
- `id` (PK, string)
- `name` (string)
- `type` (enum: WAREHOUSE, HOSPITAL, RELIEF_CENTER)
- `lat` (float)
- `lng` (float)
- `capacity` (int)

## `roads`
- `id` (PK, string)
- `source_id` (FK -> locations.id)
- `target_id` (FK -> locations.id)
- `distance` (float)
- `travel_time` (float)
- `status` (enum: OPEN, BLOCKED)

## `resources`
- `id` (PK, string)
- `name` (string)
- `category` (string)

## `inventory`
- `id` (PK, string)
- `location_id` (FK -> locations.id)
- `resource_id` (FK -> resources.id)
- `quantity` (int)

## `demands`
- `id` (PK, string)
- `location_id` (FK -> locations.id)
- `resource_id` (FK -> resources.id)
- `quantity` (int)
- `severity` (int, 1-5)
- `status` (enum: OPEN, PARTIAL, MET)

## `allocations`
- `id` (PK, string)
- `demand_id` (FK -> demands.id)
- `source_id` (FK -> locations.id)
- `resource_id` (FK -> resources.id)
- `quantity` (int)
- `route_path` (json array of road ids)
- `status` (enum: PENDING, DISPATCHED, IN_TRANSIT, DELIVERED, VERIFIED, STALE)
- `explanation` (text)

## `audit_records`
- `id` (PK, string)
- `timestamp` (datetime)
- `actor` (string)
- `event_type` (string)
- `payload` (json)
- `previous_hash` (string)
- `current_hash` (string)
