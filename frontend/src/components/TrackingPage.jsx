import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Navigation, Truck, Clock, AlertTriangle, CheckCircle, Package,
  Pause, Play, RotateCcw, Zap, MapPin, Activity, Timer, Route as RouteIcon,
  Layers, Maximize2, Search
} from 'lucide-react';
import { api } from '../services/api';
import { useRegion } from '../context/RegionContext';

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

const statusConfig = {
  AVAILABLE:   { label: 'AVAILABLE',   color: '#3B82F6', bg: 'bg-[#3B82F6]/15', border: 'border-[#3B82F6]/40' },
  ALLOCATED:   { label: 'ALLOCATED',   color: '#3B82F6', bg: 'bg-[#3B82F6]/15', border: 'border-[#3B82F6]/40' },
  DISPATCHED:  { label: 'DISPATCHED',  color: '#06B6D4', bg: 'bg-[#06B6D4]/15', border: 'border-[#06B6D4]/40' },
  IN_TRANSIT:  { label: 'IN TRANSIT',  color: '#00D4FF', bg: 'bg-[#00D4FF]/15', border: 'border-[#00D4FF]/40' },
  DELIVERED:   { label: 'DELIVERED',   color: '#10B981', bg: 'bg-[#10B981]/15', border: 'border-[#10B981]/40' },
  VERIFIED:    { label: 'VERIFIED',    color: '#8B5CF6', bg: 'bg-[#8B5CF6]/15', border: 'border-[#8B5CF6]/40' },
  STALE:       { label: 'STALE',       color: '#EF4444', bg: 'bg-[#EF4444]/15', border: 'border-[#EF4444]/40' },
  REALLOCATED: { label: 'REALLOCATED', color: '#A855F7', bg: 'bg-[#A855F7]/15', border: 'border-[#A855F7]/40' },
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

// city code for truck id
const cityCodeMap = {
  "Mumbai": "MB", "Pune": "PN", "Nagpur": "NG", "New Delhi": "DL", "Bengaluru": "BLR",
  "Chennai": "CH", "Hyderabad": "HYD", "Ahmedabad": "AMD", "Surat": "ST", "Kolkata": "KK",
  "Jaipur": "JP", "Lucknow": "LK", "Varanasi": "VN", "Bhubaneswar": "BBSR", "Kochi": "KO",
  "Patna": "PT", "Guwahati": "GH", "Visakhapatnam": "VSKP",
};
function cityCode(city) {
  if (!city || city === 'INDIA') return 'IN';
  return cityCodeMap[city] || city.slice(0,2).toUpperCase();
}
function truckIdFor(alloc) {
  const cc = cityCode(alloc.city);
  const short = alloc.id.replace(/-/g,'').slice(0,4).toUpperCase();
  return `TRK-${cc}-${short}`;
}
function hashSpeed(id) {
  let h = 0; for (let i=0;i<id.length;i++) h = (h*31 + id.charCodeAt(i)) & 0xffff;
  return 38 + (h % 15); // 38-52 km/h
}
function haversine(a,b) {
  const R=6371; const dLat=(b[0]-a[0])*Math.PI/180; const dLng=(b[1]-a[1])*Math.PI/180;
  const la1=a[0]*Math.PI/180, la2=b[0]*Math.PI/180;
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

// build route coords from edge ids
function buildRouteCoords(edges, roadMap, locMap, sourceId, destId) {
  if (!edges || !edges.length) return [];
  const coords = [];
  const dists = [];
  let cur = sourceId;
  const srcLoc = locMap[sourceId];
  if (!srcLoc) return [];
  coords.push([srcLoc.lat, srcLoc.lng]);
  for (const eid of edges) {
    const road = roadMap[eid];
    if (!road) continue;
    let next = null;
    if (road.source_id === cur) next = road.target_id;
    else if (road.target_id === cur) next = road.source_id;
    else {
      // edge not contiguous — try to jump to either endpoint closest to current
      const a = locMap[road.source_id]; const b = locMap[road.target_id];
      if (!a || !b) continue;
      // pick the endpoint that is closer to last coord
      const last = coords[coords.length-1];
      const da = haversine(last, [a.lat,a.lng]); const db = haversine(last, [b.lat,b.lng]);
      next = da < db ? road.target_id : road.source_id;
      // then the other endpoint is the actual next after that — but for simplicity push both
      const other = next === road.source_id ? road.target_id : road.source_id;
      const nLoc = locMap[next]; if (nLoc) { coords.push([nLoc.lat,nLoc.lng]); dists.push(road.distance || haversine(coords[coords.length-2], coords[coords.length-1])); cur = next; next = other; }
    }
    const nLoc = locMap[next];
    if (!nLoc) continue;
    // avoid duplicate if we already at that location
    const last = coords[coords.length-1];
    if (last[0]===nLoc.lat && last[1]===nLoc.lng) { cur = next; continue; }
    coords.push([nLoc.lat, nLoc.lng]);
    dists.push(road.distance || haversine(coords[coords.length-2], coords[coords.length-1]));
    cur = next;
  }
  // ensure dest at end if not already
  const destLoc = locMap[destId];
  if (destLoc) {
    const last = coords[coords.length-1];
    if (!last || last[0]!==destLoc.lat || last[1]!==destLoc.lng) {
      // only push if not already at dest — prevents duplicate when route already ends at dest
      if (cur !== destId) {
        coords.push([destLoc.lat, destLoc.lng]);
        const prev = coords[coords.length-2];
        dists.push( haversine(prev, [destLoc.lat, destLoc.lng]) );
      }
    }
  }
  return { coords, dists };
}

function interpolateRoute(route, progress) {
  const { coords, dists } = route;
  if (!coords || coords.length===0) return null;
  if (coords.length===1) return { pos: coords[0], heading: 0, segIdx: 0 };
  const total = dists.reduce((a,b)=>a+b,0) || 0;
  if (total===0) return { pos: coords[0], heading: 0, segIdx:0 };
  const target = Math.max(0, Math.min(1, progress)) * total;
  let acc=0;
  for (let i=0;i<dists.length;i++) {
    const segLen = dists[i];
    if (acc + segLen >= target || i===dists.length-1) {
      const t = segLen===0 ? 0 : (target - acc)/segLen;
      const a = coords[i]; const b = coords[i+1];
      const lat = a[0] + (b[0]-a[0])*t;
      const lng = a[1] + (b[1]-a[1])*t;
      const dLat = b[0]-a[0]; const dLng = b[1]-a[1];
      const heading = Math.atan2(dLng, dLat)*180/Math.PI;
      return { pos: [lat,lng], heading, segIdx: i };
    }
    acc += segLen;
  }
  const last = coords[coords.length-1];
  const prev = coords[coords.length-2];
  const heading = Math.atan2(last[1]-prev[1], last[0]-prev[0])*180/Math.PI;
  return { pos: last, heading, segIdx: coords.length-2 };
}

function truckDivIcon(status, heading, isSelected, isStale) {
  const sc = statusConfig[status] || statusConfig.IN_TRANSIT;
  const accent = isStale ? '#EF4444' : sc.color;
  const border = isSelected ? `2px solid ${accent}` : `1.5px solid ${accent}90`;
  const bg = isStale ? 'rgba(239,68,68,0.18)' : `${accent}18`;
  const sizeW = isSelected ? 34 : 30;
  const sizeH = isSelected ? 34 : 30;
  const html = `<div style="width:${sizeW}px;height:${sizeH}px;border-radius:10px;background:rgba(11,17,27,0.98);border:${border};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.55),0 0 10px ${accent}55;transform:rotate(${heading}deg);">
    <div style="transform:rotate(${-heading}deg);display:flex;align-items:center;justify-content:center;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
    </div>
  </div>`;
  return L.divIcon({ html, className: 'truck-marker', iconSize: [sizeW, sizeH], iconAnchor: [sizeW/2, sizeH/2] });
}

export default function TrackingPage(){
  const { region, isIndia, cities, cityList, mapCenter } = useRegion();
  const { lat, lng, zoom } = mapCenter;
  const center = useMemo(()=>[lat,lng],[lat,lng]);

  const [allocations, setAllocations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [roads, setRoads] = useState([]);
  const [demands, setDemands] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [fitToken, setFitToken] = useState(0);
  const [progressMap, setProgressMap] = useState({});
  const [alternateByAlloc, setAlternateByAlloc] = useState({});
  const [nowTick, setNowTick] = useState(Date.now());
  const [search, setSearch] = useState('');
  const lastUpdateRef = useRef(Date.now());

  // poll backend every 5s
  useEffect(()=>{
    let cancelled=false;
    const fetchTracking = async()=>{
      try{
        const city = region==='INDIA'?undefined:region;
        const [a,l,r,d, res] = await Promise.all([
          api.getAllocations(city),
          api.getLocations(city),
          api.getRoads(city),
          api.getDemands(city),
          api.getResources(),
        ]);
        if(cancelled) return;
        setAllocations(a.data); setLocations(l.data); setRoads(r.data); setDemands(d.data); setResources(res.data);
        lastUpdateRef.current = Date.now();
        setNowTick(Date.now());
      }catch(e){ console.error(e); }
      finally{ if(!cancelled) setLoading(false); }
    };
    setLoading(true);
    fetchTracking();
    const int = setInterval(fetchTracking, 5000);
    return ()=>{ cancelled=true; clearInterval(int); };
  },[region]);

  // map helpers
  const locMap = useMemo(()=> Object.fromEntries(locations.map(l=>[l.id,l])), [locations]);
  const roadMap = useMemo(()=> Object.fromEntries(roads.map(r=>[r.id,r])), [roads]);
  const demandMap = useMemo(()=> Object.fromEntries(demands.map(d=>[d.id,d])), [demands]);
  const resMap = useMemo(()=> Object.fromEntries(resources.map(r=>[r.id,r])), [resources]);

  // fetch alternate routes for stale/in_transit allocations
  useEffect(()=>{
    if(isIndia) { setAlternateByAlloc({}); return; }
    let cancelled=false;
    const targets = allocations.filter(a=> ['IN_TRANSIT','STALE','DISPATCHED'].includes(a.status)).slice(0,10);
    if(!targets.length) { setAlternateByAlloc({}); return; }
    Promise.all(targets.map(async a=>{
      try{
        const { data } = await api.getAllocationRoutes(a.id);
        const primary = new Set(data?.primary?.path_edges||[]);
        const alts = (data?.alternates||[]).map(x=>x.path_edges).filter(p=> p && p.length && p.join(',')!==[...primary].join(','));
        return [a.id, alts[0] || null];
      }catch{ return [a.id, null]; }
    })).then(pairs=>{
      if(cancelled) return;
      const m={};
      for(const [id, alt] of pairs) if(alt) m[id]=alt;
      setAlternateByAlloc(m);
    });
    return ()=>{ cancelled=true; };
  },[allocations, isIndia]);

  // trucks derived
  const trucks = useMemo(()=>{
    let list = allocations.map(a=>{
      const demand = demandMap[a.demand_id];
      const destId = demand?.location_id;
      const srcLoc = locMap[a.source_id];
      const destLoc = destId ? locMap[destId] : null;
      if(!srcLoc || !destLoc) return null;
      let edges=[];
      try{ const v=JSON.parse(a.route_path); edges = Array.isArray(v)?v:[a.route_path]; }catch{ edges = a.route_path?[a.route_path]:[]; }
      const isStale = a.status==='STALE';
      const isBlocked = edges.some(e=> roadMap[e]?.status==='BLOCKED');
      const hasAlt = !!alternateByAlloc[a.id];
      // pick route to display
      let activeEdges = edges;
      if(isStale && hasAlt) activeEdges = alternateByAlloc[a.id];
      const primaryRoute = buildRouteCoords(edges, roadMap, locMap, a.source_id, destId);
      const activeRoute = buildRouteCoords(activeEdges, roadMap, locMap, a.source_id, destId);
      const primaryDist = primaryRoute.dists.reduce((s,v)=>s+v,0);
      const activeDist = activeRoute.dists.reduce((s,v)=>s+v,0);
      const travelMinutes = activeEdges.reduce((s,id)=> s + (roadMap[id]?.travel_time||0), 0);
      const speed = hashSpeed(a.id);
      const truckId = truckIdFor(a);
      const resName = resMap[a.resource_id]?.name || a.resource_id;
      const priority = demand?.severity ?? 3;
      return {
        alloc: a,
        id: a.id,
        truckId,
        resourceId: a.resource_id,
        resName,
        quantity: a.quantity,
        srcLoc, destLoc, destId,
        edges, activeEdges,
        primaryRoute, activeRoute,
        primaryDist, activeDist,
        travelMinutes,
        speed,
        priority,
        isStale, isBlocked, hasAlt,
        destName: destLoc?.name || destId,
        srcName: srcLoc?.name || a.source_id,
        status: a.status,
      };
    }).filter(Boolean);

    // city filtering already via allocations query, but for INDIA we cap for map readability
    if(isIndia){
      // prioritize moving trucks
      const rank = {'IN_TRANSIT':0,'DISPATCHED':1,'STALE':2,'DELIVERED':3,'VERIFIED':4,'ALLOCATED':5,'AVAILABLE':6};
      list.sort((a,b)=> (rank[a.status]??9)-(rank[b.status]??9) || b.priority - a.priority);
      // keep at most 2 per city to avoid clutter, max 12 total
      const perCity={}; const out=[];
      for(const t of list){
        const c = t.alloc.city || 'UNKNOWN';
        perCity[c]=(perCity[c]||0);
        if(perCity[c] < 2 && out.length < 12){ out.push(t); perCity[c]++; }
        if(out.length>=12) break;
      }
      // if still not enough IN_TRANSIT, fill with any
      if(out.filter(x=>x.status==='IN_TRANSIT').length===0 && list.length){
        // ensure at least one IN_TRANSIT if exists nationally
        const inTransit = list.find(x=>x.status==='IN_TRANSIT');
        if(inTransit && !out.find(o=>o.id===inTransit.id)) out[0]=inTransit;
      }
      return out;
    }
    // city view: show all but prioritize moving for sidebar ordering
    // keep natural order by dispatched_at desc but surface moving first in list later
    return list;
  },[allocations, locMap, roadMap, demandMap, resMap, alternateByAlloc, isIndia]);

  const mapTrucks = useMemo(()=>{
    if(!isIndia) return trucks;
    return trucks;
  },[trucks, isIndia]);

  // keep progressMap in sync with lifecycle
  useEffect(()=>{
    setProgressMap(prev=>{
      const next={...prev};
      let changed=false;
      for(const t of trucks){
        const id=t.id;
        if(t.status==='DISPATCHED' || t.status==='AVAILABLE' || t.status==='ALLOCATED'){
          if(next[id]!==0){ next[id]=0; changed=true; }
        } else if(t.status==='DELIVERED' || t.status==='VERIFIED'){
          if(next[id]!==1){ next[id]=1; changed=true; }
        } else if(t.status==='IN_TRANSIT'){
          if(next[id]==null){ next[id]= Math.random()*0.25; changed=true; }
          if(next[id]!==null && next[id]>=1){ next[id]=0.92; changed=true; }
        } else if(t.status==='STALE'){
          // keep where it was, but ensure exists
          if(next[id]==null){ next[id]=0.45; changed=true; }
        }
      }
      // remove stale ids no longer in trucks
      for(const k of Object.keys(next)){
        if(!trucks.find(t=>t.id===k)){ delete next[k]; changed=true; }
      }
      return changed?next:prev;
    });
  },[trucks]);

  // handle reroute progress preservation when alternate appears
  const prevAlternateRef = useRef({});
  useEffect(()=>{
    const prev = prevAlternateRef.current;
    let changed=false;
    const updates={};
    for(const t of trucks){
      const had = prev[t.id];
      const has = alternateByAlloc[t.id];
      if(!had && has && t.isStale){
        // switched to alternate — preserve absolute distance
        const oldP = progressMap[t.id] ?? 0.4;
        const oldTotal = t.primaryDist || t.activeDist || 1;
        const newTotal = t.activeDist || oldTotal;
        if(newTotal>0){
          const absDist = oldP * oldTotal;
          const newP = Math.min(0.95, absDist / newTotal);
          updates[t.id]= newP;
          changed=true;
        }
      }
    }
    if(changed) setProgressMap(p=> ({...p, ...updates}));
    prevAlternateRef.current = {...alternateByAlloc};
  },[alternateByAlloc, trucks, progressMap]);

  // animation loop
  useEffect(()=>{
    if(isPaused) return;
    let raf=0; let last=performance.now();
    const tick=(now)=>{
      const dt = (now-last)/1000; last=now;
      // 1x = base, 2x doubles, 5x quintuples
      setProgressMap(prev=>{
        const next={...prev};
        let any=false;
        for(const t of trucks){
          if(t.status!=='IN_TRANSIT') continue;
          const id=t.id;
          const cur = prev[id] ?? 0;
          if(cur>=1) continue;
          const totalDist = t.activeDist || t.primaryDist || 1;
          // travelMinutes gives realistic duration: convert to seconds with compression
          // base duration = travelMinutes * 1.6 seconds (20 min -> 32s)
          const travelM = t.travelMinutes || Math.max(8, totalDist*2.5);
          const baseDur = Math.max(14, Math.min(70, travelM * 1.6));
          const dur = baseDur / simSpeed;
          const delta = dt / dur;
          const np = Math.min(1, cur + delta);
          if(np!==cur){ next[id]=np; any=true; }
        }
        return any?next:prev;
      });
      setNowTick(Date.now());
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return ()=> cancelAnimationFrame(raf);
  },[isPaused, simSpeed, trucks]);

  // derived positions
  const truckStates = useMemo(()=>{
    return mapTrucks.map(t=>{
      const p = progressMap[t.id] ?? (t.status==='IN_TRANSIT'?0.15: t.status==='DELIVERED'||t.status==='VERIFIED'?1:0);
      const route = t.activeRoute.coords.length? t.activeRoute : t.primaryRoute;
      const interp = interpolateRoute(route, p);
      const total = route.dists.reduce((a,b)=>a+b,0) || t.activeDist || 1;
      const remaining = Math.max(0, (1-p)* total);
      const etaMinutes = t.speed>0 ? (remaining / t.speed)*60 : 0;
      const etaDate = new Date(Date.now() + etaMinutes*60000);
      const etaLabel = etaDate.toLocaleTimeString('en-US',{hour12:false, hour:'2-digit', minute:'2-digit'});
      const heading = interp?.heading ?? 0;
      const pos = interp?.pos || [t.srcLoc.lat, t.srcLoc.lng];
      return { ...t, progress:p, pos, heading, remaining, etaLabel, etaMinutes, totalDist: total };
    });
  },[mapTrucks, progressMap]);

  const selectedTruck = useMemo(()=> truckStates.find(x=>x.id===selectedId) || null, [truckStates, selectedId]);

  // KPIs
  const kpis = useMemo(()=>{
    const all = allocations;
    const isActive = (s)=> ['DISPATCHED','IN_TRANSIT'].includes(s);
    const activeVehicles = all.filter(a=> isActive(a.status)).length;
    const inTransit = all.filter(a=> a.status==='IN_TRANSIT').length;
    const dispatched = all.filter(a=> a.status==='DISPATCHED').length;
    const delivered = all.filter(a=> a.status==='DELIVERED').length;
    const delayed = all.filter(a=> a.status==='STALE' || (()=>{
      try{ const e=JSON.parse(a.route_path); const arr=Array.isArray(e)?e:[e]; return arr.some(id=> roadMap[id]?.status==='BLOCKED'); }catch{ return false; }
    })()).length;
    const totalMoving = all.filter(a=> isActive(a.status)).reduce((s,a)=> s + (a.quantity||0), 0);
    return { activeVehicles, inTransit, dispatched, delivered, delayed, totalMoving };
  },[allocations, roadMap]);

  // filtered for search in sidebar/table
  const filteredStates = useMemo(()=>{
    if(!search.trim()) return truckStates;
    const q=search.toLowerCase();
    return truckStates.filter(t=> `${t.truckId} ${t.resName} ${t.resourceId} ${t.srcName} ${t.destName} ${t.status}`.toLowerCase().includes(q));
  },[truckStates, search]);

  // table source — when not INDIA show all trucks (truckStates), when INDIA show filtered mapTrucks; for dense table use truckStates
  const tableRows = filteredStates;

  // map fit positions
  const fitPositions = useMemo(()=>{
    if(isIndia) return cityList.map(c=> [cities[c]?.lat, cities[c]?.lng]).filter(p=> p[0]!=null);
    return locations.map(l=> [l.lat,l.lng]);
  },[isIndia, cityList, cities, locations]);

  if(loading){
    return <div className="min-h-[60vh] flex items-center justify-center bg-[#05080D]"><div className="text-center"><div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-[#8B9CB3] text-sm">Loading tracking data...</p></div></div>;
  }

  return (
    <div className="space-y-4">
      {/* simulation mode banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B111B]/90 border border-[#1E2D42] rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse"/>
          <span className="text-[11px] font-mono tracking-widest text-[#F59E0B]">● SIMULATION MODE — SYNTHETIC DEMO</span>
          <span className="text-[10px] text-[#5A6E85] font-mono">Last update {new Date(lastUpdateRef.current).toLocaleTimeString('en-US',{hour12:false})}</span>
          <span className="text-[10px] text-[#5A6E85]">· Frontend interpolation between polls — not real GPS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={()=> setIsPaused(v=>!v)} className={`px-2.5 py-1 rounded-md text-[11px] font-mono border flex items-center gap-1 ${isPaused ? 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B]' : 'bg-[#0B111B] border-[#1E2D42] text-[#8B9CB3] hover:text-white'}`}>
            {isPaused ? <Play size={12}/> : <Pause size={12}/>} {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
          <button onClick={()=> { setProgressMap({}); setSelectedId(null); }} className="px-2.5 py-1 rounded-md text-[11px] font-mono border bg-[#0B111B] border-[#1E2D42] text-[#8B9CB3] hover:text-white flex items-center gap-1"><RotateCcw size={12}/> RESET</button>
          <div className="flex items-center gap-1 ml-1">
            {[1,2,5].map(m=> (
              <button key={m} onClick={()=> setSimSpeed(m)} className={`px-2 py-1 rounded-md text-[11px] font-mono border ${simSpeed===m ? 'bg-[#00D4FF]/20 border-[#00D4FF]/50 text-[#00D4FF]' : 'bg-[#0B111B] border-[#1E2D42] text-[#5A6E85] hover:text-white'}`}>{m}x</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {label:'ACTIVE VEHICLES', value: kpis.activeVehicles, color:'#00D4FF'},
          {label:'IN TRANSIT', value: kpis.inTransit, color:'#00D4FF'},
          {label:'DISPATCHED', value: kpis.dispatched, color:'#06B6D4'},
          {label:'DELIVERED', value: kpis.delivered, color:'#10B981'},
          {label:'DELAYED', value: kpis.delayed, color:'#EF4444'},
          {label:'TOTAL MOVING', value: kpis.totalMoving.toLocaleString(), color:'#F59E0B', sub:'UNITS'},
        ].map(k=> (
          <div key={k.label} className="bg-[#0B111B] border border-[#1E2D42]/60 rounded-xl p-3">
            <div className="text-[10px] font-mono tracking-widest text-[#5A6E85]">{k.label}</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono" style={{color:k.color}}>{k.value}</span>
              {k.sub && <span className="text-[10px] text-[#5A6E85] font-mono">{k.sub}</span>}
            </div>
            <div className="w-2 h-2 rounded-full mt-1" style={{background:k.color, boxShadow:`0 0 6px ${k.color}`}}/>
          </div>
        ))}
      </div>

      {/* Map + Sidebar */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="bg-[#101827] border border-[#1E2D42] rounded-xl overflow-hidden h-[560px] flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#1E2D42] bg-[#151F30] flex items-center justify-between">
            <div className="flex items-center gap-2"><Navigation size={16} className="text-[#00D4FF]"/><span className="text-sm font-semibold text-white tracking-wide">LIVE TRACKING MAP</span><span className="text-[10px] font-mono text-[#5A6E85]">· {isIndia ? 'INDIA — select a city for detail' : `${region.toUpperCase()} OPERATIONS`}</span></div>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:flex items-center gap-1.5 bg-[#0B111B] border border-[#1E2D42] rounded-lg px-2 py-1">
                <Search size={12} className="text-[#5A6E85]"/>
                <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Filter trucks…" className="bg-transparent outline-none text-[11px] text-white placeholder:text-[#5A6E85] w-[120px]"/>
                {search && <button onClick={()=> setSearch('')} className="text-[#5A6E85] hover:text-white text-[11px]">✕</button>}
              </div>
              <button onClick={()=> setFitToken(v=>v+1)} className="p-1.5 bg-[#0B111B] border border-[#1E2D42] rounded-lg text-[#8B9CB3] hover:text-white" title={isIndia?'Fit India':`Fit ${region}`}><Maximize2 size={14}/></button>
            </div>
          </div>
          <div className="flex-1 relative">
            <MapContainer key={`${region}-${zoom}-${fitToken}`} center={center} zoom={zoom} style={{height:'100%', width:'100%', backgroundColor:'#070B14'}} zoomControl={false} attributionControl={true}>
              <RecenterMap center={center} zoom={zoom} fitToken={fitToken} positions={fitPositions} />
              <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' maxZoom={19} />
              {/* corridors */}
              {roads.filter(r=> r.status==='OPEN').map(r=>{
                const src=locMap[r.source_id]; const tgt=locMap[r.target_id]; if(!src||!tgt) return null;
                const isActiveSel = selectedTruck && selectedTruck.activeEdges.includes(r.id);
                return <Polyline key={r.id} positions={[[src.lat,src.lng],[tgt.lat,tgt.lng]]} color={isActiveSel ? '#00D4FF' : '#1E2D42'} weight={isActiveSel?3:1.5} opacity={isActiveSel?0.85:0.35} />
              })}
              {roads.filter(r=> r.status==='BLOCKED').map(r=>{
                const src=locMap[r.source_id]; const tgt=locMap[r.target_id]; if(!src||!tgt) return null;
                return <Polyline key={`b-${r.id}`} positions={[[src.lat,src.lng],[tgt.lat,tgt.lng]]} color="#EF4444" weight={3} dashArray="8,6" opacity={0.85}/>
              })}
              {/* warehosue / hospital markers */}
              {!isIndia && locations.map(loc=>{
                if(loc.type==='WAREHOUSE' && locMap[loc.id]){
                  return <Marker key={loc.id} position={[loc.lat,loc.lng]} icon={warehouseIcon}><Popup><div className="text-white text-xs"><div className="font-semibold">{loc.name}</div><div className="text-[#8B9CB3]">{loc.city} · {loc.type}</div></div></Popup></Marker>;
                }
                if(loc.type==='HOSPITAL' && locMap[loc.id]){
                  return <Marker key={loc.id} position={[loc.lat,loc.lng]} icon={hospitalIcon}><Popup><div className="text-white text-xs"><div className="font-semibold">{loc.name}</div><div className="text-[#8B9CB3]">{loc.city} · {loc.type}</div></div></Popup></Marker>;
                }
                return null;
              })}
              {/* selected truck emphasized route + trail */}
              {selectedTruck && selectedTruck.activeRoute.coords.length>1 && (
                <>
                  {/* traveled dim trail */}
                  <Polyline positions={selectedTruck.activeRoute.coords.slice(0, Math.max(2, Math.ceil(selectedTruck.progress * selectedTruck.activeRoute.coords.length)+1))} color="#00D4FF" weight={6} opacity={0.22} />
                  {/* full active route */}
                  <Polyline positions={selectedTruck.activeRoute.coords} color={selectedTruck.isStale ? '#F59E0B' : '#00D4FF'} weight={selectedTruck.isSelected?4:3} opacity={0.9} dashArray={selectedTruck.isStale ? '6,6' : undefined} />
                  {/* primary blocked route ghost */}
                  {selectedTruck.isStale && selectedTruck.primaryRoute.coords.length>1 && (
                    <Polyline positions={selectedTruck.primaryRoute.coords} color="#EF4444" weight={3} dashArray="8,8" opacity={0.5}/>
                  )}
                </>
              )}
              {/* non-selected routes subtle cyan for in_transit trucks */}
              {!selectedTruck && truckStates.filter(t=> t.status==='IN_TRANSIT').slice(0,6).map(t=> (
                <Polyline key={`route-${t.id}`} positions={t.activeRoute.coords} color="#00D4FF" weight={1.5} opacity={0.35} />
              ))}
              {/* trucks */}
              {truckStates.map(t=>{
                const isSel = selectedTruck?.id===t.id;
                return (
                  <Marker key={`truck-${t.id}`} position={t.pos} icon={truckDivIcon(t.status, t.heading, isSel, t.isStale || t.isBlocked)} eventHandlers={{ click: ()=> setSelectedId(t.id) }}>
                    <Popup>
                      <div className="text-white text-xs min-w-[220px] space-y-1">
                        <div className="font-bold text-[#00D4FF] tracking-wide">{t.truckId} <span className="text-[#5A6E85] font-mono text-[10px]">{t.alloc.id.slice(0,8)}</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{background: (statusConfig[t.status]||statusConfig.IN_TRANSIT).color}}/>{t.status} {t.isStale && <span className="text-[#EF4444]">· STALE</span>} {t.isBlocked && !t.isStale && <span className="text-[#EF4444]">· BLOCKED CUT</span>}</div>
                        <div className="text-[#8B9CB3]">Resource: <span className="text-white">{t.resName} · {t.quantity}</span></div>
                        <div className="text-[#8B9CB3]">Source: <span className="text-white">{t.srcName}</span></div>
                        <div className="text-[#8B9CB3]">Destination: <span className="text-white">{t.destName}</span></div>
                        <div className="text-[#5A6E85]">Route: <span className="text-[#22D3EE]">{t.activeEdges.join(' → ')}</span> {t.hasAlt && <span className="text-[#F59E0B]">· alt available</span>}</div>
                        <div className="flex gap-2 text-[11px] font-mono"><span>Speed {t.speed} km/h</span><span>ETA {t.etaLabel}</span><span>{t.remaining.toFixed(1)} km left</span></div>
                        <div className="text-[10px] text-[#5A6E85]">TOTAL {t.totalDist.toFixed(1)} km · Progress {(t.progress*100).toFixed(0)}% · {t.travelMinutes} min</div>
                        <div className="text-[10px] text-[#5A6E85]">POS {t.pos[0].toFixed(4)}° N, {t.pos[1].toFixed(4)}° E · Last {new Date(lastUpdateRef.current).toLocaleTimeString('en-US',{hour12:false})}</div>
                        {t.isStale && <div className="bg-[#EF4444]/15 border border-[#EF4444]/30 rounded px-2 py-1 text-[#EF4444] text-[11px]">⚠ ROUTE BLOCKED — alternate {t.hasAlt ? 'FOUND — rerouted' : 'NOT FOUND — awaiting reallocation'}</div>}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
            {/* bottom legend */}
            <div className="absolute bottom-2 left-2 z-[400] bg-[#0B111B]/95 border border-[#1E2D42] rounded-lg px-2.5 py-1.5 backdrop-blur-sm flex items-center gap-3 text-[10px] font-mono text-[#8B9CB3]">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#00D4FF] inline-block"/> OPEN</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-[#EF4444] inline-block"/> BLOCKED</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-[#F59E0B] inline-block"/> ALT</span>
              <span className="w-2 h-2 rounded-full bg-[#00D4FF] inline-block shadow-[0_0_6px_#00D4FF]"/> TRUCK
            </div>
            {selectedTruck && (selectedTruck.isStale || selectedTruck.isBlocked) && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] bg-[#EF4444]/15 border border-[#EF4444]/40 rounded-lg px-3 py-1.5 backdrop-blur-sm text-[11px] font-mono text-[#EF4444] flex items-center gap-2">
                <AlertTriangle size={12}/> ROUTE BLOCKED · {selectedTruck.activeEdges.join(' → ')} {selectedTruck.hasAlt ? '· ✓ ALTERNATE FOUND — rerouted' : '· Recalculating…'}
              </div>
            )}
            {isIndia && (
              <div className="absolute top-2 right-2 z-[400] bg-[#0B111B]/95 border border-[#F59E0B]/30 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-[#F59E0B]">INDIA — showing {mapTrucks.length} vehicles (max 2 per city). Select a city for full detail.</div>
            )}
          </div>
        </div>

        {/* Sidebar: active vehicles */}
        <div className="bg-[#0B111B] border border-[#1E2D42]/60 rounded-xl overflow-hidden h-[560px] flex flex-col">
          <div className="px-3 py-2.5 border-b border-[#1E2D42] bg-[#101827]/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5"><Truck size={14} className="text-[#00D4FF]"/><span className="text-xs font-bold tracking-widest text-white">ACTIVE VEHICLES</span></div>
            <span className="text-[10px] font-mono text-[#5A6E85]">{filteredStates.length} shown · {truckStates.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredStates.length===0 ? (
              <div className="text-center py-8 text-[#5A6E85] text-sm">No vehicles match filter.<div className="text-[11px]">Run allocation engine or adjust search.</div></div>
            ) : filteredStates
                .slice()
                .sort((a,b)=> (a.status==='IN_TRANSIT'?0: a.status==='DISPATCHED'?1:2) - (b.status==='IN_TRANSIT'?0: b.status==='DISPATCHED'?1:2) || b.priority - a.priority)
                .map(t=>{
                  const sc = statusConfig[t.status] || statusConfig.IN_TRANSIT;
                  const isSel = selectedId===t.id;
                  return (
                    <button key={t.id} onClick={()=> setSelectedId(t.id)} className={`w-full text-left rounded-lg border p-2.5 flex flex-col gap-1.5 transition-all ${isSel ? 'bg-[#151F30] border-[#00D4FF]/40' : 'bg-[#070B14] border-[#1E2D42]/60 hover:border-[#27364D] hover:bg-[#101827]'}`}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold font-mono text-white"><Truck size={12} className="text-[#00D4FF]"/>{t.truckId}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${sc.bg} ${sc.border}`} style={{color: sc.color}}>{sc.label}</span>
                      </div>
                      <div className="text-[11px] text-[#8B9CB3] font-mono truncate">{t.resourceId} · {t.quantity} {String(t.resourceId).includes('WATER')?'L':'units'}</div>
                      <div className="text-[11px] text-[#5A6E85] truncate flex items-center gap-1"><MapPin size={10}/>{t.srcName.split('(')[0].trim()} <span className="text-[#27364D]">→</span> {t.destName.split('(')[0].trim()}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="flex items-center gap-1" style={{color: sc.color}}><span className="w-1.5 h-1.5 rounded-full" style={{background: sc.color}}/> {t.status}</span>
                        <span className="text-[#8B9CB3] flex items-center gap-1"><Clock size={10}/> {t.status==='IN_TRANSIT' ? `ETA ${t.etaLabel}` : t.status==='DISPATCHED' ? 'STAGING' : t.status==='DELIVERED' ? 'ARRIVED' : t.isStale?'BLOCKED':'—'}</span>
                      </div>
                      {t.status==='IN_TRANSIT' && (
                        <div className="h-1 bg-[#05080D] rounded-full overflow-hidden border border-[#1E2D42]/40">
                          <div className="h-full bg-[#00D4FF]" style={{width:`${Math.round(t.progress*100)}%`, transition:'width 0.4s linear'}}/>
                        </div>
                      )}
                      <div className="text-[10px] font-mono text-[#5A6E85] flex justify-between"><span>{t.speed} km/h</span><span>{t.remaining.toFixed(1)} km left</span><span>{t.truckId.split('-').slice(-1)[0]}</span></div>
                    </button>
                  );
                })}
          </div>
          <div className="p-2 border-t border-[#1E2D42]/40 bg-[#070B14]/50 text-[10px] font-mono text-[#5A6E85]">SYNTHETIC DEMO · Click a card to focus the truck on the map.</div>
        </div>
      </div>

      {/* selected truck detail */}
      {selectedTruck && (
        <div className="bg-[#0B111B] border border-[#1E2D42]/60 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E2D42] bg-[#151F30] flex items-center justify-between">
            <div className="flex items-center gap-2"><Truck size={16} className="text-[#00D4FF]"/><span className="text-sm font-bold text-white tracking-wide">TRUCK {selectedTruck.truckId}</span><span className="text-[10px] font-mono text-[#5A6E85]">ALLOCATION {selectedTruck.alloc.id.slice(0,8)}</span></div>
            <button onClick={()=> setSelectedId(null)} className="text-[11px] font-mono text-[#8B9CB3] hover:text-white border border-[#1E2D42] rounded px-2 py-1">CLOSE</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
            {[
              ['STATUS', selectedTruck.status, (statusConfig[selectedTruck.status]||statusConfig.IN_TRANSIT).color],
              ['RESOURCE', selectedTruck.resName.toUpperCase(), '#F0F4FA'],
              ['QUANTITY', `${selectedTruck.quantity}`, '#F0F4FA'],
              ['SOURCE', selectedTruck.srcName.toUpperCase(), '#8B9CB3'],
              ['DESTINATION', selectedTruck.destName.toUpperCase(), '#8B9CB3'],
              ['ROUTE', selectedTruck.activeEdges.join(' → ') || '—', '#22D3EE'],
              ['DISTANCE', `${selectedTruck.totalDist.toFixed(1)} km`, '#F0F4FA'],
              ['SPEED', `${selectedTruck.speed} km/h`, '#00D4FF'],
              ['ETA', selectedTruck.etaLabel, '#F59E0B'],
              ['PRIORITY', `${selectedTruck.priority}/5`, selectedTruck.priority>=4?'#EF4444':'#8B9CB3'],
              ['ALLOCATION', selectedTruck.alloc.id.slice(0,12), '#5A6E85'],
              ['CITY', (selectedTruck.alloc.city||'NATIONAL').toUpperCase(), '#5A6E85'],
            ].map(([k,v,c])=> (
              <div key={k} className="bg-[#05080D] border border-[#1E2D42]/40 rounded-lg p-2.5">
                <div className="text-[9px] font-mono tracking-widest text-[#5A6E85]">{k}</div>
                <div className="text-xs font-mono font-semibold mt-1 truncate" style={{color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3 grid sm:grid-cols-2 gap-3 text-[11px] font-mono">
            <div className="bg-[#05080D] border border-[#1E2D42]/40 rounded-lg p-2.5">
              <div className="text-[#5A6E85] text-[10px] tracking-widest">CURRENT POSITION</div>
              <div className="text-white mt-1">{selectedTruck.pos[0].toFixed(4)}° N, {selectedTruck.pos[1].toFixed(4)}° E</div>
              <div className="text-[#5A6E85] mt-1">HEADING {Math.round(selectedTruck.heading)}° · PROGRESS {(selectedTruck.progress*100).toFixed(0)}%</div>
            </div>
            <div className="bg-[#05080D] border border-[#1E2D42]/40 rounded-lg p-2.5">
              <div className="text-[#5A6E85] text-[10px] tracking-widest">LAST UPDATE</div>
              <div className="text-white mt-1">{new Date(lastUpdateRef.current).toLocaleString('en-US',{hour12:false})}</div>
              <div className="text-[#5A6E85] mt-1">SPEED {selectedTruck.speed} km/h · REMAINING {selectedTruck.remaining.toFixed(1)} km · ETA {selectedTruck.etaLabel}</div>
            </div>
          </div>
          {(selectedTruck.isStale || selectedTruck.isBlocked) && (
            <div className="mx-4 mb-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2 text-[11px] font-mono text-[#EF4444] flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
              <div>
                <div className="font-bold">⚠ ROUTE BLOCKED — {selectedTruck.edges.join(' → ')}</div>
                <div className="text-[#F8B4B4]">{selectedTruck.hasAlt ? `✓ ALTERNATE ROUTE FOUND — ${selectedTruck.activeEdges.join(' → ')} · Truck rerouted from current position` : 'Recalculating… Run allocation engine to generate alternate, or restore the corridor via Simulation.'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* tracking table */}
      <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2D42] flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-white">TRACKING TABLE — {tableRows.length} vehicles</span>
          <span className="text-[10px] font-mono text-[#5A6E85]">REGION {region} · SYNTHETIC DEMO</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#05080D] sticky top-0">
              <tr className="text-[#5A6E85] font-mono uppercase text-[10px]">
                <th className="px-3 py-2 text-left">TRUCK ID</th>
                <th className="px-3 py-2 text-left">ALLOCATION</th>
                <th className="px-3 py-2 text-left">RESOURCE</th>
                <th className="px-3 py-2 text-left">QTY</th>
                <th className="px-3 py-2 text-left">SOURCE</th>
                <th className="px-3 py-2 text-left">DESTINATION</th>
                <th className="px-3 py-2 text-left">STATUS</th>
                <th className="px-3 py-2 text-left">SPEED</th>
                <th className="px-3 py-2 text-left">ETA</th>
                <th className="px-3 py-2 text-left">ROUTE</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(t=>{
                const sc = statusConfig[t.status] || statusConfig.IN_TRANSIT;
                return (
                  <tr key={t.id} onClick={()=> setSelectedId(t.id)} className={`border-b border-[#1E2D42]/30 hover:bg-[#151F30]/50 cursor-pointer ${selectedId===t.id ? 'bg-[#151F30]' : ''}`}>
                    <td className="px-3 py-2 font-mono text-[#00D4FF] font-semibold">{t.truckId}</td>
                    <td className="px-3 py-2 font-mono text-[#8B9CB3]">{t.alloc.id.slice(0,8)}</td>
                    <td className="px-3 py-2 text-white">{t.resourceId}</td>
                    <td className="px-3 py-2 font-mono text-white">{t.quantity}</td>
                    <td className="px-3 py-2 text-[#8B9CB3] max-w-[140px] truncate">{t.srcName}</td>
                    <td className="px-3 py-2 text-[#8B9CB3] max-w-[140px] truncate">{t.destName}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border" style={{color: sc.color, background:`${sc.color}15`, borderColor:`${sc.color}40`}}><span className="w-1.5 h-1.5 rounded-full" style={{background: sc.color}}/>{sc.label}</span></td>
                    <td className="px-3 py-2 font-mono text-white">{t.speed} km/h</td>
                    <td className="px-3 py-2 font-mono text-[#F59E0B]">{t.status==='IN_TRANSIT' ? t.etaLabel : t.status==='DISPATCHED' ? 'STAGING' : '—'}</td>
                    <td className="px-3 py-2 font-mono text-[#22D3EE] whitespace-nowrap">{t.activeEdges.join(' → ')}</td>
                  </tr>
                );
              })}
              {tableRows.length===0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-[#5A6E85]">NO VEHICLES IN THIS VIEW — run allocations or clear search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* recent delivery / event timeline */}
      <div className="bg-[#0B111B] border border-[#1E2D42]/40 rounded-xl p-3">
        <div className="text-[10px] font-mono tracking-widest text-[#5A6E85] mb-2">RECENT DELIVERY / EVENT TIMELINE</div>
        <div className="space-y-1.5">
          {allocations.filter(a=> ['DELIVERED','VERIFIED','STALE'].includes(a.status)).slice(0,5).map(a=>{
            const sc = statusConfig[a.status] || statusConfig.DELIVERED;
            const t = truckIdFor(a);
            return (
              <div key={a.id} className="flex items-center gap-2 text-[11px] font-mono bg-[#05080D] border border-[#1E2D42]/30 rounded px-2.5 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{background: sc.color}}/>
                <span className="text-white">{t}</span>
                <span className="text-[#5A6E85]">· {a.status}</span>
                <span className="text-[#8B9CB3]">· {a.resource_id} × {a.quantity}</span>
                <span className="ml-auto text-[#5A6E85]">{a.dispatched_at ? new Date(a.dispatched_at).toLocaleTimeString('en-US',{hour12:false}) : '—'}</span>
              </div>
            );
          })}
          {allocations.filter(a=> ['DELIVERED','VERIFIED','STALE'].includes(a.status)).length===0 && <div className="text-[11px] font-mono text-[#5A6E85] py-2">No recent deliveries — trucks will appear here once they reach destination.</div>}
        </div>
      </div>

      <div className="text-[10px] font-mono text-[#5A6E85] text-center">SYNTHETIC DEMO · Trucks interpolate smoothly between backend polls (≤5s backend, 60fps frontend) · No real GPS used.</div>
    </div>
  );
}
