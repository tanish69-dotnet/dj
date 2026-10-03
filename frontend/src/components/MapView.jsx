import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { api } from '../services/api';
import { useRegion } from '../context/RegionContext';
import { Search, Layers, Maximize2 } from 'lucide-react';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const warehouseIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const demandIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

// INDIA city hub: compact dark badge with optional incident count
const cityHubIcon = (city, incidentCount) => {
  const badge = incidentCount > 0
    ? `<span style="background:#EF4444;color:#fff;font-size:9px;font-weight:700;border-radius:999px;padding:1px 5px;min-width:14px;text-align:center;display:inline-block;">${incidentCount}</span>`
    : '';
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;gap:5px;background:rgba(11,17,27,0.96);border:1px solid #1E2D42;border-radius:6px;padding:4px 7px;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.45)"><span style="width:7px;height:7px;border-radius:50%;background:${incidentCount > 0 ? '#EF4444' : '#00D4FF'};display:inline-block;flex-shrink:0;box-shadow:0 0 6px ${incidentCount > 0 ? 'rgba(239,68,68,0.6)' : 'rgba(0,212,255,0.5)'}"></span><span style="font-size:10px;font-weight:700;color:#F0F4FA;font-family:monospace;letter-spacing:0.02em">${city}</span>${badge}</div>`,
    className: 'city-hub-label',
    iconAnchor: [42, 12],
  });
};

function RecenterMap({ center, zoom, fitToken, positions }) {
  const map = useMap();
  useEffect(() => { map.setView([center[0], center[1]], zoom); }, [map, center, zoom]);
  useEffect(() => {
    if (!fitToken || !positions.length) return;
    map.fitBounds(positions, { padding: [40, 40], maxZoom: zoom });
  }, [map, fitToken, positions, zoom]);
  return null;
}

// Layer definitions — single source of truth for renderer + legend
const LAYER_DEFS = [
  { key: 'cityHub',        label: 'OPERATIONAL CITY',      color: '#00D4FF', style: 'dot' },
  { key: 'activeIncident', label: 'ACTIVE INCIDENT',       color: '#EF4444', style: 'dot-pulse' },
  { key: 'hospital',       label: 'HOSPITAL / RELIEF CENTER', color: '#EF4444', style: 'pin-red' },
  { key: 'warehouse',      label: 'WAREHOUSE / DEPOT',     color: '#3B82F6', style: 'pin-blue' },
  { key: 'activeDemand',   label: 'UNMET DEMAND',          color: '#F59E0B', style: 'pin-orange' },
  { key: 'activeRoute',    label: 'OPEN CORRIDOR',         color: '#00D4FF', style: 'line-solid' },
  { key: 'blockedRoad',    label: 'BLOCKED CORRIDOR',      color: '#EF4444', style: 'line-dashed-red' },
  { key: 'alternateRoute', label: 'ALTERNATE ROUTE',       color: '#F59E0B', style: 'line-dashed-yellow' },
];

const LegendSwatch = ({ style, color }) => {
  if (style === 'dot' || style === 'dot-pulse') return <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color, boxShadow: style === 'dot-pulse' ? `0 0 6px ${color}` : undefined }} />;
  if (style === 'pin-red') return <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#EF4444' }} />;
  if (style === 'pin-blue') return <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#3B82F6' }} />;
  if (style === 'pin-orange') return <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#F59E0B' }} />;
  if (style === 'line-solid') return <span className="w-6 h-0.5 inline-block" style={{ background: color }} />;
  if (style === 'line-dashed-red') return <span className="w-6 h-0.5 inline-block" style={{ borderTop: `2px dashed ${color}` }} />;
  if (style === 'line-dashed-yellow') return <span className="w-6 h-0.5 inline-block" style={{ borderTop: `2px dashed ${color}` }} />;
  return null;
};

