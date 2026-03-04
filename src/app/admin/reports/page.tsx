'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { DollarSign, TrendingUp, Calendar, Briefcase, ChevronLeft, Loader2, MapPin, Receipt, ArrowRight, BarChart3, UserCheck, CreditCard, Banknote, CheckSquare } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  const [archivedLeads, setArchivedLeads] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Archived Missions
    const q = query(
      collection(db, "leads"), 
      where("status", "in", ["Archived", "Completed", "completed"]),
      orderBy("createdAt", "desc")
    );
    const unsubArchived = onSnapshot(q, (snap) => {
      setArchivedLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // 2. Fetch Employees for Mapping
    const unsubEmp = onSnapshot(collection(db, "employees"), (snap) => {
      setAllEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubArchived(); unsubEmp(); };
  }, []);

  const stats = useMemo(() => {
    const total = archivedLeads.reduce((sum, lead) => {
      const cleanPrice = parseFloat(lead.total || lead.finalPrice || '0');
      return sum + (isNaN(cleanPrice) ? 0 : cleanPrice);
    }, 0);

    return {
      totalRevenue: total,
      totalJobs: archivedLeads.length,
      avgJobValue: archivedLeads.length > 0 ? total / archivedLeads.length : 0
    };
  }, [archivedLeads]);

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen bg-slate-50/50 text-left">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-8">
        <div className="text-center xl:text-left flex-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-4">Revenue Reports</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="font-black text-slate-400 uppercase italic text-xs tracking-[0.4em]">Compiling Financial Data...</p>
        </div>
      ) : (
        <>
          {/* STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group border border-slate-800">
              <div className="absolute -right-4 -bottom-4 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                <DollarSign size={120} />
              </div>
              <p className="text-blue-500 font-black uppercase text-[9px] tracking-[0.4em] mb-3 italic">Gross Revenue</p>
              <h4 className="text-5xl md:text-6xl font-black italic tracking-tighter leading-none">
                ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h4>
            </div>

            <div className="bg-white rounded-[3rem] p-10 text-slate-900 shadow-xl border border-slate-100 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                <Briefcase size={120} />
              </div>
              <p className="text-blue-600 font-black uppercase text-[9px] tracking-[0.4em] mb-3 italic">Completed Jobs</p>
              <h4 className="text-5xl md:text-6xl font-black italic tracking-tighter leading-none">{stats.totalJobs}</h4>
              <div className="mt-6 inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic tracking-widest">
                Archives
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-10 text-slate-900 shadow-xl border border-slate-100 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                <TrendingUp size={120} />
              </div>
              <p className="text-blue-600 font-black uppercase text-[10px] tracking-[0.4em] mb-3 italic">Average Ticket</p>
              <h4 className="text-5xl md:text-6xl font-black italic tracking-tighter leading-none">
                ${stats.avgJobValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </h4>
            </div>
          </div>

          {/* REVENUE TABLE */}
          <div className="space-y-5">
            <div className="flex items-center gap-4 px-6">
              <Receipt size={14} className="text-slate-300" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Transaction Log</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-8 text-[8px] font-black uppercase tracking-[0.3em]">Settled</th>
                      <th className="p-8 text-[8px] font-black uppercase tracking-[0.3em]">Customer Intelligence</th>
                      <th className="p-8 text-[8px] font-black uppercase tracking-[0.3em]">Personnel</th>
                      <th className="p-8 text-[8px] font-black uppercase tracking-[0.3em]">Method</th>
                      <th className="p-8 text-[8px] font-black uppercase tracking-[0.3em] text-right">Yield</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {archivedLeads.map((lead) => {
                      const name = lead.template?.data?.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Customer';
                      const fullAddress = `${lead.address || 'N/A'}, ${lead.city || 'WA'}`;
                      const displayPrice = lead.total || lead.finalPrice || 0;
                      const assignedMember = allEmployees.find(e => e.id === lead.assignedTo);
                      const method = lead.paymentMethod || 'Other';
                      const completionDate = lead.completedAt 
                        ? (typeof lead.completedAt === 'string' ? new Date(lead.completedAt) : lead.completedAt.toDate?.())
                        : (lead.createdAt?.toDate ? lead.createdAt.toDate() : null);

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50/50 transition-all group">
                          <td className="p-8">
                            <p className="text-[10px] font-black text-slate-400 italic leading-none">
                              {completionDate ? completionDate.toLocaleDateString() : 'ARCHIVED'}
                            </p>
                            {completionDate && (
                              <p className="text-[8px] font-bold text-slate-300 uppercase mt-1.5 tracking-widest italic leading-none">
                                {completionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </td>
                          
                          <td className="p-8">
                            <p className="font-black text-slate-900 uppercase italic leading-none text-xl tracking-tighter group-hover:text-blue-600 transition-colors">
                              {name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-black mt-2.5 uppercase tracking-widest flex items-center gap-2 italic">
                              <MapPin size={10} className="text-blue-600" /> {fullAddress}
                            </p>
                          </td>

                          <td className="p-8">
                            {assignedMember ? (
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600">
                                  <UserCheck size={12} />
                                </div>
                                <p className="text-[10px] font-black uppercase italic text-slate-900 tracking-wider">{assignedMember.name}</p>
                              </div>
                            ) : (
                              <p className="text-[9px] font-black uppercase text-slate-300 italic tracking-widest leading-none">Unassigned</p>
                            )}
                          </td>

                          <td className="p-8">
                            <div className="flex items-center gap-3">
                              {method === 'Card' ? <CreditCard size={14} className="text-blue-600" /> : method === 'Cash' ? <Banknote size={14} className="text-emerald-600" /> : <CheckSquare size={14} className="text-amber-600" />}
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black uppercase italic text-slate-900 leading-none">{method}</p>
                                {lead.checkNumber && <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">#{lead.checkNumber}</p>}
                              </div>
                            </div>
                          </td>

                          <td className="p-8 text-right">
                            <p className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">
                              ${Number(displayPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {archivedLeads.length === 0 && (
                <div className="p-24 text-center flex flex-col items-center justify-center space-y-4">
                  <div className="p-6 bg-slate-50 rounded-full text-slate-200">
                    <BarChart3 size={48} />
                  </div>
                  <p className="font-black text-slate-300 uppercase italic tracking-[0.4em] text-xs">No historical data available.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}