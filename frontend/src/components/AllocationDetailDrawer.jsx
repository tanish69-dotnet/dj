import React from 'react';
import { X, Truck, MapPin, CheckCircle, Clock, Package, AlertTriangle, Route, ArrowRight } from 'lucide-react';

const statusConfig = {
  AVAILABLE: { label: 'AVAILABLE', color: '#10B981', icon: CheckCircle },
  ALLOCATED: { label: 'ALLOCATED', color: '#3B82F6', icon: Package },
  DISPATCHED: { label: 'DISPATCHED', color: '#F59E0B', icon: Truck },
  IN_TRANSIT: { label: 'IN TRANSIT', color: '#06B6D4', icon: Truck },
  DELIVERED: { label: 'DELIVERED', color: '#10B981', icon: CheckCircle },
  VERIFIED: { label: 'VERIFIED', color: '#8B5CF6', icon: CheckCircle },
  STALE: { label: 'STALE', color: '#F59E0B', icon: AlertTriangle },
  REALLOCATED: { label: 'REALLOCATED', color: '#A855F7', icon: Route },
};

const AllocationDetailDrawer = ({ allocation, locations, onClose }) => {
  if (!allocation) return null;

  const status = statusConfig[allocation.status] || statusConfig.AVAILABLE;
  const StatusIcon = status.icon;
  const sourceLoc = locations.find(l => l.id === allocation.source_id);
  const destLoc = locations.find(l => l.id === allocation.demand_id?.split('-')[0] || '') || 
                  locations.find(l => l.id === 'H1');

  const explanation = allocation.explanation || 'No explanation available.';

  // Parse explanation for structured display
  const severityMatch = explanation.match(/severity (\d)/i);
  const travelTimeMatch = explanation.match(/travel time ([\d.]+)/i);
  const stockMatch = explanation.match(/available stock (\d+)/i);

  const severity = severityMatch ? parseInt(severityMatch[1]) : 5;
  const travelTime = travelTimeMatch ? travelTimeMatch[1] : '—';
  const availableStock = stockMatch ? stockMatch[1] : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="w-full max-w-md bg-[#101827] border-l border-[#1E2D42] h-full flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E2D42]">
          <div>
            <h2 className="font-semibold text-white">ALLOCATION DETAILS</h2>
            <p className="text-[11px] text-[#5A6E85] font-mono">{allocation.id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#151F30] border border-[#1E2D42] flex items-center justify-center text-[#8B9CB3] hover:text-white hover:border-[#27364D] transition-all"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${status.color}15`, borderColor: `${status.color}40` }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${status.color}25` }}>
              <StatusIcon size={20} style={{ color: status.color }} />
            </div>
            <div>
              <p className="text-[11px] text-[#5A6E85] uppercase tracking-wider">STATUS</p>
              <p className="font-semibold text-white" style={{ color: status.color }}>{status.label}</p>
            </div>
          </div>

          {/* Resource Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <p className="text-[10px] text-[#5A6E85] uppercase tracking-wider mb-1">RESOURCE</p>
                <p className="font-mono text-white text-sm">{allocation.resource_id}</p>
              </div>
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <p className="text-[10px] text-[#5A6E85] uppercase tracking-wider mb-1">QUANTITY</p>
                <p className="font-bold text-white text-xl">{allocation.quantity} units</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <p className="text-[10px] text-[#5A6E85] uppercase tracking-wider mb-1">SOURCE</p>
                <p className="font-medium text-white text-sm truncate">{sourceLoc?.name || allocation.source_id}</p>
                <p className="text-[11px] text-[#5A6E85] font-mono">{allocation.source_id}</p>
              </div>
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <p className="text-[10px] text-[#5A6E85] uppercase tracking-wider mb-1">DESTINATION</p>
                <p className="font-medium text-white text-sm truncate">{destLoc?.name || allocation.demand_id}</p>
                <p className="text-[11px] text-[#5A6E85] font-mono">{allocation.demand_id}</p>
              </div>
            </div>
          </div>

          {/* Decision Analysis */}
          <div className="border-t border-[#1E2D42] pt-4">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#F59E0B]" />
              WHY THIS DECISION?
            </h3>
            
            <div className="space-y-4">
              {/* Severity */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#8B9CB3]">Severity</span>
                  <span className="font-semibold text-white">{severity}/5</span>
                </div>
                <div className="h-2 bg-[#070B14] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${(severity / 5) * 100}%`,
                      backgroundColor: severity >= 4 ? '#EF4444' : severity >= 3 ? '#F59E0B' : '#10B981'
                    }}
                  />
                </div>
              </div>

              {/* Travel Time */}
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Clock size={14} className="text-[#8B9CB3]" />
                  <span className="text-[#8B9CB3]">Travel Time</span>
                </div>
                <p className="font-bold text-white text-lg">{travelTime} min</p>
              </div>

              {/* Available Stock */}
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Package size={14} className="text-[#8B9CB3]" />
                  <span className="text-[#8B9CB3]">Available Stock</span>
                </div>
                <p className="font-bold text-white text-lg">{availableStock} units</p>
              </div>

              {/* Compatibility & Route */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm mb-1">
                    <CheckCircle size={14} className="text-[#10B981]" />
                    <span className="text-[#8B9CB3]">Compatibility</span>
                  </div>
                  <p className="font-semibold text-[#10B981]">✓ Compatible</p>
                </div>
                <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm mb-1">
                    <Route size={14} className="text-[#10B981]" />
                    <span className="text-[#8B9CB3]">Route</span>
                  </div>
                  <p className="font-semibold text-[#10B981]">✓ Feasible</p>
                </div>
              </div>
            </div>
          </div>

          {/* Decision Explanation */}
          <div className="border-t border-[#1E2D42] pt-4">
            <h3 className="font-semibold text-white mb-3">DECISION EXPLANATION</h3>
            <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-4">
              <p className="text-sm text-[#D1D5DB] leading-relaxed whitespace-pre-wrap">{explanation}</p>
            </div>
          </div>

          {/* Route Path */}
          {allocation.route_path && (
            <div className="border-t border-[#1E2D42] pt-4">
              <h3 className="font-semibold text-white mb-3">ROUTE PATH</h3>
              <div className="bg-[#070B14] border border-[#1E2D42] rounded-lg p-3">
                <p className="font-mono text-xs text-[#00D4FF] bg-[#00D4FF]/10 px-2 py-1 rounded inline-block">
                  {allocation.route_path}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllocationDetailDrawer;