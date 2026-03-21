'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { doc, Timestamp, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  MapPin, Clock, CheckSquare, Mail, Lock, Unlock, ArrowRight, X, Building2,
  UserPlus, UserCheck, Activity, Smartphone, Sparkles, Waves, Droplets, Trash2, RefreshCw, Loader2, Info, Sun, Edit2, ChevronUp, ChevronDown, Wind, HandCoins, ShieldCheck, Check, ClipboardList
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
  userEmail
}) => {
  const mStats = calculateJobStats(job);
  const isUnlocked = unlockedJobs.has(job.id);
  const lauren = { id: 'Lauren_Interdonato', name: 'Lauren Interdonato', email: 'clearview3cleaners@gmail.com', status: 'clocked_in', isOffDuty: false };
  
  const allTechs = useMemo(() => {
    const list = [...allEmployees];
    if (!list.some(e => e.id === lauren.id || e.email?.toLowerCase() === lauren.email.toLowerCase())) {
      list.unshift(lauren);
    }
    return list;
  }, [allEmployees]);

  const assignedMember = allTechs.find(e => 
    (job.assignedTo && e.id === job.assignedTo) || 
    (job.assignedTo && e.email?.toLowerCase() === job.assignedTo.toLowerCase())
  );
  
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const assignRef = useRef<HTMLDivElement>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isSendingConf, setIsSendingConf] = useState(false);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [confSent, setConfSent] = useState(false);

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
      
      const subject = encodeURIComponent("Service Invoice - Clear View LLC");
      const body = encodeURIComponent(`Hi ${job.firstName},\n\nHere is your invoice for your service at ${fullAddress}.\n\nYou can pay securely here:\n${data.url}\n\nThank you for choosing Clear View LLC!`);
      
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${finalEmail}&su=${subject}&body=${body}`, '_blank');
      
      setInvoiceSent(true); 
      setTimeout(() => setInvoiceSent(false), 3000);
      setIsSendingInvoice(false);
    } catch (err: any) { console.error(err); alert("Failed: " + err.message); setIsSendingInvoice(false); }
  };

  const resendConfirmation = async () => {
    const finalEmail = recipientEmail.trim().toLowerCase();
    if (!finalEmail) { alert("Please provide a valid email address."); return; }
    setIsSendingConf(true);
    
    const dateStr = format(getSafeDate(job.selectedDate) || new Date(), 'EEEE, MMMM do');
    const subject = encodeURIComponent("Reservation Confirmed - Clear View LLC");
    const body = encodeURIComponent(`Hi ${job.firstName},\n\nYour reservation for ${dateStr} at ${fullAddress} is confirmed! We look forward to seeing you.\n\nBest,\nClear View LLC`);
    
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${finalEmail}&su=${subject}&body=${body}`, '_blank');
    
    setConfSent(true); 
    setTimeout(() => setConfSent(false), 3000);
    setIsSendingConf(false);
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
    <div className={`bg-white rounded-[2rem] md:rounded-[3rem] shadow-xl relative border transition-all duration-500 overflow-hidden text-left ${isExpanded ? 'p-6 md:p-12 ring-4 ring-emerald-600/5 border-slate-100' : 'p-6 md:p-8 hover:bg-slate-50 border-transparent cursor-pointer'} ${job.isGoBack ? 'border-l-[12px] border-l-orange-500 ring-4 ring-orange-500/10' : ''}`}>
      <div onClick={() => setIsExpanded(!isExpanded)} className={`flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${isExpanded ? 'mb-12 pb-12 border-b border-slate-50' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-8">
          <div className={`${isExpanded ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'} px-6 py-3 rounded-2xl transition-all duration-500 shrink-0 w-fit`}><p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70 mb-0.5">Arrival</p><p className="text-xl font-black italic tracking-tighter uppercase leading-none flex items-center gap-2"><Clock size={16} strokeWidth={3} /> {arrivalTime}</p></div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className={`font-black text-slate-900 tracking-tighter uppercase leading-none transition-all duration-500 ${isExpanded ? 'text-3xl md:text-6xl' : 'text-xl md:text-3xl'}`}>{job.firstName} {job.lastName}</h3>
              {job.isGoBack && <span className="bg-orange-500 text-white px-4 py-1.5 rounded-full font-black text-[9px] uppercase tracking-widest shadow-lg shadow-orange-500/20 italic">REDO</span>}
            </div>
            {!isExpanded && (
              <div className="flex flex-col gap-2 mt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 flex-wrap"><span className="text-blue-600 font-black italic flex items-center gap-1"><Building2 size={10}/> {job.branch || 'Tri-Cities'}</span><span className="opacity-20 hidden sm:inline">•</span><MapPin size={10} className="text-emerald-600/50"/> {displayCity} <span className="opacity-20 hidden sm:inline">•</span> {job.assignedTo && <span className="text-emerald-600 font-black italic flex items-center gap-1"><UserCheck size={10}/> {allTechs.find(e => e.id === job.assignedTo)?.name}</span>}</p>
                <div className="flex flex-wrap gap-2">
                  {(job.selectedServices || []).map((s: string) => (
                    <span key={s} className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest italic border border-slate-800 shadow-sm">
                      {s === 'Window Cleaning' && job.windowType ? `${s} (${job.windowType.toUpperCase()})` : s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto">
          <div className="text-left lg:text-right"><p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5 italic">Total</p><p className={`font-black text-slate-900 tracking-tighter leading-none transition-all duration-500 ${isExpanded ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl'}`}>${mStats.total}</p></div>
          <div className="p-3 bg-slate-100 rounded-full text-slate-400">{isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</div>
        </div>
      </div>

      {isExpanded && (
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-10 mb-12 items-start">
            
            <div className="lg:col-span-4 space-y-6 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group w-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-600/20 transition-all duration-1000" />
              <div className="flex items-center gap-3 mb-4 relative z-10">
                <ClipboardList size={20} className="text-blue-400" />
              </div>
              <div className="space-y-4 relative z-10">
                {(job.selectedServices || []).map((s: string) => (
                  <div key={s} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 group/item">
                    <div className="w-2 h-2 rounded-full bg-blue-500 group-hover/item:scale-150 transition-transform" />
                    <div className="flex flex-col">
                      <span className="font-black uppercase italic tracking-tight text-sm text-slate-200">{s}</span>
                      {s === 'Window Cleaning' && job.windowType && (
                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Type: {job.windowType}</span>
                      )}
                      {s === 'Roof Cleaning' && job.roofType && (
                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Surface: {job.roofType}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-8 text-left w-full">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-slate-500 hover:text-emerald-600 group text-left"><MapPin size={24} className="text-emerald-600 shrink-0" /><span className="text-xl md:text-2xl font-bold border-b-2 border-slate-100 group-hover:border-emerald-600 break-words">{fullAddress}</span></a>
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-x-12 gap-y-6 pl-1 text-left">
                <div className="flex items-center gap-3 text-slate-400 whitespace-nowrap shrink-0 text-left"><Smartphone size={20} className="text-emerald-600/50" /><span className="text-lg font-black tracking-widest">{job.phone || 'N/A'}</span></div>
                <div className="relative group min-w-0 flex items-center text-left w-full sm:w-auto">
                  {isEditingEmail ? (
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-emerald-500 animate-in fade-in slide-in-from-left-2 w-full">
                      <input autoFocus type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} onBlur={handleEmailUpdate} onKeyDown={(e) => e.key === 'Enter' && handleEmailUpdate()} className="bg-transparent border-none outline-none text-sm font-bold text-slate-900 flex-1 min-w-[150px]" />
                      <Check size={14} className="text-emerald-600 cursor-pointer" onClick={handleEmailUpdate} />
                    </div>
                  ) : (
                    <div onClick={() => setIsEditingEmail(true)} className="flex items-center gap-3 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors group text-left overflow-hidden">
                      <Mail size={20} className="text-emerald-600/50 group-hover:text-emerald-600 shrink-0" />
                      <span className="text-sm font-bold uppercase tracking-tight border-b border-transparent group-hover:border-emerald-600 truncate">{recipientEmail || 'N/A'}</span>
                      <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 w-full sm:w-auto pt-4">
                <button onClick={resendConfirmation} disabled={isSendingConf} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${confSent ? 'bg-emerald-500 text-white w-full sm:w-auto' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 w-full sm:w-auto'}`}>
                  {isSendingConf ? <Loader2 size={12} className="animate-spin" /> : confSent ? <Check size={12} /> : <RefreshCw size={12} />} {confSent ? 'Sent!' : 'Conf'}
                </button>
                <button onClick={sendInvoiceEmail} disabled={isSendingInvoice} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all ${invoiceSent ? 'bg-blue-500 text-white w-full sm:w-auto' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 w-full sm:w-auto'}`}>
                  {isSendingInvoice ? <Loader2 size={12} className="animate-spin" /> : invoiceSent ? <Check size={12} /> : <Mail size={12} />} {invoiceSent ? 'Sent!' : 'Inv'}
                </button>
                <button onClick={() => setCompletingJob(job)} className="col-span-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg flex items-center justify-center gap-2"><CheckSquare size={16} /> Complete</button>
                {isAdmin && <button onClick={() => deleteJob?.(job.id)} className="p-4 bg-slate-50 text-slate-300 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm flex items-center justify-center"><Trash2 size={20} /></button>}
              </div>

              {!job.assignedTo ? (
                <div ref={assignRef} className="relative w-full sm:w-auto pt-2">
                  <button onClick={() => setIsAssignOpen(!isAssignOpen)} className="w-full px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-[0.2em] shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-3"><UserPlus size={16} /> Assign Tech</button>
                  {isAssignOpen && (
                    <div className="absolute right-0 top-full mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-50 animate-in slide-in-from-top-2 text-left">
                      {allTechs.map(emp => {
                        const hasDeclined = job.declinedBy?.includes(emp.id) || job.declinedBy?.includes(emp.email);
                        const isOnline = emp.status?.toLowerCase().includes('in');
                        return (
                          <button
                            key={emp.id}
                            onClick={() => {
                              if (!emp.isOffDuty) {
                                const nextDeclined = (job.declinedBy || []).filter((id: string) => id !== emp.id && id !== emp.email);
                                updateJob?.(job.id, job, { 
                                  assignedTo: emp.id,
                                  declinedBy: nextDeclined 
                                }, true);
                                setIsAssignOpen(false);
                              }
                            }}
                            disabled={emp.isOffDuty}
                            className={`w-full text-left px-6 py-4 rounded-xl font-black uppercase italic text-[10px] tracking-widest transition-all flex items-center justify-between group ${emp.isOffDuty
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-50'
                                : 'hover:bg-emerald-50 text-slate-900 cursor-pointer'
                              }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                <span>{emp.name}</span>
                                {hasDeclined && (
                                  <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-[6px] font-black tracking-widest animate-pulse">DECLINED</span>
                                )}
                              </div>
                              {emp.isOffDuty && (
                                <span className="text-[7px] text-red-400 normal-case font-bold tracking-normal italic">
                                  Off-Duty ({emp.offDutyType === 'vacation' ? 'Vacation' : emp.offDutyType === 'sick' ? 'Sick' : 'Vacation/Sick'})
                                </span>
                              )}
                            </div>
                            {!emp.isOffDuty && <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-emerald-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-xl text-left w-full sm:w-auto">
                  <div className="flex items-center gap-4 px-6 py-2 text-left flex-1">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${assignedMember?.status?.toLowerCase().includes('in') ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    <div className="text-left"><p className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-left">Technician</p><p className="text-xs font-black text-white uppercase italic tracking-tighter text-left">{assignedMember?.name}</p></div>
                  </div>
                  <button 
                    onClick={() => {
                      if (isAdmin) {
                        updateJob?.(job.id, job, { assignedTo: null }, true);
                      } else if (userEmail) {
                        const isAssignedToMe = job.assignedTo === userEmail || assignedMember?.email === userEmail || assignedMember?.id === userEmail;
                        if (isAssignedToMe) {
                          if (window.confirm("Reject this mission? It will be sent back to HQ for reassignment.")) {
                            const currentDeclined = Array.isArray(job.declinedBy) ? [...job.declinedBy] : [];
                            if (userEmail && !currentDeclined.includes(userEmail)) {
                              currentDeclined.push(userEmail);
                            }
                            updateJob?.(job.id, job, { 
                              assignedTo: null, 
                              declinedBy: currentDeclined 
                            }, true);
                          }
                        }
                      }
                    }} 
                    className="p-3 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;
