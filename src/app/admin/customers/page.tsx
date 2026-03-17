'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, deleteDoc, where, getDocs, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { Search, User, MapPin, Phone, Mail, Users, TrendingUp, Edit2, Trash2, X, Save, Loader2, ChevronDown, ShieldCheck, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CustomerInquiryModal from '../../../components/CustomerInquiryModal';

export default function AdminCustomers() {
  const router = useRouter();
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [referralBank, setReferralBank] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasJustSucceeded, setHasJustSucceeded] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // EDIT MODAL STATE
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const qLeads = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      setAllLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qCrew = query(collection(db, "employees"), orderBy("name", "asc"));
    const unsubCrew = onSnapshot(qCrew, (snapshot) => {
      setAllEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qBank = query(collection(db, "referral_bank"), orderBy("createdAt", "desc"));
    const unsubBank = onSnapshot(qBank, (snapshot) => {
      setReferralBank(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLeads(); unsubCrew(); unsubBank(); };
  }, []);

  const handleUpdateLead = async (e: React.FormEvent) => {
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
        city: editingLead.city || '',
        otherCity: editingLead.otherCity || ''
      });
      setEditingLead(null);
    } catch (err) { console.error(err); }
    finally { setIsUpdating(false); }
  };

  const softDeleteLead = async (cust: any) => {
    setRemovingId(cust.groupKey);
    try {
      const batch = writeBatch(db);
      for (const id of cust.allIds) {
        batch.set(doc(db, "leads", id), {
          hideFromCustomersPage: true
        }, { merge: true });
      }
      await batch.commit();
    }
    catch (error) { 
      console.error("Removal failed:", error); 
    } finally {
      setRemovingId(null);
    }
  };

  const hardDeleteLead = async (cust: any) => {
    if (!window.confirm("PERMANENTLY delete all records for this client? This cannot be undone and employee stats will be lost.")) return;
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

  const uniqueCustomers = useMemo(() => {
    const groups: Record<string, any> = {};
    
    allLeads.forEach(lead => {
      if (lead.hideFromCustomersPage) return;
      
      const firstName = (lead.firstName || '').trim();
      const lastName = (lead.lastName || '').trim();
      const templateName = (lead.template?.data?.fullName || '').trim();
      const name = templateName || `${firstName} ${lastName}`.trim() || 'New Customer';
      
      const key = name.toLowerCase().replace(/\s+/g, ' ');
      
      if (!groups[key]) {
        groups[key] = {
          ...lead,
          displayName: name,
          groupKey: key,
          totalRewards: Number(lead.referralRewardBalance || 0),
          allIds: [lead.id]
        };
      } else {
        groups[key].allIds.push(lead.id);
        groups[key].totalRewards += Number(lead.referralRewardBalance || 0);
        if (!groups[key].email && lead.email) groups[key].email = lead.email;
        if (!groups[key].phone && lead.phone) groups[key].phone = lead.phone;
        if (!groups[key].address && lead.address) groups[key].address = lead.address;
        if (!groups[key].city && lead.city) {
          groups[key].city = lead.city;
          groups[key].otherCity = lead.otherCity;
        }
        if (lead.militaryDiscount) groups[key].militaryDiscount = true;
      }
    });

    return Object.values(groups);
  }, [allLeads]);

  const filteredLeads = uniqueCustomers.filter(cust => {
    const search = searchQuery.toLowerCase();
    const fullName = cust.displayName.toLowerCase();
    const displayCity = (cust.city === 'Other WA' ? cust.otherCity : cust.city) || '';
    return (
      fullName.includes(search) ||
      (cust.phone || '').includes(search) ||
      (cust.address || '').toLowerCase().includes(search) ||
      (displayCity || '').toLowerCase().includes(search) ||
      (cust.email || '').toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen bg-slate-50/50 text-left">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-8 text-left">
        <div className="text-left flex-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-2">Customers</h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] italic flex items-center justify-start gap-2">
            {searchQuery ? `Found: ${filteredLeads.length}` : `Total: ${uniqueCustomers.length}`}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto text-left">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="SEARCH..." className="w-full pl-14 pr-8 py-4 bg-white rounded-2xl font-black text-[10px] uppercase italic shadow-sm outline-none border-2 border-transparent focus:border-blue-600 transition-all text-left" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={() => { setHasJustSucceeded(false); setShowAddModal(true); }} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-[11px] tracking-widest shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 active:scale-95 leading-none"><User size={16} /> Add Customer</button>
        </div>
      </div>

      {/* CUSTOMER LIST */}
      <div className="grid gap-3 text-left">
        {filteredLeads.map((cust) => {
          const name = cust.displayName;
          const displayCity = (cust.city === 'Other WA' ? cust.otherCity : cust.city) || '';
          const isRemoving = removingId === cust.groupKey;
          
          return (
            <div key={cust.groupKey} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center group hover:border-blue-600 hover:shadow-xl transition-all gap-6 text-left">
              <div className="flex items-center gap-6 flex-1 text-left">
                <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all shadow-inner text-left">
                  <User size={24} />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 tracking-tight leading-none mb-3 text-left">{name}</h3>
                  <div className="flex flex-wrap gap-3 mb-4 text-left">
                    {cust.militaryDiscount && <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic shadow-lg shadow-blue-500/20"><ShieldCheck size={10} className="inline mr-1" /> Military</span>}
                    {Number(cust.totalRewards || 0) > 0 && <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic shadow-lg shadow-blue-500/20"><TrendingUp size={10} className="inline mr-1" /> Rewards: {cust.totalRewards}</span>}
                    {(cust.referralSource || cust.referralEmployee) && <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest italic text-left">Ref: {cust.referralSource || allEmployees.find(e => e.id === cust.referralEmployee)?.name || 'Team'}</span>}
                  </div>
                  <div className="flex flex-wrap gap-y-2 gap-x-5 text-[10px] font-black text-slate-400 uppercase italic text-left">
                    <span className="flex items-center gap-2 text-left"><Phone size={12} className="text-blue-600"/> {cust.phone || 'N/A'}</span>
                    <span className="flex items-center gap-2 text-left"><Mail size={12} className="text-blue-600"/> {cust.email || 'N/A'}</span>
                    <span className="flex items-center gap-2 text-left"><MapPin size={12} className="text-blue-600"/> {cust.address || 'N/A'}{displayCity ? `, ${displayCity}` : ''}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-row md:flex-col gap-2 w-full md:w-28 text-left">
                <button onClick={() => setEditingLead(cust)} className="flex-1 px-3 py-3 bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all font-black uppercase italic text-[8px] tracking-widest leading-none text-center">Edit</button>
                <div className="flex flex-1 gap-2 text-left">
                    <button 
                        onClick={() => softDeleteLead(cust)} 
                        disabled={isRemoving}
                        className="flex-1 px-3 py-3 bg-slate-50 text-slate-300 hover:bg-blue-500 hover:text-white rounded-xl transition-all font-black uppercase italic text-[8px] tracking-widest leading-none text-center flex items-center justify-center"
                    >
                        {isRemoving ? <Loader2 size={10} className="animate-spin" /> : 'Remove'}
                    </button>
                    <button 
                        onClick={() => hardDeleteLead(cust)}
                        disabled={isRemoving}
                        className="px-3 py-3 bg-slate-50 text-slate-200 hover:bg-red-500 hover:text-white rounded-xl transition-all text-center"
                        title="Hard Delete"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* REFERRAL BANK */}
      {referralBank.length > 0 && (
        <div className="space-y-6 pt-12 border-t border-slate-200 text-left">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic px-6 text-left">Community Referral Bank</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            {referralBank.map((item, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2rem] border border-orange-100 flex items-center justify-between group shadow-sm text-left">
                <div className="text-left">
                  <p className="font-black text-slate-900 uppercase italic text-lg leading-none tracking-tighter text-left">{item.referrerName}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase mt-2 tracking-widest italic text-left">Reward Waiting • Referred: {item.referredCustomer}</p>
                </div>
                <div className="bg-orange-50 text-orange-600 p-3 rounded-xl shadow-sm text-left"><TrendingUp size={16} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLead && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6 text-left">
          <div className="bg-white rounded-[3rem] max-w-xl w-full p-10 md:p-12 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-300 text-left">
            <button onClick={() => setEditingLead(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-all p-2 bg-slate-50 rounded-full"><X size={24}/></button>
            <div className="space-y-10 text-left">
              <h2 className="text-4xl font-black uppercase italic text-slate-900 tracking-tighter leading-none text-left">Update Customer</h2>
              <form onSubmit={handleUpdateLead} className="grid grid-cols-1 gap-6 text-left">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <input type="text" value={editingLead.firstName || ''} onChange={(e) => setEditingLead({...editingLead, firstName: e.target.value})} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none text-left" placeholder="First Name" />
                  <input type="text" value={editingLead.lastName || ''} onChange={(e) => setEditingLead({...editingLead, lastName: e.target.value})} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none text-left" placeholder="Last Name" />
                </div>
                <input type="email" value={editingLead.email || ''} onChange={(e) => setEditingLead({...editingLead, email: e.target.value})} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none text-left" placeholder="Email" />
                <input type="tel" value={editingLead.phone || ''} onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none text-left" placeholder="Phone" />
                <input type="text" value={editingLead.address || ''} onChange={(e) => setEditingLead({...editingLead, address: e.target.value})} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none text-left" placeholder="Address" />
                <div className="grid grid-cols-2 gap-4 text-left">
                  <input type="text" value={editingLead.city || ''} onChange={(e) => setEditingLead({...editingLead, city: e.target.value})} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none text-left" placeholder="City" />
                  {editingLead.city === 'Other WA' && (
                    <input type="text" value={editingLead.otherCity || ''} onChange={(e) => setEditingLead({...editingLead, otherCity: e.target.value})} className="px-6 py-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-xs outline-none animate-in slide-in-from-top-2 text-left" placeholder="Other City Name" />
                  )}
                </div>
                <div className="pt-4 flex gap-4 text-left">
                  <button type="submit" className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-xl hover:bg-blue-600 transition-all leading-none active:scale-95 text-center">Save Changes</button>
                  <button type="button" onClick={() => setEditingLead(null)} className="px-8 py-5 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase italic text-[10px] tracking-widest leading-none text-center">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <CustomerInquiryModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} mode="customer" />
    </div>
  );
}
