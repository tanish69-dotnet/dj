# Simulation Scenario (Hackathon Demo)

## Baseline State
- **Disaster**: Earthquake in a metro area.
- **Locations**: 2 Warehouses (W1, W2), 3 Hospitals (H1, H2, H3).
- **Network**: Local road graph connecting W1/W2 to H1/H2/H3.
- **Initial Inventory**: W1 has 100x Blood, W2 has 50x Medicine.
- **Initial Demand**: H1 needs 10x Blood (High Severity).

## Event Timeline

### T+00: Disaster Begins
- System initialized. Dashboard shows baseline state.

### T+01: Initial Allocation
- System detects H1 demand. Allocation Engine runs.
- **Action**: Allocates 10x Blood from W1 to H1.
- **Route**: W1 -> R1 -> R2 -> H1.
- **Status**: AVAILABLE.

### T+02: Affected Population Increases
- A simulation event is triggered: H2 reports a massive influx of critical patients.
- **Demand**: H2 needs 50x Blood.
- **Action**: Allocation Engine runs. W1 allocates 50x Blood to H2.

### T+06: Primary Road Blocked
- Simulation event: Road R1 (W1 -> H1 route) is BLOCKED due to debris.
- **Action**: System detects W1->H1 allocation uses R1.
- Allocation marked STALE.
- Routing Engine finds alternate route: W1 -> R4 -> R8 -> H1.
- Allocation updated with new route. Explanation states "Primary route R1 blocked".

### T+08: Tracking and Dispatch
- The user clicks "DISPATCH" for the W1->H1 shipment.
- Status changes to IN TRANSIT.
- Audit ledger records the dispatch.

### T+10: Delivery and Verification
- Shipment arrives at H1. Marked DELIVERED.
- Receiver signs off. Marked VERIFIED.
- User opens Audit Ledger to show valid SHA-256 hash chain for the entire lifecycle of this resource.
