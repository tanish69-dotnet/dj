# Demo Script

1. **Start Screen**: Show the dashboard at baseline (T+00). Point out the KPI metrics and the valid Audit Ledger.
2. **Initial Allocation**: Trigger the first demand. Show how the engine allocates resources. Open the "Explain" panel to show *why* the decision was made.
3. **Condition Change (Demand Spike)**: Trigger a simulation event increasing affected population at a hospital. Show the system react and allocate more resources.
4. **Condition Change (Route Failure)**: Trigger the "Road Blocked" event on the primary route.
5. **Reallocation**: Show the system mark the old allocation as STALE, recompute, and select an alternate route. Explain the new decision.
6. **Tracking Lifecycle**: Select an allocation and click "Dispatch". Watch it move to IN TRANSIT, then DELIVERED, then VERIFIED.
7. **Audit Ledger**: Open the Audit Ledger. Show the sequence of events (including the reallocation and delivery verification) and demonstrate the unbroken SHA-256 hash chain.
