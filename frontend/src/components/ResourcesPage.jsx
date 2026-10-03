import React, { useEffect, useState, useMemo } from 'react';
import {
  Package, Warehouse, Truck, AlertTriangle, Search, X, Wifi, MapPin,
  BarChart3, ShieldCheck, RefreshCw, Download, Plus, Bell, Activity,
  Boxes, ArrowRight, Clock
} from 'lucide-react';
import { api } from '../services/api';
import MapView from './MapView';
import { useRegion } from '../context/RegionContext';

/* ============ status color system ============ */
const STATUS = {
  AVAILABLE:   { bg: 'bg-[#4EDEA3]/10', border: 'border-[#4EDEA3]/40', text: 'text-[#4EDEA3]', dot: '#4EDEA3', label: 'AVAILABLE' },
  LOW:         { bg: 'bg-[#FFB95F]/10', border: 'border-[#FFB95F]/40', text: 'text-[#FFB95F]', dot: '#FFB95F', label: 'LOW STOCK' },
  CRITICAL:    { bg: 'bg-[#FFB4AB]/10', border: 'border-[#FFB4AB]/40', text: 'text-[#FFB4AB]', dot: '#FFB4AB', label: 'CRITICAL' },
  ALLOCATED:   { bg: 'bg-[#ADC6FF]/10', border: 'border-[#ADC6FF]/40', text: 'text-[#ADC6FF]', dot: '#ADC6FF', label: 'ALLOCATED' },
  IN_TRANSIT:  { bg: 'bg-[#22D3EE]/10', border: 'border-[#22D3EE]/40', text: 'text-[#22D3EE]', dot: '#22D3EE', label: 'IN TRANSIT' },
  DISPATCHED:  { bg: 'bg-[#ADC6FF]/10', border: 'border-[#ADC6FF]/40', text: 'text-[#ADC6FF]', dot: '#ADC6FF', label: 'DISPATCHED' },
  RESERVED:    { bg: 'bg-[#A855F7]/10', border: 'border-[#A855F7]/40', text: 'text-[#A855F7]', dot: '#A855F7', label: 'RESERVED' },
  DELIVERED:   { bg: 'bg-[#4EDEA3]/10', border: 'border-[#4EDEA3]/40', text: 'text-[#4EDEA3]', dot: '#4EDEA3', label: 'DELIVERED' },
};

const SEV = {
  CRITICAL: 'text-[#FFB4AB] border-[#FFB4AB]/40 bg-[#FFB4AB]/10',
  WARNING:  'text-[#FFB95F] border-[#FFB95F]/40 bg-[#FFB95F]/10',
  INFO:     'text-[#ADC6FF] border-[#ADC6FF]/40 bg-[#ADC6FF]/10',
};

function Badge({ label, cfg }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded-sm text-[10px] font-semibold font-mono border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: cfg.dot }} />
      {label}
    </span>
  );
}

