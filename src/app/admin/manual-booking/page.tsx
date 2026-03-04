'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Clock, Calendar, DollarSign, Home, User, MapPin, Sparkles, Waves, Droplets, Wind, Plus, Minus, Building2, Sun, Loader2, CheckSquare } from 'lucide-react';
import { startOfDay } from 'date-fns';

const BRANCHES = ['Tri-Cities', 'Walla Walla', 'Tacoma', 'Puyallup'];
const CITIES = [
  'Kennewick', 'Pasco', 'Richland', 'West Richland',
  'Walla Walla', 'College Place', 'Benton City', 'Burbank', 'Finley',
  'Tacoma', 'Puyallup', 'University Place', 'Lakewood', 'Spanaway',
  'Yakima', 'Selah', 'Sunnyside', 'Grandview', 'Prosser', 'Other WA'
];

export default function ManualBooking() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: 'Kennewick',
    branch: 'Tri-Cities' as any,
    totalAmount: '',
    appointmentDate: '',
    timeSlot: 'morning',
    notes: '',
    selectedServices: [] as string[],
    windowCount: 0,
    windowType: 'none',
    homeSize: '1-2',
    stories: 1,
    solarPanelCount: 0,
    gutterFlush: false,
    deluxeGutter: false,
    roofBlowOff: false,
    mossTreatment: false,
    mossAcidWash: false,
    sidingCleaning: false,
    trexWash: false,
    trexDeckSize: 'none',
    cedarFenceRestoration: false,
    fenceSize: 'none',
    backPatio: false,
    patioSize: 'none',
    drivewaySize: 'none',
    militaryDiscount: false,
    deluxeWindow: false
  });

  const SERVICES = [
    { id: 'Window Cleaning', icon: <Sparkles size={16} /> },
    { id: 'Gutter Cleaning', icon: <Droplets size={16} /> },
    { id: 'Roof Cleaning', icon: <Sun size={16} /> },
    { id: 'Pressure Washing', icon: <Waves size={16} /> },
    { id: 'Solar Panel Cleaning', icon: <Sun size={16} /> }
  ];

  const handleServiceToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(id)
        ? prev.selectedServices.filter(s => s !== id)
        : [...prev.selectedServices, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.appointmentDate || !formData.totalAmount) {
      alert("Please fill in the required fields (Name, Date, Amount)");
      return;
    }
    setLoading(true);

    try {
      const startDate = startOfDay(new Date(formData.appointmentDate + 'T00:00:00'));
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const city = formData.city;
      const fullAddress = `${formData.address}, ${city}`;
      
      const leadPayload = {
        ...formData,
        status: 'Confirmed',
        createdAt: serverTimestamp(),
        total: formData.totalAmount,
        selectedDate: Timestamp.fromDate(startDate),
        actualBookedDays: [Timestamp.fromDate(startDate)],
        arrivalWindow: formData.timeSlot === 'morning' ? '8:00 AM' : formData.timeSlot === 'midday' ? '11:30 AM' : '3:00 PM',
        totalMinutes: 120,
        to: [formData.email],
        template: {
          name: 'confirmation',
          data: {
            firstName: formData.firstName,
            fullName: fullName,
            fullAddress: fullAddress,
            date: formData.appointmentDate,
            time: formData.timeSlot === 'morning' ? '8:00 AM' : formData.timeSlot === 'midday' ? '11:30 AM' : '3:00 PM',
            services: formData.selectedServices.join(', '),
            total: formData.totalAmount
          }
        }
      };

      await addDoc(collection(db, "leads"), leadPayload);
      alert("Job booked successfully!");
      setFormData({
        firstName: '', lastName: '', email: '', phone: '', address: '',
        city: 'Kennewick', branch: 'Tri-Cities', totalAmount: '', appointmentDate: '',
        timeSlot: 'morning', notes: '', selectedServices: [],
        windowCount: 0, windowType: 'none', homeSize: '1-2', stories: 1,
        solarPanelCount: 0, gutterFlush: false, deluxeGutter: false, roofBlowOff: false,
        mossTreatment: false, mossAcidWash: false, sidingCleaning: false,
        trexWash: false, trexDeckSize: 'none', cedarFenceRestoration: false,
        fenceSize: 'none', backPatio: false, patioSize: 'none', drivewaySize: 'none',
        militaryDiscount: false, deluxeWindow: false
      });
    } catch (error: any) {
      console.error(error);
      alert("Error booking job: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 md:p-12 max-w-5xl mx-auto space-y-12 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Manual Booking</h1>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-2 italic">Add a job directly to the schedule</p>
        </div>
        <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600"><Plus size={32} /></div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 text-slate-400 mb-2"><User size={18} /><h3 className="text-[10px] font-black uppercase tracking-widest italic">Customer Information</h3></div>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="First Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} required />
              <input type="text" placeholder="Last Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="email" placeholder="Email Address" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <input type="tel" placeholder="Phone Number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <input type="text" placeholder="Service Address" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:ring-2 ring-emerald-500 transition-all" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                {BRANCHES.map(b => <option key={b} value={b}>{b} Branch</option>)}
              </select>
              <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}>
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400 mb-2"><Sparkles size={18} /><h3 className="text-[10px] font-black uppercase tracking-widest italic">Service Breakdown</h3></div>
            <div className="flex flex-wrap gap-3">
              {SERVICES.map(s => (
                <button key={s.id} type="button" onClick={() => handleServiceToggle(s.id)} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${formData.selectedServices.includes(s.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {s.icon} {s.id}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl"><span className="text-[10px] font-black uppercase tracking-widest opacity-50">Windows</span><div className="flex items-center gap-4"><button type="button" onClick={() => setFormData(p => ({...p, windowCount: Math.max(0, p.windowCount - 1)}))}><Minus size={16}/></button><span className="text-lg font-black">{formData.windowCount}</span><button type="button" onClick={() => setFormData(p => ({...p, windowCount: p.windowCount + 1}))}><Plus size={16}/></button></div></div>
                <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl"><span className="text-[10px] font-black uppercase tracking-widest opacity-50">Solar</span><div className="flex items-center gap-4"><button type="button" onClick={() => setFormData(p => ({...p, solarPanelCount: Math.max(0, p.solarPanelCount - 1)}))}><Minus size={16}/></button><span className="text-lg font-black">{formData.solarPanelCount}</span><button type="button" onClick={() => setFormData(p => ({...p, solarPanelCount: p.solarPanelCount + 1}))}><Plus size={16}/></button></div></div>
              </div>
              <div className="space-y-4 text-left">
                <button type="button" onClick={() => setFormData(p => ({...p, deluxeWindow: !p.deluxeWindow}))} className={`w-full p-4 rounded-2xl text-[9px] font-black uppercase border-2 transition-all ${formData.deluxeWindow ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700 text-slate-500'}`}>Deluxe Screen Detail</button>
                <button type="button" onClick={() => setFormData(p => ({...p, gutterFlush: !p.gutterFlush}))} className={`w-full p-4 rounded-2xl text-[9px] font-black uppercase border-2 transition-all ${formData.gutterFlush ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-700 text-slate-500'}`}>Downspout Flush</button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 space-y-6">
            <div className="flex items-center gap-3 text-slate-400 mb-2"><Calendar size={18} /><h3 className="text-[10px] font-black uppercase tracking-widest italic">Schedule & Pricing</h3></div>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Appointment Date</label><input type="date" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none" value={formData.appointmentDate} onChange={e => setFormData({...formData, appointmentDate: e.target.value})} required /></div>
              <div className="grid grid-cols-3 gap-2">
                {['morning', 'midday', 'afternoon'].map(s => (
                  <button key={s} type="button" onClick={() => setFormData({...formData, timeSlot: s})} className={`py-3 rounded-xl text-[8px] font-black uppercase border-2 transition-all ${formData.timeSlot === s ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-50 text-slate-400'}`}>{s === 'morning' ? '8:00 AM' : s === 'midday' ? '11:30 AM' : '3:00 PM'}</button>
                ))}
              </div>
              <div className="space-y-1 pt-4"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Total Job Amount</label><div className="relative"><div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><DollarSign size={18}/></div><input type="number" step="0.01" placeholder="0.00" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-10 font-black text-2xl outline-none focus:ring-2 ring-emerald-500 transition-all" value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} required /></div></div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 space-y-4">
            <textarea placeholder="Technician Notes..." className="w-full bg-white border border-slate-100 rounded-2xl p-6 font-bold text-sm outline-none min-h-[150px] shadow-inner" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
            <button type="submit" disabled={loading} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black uppercase italic tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3">
              {loading ? <Loader2 size={24} className="animate-spin" /> : <CheckSquare size={24} />}
              {loading ? 'Processing...' : 'Confirm & Book Job'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
