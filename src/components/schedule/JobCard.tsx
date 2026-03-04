'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { doc, Timestamp, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  MapPin, Clock, CheckSquare, Mail, Lock, Unlock, ArrowRight, X,
  UserPlus, UserCheck, Activity, Smartphone, Sparkles, Waves, Droplets, Trash2, RefreshCw, Loader2, Info, Sun, Edit2, ChevronUp, ChevronDown
} from 'lucide-react';
import { normalizeSlot, calculateJobStats, TIME_SLOT_MAP } from '../../lib/scheduleUtils';
import { startOfDay, format, isValid } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

interface JobCardProps {
  job: any;
  isAdmin: boolean;
  allEmployees?: any[];
  unlockedJobs?: Set<string>;
  isUpdating?: string | null;
  toggleLock?: (jobId: string) => void;
  updateJob?: (id: string, currentJobData: any, updates: any, bypassLock?: boolean) => Promise<void>;
  deleteJob?: (id: string) => Promise<void>;
  setCompletingJob: (job: any) => void;
  userEmail?: string | null;
  currentDayTime: number;
  isNearby?: boolean;
  initialExpanded?: boolean;
  onDeleteSuccess?: () => void;
}

const JobCard: React.FC<JobCardProps> = ({
  job,
  isAdmin,
  allEmployees = [],
  unlockedJobs = new Set(),
  toggleLock,
  updateJob,
  deleteJob,
  setCompletingJob,
  initialExpanded = false,
}) => {
  const mStats = calculateJobStats(job);
  const isUnlocked = unlockedJobs.has(job.id);
  const assignedMember = allEmployees.find(e => e.id === job.assignedTo);
  
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [assignRef] = [useRef<HTMLDivElement>(null)];
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isSendingConf, setIsSendingConf] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [confSent, setConfSent] = useState(false);

  // Editable email state
  const [recipientEmail, setRecipientEmail] = useState(job.email || job.customerEmail || '');
  const [isEditingEmail, setIsEditingEmail] = useState(false);

  useEffect(() => { setIsExpanded(initialExpanded); }, [initialExpanded]);
  useEffect(() => { 
    setRecipientEmail(job.email || job.customerEmail || ''); 
  }, [job.email, job.customerEmail]);

  const arrivalTime = useMemo(() => {
    return TIME_SLOT_MAP[normalizeSlot(job.timeSlot)] || '8:00 AM';
  }, [job.timeSlot]);

  const displayCity = job.city === 'Other WA' ? job.otherCity : job.city;
  const fullAddress = `${job.address || ''}, ${displayCity || ''}`;

  const getSafeDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d.toDate === 'function') return d.toDate();
    const parsed = new Date(d);
    return isValid(parsed) ? parsed : null;
  };

  const handleEmailUpdate = async () => {
    setIsEditingEmail(false);
    const newEmail = recipientEmail.trim().toLowerCase();
    if (!newEmail || newEmail === (job.email || '').toLowerCase()) return;
    
    try {
      await updateDoc(doc(db, "leads", job.id), { email: newEmail });
    } catch (err) { console.error("Error updating email:", err); }
  };

  const sendInvoiceEmail = async () => {
    const finalEmail = recipientEmail.trim().toLowerCase();
    if (!finalEmail) { alert("Please provide a valid email address."); return; }
    
    setIsSendingInvoice(true);
    try {
      const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
      const result = await createStripeCheckout({
        amount: parseFloat(mStats.total),
        leadId: job.id,
        customerEmail: finalEmail,
        customerName: `${job.firstName} ${job.lastName}`
      });

      const data = result.data as { url: string };
      if (data.url) {
        const subtotal = mStats.lineItems.filter((item: any) => !item.name.toLowerCase().includes('tax')).reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0);
        const discount = mStats.discounts.reduce((acc: any, d: any) => acc + d.amount, 0);

        await addDoc(collection(db, "mail"), {
          to: [finalEmail, 'clearview3cleaners@gmail.com'],
          template: {
            name: 'invoice',
            data: {
              firstName: job.firstName,
              fullAddress: fullAddress,
              date: format(getSafeDate(job.selectedDate) || new Date(), 'EEEE, MMMM do'),
              time: arrivalTime,
              serviceBreakdown: job.selectedServices?.join('\n') || 'Cleaning Services',
              subtotal: subtotal.toFixed(2),
              discountAmount: discount.toFixed(2),
              balanceDue: mStats.total,
              url: data.url
            }
          }
        });

        setInvoiceSent(true); 
        setTimeout(() => setInvoiceSent(false), 3000);
        setIsSendingInvoice(false);
        alert(`Invoice sent successfully to ${finalEmail}`);
      }
    } catch (err: any) { 
      console.error(err); 
      alert("Failed to send invoice: " + err.message); 
      setIsSendingInvoice(false);
    }
  };

  const resendConfirmation = async () => {
    const finalEmail = recipientEmail.trim().toLowerCase();
    if (!finalEmail) { alert("Please provide a valid email address."); return; }
    setIsSendingConf(true);
    try {
      const subtotal = mStats.lineItems.filter((item: any) => !item.name.toLowerCase().includes('tax')).reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0);
      const discount = mStats.discounts.reduce((acc: any, d: any) => acc + d.amount, 0);
      const dateStr = format(getSafeDate(job.selectedDate) || new Date(), 'EEEE, MMMM do');

      await addDoc(collection(db, "mail"), {
        to: [finalEmail, 'clearview3cleaners@gmail.com'],
        template: {
          name: 'confirmation',
          data: {
            firstName: job.firstName,
            fullAddress: fullAddress,
            date: dateStr,
            time: arrivalTime,
            serviceBreakdown: job.selectedServices?.join('\n') || 'Services',
            subtotal: serviceSubtotal.toFixed(2),
            discountAmount: totalDiscounts.toFixed(2),
            balanceDue: mStats.total
          }
        }
      });

      setConfSent(true); 
      setTimeout(() => setConfSent(false), 3000);
      setIsSendingConf(false);
      alert(`Confirmation resent successfully to ${finalEmail}`);
    } catch (err: any) { 
      console.error(err); 
      alert("Failed to resend: " + err.message); 
      setIsSendingConf(false);
    }
  };

  const handleRescheduleDate = (date: Date | undefined) => {
    if (!date || !isUnlocked) return;
    updateJob?.(job.id, job, { selectedDate: Timestamp.fromDate(startOfDay(date)) });
  };

  const ParamBtn = ({ label, value, onClick, active = false }: any) => (
    <button disabled={!isUnlocked} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all text-center ${active ? 'bg-white border-emerald-500 text-slate-900 shadow-md' : 'bg-slate-50 border-slate-50 text-slate-400 opacity-60'} ${!isUnlocked ? 'cursor-not-allowed' : 'hover:opacity-100'}`}><p className="text-[7px] font-black uppercase tracking-widest mb-0.5 opacity-50">{label}</p><p className="text-sm font-black uppercase italic leading-none">{value}</p></button>
  );

  const SubToggle = ({ label, active, onClick, icon }: any) => (
    <button disabled={!isUnlocked} onClick={(e) => { e.stopPropagation(); onClick(); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${active ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-slate-50 border-slate-50 text-slate-400 opacity-60'} ${!isUnlocked ? 'cursor-not-allowed' : 'hover:opacity-100'}`}>{icon}<span className="text-[8px] font-black uppercase tracking-widest">{label}</span></button>
  );

  const slots = ['morning', 'midday', 'afternoon'];

  return (
    <div className={`bg-white rounded-[2rem] md:rounded-[3rem] shadow-xl relative border transition-all duration-500 overflow-hidden text-left ${isExpanded ? 'p-8 md:p-12 ring-4 ring-emerald-600/5 border-slate-100' : 'p-6 md:p-8 hover:bg-slate-50 border-transparent cursor-pointer'} ${job.isGoBack ? 'border-l-[12px] border-l-orange-500 ring-4 ring-orange-500/10' : ''}`}>
      <div onClick={() => setIsExpanded(!isExpanded)} className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${isExpanded ? 'mb-12 pb-12 border-b border-slate-50' : ''}`}>
        <div className="flex flex-wrap items-center gap-4 lg:gap-8">
          <div className={`${isExpanded ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'} px-6 py-3 rounded-2xl transition-all duration-500`}><p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70 mb-0.5">Arrival</p><p className="text-xl font-black italic tracking-tighter uppercase leading-none flex items-center gap-2"><Clock size={16} strokeWidth={3} /> {arrivalTime}</p></div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-3">
              <h3 className={`font-black text-slate-900 tracking-tighter uppercase leading-none transition-all duration-500 ${isExpanded ? 'text-4xl md:text-6xl' : 'text-2xl md:text-3xl'}`}>{job.firstName} {job.lastName}</h3>
              {job.isGoBack && <span className="bg-orange-500 text-white px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest shadow-lg shadow-orange-500/20 italic">REDO / GO-BACK</span>}
            </div>
            {!isExpanded && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 flex-wrap"><span className="text-blue-600 font-black italic flex items-center gap-1"><Building2 size={10}/> {job.branch || 'Tri-Cities'}</span><span className="opacity-20">•</span><MapPin size={10} className="text-emerald-600/50"/> {displayCity} • {mStats.srv.length} Services {job.assignedTo && <span className="text-emerald-600 font-black italic ml-1 flex items-center gap-1"><UserCheck size={10}/> {allEmployees.find(e => e.id === job.assignedTo)?.name}</span>}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between lg:justify-end gap-6">
          <div className="text-right"><p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5 italic">Total</p><p className={`font-black text-slate-900 tracking-tighter leading-none transition-all duration-500 ${isExpanded ? 'text-4xl' : 'text-2xl'}`}>${mStats.total}</p></div>
          <div className="p-3 bg-slate-100 rounded-full text-slate-400">{isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
        </div>
      </div>

      {isExpanded && (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-12">
            <div className="min-w-0 flex-1 space-y-6">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-500 hover:text-emerald-600 group"><MapPin size={20} className="text-emerald-600" /><span className="text-xl md:text-2xl font-bold border-b-2 border-slate-100 group-hover:border-emerald-600">{fullAddress}</span></a>
              <div className="flex wrap items-center gap-6 pl-1">
                <div className="flex items-center gap-3 text-slate-400"><Smartphone size={18} className="text-emerald-600/50" /><span className="text-lg font-black tracking-widest">{job.phone || 'N/A'}</span></div>
                <div className="relative group">
                  {isEditingEmail ? (
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-emerald-500 animate-in fade-in slide-in-from-left-2">
                      <input autoFocus type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} onBlur={handleEmailUpdate} onKeyDown={(e) => e.key === 'Enter' && handleEmailUpdate()} className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 min-w-[200px]" />
                      <Check size={14} className="text-emerald-600 cursor-pointer" onClick={handleEmailUpdate} />
                    </div>
                  ) : (
                    <div onClick={() => setIsEditingEmail(true)} className="flex items-center gap-3 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors group">
                      <Mail size={18} className="text-emerald-600/50 group-hover:text-emerald-600" />
                      <span className="text-sm font-bold uppercase tracking-tight border-b border-transparent group-hover:border-emerald-600">{recipientEmail || 'N/A'}</span>
                      <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-6 w-full lg:w-auto">
              <div className="flex items-center gap-4">
                <button onClick={resendConfirmation} disabled={isSendingConf} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${confSent ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {isSendingConf ? <Loader2 size={14} className="animate-spin"/> : confSent ? <Check size={14}/> : <RefreshCw size={14}/>} {confSent ? 'Sent!' : 'Resend Conf.'}
                </button>
                <button onClick={sendInvoiceEmail} disabled={isSendingInvoice} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${invoiceSent ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {isSendingInvoice ? <Loader2 size={14} className="animate-spin"/> : invoiceSent ? <Check size={14}/> : <Mail size={14}/>} {invoiceSent ? 'Sent!' : (isSendingInvoice ? 'Generating...' : 'Email Invoice')}
                </button>
                <button onClick={() => setCompletingJob(job)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center gap-2"><CheckSquare size={14}/> Complete</button>
                {isAdmin && <button onClick={() => deleteJob?.(job.id)} className="p-4 bg-slate-50 text-slate-300 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"><Trash2 size={20} /></button>}
              </div>
              {!job.assignedTo ? (
                <div ref={assignRef} className="relative">
                  <button onClick={() => setIsAssignOpen(!isAssignOpen)} className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-[0.2em] shadow-xl hover:scale-105 transition-all flex items-center gap-3"><UserPlus size={16}/> Assign Tech</button>
                  {isAssignOpen && (
                    <div className="absolute right-0 top-full mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-50 animate-in slide-in-from-top-2">
                      {allEmployees.map(emp => (<button key={emp.id} onClick={() => { updateJob?.(job.id, job, { assignedTo: emp.id }, true); setIsAssignOpen(false); }} className="w-full text-left px-6 py-4 rounded-xl hover:bg-emerald-50 text-slate-900 font-black uppercase italic text-[10px] tracking-widest transition-all flex items-center justify-between group"><span>{emp.name}</span><ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-emerald-600"/></button>))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl">
                  <div className="flex items-center gap-4 px-6 py-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${assignedMember?.status === 'clocked_in' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="text-left"><p className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Technician</p><p className="text-xs font-black text-white uppercase italic tracking-tighter">{assignedMember?.name}</p></div>
                  </div>
                  <button onClick={() => updateJob?.(job.id, job, { assignedTo: null }, true)} className="p-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"><X size={14}/></button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-12 border-t border-slate-100 space-y-12">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600"><Info size={18}/><h4 className="font-black uppercase italic text-sm tracking-tighter">Work Order Specs</h4></div>
              <button onClick={() => toggleLock?.(job.id)} className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all font-black text-[8px] uppercase tracking-widest border ${isUnlocked ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{isUnlocked ? <Unlock size={12}/> : <Lock size={12}/>} {isUnlocked ? 'Safe-Edit Mode Active' : 'Unlock to Edit'}</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              <div className="lg:col-span-4 space-y-8">
                <div className="grid grid-cols-2 gap-3">
                  <ParamBtn label="Stories" value={job.stories} onClick={() => updateJob?.(job.id, job, { stories: (job.stories % 3) + 1 })} active />
                  <ParamBtn label="Bedrooms" value={job.homeSize} onClick={() => updateJob?.(job.id, job, { homeSize: job.homeSize === '1-2' ? '3-4' : job.homeSize === '3-4' ? '5+' : '1-2' })} active />
                </div>
                <div className={`bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 transition-opacity ${!isUnlocked ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <DayPicker mode="single" selected={getSafeDate(job.selectedDate) || undefined} onSelect={handleRescheduleDate} disabled={{ before: new Date() }} />
                  <div className="grid grid-cols-3 gap-2 mt-6">
                    {slots.map(slot => (<button key={slot} disabled={!isUnlocked} onClick={() => updateJob?.(job.id, job, { timeSlot: slot })} className={`py-2 rounded-xl text-[7px] font-black uppercase border transition-all ${normalizeSlot(job.timeSlot) === slot ? 'bg-emerald-500 border-emerald-600 text-white shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>{TIME_SLOT_MAP[slot] || slot}</button>))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-600"><Sparkles size={16}/><p className="text-[10px] font-black uppercase tracking-widest italic">Service Toggles</p></div>
                    <div className="grid grid-cols-1 gap-3">
                      <SubToggle label="Mark as Go-Back / REDO" active={job.isGoBack} onClick={() => updateJob?.(job.id, job, { isGoBack: !job.isGoBack })} icon={<RefreshCw size={12}/>} />
                      <SubToggle label="Downspout Flush" active={job.gutterFlush} onClick={() => updateJob?.(job.id, job, { gutterFlush: !job.gutterFlush })} icon={<Droplets size={12}/>} />
                      <SubToggle label="Roof Blow-off" active={job.roofBlowOff} onClick={() => updateJob?.(job.id, job, { roofBlowOff: !job.roofBlowOff })} icon={<Wind size={12}/>} />
                      <SubToggle label="Baking Soda Treatment" active={job.mossTreatment} onClick={() => updateJob?.(job.id, job, { mossTreatment: !job.mossTreatment })} icon={<Activity size={12}/>} />
                      <SubToggle label="Acid Wash Removal" active={job.mossAcidWash} onClick={() => updateJob?.(job.id, job, { mossAcidWash: !job.mossAcidWash })} icon={<Sparkles size={12}/>} />
                    </div>
                  </div>
                  <div className="space-y-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-600"><Smartphone size={16}/><p className="text-[10px] font-black uppercase tracking-widest italic">Misc Options</p></div>
                    <div className="grid grid-cols-1 gap-3">
                      <SubToggle label="Deluxe Screen Detail" active={job.deluxeWindow} onClick={() => updateJob?.(job.id, job, { deluxeWindow: !job.deluxeWindow })} icon={<Sun size={12}/>} />
                      <SubToggle label="Exterior Gutter Wash" active={job.deluxeGutter} onClick={() => updateJob?.(job.id, job, { deluxeGutter: !job.deluxeGutter })} icon={<Sparkles size={12}/>} />
                      <SubToggle label="Military Discount (10%)" active={job.militaryDiscount} onClick={() => updateJob?.(job.id, job, { militaryDiscount: !job.militaryDiscount })} icon={<ShieldCheck size={12}/>} />
                    </div>
                  </div>
                </div>
                <div className="space-y-4"><div className="flex items-center gap-2 text-slate-400"><HandCoins size={16}/><p className="text-[10px] font-black uppercase tracking-widest italic">Technician Notes</p></div><textarea readOnly={!isUnlocked} defaultValue={job.memo} onBlur={(e) => updateJob?.(job.id, job, { memo: e.target.value })} className={`w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold outline-none min-h-[80px] transition-all shadow-inner ${isUnlocked ? 'focus:border-emerald-600 bg-white' : ''}`} placeholder="Update job details..." /></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;
