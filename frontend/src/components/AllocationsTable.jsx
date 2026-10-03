import React from 'react';
import { Truck, MapPin, Package, Clock, ChevronRight, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const statusConfig = {
  AVAILABLE: { label: 'AVAILABLE', color: '#10B981', icon: CheckCircle },
  ALLOCATED: { label: 'ALLOCATED', color: '#3B82F6', icon: Package },
  DISPATCHED: { label: 'DISPATCHED', color: '#F59E0B', icon: Truck },
  IN_TRANSIT: { label: 'IN TRANSIT', color: '#06B6D4', icon: Truck },
  DELIVERED: { label: 'DELIVERED', color: '#10B981', icon: CheckCircle },
  VERIFIED: { label: 'VERIFIED', color: '#8B5CF6', icon: CheckCircle },
  STALE: { label: 'STALE', color: '#F59E0B', icon: AlertCircle },
  REALLOCATED: { label: 'REALLOCATED', color: '#A855F7', icon: XCircle },
};

const statusOrder = ['STALE', 'IN_TRANSIT', 'DISPATCHED', 'ALLOCATED', 'AVAILABLE', 'DELIVERED', 'VERIFIED', 'REALLOCATED'];

const AllocationsTable = ({ allocations, locations, onSelect, selectedId, onDispatch }) => {
  const sortedAllocations = [...allocations].sort((a, b) => {
    const aIdx = statusOrder.indexOf(a.status);
    const bIdx = statusOrder.indexOf(b.status);
    return aIdx - bIdx;
  });

  if (allocations.length === 0) {
    return (
      <div className="bg-[#101827] border border-[#1E2D42] rounded-xl overflow-hidden">
        <div className="p-6 text-center">
          <Package size={48} className="mx-auto text-[#27364D] mb-3" />
          <h3 className="font-medium text-white mb-1">No Active Allocations</h3>
          <p className="text-[#5A6E85] text-sm">Run the allocation engine to create resource assignments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101827] border border-[#1E2D42] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-[#1E2D42] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={20} className="text-[#00D4FF]" />
          <h2 className="font-semibold text-white">ACTIVE ALLOCATIONS</h2>
        </div>
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30">
          {allocations.length} ACTIVE
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-[#1E2D42]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">RESOURCE</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">SOURCE</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">DESTINATION</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">QTY</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">STATUS</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">ROUTE</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#5A6E85] uppercase tracking-wider">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {sortedAllocations.map((a) => {
              const status = statusConfig[a.status] || statusConfig.AVAILABLE;
              const StatusIcon = status.icon;
              const sourceLoc = locations.find(l => l.id === a.source_id);
              const isSelected = selectedId === a.id;
              const isStale = a.status === 'STALE';

              return (
                <tr
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  className={`transition-colors ${
                    isSelected 
                      ? 'bg-[#00D4FF]/5' 
                      : 'hover:bg-[#151F30]'
                  } cursor-pointer`}
                  style={{ borderColor: isSelected ? '#00D4FF40' : '#1E2D42' }}
                >
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <code className="text-[11px] font-mono text-[#8B9CB3]">{a.id.substring(0, 12)}</code>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <span className="font-medium text-white">{a.resource_id}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-[#8B9CB3]" />
                      <span className="text-sm text-[#D1D5DB] truncate max-w-[140px]">
                        {sourceLoc?.name || a.source_id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-[#8B9CB3]" />
                      <span className="text-sm text-[#D1D5DB] truncate max-w-[140px]">
                        {a.demand_id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <span className="font-bold text-white tabular-nums">{a.quantity}</span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <span 
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${isStale ? 'animate-pulse' : ''}`}
                      style={{ 
                        backgroundColor: `${status.color}20`, 
                        color: status.color,
                        border: `1px solid ${status.color}40`
                      }}
                    >
                      <StatusIcon size={10} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50">
                    <code className="text-[10px] font-mono text-[#5A6E85] bg-[#070B14] px-2 py-1 rounded">
                      {a.route_path}
                    </code>
                  </td>
                  <td className="px-4 py-3 border-b border-[#1E2D42]/50 text-right">
                    {a.status === 'AVAILABLE' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDispatch(a.id);
                        }}
                        className="px-3 py-1.5 text-[11px] font-medium text-[#070B14] bg-[#10B981] hover:bg-[#059669] rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Truck size={12} />
                        Dispatch
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(a.id);
                      }}
                      className="ml-2 p-1.5 text-[#8B9CB3] hover:text-[#00D4FF] hover:bg-[#151F30] rounded-lg transition-colors"
                      aria-label={`View details for ${a.id.substring(0, 8)}`}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AllocationsTable;