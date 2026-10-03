import React, { useEffect, useState, useMemo } from 'react';
import {
  Zap, AlertTriangle, MapPin, Route, Package, Clock, CheckCircle,
  Wifi, ShieldCheck, BarChart3, ChevronDown, RefreshCw, CircleDot,
  ChevronRight, X, Plus, Minus, GitBranch, Network, Activity,
  Database, Layers, Terminal, TriangleAlert
} from 'lucide-react';
import { api } from '../services/api';
import { useRegion } from '../context/RegionContext';
import MapView from './MapView';

const ROAD_STATUS_COLORS = {
  OPEN: { bg: 'bg-[#10B981]/15', border: 'border-[#10B981]/40', text: 'text-[#10B981]', dot: '#10B981', label: 'OPEN' },
  BLOCKED: { bg: 'bg-[#EF4444]/15', border: 'border-[#EF4444]/40', text: 'text-[#EF4444]', dot: '#EF4444', label: 'BLOCKED' },
};

const ALLOC_STATUS_COLORS = {
  AVAILABLE: { bg: 'bg-[#10B981]/15', border: 'border-[#10B981]/40', text: 'text-[#10B981]', dot: '#10B981', label: 'AVAILABLE' },
  ALLOCATED: { bg: 'bg-[#3B82F6]/15', border: 'border-[#3B82F6]/40', text: 'text-[#3B82F6]', dot: '#3B82F6', label: 'ALLOCATED' },
  DISPATCHED: { bg: 'bg-[#F59E0B]/15', border: 'border-[#F59E0B]/40', text: 'text-[#F59E0B]', dot: '#F59E0B', label: 'DISPATCHED' },
  IN_TRANSIT: { bg: 'bg-[#06B6D4]/15', border: 'border-[#06B6D4]/40', text: 'text-[#06B6D4]', dot: '#06B6D4', label: 'IN TRANSIT' },
  DELIVERED: { bg: 'bg-[#10B981]/15', border: 'border-[#10B981]/40', text: 'text-[#10B981]', dot: '#10B981', label: 'DELIVERED' },
  VERIFIED: { bg: 'bg-[#8B5CF6]/15', border: 'border-[#8B5CF6]/40', text: 'text-[#8B5CF6]', dot: '#8B5CF6', label: 'VERIFIED' },
  STALE: { bg: 'bg-[#EF4444]/15', border: 'border-[#EF4444]/40', text: 'text-[#EF4444]', dot: '#EF4444', label: 'STALE' },
  REALLOCATED: { bg: 'bg-[#A855F7]/15', border: 'border-[#A855F7]/40', text: 'text-[#A855F7]', dot: '#A855F7', label: 'REALLOCATED' },
};

const getTime = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

function StatusBadge({ label, color }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium font-mono ${color.bg} ${color.border} ${color.text}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.dot }} />
      {label}
    </span>
  );
}

function MetricRow({ label, value, unit, trend }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-[#1E2D42]/50 last:border-0">
      <span className="text-[11px] text-[#8B9CB3] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-white font-mono font-medium text-lg">{value}</span>
        {unit && <span className="text-[10px] text-[#5A6E85]">{unit}</span>}
        {trend && <span className="text-[10px] text-[#10B981] flex items-center gap-0.5">{trend}</span>}
      </div>
    </div>
  );
}

