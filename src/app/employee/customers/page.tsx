'use client';
import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Search, User, MapPin, Phone, Calendar, ArrowRight, Mail, ChevronRight, Activity, Zap } from 'lucide-react';
import CustomerInquiryModal from '../../../components/CustomerInquiryModal';

export default function EmployeeCustomers() {
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 1. Fetch the leads from Firebase
  useEffect(() => {
    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsArr = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllLeads(leadsArr);
    });
    return () => unsubscribe();
  }, []);

  // 2. Search Filter
  const filteredLeads = allLeads.filter(lead => {
    if (lead.isReferral) return false;

    const search = searchQuery.toLowerCase();
    const displayName = (lead.template?.data?.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`).toLowerCase();
    
    return (
      displayName.includes(search) ||
      (lead.phone || '').includes(search) ||
      (lead.city || '').toLowerCase().includes(search) ||
      (lead.address || '').toLowerCase().includes(search) ||
      (lead.email || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-12 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">
      
      {/* HEADER MATCHING TERMINAL STYLE */}
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
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Activity size={14} className="text-slate-300" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Active Records</p>
          </div>
          <div className="bg-slate-50 px-5 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase italic tracking-widest">
            {filteredLeads.length} Profiles Cached
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-100">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-2xl">No Profiles in Current Sector</p>
            </div>
          ) : filteredLeads.map((lead) => {
            const displayName = lead.template?.data?.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Anonymous Customer';
            const total = parseFloat(lead.total || lead.finalPrice || lead.template?.data?.totalAmount || '0');
            
            // Safe Date Formatting
            let formattedDate = 'NEW PROFILE';
            if (lead.date && typeof lead.date === 'object' && lead.date.seconds) {
              formattedDate = new Date(lead.date.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } else if (lead.createdAt && lead.createdAt.toDate) {
              formattedDate = lead.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }

            return (
              <div 
                key={lead.id} 
                className="bg-white rounded-[3rem] shadow-xl border-2 border-transparent hover:border-slate-900 transition-all duration-500 overflow-hidden group cursor-pointer hover:shadow-2xl hover:scale-[1.01]"
              >
                <div className="p-8 md:p-10 flex flex-col xl:flex-row items-center justify-between gap-10">
                  <div className="flex items-center gap-8 w-full xl:w-auto">
                    <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center shrink-0 shadow-inner transition-all duration-500 group-hover:bg-slate-900 group-hover:text-white text-slate-400">
                      <User size={32} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="font-black text-slate-900 text-3xl md:text-4xl uppercase italic leading-none tracking-tighter group-hover:text-slate-900 transition-colors">
                          {displayName}
                        </h3>
                        <span className="px-4 py-1.5 bg-slate-50 text-slate-400 rounded-full text-[8px] font-black uppercase italic tracking-widest shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all">
                          {lead.status || 'Active'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-slate-900 transition-colors"><Phone size={14}/></div>
                          <p className="text-[10px] font-black text-slate-900 uppercase italic">{lead.phone || 'NO PHONE'}</p>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-slate-900 transition-colors"><Mail size={14}/></div>
                            <p className="text-[10px] font-black text-slate-900 lowercase italic">{lead.email}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-3 lg:col-span-2">
                          <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-slate-900 transition-colors"><MapPin size={14}/></div>
                          <p className="text-[10px] font-black text-slate-900 uppercase italic truncate max-w-[200px]">
                            {lead.address}{lead.city ? `, ${lead.city}` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12 w-full xl:w-auto justify-between xl:justify-end border-t xl:border-t-0 border-slate-50 pt-8 xl:pt-0">
                    <div className="text-left xl:text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase italic mb-1 tracking-widest">Enrollment</p>
                      <p className="text-xl font-black text-slate-900 italic tracking-tighter leading-none uppercase">{formattedDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase italic mb-1 tracking-widest">Yield</p>
                      <p className="text-4xl font-black text-slate-900 italic tracking-tighter leading-none">${total.toFixed(0)}</p>
                    </div>
                    <div className="hidden xl:block text-slate-100 group-hover:text-slate-900 transition-all duration-500">
                      <ChevronRight size={40} />
                    </div>
                  </div>
                </div>
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
