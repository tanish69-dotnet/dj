import React from 'react';
import { AlertTriangle, Package, CheckCircle, Clock, TrendingUp } from 'lucide-react';

const statusIcons = {
  emergencies: AlertTriangle,
  resources: Package,
  allocations: CheckCircle,
  demand: Clock,
};

const statusColors = {
  emergencies: '#EF4444',
  resources: '#10B981',
  allocations: '#3B82F6',
  demand: '#F59E0B',
};

const supportingText = {
  emergencies: 'Current incidents',
  resources: 'Across active warehouses',
  allocations: 'Currently being coordinated',
  demand: 'Unfulfilled requirements',
};

const KpiCard = ({ title, value, type, trend }) => {
  const Icon = statusIcons[type] || AlertTriangle;
  const color = statusColors[type] || '#00D4FF';
  const support = supportingText[type] || '';

  return (
    <div className="bg-[#101827] border border-[#1E2D42] rounded-xl p-5 hover:border-[#27364D] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <h3 className="text-sm font-medium text-[#8B9CB3]">{title}</h3>
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium text-[#10B981]">
            <TrendingUp size={12} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white tabular-nums mb-1">{value ?? '—'}</div>
      <p className="text-xs text-[#5A6E85]">{support}</p>
    </div>
  );
};

export default KpiCard;