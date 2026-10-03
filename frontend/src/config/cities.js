/**
 * Operational city configuration — mirrors backend/app/database/cities.py.
 * Single source of truth for frontend INDIA / city behavior.
 *
 * Operational coordinates are REAL city coordinates (for map centering only).
 * All resources, demands, inventories, roads, allocations are SYNTHETIC DEMO DATA.
 * None represents live government infrastructure, warehouses or emergency inventories.
 */

export const INDIA_CENTER = { lat: 20.5937, lng: 78.9629, zoom: 5 };

export const OPERATIONAL_CITIES = {
  Mumbai:        { state: "Maharashtra",    lat: 19.0760, lng: 72.8777 },
  Pune:          { state: "Maharashtra",    lat: 18.5204, lng: 73.8567 },
  Nagpur:        { state: "Maharashtra",    lat: 21.1458, lng: 79.0882 },
  "New Delhi":   { state: "Delhi",          lat: 28.6139, lng: 77.2090 },
  Bengaluru:     { state: "Karnataka",      lat: 12.9716, lng: 77.5946 },
  Chennai:       { state: "Tamil Nadu",     lat: 13.0827, lng: 80.2707 },
  Hyderabad:     { state: "Telangana",      lat: 17.3850, lng: 78.4867 },
  Ahmedabad:     { state: "Gujarat",        lat: 23.0225, lng: 72.5714 },
  Surat:         { state: "Gujarat",        lat: 21.1702, lng: 72.8311 },
  Kolkata:       { state: "West Bengal",    lat: 22.5726, lng: 88.3639 },
  Jaipur:        { state: "Rajasthan",      lat: 26.9124, lng: 75.7873 },
  Lucknow:       { state: "Uttar Pradesh",  lat: 26.8467, lng: 80.9462 },
  Varanasi:      { state: "Uttar Pradesh",  lat: 25.3176, lng: 82.9739 },
  Bhubaneswar:   { state: "Odisha",         lat: 20.2961, lng: 85.8245 },
  Kochi:         { state: "Kerala",         lat: 9.9312,  lng: 76.2673 },
  Patna:         { state: "Bihar",          lat: 25.5941, lng: 85.1376 },
  Guwahati:      { state: "Assam",          lat: 26.1445, lng: 91.7362 },
  Visakhapatnam:{ state: "Andhra Pradesh",  lat: 17.6868, lng: 83.2185 },
};

export const CITY_LIST = Object.keys(OPERATIONAL_CITIES);

/**
 * View helpers.
 *
 * `cities` defaults to the bundled map but RegionContext passes the live
 * /api/cities payload, so the dropdown and every label follow the backend.
 */
export const regionTitle = (region, cities = OPERATIONAL_CITIES) => {
  if (!region || region === "INDIA") return "INDIA DISASTER RESPONSE COMMAND CENTER";
  return `${String(region).toUpperCase()} OPERATIONAL COMMAND`;
};

export const regionSubtitle = (region, cities = OPERATIONAL_CITIES) => {
  if (!region || region === "INDIA") return "NATIONAL DISASTER RESOURCE COORDINATION & EMERGENCY LOGISTICS";
  const cfg = cities[region] ?? OPERATIONAL_CITIES[region];
  return cfg ? `${cfg.state} · OPERATIONAL SECTOR` : "OPERATIONAL COMMAND";
};

export const mapCenterFor = (region, cities = OPERATIONAL_CITIES) => {
  if (!region || region === "INDIA") return { lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng, zoom: INDIA_CENTER.zoom };
  const cfg = cities[region] ?? OPERATIONAL_CITIES[region];
  return cfg ? { lat: cfg.lat, lng: cfg.lng, zoom: 12 } : { lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng, zoom: 5 };
};
