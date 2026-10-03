import React from 'react';
import { Zap, ShieldCheck, Wifi, Database, Globe2 } from 'lucide-react';
import { useRegion } from '../context/RegionContext';

const Header = ({ auditValid, lastUpdated }) => {
  const { region, setRegion, cityList, cities, citiesOnline, title, subtitle } = useRegion();
  const now = new Date().toLocaleString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
  });

  return (
    <header className="w-full bg-[#101827] border-b border-[#1E2D42] px-6 py-4">
      <div className="max-w-full mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00D4FF] to-[#00A3CC] flex items-center justify-center">
              <Zap size={20} className="text-[#070B14]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
              <p className="text-xs text-[#8B9CB3] uppercase tracking-wider">{subtitle}</p>
            </div>
          </div>
          <p className="text-sm text-[#5A6E85] ml-13">Real-time resource coordination & emergency logistics · SYNTHETIC DEMO DATA</p>
        </div>

        <div className="flex flex-col md:flex-row items-end md:items-center gap-3 md:gap-6 text-right">
          {/* Operational region — India-first */}
          <div className="flex flex-col items-start md:items-end gap-0.5">
            <label htmlFor="region-select" className="text-[10px] font-mono tracking-widest text-[#5A6E85]">OPERATIONAL REGION</label>
            <div className="relative flex items-center gap-1.5">
              <Globe2 size={12} className="text-[#00D4FF]" aria-hidden="true" />
              <select
                id="region-select"
                aria-label="Operational region"
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="bg-[#0B111B] border border-[#1E2D42] rounded-sm pl-2 pr-6 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF]/40"
              >
                <option value="INDIA">INDIA</option>
                {cityList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <span className="text-[9px] font-mono text-[#27364D]">
              {cityList.length} SECTORS · {citiesOnline ? 'LIVE CATALOG' : 'BUNDLED CATALOG'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-medium text-[#10B981]">SYSTEM OPERATIONAL</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#8B9CB3]">
            <div className="flex items-center gap-1">
              <Database size={12} className={auditValid ? 'text-[#10B981]' : 'text-[#EF4444]'} />
              <span className={`font-mono ${auditValid ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                Audit: {auditValid ? 'VALID' : 'INVALID'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Wifi size={12} className="text-[#10B981]" />
              <span className="text-[#10B981] font-mono">API CONNECTED</span>
            </div>
          </div>
          <div className="text-xs font-mono text-[#8B9CB3]">
            {now}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;