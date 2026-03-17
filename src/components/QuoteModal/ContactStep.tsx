'use client';
import React, { useState, useMemo } from 'react';
import { User, Phone, Mail, MapPin, Users, ShieldCheck, Building2, ChevronRight } from 'lucide-react';

// Organized by branch for selective filtering
const BRANCH_CITY_MAP: Record<string, string[]> = {
  'Tri-Cities': ['Kennewick', 'Pasco', 'Richland', 'West Richland', 'Benton City', 'Burbank', 'Finley'],
  'Walla Walla': ['Walla Walla', 'College Place', 'Milton-Freewater', 'Dixie', 'Waitsburg'],
  'Tacoma': ['Tacoma', 'Lakewood', 'University Place', 'Ruston', 'Fircrest', 'Steilacoom'],
  'Puyallup': ['Puyallup', 'Sumner', 'Spanaway', 'Graham', 'South Hill', 'Bonney Lake']
};

const BRANCHES = [
  'Tri-Cities', 'Walla Walla', 'Tacoma', 'Puyallup'
];

interface ContactStepProps {
  formData: any;
  setFormData: (data: any) => void;
  onNext: () => void;
  allEmployees?: any[];
}

export default function ContactStep({ formData, setFormData, onNext, allEmployees = [] }: ContactStepProps) {
  const [isOtherReferral, setIsOtherReferral] = useState(!!formData.referralSource);
  
  const formatPhone = (val: string) => {
    const num = val.replace(/[^\d]/g, '');
    if (num.length < 4) return num;
    if (num.length < 7) return `(${num.slice(0, 3)}) ${num.slice(3)}`;
    return `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6, 10)}`;
  };

  const currentBranchCities = useMemo(() => {
    if (!formData.branch) return [];
    return BRANCH_CITY_MAP[formData.branch] || [];
  }, [formData.branch]);

  const isInvalid = 
    !formData.firstName?.trim() || 
    !formData.lastName?.trim() || 
    formData.phone.length < 14 || 
    !formData.email.includes('@') ||
    (formData.address?.trim().length || 0) < 5 ||
    !formData.city || 
    !formData.branch;

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300 italic">Step 1 of 4 • Contact Details</span>
      </div>

      {/* NAME ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase ml-2 text-slate-400">First Name</label>
          <input 
            type="text" 
            placeholder="First Name" 
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-900"
            value={formData.firstName} 
            onChange={e => setFormData({...formData, firstName: e.target.value})} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase ml-2 text-slate-400">Last Name</label>
          <input 
            type="text" 
            placeholder="Last Name" 
            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-900"
            value={formData.lastName} 
            onChange={e => setFormData({...formData, lastName: e.target.value})} 
          />
        </div>
      </div>

      {/* EMAIL & PHONE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          type="email" 
          placeholder="Email Address" 
          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-900"
          value={formData.email} 
          onChange={e => setFormData({...formData, email: e.target.value})} 
        />
        <input 
          type="tel" 
          placeholder="Phone Number" 
          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-900"
          value={formData.phone} 
          onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})} 
        />
      </div>

      {/* BRANCH SELECTION */}
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase ml-2 text-slate-400">Closest Branch Location</label>
        <div className="relative">
          <select 
            className={`w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-bold appearance-none cursor-pointer
              ${formData.branch ? 'text-slate-900' : 'text-slate-400'}`}
            value={formData.branch}
            onChange={e => {
              const b = e.target.value;
              setFormData({ ...formData, branch: b, city: '' });
            }}
          >
            <option value="" disabled>Select your closest Major Branch...</option>
            {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-900">▼</div>
        </div>
      </div>

      {/* CITY SELECTION dependent on branch */}
      <div className="space-y-1">
        <label className="text-[10px] font-black uppercase ml-2 text-slate-400">City / Service Area</label>
        <div className="relative">
          <select 
            disabled={!formData.branch}
            className={`w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold appearance-none cursor-pointer
              ${!formData.branch ? 'opacity-40 cursor-not-allowed' : ''}
              ${formData.city ? 'text-slate-900' : 'text-slate-400'}`}
            value={formData.city}
            onChange={e => setFormData({...formData, city: e.target.value})}
          >
            <option value="" disabled>{formData.branch ? 'Now select your specific city...' : 'Please select a branch first'}</option>
            {formData.branch && currentBranchCities.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="Other">City Not Listed (Enter Manually)</option>
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
        </div>
      </div>

      {/* OTHER CITY INPUT */}
      {formData.city === 'Other' && (
        <input 
          type="text" 
          placeholder="Enter WA City Name" 
          className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-bold text-slate-900"
          value={formData.otherCity || ''} 
          onChange={e => setFormData({...formData, otherCity: e.target.value})} 
        />
      )}

      {/* ADDRESS */}
      <div className="grid grid-cols-4 gap-2">
        <input 
          placeholder="Service Address" 
          className="col-span-3 w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-900"
          value={formData.address} 
          onChange={e => setFormData({...formData, address: e.target.value})} 
        />
        <input 
          value="WA" 
          disabled 
          className="w-full p-4 bg-slate-200 border border-slate-200 rounded-2xl font-black text-slate-500 text-center"
        />
      </div>

      {/* REFERRALS & STATUS */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <Users size={14} className="text-slate-400" />
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Referrals</label>
          </div>
          <div className="space-y-3">
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-900 appearance-none"
              value={isOtherReferral ? 'OTHER' : (formData.referralEmployee || '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'OTHER') {
                  setIsOtherReferral(true);
                } else {
                  setIsOtherReferral(false);
                  setFormData({ ...formData, referralEmployee: val, referralSource: '' });
                }
              }}
            >
              <option value=""></option>
              <optgroup label="TEAM MEMBERS">
                <option value="Lauren Interdonato">Lauren Interdonato</option>
                {allEmployees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </optgroup>
              <optgroup label="EXTERNAL">
                <option value="OTHER">OTHER / CUSTOMER</option>
              </optgroup>
            </select>

            {isOtherReferral && (
              <input 
                type="text" 
                placeholder="Who referred you? (Customer Name)" 
                className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl outline-none font-bold text-slate-900 animate-in slide-in-from-top-2"
                value={formData.referralSource || ''} 
                onChange={e => setFormData({...formData, referralSource: e.target.value, referralEmployee: ''})} 
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 px-2">
            <ShieldCheck size={14} className="text-slate-400" />
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">Service Status</label>
          </div>
          <button 
            onClick={() => setFormData({...formData, militaryDiscount: !formData.militaryDiscount})}
            className={`w-full flex items-center justify-between p-4 border-2 rounded-2xl transition-all group
              ${formData.militaryDiscount 
                ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-900'}`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className={formData.militaryDiscount ? 'text-white' : 'text-slate-900'} />
              <span className="font-black uppercase italic text-xs tracking-widest">Apply Military Discount (10% Off)</span>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
              ${formData.militaryDiscount ? 'bg-white border-white' : 'bg-white border-slate-200'}`}>
              {formData.militaryDiscount && <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />}
            </div>
          </button>
        </div>
      </div>

      <button 
        disabled={isInvalid} 
        onClick={onNext} 
        className={`w-full py-5 rounded-2xl font-black text-white shadow-xl transition-all uppercase tracking-widest text-lg flex items-center justify-center gap-2
          ${isInvalid ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-brand-blue hover:brightness-110 active:scale-95 shadow-brand-blue/20'}`}
      >
        Services <ChevronRight size={20} />
      </button>
    </div>
  );
}
