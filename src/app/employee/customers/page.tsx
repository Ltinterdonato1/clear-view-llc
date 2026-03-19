'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Search, User, MapPin, Phone, Calendar, ArrowRight, Mail, 
  ChevronRight, Activity, Zap, Star, RefreshCw, Loader2, X, ChevronDown, Clock, Banknote
} from 'lucide-react';
import CustomerInquiryModal from '../../../components/CustomerInquiryModal';

export default function EmployeeCustomers() {
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 1. Fetch the leads from Firebase
  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsArr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllLeads(leadsArr);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Directory Logic (Grouping and Referrals)
  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    
    allLeads.forEach(j => {
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
    allLeads.forEach(j => {
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
  }, [allLeads]);

  // 3. Search Filter
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

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-6">
      <Loader2 className="animate-spin text-slate-200" size={64} />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Reading Terminal...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-12 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-end items-center gap-8 border-b border-slate-100 pb-12">
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto items-center">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="SEARCH REGISTRY..." 
              className="w-full pl-14 pr-8 py-5 bg-slate-50 rounded-[1.5rem] font-black text-[10px] uppercase italic outline-none border-2 border-transparent focus:border-slate-900 transition-all shadow-sm" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="group px-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase italic text-xs tracking-widest shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <User size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            Add Customer
          </button>
        </div>
      </div>

      {/* CUSTOMER LIST */}
      <div className="space-y-8">
        <div className="flex items-center justify-end px-6">
          <div className="bg-slate-50 px-5 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase italic tracking-widest">
            {filteredCustomers.length} Customers
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-100">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-2xl">No Profiles in Current Sector</p>
            </div>
          ) : filteredCustomers.map((cust) => {
            const isExpanded = expandedCustomerId === cust.groupKey;
            
            return (
              <div 
                key={cust.groupKey} 
                className={`bg-white rounded-[3rem] shadow-xl border-2 transition-all duration-500 overflow-hidden group
                  ${isExpanded ? 'border-slate-900 shadow-2xl scale-[1.01]' : 'border-transparent hover:border-slate-900 hover:shadow-2xl hover:scale-[1.01]'}`}
              >
                <div 
                  onClick={() => setExpandedCustomerId(isExpanded ? null : cust.groupKey)}
                  className="p-8 md:p-10 flex flex-col items-center justify-between gap-10 cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row items-center gap-8 w-full">
                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner transition-all duration-500
                      ${isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}
                    >
                      <User size={32} />
                    </div>
                    
                    <div className="flex-1 space-y-4 text-center md:text-left">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <h3 className="font-black text-slate-900 text-3xl md:text-4xl uppercase italic leading-none tracking-tighter">
                          {cust.displayName}
                        </h3>
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

                    <div className="hidden md:flex flex-col items-end gap-4">
                        <div className={`transition-all duration-500 ${isExpanded ? 'rotate-180 text-slate-900' : 'text-slate-100 group-hover:text-slate-900'}`}>
                            <ChevronDown size={40} />
                        </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-8 md:p-10 pb-12 space-y-8 animate-in slide-in-from-top-4 duration-500 border-t border-slate-50 pt-10 text-left">
                    {/* Renewal Control Buttons */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 italic">Subscription Management</p>
                      <div className="flex flex-wrap gap-4">
                          <button 
                              onClick={() => updateRenewalFrequency(cust, 3)}
                              className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all border-2 ${cust.renewalFrequency === 3 ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-600'}`}
                          >
                              3 Month Renewal (25% Off)
                          </button>
                          <button 
                              onClick={() => updateRenewalFrequency(cust, 6)}
                              className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all border-2 ${cust.renewalFrequency === 6 ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-600'}`}
                          >
                              6 Month Renewal (20% Off)
                          </button>
                          <button 
                              onClick={() => updateRenewalFrequency(cust, null)}
                              className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase italic transition-all border-2 ${!cust.renewalFrequency ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-500'}`}
                          >
                              None / One-Time
                          </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-8 border-t border-slate-50 text-left">
                      <div className="flex-1 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Client Intelligence</p>
                        <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                          "{cust.displayName} is currently showing {cust.jobCount} previous service missions with a total sector yielded return of ${cust.lifetimeValue.toFixed(2)}."
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CustomerInquiryModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
    </div>
  );
}
