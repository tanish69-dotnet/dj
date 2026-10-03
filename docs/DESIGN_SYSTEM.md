# Design System

## Theme
- **Color Palette**: Dark theme (slate/gray backgrounds) with high-contrast accent colors for statuses.
- **Typography**: Clean sans-serif (Inter or Roboto).
- **Layout**: Map-centric. Fixed sidebar for navigation. Right panel for alerts/explanations.

## Status Colors
- **Success/Verified**: Green (`#10b981`)
- **Warning/Stale**: Amber (`#f59e0b`)
- **Danger/Blocked/Critical**: Red (`#ef4444`)
- **Info/In-Transit**: Blue (`#3b82f6`)

## Key Components
- **KPI Cards**: Minimalist, showing big numbers and trend indicators.
- **Status Badges**: Rounded pills with solid background colors to quickly indicate state.
- **Map View (Leaflet)**: Dark tiles. Nodes are circles (Hospitals=Red, Warehouses=Blue). Edges are lines (OPEN=Gray, BLOCKED=Red).
- **Explainability Panel**: Slide-out or modal containing a breakdown of the scoring formula for a specific allocation.
- **Audit Ledger Table**: Monospace fonts for hashes, highlighting the "Valid" checkmarks.

## Animations
Keep them minimal. Use Framer Motion only for:
- Entering/exiting panels.
- Route drawing on the map.
- Highlighting changed rows in tables (flash effect when reallocation occurs).
