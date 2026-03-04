'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Users, DollarSign, Calendar, Clock, Loader2, X, RefreshCcw, TrendingUp, ChevronDown, Edit2, Save, AlertCircle } from 'lucide-react';
import { calculateJobStats } from '../../../lib/scheduleUtils';

// --- HELPERS ---
const formatPreciseTime = (decimalHours: number) => {
  const totalSeconds = Math.round(decimalHours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

const generatePayPeriods = () => {
  const periods = [];
  const now = new Date();
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();
  let isFirstHalf = now.getDate() <= 15;
  const cutoffDate = new Date(2026, 0, 1);

  while (true) {
    let start, end;
    if (isFirstHalf) {
      start = new Date(currentYear, currentMonth, 1);
      end = new Date(currentYear, currentMonth, 15, 23, 59, 59);
    } else {
      start = new Date(currentYear, currentMonth, 16);
      end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    }
    if (start < cutoffDate) break;
    const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    periods.push({ label, start, end });
    if (isFirstHalf) { currentMonth--; isFirstHalf = false; } else { isFirstHalf = true; }
    if (periods.length > 50) break;
  }
  return periods;
};

export default function PayrollPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [tempRate, setTempRate] = useState('');
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  
  const periods = useMemo(() => generatePayPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);

  const triggerUpdate = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    const q = query(collection(db, "employees"), orderBy("role", "asc"));
    return onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  useEffect(() => {
    const calculatePayroll = async () => {
      if (employees.length === 0) return;
      setLoading(true);
      setError(null);
      const report = [];

      try {
        const leadsRef = collection(db, "leads");
        const leadsQuery = query(leadsRef, where("status", "in", ["Archived", "Completed", "completed"]));
        const leadsSnap = await getDocs(leadsQuery);
        const allCompletedLeads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const emp of employees) {
          try {
            const attendRef = collection(db, "employees", emp.id, "attendance");
            const q = query(attendRef, where("startTime", ">=", selectedPeriod.start), where("startTime", "<=", selectedPeriod.end));
            const snap = await getDocs(q);
            const empShifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const totalHours = empShifts.reduce((sum, s: any) => sum + (s.totalHours || 0), 0);
            
            let empTips = 0;
            let empReferralBonuses = 0;
            
            allCompletedLeads.forEach((lead: any) => {
              const paymentDate = lead.completedAt ? new Date(lead.completedAt) : null;
              if (paymentDate && paymentDate >= selectedPeriod.start && paymentDate <= selectedPeriod.end) {
                if (lead.status === 'Archived') {
                  if (lead.assignedTo === emp.id) {
                    empTips += parseFloat(lead.tipAmount || "0");
                  }
                  if (lead.referralEmployee === emp.id) {
                    const stats = calculateJobStats(lead);
                    empReferralBonuses += parseFloat(stats.referralBonus || "0");
                  }
                }
              }
            });            

            const rate = emp.hourlyRate || 0;
            const basePay = totalHours * rate;
            const grossPay = basePay + empTips + empReferralBonuses;
            
            report.push({ 
              ...emp, 
              totalHours, 
              basePay,
              tips: empTips,
              referralBonuses: empReferralBonuses,
              grossPay,
              shiftCount: empShifts.length, 
              shifts: empShifts 
            });
          } catch (err: any) { 
            console.error(`Error for ${emp.name}:`, err); 
          }
        }
        setPayrollData(report);
      } catch (err: any) {
        console.error("Master payroll error:", err);
        setError(err.message || "Failed to load payroll data.");
      } finally {
        setLoading(false);
      }
    };
    calculatePayroll();
  }, [employees, selectedPeriod, refreshTrigger]);

  const updateRate = async (empId: string) => {
    setIsUpdatingRate(true);
    try {
      await updateDoc(doc(db, "employees", empId), { 
        hourlyRate: parseFloat(tempRate) || 0 
      });
      setEditingRateId(null);
      triggerUpdate();
    } catch (err) {
      alert("Failed to update rate");
    } finally {
      setIsUpdatingRate(false);
    }
  };

  const grandTotal = payrollData.reduce((acc, p) => acc + p.grossPay, 0);

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen bg-slate-50/50 text-center font-sans">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8 max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Payroll Ledger</h1>
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-4 min-w-[300px]">
          <Calendar size={16} className="text-slate-400" />
          <select 
            className="w-full bg-slate-50 text-xs font-black uppercase tracking-widest p-3 rounded-xl outline-none cursor-pointer hover:border-emerald-600 transition-all text-slate-900 appearance-none text-center"
            value={selectedPeriod.label}
            onChange={(e) => setSelectedPeriod(periods.find(p => p.label === e.target.value)!)}
          >
            {periods.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="animate-spin text-emerald-600" size={48} />
          <p className="font-black text-slate-400 uppercase italic text-xs tracking-[0.4em]">Calculating Totals...</p>
        </div>
      ) : error ? (
        <div className="max-w-xl mx-auto py-24 bg-white rounded-[3rem] border-2 border-red-100 text-center space-y-6 shadow-xl">
          <div className="bg-red-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto text-red-500"><X size={32} /></div>
          <p className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">System Error</p>
          <button onClick={triggerUpdate} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest hover:bg-emerald-600 transition-all">Try Re-Syncing</button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-10 text-left">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl border border-slate-800 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 text-slate-800 rotate-12 group-hover:scale-110 transition-transform duration-1000 opacity-20"><TrendingUp size={160} /></div>
            <p className="text-emerald-500 font-black uppercase text-[9px] tracking-[0.4em] mb-3 italic">Total Period Payout</p>
            <h4 className="text-7xl md:text-8xl font-black italic tracking-tighter leading-none relative z-10">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
          </div>

          <div className="grid gap-4">
            {payrollData.map((emp) => {
              const isExpanded = expandedTechId === emp.id;
              const isEditingRate = editingRateId === emp.id;
              const hasNoRate = !emp.hourlyRate || emp.hourlyRate === 0;

              return (
                <div key={emp.id} className={`bg-white rounded-[2.5rem] border-2 transition-all overflow-hidden ${isExpanded ? 'border-emerald-600 shadow-2xl' : 'border-white hover:border-emerald-100 shadow-sm'}`}>
                  <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-6 group">
                    <div onClick={() => setExpandedTechId(isExpanded ? null : emp.id)} className="flex items-center gap-6 text-left flex-1 cursor-pointer">
                      <div className={`h-16 w-16 rounded-2xl flex items-center justify-center ${emp.status === 'clocked_in' ? 'bg-emerald-500' : 'bg-red-500'} text-white shadow-lg`}>
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase italic leading-none text-2xl">{emp.name}</h3>
                        <div className="flex items-center gap-3 mt-2">
                          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">{emp.email}</p>
                          {hasNoRate && (
                            <span className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-full animate-pulse"><AlertCircle size={10}/> Rate Missing</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8 md:gap-12">
                      <div className="text-center bg-slate-50 p-4 rounded-2xl min-w-[120px] relative group/rate">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Hourly Rate</p>
                        {isEditingRate ? (
                          <div className="flex items-center gap-2">
                            <input autoFocus type="number" className="w-16 bg-white border border-emerald-500 rounded-lg p-1 text-sm font-black text-slate-900 outline-none" value={tempRate} onChange={(e) => setTempRate(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && updateRate(emp.id)} />
                            <button onClick={() => updateRate(emp.id)} disabled={isUpdatingRate} className="text-emerald-600 hover:scale-110 transition-transform"><Save size={16}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <p className={`text-xl font-black italic ${hasNoRate ? 'text-red-500' : 'text-slate-900'}`}>${emp.hourlyRate || '0.00'}</p>
                            <button onClick={() => { setEditingRateId(emp.id); setTempRate(String(emp.hourlyRate || '')); }} className="opacity-0 group-hover/rate:opacity-100 text-slate-400 hover:text-blue-600 transition-all"><Edit2 size={12}/></button>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mb-1 italic">Hours</p>
                        <p className="text-xl font-black text-slate-900 italic tracking-tighter leading-none">{formatPreciseTime(emp.totalHours)}</p>
                      </div>

                      <div className="text-right min-w-[140px]">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mb-1 italic">Total Gross Pay</p>
                        <p className="text-3xl font-black text-emerald-600 italic tracking-tighter leading-none">${emp.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <ChevronDown onClick={() => setExpandedTechId(isExpanded ? null : emp.id)} className={`text-slate-200 transition-all cursor-pointer ${isExpanded ? 'rotate-180 text-emerald-600' : ''}`} size={24} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-10 pb-10 pt-2 bg-slate-50/30 animate-in slide-in-from-top-4 duration-300 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic mb-1">Base Hourly</p><p className="text-2xl font-black text-slate-900 italic">${emp.basePay.toFixed(2)}</p></div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100"><p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic mb-1">Tips</p><p className="text-2xl font-black text-emerald-600 italic">${emp.tips.toFixed(2)}</p></div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-100"><p className="text-[8px] font-black text-orange-600 uppercase tracking-widest italic mb-1">Ref. Bonuses (10%)</p><p className="text-2xl font-black text-orange-600 italic">${emp.referralBonuses.toFixed(2)}</p></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
