'use client';
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { db, functions } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, where, getDocs, limit, deleteDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Banknote, CreditCard, Loader2, ArrowRight, Receipt, Users, MessageSquare, Mail, Smartphone, CheckSquare, MapPin, Activity, UserCheck
} from 'lucide-react';
import { startOfDay, startOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, isSameDay, format, parse, isValid } from 'date-fns';
import { getDayOccupancySummary, filterJobsBySelectedDay, calculateJobStats } from '../../../lib/scheduleUtils';
import JobCard from '../../../components/schedule/JobCard';
import { useSearchParams } from 'next/navigation';

const BRANCHES = ['Tri-Cities', 'Walla Walla', 'Tacoma', 'Puyallup'];

function ScheduleContent() {
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeCrew, setActiveCrew] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [allAttendance, setAllAttendance] = useState<any[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('Tri-Cities');
  const [completingLead, setCompletingLead] = useState<any | null>(null);
  const [unlockedJobs, setUnlockedJobs] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!searchParams) return;
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        const parsedDate = parse(dateParam, 'yyyy-MM-dd', new Date());
        setViewDate(parsedDate);
        setSelectedDay(parsedDate.getDate());
        setViewType('day');
      } catch (err) { console.error("Invalid date param", err); }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams) return;
    const highlightParam = searchParams.get('highlight');
    if (highlightParam && jobs.length > 0) {
      setHighlightedJobId(highlightParam);
      const target = jobs.find(j => j.id === highlightParam);
      if (target && target.branch) {
        setSelectedBranch(target.branch);
      }
    }
  }, [searchParams, jobs]);

  const [paymentStep, setPaymentStep] = useState<'method' | 'cash_details' | 'check_details' | 'card_options' | 'card_manual'>('method');
  const [checkNumber, setCheckNumber] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [isProcessingStripe, setIsProcessingStripe] = useState(false);

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
    const unsubAll = onSnapshot(qAll, async (snap) => {
      const employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllEmployees(employees);
      
      // Fetch attendance for all employees to check for off-duty status
      const attendanceData: any[] = [];
      for (const emp of employees) {
        const attendRef = collection(db, "employees", emp.id, "attendance");
        const qAttend = query(attendRef, where("type", "in", ["vacation", "sick"]));
        const attendSnap = await getDocs(qAttend);
        attendSnap.forEach(doc => {
          attendanceData.push({ ...doc.data(), employeeId: emp.id, id: doc.id });
        });
      }
      setAllAttendance(attendanceData);
    });

    return () => { unsubLeads(); unsubCrew(); unsubAll(); };
  }, []);

  const employeesWithOffDuty = useMemo(() => {
    return allEmployees.map(emp => {
      const offRecord = allAttendance.find(a => {
        if (a.employeeId !== emp.id) return false;
        const punchDate = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.date);
        return isSameDay(punchDate, viewDate);
      });
      return { 
        ...emp, 
        isOffDuty: !!offRecord,
        offDutyType: offRecord?.type || null
      };
    });
  }, [allEmployees, allAttendance, viewDate]);

  const monthFull = format(viewDate, 'MMMM yyyy');

  const updateJob = async (id: string, currentJobData: any, updates: any, bypassLock = false) => {
    if (!unlockedJobs.has(id) && !bypassLock) return;
    setIsUpdating(id);
    try {
      const mergedData = { ...currentJobData, ...updates };
      const mStats = calculateJobStats(mergedData);
      
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
      
      // Use the 'functions' object from '../../lib/firebase' as initialized there
      const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
      const result = await createStripeCheckout({
        amount: paidAmount,
        leadId: completingLead.id,
        customerEmail: completingLead.email || completingLead.template?.data?.email,
        customerName: name
      });
      const data = result.data as { url: string };
      if (data.url) {
        window.location.href = data.url;
      }
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
    return jobs.filter(j => (j.branch || 'Tri-Cities') === selectedBranch);
  }, [jobs, selectedBranch]);

  const filteredJobs = useMemo(() => {
    return filterJobsBySelectedDay(branchFilteredJobs, viewDate, selectedDay);
  }, [branchFilteredJobs, selectedDay, viewDate]);

  const crewAtBranch = useMemo(() => {
    return allEmployees.filter(e => {
      const branches = e.homeBranches || [e.homeBranch] || [];
      return branches.includes(selectedBranch);
    });
  }, [allEmployees, selectedBranch]);

  const unassignedJobs = useMemo(() => {
    return branchFilteredJobs.filter(j => 
      !j.assignedTo && 
      !['Archived', 'Completed', 'archived', 'completed'].includes(j.status) && 
      !j.isNotification
    );
  }, [branchFilteredJobs]);

  const unassignedByBranch = useMemo(() => {
    const counts: Record<string, number> = {};
    BRANCHES.forEach(b => {
      counts[b] = jobs.filter(j => {
        const jobBranch = j.branch || 'Tri-Cities';
        return jobBranch === b && 
          !j.assignedTo && 
          !['Archived', 'Completed', 'archived', 'completed'].includes(j.status) && 
          !j.isNotification;
      }).length;
    });
    return counts;
  }, [jobs]);

  const scheduleConflicts = useMemo(() => {
    if (jobs.length === 0 || allAttendance.length === 0) return [];
    
    return jobs.filter(job => {
      if (!job.assignedTo || job.status === 'Archived' || job.status === 'Completed') return false;
      
      const bookedDates = (job.actualBookedDays || []).map((ts: any) => {
        if (ts?.toDate) return ts.toDate();
        if (ts?.seconds) return new Date(ts.seconds * 1000);
        return new Date(ts);
      }).filter((d: Date) => isValid(d));

      if (bookedDates.length === 0 && job.selectedDate) {
        const d = job.selectedDate.toDate ? job.selectedDate.toDate() : new Date(job.selectedDate);
        if (isValid(d)) bookedDates.push(d);
      }

      return bookedDates.some(date => {
        return allAttendance.some(att => {
          if (att.employeeId !== job.assignedTo) return false;
          const punchDate = att.startTime?.toDate ? att.startTime.toDate() : new Date(att.date);
          return isSameDay(punchDate, date) && (att.type === 'vacation' || att.type === 'sick');
        });
      });
    });
  }, [jobs, allAttendance]);

  const resolveAllConflicts = async () => {
    if (scheduleConflicts.length === 0) return;
    if (!window.confirm(`Unassign ${scheduleConflicts.length} tech(s) from jobs where they are marked Sick or on Vacation?`)) return;
    
    setIsUpdating('batch-resolve');
    try {
      const batch = writeBatch(db);
      scheduleConflicts.forEach(job => {
        const ref = doc(db, 'leads', job.id);
        batch.update(ref, { assignedTo: null });
      });
      await batch.commit();
      alert("Conflicts resolved. Jobs are now unassigned.");
    } catch (err) {
      console.error(err);
      alert("Failed to resolve conflicts.");
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-12 min-h-screen bg-white text-left font-sans text-slate-900">
      <div className="max-w-[1600px] mx-auto space-y-12">
        
        {/* TOP LEVEL ALERTS */}
        <div className="space-y-6">
          {/* CONFLICT ALERT */}
          {scheduleConflicts.length > 0 && (
            <div className="bg-red-50 border-2 border-red-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-red-500/5">
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="p-4 bg-red-500 text-white rounded-2xl shadow-lg animate-pulse">
                  <Activity size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase italic text-red-600 tracking-tighter leading-none mb-2">Schedule Conflict Detected</h4>
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest italic">{scheduleConflicts.length} Job(s) assigned to techs who are currently marked Sick or on Vacation.</p>
                </div>
              </div>
              <button 
                onClick={resolveAllConflicts}
                disabled={isUpdating === 'batch-resolve'}
                className="px-10 py-5 bg-red-600 text-white rounded-2xl font-black uppercase italic text-xs tracking-widest hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 flex items-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isUpdating === 'batch-resolve' ? <Loader2 className="animate-spin" size={18} /> : <UserCheck size={18} />}
                Resolve All Conflicts
              </button>
            </div>
          )}

          {/* UNASSIGNED ALERT */}
          {unassignedJobs.length > 0 && (
            <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-orange-500/5">
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="p-4 bg-orange-500 text-white rounded-2xl shadow-lg">
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-black uppercase italic text-orange-600 tracking-tighter leading-none mb-2">Unassigned Jobs Detected</h4>
                  <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest italic">{unassignedJobs.length} Job(s) in {selectedBranch} need to be assigned to a technician.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-black uppercase text-orange-400 italic tracking-widest">Awaiting Technician</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-10">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            {BRANCHES.map(b => (
              <button 
                key={b} onClick={() => setSelectedBranch(b)}
                className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-2
                  ${selectedBranch === b ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-900 hover:text-slate-900'}`}
              >
                {b}
                {unassignedByBranch[b] > 0 && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                )}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {crewAtBranch.map(member => (
              <div key={member.id} className="bg-slate-50 px-6 py-3 rounded-2xl flex items-center gap-3 border border-slate-100 shadow-sm">
                <div className={`w-2 h-2 rounded-full ${member.status?.toLowerCase().includes('in') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <p className="text-[9px] font-black text-slate-900 uppercase italic tracking-[0.2em]">{member.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CALENDAR ENGINE */}
        <div className="bg-white rounded-[4rem] p-8 md:p-12 shadow-2xl border border-slate-50 text-center max-w-4xl mx-auto relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-8 mb-12 px-4 relative z-10">
            <h2 className="text-4xl font-black uppercase italic text-slate-900 tracking-tighter leading-none">{monthFull}</h2>
            <div className="flex items-center gap-6">
              <div className="flex bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100">
                {(['day', 'week', 'month'] as const).map((t) => (
                  <button key={t} onClick={() => setViewType(t)} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all italic tracking-widest ${viewType === t ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-slate-600'}`}>{t === 'month' ? 'Monthly' : t === 'day' ? 'Daily' : 'Weekly'}</button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={handlePrev} className="p-3 bg-slate-900 text-white rounded-full hover:scale-110 transition-all shadow-xl"><ChevronLeft size={20}/></button>
                <button onClick={handleNext} className="p-3 bg-slate-900 text-white rounded-full hover:scale-110 transition-all shadow-xl"><ChevronRight size={20}/></button>
              </div>
            </div>
          </div>

          {viewType !== 'day' && (
            <div className="grid grid-cols-7 gap-4 mb-6 relative z-10">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, idx) => (
                <div key={idx} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{day}</div>
              ))}
            </div>
          )}

          <div className={`grid ${viewType === 'day' ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-7'} gap-4 relative z-10`}>
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="h-16" />;
              const dayNum = date.getDate();
              const isSelected = isSameDay(date, new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay));
              const dSummary = getDayOccupancySummary(branchFilteredJobs, date).get(dayNum) || { count: 0, unassigned: 0 };
              const hasAlert = dSummary.unassigned > 0;
              return (
                <button key={i} onClick={() => { setViewDate(date); setSelectedDay(dayNum); }} className={`relative h-16 md:h-20 rounded-[2rem] font-black text-xl transition-all flex flex-col items-center justify-center ${isSelected ? 'bg-slate-900 text-white scale-110 shadow-2xl z-20' : 'bg-white border-2 border-slate-50 text-slate-900 hover:border-slate-200'} ${dSummary.count > 0 ? (hasAlert ? 'border-red-500' : 'border-emerald-500') : ''}`}>
                  <span>{dayNum}</span>
                  {viewType === 'day' && <span className="text-[10px] uppercase tracking-widest mt-1 opacity-60 font-black italic">{format(date, 'EEEE')}</span>}
                  <div className="flex gap-1 absolute bottom-3">
                    {Array.from({ length: Math.min(dSummary.count, 3) }).map((_, dotIdx) => (
                      <span key={dotIdx} className={`w-1.5 h-1.5 rounded-full ${hasAlert ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* JOBS LIST */}
        <div className="space-y-12 pb-24 text-left">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-100 max-w-4xl mx-auto">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-3xl">Zero Operations</p>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-6 italic">Master Ledger Clear for {selectedBranch}</p>
            </div>
          ) : filteredJobs.map((job, index) => (
            <JobCard
              key={job.id} job={job} isAdmin={true} allEmployees={employeesWithOffDuty}
              unlockedJobs={unlockedJobs} isUpdating={isUpdating} toggleLock={toggleLock}
              updateJob={updateJob} deleteJob={deleteJob} setCompletingJob={setCompletingLead}
              userEmail={'clearview3cleaners@gmail.com'}
              currentDayTime={startOfDay(new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay)).getTime()}
              isNearby={index > 0 && job.city === filteredJobs[index - 1].city}
              initialExpanded={job.id === highlightedJobId}
            />
          ))}        </div>
      </div>

      {/* CONFIRMATION OVERLAY */}
      {completingLead && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[4rem] p-16 relative shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500">
            <div className="mb-12"><h2 className="text-5xl font-black uppercase italic text-slate-900 tracking-tighter leading-none mb-2">Checkout</h2></div>
            {paymentStep === 'method' && (
              <div className="space-y-8">
                <div className="grid gap-6">
                  <button onClick={() => setPaymentStep('card_manual')} className="flex items-center justify-between p-10 bg-slate-900 text-white rounded-[2.5rem] hover:bg-black transition-all group shadow-2xl active:scale-95">
                    <div className="flex items-center gap-6">
                      <CreditCard size={40} className="text-blue-400" />
                      <div className="text-left"><span className="block font-black uppercase italic text-2xl leading-none">Card</span><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 group-hover:text-blue-200">Terminal Process</span></div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-6">
                    <button onClick={() => setPaymentStep('cash_details')} className="flex flex-col items-center p-10 bg-slate-50 rounded-[2.5rem] hover:bg-emerald-50 hover:border-emerald-200 transition-all border-2 border-transparent group gap-4 shadow-sm active:scale-95"><Banknote size={32} className="text-slate-400 group-hover:text-emerald-500" /><span className="font-black uppercase italic text-[10px] tracking-widest text-slate-900">Cash</span></button>
                    <button onClick={() => setPaymentStep('check_details')} className="flex flex-col items-center p-10 bg-slate-50 rounded-[2.5rem] hover:bg-blue-50 hover:border-blue-200 transition-all border-2 border-transparent group gap-4 shadow-sm active:scale-95"><Receipt size={32} className="text-slate-400 group-hover:text-blue-500" /><span className="font-black uppercase italic text-[10px] tracking-widest text-slate-900">Check</span></button>
                  </div>
                </div>
                <button onClick={() => setCompletingLead(null)} className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-slate-900 transition-colors italic">Abort Transaction</button>
              </div>
            )}
            {paymentStep === 'card_manual' && (
              <div className="space-y-10">
                <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 text-center shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 italic">Processing Amount</p>
                  <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-transparent rounded-3xl py-8 px-10 text-5xl font-black text-slate-900 outline-none focus:border-blue-600 transition-all text-center italic shadow-xl" autoFocus />
                </div>
                <div className="flex gap-6">
                  <button onClick={() => setPaymentStep('method')} className="px-10 py-8 bg-slate-100 rounded-3xl font-black uppercase italic text-[11px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={initiateStripeCheckout} className="flex-1 py-8 bg-blue-600 text-white rounded-[3rem] font-black uppercase italic text-sm tracking-[0.2em] shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-4">
                    {isProcessingStripe ? <Loader2 size={24} className="animate-spin" /> : <CreditCard size={24} />} Process Ledger
                  </button>
                </div>
              </div>
            )}
            {paymentStep === 'cash_details' && (
              <div className="space-y-10">
                <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 text-center shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 italic">Liquidity Received</p>
                  <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-transparent rounded-3xl py-8 px-10 text-5xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all text-center italic shadow-xl" autoFocus />
                </div>
                <div className="flex gap-6">
                  <button onClick={() => setPaymentStep('method')} className="px-10 py-8 bg-slate-100 rounded-3xl font-black uppercase italic text-[11px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={() => handleJobCompletion('Cash')} className="flex-1 py-8 bg-slate-900 text-white rounded-[3rem] font-black uppercase italic text-sm tracking-[0.2em] shadow-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4">Finalize Entry <ArrowRight size={24} /></button>
                </div>
              </div>
            )}
            {paymentStep === 'check_details' && (
              <div className="space-y-8">
                <div className="grid gap-6">
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Check ID</p>
                    <input type="text" placeholder="XXXX" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} className="w-full bg-white border-2 border-transparent rounded-2xl py-6 px-8 text-2xl font-black text-slate-900 outline-none focus:border-blue-600 transition-all italic shadow-xl" autoFocus />
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic">Ledger Amount</p>
                    <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-transparent rounded-2xl py-6 px-8 text-2xl font-black text-slate-900 outline-none focus:border-blue-600 transition-all italic shadow-xl" />
                  </div>
                </div>
                <div className="flex gap-6 pt-4">
                  <button onClick={() => setPaymentStep('method')} className="px-10 py-8 bg-slate-100 rounded-3xl font-black uppercase italic text-[11px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={() => handleJobCompletion('Check')} className="flex-1 py-8 bg-slate-900 text-white rounded-[3rem] font-black uppercase italic text-sm tracking-[0.2em] shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-4 group">Process Check <ArrowRight size={24} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSchedule() {
  return (
    <Suspense fallback={
      <div className="h-screen flex flex-col items-center justify-center bg-white space-y-6">
        <Loader2 className="animate-spin text-slate-200" size={64} />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Syncing Calendar...</p>
      </div>
    }>
      <ScheduleContent />
    </Suspense>
  );
}
