'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, where, getDocs, limit, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; 
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Banknote, CreditCard, Loader2, ArrowRight, Receipt, Users, MessageSquare, Mail, Smartphone, CheckSquare, MapPin
} from 'lucide-react';
import { startOfDay, startOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, isSameDay, format } from 'date-fns';
import { getDayOccupancySummary, filterJobsBySelectedDay, calculateJobStats } from '../../../lib/scheduleUtils';
import JobCard from '../../../components/schedule/JobCard';

const BRANCHES = ['Tri-Cities', 'Walla Walla', 'Tacoma', 'Puyallup'];

export default function AdminSchedule() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeCrew, setActiveCrew] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('Tri-Cities');
  const [completingLead, setCompletingLead] = useState<any | null>(null);
  const [unlockedJobs, setUnlockedJobs] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const [paymentStep, setPaymentStep] = useState<'method' | 'cash_details' | 'check_details' | 'card_options' | 'card_manual'>('method');
  const [checkNumber, setCheckNumber] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [isProcessingStripe, setIsProcessingStripe] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    if (completingLead) {
      const total = completingLead.total || completingLead.finalPrice || completingLead.template?.data?.totalAmount || '0';
      setReceivedAmount(total.toString());
      setPaymentStep('method');
      setCheckNumber('');
    }
  }, [completingLead]);

  useEffect(() => {
    const qLeads = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubLeads = onSnapshot(qLeads, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qCrew = query(collection(db, "employees"), where("status", "in", ["clocked_in", "Clocked In"]));
    const unsubCrew = onSnapshot(qCrew, (snap) => {
      setActiveCrew(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qAll = query(collection(db, "employees"), orderBy("name", "asc"));
    const unsubAll = onSnapshot(qAll, (snap) => {
      setAllEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubLeads(); unsubCrew(); unsubAll(); };
  }, []);

  const monthFull = format(viewDate, 'MMMM yyyy');

  const updateJob = async (id: string, currentJobData: any, updates: any, bypassLock = false) => {
    if (!unlockedJobs.has(id) && !bypassLock) return;
    setIsUpdating(id);
    try {
      const mergedData = { ...currentJobData, ...updates };
      const mStats = calculateJobStats(mergedData);
      
      // CRITICAL FIX: If selectedDate is being updated, we MUST recalculate and shift ALL booked days
      // to prevent overbooking and "ghost" slots.
      let finalActualBookedDays = currentJobData.actualBookedDays || [];
      if (updates.selectedDate) {
        const newStart = updates.selectedDate instanceof Date ? updates.selectedDate : updates.selectedDate.toDate();
        const days: Date[] = [newStart];
        for (let i = 1; i < mStats.daysRequired; i++) {
          days.push(addDays(newStart, i));
        }
        finalActualBookedDays = days.map(d => Timestamp.fromDate(d));
      }

      const finalFields = { 
        ...updates, 
        actualBookedDays: finalActualBookedDays,
        total: mStats.total, 
        totalMinutes: mStats.totalMinutes,
        selectedServices: mStats.srv,
        template: {
          ...currentJobData.template,
          name: currentJobData.template?.name || 'confirmation',
          data: {
            ...currentJobData.template?.data,
            total: mStats.total,
            services: mStats.srv.join(', ')
          }
        }
      };
      await updateDoc(doc(db, "leads", id), finalFields);
    } catch (err) { console.error(err); } finally { setIsUpdating(null); }
  };

  const deleteJob = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteDoc(doc(db, "leads", id));
      alert("Job deleted successfully.");
    } catch (err: any) {
      console.error("Error deleting lead:", err);
      alert(`Error deleting job: ${err.message}`);
    }
  };

  const toggleLock = (jobId: string) => {
    const next = new Set(unlockedJobs);
    if (unlockedJobs.has(jobId)) next.delete(jobId);
    else next.add(jobId);
    setUnlockedJobs(next);
  };

  const initiateStripeCheckout = async () => {
    if (!completingLead) return;
    setIsProcessingStripe(true);
    try {
      const paidAmount = parseFloat(receivedAmount) || 0;
      const name = completingLead.template?.data?.fullName || `${completingLead.firstName || ''} ${completingLead.lastName || ''}`.trim() || 'Valued Customer';
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paidAmount,
          leadId: completingLead.id,
          customerEmail: completingLead.email || completingLead.template?.data?.email,
          customerName: name
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Stripe redirect failed:', err);
      alert(`Stripe Error: ${err.message}`);
    } finally { setIsProcessingStripe(false); }
  };

  const handleJobCompletion = async (method: 'Card' | 'Cash' | 'Check') => {
    if (!completingLead) return;
    const leadRef = doc(db, "leads", completingLead.id);
    const total = parseFloat(completingLead.total || completingLead.finalPrice || completingLead.template?.data?.totalAmount || '0');
    const received = parseFloat(receivedAmount) || total;
    const tip = Math.max(0, received - total);
    const customerEmail = completingLead.email || completingLead.template?.data?.email || completingLead.customerEmail;
    const name = `${completingLead.firstName || ''} ${completingLead.lastName || ''}`.trim() || 'Valued Customer';

    try {
      await updateDoc(leadRef, {
        status: 'Archived',
        paymentMethod: method,
        collectedAmount: received,
        tipAmount: tip,
        paymentStatus: 'Paid In Full',
        completedAt: new Date().toISOString()
      });

      if (customerEmail) {
        const { id, ...jobDataWithoutId } = completingLead;
        await addDoc(collection(db, "leads"), {
          ...jobDataWithoutId,
          status: 'Notification',
          isNotification: true,
          createdAt: serverTimestamp(),
          email: customerEmail,
          to: [customerEmail],
          template: {
            name: 'invoice',
            data: {
              firstName: completingLead.firstName,
              fullAddress: `${completingLead.address}, ${completingLead.city}`,
              balanceDue: '0.00',
              date: 'Service Completed',
              time: 'Paid in Full',
              services: completingLead.selectedServices?.join(', ') || 'Services'
            }
          }
        });
      }
      setCompletingLead(null);
      setReceivedAmount('');
      setPaymentStep('method');
    } catch (err) { console.error(err); }
  };

  const calendarDays = useMemo(() => {
    if (viewType === 'month') {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const firstDayIdx = start.getDay();
      const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
      const days = [];
      for (let i = 0; i < firstDayIdx; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), i));
      }
      return days;
    } else if (viewType === 'day') {
      return [viewDate];
    } else {
      const start = startOfWeek(viewDate);
      return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }
  }, [viewDate, viewType]);

  const handlePrev = () => {
    if (viewType === 'month') setViewDate(subMonths(viewDate, 1));
    else if (viewType === 'week') setViewDate(subWeeks(viewDate, 1));
    else setViewDate(addDays(viewDate, -1));
  };

  const handleNext = () => {
    if (viewType === 'month') setViewDate(addMonths(viewDate, 1));
    else if (viewType === 'week') setViewDate(addWeeks(viewDate, 1));
    else setViewDate(addDays(viewDate, 1));
  };

  const branchFilteredJobs = useMemo(() => {
    return jobs.filter(j => j.branch === selectedBranch);
  }, [jobs, selectedBranch]);

  const filteredJobs = useMemo(() => {
    return filterJobsBySelectedDay(branchFilteredJobs, viewDate, selectedDay);
  }, [branchFilteredJobs, selectedDay, viewDate]);

  const crewAtBranch = useMemo(() => {
    return allEmployees.filter(e => e.homeBranch === selectedBranch || e.branch === selectedBranch);
  }, [allEmployees, selectedBranch]);

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen bg-slate-50/50 text-left font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="flex flex-col xl:flex-row justify-between items-start gap-8">
          <div className="text-center xl:text-left flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-4">Master Schedule</h1>
            <div className="flex flex-wrap items-center gap-3 justify-center xl:justify-start">
              {BRANCHES.map(b => (
                <button 
                  key={b} onClick={() => setSelectedBranch(b)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2
                    ${selectedBranch === b ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-center xl:justify-end gap-3 shrink-0">
            {crewAtBranch.map(member => (
              <div key={member.id} className="bg-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm border border-slate-100">
                <div className={`w-2 h-2 rounded-full ${member.status?.toLowerCase().includes('in') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`}></div>
                <p className="text-[10px] font-black text-slate-900 uppercase italic tracking-widest">{member.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 text-center max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8 px-4">
            <h2 className="text-2xl font-black uppercase italic text-slate-800 tracking-tighter">{monthFull}</h2>
            <div className="flex items-center gap-6">
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                {(['day', 'week', 'month'] as const).map((t) => (
                  <button key={t} onClick={() => setViewType(t)} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${viewType === t ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t === 'month' ? 'Monthly' : t === 'day' ? 'Daily' : 'Weekly'}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handlePrev} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-emerald-600 transition-colors"><ChevronLeft size={20}/></button>
                <button onClick={handleNext} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-emerald-600 transition-colors"><ChevronRight size={20}/></button>
              </div>
            </div>
          </div>

          {viewType !== 'day' && (
            <div className="grid grid-cols-7 gap-3 mb-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">{day}</div>
              ))}
            </div>
          )}

          <div className={`grid ${viewType === 'day' ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-7'} gap-3`}>
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="h-14" />;
              const dayNum = date.getDate();
              const isSelected = isSameDay(date, new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay));
              const dSummary = getDayOccupancySummary(branchFilteredJobs, date).get(dayNum) || { count: 0, unassigned: 0 };
              const hasAlert = dSummary.unassigned > 0;
              return (
                <button key={i} onClick={() => { setViewDate(date); setSelectedDay(dayNum); }} className={`relative h-14 rounded-2xl font-black text-lg transition-all flex flex-col items-center justify-center ${isSelected ? 'bg-slate-900 text-white scale-105 shadow-lg' : 'text-slate-800 hover:bg-slate-50'} ${dSummary.count > 0 ? (hasAlert ? 'border-2 border-red-500' : 'border-2 border-emerald-500') : ''}`}>
                  <span>{dayNum}</span>
                  {viewType === 'day' && <span className="text-[10px] uppercase tracking-widest mt-1 opacity-60 font-black italic">{format(date, 'EEEE')}</span>}
                  <div className="flex gap-0.5 absolute bottom-2">
                    {Array.from({ length: Math.min(dSummary.count, 3) }).map((_, dotIdx) => (
                      <span key={dotIdx} className={`w-1 h-1 rounded-full ${hasAlert ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-10">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-2xl">No Assignments Found Today</p>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-4 italic">Showing results for {selectedBranch} branch</p>
            </div>
          ) : filteredJobs.map((job, index) => (
            <JobCard 
              key={job.id} job={job} isAdmin={true} allEmployees={allEmployees} 
              unlockedJobs={unlockedJobs} isUpdating={isUpdating} toggleLock={toggleLock} 
              updateJob={updateJob} deleteJob={deleteJob} setCompletingJob={setCompletingLead} 
              currentDayTime={startOfDay(new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay)).getTime()}
              isNearby={index > 0 && job.city === filteredJobs[index - 1].city}
            />
          ))}
        </div>
      </div>

      {completingLead && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-12 relative shadow-2xl animate-in zoom-in duration-300">
            <div className="mb-10"><h2 className="text-5xl font-black uppercase italic text-slate-900 mb-2 leading-none tracking-tighter">Confirmation</h2></div>
            
            {paymentStep === 'method' && (
              <div className="space-y-6">
                <div className="grid gap-5">
                  <button onClick={() => setPaymentStep('card_manual')} className="flex items-center justify-between p-8 bg-slate-900 text-white rounded-3xl hover:bg-emerald-600 transition-all group shadow-xl">
                    <div className="flex items-center gap-5">
                      <CreditCard size={32} className="text-emerald-400" />
                      <div className="text-left"><span className="block font-black uppercase italic text-xl leading-none">Pay with Card</span><span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 group-hover:text-emerald-100">Secure Stripe Payment</span></div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-5">
                    <button onClick={() => setPaymentStep('cash_details')} className="flex flex-col items-center p-8 bg-slate-50 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group gap-3 border-2 border-transparent hover:border-emerald-100"><Banknote size={28} className="text-slate-400 group-hover:text-emerald-500" /><span className="font-black uppercase italic text-[9px] tracking-widest">Cash</span></button>
                    <button onClick={() => setPaymentStep('check_details')} className="flex flex-col items-center p-8 bg-slate-50 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group gap-3 border-2 border-transparent hover:border-emerald-100"><Receipt size={28} className="text-slate-400 group-hover:text-emerald-500" /><span className="font-black uppercase italic text-[9px] tracking-widest">Check</span></button>
                  </div>
                </div>
                <button onClick={() => setCompletingLead(null)} className="w-full py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-colors">Return to Master Schedule</button>
              </div>
            )}

            {paymentStep === 'card_manual' && (
              <div className="space-y-8">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Amount to Charge Card</p>
                  <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-6 px-8 text-4xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all text-center [appearance:textfield]" autoFocus />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={initiateStripeCheckout} className="flex-1 py-6 bg-emerald-500 text-white rounded-3xl font-black uppercase italic text-sm tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3">
                    {isProcessingStripe ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
                    {isProcessingStripe ? 'Opening Stripe...' : 'Initialize Payment'}
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'cash_details' && (
              <div className="space-y-8">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Total Cash Received</p>
                  <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-6 px-8 text-4xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all text-center [appearance:textfield]" autoFocus />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={() => handleJobCompletion('Cash')} className="flex-1 py-6 bg-slate-900 text-white rounded-3xl font-black uppercase italic text-sm tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3">Complete Job <ArrowRight size={18} /></button>
                </div>
              </div>
            )}

            {paymentStep === 'check_details' && (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 italic">Check Number</p>
                    <input type="text" placeholder="XXXX" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 px-6 text-xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all" autoFocus />
                  </div>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 italic">Amount on Check</p>
                    <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-4 px-6 text-xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all [appearance:textfield]" />
                  </div>
                </div>
12                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={() => handleJobCompletion('Check')} className="flex-1 py-6 bg-slate-900 text-white rounded-3xl font-black uppercase italic text-sm tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4 group">
                    <Receipt size={20} className="group-hover:text-emerald-600" /> Submit Check <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