function RoadCard({ road, locations, allocations }) {
  const status = ROAD_STATUS_COLORS[road.status] || ROAD_STATUS_COLORS.OPEN;
  const affectedAllocs = allocations.filter(a => a.route_path && a.route_path.includes(road.id));
  const src = locations.find(l => l.id === road.source_id);
  const tgt = locations.find(l => l.id === road.target_id);
  return (
    <div className={`p-3 rounded-lg border ${status.bg} ${status.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-medium text-sm">{road.id}</span>
          <StatusBadge label={status.label} color={status} />
        </div>
        <span className="text-[10px] text-[#5A6E85] font-mono">{road.travel_time} min</span>
      </div>
      <div className="text-[10px] text-[#8B9CB3] flex items-center gap-1">
        <MapPin size={10} /> {src?.name || road.source_id} → {tgt?.name || road.target_id}
      </div>
      {affectedAllocs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[#1E2D42]/50">
          <div className="text-[10px] text-[#EF4444] font-mono mb-1">AFFECTED ALLOCATIONS: {affectedAllocs.length}</div>
          <div className="flex flex-wrap gap-1">
            {affectedAllocs.slice(0, 3).map(a => (
              <span key={a.id} className="px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] text-[9px] font-mono rounded">
                {a.id.slice(0, 8)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceCard({ resource, rows, allocations, openDemands }) {
  const totals = rows.reduce((acc, r) => {
    acc.stock += r.quantity || 0;
    return acc;
  }, { stock: 0 });
  const allocated = allocations
    .filter(a => a.resource_id === resource.id && ['ALLOCATED', 'DISPATCHED'].includes(a.status))
    .reduce((sum, a) => sum + a.quantity, 0);
  const inTransit = allocations
    .filter(a => a.resource_id === resource.id && a.status === 'IN_TRANSIT')
    .reduce((sum, a) => sum + a.quantity, 0);
  const required = openDemands.filter(d => d.resource_id === resource.id).reduce((s, d) => s + d.quantity, 0);
  const coverage = required > 0 ? Math.min(100, Math.round((totals.stock / required) * 100)) : 100;
  return (
    <div className="p-3 rounded-lg border border-[#1E2D42]/50 bg-[#0B111B]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-medium text-sm truncate">{resource.name}</span>
        <span className="text-[10px] text-[#5A6E85] font-mono">{resource.id}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-[#10B981]/10 rounded border border-[#10B981]/30">
          <div className="text-white font-mono text-lg">{totals.stock}</div>
          <div className="text-[9px] text-[#8B9CB3] uppercase">IN STOCK</div>
        </div>
        <div className="p-2 bg-[#3B82F6]/10 rounded border border-[#3B82F6]/30">
          <div className="text-white font-mono text-lg">{allocated}</div>
          <div className="text-[9px] text-[#8B9CB3] uppercase">ALLOCATED</div>
        </div>
        <div className="p-2 bg-[#06B6D4]/10 rounded border border-[#06B6D4]/30">
          <div className="text-white font-mono text-lg">{inTransit}</div>
          <div className="text-[9px] text-[#8B9CB3] uppercase">IN TRANSIT</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-[#5A6E85]">
        <span>DEMAND {required}</span>
        <span>COVERAGE {coverage}%</span>
      </div>
      <div className="mt-1 h-1.5 bg-[#05080D] rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${coverage}%`, background: coverage < 60 ? '#F59E0B' : '#10B981' }} />
      </div>
    </div>
  );
}

