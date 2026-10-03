"""
Centralized operational city configuration — INDIA DISASTER RESPONSE COMMAND CENTER.

Add a new city here and it automatically becomes:
  - selectable in the frontend dropdown (via /api/cities)
  - seeded with synthetic demo operational locations, incidents, demands and stock
  - filterable on /api/dashboard, /api/locations, /api/demands, ... via ?city=...

Operational coordinates and population figures are REAL city data (map centering
and exposure scaling only). Every road, warehouse, hospital, incident, demand,
inventory row and allocation below is SYNTHETIC DEMO DATA and does not represent
live government infrastructure or inventories.
"""

INDIA_CENTER = {"lat": 20.5937, "lng": 78.9629, "zoom": 5}

OPERATIONAL_CITIES = {
    "Mumbai":        {"state": "Maharashtra",    "lat": 19.0760, "lng": 72.8777, "population": 21_670_000},
    "Pune":          {"state": "Maharashtra",    "lat": 18.5204, "lng": 73.8567, "population": 7_400_000},
    "Nagpur":        {"state": "Maharashtra",    "lat": 21.1458, "lng": 79.0882, "population": 2_900_000},
    "New Delhi":     {"state": "Delhi",          "lat": 28.6139, "lng": 77.2090, "population": 33_800_000},
    "Bengaluru":     {"state": "Karnataka",      "lat": 12.9716, "lng": 77.5946, "population": 14_000_000},
    "Chennai":       {"state": "Tamil Nadu",     "lat": 13.0827, "lng": 80.2707, "population": 11_500_000},
    "Hyderabad":     {"state": "Telangana",      "lat": 17.3850, "lng": 78.4867, "population": 10_500_000},
    "Ahmedabad":     {"state": "Gujarat",        "lat": 23.0225, "lng": 72.5714, "population": 8_600_000},
    "Surat":         {"state": "Gujarat",        "lat": 21.1702, "lng": 72.8311, "population": 7_500_000},
    "Kolkata":       {"state": "West Bengal",    "lat": 22.5726, "lng": 88.3639, "population": 15_100_000},
    "Jaipur":        {"state": "Rajasthan",      "lat": 26.9124, "lng": 75.7873, "population": 4_100_000},
    "Lucknow":       {"state": "Uttar Pradesh",  "lat": 26.8467, "lng": 80.9462, "population": 4_000_000},
    "Varanasi":      {"state": "Uttar Pradesh",  "lat": 25.3176, "lng": 82.9739, "population": 2_500_000},
    "Bhubaneswar":   {"state": "Odisha",         "lat": 20.2961, "lng": 85.8245, "population": 2_500_000},
    "Kochi":         {"state": "Kerala",         "lat": 9.9312,  "lng": 76.2673, "population": 2_100_000},
    "Patna":         {"state": "Bihar",          "lat": 25.5941, "lng": 85.1376, "population": 2_500_000},
    "Guwahati":      {"state": "Assam",          "lat": 26.1445, "lng": 91.7362, "population": 1_600_000},
    "Visakhapatnam": {"state": "Andhra Pradesh", "lat": 17.6868, "lng": 83.2185, "population": 2_000_000},
}

# Global resource catalogue. Stock levels are per-city (see CITY_SCENARIOS).
RESOURCE_CATALOG = [
    ("RES-BLOOD-O", "O-Negative Blood", "Medical"),
    ("RES-MED", "Emergency Medicine Kit", "Medical"),
    ("RES-FOOD", "MRE Rations", "Food"),
    ("RES-WATER", "Potable Water (litre)", "Water"),
    ("RES-SHELTER", "Emergency Shelter Kit", "Shelter"),
]

