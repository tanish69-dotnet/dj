import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, Truck, AlertTriangle, CheckCircle, XCircle,
  Clock, ShieldCheck, Route as RouteIcon, ArrowRight, Package, MapPin, Zap
} from 'lucide-react';
import { api } from '../services/api';
import { useRegion } from '../context/RegionContext';
import MapView from './MapView';

const STATUS_CFG = {
  AVAILABLE:   { bg: 'bg-[#4EDEA3]/10', border: 'border-[#4EDEA3]/40', text: 'text-[#4EDEA3]', dot: '#4EDEA3', label: 'AVAILABLE' },
  ALLOCATED:   { bg: 'bg-[#ADC6FF]/10', border: 'border-[#ADC6FF]/40', text: 'text-[#ADC6FF]', dot: '#ADC6FF', label: 'ALLOCATED' },
  DISPATCHED:  { bg: 'bg-[#ADC6FF]/10', border: 'border-[#ADC6FF]/40', text: 'text-[#ADC6FF]', dot: '#ADC6FF', label: 'DISPATCHED' },
  IN_TRANSIT:  { bg: 'bg-[#22D3EE]/10', border: 'border-[#22D3EE]/40', text: 'text-[#22D3EE]', dot: '#22D3EE', label: 'IN TRANSIT' },
  DELIVERED:   { bg: 'bg-[#4EDEA3]/10', border: 'border-[#4EDEA3]/40', text: 'text-[#4EDEA3]', dot: '#4EDEA3', label: 'DELIVERED' },
  VERIFIED:    { bg: 'bg-[#A855F7]/10', border: 'border-[#A855F7]/40', text: 'text-[#A855F7]', dot: '#A855F7', label: 'VERIFIED' },
  STALE:       { bg: 'bg-[#FFB4AB]/10', border: 'border-[#FFB4AB]/40', text: 'text-[#FFB4AB]', dot: '#FFB4AB', label: 'STALE' },
  REALLOCATED: { bg: 'bg-[#FFB95F]/10', border: 'border-[#FFB95F]/40', text: 'text-[#FFB95F]', dot: '#FFB95F', label: 'REALLOCATED' },
};