/* ============ KPI card ============ */
function Kpi({ label, value, sub, trend, icon: Icon, accent }) {
  return (
    <div className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#C2C6D6] uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={13} className={accent} />}
      </div>
      <div className="font-mono font-bold text-white text-[26px] leading-8 mt-0.5">{value}</div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-[#C2C6D6] font-mono uppercase">{sub}</span>
        {trend && <span className={`text-[10px] font-mono ${accent}`}>{trend}</span>}
      </div>
    </div>
  );
}

/* ============ resource detail drawer (real relations) ============ */
function DetailDrawer({ entry, demands, allocations, locMap, resMap, lastSync, onClose }) {
  if (!entry) return null;
  const relAllocs = allocations.filter(a => a.resource_id === entry.resourceId && a.source_id === entry.locationId);
  const relDemands = demands.filter(d => d.resource_id === entry.resourceId);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111317] border-l border-[#424754] h-full flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-[#424754]/40 bg-[#1A1C1F]">
          <div>
            <div className="text-[10px] font-mono text-[#ADC6FF]">{entry.resourceId} · {entry.locationId}</div>
            <h2 className="font-semibold text-white text-sm">RESOURCE DETAILS</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-sm bg-[#282A2D] text-[#C2C6D6] hover:text-white" aria-label="Close details">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <div className="bg-[#1A1C1F] border border-[#424754]/40 rounded-sm p-3">
            <h3 className="text-[10px] font-semibold text-[#C2C6D6] uppercase tracking-wider mb-2 font-mono">Stock Position</h3>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">TYPE</div><div className="text-white text-xs">{resMap[entry.resourceId]?.name ?? '—'}</div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">DEPOT</div><div className="text-white text-xs">{locMap[entry.locationId]?.name ?? entry.locationId}</div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">TOTAL</div><div className="text-white text-base font-bold">{entry.total}</div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">AVAILABLE</div><div className="text-[#4EDEA3] text-base font-bold">{entry.available}</div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">ALLOCATED</div><div className="text-[#ADC6FF] text-base font-bold">{entry.allocated}</div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">IN TRANSIT</div><div className="text-[#22D3EE] text-base font-bold">{entry.inTransit}</div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">STATUS</div><div className="mt-1"><Badge label={entry.statusLabel} cfg={entry.statusCfg} /></div></div>
              <div className="bg-[#05080D] p-2 rounded-sm border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">LAST SYNC</div><div className="text-white text-[11px]">{lastSync ? new Date(lastSync).toLocaleTimeString('en-US', { hour12: false }) : '—'}</div></div>
            </div>
          </div>
          <div className="bg-[#1A1C1F] border border-[#424754]/40 rounded-sm p-3">
            <h3 className="text-[10px] font-semibold text-[#C2C6D6] uppercase tracking-wider mb-2 font-mono">Active Allocations ({relAllocs.length})</h3>
            <div className="space-y-2">
              {relAllocs.map(a => (
                <div key={a.id} className="p-2 bg-[#05080D] rounded-sm border border-[#424754]/30 font-mono text-[11px]">
                  <div className="flex justify-between text-white"><span>→ {a.demand_id.slice(0, 8)}</span><span className="text-[#4EDEA3]">{a.quantity} units</span></div>
                  <div className="text-[10px] text-[#C2C6D6]">ROUTE {a.route_path} · {a.status}</div>
                </div>
              ))}
              {relAllocs.length === 0 && <p className="text-[11px] text-[#C2C6D6] py-2 text-center">No allocations sourced from this depot row.</p>}
            </div>
          </div>
          <div className="bg-[#1A1C1F] border border-[#424754]/40 rounded-sm p-3">
            <h3 className="text-[10px] font-semibold text-[#C2C6D6] uppercase tracking-wider mb-2 font-mono">Related Demands ({relDemands.length})</h3>
            <div className="space-y-2">
              {relDemands.map(d => (
                <div key={d.id} className="p-2 bg-[#05080D] rounded-sm border border-[#424754]/30 font-mono text-[11px]">
                  <div className="flex justify-between text-white"><span>{d.id.slice(0, 12)}</span><span>SEV {d.severity}</span></div>
                  <div className="text-[10px] text-[#C2C6D6]">DEST {locMap[d.location_id]?.name ?? d.location_id} · NEED {d.quantity} · {d.status}</div>
                </div>
              ))}
              {relDemands.length === 0 && <p className="text-[11px] text-[#C2C6D6] py-2 text-center">No demands reference this resource.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const [dashboard, setDashboard] = useState(null);
  const [locations, setLocations] = useState([]);
  const [resources, setResources] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [demands, setDemands] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditValid, setAuditValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [depotFilter, setDepotFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shortagesOnly, setShortagesOnly] = useState(false);
  const REFRESH_MS = 4000;

  const { region } = useRegion();
  const cityParam = region === 'INDIA' ? undefined : region;

  const fetchAll = async () => {
    try {
      const [d, l, r, inv, a, dm, au, ver] = await Promise.all([
        api.getDashboard(cityParam), api.getLocations(cityParam), api.getResources(), api.getInventory(cityParam),
        api.getAllocations(cityParam), api.getDemands(cityParam), api.getAudit(cityParam), api.verifyAudit(),
      ]);
      setDashboard(d.data); setLocations(l.data); setResources(r.data); setInventory(inv.data);
      setAllocations(a.data); setDemands(dm.data); setAudit(au.data); setAuditValid(ver.data.valid);
      setLastSync(new Date().toISOString()); setError(null);
    } catch (e) { console.error(e); setError('RESOURCE LEDGER UNREACHABLE — CHECK BACKEND LINK'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, REFRESH_MS); return () => clearInterval(t); }, [region]);

  const locMap = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  const resMap = useMemo(() => Object.fromEntries(resources.map(r => [r.id, r])), [resources]);
  const warehouses = useMemo(() => locations.filter(l => l.type === 'WAREHOUSE'), [locations]);
  const openDemands = useMemo(() => demands.filter(d => d.status === 'OPEN' || d.status === 'PARTIAL'), [demands]);

  /* per inventory-row entries (multi-depot quota rows) */
  const entries = useMemo(() => inventory.map(row => {
    const allocQty = allocations.filter(a => a.resource_id === row.resource_id && a.source_id === row.location_id && ['ALLOCATED', 'DISPATCHED'].includes(a.status)).reduce((s, a) => s + a.quantity, 0);
    const transitQty = allocations.filter(a => a.resource_id === row.resource_id && a.source_id === row.location_id && a.status === 'IN_TRANSIT').reduce((s, a) => s + a.quantity, 0);
    const available = Math.max(0, row.quantity - allocQty - transitQty);
    const required = openDemands.filter(d => d.resource_id === row.resource_id).reduce((s, d) => s + d.quantity, 0);
    const demandCover = required > 0 ? Math.min(100, Math.round((available / required) * 100)) : 100;
    let status = 'AVAILABLE', statusCfg = STATUS.AVAILABLE;
    if (available <= 0 && required > 0) { status = 'CRITICAL'; statusCfg = STATUS.CRITICAL; }
    else if (transitQty > 0 && available / Math.max(1, row.quantity) < 0.2) { status = 'IN_TRANSIT'; statusCfg = STATUS.IN_TRANSIT; }
    else if (allocQty > 0) { status = 'ALLOCATED'; statusCfg = STATUS.ALLOCATED; }
    else if (transitQty > 0) { status = 'IN_TRANSIT'; statusCfg = STATUS.IN_TRANSIT; }
    else if (row.quantity === 0) { status = 'CRITICAL'; statusCfg = STATUS.CRITICAL; }
    else if (available / Math.max(1, row.quantity) < 0.5 || demandCover < 50) { status = 'LOW'; statusCfg = STATUS.LOW; }
    return { key: `${row.resource_id}@${row.location_id}`, resourceId: row.resource_id, locationId: row.location_id, total: row.quantity, available, allocated: allocQty, inTransit: transitQty, required, demandCover, status, statusLabel: statusCfg.label, statusCfg, rowPct: row.quantity > 0 ? Math.round((available / row.quantity) * 100) : 0 };
  }), [inventory, allocations, openDemands]);

  /* KPIs from real data */
  const totalInv = useMemo(() => inventory.reduce((s, i) => s + (i.quantity || 0), 0), [inventory]);
  const totalAvail = useMemo(() => entries.reduce((s, e) => s + e.available, 0), [entries]);
  const totalCommitted = useMemo(() => entries.reduce((s, e) => s + e.allocated + e.inTransit, 0), [entries]);
  const readyPct = totalInv > 0 ? ((totalAvail / totalInv) * 100).toFixed(1) : '0.0';
  const commitPct = totalInv > 0 ? ((totalCommitted / totalInv) * 100).toFixed(1) : '0.0';
  const criticalCount = useMemo(() => entries.filter(e => e.status === 'CRITICAL').length, [entries]);

  /* category monitors */
  const categories = useMemo(() => {
    const cats = {};
    resources.forEach(r => { if (!cats[r.category]) cats[r.category] = { name: r.category, stock: 0, avail: 0, required: 0, members: 0 }; });
    entries.forEach(e => {
      const c = resMap[e.resourceId]?.category; if (!c || !cats[c]) return;
      cats[c].stock += e.total; cats[c].avail += e.available; cats[c].members += 1;
    });
    openDemands.forEach(d => {
      const c = resMap[d.resource_id]?.category; if (!c || !cats[c]) return;
      cats[c].required += d.quantity;
    });
    return Object.values(cats).map(c => {
      const coverage = c.required > 0 ? Math.min(100, Math.round((c.avail / c.required) * 100)) : 100;
      const util = c.stock > 0 ? Math.round(((c.stock - c.avail) / c.stock) * 100) : 0;
      const st = coverage <= 0 && c.required > 0 ? STATUS.CRITICAL : coverage < 60 ? STATUS.LOW : STATUS.AVAILABLE;
      return { ...c, coverage, util, st };
    });
  }, [resources, entries, openDemands, resMap]);

  const categoriesAvail = useMemo(() => [...new Set(resources.map(r => r.category))], [resources]);

  /* matrix filtering */
  const filtered = useMemo(() => entries.filter(e => {
    const res = resMap[e.resourceId]; const loc = locMap[e.locationId];
    const hay = `${e.resourceId} ${res?.name ?? ''} ${res?.category ?? ''} ${loc?.name ?? ''} ${e.locationId} ${e.status}`.toLowerCase();
    if (searchQuery && !hay.includes(searchQuery.toLowerCase())) return false;
    if (catFilter !== 'ALL' && res?.category !== catFilter) return false;
    if (depotFilter !== 'ALL' && e.locationId !== depotFilter) return false;
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (shortagesOnly && !(e.status === 'CRITICAL' || e.status === 'LOW')) return false;
    return true;
  }), [entries, searchQuery, catFilter, depotFilter, statusFilter, shortagesOnly, resMap, locMap]);

  /* depot utilization */
  const depots = useMemo(() => warehouses.map(w => {
    const stock = inventory.filter(i => i.location_id === w.id).reduce((s, i) => s + (i.quantity || 0), 0);
    const pct = w.capacity > 0 ? Math.round((stock / w.capacity) * 100) : 0;
    const dispatches = allocations.filter(a => a.source_id === w.id && ['DISPATCHED', 'IN_TRANSIT', 'ALLOCATED'].includes(a.status)).length;
    const st = pct >= 90 ? 'NEAR CAP' : pct >= 70 ? 'ELEVATED' : 'OPERATIONAL';
    const color = pct >= 90 ? '#FFB95F' : pct >= 70 ? '#ADC6FF' : '#4EDEA3';
    return { ...w, stock, pct, dispatches, st, color };
  }), [warehouses, inventory, allocations]);

  /* shortage + logistics alerts derived from real state */
  const alerts = useMemo(() => {
    const out = [];
    entries.filter(e => e.status === 'CRITICAL').forEach(e => {
      const sev = Math.max(...openDemands.filter(d => d.resource_id === e.resourceId).map(d => d.severity), 0);
      out.push({ sev: 'CRITICAL', text: `${e.resourceId} at ${e.locationId} depleted against open demand of ${e.required} units`, loc: locMap[e.locationId]?.name ?? e.locationId, sevLvl: sev || '—' });
    });
    entries.filter(e => e.status === 'LOW').forEach(e => out.push({ sev: 'WARNING', text: `${e.resourceId} at ${e.locationId} coverage ${e.demandCover}% of open demand`, loc: locMap[e.locationId]?.name ?? e.locationId, sevLvl: '—' }));
    allocations.filter(a => ['DELIVERED', 'VERIFIED'].includes(a.status)).slice(0, 2).forEach(a => out.push({ sev: 'INFO', text: `${a.quantity}x ${a.resource_id} confirmed ${a.status.toLowerCase()} via ${a.route_path}`, loc: locMap[a.source_id]?.name ?? a.source_id, sevLvl: '—' }));
    return out.slice(0, 6);
  }, [entries, openDemands, allocations, locMap]);

  const exportManifest = () => {
    const rows = [['resource_id', 'resource_name', 'category', 'depot', 'total', 'available', 'allocated', 'in_transit', 'required', 'coverage_pct', 'status']];
    filtered.forEach(e => rows.push([e.resourceId, resMap[e.resourceId]?.name ?? '', resMap[e.resourceId]?.category ?? '', e.locationId, e.total, e.available, e.allocated, e.inTransit, e.required, e.demandCover, e.status]));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tactical-supply-manifest.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center font-mono text-xs text-[#C2C6D6]">SYNCING RESOURCE LEDGER…</div>;
  if (error && entries.length === 0) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center border border-[#FFB4AB]/40 bg-[#FFB4AB]/5 rounded-sm p-6 max-w-md">
        <AlertTriangle size={28} className="mx-auto text-[#FFB4AB] mb-2" />
        <p className="font-mono text-xs text-[#FFB4AB]">{error}</p>
        <button onClick={() => { setLoading(true); fetchAll(); }} className="mt-3 px-3 py-1.5 text-xs font-mono border border-[#424754] rounded-sm text-white hover:border-[#ADC6FF]">RETRY SYNC</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 max-w-full pb-4">
      {/* compact ops header (no duplicate app shell) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-[#424754]/40 pb-2">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">RESOURCE INVENTORY &amp; STOCK MONITOR</h1>
          <p className="text-[10px] font-mono text-[#C2C6D6] tracking-widest">LIVE INVENTORY • DEPOT CAPACITY • SHORTAGE DETECTION</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="text-[#C2C6D6]">UPD {lastSync ? new Date(lastSync).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#424754]/60 text-[#C2C6D6] font-mono">REGION: {(region || 'INDIA').toString().toUpperCase()}</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#4EDEA3]/40 bg-[#4EDEA3]/10 text-[#4EDEA3]"><span className="w-1 h-1 rounded-full bg-[#4EDEA3] animate-pulse" />LIVE</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-[#424754]/60 text-[#C2C6D6]"><Wifi size={10} />API OK</span>
          <button onClick={fetchAll} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#424754]/60 text-[#C2C6D6] hover:text-white hover:border-[#ADC6FF]" aria-label="Refresh resources"><RefreshCw size={11} />SYNC</button>
          <button onClick={exportManifest} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#ADC6FF]/40 bg-[#ADC6FF]/10 text-[#ADC6FF] hover:bg-[#ADC6FF]/20 font-semibold" aria-label="Export manifest"><Download size={11} />EXPORT MANIFEST</button>
          <button title="No backend endpoint for batch intake — disabled" disabled className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-[#424754]/40 text-[#5A6E85] cursor-not-allowed opacity-60" aria-label="Log incoming batch (unavailable)"><Plus size={11} />LOG BATCH</button>
        </div>
      </div>

      {/* SECTION 1 — KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="TOTAL RESOURCES" value={totalInv.toLocaleString()} sub="UNITS IN SYSTEM" trend={`${warehouses.length} DEPOTS`} icon={Boxes} accent="text-[#ADC6FF]" />
        <Kpi label="AVAILABLE" value={totalAvail.toLocaleString()} sub={`${readyPct}% READY`} trend="UNCOMMITTED" icon={Package} accent="text-[#4EDEA3]" />
        <Kpi label="ALLOCATED" value={totalCommitted.toLocaleString()} sub={`${commitPct}% COMMITTED`} trend={`${allocations.length} LINES`} icon={Truck} accent="text-[#ADC6FF]" />
        <Kpi label="CRITICAL SHORTAGES" value={criticalCount} sub="REQUIRES ACTION" trend={criticalCount > 0 ? 'ACTION REQ' : 'NOMINAL'} icon={AlertTriangle} accent="text-[#FFB4AB]" />
      </div>

      {/* SECTION 2 — category monitoring */}
      <section>
        <div className="flex items-center justify-between border-b border-[#424754]/40 pb-1 mb-2">
          <span className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5"><BarChart3 size={13} className="text-[#ADC6FF]" />Resource Category Monitoring</span>
          <span className="text-[10px] font-mono text-[#C2C6D6]">{categories.length} CATEGORIES · LIVE</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {categories.map(c => (
            <div key={c.name} className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">{c.name} Supplies</span>
                <Badge label={c.st.label} cfg={c.st} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono mb-2">
                <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-1.5"><div className="text-[9px] text-[#C2C6D6]">AVAILABLE</div><div className="text-[#4EDEA3] text-sm font-bold">{c.avail.toLocaleString()}</div></div>
                <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-1.5"><div className="text-[9px] text-[#C2C6D6]">REQUIRED</div><div className="text-white text-sm font-bold">{c.required.toLocaleString()}</div></div>
                <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-1.5"><div className="text-[9px] text-[#C2C6D6]">COVERAGE</div><div className="text-[#ADC6FF] text-sm font-bold">{c.coverage}%</div></div>
              </div>
              <div className="h-1.5 bg-[#05080D] rounded-full overflow-hidden border border-[#424754]/20">
                <div className="h-full" style={{ width: `${Math.min(100, c.coverage)}%`, backgroundColor: c.coverage < 60 ? '#FFB95F' : '#4EDEA3' }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#C2C6D6] mt-1"><span>UTIL {c.util}%</span><span>STOCK {c.stock.toLocaleString()}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 — tactical supply matrix */}
      <section className="bg-[#111317] border border-[#424754]/40 rounded-sm overflow-hidden">
        <div className="p-2.5 border-b border-[#424754]/40 bg-[#1A1C1F]">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
            <div>
              <h2 className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">Tactical Supply Matrix // Multi-Depot Quota</h2>
              <p className="text-[10px] text-[#C2C6D6]">Real inventory rows joined with allocation state and open demand.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#C2C6D6]" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="SEARCH ID / NAME / DEPOT"
                  className="bg-[#05080D] border border-[#424754]/60 rounded-sm pl-7 pr-2 py-1 text-[11px] text-white font-mono focus:outline-none focus:border-[#ADC6FF] placeholder-[#5A6E85] w-52" />
              </div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bg-[#05080D] border border-[#424754]/60 rounded-sm px-2 py-1 text-[11px] font-mono text-white focus:outline-none" aria-label="Category filter">
                <option value="ALL">CAT: ALL</option>{categoriesAvail.map(c => <option key={c} value={c}>CAT: {c.toUpperCase()}</option>)}
              </select>
              <select value={depotFilter} onChange={e => setDepotFilter(e.target.value)} className="bg-[#05080D] border border-[#424754]/60 rounded-sm px-2 py-1 text-[11px] font-mono text-white focus:outline-none" aria-label="Depot filter">
                <option value="ALL">DEPOT: ALL</option>{warehouses.map(w => <option key={w.id} value={w.id}>DEPOT: {w.id}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#05080D] border border-[#424754]/60 rounded-sm px-2 py-1 text-[11px] font-mono text-white focus:outline-none" aria-label="Status filter">
                {['ALL', 'AVAILABLE', 'LOW', 'CRITICAL', 'ALLOCATED', 'IN_TRANSIT'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <button onClick={() => setShortagesOnly(v => !v)} className={`px-2 py-1 rounded-sm text-[11px] font-mono border ${shortagesOnly ? 'bg-[#FFB4AB]/15 border-[#FFB4AB] text-[#FFB4AB]' : 'bg-[#05080D] border-[#424754]/60 text-[#C2C6D6]'}`}>
                SHORTAGES ONLY
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]" role="table">
            <thead><tr className="border-b border-[#424754]/40 bg-[#05080D]/60 text-[#C2C6D6] text-[10px] uppercase">
              {['RESOURCE', 'CATEGORY', 'DEPOT', 'AVAIL', 'ALLOC', 'REQ', 'COVERAGE', 'STATUS', 'SYNC', ''].map(h => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#424754]/20">
              {filtered.map(e => (
                <tr key={e.key} className={`hover:bg-[#1A1C1F] ${e.status === 'CRITICAL' ? 'bg-[#FFB4AB]/[0.04]' : ''}`}>
                  <td className="px-3 py-1.5"><div className="text-[#ADC6FF] font-semibold">{e.resourceId}</div><div className="text-white text-[10px] font-sans">{resMap[e.resourceId]?.name}</div></td>
                  <td className="px-3 py-1.5 text-[#C2C6D6]">{resMap[e.resourceId]?.category}</td>
                  <td className="px-3 py-1.5"><div className="text-white">{e.locationId}</div><div className="text-[#C2C6D6] text-[10px]">{locMap[e.locationId]?.name?.split('(')[1]?.replace(')', '') ?? ''}</div></td>
                  <td className="px-3 py-1.5 text-[#4EDEA3] font-bold">{e.available}</td>
                  <td className="px-3 py-1.5 text-[#ADC6FF]">{e.allocated}</td>
                  <td className="px-3 py-1.5 text-white">{e.required}</td>
                  <td className="px-3 py-1.5 min-w-[110px]"><div className="flex items-center gap-1.5"><div className="flex-1 h-1 bg-[#05080D] rounded-full overflow-hidden border border-[#424754]/30"><div className="h-full" style={{ width: `${Math.min(100, e.demandCover)}%`, backgroundColor: e.demandCover < 60 ? '#FFB95F' : '#4EDEA3' }} /></div><span className="text-[#C2C6D6]">{e.demandCover}%</span></div></td>
                  <td className="px-3 py-1.5"><Badge label={e.statusCfg.label} cfg={e.statusCfg} /></td>
                  <td className="px-3 py-1.5 text-[#C2C6D6]">{lastSync ? new Date(lastSync).toLocaleTimeString('en-US', { hour12: false }) : '—'}</td>
                  <td className="px-3 py-1.5"><button onClick={() => setSelected(e)} className="p-1 text-[#C2C6D6] hover:text-[#ADC6FF] border border-[#424754]/40 rounded-sm hover:border-[#ADC6FF]/60" aria-label={`Inspect ${e.key}`}><ArrowRight size={12} /></button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan="10" className="px-3 py-6 text-center text-[#C2C6D6]">NO ROWS MATCH ACTIVE FILTERS</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* depot utilization + shortage alerts */}
      <div className="grid lg:grid-cols-2 gap-2">
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h2 className="text-[11px] font-bold text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5"><Warehouse size={13} className="text-[#ADC6FF]" />Depot Utilization</h2>
          <div className="space-y-2">
            {depots.map(d => (
              <div key={d.id} className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-2">
                <div className="flex justify-between text-[11px] font-mono mb-1"><span className="text-white font-semibold">{d.name.toUpperCase()}</span><span style={{ color: d.color }}>{d.pct}% {d.st}</span></div>
                <div className="h-1.5 bg-[#111317] rounded-full overflow-hidden border border-[#424754]/20"><div className="h-full" style={{ width: `${Math.min(100, d.pct)}%`, backgroundColor: d.color }} /></div>
                <div className="flex justify-between text-[10px] font-mono text-[#C2C6D6] mt-1"><span>STOCK {d.stock} / CAP {d.capacity}</span><span>{d.dispatches} ACTIVE DISPATCHES</span></div>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h2 className="text-[11px] font-bold text-white uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5"><Bell size={13} className="text-[#FFB95F]" />Shortage &amp; Logistics Alerts</h2>
          <div className="space-y-1.5">
            {alerts.map((a, i) => (
              <div key={i} className={`border rounded-sm px-2 py-1.5 text-[11px] font-mono flex items-start gap-2 ${SEV[a.sev]}`}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <div><span className="font-bold mr-1.5">{a.sev}:</span><span className="text-white">{a.text}</span><div className="text-[10px] opacity-70">{a.loc}</div></div>
              </div>
            ))}
            {alerts.length === 0 && <p className="text-[11px] font-mono text-[#4EDEA3] py-4 text-center">ALL SECTORS NOMINAL — NO ACTIVE ALERTS</p>}
          </div>
        </section>
      </div>

      {/* lower panels: availability / depot status / recent movements */}
      <div className="grid lg:grid-cols-3 gap-2">
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h2 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><Activity size={13} className="text-[#4EDEA3]" />Resource Availability</h2>
          <div className="space-y-1">
            {entries.map(e => (
              <button key={e.key} onClick={() => setSelected(e)} className="w-full flex items-center justify-between font-mono text-[11px] px-2 py-1 bg-[#05080D] border border-[#424754]/20 rounded-sm hover:border-[#ADC6FF]/50 text-left">
                <span className="text-white">{e.resourceId} <span className="text-[#C2C6D6]">@{e.locationId}</span></span>
                <span className={e.available <= 0 && e.required > 0 ? 'text-[#FFB4AB]' : 'text-[#4EDEA3]'}>{e.available}/{e.total}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h2 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><MapPin size={13} className="text-[#ADC6FF]" />Depot Status</h2>
          <div className="space-y-1">
            {locations.map(l => (
              <div key={l.id} className="flex items-center justify-between font-mono text-[11px] px-2 py-1 bg-[#05080D] border border-[#424754]/20 rounded-sm">
                <span className="text-white">{l.id} <span className="text-[#C2C6D6] text-[10px]">{l.type}</span></span>
                <span className="text-[#4EDEA3] flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-[#4EDEA3]" />OPERATIONAL</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h2 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><Clock size={13} className="text-[#ADC6FF]" />Recent Movements</h2>
          <div className="space-y-1">
            {audit.slice(0, 5).map(r => (
              <div key={r.id} className="font-mono text-[10px] px-2 py-1 bg-[#05080D] border border-[#424754]/20 rounded-sm">
                <div className="text-white">{r.event_type}</div>
                <div className="text-[#C2C6D6]">{new Date(r.timestamp).toLocaleTimeString('en-US', { hour12: false })} · {r.actor} · {r.current_hash.slice(0, 12)}…</div>
              </div>
            ))}
            {audit.length === 0 && <p className="text-[11px] font-mono text-[#C2C6D6] py-3 text-center">NO LEDGER EVENTS YET</p>}
          </div>
        </section>
      </div>

      {/* small supporting map + telemetry strip */}
      <section className="bg-[#111317] border border-[#424754]/40 rounded-sm overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-[#424754]/40 bg-[#1A1C1F] flex items-center justify-between">
          <span className="text-[11px] font-bold text-white uppercase font-mono">Depot Geospatial Reference</span>
          <span className="text-[10px] font-mono text-[#4EDEA3]">● HUBS CONNECTED</span>
        </div>
        <div className="h-[240px]"><MapView selectedAllocation={null} /></div>
      </section>
      <div className="bg-[#111317] border border-[#424754]/40 rounded-sm px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-[#C2C6D6]">
        <div className="flex items-center gap-3">
          <span>BACKEND TELEMETRY: <span className="text-[#4EDEA3]">ONLINE</span></span>
          <span>ENDPOINTS: <span className="text-white">/resources /inventory /allocations /demands</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span>AUTO-SYNC: <span className="text-white">{REFRESH_MS / 1000}s</span></span>
          <span>LAST SYNC: <span className="text-white">{lastSync ? new Date(lastSync).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span></span>
          <span className="flex items-center gap-1"><ShieldCheck size={12} className={auditValid ? 'text-[#4EDEA3]' : 'text-[#FFB4AB]'} /><span className={auditValid ? 'text-[#4EDEA3]' : 'text-[#FFB4AB]'}>AUDIT {auditValid ? 'VALID' : 'INVALID'}</span></span>
        </div>
      </div>

      {selected && <DetailDrawer entry={selected} demands={demands} allocations={allocations} locMap={locMap} resMap={resMap} lastSync={lastSync} onClose={() => setSelected(null)} />}
    </div>
  );
}
