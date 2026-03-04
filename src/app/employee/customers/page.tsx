'use client';
import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Search, User, MapPin, Phone, Calendar, ArrowRight, Mail } from 'lucide-react';
import CustomerInquiryModal from '../../../components/CustomerInquiryModal'; // Corrected import path and component name

export default function EmployeeCustomers() {
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 1. Fetch the leads from Firebase to show in the list
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
    // Hide referrals from the customer registry
    if (lead.isReferral) return false;

    const search = searchQuery.toLowerCase();
    const fullName = `${lead.firstName || ''} ${lead.lastName || ''}`.toLowerCase();
    
    return (
      fullName.includes(search) ||
      (lead.phone || '').includes(search) ||
      (lead.city || '').toLowerCase().includes(search) ||
      (lead.address || '').toLowerCase().includes(search) ||
      (lead.email || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-slate-50">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">Customers</h1>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="bg-blue-600 text-white px-10 py-5 rounded-3xl font-black uppercase italic text-sm shadow-xl hover:bg-blue-700 transition-all"
        >
          + Referral
        </button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by name or phone..."
          className="w-full p-6 pl-16 bg-white rounded-[2rem] shadow-sm border border-slate-100 font-bold outline-none focus:ring-4 focus:ring-blue-500/5"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition-all">
            <div className="flex items-center gap-6">
              <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                <User size={24} />
              </div>
              <div>
                                 <h3 className="text-xl font-black uppercase italic text-slate-900">{lead.firstName} {lead.lastName}</h3>
                                <div className="flex gap-4 mt-1 text-[11px] font-bold text-slate-400 uppercase">
                                   <span className="flex items-center gap-1"><Phone size={12}/> {lead.phone}</span>
                                   {lead.email && <span className="flex items-center gap-1"><Mail size={12}/> {lead.email}</span>}
                                   {lead.address && <span className="flex items-center gap-1"><MapPin size={12}/> {lead.address}{lead.city ? `, ${lead.city}` : ''}</span>}
                                   {lead.serviceType && <span className="flex items-center gap-1"><ArrowRight size={12}/> {lead.serviceType}</span>}
                                   {lead.date && <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(lead.date.seconds * 1000).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">              <p className="text-[10px] font-black text-slate-400 uppercase">Total</p>
              <p className="text-2xl font-black italic text-slate-900">${lead.totalAmount || '0'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Renders the CustomerModal */}
      <CustomerInquiryModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
      />
    </div>
  );
}