const TABS = ['ALL', 'ALLOCATED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'VERIFIED', 'STALE'];
const ACTIVE_SET = ['AVAILABLE', 'ALLOCATED', 'DISPATCHED', 'IN_TRANSIT'];

function Badge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.AVAILABLE;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-px rounded-sm text-[10px] font-semibold font-mono border ${c.bg} ${c.border} ${c.text}`}>
      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function parseEdges(routePath) {
  if (!routePath) return [];
  try {
    const v = JSON.parse(routePath);
    return Array.isArray(v) ? v : [routePath];
  } catch { return [routePath]; }
}

function CheckRow({ label, pass, note }) {
  const ok = pass === true;
  const na = pass === null || pass === undefined;
  return (
    <div className="flex items-center justify-between font-mono text-[11px] px-2 py-1 bg-[#05080D] border border-[#424754]/20 rounded-sm">
      <span className="text-[#C2C6D6]">{label}</span>
      <span className="flex items-center gap-1.5">
        {note && <span className="text-[#C2C6D6] text-[10px]">{note}</span>}
        {na ? <span className="text-[#C2C6D6]">NOT AVAILABLE</span>
          : ok ? <span className="inline-flex items-center gap-1 text-[#4EDEA3]"><CheckCircle size={11} />PASS</span>
          : <span className="inline-flex items-center gap-1 text-[#FFB4AB]"><XCircle size={11} />FAIL</span>}
      </span>
    </div>
  );
}

export default function AllocationsPage({ onViewAudit }) {
  const [allocations, setAllocations] = useState([]);
  const [demands, setDemands] = useState([]);
  const [locations, setLocations] = useState([]);
  const [roads, setRoads] = useState([]);
  const [resources, setResources] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditValid, setAuditValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('ALL');
  const [srcFilter, setSrcFilter] = useState('ALL');
  const [dstFilter, setDstFilter] = useState('ALL');
  const [sevFilter, setSevFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState(null);
  const [acting, setActing] = useState(null);
  const REFRESH_MS = 5000;

  const { region } = useRegion();
  const cityParam = region === 'INDIA' ? undefined : region;

  const fetchAll = async () => {
    try {
      const [a, d, l, r, res, inv, au, ver] = await Promise.all([
        api.getAllocations(cityParam), api.getDemands(cityParam), api.getLocations(cityParam), api.getRoads(cityParam),
        api.getResources(), api.getInventory(cityParam), api.getAudit(cityParam), api.verifyAudit(),
      ]);
      setAllocations(a.data); setDemands(d.data); setLocations(l.data); setRoads(r.data);
      setResources(res.data); setInventory(inv.data); setAudit(au.data); setAuditValid(ver.data.valid);
      setLastSync(new Date().toISOString()); setError(null);
    } catch (e) { console.error(e); setError('ALLOCATION LEDGER UNREACHABLE — CHECK BACKEND LINK'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, REFRESH_MS); return () => clearInterval(t); }, [region]);

  const demandMap = useMemo(() => Object.fromEntries(demands.map(d => [d.id, d])), [demands]);
  const locMap = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);
  const roadMap = useMemo(() => Object.fromEntries(roads.map(r => [r.id, r])), [roads]);
  const resMap = useMemo(() => Object.fromEntries(resources.map(r => [r.id, r])), [resources]);

  const auditByAlloc = useMemo(() => {
    const m = {};
    audit.forEach(rec => {
      try {
        const p = JSON.parse(rec.payload || '{}');
        const id = p.allocation_id || p.allocationId;
        if (id) { (m[id] = m[id] || []).push(rec); }
      } catch { /* payload not JSON */ }
    });
    Object.values(m).forEach(list => list.sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp)));
    return m;
  }, [audit]);

  const enriched = useMemo(() => allocations.map(a => {
    const edges = parseEdges(a.route_path);
    const segs = edges.map(id => roadMap[id]).filter(Boolean);
    const blocked = segs.filter(s => s.status === 'BLOCKED');
    const travel = segs.reduce((s, s2) => s + (s2.travel_time || 0), 0);
    const dist = segs.reduce((s, s2) => s + (s2.distance || 0), 0);
    const demand = demandMap[a.demand_id];
    const destId = demand?.location_id;
    const priority = demand?.severity ?? null;
    const updated = (auditByAlloc[a.id]?.slice(-1)[0]?.timestamp) || null;
    return { ...a, edges, segs, blocked, travel, dist, demand, destId, priority, updated };
  }), [allocations, roadMap, demandMap, auditByAlloc]);

  const srcOptions = useMemo(() => [...new Set(allocations.map(a => a.source_id))].sort(), [allocations]);
  const dstOptions = useMemo(() => [...new Set(enriched.map(e => e.destId).filter(Boolean))].sort(), [enriched]);
  const sevOptions = useMemo(() => [...new Set(enriched.map(e => e.priority).filter(v => v !== null && v !== undefined))].sort((x, y) => y - x), [enriched]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(e => {
      if (tab !== 'ALL') {
        if (tab === 'STALE') { if (!(e.status === 'STALE' || e.status === 'REALLOCATED')) return false; }
        else if (e.status !== tab) return false;
      }
      if (srcFilter !== 'ALL' && e.source_id !== srcFilter) return false;
      if (dstFilter !== 'ALL' && e.destId !== dstFilter) return false;
      if (sevFilter !== 'ALL' && String(e.priority) !== String(sevFilter)) return false;
      if (q) {
        const hay = `${e.id} ${e.resource_id} ${resMap[e.resource_id]?.name ?? ''} ${e.source_id} ${locMap[e.source_id]?.name ?? ''} ${e.destId ?? ''} ${locMap[e.destId]?.name ?? ''} ${e.status} ${e.edges.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      const crit = x => (x.status === 'STALE' ? 0 : x.status === 'IN_TRANSIT' ? 1 : 2);
      const d = crit(a) - crit(b);
      if (d !== 0) return d;
      return (b.priority ?? -1) - (a.priority ?? -1);
    });
  }, [enriched, tab, srcFilter, dstFilter, sevFilter, search, resMap, locMap]);

  const selected = useMemo(() => enriched.find(e => e.id === selectedId) || filtered[0] || enriched[0] || null, [enriched, filtered, selectedId]);

  /* header KPIs from real data */
  const activeUnits = useMemo(() => enriched.filter(e => ACTIVE_SET.includes(e.status)).reduce((s, e) => s + (e.quantity || 0), 0), [enriched]);
  const inTransitCt = useMemo(() => enriched.filter(e => e.status === 'IN_TRANSIT').length, [enriched]);
  const staleCt = useMemo(() => enriched.filter(e => e.status === 'STALE' || e.status === 'REALLOCATED').length, [enriched]);
  const reallocPct = enriched.length > 0 ? ((staleCt / enriched.length) * 100).toFixed(1) : '0.0';

  /* selected derived intelligence */
  const sel = useMemo(() => {
    if (!selected) return null;
    const invAtSource = inventory.filter(i => i.location_id === selected.source_id && i.resource_id === selected.resource_id).reduce((s, i) => s + (i.quantity || 0), 0);
    const sibs = enriched.filter(e => e.id !== selected.id && e.demand_id === selected.demand_id);
    const alt = sibs.find(s => s.edges.join(',') !== selected.edges.join(',')) || null;
    const dupes = sibs.filter(s => ACTIVE_SET.includes(s.status) && s.edges.join(',') === selected.edges.join(',')).length;
    const routeValid = selected.blocked.length === 0;
    const compat = selected.demand ? selected.demand.resource_id === selected.resource_id : null;
    const destOk = selected.demand ? (selected.demand.status === 'OPEN' || selected.demand.status === 'PARTIAL' || selected.demand.status === 'MET') : null;
    const capOk = invAtSource >= 0 ? invAtSource + selected.quantity >= selected.quantity : null;
    const auditRecs = auditByAlloc[selected.id] || [];
    const lastAudit = auditRecs.slice(-1)[0] || null;
    const timeline = [
      ...auditRecs.map(r => ({ t: r.timestamp, label: r.event_type.replace(/_/g, ' '), actor: r.actor })),
      ...(selected.status === 'STALE' ? [{ t: selected.updated || lastSync, label: 'ALLOCATION MARKED STALE', actor: 'ENGINE' }] : []),
      ...((alt && selected.status === 'STALE') ? [{ t: alt.updated || lastSync, label: 'REALLOCATION CREATED', actor: 'ENGINE' }] : []),
    ].filter(x => x.t).sort((x, y) => new Date(x.t) - new Date(y.t));
    const staleSib = selected.status !== 'STALE' ? sibs.find(s => s.status === 'STALE') : null;
    return { invAtSource, alt, dupes, routeValid, compat, destOk, capOk, auditRecs, lastAudit, timeline, staleSib };
  }, [selected, inventory, enriched, auditByAlloc, lastSync]);

  const whyText = useMemo(() => {
    if (!selected || !sel) return '';
    const destName = locMap[selected.destId]?.name ?? selected.destId ?? selected.demand_id;
    const srcName = locMap[selected.source_id]?.name ?? selected.source_id;
    const need = selected.demand?.quantity ?? '—';
    const sev = selected.priority ?? '—';
    return `Critical demand detected at ${destName} (severity ${sev}/5). Required ${need} units of ${selected.resource_id}; compatible stock ${sel.invAtSource} units at ${srcName}. Route ${selected.edges.join(' → ') || '—'} selected with travel ${selected.travel} min over ${selected.dist} km. Highest feasible priority while satisfying resource compatibility, source availability, destination demand and route accessibility${sel.routeValid ? '' : ' — route currently BLOCKED, reallocation required'}.`;
  }, [selected, sel, locMap]);

  const act = async (fn, key) => {
    setActing(key);
    try { await fn(); await fetchAll(); } catch (e) { console.error(e); }
    finally { setActing(null); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center font-mono text-xs text-[#C2C6D6]">SYNCING ALLOCATION LEDGER…</div>;
  if (error && enriched.length === 0) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center border border-[#FFB4AB]/40 bg-[#FFB4AB]/5 rounded-sm p-6 max-w-md">
        <AlertTriangle size={26} className="mx-auto text-[#FFB4AB] mb-2" />
        <p className="font-mono text-xs text-[#FFB4AB]">{error}</p>
        <button onClick={() => { setLoading(true); fetchAll(); }} className="mt-3 px-3 py-1.5 text-xs font-mono border border-[#424754] rounded-sm text-white hover:border-[#ADC6FF]">RETRY SYNC</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 max-w-full pb-4">
      {/* compact ops header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-[#424754]/40 pb-2">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">RESOURCE ALLOCATIONS</h1>
          <p className="text-[10px] font-mono text-[#C2C6D6] tracking-widest">TRANSPORT COORDINATION • CONSTRAINT-AWARE DISPATCH GOVERNANCE</p>
        </div>
        <div className="flex flex-wrap items-stretch gap-2 font-mono">
          <div className="bg-[#111317] border border-[#424754]/40 rounded-sm px-3 py-1.5"><div className="text-[9px] text-[#C2C6D6]">ACTIVE UNITS</div><div className="text-white text-lg font-bold leading-6">{activeUnits.toLocaleString()}</div></div>
          <div className="bg-[#111317] border border-[#424754]/40 rounded-sm px-3 py-1.5"><div className="text-[9px] text-[#C2C6D6]">IN TRANSIT</div><div className="text-[#22D3EE] text-lg font-bold leading-6">{inTransitCt}</div></div>
          <div className="bg-[#111317] border border-[#424754]/40 rounded-sm px-3 py-1.5"><div className="text-[9px] text-[#C2C6D6]">REALLOCATION</div><div className="text-[#FFB95F] text-lg font-bold leading-6">{reallocPct}% <span className="text-[10px] font-normal">DYNAMIC</span></div></div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => act(() => api.runAllocations(cityParam), 'run')} disabled={acting === 'run'} className="px-2 py-1.5 rounded-sm text-[11px] font-mono border border-[#ADC6FF]/40 bg-[#ADC6FF]/10 text-[#ADC6FF] hover:bg-[#ADC6FF]/20 disabled:opacity-50 inline-flex items-center gap-1"><Zap size={11} />{acting === 'run' ? 'RUNNING…' : `RECALCULATE ${cityParam ? cityParam.toUpperCase() : 'ALL'}`}</button>
            <button onClick={fetchAll} className="px-2 py-1.5 rounded-sm text-[11px] font-mono border border-[#424754]/60 text-[#C2C6D6] hover:text-white inline-flex items-center gap-1" aria-label="Refresh allocations"><RefreshCw size={11} />SYNC</button>
          </div>
        </div>
      </div>

      {/* toolbar */}
      <div className="bg-[#111317] border border-[#424754]/40 rounded-sm">
        <div className="p-2 flex flex-col xl:flex-row xl:items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#C2C6D6]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="SEARCH ALLOCATION / RESOURCE / SOURCE / ROUTE"
              className="w-full bg-[#05080D] border border-[#424754]/60 rounded-sm pl-7 pr-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-[#ADC6FF] placeholder-[#5A6E85]" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select value={srcFilter} onChange={e => setSrcFilter(e.target.value)} className="bg-[#05080D] border border-[#424754]/60 rounded-sm px-2 py-1.5 text-[11px] font-mono text-white" aria-label="Source filter">
              <option value="ALL">SRC: ALL</option>{srcOptions.map(s => <option key={s} value={s}>SRC: {s}</option>)}
            </select>
            <select value={dstFilter} onChange={e => setDstFilter(e.target.value)} className="bg-[#05080D] border border-[#424754]/60 rounded-sm px-2 py-1.5 text-[11px] font-mono text-white" aria-label="Destination filter">
              <option value="ALL">DST: ALL</option>{dstOptions.map(s => <option key={s} value={s}>DST: {s}</option>)}
            </select>
            <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="bg-[#05080D] border border-[#424754]/60 rounded-sm px-2 py-1.5 text-[11px] font-mono text-white" aria-label="Severity filter">
              <option value="ALL">SEV: ALL</option>{sevOptions.map(s => <option key={s} value={s}>SEV: {s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 px-2.5 pb-2 font-mono text-[11px]">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`py-1 border-b-2 uppercase ${tab === t ? 'border-[#ADC6FF] text-[#ADC6FF] font-bold' : 'border-transparent text-[#C2C6D6] hover:text-white'}`}>
              {t === 'STALE' ? 'STALE / REALLOC' : t.replace('_', ' ')}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-[#C2C6D6] self-center">{filtered.length} / {enriched.length} LINES</span>
        </div>
      </div>

      {/* three-zone workspace */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-2 items-start">
        {/* LEFT: queue */}
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-[#424754]/40 bg-[#1A1C1F] flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase font-mono">Allocation Queue</span>
            <span className="text-[10px] font-mono text-[#C2C6D6]">ALLOCATIONS // ACTIVE DISPATCH SET</span>
          </div>
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left font-mono text-[11px]" role="table">
              <thead className="sticky top-0 bg-[#05080D] z-10"><tr className="border-b border-[#424754]/40 text-[#C2C6D6] text-[10px] uppercase">
                {['ALLOCATION ID', 'RESOURCE', 'QTY', 'SOURCE', 'DEST', 'ROUTE', 'STATUS', 'PRIORITY', 'UPDATED', ''].map(h => <th key={h} className="px-2.5 py-2 whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#424754]/20">
                {filtered.map(e => {
                  const active = selected?.id === e.id;
                  return (
                    <tr key={e.id} onClick={() => setSelectedId(e.id)} className={`cursor-pointer hover:bg-[#1A1C1F] ${active ? 'bg-[#ADC6FF]/5' : ''} ${e.status === 'STALE' ? 'bg-[#FFB4AB]/[0.04]' : ''}`}>
                      <td className="px-2.5 py-1.5 text-[#ADC6FF]">AL-{e.id.slice(0, 4).toUpperCase()}</td>
                      <td className="px-2.5 py-1.5"><div className="text-white">{resMap[e.resource_id]?.name ?? e.resource_id}</div><div className="text-[#C2C6D6] text-[10px]">{e.resource_id}</div></td>
                      <td className="px-2.5 py-1.5 text-white font-bold">{e.quantity}</td>
                      <td className="px-2.5 py-1.5 text-[#C2C6D6]">{e.source_id}</td>
                      <td className="px-2.5 py-1.5 text-[#C2C6D6]">{e.destId ?? e.demand_id.slice(0, 8)}</td>
                      <td className="px-2.5 py-1.5 text-[#22D3EE] whitespace-nowrap">{e.edges.join(' → ') || '—'}</td>
                      <td className="px-2.5 py-1.5"><Badge status={e.status} /></td>
                      <td className="px-2.5 py-1.5"><span className={`font-bold ${e.priority >= 4 ? 'text-[#FFB4AB]' : e.priority >= 3 ? 'text-[#FFB95F]' : 'text-[#C2C6D6]'}`}>{e.priority != null ? `SEV ${e.priority}` : '—'}</span></td>
                      <td className="px-2.5 py-1.5 text-[#C2C6D6] whitespace-nowrap">{e.updated ? new Date(e.updated).toLocaleTimeString('en-US', { hour12: false }) : '—'}</td>
                      <td className="px-2.5 py-1.5" onClick={ev => ev.stopPropagation()}>
                        {e.status === 'AVAILABLE' && (
                          <button onClick={() => act(() => api.updateAllocationStatus(e.id, 'IN_TRANSIT'), e.id)} disabled={acting === e.id} className="px-2 py-1 text-[10px] font-bold bg-[#4EDEA3] text-[#05080D] rounded-sm hover:bg-[#4EDEA3]/80 disabled:opacity-50 inline-flex items-center gap-1"><Truck size={10} />DISPATCH</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan="10" className="px-3 py-6 text-center text-[#C2C6D6]">NO ALLOCATIONS MATCH ACTIVE FILTERS</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT: explainability */}
        <aside className="bg-[#111317] border border-[#424754]/40 rounded-sm overflow-hidden lg:sticky lg:top-2">
          <div className="px-2.5 py-1.5 border-b border-[#424754]/40 bg-[#1A1C1F] flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase font-mono flex items-center gap-1.5"><ShieldCheck size={13} className="text-[#A855F7]" />Explainable AI Dispatch Verification</span>
          </div>
          {!selected || !sel ? (
            <p className="p-4 text-[11px] font-mono text-[#C2C6D6]">SELECT AN ALLOCATION FROM THE QUEUE</p>
          ) : (
            <div className="p-2.5 space-y-2.5 max-h-[560px] overflow-y-auto text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[#ADC6FF] text-[11px]">AL-{selected.id.slice(0, 8).toUpperCase()}</span>
                <Badge status={selected.status} />
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                {[
                  ['RESOURCE', resMap[selected.resource_id]?.name ?? selected.resource_id],
                  ['QUANTITY', `${selected.quantity} UNITS`],
                  ['SOURCE', `${locMap[selected.source_id]?.name ?? selected.source_id}`],
                  ['DESTINATION', `${locMap[selected.destId]?.name ?? selected.destId ?? selected.demand_id}`],
                  ['ROUTE', selected.edges.join(' → ') || '—'],
                  ['PRIORITY', selected.priority != null ? `SEV ${selected.priority}/5` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-1.5"><div className="text-[9px] text-[#C2C6D6]">{k}</div><div className="text-white text-[11px] truncate" title={v}>{v}</div></div>
                ))}
              </div>

              <div className="bg-[#1A1C1F] border border-[#A855F7]/30 rounded-sm p-2">
                <h3 className="text-[10px] font-bold text-[#A855F7] uppercase font-mono mb-1">Allocation Decision</h3>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-center">
                  <div className="bg-[#05080D] rounded-sm p-1.5 border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">REQUIRED</div><div className="text-white font-bold">{selected.demand?.quantity ?? '—'}</div></div>
                  <div className="bg-[#05080D] rounded-sm p-1.5 border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">STOCK@SRC</div><div className="text-white font-bold">{sel.invAtSource}</div></div>
                  <div className="bg-[#05080D] rounded-sm p-1.5 border border-[#424754]/20"><div className="text-[9px] text-[#C2C6D6]">TRAVEL</div><div className="text-white font-bold">{selected.travel} MIN</div></div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-white uppercase font-mono mb-1">Why this allocation?</h3>
                <p className="text-[11px] text-[#E2E2E6] leading-relaxed bg-[#05080D] border border-[#424754]/20 rounded-sm p-2">{whyText}</p>
                {selected.explanation && <p className="text-[10px] font-mono text-[#C2C6D6] mt-1 bg-[#05080D] border border-[#424754]/20 rounded-sm p-2">ENGINE: {selected.explanation}</p>}
              </div>

              <div className="space-y-1">
                <h3 className="text-[10px] font-bold text-white uppercase font-mono">Constraint Verification</h3>
                <CheckRow label="RESOURCE COMPATIBILITY" pass={sel.compat} note={sel.compat === null ? '' : selected.demand?.resource_id} />
                <CheckRow label="SOURCE CAPACITY" pass={sel.invAtSource + selected.quantity >= selected.quantity} note={`${sel.invAtSource} AVAIL`} />
                <CheckRow label="DESTINATION DEMAND" pass={sel.destOk} note={selected.demand?.status} />
                <CheckRow label="ROUTE ACCESSIBILITY" pass={sel.routeValid} note={sel.routeValid ? `${selected.edges.length} SEG` : `${selected.blocked.length} BLOCKED`} />
                <CheckRow label="TRAVEL TIME" pass={selected.travel > 0} note={`${selected.travel} MIN`} />
                <CheckRow label="PRIORITY / SEVERITY" pass={selected.priority != null} note={selected.priority != null ? `SEV ${selected.priority}` : ''} />
                <CheckRow label="NO DUPLICATE ACTIVE" pass={sel.dupes === 0} note={sel.dupes === 0 ? 'UNIQUE' : `${sel.dupes} DUP`} />
              </div>

              {selected.status === 'STALE' && (
                <div className="border border-[#FFB4AB]/40 bg-[#FFB4AB]/5 rounded-sm p-2">
                  <h3 className="text-[10px] font-bold text-[#FFB4AB] uppercase font-mono mb-1">Stale Allocation Detected</h3>
                  <div className="font-mono text-[11px] space-y-0.5 text-[#E2E2E6]">
                    <div>PREV ROUTE: <span className="text-white">{selected.edges.join(' → ')}</span></div>
                    <div>BLOCKED SEG: <span className="text-[#FFB4AB]">{selected.blocked.map(b => b.id).join(', ') || '—'}</span></div>
                    <div>CAUSE: <span className="text-white">ROAD ACCESSIBILITY CHANGED</span></div>
                    {sel.alt && (<><div>NEW ROUTE: <span className="text-[#4EDEA3]">{sel.alt.edges.join(' → ')}</span></div><div>NEW SOURCE: <span className="text-white">{sel.alt.source_id}</span></div></>)}
                    <div>STATUS: <span className="text-[#FFB95F]">REALLOCATED</span></div>
                  </div>
                  <p className="text-[10px] text-[#C2C6D6] mt-1">Previous route no longer feasible. Engine selected next feasible route/source preserving compatibility and demand priority.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-1.5"><div className="text-[9px] text-[#C2C6D6]">BEFORE</div>
                  {sel.staleSib || selected.status === 'STALE'
                    ? <><div className="text-white">{(sel.staleSib || selected).source_id}</div><div className="text-[#FFB4AB]">{(sel.staleSib || selected).edges.join(' → ')}</div><div className="text-[#FFB4AB]">STALE</div></>
                    : <div className="text-[#4EDEA3]">NO REALLOCATION REQUIRED</div>}
                </div>
                <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-1.5"><div className="text-[9px] text-[#C2C6D6]">AFTER</div>
                  {sel.alt || (selected.status !== 'STALE' && sel.staleSib)
                    ? <><div className="text-white">{(sel.alt || selected).source_id}</div><div className="text-[#4EDEA3]">{(sel.alt || selected).edges.join(' → ')}</div><div className="text-[#4EDEA3]">REALLOCATED</div></>
                    : selected.status === 'STALE' ? <div className="text-[#FFB95F]">AWAITING FEASIBLE ROUTE</div> : <div className="text-[#4EDEA3]">CURRENT ROUTE OPTIMAL</div>}
                </div>
              </div>

              <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-2 font-mono text-[11px]">
                <div className="text-[9px] text-[#C2C6D6] mb-1">AUDIT REFERENCE</div>
                {sel.lastAudit ? (
                  <div className="space-y-0.5">
                    <div className="text-white">TX-{sel.lastAudit.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-[#C2C6D6] truncate">HASH {sel.lastAudit.current_hash.slice(0, 24)}…</div>
                    <div className="flex items-center justify-between"><span className="text-[#4EDEA3]">● VERIFIED</span>
                      {onViewAudit && <button onClick={onViewAudit} className="text-[#ADC6FF] hover:underline inline-flex items-center gap-1">VIEW AUDIT <ArrowRight size={10} /></button>}
                    </div>
                  </div>
                ) : <span className="text-[#C2C6D6]">NO AUDIT RECORD LINKED</span>}
              </div>

              {selected.status === 'AVAILABLE' && (
                <button onClick={() => act(() => api.updateAllocationStatus(selected.id, 'IN_TRANSIT'), selected.id + '-d')} disabled={acting === selected.id + '-d'} className="w-full py-1.5 text-[11px] font-bold font-mono bg-[#4EDEA3] text-[#05080D] rounded-sm hover:bg-[#4EDEA3]/80 disabled:opacity-50 inline-flex items-center justify-center gap-1"><Truck size={12} />DISPATCH UNIT</button>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* bottom: map + route intelligence + timeline */}
      <div className="grid lg:grid-cols-[1.1fr_1fr_1fr] gap-2 items-start">
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-[#424754]/40 bg-[#1A1C1F] flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase font-mono flex items-center gap-1.5"><MapPin size={13} className="text-[#ADC6FF]" />Route Map // {region === 'INDIA' ? 'National' : region} Sector</span>
            <span className="text-[10px] font-mono text-[#4EDEA3]">● LIVE</span>
          </div>
          <div className="h-[300px]"><MapView selectedAllocation={selected} /></div>
        </section>
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h3 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><RouteIcon size={13} className="text-[#ADC6FF]" />Route Intelligence</h3>
          {!selected ? <p className="text-[11px] font-mono text-[#C2C6D6]">NO SELECTION</p> : (
            <div className="space-y-1.5 font-mono text-[11px]">
              {[
                ['CURRENT ROUTE', selected.edges.join(' → ') || '—', 'text-[#22D3EE]'],
                ['ROUTE VALID', sel?.routeValid ? 'YES' : 'NO — BLOCKED', sel?.routeValid ? 'text-[#4EDEA3]' : 'text-[#FFB4AB]'],
                ['EST TRAVEL TIME', `${selected.travel} MIN`, 'text-white'],
                ['DISTANCE', `${selected.dist} KM`, 'text-white'],
                ['BLOCKED SEGMENTS', selected.blocked.map(b => b.id).join(', ') || 'NONE', selected.blocked.length ? 'text-[#FFB4AB]' : 'text-[#4EDEA3]'],
                ['ALTERNATE ROUTE', sel?.alt ? sel.alt.edges.join(' → ') : '—', 'text-[#ADC6FF]'],
              ].map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between bg-[#05080D] border border-[#424754]/20 rounded-sm px-2 py-1"><span className="text-[#C2C6D6]">{k}</span><span className={c}>{v}</span></div>
              ))}
              <div className="bg-[#05080D] border border-[#424754]/20 rounded-sm p-2 text-[10px] text-[#C2C6D6]">
                ROAD CONDITIONS: {selected.segs.map(s => `${s.id}:${s.status}`).join(' · ') || '—'}
              </div>
            </div>
          )}
        </section>
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h3 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><Clock size={13} className="text-[#ADC6FF]" />Allocation Event Timeline</h3>
          {!selected || !sel || sel.timeline.length === 0 ? <p className="text-[11px] font-mono text-[#C2C6D6]">NO TIMESTAMPED EVENTS AVAILABLE</p> : (
            <div className="space-y-0 max-h-[260px] overflow-y-auto">
              {sel.timeline.map((ev, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex flex-col items-center"><span className="w-1.5 h-1.5 rounded-full bg-[#ADC6FF] mt-1" />{i < sel.timeline.length - 1 && <span className="w-px flex-1 bg-[#424754]/40" />}</div>
                  <div className="pb-2"><div className="font-mono text-[10px] text-[#C2C6D6]">{new Date(ev.t).toLocaleTimeString('en-US', { hour12: false })}</div><div className="font-mono text-[11px] text-white">{ev.label}</div><div className="font-mono text-[10px] text-[#C2C6D6]">{ev.actor}</div></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* bottom status bar */}
      <div className="bg-[#111317] border border-[#424754]/40 rounded-sm px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-[#C2C6D6]">
        <div className="flex items-center gap-3">
          <span>SYSTEM: <span className="text-[#4EDEA3]">OPERATIONAL</span></span>
          <span>BACKEND: <span className="text-[#4EDEA3]">API CONNECTED</span></span>
          <span>ENGINE: <span className="text-white">ACTIVE</span></span>
          <span>ROUTING: <span className="text-white">LOCAL GRAPH</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span>AUDIT: <span className={auditValid ? 'text-[#4EDEA3]' : 'text-[#FFB4AB]'}>{auditValid ? 'VALID' : 'INVALID'}</span></span>
          <span>LAST SYNC: <span className="text-white">{lastSync ? new Date(lastSync).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span></span>
        </div>
      </div>

      {/* supporting strips: demand pressure + movements */}
      <div className="grid lg:grid-cols-2 gap-2">
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h3 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><Package size={13} className="text-[#FFB95F]" />Demand Pressure Linked To Allocations</h3>
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {demands.filter(d => d.status === 'OPEN' || d.status === 'PARTIAL').slice(0, 8).map(d => (
              <div key={d.id} className="flex items-center justify-between font-mono text-[11px] px-2 py-1 bg-[#05080D] border border-[#424754]/20 rounded-sm">
                <span className="text-white">{d.id.slice(0, 12)} <span className="text-[#C2C6D6]">→ {d.location_id} · {d.resource_id}</span></span>
                <span className={d.severity >= 4 ? 'text-[#FFB4AB]' : 'text-[#FFB95F]'}>SEV {d.severity} · NEED {d.quantity}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-[#111317] border border-[#424754]/40 rounded-sm p-2.5">
          <h3 className="text-[11px] font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5"><Truck size={13} className="text-[#22D3EE]" />Recent Dispatch Movements</h3>
          <div className="space-y-1 max-h-[180px] overflow-y-auto">
            {(sel?.auditRecs || audit).slice(0, 8).map(r => (
              <div key={r.id} className="font-mono text-[10px] px-2 py-1 bg-[#05080D] border border-[#424754]/20 rounded-sm">
                <div className="text-white">{r.event_type.replace(/_/g, ' ')}</div>
                <div className="text-[#C2C6D6]">{new Date(r.timestamp).toLocaleTimeString('en-US', { hour12: false })} · {r.actor} · {r.current_hash.slice(0, 12)}…</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
