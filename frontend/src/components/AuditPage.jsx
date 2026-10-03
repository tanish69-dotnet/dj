import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle, XCircle, Clock, Hash } from 'lucide-react';
import { api } from '../services/api';
import { useRegion } from '../context/RegionContext';

export default function AuditPage() {
  const { region, isIndia, title } = useRegion();
  const cityParam = isIndia ? undefined : region;
  const [auditRecords, setAuditRecords] = useState([]);
  const [valid, setValid] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const [auditRes, verifyRes] = await Promise.all([
          api.getAudit(cityParam),
          api.verifyAudit(),
        ]);
        setAuditRecords(auditRes.data);
        setValid(verifyRes.data.valid);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [region]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05080D] text-[#E8EDF2] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#8B9CB3] text-sm">Loading audit ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05080D] text-[#E8EDF2]">
      <header className="px-4 py-3 border-b border-[#1E2D42] bg-[#0B111B]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
              <ShieldCheck size={16} className="text-[#05080D]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">AUDIT LEDGER — {isIndia ? 'NATIONAL' : region.toUpperCase()}</h1>
              <p className="text-[10px] text-[#5A6E85] tracking-wider">Tamper-evident SHA-256 hash-chained audit ledger — {title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {valid ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                <CheckCircle size={12} /> CHAIN VALID
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                <XCircle size={12} /> CHAIN INVALID
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
            <div className="text-[10px] text-[#8B9CB3] uppercase tracking-wider mb-1">TOTAL RECORDS</div>
            <div className="text-2xl font-bold text-white font-mono">{auditRecords.length}</div>
          </div>
          <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
            <div className="text-[10px] text-[#8B9CB3] uppercase tracking-wider mb-1">CHAIN STATUS</div>
            <div className={`text-2xl font-bold font-mono ${valid ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {valid ? 'VALID' : 'INVALID'}
            </div>
          </div>
          <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg p-4">
            <div className="text-[10px] text-[#8B9CB3] uppercase tracking-wider mb-1">LAST EVENT</div>
            <div className="text-sm text-white font-mono truncate">
              {auditRecords[0]?.event_type || 'N/A'}
            </div>
          </div>
        </div>

        <div className="bg-[#0B111B] border border-[#1E2D42]/50 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#1E2D42]/50">
            <h2 className="text-[10px] font-semibold text-[#8B9CB3] uppercase tracking-wider">HASH-CHAINED RECORDS</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E2D42]/50">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">TIMESTAMP</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">ACTOR</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">EVENT</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">PREV HASH</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-[#5A6E85] uppercase">CURRENT HASH</th>
                </tr>
              </thead>
              <tbody>
                {auditRecords.map((record, i) => (
                  <tr key={record.id} className="border-b border-[#1E2D42]/50 hover:bg-[#151F30]">
                    <td className="px-4 py-3 text-[#8B9CB3] font-mono text-xs">
                      {record.timestamp ? new Date(record.timestamp).toLocaleString('en-US', { hour12: false }) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{record.actor}</td>
                    <td className="px-4 py-3 text-white text-xs">{record.event_type}</td>
                    <td className="px-4 py-3 text-[#5A6E85] font-mono text-[10px] truncate max-w-[150px]">{record.previous_hash}</td>
                    <td className="px-4 py-3 text-[#00D4FF] font-mono text-[10px] truncate max-w-[150px]">{record.current_hash}</td>
                  </tr>
                ))}
                {auditRecords.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-8 text-center text-[#5A6E85]">No audit records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
