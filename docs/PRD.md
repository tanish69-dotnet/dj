# Product Requirements Document (PRD)

## 1. Executive Summary
The Intelligent and Transparent Disaster Relief Resource Allocation platform is a constraint-aware engine that dynamically allocates scarce emergency resources based on evolving real-world conditions (affected population, severity, hospital capacity, road accessibility, etc.).

## 2. Problem Statement
During disasters, resource allocation is often inefficient, static, and opaque. When conditions change (e.g., roads blocked, demand increases), static allocations fail. There is a need for a dynamic, explainable system to optimize resource distribution and track it with an immutable audit trail.

## 3. Target Users
- Incident Commander / Admin
- Relief Agency
- Hospital / Relief Center
- Logistics Operator
- Donor / Funding Partner
- Public Viewer

## 4. User Personas
- **Commander**: Needs an overview of the disaster and the ability to orchestrate overall resources.
- **Logistics**: Needs reliable, feasible routes and the ability to track shipments.
- **Hospital Admin**: Needs to request supplies and see incoming shipments.
- **Public**: Wants transparency on resource and fund utilization.

## 5. Goals
- Provide dynamic, constraint-aware resource allocation.
- Enable dynamic reallocation based on changing conditions.
- Implement an explainable allocation engine.
- Create a deterministic routing engine with fallback support.
- Maintain a tamper-evident audit ledger using SHA-256 hash chaining.

## 6. Non-Goals
- Full blockchain implementation.
- Real-time payment gateway integration.
- True AI black-box predictive modeling (must remain explainable heuristics).
- Connecting to live government APIs for the hackathon.

## 7. Core Features
- Live Disaster Map and Dashboard.
- Constraint-Aware Allocation Engine.
- Deterministic Routing with Alternate Routes.
- Resource Lifecycle Tracking (Available -> Verified).
- Explainability Panel ("Why this decision?").
- Tamper-evident Audit Ledger.
- Fund Tracking Simulator.

## 8. User Stories
- As a Commander, I want to see a live view of the disaster, so I know where to focus efforts.
- As a Hospital Admin, I want to report changing capacity, so I receive appropriate supplies.
- As a Logistics Operator, I want to see if my route is blocked and get an alternate route.
- As a Public Viewer, I want to verify that delivered resources and funds have valid hash chains.

## 9. Functional Requirements
- **Allocation**: Must respect supply, demand, compatibility, capacity, and road status constraints.
- **Reallocation**: Must mark stale allocations and compute alternatives upon condition changes.
- **Routing**: Must compute shortest/fastest paths and handle blocked edges dynamically.
- **Tracking**: Must update state and record events to the audit ledger.

## 10. Non-Functional Requirements
- **Explainability**: Decision factors must be visible for all allocations.
- **Performance**: Recalculations should target affected regions only; demo must be responsive.
- **Privacy**: No PII exposed; use role-based visibility.

## 11. Constraints
- Hackathon deadline.
- Must work entirely offline/locally without external API dependencies.

## 12. Success Criteria
- The system correctly allocates resources based on constraints.
- Reallocation correctly triggers on simulated events (e.g., road blocked).
- All resource movements are properly tracked and verified.
- The audit ledger is correctly chained and verifiable.

## 13. Risks
- Route calculation taking too long (mitigated by deterministic small local graph).
- Complex UI state (mitigated by clean, paginated components and constrained state).

## 14. MVP Scope (Hackathon)
- Basic dashboard and map.
- Allocation and Routing Engines for a static local dataset.
- Simulation of a few events (road block, demand spike).
- Tracking and Audit Ledger.

## 15. Future Scope
- Real-time integrations with external APIs.
- Advanced optimization models (OR-Tools, MILP).
- True blockchain integration.

## 16. Hackathon Demo Scenario
1. Start disaster.
2. Initial allocation.
3. Increase population / demand.
4. Recalculate allocation.
5. Block important road.
6. Alternate routing shown.
7. Decision explanation opened.
8. Dispatch and track to DELIVERED and VERIFIED.
9. Validate hash chain in Audit Ledger.