export default function MapView({ selectedAllocation }){
  const { region, setRegion, cityList, cities, mapCenter } = useRegion();
  const { lat, lng, zoom } = mapCenter;
  const center = useMemo(() => [lat, lng], [lat, lng]);
  const isIndia = region === "INDIA";

  const [locations, setLocations] = useState([]);
  const [roads, setRoads] = useState([]);
  const [demands, setDemands] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [alternateEdges, setAlternateEdges] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showLayers, setShowLayers] = useState(true);
  const [fitToken, setFitToken] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState(() => new Set(LAYER_DEFS.map(l => l.key)));

  useEffect(() => {
    let cancelled = false;
    const fetchMapData = async () => {
      try {
        const city = region === "INDIA" ? undefined : region;
        const [locs, rds, dmds, incs, allocs] = await Promise.all([
          api.getLocations(city),
          api.getRoads(city),
          api.getDemands(city),
          api.getIncidents(city),
          api.getAllocations(city),
        ]);
        if (cancelled) return;
        setLocations(locs.data);
        setRoads(rds.data);
        setDemands(dmds.data);
        setIncidents(incs.data);
        setAllocations(allocs.data);
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoaded(true); }
    };
    setLoaded(false);
    fetchMapData();
    const int = setInterval(fetchMapData, 5000);
    return () => { cancelled = true; clearInterval(int); };
  }, [region]);

  // Real fallback corridors for the selected dispatch — resolved by the routing
  // engine, so the legend never labels the primary path as an alternate.
  useEffect(() => {
    let cancelled = false;
    if (!selectedAllocation?.id || isIndia) { setAlternateEdges([]); return; }
    api.getAllocationRoutes(selectedAllocation.id)
      .then(({ data }) => {
        if (cancelled) return;
        const primary = new Set(data?.primary?.path_edges || []);
        const edges = (data?.alternates || [])
          .flatMap(a => a.path_edges || [])
          .filter(id => !primary.has(id));
        setAlternateEdges([...new Set(edges)]);
      })
      .catch(() => { if (!cancelled) setAlternateEdges([]); });
    return () => { cancelled = true; };
  }, [selectedAllocation?.id, selectedAllocation?.route_path, isIndia]);

  // Incident count per city at INDIA zoom (from synthetic demands → location.city)
  const incidentByCity = useMemo(() => {
    const m = {};
    const locCity = Object.fromEntries(locations.map(l => [l.id, l.city]));
    demands.filter(d => d.status === 'OPEN' || d.status === 'PARTIAL').forEach(d => {
      const c = locCity[d.location_id];
      if (c) m[c] = (m[c] || 0) + 1;
    });
    // Live incidents reported by the backend for each sector.
    incidents.filter(i => i.status === 'ACTIVE' || i.status === 'MONITORING').forEach(i => {
      if (i.city) m[i.city] = (m[i.city] || 0) + 1;
    });
    return m;
  }, [demands, locations, incidents]);

  const demandLocations = useMemo(() =>
    demands.filter(d => d.status === 'OPEN' || d.status === 'PARTIAL').map(d => {
      const loc = locations.find(l => l.id === d.location_id);
      return loc ? { ...loc, demand: d } : null;
    }).filter(Boolean),
  [demands, locations]);

  // Incident markers at city zoom, anchored on the site named by the incident.
  const incidentMarkers = useMemo(() => incidents
    .filter(i => i.status === 'ACTIVE' || i.status === 'MONITORING')
    .map(i => {
      const loc = locations.find(l => l.id === i.location_id);
      return loc ? { ...i, lat: loc.lat, lng: loc.lng, locName: loc.name } : null;
    })
    .filter(Boolean),
  [incidents, locations]);

  // Derive which layers are actually present in current data
  const presentLayers = useMemo(() => {
    const s = new Set();
    if (isIndia) {
      s.add('cityHub');
      if (Object.values(incidentByCity).some(v => v > 0)) s.add('activeIncident');
    } else {
      if (locations.some(l => l.type === 'HOSPITAL')) s.add('hospital');
      if (locations.some(l => l.type === 'WAREHOUSE')) s.add('warehouse');
      if (incidentMarkers.length > 0) s.add('activeIncident');
      // Only when an unmet demand actually has a resolved marker to render.
      if (demandLocations.length > 0) s.add('activeDemand');
    }
    if (roads.some(r => r.status === 'OPEN')) s.add('activeRoute');
    if (roads.some(r => r.status === 'BLOCKED')) s.add('blockedRoad');
    if (alternateEdges.length > 0) s.add('alternateRoute');
    return s;
  }, [isIndia, incidentByCity, locations, incidentMarkers, demandLocations, roads, alternateEdges]);

  const visibleLegend = useMemo(() =>
    LAYER_DEFS.filter(l => presentLayers.has(l.key) && visibleLayers.has(l.key)),
  [presentLayers, visibleLayers]);

  // Search filtering — matches city names, location names, resource ids
  const filteredCities = useMemo(() => {
    if (!search.trim() || !isIndia) return null;
    const q = search.toLowerCase();
    return cityList.filter(c => c.toLowerCase().includes(q));
  }, [search, isIndia, cityList]);

  const filteredLocations = useMemo(() => {
    if (!search.trim() || isIndia) return null;
    const q = search.toLowerCase();
    return locations.filter(l => l.name.toLowerCase().includes(q) || (l.city||'').toLowerCase().includes(q));
  }, [search, isIndia, locations]);

  // Bounds used by the "Fit" control: the operational city at national zoom,
  // every loaded site at city zoom.
  const fitPositions = useMemo(() => {
    if (isIndia) return cityList.map(c => [cities[c]?.lat, cities[c]?.lng]).filter(p => p[0] != null);
    return locations.map(l => [l.lat, l.lng]);
  }, [isIndia, cityList, cities, locations]);

  const toggleLayer = (k) => setVisibleLayers(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  if (!loaded) return (
    <div className="w-full h-full flex items-center justify-center bg-[#070B14]">
      <div className="text-center"><div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-[#8B9CB3] text-sm">Loading map data...</p></div>
    </div>
  );

  const getMarkerIcon = (loc) => {
    if (loc.type === 'WAREHOUSE') return warehouseIcon;
    if (loc.type === 'HOSPITAL') return hospitalIcon;
    return new L.Icon.Default();
  };

  const showHospitals = !isIndia && visibleLayers.has('hospital');
  const showWarehouses = !isIndia && visibleLayers.has('warehouse');
  const showDemands = !isIndia && visibleLayers.has('activeDemand');

  return (
    <div className="relative w-full h-full">
      <MapContainer
        key={`${region}-${zoom}`}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', backgroundColor: '#070B14' }}
        zoomControl={false}
        attributionControl={true}
      >
        <RecenterMap center={center} zoom={zoom} fitToken={fitToken} positions={fitPositions} />
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' maxZoom={19} />

        {/* INDIA: operational city hubs with incident badges */}
        {isIndia && visibleLayers.has('cityHub') && cityList
          .filter(city => !filteredCities || filteredCities.includes(city))
          .map(city => {
            const cfg = cities[city] || {};
            return (
          <Marker key={`hub-${city}`} position={[cfg.lat, cfg.lng]} icon={cityHubIcon(city, incidentByCity[city] || 0)} eventHandlers={{ click: () => setRegion(city) }}>
            <Popup>
              <div className="text-white text-sm min-w-[160px]">
                <div className="font-semibold text-[#00D4FF] mb-1">{city} — {cfg.state}</div>
                <div className="text-[#8B9CB3] text-xs">Active incidents: {incidentByCity[city] || 0}</div>
                <div className="text-[#8B9CB3] text-xs">Population: {(cfg.population ?? 0).toLocaleString()}</div>
                <div className="text-[#5A6E85] text-[10px]">SYNTHETIC DEMO · Click to enter {city} operations</div>
              </div>
            </Popup>
          </Marker>
            );
          })}

        {/* Corridors */}
        {visibleLayers.has('activeRoute') && roads.filter(r => r.status === 'OPEN').map(r => {
          const src = locations.find(l => l.id === r.source_id);
          const tgt = locations.find(l => l.id === r.target_id);
          if (!src || !tgt) return null;
          return (
            <Polyline key={r.id} positions={[[src.lat, src.lng], [tgt.lat, tgt.lng]]}
              color="#00D4FF" weight={2} opacity={0.45}>
              <Popup><div className="text-white text-sm"><strong>{r.id}</strong><br/>Status: {r.status}<br/>Travel: {r.travel_time} mins</div></Popup>
            </Polyline>
          );
        })}
        {visibleLayers.has('blockedRoad') && roads.filter(r => r.status === 'BLOCKED').map(r => {
          const src = locations.find(l => l.id === r.source_id);
          const tgt = locations.find(l => l.id === r.target_id);
          if (!src || !tgt) return null;
          return (
            <Polyline key={`b-${r.id}`} positions={[[src.lat, src.lng], [tgt.lat, tgt.lng]]}
              color="#EF4444" weight={3} dashArray="8,6" opacity={0.85}>
              <Popup><div className="text-white text-sm"><strong>{r.id} — BLOCKED</strong><br/>Travel: {r.travel_time} mins</div></Popup>
            </Polyline>
          );
        })}
        {/* Genuine fallback corridors resolved by the routing engine */}
        {visibleLayers.has('alternateRoute') && alternateEdges.map(id => {
          const r = roads.find(road => road.id === id);
          if (!r) return null;
          const src = locations.find(l => l.id === r.source_id);
          const tgt = locations.find(l => l.id === r.target_id);
          if (!src || !tgt) return null;
          return (
            <Polyline key={`alt-${r.id}`} positions={[[src.lat, src.lng], [tgt.lat, tgt.lng]]}
              color="#F59E0B" weight={4} dashArray="6,6" opacity={0.95}>
              <Popup><div className="text-white text-sm"><strong>{r.id} — ALTERNATE</strong><br/>Feasible fallback corridor</div></Popup>
            </Polyline>
          );
        })}

        {/* City-level location markers — hidden at INDIA zoom to prevent clutter */}
        {!isIndia && locations.filter(l => {
          if (filteredLocations && !filteredLocations.find(f => f.id === l.id)) return false;
          if (l.type === 'HOSPITAL' && !showHospitals) return false;
          if (l.type === 'WAREHOUSE' && !showWarehouses) return false;
          return true;
        }).map(loc => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={getMarkerIcon(loc)}>
            <Popup>
              <div className="text-white text-sm min-w-[180px]">
                <div className="font-semibold text-white mb-1">{loc.name}</div>
                <div className="text-[#8B9CB3] text-xs">Type: {loc.type} · City: {loc.city} · {loc.state}</div>
                <div className="text-[#8B9CB3] text-xs">Capacity: {loc.capacity}</div>
                <div className="text-[#5A6E85] text-[10px]">SYNTHETIC DEMO</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {showDemands && demandLocations.filter(dl => !filteredLocations || filteredLocations.find(f => f.id === dl.id)).map(dloc => (
          <Marker key={`demand-${dloc.demand?.id || dloc.id}`} position={[dloc.lat, dloc.lng]} icon={demandIcon}>
            <Popup>
              <div className="text-white text-sm min-w-[180px]">
                <div className="font-semibold text-orange-400 mb-1">⚠ Unmet Demand</div>
                <div className="text-[#8B9CB3] text-xs">Location: {dloc.name} ({dloc.city})</div>
                <div className="text-[#8B9CB3] text-xs">Resource: {dloc.demand.resource_id} · Need {dloc.demand.quantity} · Sev: {dloc.demand.severity}/5 · {dloc.demand.status}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live incidents reported for this sector */}
        {!isIndia && visibleLayers.has('activeIncident') && incidentMarkers.map(inc => (
          <CircleMarker key={inc.id} center={[inc.lat, inc.lng]} radius={8}
            pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.35, weight: 2 }}>
            <Popup>
              <div className="text-white text-sm min-w-[180px]">
                <div className="font-semibold text-red-400 mb-1">⚠ {inc.title}</div>
                <div className="text-[#8B9CB3] text-xs">Category: {inc.category} · Severity: {inc.severity}/5</div>
                <div className="text-[#8B9CB3] text-xs">Status: {inc.status} · Exposed: {(inc.affected_population ?? 0).toLocaleString()}</div>
                <div className="text-[#8B9CB3] text-xs">Site: {inc.locName}</div>
                <div className="text-[#5A6E85] text-[10px]">SYNTHETIC DEMO</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Top bar: search + layer toggle + fit + live badge */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 flex-wrap pointer-events-none">
        <div className="flex items-center gap-2 bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg px-2.5 py-1.5 backdrop-blur-sm shadow-lg pointer-events-auto">
          <Search size={12} className="text-[#5A6E85]" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isIndia ? "Search city…" : "Search location…"} className="bg-transparent outline-none text-xs text-white placeholder:text-[#5A6E85] w-[140px]" />
          {search && <button onClick={()=>setSearch("")} className="text-[#5A6E85] hover:text-white text-xs">✕</button>}
        </div>
        <button onClick={()=>setShowLayers(v=>!v)} className="pointer-events-auto flex items-center gap-1.5 bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg px-2.5 py-1.5 text-xs text-[#8B9CB3] hover:text-white backdrop-blur-sm">
          <Layers size={12} /> Layers
        </button>
        <button
          onClick={() => setFitToken(t => t + 1)}
          className="pointer-events-auto flex items-center gap-1.5 bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg px-2.5 py-1.5 text-xs text-[#8B9CB3] hover:text-white backdrop-blur-sm"
          title={isIndia ? "Fit India" : `Fit ${region}`}
        >
          <Maximize2 size={12} /> {isIndia ? "Fit India" : `Fit ${region}`}
        </button>
        <div className="ml-auto flex items-center gap-2 bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg px-3 py-1.5 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[11px] font-mono text-white">{isIndia ? 'INDIA OVERVIEW' : `${region.toUpperCase()} OPERATIONS`}</span>
          <span className="text-[10px] text-[#5A6E85]">· SYNTHETIC DEMO</span>
        </div>
      </div>

      {/* Layer panel */}
      {showLayers && (
        <div className="absolute top-[52px] left-3 z-[1000] bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg p-3 backdrop-blur-sm shadow-xl min-w-[220px]">
          <div className="text-[10px] font-mono tracking-widest text-[#5A6E85] mb-2">VISIBLE LAYERS</div>
          <div className="space-y-1.5">
            {LAYER_DEFS.filter(l => presentLayers.has(l.key)).map(l => (
              <label key={l.key} className="flex items-center gap-2 text-xs text-[#8B9CB3] hover:text-white cursor-pointer">
                <input type="checkbox" checked={visibleLayers.has(l.key)} onChange={()=>toggleLayer(l.key)} className="accent-[#00D4FF] w-3 h-3" />
                <LegendSwatch style={l.style} color={l.color} />
                <span className="font-mono text-[11px]">{l.label}</span>
              </label>
            ))}
            {LAYER_DEFS.filter(l => !presentLayers.has(l.key)).map(l => (
              <div key={l.key} className="flex items-center gap-2 text-xs text-[#27364D]">
                <input type="checkbox" disabled className="w-3 h-3 opacity-30" />
                <LegendSwatch style={l.style} color={l.color} />
                <span className="font-mono text-[11px] opacity-50">{l.label} — no data</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[#1E2D42]/60 flex gap-1">
            <button onClick={()=>setVisibleLayers(new Set(LAYER_DEFS.filter(l=>presentLayers.has(l.key)).map(l=>l.key)))} className="text-[10px] font-mono text-[#00D4FF] hover:text-white">ALL</button>
            <span className="text-[#27364D]">·</span>
            <button onClick={()=>setVisibleLayers(new Set())} className="text-[10px] font-mono text-[#5A6E85] hover:text-white">NONE</button>
          </div>
        </div>
      )}

      {/* Dynamic legend — only visible layers that are actually present */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg px-3 py-2.5 backdrop-blur-sm shadow-xl max-w-[260px]">
        <div className="text-[10px] font-mono tracking-widest text-white mb-2">MAP LEGEND — {isIndia ? 'INDIA' : region.toUpperCase()}</div>
        {visibleLegend.length === 0 ? (
          <div className="text-[11px] text-[#5A6E85]">No layers visible — enable layers above.</div>
        ) : (
          <div className="space-y-1.5">
            {visibleLegend.map(l => (
              <div key={l.key} className="flex items-center gap-2 text-[11px] text-[#8B9CB3]">
                <LegendSwatch style={l.style} color={l.color} />
                <span className="font-mono">{l.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="text-[9px] text-[#27364D] mt-2">SYNTHETIC DEMO · Legend matches visible layers</div>
      </div>
    </div>
  );
}