# Compact operational layout per city:
#   W1 / W2 — synthetic demo warehouses (stocked via CITY_SCENARIOS)
#   H1 / H2 — synthetic demo hospitals / relief centers (demand + incident sites)
CITY_LAYOUT = {
    "Mumbai": {
        "offsets": {
            "W1": (-0.035, -0.020, "Warehouse A", "WAREHOUSE", 1000),
            "W2": (-0.015,  0.000, "Warehouse B", "WAREHOUSE", 800),
            "H1": (-0.018, -0.025, "Hospital A",  "HOSPITAL", 100),
            "H2": ( 0.000, -0.021, "Hospital B",  "HOSPITAL", 200),
            "H3": ( 0.013,  0.023, "Relief Center C", "HOSPITAL", 150),
        },
        "roads": [
            ("R1", "W1", "H1", 7.0, 20.0, "OPEN"),
            ("R2", "W1", "H2", 8.0, 25.0, "OPEN"),
            ("R3", "W2", "H2", 3.0, 10.0, "OPEN"),
            ("R4", "W2", "H3", 2.5,  8.0, "OPEN"),
            ("R5", "W1", "H3", 9.0, 30.0, "OPEN"),
            ("R6", "H3", "H1", 4.0, 12.0, "OPEN"),
            ("R7", "H1", "H2", 4.8, 12.5, "OPEN"),
            ("R8", "H2", "H3", 5.4, 14.2, "OPEN"),
            ("R9", "W2", "H1", 6.5, 18.0, "OPEN"),
        ],
    },
    "Pune": {
        "offsets": {
            "W1": (-0.030, -0.010, "Warehouse A", "WAREHOUSE", 900),
            "W2": ( 0.020,  0.020, "Warehouse B", "WAREHOUSE", 700),
            "H1": (-0.015, -0.020, "Hospital A",  "HOSPITAL", 150),
            "H2": ( 0.010,  0.015, "Relief Center B", "HOSPITAL", 180),
        },
        "roads": [
            ("R1", "W1", "H1", 6.0, 18.0, "OPEN"),
            ("R2", "W1", "H2", 10.0, 26.0, "OPEN"),
            ("R3", "W2", "H2", 5.0, 14.0, "OPEN"),
            ("R4", "W2", "H1", 9.0, 24.0, "OPEN"),
            ("R5", "H1", "H2", 4.5, 12.0, "OPEN"),
            ("R6", "W1", "W2", 5.0, 13.0, "OPEN"),
        ],
    },
    "Nagpur": {
        "offsets": {
            "W1": (-0.025,  0.015, "Warehouse A", "WAREHOUSE", 750),
            "W2": ( 0.020, -0.015, "Warehouse B", "WAREHOUSE", 650),
            "H1": (-0.010, -0.020, "Hospital A",  "HOSPITAL", 120),
            "H2": ( 0.015,  0.020, "Relief Center B", "HOSPITAL", 140),
        },
        "roads": [
            ("R1", "W1", "H1", 8.0, 22.0, "OPEN"),
            ("R2", "W1", "H2", 7.0, 19.0, "OPEN"),
            ("R3", "W2", "H2", 6.0, 16.0, "OPEN"),
            ("R4", "H1", "H2", 5.0, 13.5, "OPEN"),
            ("R5", "W1", "W2", 6.5, 17.0, "OPEN"),
        ],
    },
    "New Delhi": {
        "offsets": {
            "W1": (-0.040,  0.010, "Warehouse A", "WAREHOUSE", 1200),
            "W2": ( 0.025,  0.030, "Warehouse B", "WAREHOUSE", 900),
            "H1": (-0.020, -0.030, "Hospital A",  "HOSPITAL", 250),
            "H2": ( 0.015,  0.005, "Hospital B",  "HOSPITAL", 300),
            "H3": ( 0.005, -0.020, "Relief Center C", "HOSPITAL", 160),
        },
        "roads": [
            ("R1", "W1", "H1", 9.0, 24.0, "OPEN"),
            ("R2", "W1", "H2", 7.0, 20.0, "OPEN"),
            ("R3", "W2", "H2", 4.0, 12.0, "OPEN"),
            ("R4", "W2", "H3", 6.0, 16.0, "OPEN"),
            ("R5", "W1", "H3", 8.0, 22.0, "OPEN"),
            ("R6", "H1", "H2", 5.5, 14.5, "OPEN"),
            ("R7", "H3", "H1", 4.5, 11.5, "OPEN"),
            ("R8", "W2", "H1", 8.4, 22.6, "OPEN"),
        ],
    },
    "Bengaluru": {
        "offsets": {
            "W1": (-0.030, -0.015, "Warehouse A", "WAREHOUSE", 950),
            "W2": ( 0.025,  0.025, "Warehouse B", "WAREHOUSE", 800),
            "H1": (-0.015, -0.020, "Hospital A",  "HOSPITAL", 220),
            "H2": ( 0.010,  0.015, "Hospital B",  "HOSPITAL", 180),
        },
        "roads": [
            ("R1", "W1", "H1", 7.0, 20.0, "OPEN"),
            ("R2", "W1", "H2", 9.0, 25.0, "OPEN"),
            ("R3", "W2", "H2", 5.0, 13.0, "OPEN"),
            ("R4", "W2", "H1", 8.0, 22.0, "OPEN"),
            ("R5", "H1", "H2", 4.8, 12.6, "OPEN"),
            ("R6", "W1", "W2", 5.2, 13.4, "OPEN"),
        ],
    },
    "Chennai": {
        "offsets": {
            "W1": (-0.025,  0.010, "Warehouse A", "WAREHOUSE", 880),
            "W2": ( 0.020, -0.020, "Warehouse B", "WAREHOUSE", 760),
            "H1": (-0.012, -0.018, "Hospital A",  "HOSPITAL", 200),
            "H2": ( 0.012,  0.018, "Relief Center B", "HOSPITAL", 150),
        },
        "roads": [
            ("R1", "W1", "H1", 6.5, 17.0, "OPEN"),
            ("R2", "W1", "H2", 8.5, 23.0, "OPEN"),
            ("R3", "W2", "H2", 4.5, 12.0, "OPEN"),
            ("R4", "H1", "H2", 4.6, 12.4, "OPEN"),
            ("R5", "W1", "W2", 5.4, 14.2, "OPEN"),
        ],
    },
    "Hyderabad": {
        "offsets": {
            "W1": (-0.028,  0.012, "Warehouse A", "WAREHOUSE", 920),
            "W2": ( 0.022, -0.018, "Warehouse B", "WAREHOUSE", 810),
            "H1": (-0.014, -0.022, "Hospital A",  "HOSPITAL", 210),
            "H2": ( 0.011,  0.016, "Relief Center B", "HOSPITAL", 160),
        },
        "roads": [
            ("R1", "W1", "H1", 7.5, 21.0, "OPEN"),
            ("R2", "W1", "H2", 6.0, 17.0, "OPEN"),
            ("R3", "W2", "H2", 5.5, 15.0, "OPEN"),
            ("R4", "H1", "H2", 4.9, 13.1, "OPEN"),
            ("R5", "W1", "W2", 5.9, 15.6, "OPEN"),
        ],
    },
    "Ahmedabad": {
        "offsets": {
            "W1": (-0.026, -0.012, "Warehouse A", "WAREHOUSE", 870),
            "W2": ( 0.021,  0.019, "Warehouse B", "WAREHOUSE", 790),
            "H1": (-0.013, -0.021, "Hospital A",  "HOSPITAL", 190),
            "H2": ( 0.010,  0.014, "Relief Center B", "HOSPITAL", 170),
        },
        "roads": [
            ("R1", "W1", "H1", 6.8, 18.5, "OPEN"),
            ("R2", "W1", "H2", 8.2, 22.0, "OPEN"),
            ("R3", "W2", "H2", 4.8, 12.5, "OPEN"),
            ("R4", "H1", "H2", 4.4, 11.8, "OPEN"),
            ("R5", "W1", "W2", 5.8, 15.4, "OPEN"),
            ("R6", "W2", "H1", 7.2, 19.4, "OPEN"),
        ],
    },
    "Surat": {
        "offsets": {
            "W1": (-0.024,  0.011, "Warehouse A", "WAREHOUSE", 820),
            "W2": ( 0.019, -0.016, "Warehouse B", "WAREHOUSE", 740),
            "H1": (-0.011, -0.019, "Hospital A",  "HOSPITAL", 175),
            "H2": ( 0.009,  0.013, "Relief Center B", "HOSPITAL", 145),
        },
        "roads": [
            ("R1", "W1", "H1", 6.2, 16.5, "OPEN"),
            ("R2", "W1", "H2", 7.8, 21.0, "OPEN"),
            ("R3", "W2", "H2", 4.2, 11.5, "OPEN"),
            ("R4", "H1", "H2", 4.3, 11.4, "OPEN"),
            ("R5", "W1", "W2", 5.1, 13.6, "OPEN"),
        ],
    },
    "Kolkata": {
        "offsets": {
            "W1": (-0.032, -0.014, "Warehouse A", "WAREHOUSE", 960),
            "W2": ( 0.024,  0.022, "Warehouse B", "WAREHOUSE", 830),
            "H1": (-0.016, -0.024, "Hospital A",  "HOSPITAL", 230),
            "H2": ( 0.012,  0.017, "Hospital B",  "HOSPITAL", 190),
        },
        "roads": [
            ("R1", "W1", "H1", 7.2, 19.5, "OPEN"),
            ("R2", "W1", "H2", 8.8, 24.0, "OPEN"),
            ("R3", "W2", "H2", 5.2, 14.0, "OPEN"),
            ("R4", "H1", "H2", 5.0, 13.3, "OPEN"),
            ("R5", "W1", "W2", 6.2, 16.5, "OPEN"),
            ("R6", "W2", "H1", 8.1, 21.7, "OPEN"),
        ],
    },
    "Jaipur": {
        "offsets": {
            "W1": (-0.022,  0.010, "Warehouse A", "WAREHOUSE", 780),
            "W2": ( 0.018, -0.014, "Warehouse B", "WAREHOUSE", 700),
            "H1": (-0.010, -0.018, "Hospital A",  "HOSPITAL", 165),
            "H2": ( 0.008,  0.012, "Relief Center B", "HOSPITAL", 135),
        },
        "roads": [
            ("R1", "W1", "H1", 5.8, 15.0, "OPEN"),
            ("R2", "W1", "H2", 7.4, 20.0, "OPEN"),
            ("R3", "W2", "H2", 4.0, 11.0, "OPEN"),
            ("R4", "H1", "H2", 4.1, 10.9, "OPEN"),
            ("R5", "W1", "W2", 5.0, 13.2, "OPEN"),
        ],
    },
    "Lucknow": {
        "offsets": {
            "W1": (-0.023, -0.011, "Warehouse A", "WAREHOUSE", 790),
            "W2": ( 0.017,  0.013, "Warehouse B", "WAREHOUSE", 710),
            "H1": (-0.009, -0.017, "Hospital A",  "HOSPITAL", 170),
            "H2": ( 0.007,  0.011, "Relief Center B", "HOSPITAL", 140),
        },
        "roads": [
            ("R1", "W1", "H1", 6.1, 16.0, "OPEN"),
            ("R2", "W1", "H2", 7.6, 20.5, "OPEN"),
            ("R3", "W2", "H2", 4.3, 11.8, "OPEN"),
            ("R4", "H1", "H2", 4.7, 12.6, "OPEN"),
            ("R5", "W1", "W2", 5.6, 14.9, "OPEN"),
            ("R6", "W2", "H1", 7.9, 21.1, "OPEN"),
        ],
    },
    "Varanasi": {
        "offsets": {
            "W1": (-0.020,  0.009, "Warehouse A", "WAREHOUSE", 690),
            "W2": ( 0.016, -0.012, "Warehouse B", "WAREHOUSE", 640),
            "H1": (-0.008, -0.015, "Hospital A",  "HOSPITAL", 155),
            "H2": ( 0.007,  0.010, "Relief Center B", "HOSPITAL", 130),
        },
        "roads": [
            ("R1", "W1", "H1", 5.5, 14.5, "OPEN"),
            ("R2", "W1", "H2", 7.0, 19.0, "OPEN"),
            ("R3", "W2", "H2", 3.8, 10.5, "OPEN"),
            ("R4", "H1", "H2", 4.0, 10.7, "OPEN"),
            ("R5", "W1", "W2", 4.9, 13.0, "OPEN"),
        ],
    },
    "Bhubaneswar": {
        "offsets": {
            "W1": (-0.021,  0.010, "Warehouse A", "WAREHOUSE", 680),
            "W2": ( 0.017, -0.013, "Warehouse B", "WAREHOUSE", 620),
            "H1": (-0.009, -0.016, "Hospital A",  "HOSPITAL", 150),
            "H2": ( 0.007,  0.010, "Relief Center B", "HOSPITAL", 125),
        },
        "roads": [
            ("R1", "W1", "H1", 5.6, 15.0, "OPEN"),
            ("R2", "W1", "H2", 7.2, 19.5, "OPEN"),
            ("R3", "W2", "H2", 3.9, 10.8, "OPEN"),
            ("R4", "H1", "H2", 4.2, 11.1, "OPEN"),
            ("R5", "W1", "W2", 5.3, 14.0, "OPEN"),
            ("R6", "W2", "H1", 7.6, 20.3, "OPEN"),
        ],
    },
    "Kochi": {
        "offsets": {
            "W1": (-0.018,  0.008, "Warehouse A", "WAREHOUSE", 640),
            "W2": ( 0.015, -0.010, "Warehouse B", "WAREHOUSE", 590),
            "H1": (-0.007, -0.014, "Hospital A",  "HOSPITAL", 145),
            "H2": ( 0.006,  0.009, "Relief Center B", "HOSPITAL", 120),
        },
        "roads": [
            ("R1", "W1", "H1", 5.0, 13.5, "OPEN"),
            ("R2", "W1", "H2", 6.5, 18.0, "OPEN"),
            ("R3", "W2", "H2", 3.5,  9.8, "OPEN"),
            ("R4", "H1", "H2", 3.9, 10.4, "OPEN"),
            ("R5", "W1", "W2", 4.8, 12.8, "OPEN"),
        ],
    },
    "Patna": {
        "offsets": {
            "W1": (-0.022,  0.010, "Warehouse A", "WAREHOUSE", 700),
            "W2": ( 0.017, -0.013, "Warehouse B", "WAREHOUSE", 660),
            "H1": (-0.009, -0.016, "Hospital A",  "HOSPITAL", 160),
            "H2": ( 0.008,  0.011, "Relief Center B", "HOSPITAL", 130),
        },
        "roads": [
            ("R1", "W1", "H1", 5.9, 15.5, "OPEN"),
            ("R2", "W1", "H2", 7.3, 19.8, "OPEN"),
            ("R3", "W2", "H2", 4.1, 11.2, "OPEN"),
            ("R4", "H1", "H2", 4.2, 11.3, "OPEN"),
            ("R5", "W1", "W2", 5.4, 14.4, "OPEN"),
            ("R6", "W2", "H1", 7.7, 20.7, "OPEN"),
        ],
    },
    "Guwahati": {
        "offsets": {
            "W1": (-0.020,  0.009, "Warehouse A", "WAREHOUSE", 660),
            "W2": ( 0.016, -0.012, "Warehouse B", "WAREHOUSE", 600),
            "H1": (-0.008, -0.015, "Hospital A",  "HOSPITAL", 150),
            "H2": ( 0.007,  0.010, "Relief Center B", "HOSPITAL", 125),
        },
        "roads": [
            ("R1", "W1", "H1", 5.4, 14.2, "OPEN"),
            ("R2", "W1", "H2", 6.9, 18.5, "OPEN"),
            ("R3", "W2", "H2", 3.7, 10.2, "OPEN"),
            ("R4", "H1", "H2", 3.8, 10.2, "OPEN"),
            ("R5", "W1", "W2", 4.7, 12.6, "OPEN"),
        ],
    },
    "Visakhapatnam": {
        "offsets": {
            "W1": (-0.021, -0.010, "Warehouse A", "WAREHOUSE", 720),
            "W2": ( 0.017,  0.014, "Warehouse B", "WAREHOUSE", 670),
            "H1": (-0.009, -0.016, "Hospital A",  "HOSPITAL", 155),
            "H2": ( 0.008,  0.011, "Relief Center B", "HOSPITAL", 130),
        },
        "roads": [
            ("R1", "W1", "H1", 6.0, 15.8, "OPEN"),
            ("R2", "W1", "H2", 7.5, 20.2, "OPEN"),
            ("R3", "W2", "H2", 4.2, 11.4, "OPEN"),
            ("R4", "H1", "H2", 4.5, 12.0, "OPEN"),
            ("R5", "W1", "W2", 5.7, 15.1, "OPEN"),
            ("R6", "W2", "H1", 7.8, 20.9, "OPEN"),
        ],
    },
}

