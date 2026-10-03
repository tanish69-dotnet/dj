import React, { useEffect, useState } from 'react';
import { IndianRupee, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { useRegion } from '../context/RegionContext';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function FundsPage() {
  const { region, isIndia, title } = useRegion();
  const cityParam = isIndia ? undefined : region;
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFunds = async () => {
      try {
        const res = await api.getFunds(cityParam);
        setFunds(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    fetchFunds();
    const t = setInterval(fetchFunds, 5000);
    return () => clearInterval(t);
  }, [region]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05080D] text-[#E8EDF2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#8B9CB3] text-sm">Loading funds...</p>
        </div>
      </div>
    );
  }

  const totalAllocated = funds.reduce((s, f) => s + (f.allocated_amount || 0), 0);
  const totalFunds = funds.reduce((s, f) => s + (f.total_amount || 0), 0);
  const utilization = totalFunds > 0 ? Math.round((totalAllocated / totalFunds) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#05080D] text-[#E8EDF2]">
      <header className="px-4 py-3 border-b border-[#1E2D42] bg-[#0B111B]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-full mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
            <IndianRupee size={16} className="text-[#05080D]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">FUNDS — {isIndia ? 'NATIONAL' : region.toUpperCase()}</h1>
            <p className="text-[10px] text-[#5A6E85] tracking-wider">Financial allocation & utilization overview — {title}</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
            <div className="text-[10px] text-[#8B9CB3] uppercase tracking-wider mb-1">TOTAL FUNDS</div>
            <div className="text-2xl font-bold text-white font-mono">{inr.format(totalFunds)}</div>
          </div>
          <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
            <div className="text-[10px] text-[#8B9CB3] uppercase tracking-wider mb-1">ALLOCATED</div>
            <div className="text-2xl font-bold text-[#3B82F6] font-mono">{inr.format(totalAllocated)}</div>
          </div>
          <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
            <div className="text-[10px] text-[#8B9CB3] uppercase tracking-wider mb-1">UTILIZATION</div>
            <div className="text-2xl font-bold text-[#F59E0B] font-mono">{utilization}%</div>
          </div>
        </div>

        <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#1E2D42]/50">
            <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider">FUND ALLOCATIONS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E2D42]/50">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">CATEGORY</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-[#5A6E85] uppercase">TOTAL</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-[#5A6E85] uppercase">ALLOCATED</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-[#5A6E85] uppercase">REMAINING</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {funds.map(f => {
                  const remaining = (f.total_amount || 0) - (f.allocated_amount || 0);
                  const pct = f.total_amount > 0 ? Math.round((f.allocated_amount / f.total_amount) * 100) : 0;
                  return (
                    <tr key={f.id} className="border-b border-[#1E2D42]/50 hover:bg-[#151F30]">
                      <td className="px-4 py-3 text-white font-medium">{f.category}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{inr.format(f.total_amount || 0)}</td>
                      <td className="px-4 py-3 text-right text-[#3B82F6] font-mono">{inr.format(f.allocated_amount || 0)}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">{inr.format(remaining)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                          <CheckCircle size={10} /> {pct}% UTILIZED
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {funds.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-[#5A6E85]">No fund data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
