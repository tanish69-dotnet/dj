import { useEffect, useState } from 'react';
import { api } from './services/api';
import { useRegion } from './context/RegionContext';
import { LayoutDashboard, MapPin, Zap, Truck, Navigation, IndianRupee, ShieldCheck, Package } from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KpiCard from './components/KpiCard';
import MapView from './components/MapView';
import AiAssistant from './components/AiAssistant';
import SimulationPanel from './components/SimulationPanel';
import AllocationsPage from './components/AllocationsPage';
import AllocationsTable from './components/AllocationsTable';
import SimulationPage from './components/SimulationPage';
import ResourcesPage from './components/ResourcesPage';
import TrackingPage from './components/TrackingPage';
import FundsPage from './components/FundsPage';
import AuditPage from './components/AuditPage';

const pageIcons = {
  command: LayoutDashboard,
  map: MapPin,
  simulation: Zap,
  resources: Package,
  allocations: Truck,
  tracking: Navigation,
  funds: IndianRupee,
  audit: ShieldCheck,
};

const pageTitles = {
  command: 'COMMAND',
  map: 'LIVE MAP',
  simulation: 'SIMULATION',
  resources: 'RESOURCES',
  allocations: 'ALLOCATIONS',
  tracking: 'TRACKING',
  funds: 'FUNDS',
  audit: 'AUDIT LEDGER',
};

