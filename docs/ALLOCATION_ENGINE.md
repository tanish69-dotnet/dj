# Allocation Engine Design

## Overview
The Allocation Engine is the core component that matches unmet demands with available supplies across the network, while respecting constraints (road status, capacities).

## Inputs
1. **Demands**: List of unmet needs (Location, Resource, Quantity, Severity).
2. **Supplies**: List of available resources (Location, Resource, Quantity).
3. **Graph**: Current state of the road network (distances, OPEN/BLOCKED statuses).
4. **Capacities**: Hospital/Relief Center max capacity limits.

## Outputs
1. **Allocations**: Mappings of [Source -> Destination] for specific resources and amounts.
2. **Explanations**: A log of factors that led to this allocation (e.g., "Critical severity, 14 min travel time, Route OPEN").

## Constraints (Hard)
- Allocation amount <= Available supply at source.
- Allocation amount <= Unmet demand at destination.
- Destination must have capacity for the incoming resource.
- A valid OPEN path must exist between Source and Destination in the graph.

## Scoring / Heuristic Algorithm
For each demand (sorted by Priority/Severity descending):
1. Find all locations that have the requested resource in supply.
2. For each potential source:
   a. Check graph for an OPEN path to the destination. If no path, discard.
   b. Calculate travel time.
   c. Calculate a score based on: `Score = (Demand Severity * W1) - (Travel Time * W2) + (Supply Availability * W3)`
3. Select the source with the highest score.
4. Allocate the maximum possible amount (min(Demand, Supply, Capacity)).
5. Update remaining Demand, Supply, and Capacity in memory.
6. Generate Explanation record.
7. Repeat until all demands are met or supplies exhausted.

## Edge Cases
- **No feasible route**: The demand remains unmet, marked as "NO FEASIBLE ROUTE". An alert is generated.
- **Partial fulfillment**: Source has less than needed. Allocate what is available; remaining demand is matched to the next best source.

## Dynamic Reallocation
When an event occurs (e.g., road blocked):
1. Identify all allocations where status is not yet DELIVERED, and whose route uses the blocked road.
2. Mark them as STALE.
3. Add the allocated amounts back to Source Supply and Destination Demand.
4. Rerun the Allocation Engine for these demands with the updated graph.
5. Create Audit Records for the change.