# Per-city operational scenario — SYNTHETIC DEMO DATA.
#
#   blocked_road : corridor disabled at baseline (id from CITY_LAYOUT roads)
#   stock        : (warehouse_node, resource_id, gross_quantity)
#   incidents    : operational emergencies (ACTIVE / MONITORING / RESOLVED)
#   demands      : resource requests. "target" drives the intended state:
#                   OPEN    -> nothing allocated yet
#                   PARTIAL -> prealloc.qty already committed, remainder pending
#                   MET     -> fully covered by prealloc.qty
#                  prealloc.source must hold the resource and be reachable, so the
#                  seeder can resolve a real route through the routing engine.
def _d(node, resource, quantity, severity, target, prealloc=None):
    return {
        "node": node,
        "resource": resource,
        "quantity": quantity,
        "severity": severity,
        "target": target,
        "prealloc": prealloc,
    }


def _pa(source, qty, status):
    return {"source": source, "qty": qty, "status": status}


def _i(title, category, severity, status, affected, node, resource):
    return {
        "title": title,
        "category": category,
        "severity": severity,
        "status": status,
        "affected_population": affected,
        "node": node,
        "resource": resource,
    }


CITY_SCENARIOS = {
    "Mumbai": {
        "blocked_road": "R1",  # W1->H1 cut, detour via W1->H3->H1 remains feasible
        "stock": [
            ("W1", "RES-MED", 640), ("W1", "RES-WATER", 900), ("W1", "RES-SHELTER", 520),
            ("W1", "RES-BLOOD-O", 320),
            ("W2", "RES-FOOD", 1400), ("W2", "RES-BLOOD-O", 240),
        ],
        "incidents": [
            _i("Coastal flooding, Bandra reclamation belt", "FLOOD", 5, "ACTIVE", 486_000, "H1", "RES-MED"),
            _i("Monsoon road subsidence, Andheri corridor", "FLOOD", 3, "ACTIVE", 96_000, "H3", "RES-BLOOD-O"),
            _i("Cyclone watch, South Mumbai", "CYCLONE", 2, "RESOLVED", 41_000, "H2", "RES-SHELTER"),
            _i("Chawl collapse, Dharavi block", "EARTHQUAKE", 4, "ACTIVE", 168_000, "H3", "RES-SHELTER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 260, 5, "OPEN"),
            _d("H3", "RES-BLOOD-O", 90, 4, "PARTIAL", _pa("W2", 60, "IN_TRANSIT")),
            _d("H2", "RES-FOOD", 420, 3, "MET", _pa("W2", 420, "DELIVERED")),
            _d("H2", "RES-SHELTER", 150, 2, "OPEN"),
            _d("H1", "RES-BLOOD-O", 60, 3, "PARTIAL", _pa("W1", 35, "IN_TRANSIT")),
        ],
    },
    "Pune": {
        "stock": [
            ("W1", "RES-MED", 480), ("W1", "RES-WATER", 760), ("W1", "RES-SHELTER", 340),
            ("W2", "RES-FOOD", 980), ("W2", "RES-BLOOD-O", 160),
        ],
        "incidents": [
            _i("Katraj ghat slope failure", "LANDSLIDE", 4, "ACTIVE", 128_000, "H1", "RES-MED"),
            _i("Urban waterlogging, Pimpri", "FLOOD", 3, "MONITORING", 54_000, "H2", "RES-WATER"),
            _i("Heatwave advisory, Pune rural belt", "HEATWAVE", 2, "RESOLVED", 31_000, "H1", "RES-WATER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 210, 4, "OPEN"),
            _d("H2", "RES-FOOD", 380, 3, "PARTIAL", _pa("W2", 260, "DISPATCHED")),
            _d("H2", "RES-SHELTER", 90, 2, "OPEN"),
            _d("H1", "RES-WATER", 150, 2, "MET", _pa("W1", 150, "VERIFIED")),
        ],
    },
    "Nagpur": {
        "stock": [
            ("W1", "RES-MED", 320), ("W1", "RES-WATER", 540),
            ("W2", "RES-FOOD", 760), ("W2", "RES-SHELTER", 210),
        ],
        "incidents": [
            _i("Village flood relief, Nagpur rural", "FLOOD", 3, "ACTIVE", 62_000, "H2", "RES-FOOD"),
            _i("Heatwave, Vidarbha belt", "HEATWAVE", 4, "ACTIVE", 48_000, "H1", "RES-WATER"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 300, 3, "OPEN"),
            _d("H1", "RES-WATER", 180, 4, "PARTIAL", _pa("W1", 100, "IN_TRANSIT")),
            _d("H2", "RES-SHELTER", 60, 2, "MET", _pa("W2", 60, "DELIVERED")),
        ],
    },
    "New Delhi": {
        "blocked_road": "R2",  # W1->H2 cut, W2 remains the only H2 approach
        "stock": [
            ("W1", "RES-MED", 820), ("W1", "RES-WATER", 1150), ("W1", "RES-FOOD", 700),
            ("W2", "RES-FOOD", 1600), ("W2", "RES-BLOOD-O", 320), ("W2", "RES-SHELTER", 420),
        ],
        "incidents": [
            _i("Yamuna floodplain evacuation drive", "FLOOD", 5, "ACTIVE", 720_000, "H2", "RES-SHELTER"),
            _i("Structural collapse, Old Delhi block", "EARTHQUAKE", 4, "ACTIVE", 240_000, "H1", "RES-MED"),
            _i("Smog advisory, Delhi ridge", "HEATWAVE", 2, "RESOLVED", 96_000, "H3", "RES-WATER"),
            _i("Yamuna water quality breach, Wazirabad", "FLOOD", 2, "ACTIVE", 134_000, "H3", "RES-FOOD"),
        ],
        "demands": [
            _d("H2", "RES-SHELTER", 480, 5, "OPEN"),
            _d("H1", "RES-MED", 300, 4, "PARTIAL", _pa("W1", 180, "IN_TRANSIT")),
            _d("H1", "RES-WATER", 260, 2, "MET", _pa("W1", 260, "VERIFIED")),
            _d("H3", "RES-BLOOD-O", 140, 4, "OPEN"),
            _d("H3", "RES-FOOD", 240, 3, "PARTIAL", _pa("W1", 120, "IN_TRANSIT")),
        ],
    },
    "Bengaluru": {
        "stock": [
            ("W1", "RES-MED", 620), ("W1", "RES-WATER", 880),
            ("W2", "RES-FOOD", 1180), ("W2", "RES-BLOOD-O", 220), ("W2", "RES-SHELTER", 340),
        ],
        "incidents": [
            _i("Bellandur lake overflow, east corridor", "FLOOD", 4, "ACTIVE", 186_000, "H1", "RES-MED"),
            _i("Electoral duty heat stress advisory", "HEATWAVE", 3, "ACTIVE", 74_000, "H2", "RES-WATER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 240, 4, "OPEN"),
            _d("H2", "RES-FOOD", 460, 3, "PARTIAL", _pa("W2", 300, "IN_TRANSIT")),
            _d("H1", "RES-WATER", 200, 3, "OPEN"),
            _d("H2", "RES-SHELTER", 110, 2, "MET", _pa("W2", 110, "DELIVERED")),
            _d("H2", "RES-WATER", 130, 2, "PARTIAL", _pa("W1", 85, "IN_TRANSIT")),
        ],
    },
    "Chennai": {
        "stock": [
            ("W1", "RES-MED", 540), ("W1", "RES-WATER", 720),
            ("W2", "RES-FOOD", 1020), ("W2", "RES-SHELTER", 260),
        ],
        "incidents": [
            _i("Cyclone remnant flooding, north Chennai", "CYCLONE", 5, "ACTIVE", 412_000, "H2", "RES-FOOD"),
            _i("Marina shoreline surge watch", "CYCLONE", 3, "ACTIVE", 88_000, "H1", "RES-WATER"),
            _i("Marina pier collapse, Besant Nagar", "CYCLONE", 4, "ACTIVE", 64_000, "H2", "RES-FOOD"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 380, 5, "OPEN"),
            _d("H1", "RES-WATER", 220, 3, "PARTIAL", _pa("W1", 130, "DISPATCHED")),
            _d("H2", "RES-SHELTER", 95, 2, "MET", _pa("W2", 95, "VERIFIED")),
        ],
    },
    "Hyderabad": {
        "stock": [
            ("W1", "RES-MED", 500), ("W1", "RES-WATER", 660),
            ("W2", "RES-FOOD", 940), ("W2", "RES-BLOOD-O", 180),
        ],
        "incidents": [
            _i("Musi catchment flash flood", "FLOOD", 4, "ACTIVE", 238_000, "H1", "RES-MED"),
            _i("Charminar old-city heat stress", "HEATWAVE", 3, "MONITORING", 69_000, "H2", "RES-WATER"),
            _i("Water pipeline contamination alert", "FLOOD", 2, "RESOLVED", 28_000, "H2", "RES-FOOD"),
        ],
        "demands": [
            _d("H1", "RES-MED", 190, 4, "OPEN"),
            _d("H2", "RES-FOOD", 350, 3, "PARTIAL", _pa("W2", 230, "IN_TRANSIT")),
            _d("H2", "RES-WATER", 140, 2, "MET", _pa("W1", 140, "DELIVERED")),
        ],
    },
    "Ahmedabad": {
        "stock": [
            ("W1", "RES-MED", 460), ("W1", "RES-WATER", 620),
            ("W2", "RES-FOOD", 880), ("W2", "RES-SHELTER", 240),
        ],
        "incidents": [
            _i("Sabarmati riverfront surge", "FLOOD", 3, "ACTIVE", 164_000, "H2", "RES-FOOD"),
            _i("Industrial fire smoke exposure, Vatva", "HEATWAVE", 4, "MONITORING", 52_000, "H1", "RES-MED"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 320, 3, "OPEN"),
            _d("H1", "RES-MED", 170, 4, "PARTIAL", _pa("W1", 110, "DISPATCHED")),
            _d("H2", "RES-SHELTER", 80, 2, "MET", _pa("W2", 80, "VERIFIED")),
        ],
    },
    "Surat": {
        "stock": [
            ("W1", "RES-MED", 430), ("W1", "RES-WATER", 580),
            ("W2", "RES-FOOD", 830), ("W2", "RES-BLOOD-O", 150),
        ],
        "incidents": [
            _i("Surat coastal cyclone preparation", "CYCLONE", 5, "ACTIVE", 296_000, "H1", "RES-MED"),
            _i("Riverfront evacuation drill", "CYCLONE", 2, "ACTIVE", 41_000, "H2", "RES-WATER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 260, 5, "OPEN"),
            _d("H2", "RES-FOOD", 290, 2, "PARTIAL", _pa("W2", 190, "IN_TRANSIT")),
            _d("H2", "RES-WATER", 130, 2, "MET", _pa("W1", 130, "DELIVERED")),
        ],
    },
    "Kolkata": {
        "stock": [
            ("W1", "RES-MED", 680), ("W1", "RES-WATER", 920), ("W1", "RES-BLOOD-O", 260),
            ("W2", "RES-FOOD", 1240), ("W2", "RES-SHELTER", 420),
        ],
        "incidents": [
            _i("Low-lying drainage failure, East Kolkata", "FLOOD", 5, "ACTIVE", 540_000, "H2", "RES-FOOD"),
            _i("Hooghly embankment breach watch", "FLOOD", 4, "ACTIVE", 172_000, "H1", "RES-MED"),
            _i("Saltwater ingress, Sundarbans block", "FLOOD", 2, "RESOLVED", 47_000, "H2", "RES-SHELTER"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 430, 5, "OPEN"),
            _d("H1", "RES-MED", 250, 4, "PARTIAL", _pa("W1", 160, "IN_TRANSIT")),
            _d("H2", "RES-SHELTER", 130, 2, "OPEN"),
            _d("H1", "RES-BLOOD-O", 95, 3, "MET", _pa("W1", 95, "DELIVERED")),
            _d("H2", "RES-WATER", 150, 3, "PARTIAL", _pa("W1", 90, "IN_TRANSIT")),
        ],
    },
    "Jaipur": {
        "stock": [
            ("W1", "RES-MED", 360), ("W1", "RES-WATER", 500),
            ("W2", "RES-FOOD", 740), ("W2", "RES-SHELTER", 210),
        ],
        "incidents": [
            _i("Aravalli quarry wall collapse", "LANDSLIDE", 4, "ACTIVE", 98_000, "H1", "RES-MED"),
            _i("Summer heat alert, Jaipur rural", "HEATWAVE", 3, "ACTIVE", 36_000, "H2", "RES-WATER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 150, 4, "OPEN"),
            _d("H2", "RES-FOOD", 270, 3, "PARTIAL", _pa("W2", 180, "DISPATCHED")),
            _d("H2", "RES-SHELTER", 70, 2, "MET", _pa("W2", 70, "VERIFIED")),
        ],
    },
    "Lucknow": {
        "stock": [
            ("W1", "RES-MED", 370), ("W1", "RES-WATER", 510),
            ("W2", "RES-FOOD", 760), ("W2", "RES-SHELTER", 220),
        ],
        "incidents": [
            _i("Gomti floodplain spillover", "FLOOD", 4, "ACTIVE", 104_000, "H2", "RES-FOOD"),
            _i("Extreme heat, Awadh corridor", "HEATWAVE", 3, "ACTIVE", 39_000, "H1", "RES-WATER"),
            _i("Post-monsoon vector surge", "FLOOD", 2, "RESOLVED", 22_000, "H1", "RES-MED"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 280, 4, "OPEN"),
            _d("H1", "RES-WATER", 160, 3, "PARTIAL", _pa("W1", 100, "IN_TRANSIT")),
            _d("H2", "RES-SHELTER", 75, 2, "MET", _pa("W2", 75, "DELIVERED")),
            _d("H1", "RES-MED", 120, 3, "OPEN"),
        ],
    },
    "Varanasi": {
        "stock": [
            ("W1", "RES-MED", 300), ("W1", "RES-WATER", 430),
            ("W2", "RES-FOOD", 660), ("W2", "RES-SHELTER", 190),
        ],
        "incidents": [
            _i("Ganga ghats water level surge", "FLOOD", 4, "ACTIVE", 76_000, "H2", "RES-WATER"),
            _i("Riverbank embankment erosion", "FLOOD", 3, "MONITORING", 27_000, "H1", "RES-MED"),
        ],
        "demands": [
            _d("H2", "RES-WATER", 170, 4, "OPEN"),
            _d("H1", "RES-MED", 120, 3, "PARTIAL", _pa("W1", 80, "DISPATCHED")),
            _d("H2", "RES-SHELTER", 60, 2, "MET", _pa("W2", 60, "VERIFIED")),
        ],
    },
    "Bhubaneswar": {
        "stock": [
            ("W1", "RES-MED", 310), ("W1", "RES-WATER", 440),
            ("W2", "RES-FOOD", 670), ("W2", "RES-SHELTER", 195),
        ],
        "incidents": [
            _i("Coastal cyclone evacuation, Puri corridor", "CYCLONE", 5, "ACTIVE", 112_000, "H2", "RES-SHELTER"),
            _i("Mahanadi basin flooding", "FLOOD", 3, "MONITORING", 33_000, "H1", "RES-WATER"),
            _i("Cyclone early warning drill", "CYCLONE", 2, "RESOLVED", 19_000, "H1", "RES-MED"),
        ],
        "demands": [
            _d("H2", "RES-SHELTER", 95, 5, "OPEN"),
            _d("H1", "RES-WATER", 175, 3, "PARTIAL", _pa("W1", 105, "IN_TRANSIT")),
            _d("H1", "RES-MED", 115, 2, "MET", _pa("W1", 115, "DELIVERED")),
        ],
    },
    "Kochi": {
        "blocked_road": "R1",  # sole W1->H1 corridor cut, H1 deliberately stranded
        "stock": [
            ("W1", "RES-MED", 290), ("W1", "RES-WATER", 420),
            ("W2", "RES-FOOD", 610), ("W2", "RES-SHELTER", 180),
        ],
        "incidents": [
            _i("Monsoon backwater, Kuttanad", "FLOOD", 4, "ACTIVE", 64_000, "H2", "RES-FOOD"),
            _i("Hospital access corridor cut, Mattancherry", "FLOOD", 5, "MONITORING", 21_000, "H1", "RES-MED"),
            _i("Cyclone watch, Alappuzha", "CYCLONE", 2, "RESOLVED", 14_000, "H2", "RES-SHELTER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 105, 5, "OPEN"),
            _d("H2", "RES-FOOD", 240, 4, "OPEN"),
            _d("H2", "RES-SHELTER", 55, 2, "PARTIAL", _pa("W2", 35, "DISPATCHED")),
            _d("H2", "RES-WATER", 130, 2, "MET", _pa("W1", 130, "DELIVERED")),
            _d("H2", "RES-FOOD", 160, 2, "PARTIAL", _pa("W2", 100, "IN_TRANSIT")),
        ],
    },
    "Patna": {
        "stock": [
            ("W1", "RES-MED", 320), ("W1", "RES-WATER", 450),
            ("W2", "RES-FOOD", 690), ("W2", "RES-SHELTER", 200),
        ],
        "incidents": [
            _i("Kosi belt flood relief", "FLOOD", 5, "ACTIVE", 148_000, "H2", "RES-FOOD"),
            _i("Waterlogging, Patna urban block", "FLOOD", 3, "ACTIVE", 42_000, "H1", "RES-WATER"),
            _i("Heatwave advisory, Nalanda", "HEATWAVE", 2, "RESOLVED", 23_000, "H2", "RES-SHELTER"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 300, 5, "OPEN"),
            _d("H1", "RES-WATER", 165, 3, "PARTIAL", _pa("W1", 95, "IN_TRANSIT")),
            _d("H2", "RES-SHELTER", 65, 2, "MET", _pa("W2", 65, "VERIFIED")),
            _d("H1", "RES-MED", 125, 3, "OPEN"),
            _d("H2", "RES-MED", 150, 3, "PARTIAL", _pa("W1", 95, "IN_TRANSIT")),
        ],
    },
    "Guwahati": {
        "blocked_road": "R1",  # sole W1->H1 corridor cut, H1 deliberately stranded
        "stock": [
            ("W1", "RES-MED", 280), ("W1", "RES-WATER", 400),
            ("W2", "RES-FOOD", 580), ("W2", "RES-SHELTER", 170),
        ],
        "incidents": [
            _i("Brahmaputra embankment breach, North Guwahati", "FLOOD", 5, "ACTIVE", 92_000, "H2", "RES-FOOD"),
            _i("Hospital access corridor cut, Nilambari", "FLOOD", 4, "ACTIVE", 17_000, "H1", "RES-MED"),
            _i("Post-flood water contamination", "FLOOD", 2, "RESOLVED", 12_000, "H2", "RES-WATER"),
        ],
        "demands": [
            _d("H1", "RES-MED", 95, 4, "OPEN"),
            _d("H2", "RES-FOOD", 230, 5, "OPEN"),
            _d("H2", "RES-WATER", 120, 3, "PARTIAL", _pa("W1", 70, "DISPATCHED")),
            _d("H2", "RES-SHELTER", 50, 2, "MET", _pa("W2", 50, "DELIVERED")),
        ],
    },
    "Visakhapatnam": {
        "stock": [
            ("W1", "RES-MED", 330), ("W1", "RES-WATER", 460),
            ("W2", "RES-FOOD", 700), ("W2", "RES-SHELTER", 205),
        ],
        "incidents": [
            _i("Cyclone landfall, north Andhra coast", "CYCLONE", 5, "ACTIVE", 104_000, "H2", "RES-FOOD"),
            _i("Port corridor landslide", "LANDSLIDE", 3, "ACTIVE", 31_000, "H1", "RES-MED"),
            _i("Highland evacuation, Araku line", "LANDSLIDE", 4, "ACTIVE", 26_000, "H2", "RES-SHELTER"),
            _i("Cyclone preparedness drill", "CYCLONE", 2, "RESOLVED", 20_000, "H2", "RES-SHELTER"),
        ],
        "demands": [
            _d("H2", "RES-FOOD", 310, 5, "OPEN"),
            _d("H1", "RES-MED", 130, 3, "PARTIAL", _pa("W1", 85, "IN_TRANSIT")),
            _d("H2", "RES-SHELTER", 60, 2, "MET", _pa("W2", 60, "DELIVERED")),
            _d("H1", "RES-WATER", 150, 2, "OPEN"),
        ],
    },
}