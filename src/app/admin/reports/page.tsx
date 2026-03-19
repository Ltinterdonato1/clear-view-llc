'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../../lib/firebase'; 
import { collection, query, onSnapshot, getDocs, orderBy, doc, deleteDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
  Users, User, Search, Phone, Mail, MapPin, 
  ChevronDown, Calendar, Receipt, DollarSign, 
  TrendingUp, Activity, ArrowRight, Loader2, X, Trash2, Save, Check, Plus, RefreshCw, Star, Clock, Banknote
} from 'lucide-react';
import CustomerInquiryModal from '../../../components/CustomerInquiryModal';

export default function AdminReports() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'reports' | 'directory'>('reports');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });

    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubscribeLeads = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubscribeAuth(); unsubscribeLeads(); };
  }, [router]);

  // --- STATISTICS CALCULATION ---
  const stats = useMemo(() => {
    const completed = jobs.filter(j => j.status === 'Archived' || j.status === 'Completed');
    const revenue = completed.reduce((sum, j) => sum + (parseFloat(j.total || j.finalPrice || j.template?.data?.totalAmount || '0')), 0);
    const avgTicket = completed.length > 0 ? revenue / completed.length : 0;
    
    const now = new Date();
    const thisMonth = completed.filter(j => {
      const d = j.completedAt ? new Date(j.completedAt) : null;
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    
    return {
      totalRevenue: revenue,
      totalJobs: jobs.length,
      completedJobs: completed.length,
      avgTicket,
      thisMonthRevenue: thisMonth.reduce((sum, j) => sum + (parseFloat(j.total || j.finalPrice || j.template?.data?.totalAmount || '0')), 0)
    };
  }, [jobs]);

  // --- DIRECTORY LOGIC ---
  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    
    jobs.forEach(j => {
      if (j.isNotification) return;
      if (j.hideFromCustomersPage) return;

      const key = (j.email || j.phone || `${j.firstName}-${j.lastName}`).toLowerCase().trim();
      const revenue = parseFloat(j.total || j.finalPrice || j.template?.data?.totalAmount || '0');

      if (!map.has(key)) {
        map.set(key, {
          ...j,
          groupKey: key,
          displayName: j.template?.data?.fullName || `${j.firstName} ${j.lastName}`,
          jobCount: 1,
          lifetimeValue: revenue,
          renewalFrequency: j.renewalFrequency || null,
          referralCount: 0,
          leadIds: [j.id],
          lastServiceDate: j.completedAt || j.selectedDate || j.createdAt
        });
      } else {
        const existing = map.get(key);
        existing.jobCount += 1;
        existing.lifetimeValue += revenue;
        existing.leadIds.push(j.id);
        if (j.renewalFrequency && !existing.renewalFrequency) {
            existing.renewalFrequency = j.renewalFrequency;
        }
        // Update last service date if this lead is newer
        const currentLast = new Date(existing.lastServiceDate?.toDate?.() || existing.lastServiceDate).getTime();
        const thisLeadDate = new Date(j.completedAt || j.selectedDate?.toDate?.() || j.selectedDate || j.createdAt?.toDate?.() || j.createdAt).getTime();
        if (thisLeadDate > currentLast) {
            existing.lastServiceDate = j.completedAt || j.selectedDate || j.createdAt;
        }
      }
    });

    // Calculate Referral Counts
    jobs.forEach(j => {
        if (j.referralSourceEmail) {
            const refKey = j.referralSourceEmail.toLowerCase().trim();
            if (map.has(refKey)) {
                map.get(refKey).referralCount += 1;
            }
        } else if (j.referralSourceName) {
            const refName = j.referralSourceName.toLowerCase().trim();
            for (let cust of map.values()) {
                if (cust.displayName.toLowerCase().trim() === refName) {
                    cust.referralCount += 1;
                    break;
                }
            }
        }
    });

    return Array.from(map.values());
  }, [jobs]);

  const filteredCustomers = uniqueCustomers.filter(c => {
    const s = searchQuery.toLowerCase();
    return c.displayName.toLowerCase().includes(s) || 
           (c.phone || '').includes(s) || 
           (c.email || '').toLowerCase().includes(s) ||
           (c.address || '').toLowerCase().includes(s);
  });

  const updateRenewalFrequency = async (cust: any, freq: number | null) => {
    setIsUpdating(true);
    try {
        for (const leadId of cust.leadIds) {
            await updateDoc(doc(db, "leads", leadId), { renewalFrequency: freq });
        }
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) { console.error(err); }
    finally { setIsUpdating(false); }
  };

  const formatDate = (dateInput: any) => {
    if (!dateInput) return 'N/A';
    try {
        const d = new Date(dateInput?.toDate ? dateInput.toDate() : dateInput);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return 'N/A';
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    setIsUpdating(true);
    try {
      const updates = {
        firstName: editingLead.firstName,
        lastName: editingLead.lastName,
        email: editingLead.email,
        phone: editingLead.phone
      };

      for (const leadId of editingLead.leadIds) {
        await updateDoc(doc(db, "leads", leadId), updates);
      }

      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); setEditingLead(null); }, 2000);
    } catch (err) { console.error(err); }
    finally { setIsUpdating(false); }
  };

  const softDeleteClient = async (cust: any) => {
    if (!window.confirm("Archive this client directory entry? This will hide them from the registry but keep their job history.")) return;
    setRemovingId(cust.groupKey);
    try {
        for (const leadId of cust.leadIds) {
            await updateDoc(doc(db, "leads", leadId), { hideFromCustomersPage: true });
        }
    } catch (err) { console.error(err); }
    finally { setRemovingId(null); }
  };

  const hardDeleteClient = async (cust: any) => {
    if (!window.confirm("DANGER: This will permanently delete ALL job history and records for this customer. This cannot be undone. Proceed?")) return;
    setRemovingId(cust.groupKey);
    try {
        for (const leadId of cust.leadIds) {
            await deleteDoc(doc(db, "leads", leadId));
        }
    } catch (err) { console.error(err); }
    finally { setRemovingId(null); }
  };

  const navigateToSchedule = (cust: any) => {
    const latestId = cust.leadIds[0];
    const latest = jobs.find(j => j.id === latestId);
    if (latest && latest.selectedDate) {
        const d = latest.selectedDate.toDate?.() || new Date(latest.selectedDate);
        router.push(`/admin/schedule?date=${d.toISOString().split('T')[0]}&highlight=${latest.id}`);
    } else {
        router.push('/admin/schedule');
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-6">
      <Loader2 className="animate-spin text-slate-200" size={64} />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Compiling Intelligence...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-12 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 pb-12 gap-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('reports')}
              className={`p-4 rounded-2xl transition-all ${activeTab === 'reports' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-200 hover:text-slate-400 hover:bg-slate-50'}`}
            >
              <TrendingUp size={24} />
            </button>
            <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-500 ${activeTab === 'reports' ? 'text-slate-900' : 'text-slate-200'}`}>Reports</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('directory')}
              className={`p-4 rounded-2xl transition-all ${activeTab === 'directory' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-200 hover:text-slate-400 hover:bg-slate-50'}`}
            >
              <Users size={24} />
            </button>
            <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-500 ${activeTab === 'directory' ? 'text-slate-900' : 'text-slate-200'}`}>Directory</span>
          </div>
        </div>

        {activeTab === 'directory' && (
            <button 
                onClick={() => setShowAddModal(true)}
                className="group px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl hover:scale-105"
            >
                <Plus size={16} className="group-hover:rotate-90 transition-transform"/>
                Add Customer
            </button>
        )}
      </div>

      {activeTab === 'reports' ? (
        <div className="space-y-12 animate-in fade-in duration-700">
          {/* STATS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-10">
            <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-xl space-y-6 hover:border-slate-900 transition-all duration-500">
              <div className="bg-slate-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                <DollarSign size={28} />
              </div>
              <div>
                <p className="text-5xl font-black text-slate-900 italic tracking-tighter leading-none">${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">Lifetime Total</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-xl space-y-6 hover:border-blue-600 transition-all duration-500">
              <div className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                <Activity size={28} />
              </div>
              <div>
                <p className="text-5xl font-black text-slate-900 italic tracking-tighter leading-none">{stats.completedJobs}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">Success Missions</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-xl space-y-6 hover:border-emerald-500 transition-all duration-500">
              <div className="bg-emerald-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-5xl font-black text-slate-900 italic tracking-tighter leading-none">${stats.avgTicket.toFixed(0)}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">Avg. Mission Val.</p>
              </div>
            </div>

            <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl space-y-6 relative overflow-hidden group">
              <div className="bg-emerald-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner relative z-10">
                <Receipt size={28} />
              </div>
              <div className="relative z-10">
                <p className="text-5xl font-black italic tracking-tighter leading-none text-emerald-400 transition-colors group-hover:text-white">${stats.thisMonthRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-3 italic">Monthly Intelligence</p>
              </div>
              <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div className="space-y-8 text-left">
              {/* Search and Total */}
              <div className="flex flex-col sm:flex-row items-center gap-6 text-left">
                <div className="relative w-full sm:max-w-md text-left">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text" 
                    placeholder="SEARCH DIRECTORY..." 
                    className="w-full pl-14 pr-8 py-5 bg-slate-50 rounded-[2rem] font-black text-xs uppercase italic outline-none border-2 border-transparent focus:border-blue-600 transition-all shadow-inner text-left"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-col text-left">
                  <p className="text-slate-400 font-black uppercase text-[8px] tracking-[0.4em] mb-1 italic leading-none">Total Clients</p>
                  <p className="text-2xl font-black text-slate-900 italic tracking-tighter leading-none">{uniqueCustomers.length}</p>
                </div>
              </div>

              {/* Customer Grid */}
              <div className="grid grid-cols-1 gap-6 text-left">
                {filteredCustomers.map((cust) => {
                  const isExpanded = expandedCustomerId === cust.groupKey;
                  const isRemoving = removingId === cust.groupKey;
                  return (
                    <div 
                      key={cust.groupKey} 
                      className={`group bg-white rounded-[3rem] border-2 transition-all duration-500 overflow-hidden ${isExpanded ? 'border-blue-600 shadow-2xl scale-[1.01]' : 'border-slate-50 hover:border-slate-200 hover:shadow-xl'}`}
                    >
                      <div 
                        onClick={() => setExpandedCustomerId(isExpanded ? null : cust.groupKey)}
                        className="p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-10 cursor-pointer text-left"
                      >
                        <div className="flex flex-col md:flex-row items-center gap-8 w-full">
                          <div className={`h-20 w-20 rounded-[2rem] flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 shadow-inner'}`}>
                            <User size={32} />
                          </div>
                          <div className="flex-1 space-y-4 text-center md:text-left">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <h3 className={`text-xl sm:text-2xl font-black uppercase italic tracking-tighter leading-none transition-colors ${isExpanded ? 'text-blue-600' : 'text-slate-900 group-hover:text-black'}`}>{cust.displayName}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-[8px] font-black uppercase italic tracking-widest border border-emerald-100 shadow-sm">
                                        <Star size={10} fill="currentColor" /> {cust.referralCount} Referrals
                                    </span>
                                    {cust.renewalFrequency && (
                                        <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[8px] font-black uppercase italic tracking-widest border border-blue-100 flex items-center gap-1 shadow-sm">
                                            <RefreshCw size={10} /> {cust.renewalFrequency} Month Renewal
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* LINE 1: CONTACT INFO */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-8 gap-y-3 text-slate-400">
                                <div className="flex items-center gap-2">
                                    <Phone size={14} className="text-blue-600" />
                                    <p className="text-[10px] font-black text-slate-900 uppercase italic">{cust.phone || 'NO PHONE'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-blue-600" />
                                    <p className="text-[10px] font-black text-slate-900 lowercase italic">{cust.email || 'NO EMAIL'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-blue-600" />
                                    <p className="text-[10px] font-black text-slate-900 uppercase italic">
                                        {cust.address}{cust.city ? `, ${cust.city}` : ''}
                                    </p>
                                </div>
                            </div>

                            {/* LINE 2: SERVICE SUMMARY */}
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-10 gap-y-3 pt-2 border-t border-slate-50">
                                <div className="flex items-center gap-3">
                                    <Clock size={14} className="text-slate-300" />
                                    <span className="text-[9px] font-black text-slate-300 uppercase italic tracking-widest">Last Service:</span>
                                    <p className="text-[11px] font-black text-slate-900 uppercase italic tracking-tighter">{formatDate(cust.lastServiceDate)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Banknote size={14} className="text-slate-300" />
                                    <span className="text-[9px] font-black text-slate-300 uppercase italic tracking-widest">Total:</span>
                                    <p className="text-xl font-black text-blue-600 italic tracking-tighter leading-none">${cust.lifetimeValue.toFixed(2)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Activity size={14} className="text-slate-300" />
                                    <span className="text-[9px] font-black text-slate-300 uppercase italic tracking-widest">Missions:</span>
                                    <p className="text-[11px] font-black text-slate-900 uppercase italic">{cust.jobCount}</p>
                                </div>
                            </div>
                          </div>
                        </div>
                        <div className={`transition-all duration-500 ${isExpanded ? 'rotate-180 text-blue-600' : 'text-slate-200 group-hover:text-slate-400'}`}>
                          <ChevronDown size={40} />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-8 md:p-10 pb-12 space-y-8 animate-in slide-in-from-top-4 duration-500 text-left border-t border-slate-50 pt-10">
                          {/* Renewal Control Buttons */}
                          <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4 italic">Subscription Management</p>
                            <div className="flex flex-wrap gap-3">
                                <button 
                                    onClick={() => updateRenewalFrequency(cust, 3)}
                                    className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all border-2 ${cust.renewalFrequency === 3 ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-600'}`}
                                >
                                    3 Month Renewal (25% Off)
                                </button>
                                <button 
                                    onClick={() => updateRenewalFrequency(cust, 6)}
                                    className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all border-2 ${cust.renewalFrequency === 6 ? 'bg-blue-600 border-blue-600 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-600'}`}
                                >
                                    6 Month Renewal (20% Off)
                                </button>
                                <button 
                                    onClick={() => updateRenewalFrequency(cust, null)}
                                    className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all border-2 ${!cust.renewalFrequency ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-red-500'}`}
                                >
                                    None / One-Time
                                </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-100 text-left">
                            <button onClick={() => setEditingLead(cust)} className="flex-1 min-w-[140px] py-5 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 font-black uppercase italic text-[10px] tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all leading-none text-left flex items-center justify-center gap-2">Edit</button>
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
