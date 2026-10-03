import React from 'react';
import { AlertTriangle, Road, RefreshCw, Loader2, CheckCircle2, Zap } from 'lucide-react';

const simulationEvents = [
  {
    id: 'demand_spike',
    label: 'DEMAND SPIKE',
    description: 'Increase emergency demand at relief centers',
    icon: AlertTriangle,
    iconColor: '#F59E0B',
    bgColor: '#F59E0B20',
    borderColor: '#F59E0B40',
    endpoint: 'DEMAND_SPIKE',
  },
  {
    id: 'road_blocked',
    label: 'BLOCK PRIMARY ROAD',
    description: 'Simulate road disruption on main corridor',
    icon: Road,
    iconColor: '#EF4444',
    bgColor: '#EF444420',
    borderColor: '#EF444440',
    endpoint: 'ROAD_BLOCKED',
  },
  {
    id: 'run_allocation',
    label: 'RUN ALLOCATION ENGINE',
    description: 'Recalculate optimal resource allocation',
    icon: RefreshCw,
    iconColor: '#00D4FF',
    bgColor: '#00D4FF20',
    borderColor: '#00D4FF40',
    endpoint: 'RUN_ALLOCATION',
    isPrimary: true,
  },
];

const SimulationPanel = ({ onTriggerEvent, onRunAllocation, loading }) => {
  return (
    <div className="bg-[#101827] border border-[#1E2D42] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-white">SIMULATION CONTROL</h2>
            <p className="text-[11px] text-[#8B9CB3]">EARTHQUAKE RESPONSE SCENARIO</p>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30">
          ACTIVE
        </span>
      </div>

      <div className="space-y-3">
        {simulationEvents.map((event) => {
          const Icon = event.icon;
          const isLoading = loading === event.endpoint;
          const isPrimary = event.isPrimary;

          return (
            <button
              key={event.id}
              onClick={() => {
                if (event.endpoint === 'RUN_ALLOCATION') {
                  onRunAllocation();
                } else {
                  onTriggerEvent(event.endpoint);
                }
              }}
              disabled={isLoading}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 ${
                isPrimary
                  ? 'bg-gradient-to-r from-[#00D4FF] to-[#00A3CC] text-[#070B14] font-semibold hover:from-[#00A3CC] hover:to-[#0091BA] shadow-[0_0_20px_rgba(0,212,255,0.3)]'
                  : 'bg-[#151F30] border text-[#D1D5DB] hover:border-[#27364D]'
              } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
              style={!isPrimary ? { borderColor: event.borderColor } : {}}
            >
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: isPrimary ? 'rgba(255,255,255,0.2)' : event.bgColor }}
              >
                <Icon size={18} style={{ color: isPrimary ? 'white' : event.iconColor }} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="font-medium text-sm">{event.label}</div>
                <div className="text-[11px] opacity-80">{event.description}</div>
              </div>
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} style={{ color: isPrimary ? 'white' : event.iconColor }} />
              ) : isPrimary ? (
                <Zap size={18} className="text-white/80" />
              ) : (
                <CheckCircle2 size={18} style={{ color: event.iconColor, opacity: 0 }} className="transition-opacity group-hover:opacity-100" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-[#1E2D42]">
        <p className="text-[11px] text-[#5A6E85] text-center">
          All simulations use real backend APIs — no mock data
        </p>
      </div>
    </div>
  );
};

export default SimulationPanel;