import React from 'react';
import { 
  LayoutDashboard, MapPin, Zap, Box, Truck, Navigation, 
  IndianRupee, ShieldCheck, ChevronRight
} from 'lucide-react';

const navSections = [
  {
    label: 'NAVIGATION',
    items: [
      { id: 'command', label: 'COMMAND CENTER', icon: LayoutDashboard },
      { id: 'map', label: 'LIVE MAP', icon: MapPin },
      { id: 'simulation', label: 'SIMULATION', icon: Zap },
    ]
  },
  {
    label: 'OPERATIONS',
    items: [
      { id: 'resources', label: 'RESOURCES', icon: Box },
      { id: 'allocations', label: 'ALLOCATIONS', icon: Truck },
      { id: 'tracking', label: 'TRACKING', icon: Navigation },
    ]
  },
  {
    label: 'FINANCE',
    items: [
      { id: 'funds', label: 'FUNDS', icon: IndianRupee },
    ]
  },
  {
    label: 'SECURITY',
    items: [
      { id: 'audit', label: 'AUDIT LEDGER', icon: ShieldCheck },
    ]
  },
];

const Sidebar = ({ activePage, onNavigate }) => {
  return (
    <aside className="w-64 bg-[#101827] border-r border-[#1E2D42] h-screen flex flex-col">
      <nav className="flex-1 p-3 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {navSections.map((section, sectionIndex) => (
          <div key={section.label} className="mb-4">
            <p className="text-[10px] font-semibold text-[#5A6E85] uppercase tracking-wider px-3 py-1">
              {section.label}
            </p>
            <ul className="space-y-1" role="list">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      activePage === item.id
                        ? 'bg-[#151F30] text-[#00D4FF] border border-[#00D4FF]/30'
                        : 'text-[#8B9CB3] hover:text-white hover:bg-[#151F30]'
                    }`}
                    aria-current={activePage === item.id ? 'page' : undefined}
                  >
                    <item.icon size={16} className="flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {activePage === item.id && (
                      <ChevronRight size={14} className="text-[#00D4FF]" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-[#1E2D42] space-y-2">
        <p className="text-[10px] font-semibold text-[#5A6E85] uppercase tracking-wider">SYSTEM STATUS</p>
        <div className="space-y-1.5">
          {[
            { label: 'SYSTEM OPERATIONAL', status: 'ok' },
            { label: 'API CONNECTED', status: 'ok' },
            { label: 'AUDIT VERIFIED', status: 'ok' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#8B9CB3]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" aria-hidden="true" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;