function App() {
  const { region, population, stateName } = useRegion();
  const [dashboard, setDashboard] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [auditValid, setAuditValid] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activePage, setActivePage] = useState('command');
  const [simulationLoading, setSimulationLoading] = useState(null);

  const cityParam = region === "INDIA" ? undefined : region;

  const fetchData = async () => {
    try {
      const [dash, incs, allocs, locs, audit] = await Promise.all([
        api.getDashboard(cityParam),
        api.getIncidents(cityParam),
        api.getAllocations(cityParam),
        api.getLocations(cityParam),
        api.verifyAudit(),
      ]);
      setDashboard(dash.data);
      setIncidents(incs.data);
      setAllocations(allocs.data);
      setLocations(locs.data);
      setAuditValid(audit.data.valid);
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [cityParam, region]);

  const runAllocations = async () => {
    setSimulationLoading('RUN_ALLOCATION');
    try {
      await api.runAllocations(cityParam);
      await fetchData();
    } finally {
      setSimulationLoading(null);
    }
  };

  const triggerEvent = async (type) => {
    setSimulationLoading(type);
    try {
      await api.triggerEvent(type, cityParam);
      await fetchData();
    } finally {
      setSimulationLoading(null);
    }
  };

  const PageIcon = pageIcons[activePage] || LayoutDashboard;
  const pageTitle = pageTitles[activePage] || 'COMMAND CENTER';

  return (
    <div className="min-h-screen bg-[#070B14] text-[#F0F4FA]">
      <Header auditValid={auditValid} lastUpdated={lastUpdated} />
      
      <div className="flex">
        <Sidebar 
          activePage={activePage} 
          onNavigate={setActivePage} 
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Page Header */}
          <div className="px-6 py-4 border-b border-[#1E2D42] bg-[#101827]/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PageIcon size={24} className="text-[#00D4FF]" />
                <div>
                  <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
                  <p className="text-[11px] text-[#5A6E85]">
                    {activePage === 'command' && 'Real-time disaster response operations overview'}
                    {activePage === 'map' && (region === 'INDIA' ? 'India National Overview — live resource tracking' : `${region.toUpperCase()} OPERATIONS — live resource tracking`)}
                    {activePage === 'simulation' && (region === 'INDIA' ? 'National disaster simulation environment' : `${region.toUpperCase()} simulation — earthquake response scenario controls`)}
                    {activePage === 'resources' && 'Inventory management across all warehouses'}
                    {activePage === 'allocations' && 'Active resource allocation lifecycle tracking'}
                    {activePage === 'tracking' && 'Allocation status progression & reallocation history'}
                    {activePage === 'funds' && 'Financial allocation & utilization overview'}
                    {activePage === 'audit' && 'Tamper-evident SHA-256 hash-chained audit ledger'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#8B9CB3]">
                  Last sync: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-US', { hour12: false }) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-auto p-6">
            {activePage === 'command' && (
              <div className="space-y-6 max-w-full">
                {/* Scope strip — proves the KPIs below belong to the selected sector */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-[#8B9CB3]">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-[#1E2D42] bg-[#101827]">
                    <MapPin size={11} className="text-[#00D4FF]" />
                    SCOPE: <span className="text-white">{(region || 'INDIA').toUpperCase()}</span>
                  </span>
                  {stateName && <span className="px-2 py-1 rounded border border-[#1E2D42] bg-[#101827]">STATE: <span className="text-white">{stateName}</span></span>}
                  {population != null && <span className="px-2 py-1 rounded border border-[#1E2D42] bg-[#101827]">POPULATION: <span className="text-white">{population.toLocaleString()}</span></span>}
                  <span className="px-2 py-1 rounded border border-[#1E2D42] bg-[#101827]">LIVE INCIDENTS: <span className="text-[#EF4444]">{dashboard?.active_incidents ?? '—'}</span></span>
                  <span className="px-2 py-1 rounded border border-[#1E2D42] bg-[#101827]">EXPOSED: <span className="text-[#00D4FF]">{dashboard?.affected_population?.toLocaleString() ?? '—'}</span></span>
                  <span className="px-2 py-1 rounded border border-[#1E2D42] bg-[#101827]">BLOCKED CORRIDORS: <span className="text-[#FFB95F]">{dashboard?.blocked_roads ?? '—'}</span></span>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    title="ACTIVE EMERGENCIES"
                    value={dashboard?.active_emergencies?.toLocaleString() ?? '—'}
                    type="emergencies"
                  />
                  <KpiCard
                    title="RESOURCES AVAILABLE"
                    value={dashboard?.resources_available?.toLocaleString() ?? '—'}
                    type="resources"
                  />
                  <KpiCard
                    title="ACTIVE ALLOCATIONS"
                    value={dashboard?.active_allocations?.toLocaleString() ?? '—'}
                    type="allocations"
                  />
                  <KpiCard
                    title="PENDING DEMAND"
                    value={dashboard?.pending_demand?.toLocaleString() ?? '—'}
                    type="demand"
                  />
                </div>

                {/* Map + Side Panel */}
                <div className="grid lg:grid-cols-[1fr_380px] gap-6">
                  {/* Map */}
                  <div className="bg-[#101827] border border-[#1E2D42] rounded-xl overflow-hidden h-[500px]">
                    <div className="px-4 py-3 border-b border-[#1E2D42] bg-[#151F30] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-[#00D4FF]" />
                        <span className="font-medium text-white">LIVE RESPONSE MAP</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                        <span className="text-[#10B981] font-medium">LIVE</span>
                        <span className="text-[#5A6E85]">
                          {region === 'INDIA' ? 'India — National Overview' : `${region} Operations`}
                        </span>
                      </div>
                    </div>
                    <div className="h-[calc(100%-52px)]">
                      <MapView 
                        selectedAllocation={null}
                        onAllocationSelect={() => {}}
                      />
                    </div>
                  </div>

                  {/* Side Panel */}
                  <div className="space-y-4 h-[500px] overflow-y-auto">
                    <SimulationPanel 
                      onTriggerEvent={triggerEvent}
                      onRunAllocation={runAllocations}
                      loading={simulationLoading}
                    />
                    <AiAssistant dashboard={dashboard} allocations={allocations} />
                  </div>
                </div>

                {/* Live incidents for the selected sector */}
                <section className="bg-[#101827] border border-[#1E2D42] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1E2D42] bg-[#151F30] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-[#EF4444]" />
                      <span className="font-medium text-white">ACTIVE INCIDENT REGISTER</span>
                    </div>
                    <span className="text-xs font-mono text-[#5A6E85]">
                      {incidents.filter(i => i.status === 'ACTIVE' || i.status === 'MONITORING').length} LIVE · {incidents.length} TOTAL
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead>
                        <tr className="border-b border-[#1E2D42] text-[#5A6E85] text-[10px] uppercase">
                          {['INCIDENT', 'CATEGORY', 'SEVERITY', 'STATUS', 'EXPOSED POPULATION', 'SITE', 'RESOURCE'].map(h => (
                            <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E2D42]/40">
                        {incidents.map(i => {
                          const live = i.status === 'ACTIVE' || i.status === 'MONITORING';
                          const site = locations.find(l => l.id === i.location_id);
                          return (
                            <tr key={i.id} className={live ? 'hover:bg-[#151F30]' : 'opacity-60 hover:bg-[#151F30]'}>
                              <td className="px-3 py-1.5 text-white">{i.title}</td>
                              <td className="px-3 py-1.5 text-[#8B9CB3]">{i.category}</td>
                              <td className="px-3 py-1.5">
                                <span className={i.severity >= 4 ? 'text-[#FF4AB8]' : i.severity >= 3 ? 'text-[#FFB95F]' : 'text-[#8B9CB3]'}>
                                  SEV {i.severity}/5
                                </span>
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={live ? 'text-[#EF4444]' : 'text-[#10B981]'}>{i.status}</span>
                              </td>
                              <td className="px-3 py-1.5 text-white">{(i.affected_population ?? 0).toLocaleString()}</td>
                              <td className="px-3 py-1.5 text-[#8B9CB3]">{site?.name ?? i.location_id}</td>
                              <td className="px-3 py-1.5 text-[#8B9CB3]">{i.resource_id}</td>
                            </tr>
                          );
                        })}
                        {incidents.length === 0 && (
                          <tr><td colSpan="7" className="px-3 py-6 text-center text-[#5A6E85]">NO INCIDENTS RECORDED FOR THIS SCOPE</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Active Allocations */}
                <AllocationsTable 
                  allocations={allocations} 
                  locations={locations}
                  onSelect={() => {}}
                  selectedId={null}
                  onDispatch={() => {}}
                />
              </div>
            )}

            {activePage === 'map' && (
              <div className="h-[calc(100vh-200px)] min-h-[500px]">
                <div className="bg-[#101827] border border-[#1E2D42] rounded-xl overflow-hidden h-full">
                  <MapView 
                    selectedAllocation={null}
                    onAllocationSelect={() => {}}
                  />
                </div>
              </div>
            )}

            {activePage === 'simulation' && <SimulationPage />}

            {activePage === 'allocations' && (
              <AllocationsPage 
                onViewAudit={() => setActivePage('audit')} 
              />
            )}

            {activePage === 'resources' && <ResourcesPage />}

            {activePage === 'tracking' && <TrackingPage />}

            {activePage === 'funds' && <FundsPage />}

            {activePage === 'audit' && <AuditPage />}

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;