function TimelineEvent({ event, index, total }) {
  const isLast = index === total - 1;
  const isError = event.error;
  return (
    <div className="relative flex items-start gap-3">
      <div className="flex-shrink-0 relative z-10">
        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isError ? 'border-[#EF4444] bg-[#EF4444]/20' : 'border-[#00D4FF] bg-[#00D4FF]/20'}`}>
          <span className={`text-[9px] font-mono font-bold ${isError ? 'text-[#EF4444]' : 'text-[#00D4FF]'}`}>
            {event.time.split(':').slice(0,2).join('')}
          </span>
        </div>
        {!isLast && <div className="absolute top-8 left-3 w-0.5 h-full bg-[#1E2D42]/50" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-medium text-sm">{event.msg}</span>
          <span className={`text-[10px] font-mono ${isError ? 'text-[#EF4444]' : 'text-[#5A6E85]'}`}>{event.time}</span>
          {isError && <TriangleAlert size={10} className="text-[#EF4444]" />}
        </div>
        <p className="text-[11px] text-[#8B9CB3]">{event.sub}</p>
        {event.detail && (
          <details className="mt-2">
            <summary className="text-[10px] text-[#5A6E85] cursor-pointer hover:text-[#00D4FF]">ALGORITHMIC RATIONALE ▼</summary>
            <div className="mt-2 p-2 bg-[#05080D] rounded border border-[#1E2D42]/30 text-[10px] text-[#8B9CB3] font-mono whitespace-pre-wrap">{event.detail}</div>
          </details>
        )}
      </div>
    </div>
  );
}

function BeforeAfterPanel({ staleAllocs, activeAlloc, blockedRoad, locations = [], allocations = [] }) {
  const getLoc = (id) => (locations || []).find(l => l.id === id);
  const hasRealloc = staleAllocs.length > 0;
  const primaryStale = staleAllocs[0];
  const primaryActive = activeAlloc || allocations.find(a => a.status === 'AVAILABLE' || a.status === 'IN_TRANSIT');

  if (!hasRealloc) {
    return (
      <div className="p-6 bg-[#05080D] rounded-lg border border-[#1E2D42]/50 text-center">
        <Route size={32} className="mx-auto text-[#27364D] mb-3" />
        <h3 className="font-medium text-white mb-1">NO REALLOCATION EVENT</h3>
        <p className="text-[11px] text-[#5A6E85] mt-1">
          Trigger a demand spike or road blockage to observe adaptive response.
        </p>
      </div>
    );
  }

  const staleLoc = getLoc(primaryStale?.source_id);
  const activeLoc = getLoc(primaryActive?.source_id);

  return (
    <div className="space-y-4">
      {/* BEFORE */}
      <div className="p-4 bg-[#0B111B] rounded-lg border border-[#EF4444]/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-[#EF4444] uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={10} /> BEFORE — STALE ALLOCATION
          </h3>
          <StatusBadge label="STALE" color={ALLOC_STATUS_COLORS.STALE} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">SOURCE</div>
            <div className="text-white font-mono">{staleLoc?.name || primaryStale?.source_id}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">DESTINATION</div>
            <div className="text-white font-mono truncate">{primaryStale?.demand_id}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">RESOURCE</div>
            <div className="text-white font-mono">{primaryStale?.resource_id}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">QUANTITY</div>
            <div className="text-white font-mono">{primaryStale?.quantity}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30 col-span-2">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">ROUTE</div>
            <div className="text-white font-mono text-xs bg-[#05080D] px-2 py-1 rounded border border-[#1E2D42]/30 inline-block">{primaryStale?.route_path}</div>
          </div>
        </div>
      </div>

      {/* TRIGGER */}
      <div className="flex items-center justify-center py-2">
        <div className="flex items-center gap-2 text-[#EF4444]">
          <div className="w-2 h-2 bg-[#EF4444] rounded-full" />
          <span className="text-[10px] font-mono text-[#EF4444]">↓ TRIGGER: {blockedRoad ? `ROAD ${blockedRoad.id} BLOCKED` : 'REALLOCATION TRIGGERED'} ↓</span>
          <div className="w-2 h-2 bg-[#EF4444] rounded-full" />
        </div>
      </div>

      {/* AFTER */}
      <div className="p-4 bg-[#0B111B] rounded-lg border border-[#10B981]/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold text-[#10B981] uppercase tracking-wider flex items-center gap-1">
            <CheckCircle size={10} /> AFTER — REALLOCATED
          </h3>
          <StatusBadge label="REALLOCATED" color={ALLOC_STATUS_COLORS.REALLOCATED} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">NEW SOURCE</div>
            <div className="text-white font-mono">{activeLoc?.name || primaryActive?.source_id || 'N/A'}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">DESTINATION</div>
            <div className="text-white font-mono truncate">{primaryActive?.demand_id || 'N/A'}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">RESOURCE</div>
            <div className="text-white font-mono">{primaryActive?.resource_id || 'N/A'}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">QUANTITY</div>
            <div className="text-white font-mono">{primaryActive?.quantity || 'N/A'}</div>
          </div>
          <div className="bg-[#05080D] p-2 rounded border border-[#1E2D42]/30 col-span-2">
            <div className="text-[9px] text-[#5A6E85] uppercase mb-1">ALTERNATE ROUTE</div>
            <div className="text-white font-mono text-xs bg-[#05080D] px-2 py-1 rounded border border-[#1E2D42]/30 inline-block">{primaryActive?.route_path || 'N/A'}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-[#1E2D42]/50">
          <StatusBadge label="REALLOCATED" color={ALLOC_STATUS_COLORS.REALLOCATED} />
        </div>
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const { region } = useRegion();
  const cityParam = region === 'INDIA' ? undefined : region;
  const [dashboard, setDashboard] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [roads, setRoads] = useState([]);
  const [demands, setDemands] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [resources, setResources] = useState([]);
  const [auditValid, setAuditValid] = useState(true);
  const [loadingAction, setLoadingAction] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [auditData, setAuditData] = useState(null);

  const fetchAll = async () => {
    try {
      const [d, a, r, dm, inc, l, inv, res, aud, audv] = await Promise.all([
        api.getDashboard(cityParam),
        api.getAllocations(cityParam),
        api.getRoads(cityParam),
        api.getDemands(cityParam),
        api.getIncidents(cityParam),
        api.getLocations(cityParam),
        api.getInventory(cityParam),
        api.getResources(),
        api.getAudit(cityParam),
        api.verifyAudit(),
      ]);
      setDashboard(d.data);
      setAllocations(a.data);
      setRoads(r.data);
      setDemands(dm.data);
      setIncidents(inc.data);
      setLocations(l.data);
      setInventory(inv.data);
      setResources(res.data);
      setAuditData(aud.data);
      setAuditValid(audv.data.valid);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAll();
    pushTimeline('SIMULATION INITIALIZED', region === 'INDIA' ? 'NATIONAL · EARTHQUAKE RESPONSE' : `${region.toUpperCase()} · EARTHQUAKE RESPONSE`, 'System ready. Topological graph loaded. Awaiting scenario triggers.');
    const int = setInterval(fetchAll, 4000);
    return () => clearInterval(int);
  }, [region]);

  const pushTimeline = (msg, sub, detail) => {
    setTimeline(prev => [
      ...prev,
      { time: getTime(), msg, sub, detail, id: Date.now() + Math.random() },
    ]);
  };

  const scopeLabel = region === 'INDIA' ? 'INDIA (NATIONAL)' : region.toUpperCase();

  const handleEvent = async (type, label) => {
    setLoadingAction(label);
    try {
      const res = await api.triggerEvent(type, cityParam);
      setLastEvent({ type, label, resp: res?.data?.message || '', time: getTime() });
      pushTimeline(`EVENT: ${label}`, `${scopeLabel} · ${type}`, res?.data?.message || '');
      await fetchAll();
    } catch (e) {
      setLastEvent({ type, label, resp: `Error: ${e.message}`, time: getTime(), error: true });
      pushTimeline(`EVENT FAILED: ${label}`, scopeLabel, e.message, true);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRunAllocation = async () => {
    setLoadingAction('RUN_ALLOCATION_ENGINE');
    try {
      const res = await api.runAllocations(cityParam);
      setLastEvent({ type: 'ALLOC', label: 'RUN ALLOCATION ENGINE', resp: res?.data?.message || '', time: getTime() });
      pushTimeline('ALLOCATION ENGINE RUN', `${scopeLabel} · RECALCULATING`, `Result: ${res?.data?.message || 'No new allocations'}`);
      await fetchAll();
    } catch (e) {
      setLastEvent({ type: 'ALLOC', label: 'RUN ALLOCATION ENGINE', resp: `Error: ${e.message}`, time: getTime(), error: true });
      pushTimeline('ALLOCATION ENGINE FAILED', scopeLabel, e.message, true);
    } finally {
      setLoadingAction(null);
    }
  };

  const staleAllocs = useMemo(() => allocations.filter(a => a.status === 'STALE'), [allocations]);
  const activeAlloc = useMemo(() => allocations.find(a => ['AVAILABLE', 'ALLOCATED', 'DISPATCHED', 'IN_TRANSIT'].includes(a.status)), [allocations]);
  const blockedRoad = useMemo(() => roads.find(r => r.status === 'BLOCKED'), [roads]);
  const openCount = roads.filter(r => r.status === 'OPEN').length;
  const blockedCount = roads.filter(r => r.status === 'BLOCKED').length;
  const totalInv = dashboard?.resources_available ?? 0;
  const activeAllocCount = dashboard?.active_allocations ?? 0;
  const pendingDemand = dashboard?.pending_demand ?? 0;
  const criticalDemands = demands.filter(d => d.severity >= 4 && (d.status === 'OPEN' || d.status === 'PARTIAL')).length;
  const activeDemands = demands.filter(d => d.status === 'OPEN' || d.status === 'PARTIAL').length;
  const openDemands = useMemo(() => demands.filter(d => d.status === 'OPEN' || d.status === 'PARTIAL'), [demands]);
  const liveIncidents = useMemo(
    () => incidents.filter(i => i.status === 'ACTIVE' || i.status === 'MONITORING'),
    [incidents],
  );

  // Only resource types actually stocked in this scope get a card.
  const scopedResources = useMemo(() => {
    const stocked = new Set(inventory.map(i => i.resource_id));
    return resources.filter(r => stocked.has(r.id));
  }, [resources, inventory]);

  return (
    <div className="min-h-screen bg-[#05080D] text-[#E8EDF2] font-sans antialiased">
      {/* ==================== SIMULATION HEADER ==================== */}
      <header className="px-4 py-3 border-b border-[#1E2D42] bg-[#0B111B]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-full mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
              <Zap size={16} className="text-[#05080D]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">DISASTER SIMULATION ENVIRONMENT</h1>
              <p className="text-[10px] text-[#5A6E85] tracking-wider">
                Real-time scenario simulation, topological road-network disruption and resource reallocation analysis.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1.5 text-[#10B981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" /> SIMULATION ACTIVE
            </div>
            <div className="flex items-center gap-1.5 text-[#8B9CB3]">
              <Wifi size={10} className="text-[#10B981]" /> API CONNECTED
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={10} className={auditValid ? 'text-[#10B981]' : 'text-[#EF4444]'} />
              <span className={`font-mono ${auditValid ? 'text-[#10B981]' : 'text-[#EF4444]'} `}>AUDIT {auditValid ? 'VALID' : 'INVALID'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#5A6E85] border-l border-[#1E2D42] pl-3 ml-2">
              <span className="text-white font-mono">EARTHQUAKE RESPONSE</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#5A6E85] border-l border-[#1E2D42] pl-3 ml-2">
              <span className="text-white font-mono">{region === 'INDIA' ? 'INDIA OVERVIEW' : region.toUpperCase() + ' OPERATIONS'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-full">
        {/* ==================== ROW 1: SCENARIO INPUTS + DISASTER SCENARIO + TOPOLOGICAL NETWORK ==================== */}
        <div className="grid lg:grid-cols-[300px_1fr] gap-4">
          {/* LEFT COLUMN: SCENARIO INPUTS + DISASTER SCENARIO + RESOURCE INVENTORY */}
          <div className="space-y-4 lg:order-1">
            {/* SCENARIO INPUTS */}
            <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider flex items-center gap-1">
                  <Terminal size={11} className="text-[#00D4FF]" /> SCENARIO INPUTS
                </h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[#5A6E85]">DISASTER CATEGORY</span><span className="text-white font-medium">EARTHQUAKE</span></div>
                <div className="flex justify-between"><span className="text-[#5A6E85]">AFFECTED REGION</span><span className="text-white font-medium">{region === 'INDIA' ? 'INDIA (NATIONAL DISASTER RESPONSE)' : `${region} OPERATIONS`}</span></div>
                <div className="flex justify-between"><span className="text-[#5A6E85]">SEVERITY</span><span className="text-white font-mono font-medium">{dashboard?.critical_cases ?? 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-[#5A6E85]">AFFECTED POPULATION</span><span className="text-white font-mono font-medium">{dashboard?.affected_population?.toLocaleString() ?? 'N/A'}</span></div>
                <div className="flex justify-between border-t border-[#1E2D42]/50 pt-2">
                  <span className="text-[#5A6E85]">ACTIVE DEMANDS</span>
                  <span className="text-white font-mono font-medium">{activeDemands}</span>
                </div>
                <div className="flex justify-between"><span className="text-[#5A6E85]">CRITICAL DEMANDS</span><span className="text-white font-mono font-medium text-[#EF4444]">{criticalDemands}</span></div>
              </div>
              <div className="mt-4 border-t border-[#1E2D42]/50 pt-3 space-y-2">
                <h3 className="text-[10px] text-[#8B9CB3] uppercase tracking-wider">CONTROLS</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handleEvent('DEMAND_SPIKE', 'DEMAND SPIKE')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-between p-2.5 rounded bg-[#151F30] border border-[#F59E0B]/30 text-left transition-all disabled:opacity-50 hover:border-[#F59E0B]/60"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded flex items-center justify-center bg-[#F59E0B]/20">
                        <AlertTriangle size={14} className="text-[#F59E0B]" />
                      </div>
                      <div>
                        <div className="text-white text-xs font-medium">⚠ DEMAND SPIKE</div>
                        <div className="text-[9px] text-[#5A6E85]">Raise emergency demand in {scopeLabel}</div>
                      </div>
                    </div>
                    {loadingAction === 'DEMAND_SPIKE' && <RefreshCw size={14} className="animate-spin text-[#F59E0B]" />}
                  </button>
                  <button
                    onClick={() => handleEvent('ROAD_BLOCKED', 'BLOCK A CORRIDOR')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-between p-2.5 rounded bg-[#151F30] border border-[#EF4444]/30 text-left transition-all disabled:opacity-50 hover:border-[#EF4444]/60"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded flex items-center justify-center bg-[#EF4444]/20">
                        <MapPin size={14} className="text-[#EF4444]" />
                      </div>
                      <div>
                        <div className="text-white text-xs font-medium">🚧 BLOCK A CORRIDOR</div>
                        <div className="text-[9px] text-[#5A6E85]">Cut a {scopeLabel} corridor and reallocate</div>
                      </div>
                    </div>
                    {loadingAction === 'ROAD_BLOCKED' && <RefreshCw size={14} className="animate-spin text-[#EF4444]" />}
                  </button>
                  <button
                    onClick={() => handleEvent('ROAD_RESTORED', 'REOPEN A CORRIDOR')}
                    disabled={!!loadingAction || blockedCount === 0}
                    className="w-full flex items-center justify-between p-2.5 rounded bg-[#151F30] border border-[#10B981]/30 text-left transition-all disabled:opacity-40 hover:border-[#10B981]/60"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded flex items-center justify-center bg-[#10B981]/20">
                        <Route size={14} className="text-[#10B981]" />
                      </div>
                      <div>
                        <div className="text-white text-xs font-medium">✔ REOPEN A CORRIDOR</div>
                        <div className="text-[9px] text-[#5A6E85]">{blockedCount} blocked in this scope</div>
                      </div>
                    </div>
                    {loadingAction === 'ROAD_RESTORED' && <RefreshCw size={14} className="animate-spin text-[#10B981]" />}
                  </button>
                  <button
                    onClick={handleRunAllocation}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-between p-2.5 rounded bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-[#05080D] font-medium text-left transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(0,212,255,0.2)]"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
                        <RefreshCw size={14} className="text-[#05080D]" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">↻ RUN ALLOCATION ENGINE</div>
                        <div className="text-[9px] opacity-70">Recalculate {scopeLabel} only</div>
                      </div>
                    </div>
                    {loadingAction === 'RUN_ALLOCATION_ENGINE' && <RefreshCw size={14} className="animate-spin text-[#05080D]" />}
                  </button>
                </div>
              </div>
            </section>

            {/* DISASTER SCENARIO */}
            <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider flex items-center gap-1">
                  <TriangleAlert size={11} className="text-[#F59E0B]" /> DISASTER SCENARIO
                </h2>
                <StatusBadge label="ACTIVE" color={{ bg: 'bg-[#F59E0B]/20', border: 'border-[#F59E0B]/40', text: 'text-[#F59E0B]', dot: '#F59E0B', label: 'ACTIVE' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricRow label="ACTIVE EMERGENCIES" value={dashboard?.active_emergencies ?? 0} />
                <MetricRow label="RESOURCES AVAILABLE" value={totalInv?.toLocaleString() ?? '—'} />
                <MetricRow label="ACTIVE ALLOCATIONS" value={activeAllocCount} />
                <MetricRow label="PENDING DEMAND" value={pendingDemand?.toLocaleString() ?? '—'} unit="UNITS" />
              </div>
              <div className="mt-3 pt-3 border-t border-[#1E2D42]/50 grid grid-cols-2 gap-3">
                <MetricRow label="TOTAL ROADS" value={roads.length} />
                <MetricRow label="OPEN ROUTES" value={openCount} unit="" trend={<span className="text-[#10B981]">+{openCount}</span>} />
                <MetricRow label="BLOCKED ROUTES" value={blockedCount} unit="" trend={<span className="text-[#EF4444]">+{blockedCount}</span>} />
                <MetricRow label="CRITICAL DEMANDS" value={criticalDemands} unit="" trend={criticalDemands > 0 ? <span className="text-[#EF4444]">HIGH</span> : <span className="text-[#10B981]">NOMINAL</span>} />
              </div>
            </section>

            {/* RESOURCE INVENTORY */}
            <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
              <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider mb-3 flex items-center gap-1">
                <Package size={11} className="text-[#00D4FF]" /> RESOURCE INVENTORY — {scopeLabel}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {scopedResources.map(res => (
                  <ResourceCard
                    key={res.id}
                    resource={res}
                    rows={inventory.filter(i => i.resource_id === res.id)}
                    allocations={allocations}
                    openDemands={openDemands}
                  />
                ))}
                {scopedResources.length === 0 && (
                  <p className="col-span-3 text-[11px] text-[#5A6E85] font-mono py-3 text-center">NO STOCK RECORDS IN THIS SCOPE</p>
                )}
              </div>
            </section>

            {/* LIVE INCIDENT REGISTER */}
            <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
              <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider mb-3 flex items-center gap-1">
                <TriangleAlert size={11} className="text-[#EF4444]" /> LIVE INCIDENT REGISTER — {scopeLabel}
              </h2>
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
                {liveIncidents.map(inc => (
                  <div key={inc.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-[#1E2D42]/60 bg-[#05080D] text-[11px] font-mono">
                    <span className="text-white truncate">{inc.title}</span>
                    <span className={inc.severity >= 4 ? 'text-[#EF4444]' : 'text-[#FFB95F]'}>SEV {inc.severity}</span>
                    <span className="text-[#8B9CB3]">{inc.category}</span>
                    <span className="text-[#00D4FF]">{(inc.affected_population ?? 0).toLocaleString()} exposed</span>
                    <span className={inc.status === 'ACTIVE' ? 'text-[#EF4444]' : 'text-[#FFB95F]'}>{inc.status}</span>
                  </div>
                ))}
                {liveIncidents.length === 0 && (
                  <p className="text-[11px] text-[#5A6E85] font-mono py-3 text-center">NO LIVE INCIDENTS IN THIS SCOPE</p>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: TOPOLOGICAL NETWORK */}
          <div className="space-y-4 lg:order-2">
            <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider flex items-center gap-1">
                  <GitBranch size={11} className="text-[#00D4FF]" /> TOPOLOGICAL NETWORK & ROAD VECTORS
                </h2>
                <span className="text-[9px] text-[#5A6E85]">Real-time graph state · route feasibility</span>
              </div>
              <div className="h-[480px] w-full rounded-lg overflow-hidden border border-[#1E2D42]/50 relative"><MapView selectedAllocation={activeAlloc || staleAllocs[0] || null} /></div>
            </section>

            {/* ROAD / ROUTE STATUS */}
            <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
              <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider mb-3 flex items-center gap-1">
                <Route size={11} className="text-[#00D4FF]" /> ROAD / ROUTE STATUS
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roads.map(road => (
                  <RoadCard key={road.id} road={road} locations={locations} allocations={allocations} />
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* ==================== ROW 2: CAUSE → EFFECT TIMELINE + ALGORITHMIC RATIONALE ==================== */}
        <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider flex items-center gap-1">
              <Activity size={11} className="text-[#EF4444]" /> CAUSE → EFFECT TIMELINE & ALGORITHMIC RATIONALE
            </h2>
            <span className="text-[9px] text-[#5A6E85]">{timeline.length} EVENTS RECORDED</span>
          </div>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#1E2D42]/50" />
            <div className="space-y-4 pl-12">
              {timeline.length === 0 ? (
                <p className="text-[#5A6E85] text-sm py-8 text-center">NO EVENTS RECORDED. TRIGGER A SIMULATION EVENT.</p>
              ) : (
                timeline.map((event, i) => (
                  <TimelineEvent key={event.id} event={event} index={i} total={timeline.length} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* ==================== ROW 3: BEFORE / AFTER REALLOCATION ==================== */}
        <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
          <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider mb-3 flex items-center gap-1">
            <Route size={11} className="text-[#F59E0B]" /> BEFORE / AFTER REALLOCATION
          </h2>
          <BeforeAfterPanel
            staleAllocs={allocations.filter(a => a.status === 'STALE')}
            activeAlloc={allocations.find(a => a.status === 'AVAILABLE' || a.status === 'IN_TRANSIT')}
            blockedRoad={roads.find(r => r.status === 'BLOCKED')}
            locations={locations}
          />
        </section>

        {/* ==================== ROW 4: AUDIT / SYSTEM INTEGRITY ==================== */}
        <section className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={11} className="text-[#10B981]" /> SYSTEM INTEGRITY
            </h2>
            <div className="flex items-center gap-3 text-[10px]">
              <StatusBadge label="AUDIT CHAIN VALID" color={{ bg: 'bg-[#10B981]/20', border: 'border-[#10B981]/40', text: 'text-[#10B981]', dot: '#10B981', label: 'VALID' }} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-[#05080D] p-3 rounded border border-[#1E2D42]/30">
              <div className="text-[9px] text-[#5A6E85] uppercase mb-1">LATEST EVENT</div>
              <div className="text-white font-mono text-sm">{auditData?.[auditData.length - 1]?.event_type || 'N/A'}</div>
            </div>
            <div className="bg-[#05080D] p-3 rounded border border-[#1E2D42]/30">
              <div className="text-[9px] text-[#5A6E85] uppercase mb-1">TIMESTAMP</div>
              <div className="text-white font-mono text-sm">{auditData?.[auditData.length - 1]?.timestamp || getTime()}</div>
            </div>
            <div className="bg-[#05080D] p-3 rounded border border-[#1E2D42]/30">
              <div className="text-[9px] text-[#5A6E85] uppercase mb-1">CURRENT HASH</div>
              <div className="text-[#00D4FF] font-mono text-xs truncate">{auditData?.[auditData.length - 1]?.current_hash || 'N/A'}</div>
            </div>
            <div className="bg-[#05080D] p-3 rounded border border-[#1E2D42]/30">
              <div className="text-[9px] text-[#5A6E85] uppercase mb-1">PREVIOUS HASH</div>
              <div className="text-[#5A6E85] font-mono text-xs truncate">{auditData?.[auditData.length - 2]?.current_hash || auditData?.[auditData.length - 1]?.previous_hash || 'N/A'}</div>
            </div>
          </div>
          <p className="text-[9px] text-[#5A6E85] mt-3 text-center">
            TAMPER-EVIDENT SHA-256 HASH-CHAINED AUDIT LEDGER · {auditData?.length || 0} RECORDS VERIFIED
          </p>
        </section>
      </div>
    </div>
  );
}