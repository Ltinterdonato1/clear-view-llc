'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { 
  TrendingUp, Briefcase, Loader2, MapPin, Receipt, ArrowRight, BarChart3, 
  UserCheck, CreditCard, Banknote, CheckSquare, Sparkles, Search, User, Phone, Mail,
  ShieldCheck, X, Edit2, Trash2, Save, Wallet, UserPlus, Check, Users, ChevronDown, Calendar
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CustomerInquiryModal from '../../../components/CustomerInquiryModal';

export default function ReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'financials' | 'customers'>('financials');
  
  // Data State
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const qLeads = query(
      collection(db, "leads"), 
      orderBy("createdAt", "desc")
    );
    const unsubLeads = onSnapshot(qLeads, (snap) => {
      setAllLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubEmp = onSnapshot(collection(db, "employees"), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllEmployees(docs);
    });

    return () => { unsubLeads(); unsubEmp(); };
  }, []);

  // --- FINANCIALS DATA (COMPLETED ONLY) ---
  const archivedLeads = useMemo(() => {
    return allLeads.filter(d => ["Archived", "Completed", "completed"].includes(d.status));
  }, [allLeads]);

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

  // --- CUSTOMER INTELLIGENCE (ALL UNIQUE PROFILES) ---
  const uniqueCustomers = useMemo(() => {
    const groups: Record<string, any> = {};
    
    allLeads.forEach(lead => {
      if (lead.hideFromCustomersPage) return; // Skip hidden leads
      
      const name = (lead.template?.data?.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`).trim() || 'New Customer';
      const key = `${name.toLowerCase()}-${(lead.phone || '').replace(/\D/g,'')}`;
      
      if (!groups[key]) {
        groups[key] = { 
          ...lead, 
          displayName: name, 
          groupKey: key, 
          totalRewards: Number(lead.referralRewardBalance || 0), 
          allIds: [lead.id],
          jobs: [lead]
        };
      } else {
        groups[key].allIds.push(lead.id);
        groups[key].totalRewards += Number(lead.referralRewardBalance || 0);
        groups[key].jobs.push(lead);
        if (!groups[key].email && lead.email) groups[key].email = lead.email;
        if (!groups[key].address && lead.address) groups[key].address = lead.address;
      }
    });
    return Object.values(groups);
  }, [allLeads]);

  const filteredCustomers = uniqueCustomers.filter(cust => {
    const search = searchQuery.toLowerCase();
    return cust.displayName.toLowerCase().includes(search) || 
           (cust.phone || '').includes(search) || 
           (cust.email || '').toLowerCase().includes(search) ||
           (cust.address || '').toLowerCase().includes(search);
  });

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "leads", editingLead.id), {
        firstName: editingLead.firstName || '',
        lastName: editingLead.lastName || '',
        email: editingLead.email || '',
        phone: editingLead.phone || '',
        address: editingLead.address || '',
        city: editingLead.city || ''
      });
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); setEditingLead(null); }, 2000);
    } catch (err) { console.error(err); }
    finally { setIsUpdating(false); }
  };

  const softDeleteClient = async (cust: any) => {
    setRemovingId(cust.groupKey);
    try {
      const batch = writeBatch(db);
      for (const id of cust.allIds) {
        batch.set(doc(db, "leads", id), { hideFromCustomersPage: true }, { merge: true });
      }
      await batch.commit();
    } catch (error) {
      console.error("Removal failed:", error);
    } finally {
      setRemovingId(null);
    }
  };

  const hardDeleteClient = async (cust: any) => {
    setRemovingId(cust.groupKey);
    try {
      const batch = writeBatch(db);
      for (const id of cust.allIds) {
        batch.delete(doc(db, "leads", id));
      }
      await batch.commit();
    } catch (error) {
      console.error("Hard delete failed:", error);
    } finally {
      setRemovingId(null);
    }
  };

  const navigateToSchedule = (cust: any) => {
    const sortedJobs = [...cust.jobs].sort((a, b) => {
      const dateA = a.selectedDate?.toDate?.() || new Date(a.selectedDate || 0);
      const dateB = b.selectedDate?.toDate?.() || new Date(b.selectedDate || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const targetJob = sortedJobs.find(j => j.selectedDate);
    if (targetJob) {
      const d = targetJob.selectedDate?.toDate?.() || new Date(targetJob.selectedDate);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      router.push(`/admin/schedule?date=${dateStr}&highlight=${targetJob.id}`);
    } else {
      router.push('/admin/schedule');
    }
  };

  const getPaymentIcon = (method: string) => {
    const m = method?.toLowerCase() || '';
    if (m.includes('card')) return <CreditCard size={12} className="text-blue-500" />;
    if (m.includes('cash')) return <Banknote size={12} className="text-emerald-500" />;
    if (m.includes('check')) return <Receipt size={12} className="text-orange-500" />;
    return <Wallet size={12} className="text-slate-300" />;
  };

  return (
    <div className="p-4 sm:p-8 lg:p-12 xl:p-16 space-y-10 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">
      
      {/* TAB SWITCHER */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-8 text-left">
        <div className="flex items-center gap-6 text-left">
          <div className="flex items-center gap-2 text-left">
            <button 
              onClick={() => setActiveTab('financials')}
              className={`p-4 rounded-2xl transition-all ${activeTab === 'financials' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-200 hover:text-slate-400 hover:bg-slate-50'}`}
            >
              <BarChart3 size={24} />
            </button>
            <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-500 ${activeTab === 'financials' ? 'text-slate-900' : 'text-slate-200'}`}>Report</span>
          </div>
          
          <div className="flex items-center gap-2 text-left">
            <button 
              onClick={() => setActiveTab('customers')}
              className={`p-4 rounded-2xl transition-all ${activeTab === 'customers' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-200 hover:text-slate-400 hover:bg-slate-50'}`}
            >
              <Users size={24} />
            </button>
            <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-500 ${activeTab === 'customers' ? 'text-slate-900' : 'text-slate-200'}`}>Customers</span>
          </div>
        </div>
        
        {activeTab === 'customers' && (
          <button onClick={() => setShowAddModal(true)} className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase italic text-[9px] tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95 leading-none">
            <UserPlus size={14} /> Add Client
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-48 text-center flex flex-col items-center gap-6">
          <Loader2 className="animate-spin text-slate-200" size={64} />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Reading Ledgers...</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-700 text-left">
          {activeTab === 'financials' ? (
            <div className="space-y-12 text-left">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-10 text-left">
                <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-12 text-slate-900 shadow-2xl relative overflow-hidden group text-left">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] mb-4 italic leading-none text-left">Revenue</p>
                  <h4 className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter leading-none relative z-10 break-all text-left">
                    ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h4>
                </div>

                <div className="bg-slate-50 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-12 text-slate-900 border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all duration-500 text-left">
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] mb-4 italic leading-none text-left">Volume</p>
                  <h4 className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter leading-none text-left">{stats.totalJobs}</h4>
                </div>

                <div className="bg-slate-50 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-12 text-slate-900 border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all duration-500 md:col-span-2 xl:col-span-1 text-left">
                  <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] mb-4 italic leading-none text-left">Average</p>
                  <h4 className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter leading-none break-all text-left">
                    ${stats.avgJobValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </h4>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-hidden rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm text-left">
                <div className="overflow-x-auto scrollbar-hide text-left">
                  <table className="w-full text-left border-collapse bg-white min-w-[900px] text-left">
                    <thead>
                      <tr className="bg-slate-900 text-white border-b-2 border-slate-800 text-left">
                        <th className="p-6 md:p-10 text-[9px] font-black uppercase tracking-[0.3em] italic text-left">Settlement</th>
                        <th className="p-6 md:p-10 text-[9px] font-black uppercase tracking-[0.3em] italic text-left">Profile</th>
                        <th className="p-6 md:p-10 text-[9px] font-black uppercase tracking-[0.3em] italic text-left">Personnel</th>
                        <th className="p-6 md:p-10 text-[9px] font-black uppercase tracking-[0.3em] italic text-right text-left">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-left">
                      {archivedLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50/50 transition-all duration-300 group text-left">
                          <td className="p-6 md:p-10 text-left">
                            <div className="flex flex-col gap-2 text-left">
                              <span className="text-[10px] font-black text-slate-400 italic text-left">
                                {lead.completedAt ? new Date(typeof lead.completedAt === 'string' ? lead.completedAt : lead.completedAt.toDate()).toLocaleDateString() : 'ARCHIVED'}
                              </span>
                              <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full w-fit border border-slate-100 text-left">
                                {getPaymentIcon(lead.paymentMethod)}
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 text-left">{lead.paymentMethod || 'AUTO'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 md:p-10 text-left">
                            <p className="font-black text-slate-900 uppercase italic text-xl md:text-2xl tracking-tighter transition-all group-hover:text-blue-600 leading-none mb-2 text-left">
                              {lead.template?.data?.fullName || `${lead.firstName} ${lead.lastName}`}
                            </p>
                            <p className="text-[9px] text-slate-400 font-black tracking-widest flex items-center gap-2 italic uppercase text-left">
                              <MapPin size={10} className="text-blue-600" /> {lead.address}, {lead.city}
                            </p>
                          </td>
                          <td className="p-6 md:p-10 text-left">
                            <div className="flex items-center gap-3 text-left">
                              <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-300 text-left"><UserCheck size={16}/></div>
                              <p className="text-xs font-black uppercase italic text-slate-900 tracking-wider text-left">
                                {allEmployees.find(e => e.id === lead.assignedTo)?.name || 'Unassigned'}
                              </p>
                            </div>
                          </td>
                          <td className="p-6 md:p-10 text-right text-left">
                            <p className="text-2xl md:text-3xl font-black text-slate-900 italic tracking-tighter leading-none group-hover:text-blue-600 transition-colors text-left">
                              ${Number(lead.total || lead.finalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 text-left">
              {/* Search and Total */}
              <div className="flex flex-col sm:flex-row items-center gap-6 text-left">
                <div className="relative w-full sm:max-w-md text-left">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text" 
                    placeholder="SEARCH DIRECTORY..." 
                    className="w-full pl-16 pr-8 py-5 bg-slate-50 rounded-[2rem] font-black text-xs uppercase italic outline-none border-2 border-transparent focus:border-blue-600 transition-all shadow-inner text-left"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-col text-left">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1 italic leading-none">Total Clients</p>
                  <p className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">{uniqueCustomers.length}</p>
                </div>
              </div>

              {/* Customer Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 text-left">
                {filteredCustomers.map((cust) => {
                  const isExpanded = expandedCustomerId === cust.groupKey;
                  const isRemoving = removingId === cust.groupKey;
                  return (
                    <div 
                      key={cust.groupKey} 
                      className={`group bg-white rounded-[2.5rem] md:rounded-[3.5rem] border-2 transition-all duration-500 overflow-hidden ${isExpanded ? 'border-blue-600 shadow-2xl scale-[1.01]' : 'border-slate-50 hover:border-slate-200 hover:shadow-xl'}`}
                    >
                      <div 
                        onClick={() => setExpandedCustomerId(isExpanded ? null : cust.groupKey)}
                        className="p-6 md:p-8 flex items-center justify-between cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-6 text-left">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 shadow-inner'}`}>
                            <User size={24} />
                          </div>
                          <h3 className={`text-xl sm:text-2xl font-black uppercase italic tracking-tighter leading-none transition-colors ${isExpanded ? 'text-blue-600' : 'text-slate-900 group-hover:text-black'}`}>{cust.displayName}</h3>
                        </div>
                        <div className={`transition-all duration-500 ${isExpanded ? 'rotate-180 text-blue-600' : 'text-slate-200 group-hover:text-slate-400'}`}>
                          <ChevronDown size={24} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-6 md:px-8 pb-10 space-y-8 animate-in slide-in-from-top-4 duration-500 text-left">
                          <div className="grid grid-cols-1 gap-4 text-[11px] font-black text-slate-400 uppercase italic tracking-widest text-left">
                            <span className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-left transition-colors"><Phone size={14} className="text-blue-600"/> {cust.phone || 'NO PHONE'}</span>
                            <span className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-left transition-colors"><Mail size={14} className="text-blue-600"/> {cust.email || 'NO EMAIL'}</span>
                            <span className="flex items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100 text-left transition-colors"><MapPin size={14} className="text-blue-600"/> {cust.address}, {cust.city}</span>
                          </div>
                          <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-100 text-left">
                            <button onClick={() => setEditingLead(cust)} className="flex-1 min-w-[140px] py-5 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 font-black uppercase italic text-[10px] tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all leading-none text-left">Edit</button>
                            <button onClick={() => navigateToSchedule(cust)} className="flex-1 min-w-[140px] py-5 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest hover:bg-blue-600 transition-all leading-none text-left flex items-center justify-center gap-2 shadow-xl shadow-slate-200"><Calendar size={14} className="text-blue-400"/> View Job</button>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => softDeleteClient(cust)} 
                                    disabled={isRemoving}
                                    className="px-8 py-5 bg-white border-2 border-slate-100 rounded-2xl text-slate-200 font-black uppercase italic text-[10px] tracking-widest hover:border-blue-500 hover:text-blue-500 transition-all leading-none text-left flex items-center gap-2"
                                >
                                    {isRemoving ? <Loader2 size={14} className="animate-spin"/> : 'Remove'}
                                </button>
                                <button 
                                    onClick={() => hardDeleteClient(cust)} 
                                    disabled={isRemoving}
                                    className="px-6 py-5 bg-white border-2 border-slate-100 rounded-2xl text-slate-100 font-black uppercase italic text-[10px] tracking-widest hover:border-red-500 hover:text-red-500 transition-all leading-none text-left"
                                    title="PERMANENT DELETE"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
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
      )}

      {/* Edit Modal */}
      {editingLead && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 text-left animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] md:rounded-[4rem] max-w-2xl w-full p-8 md:p-16 shadow-2xl border border-slate-50 relative overflow-y-auto max-h-[90vh] text-left">
            <button onClick={() => setEditingLead(null)} className="absolute top-8 md:top-12 right-8 md:right-12 text-slate-200 hover:text-slate-900 p-2 transition-all hover:rotate-90 z-20"><X size={40}/></button>
            <h2 className="text-4xl md:text-5xl font-black uppercase italic text-slate-900 tracking-tighter mb-12 text-left leading-none">Update <br/><span className="text-slate-200">Client Profile.</span></h2>
            <form onSubmit={handleUpdateCustomer} className="space-y-6 md:space-y-8 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left">
                <input type="text" value={editingLead.firstName || ''} onChange={(e) => setEditingLead({...editingLead, firstName: e.target.value})} className="px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] font-black text-xs focus:ring-2 ring-blue-600 focus:bg-white outline-none transition-all italic text-left shadow-inner" placeholder="FIRST NAME" />
                <input type="text" value={editingLead.lastName || ''} onChange={(e) => setEditingLead({...editingLead, lastName: e.target.value})} className="px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] font-black text-xs focus:ring-2 ring-blue-600 focus:bg-white outline-none transition-all italic text-left shadow-inner" placeholder="LAST NAME" />
              </div>
              <input type="email" value={editingLead.email || ''} onChange={(e) => setEditingLead({...editingLead, email: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] font-black text-xs focus:ring-2 ring-blue-600 focus:bg-white outline-none transition-all italic text-left shadow-inner" placeholder="EMAIL ADDRESS" />
              <input type="tel" value={editingLead.phone || ''} onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] font-black text-xs focus:ring-2 ring-blue-600 focus:bg-white outline-none transition-all italic text-left shadow-inner" placeholder="PHONE NUMBER" />
              <div className="pt-8 flex gap-4 text-left">
                <button type="submit" className="flex-1 py-6 md:py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase italic text-sm tracking-[0.2em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 active:scale-95 leading-none">
                  {isUpdating ? <Loader2 className="animate-spin" size={24}/> : showSuccess ? <Check size={24}/> : <Save size={24}/>} 
                  {showSuccess ? 'Committed' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomerInquiryModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} mode="customer" />
    </div>
  );
}
