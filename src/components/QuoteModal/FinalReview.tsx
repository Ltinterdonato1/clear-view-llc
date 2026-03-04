'use client';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ArrowRight, Droplets, Sparkles, Wind, MapPin, Waves, Users } from 'lucide-react';
import { format, isValid, addDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

export default function FinalReview({ formData, setFormData, stats, onNext, onBack, bookedTimestamps }: any) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Logic to separate Tax from other line items for the requested display order
  const taxItem = stats.lineItems.find((item: any) => item.name.toLowerCase().includes('tax'));
  const taxAmount = taxItem ? Number(taxItem.price) : 0;
  
  const finalTotal = Number(stats?.total) || 0; 
  const totalDiscounts = stats?.discounts?.reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0) || 0;
  
  // Service Subtotal is everything except tax and before discounts
  const serviceSubtotal = stats.lineItems
    .filter((item: any) => !item.name.toLowerCase().includes('tax'))
    .reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0);

  useEffect(() => {
    const fetchEmployees = async () => {
      const q = query(collection(db, "employees"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchEmployees();
  }, []);

  const getTimeLabel = (slotId: string) => {
    const slots: Record<string, string> = {
      'morning': '8:00 AM Start',
      'midday': '11:30 AM Start',
      'afternoon': '3:00 PM Start'
    };
    return slots[slotId] || 'Morning Window';
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return isValid(d) ? format(d, 'MMM do') : 'TBD';
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto py-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-2">Final Review</h2>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] italic">Confirm your details and schedule</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Edit Order
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Customer & Services */}
        <div className="lg:col-span-7 space-y-6">
          {/* CUSTOMER CARD */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[5rem] -mr-16 -mt-16 group-hover:bg-blue-50 transition-colors" />
            <div className="relative flex items-start gap-6">
              <div className="p-4 bg-slate-900 rounded-2xl text-white shadow-xl"><Users size={24} /></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Service Property</p>
                <h3 className="text-2xl font-black text-slate-900 leading-tight uppercase italic">{formData.firstName} {formData.lastName}</h3>
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={14} className="text-blue-600" /> {formData.address}, {formData.city === 'Other' ? formData.otherCity : formData.city}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{formData.email} • {formData.phone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SERVICES LIST */}
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 italic relative">Selected Services</p>
            <div className="space-y-4 relative">
              {stats.lineItems.filter((item: any) => !item.name.toLowerCase().includes('tax')).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0 group">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-150 transition-transform" />
                    <span className="font-black uppercase italic tracking-tight text-sm text-slate-200">{item.name}</span>
                  </div>
                  <span className="font-black italic text-blue-400">$ {Number(item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Schedule & Payment */}
        <div className="lg:col-span-5 space-y-6">
          {/* ARRIVAL SCHEDULE */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 italic text-center">Arrival Windows</p>
            <div className="space-y-3">
              {/* Day 1 */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex justify-between items-center group">
                <div>
                  <p className="text-[8px] font-black text-blue-600 uppercase italic mb-1">Day 1</p>
                  <p className="text-lg font-black text-slate-900 uppercase italic leading-none">{formatDate(formData.selectedDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Start Window</p>
                  <p className="text-xs font-black text-slate-900 uppercase italic">{getTimeLabel(formData.timeSlot)}</p>
                </div>
              </div>

              {/* Day 2 (if required) */}
              {stats.daysRequired >= 2 && (
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex justify-between items-center group">
                  <div>
                    <p className="text-[8px] font-black text-blue-600 uppercase italic mb-1">Day 2</p>
                    <p className="text-lg font-black text-slate-900 uppercase italic leading-none">{formatDate(formData.endDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Start Window</p>
                    <p className="text-xs font-black text-slate-900 uppercase italic">{getTimeLabel(formData.endSlot)}</p>
                  </div>
                </div>
              )}

              {/* Day 3+ (if required) */}
              {stats.daysRequired >= 3 && Array.from({ length: stats.daysRequired - 2 }).map((_, i) => (
                <div key={i} className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex justify-between items-center group">
                  <div>
                    <p className="text-[8px] font-black text-blue-600 uppercase italic mb-1">Day {i + 3}</p>
                    <p className="text-lg font-black text-slate-900 uppercase italic leading-none">{formatDate(formData.additionalDates?.[i])}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Start Window</p>
                    <p className="text-xs font-black text-slate-900 uppercase italic">{getTimeLabel(formData.additionalSlots?.[i] || 'morning')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TOTAL CARD */}
          <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-16 -mt-16" />
            <div className="relative space-y-4">
              <div className="flex justify-between items-center text-blue-100">
                <span className="text-[10px] font-black uppercase tracking-widest italic">Subtotal</span>
                <span className="font-black italic text-white">$ {serviceSubtotal.toFixed(2)}</span>
              </div>
              
              {/* Sales Tax placed after Subtotal */}
              {taxAmount > 0 && (
                <div className="flex justify-between items-center text-blue-100">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">Sales Tax (8.5%)</span>
                  <span className="font-black italic text-white">+ $ {taxAmount.toFixed(2)}</span>
                </div>
              )}

              {/* Discounts placed after Tax */}
              {stats.discounts.map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-blue-100">
                  <span className="text-[10px] font-black uppercase tracking-widest italic">{d.name}</span>
                  <span className="font-black italic text-emerald-300">- $ {Number(d.amount).toFixed(2)}</span>
                </div>
              ))}
              
              <div className="pt-4 border-t border-white/10">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1 italic leading-none">Total Due At Service</p>
                <p className="text-5xl font-black italic tracking-tighter leading-none">$ {finalTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <button
            onClick={onNext}
            disabled={isSubmitting}
            className="w-full py-8 bg-slate-900 hover:bg-blue-700 text-white rounded-[2.5rem] font-black uppercase italic text-xl transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {isSubmitting ? 'Processing...' : 'Book Now'} <ArrowRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
