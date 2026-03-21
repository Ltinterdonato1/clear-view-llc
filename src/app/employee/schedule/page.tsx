'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, functions } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { 
  ChevronLeft, ChevronRight, X, Banknote, Mail, 
  CreditCard, Loader2, ArrowRight, Receipt, MessageSquare, Smartphone, CheckSquare, Calendar,
  Activity, MapPin, User, ChevronDown, Filter, Zap, Clock
} from 'lucide-react';
import { startOfDay, startOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, isSameDay, format } from 'date-fns';
import { getDayOccupancySummary, filterJobsBySelectedDay, calculateJobStats } from '../../../lib/scheduleUtils';
import JobCard from '../../../components/schedule/JobCard';

export default function CrewSchedule() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  const [completingLead, setCompletingLead] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUserEmail(user.email?.toLowerCase() || null);
    });

    const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
    const unsubLeads = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubAuth(); unsubLeads(); };
  }, []);

  const monthFull = format(viewDate, 'MMMM yyyy');

  const updateJob = async (id: string, currentJobData: any, updates: any, bypassLock = false) => {
    if (!unlockedJobs.has(id) && !bypassLock) return;
    setIsUpdating(id);
    try {
      const mergedData = { ...currentJobData, ...updates };
      const mStats = calculateJobStats(mergedData);
      const finalFields = { 
        ...updates, 
        total: mStats.total, 
        timeDisplay: mStats.timeDisplay, 
        selectedServices: mStats.srv,
        template: {
          ...currentJobData.template,
          name: currentJobData.template?.name || 'confirmation',
          data: {
            ...currentJobData.template?.data,
            total: mStats.total,
            timeDisplay: mStats.timeDisplay,
            services: mStats.srv.join(', ')
          }
        }
      };
      await updateDoc(doc(db, "leads", id), finalFields);
    } catch (err) { console.error(err); } finally { setIsUpdating(null); }
  };

  const toggleLock = (jobId: string) => {
    const next = new Set(unlockedJobs);
    if (unlockedJobs.has(jobId)) next.delete(jobId);
    else {
      const pass = prompt("Enter 1234 to Unlock Edit Authority:");
      if (pass === '1234') next.add(jobId);
    }
    setUnlockedJobs(next);
  };

  const initiateStripeCheckout = async () => {
    if (!completingLead) return;
    setIsProcessingStripe(true);
    try {
      const paidAmount = parseFloat(receivedAmount) || 0;
      const name = completingLead.template?.data?.fullName || `${completingLead.firstName || ''} ${completingLead.lastName || ''}`.trim() || 'Valued Customer';
      
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

  const sendPaymentLink = async (type: 'email') => {
    if (!completingLead) return;
    setIsSendingEmail(true);

    try {
      const paidAmount = parseFloat(receivedAmount) || 0;
      const name = completingLead.template?.data?.fullName || `${completingLead.firstName || ''} ${completingLead.lastName || ''}`.trim() || 'Valued Customer';
      const customerEmail = completingLead.email || completingLead.template?.data?.email || "";

      const createStripeCheckout = httpsCallable(functions, 'createStripeCheckout');
      const result = await createStripeCheckout({
        amount: paidAmount,
        leadId: completingLead.id,
        customerEmail: customerEmail,
        customerName: name
      });
      const data = result.data as { url: string };
      if (!data.url) throw new Error("Failed to generate payment link.");

      // --- Service Breakdown Logic ---
      const breakdownItems: string[] = [];
      if (completingLead.selectedServices?.includes('Window Cleaning')) {
        let winStr = `• Window Cleaning (${completingLead.windowType?.toUpperCase()})`;
        if (completingLead.deluxeWindow) winStr += ` + Deluxe Screen Detail`;
        breakdownItems.push(winStr);
        if (Number(completingLead.skylightCount) > 0) breakdownItems.push(`• Skylights (Exterior): ${completingLead.skylightCount}`);
        if (Number(completingLead.skylightInteriorCount) > 0) breakdownItems.push(`• Skylights (Interior): ${completingLead.skylightInteriorCount}`);
      }
      if (completingLead.selectedServices?.includes('Gutter Cleaning')) {
        let gutStr = `• Gutter Cleaning (${completingLead.homeSize} Bed)`;
        if (completingLead.gutterFlush) breakdownItems.push(`• Downspout Flush Service`);
        if (completingLead.deluxeGutter) breakdownItems.push(`• Exterior Gutter Wash`);
        breakdownItems.push(gutStr);
      }
      if (completingLead.selectedServices?.includes('Roof Cleaning')) {
        if (completingLead.roofBlowOff) breakdownItems.push(`• Roof Debris Blow-off`);
        if (completingLead.mossTreatment) breakdownItems.push(`• Professional Moss Treatment`);
      }
      if (completingLead.selectedServices?.includes('Pressure Washing')) {
        if (completingLead.drivewaySize !== 'none') breakdownItems.push(`• Driveway Pressure Wash (${completingLead.drivewaySize} Car)`);
        if (completingLead.patioSize !== 'none') breakdownItems.push(`• Back Patio & Walkway Wash (${completingLead.patioSize.toUpperCase()})`);
        if (completingLead.sidingCleaning) breakdownItems.push(`• Full Siding Soft-Wash`);
        if (completingLead.fenceSize !== 'none') breakdownItems.push(`• Cedar Fence Restoration (${completingLead.fenceSize} ft)`);
        if (completingLead.trexDeckSize !== 'none') breakdownItems.push(`• Trex Acid Wash (${completingLead.trexDeckSize.toUpperCase()})`);
      }
      const finalBreakdown = breakdownItems.join('\n');

      if (!customerEmail) throw new Error("No email address found for this customer.");
      await addDoc(collection(db, "mail"), {
        to: [customerEmail],
        from: 'clearview3cleaners@gmail.com',
        message: {
          subject: `Thank you for your business! - Clear View LLC`,
          text: `Service Complete at ${completingLead.address}. Please pay your invoice online. Thank you for choosing Clear View LLC!`,
          html: `
<!DOCTYPE html>
<html>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background-color: #f1f5f9; margin: 0; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);">
        <div style="background: #0f172a; padding: 60px 40px; text-align: center;">
            <div style="display: inline-block; padding: 12px 24px; border: 1px solid #334155; border-radius: 100px; margin-bottom: 24px;">
                <span style="color: #38bdf8; font-size: 10px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">Service Complete</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 42px; font-weight: 900; letter-spacing: -2px; text-transform: uppercase; font-style: italic;">Clear View</h1>
            <p style="color: #64748b; margin: 8px 0; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; font-size: 11px;">Elite Exterior Maintenance</p>
        </div>
        <div style="padding: 50px 40px;">
            <p style="font-size: 20px; line-height: 1.5; margin-bottom: 40px; color: #334155; font-weight: 300;">
                Hi <strong style="font-weight: 800; color: #0f172a;">${name}</strong>, thank you so much for choosing Clear View LLC! It was a pleasure servicing your home at <span style="color: #0284c7; font-weight: 600;">${completingLead.address}</span>.
            </p>
            <div style="margin-bottom: 40px;">
                <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #94a3b8; margin-bottom: 20px; font-weight: 800; text-align: center;">Service Summary</h3>
                <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 20px; padding: 25px; font-size: 14px; font-weight: 500; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); white-space: pre-line; line-height: 1.8;">
${finalBreakdown}
                </div>
            </div>
            <div style="background: #0f172a; border-radius: 24px; padding: 35px; color: #ffffff; text-align: center;">
                <p style="color: #94a3b8; font-size: 13px; margin-bottom: 10px;">Amount Due</p>
                <h2 style="font-size: 48px; font-weight: 900; color: #38bdf8; margin: 0 0 30px 0;">$${paidAmount.toFixed(2)}</h2>
                <a href="${data.url}" style="display: inline-block; background: #38bdf8; color: #0f172a; padding: 20px 40px; border-radius: 16px; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">Pay Invoice Online</a>
            </div>
            <p style="margin-top: 40px; text-align: center; color: #64748b; font-size: 14px; font-style: italic;">"Thank you for having us! We hope to see you again soon."</p>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-top: 1px solid #f1f5f9;">
            <div style="border-top: 1px solid #e2e8f0; text-align: center; padding-top: 30px;">
                <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-weight: 800; margin-bottom: 15px;">Clear View LLC</p>
                <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">📞 (206) 848-9325</p>
                <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 25px;">📧 clearview3cleaners@gmail.com</p>
            </div>
        </div>
    </div>
</body>
</html>
            `
        }
      });
              alert(`Invoice queued for delivery to ${customerEmail}`);
              
              // Mark job as Completed (Work done, awaiting Stripe payment)
              const leadRef = doc(db, "leads", completingLead.id);
              await updateDoc(leadRef, { 
                status: 'Completed',
                invoiceSentAt: serverTimestamp() 
              });
              
              setCompletingLead(null);
            } catch (err: any) {      alert(`Error: ${err.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleJobCompletion = async (method: 'Card' | 'Cash' | 'Check') => {
    if (!completingLead) return;
    const leadRef = doc(db, "leads", completingLead.id);
    const total = parseFloat(completingLead.total || completingLead.finalPrice || completingLead.template?.data?.totalAmount || '0');
    const received = parseFloat(receivedAmount) || total;
    const tip = Math.max(0, received - total);
    const customerEmail = completingLead.email || completingLead.template?.data?.email;
    const name = completingLead.template?.data?.fullName || `${completingLead.firstName || ''} ${completingLead.lastName || ''}`.trim() || 'Valued Customer';

    try {
      await updateDoc(leadRef, {
        status: 'Archived',
        paymentMethod: method,
        checkNumber: method === 'Check' ? checkNumber : '',
        collectedAmount: received,
        tipAmount: tip,
        paymentStatus: 'Paid In Full',
        completedAt: new Date().toISOString()
      });

      if (customerEmail) {
        await addDoc(collection(db, "mail"), {
          to: [customerEmail],
          from: 'clearview3cleaners@gmail.com',
          message: {
            subject: `Payment Receipt - Clear View LLC`,
            text: `Payment Received for service at ${completingLead.address}. Thank you for your business!`,
            html: `
<!DOCTYPE html>
<html>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background-color: #f1f5f9; margin: 0; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);">
        <div style="background: #0f172a; padding: 60px 40px; text-align: center;">
            <div style="display: inline-block; padding: 12px 24px; border: 1px solid #334155; border-radius: 100px; margin-bottom: 24px;">
                <span style="color: #10b981; font-size: 10px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">Payment Received</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 42px; font-weight: 900; letter-spacing: -2px; text-transform: uppercase; font-style: italic;">Clear View</h1>
            <p style="color: #64748b; margin: 8px 0; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; font-size: 11px;">Elite Exterior Maintenance</p>
        </div>
        <div style="padding: 50px 40px;">
            <p style="font-size: 20px; line-height: 1.5; margin-bottom: 40px; color: #334155; font-weight: 300;">
                Hi <strong style="font-weight: 800; color: #0f172a;">${name}</strong>, thank you for your payment! Your receipt for the service at <span style="color: #0284c7; font-weight: 600;">${completingLead.address}</span> is below.
            </p>
            <div style="background: #f8fafc; border-radius: 24px; padding: 35px; border: 1px solid #e2e8f0; margin-bottom: 40px;">
                <table width="100%" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 15px; color: #94a3b8; font-size: 13px;">Payment Method</td>
                        <td style="padding-bottom: 15px; text-align: right; font-weight: 800; color: #0f172a;">${method}</td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 15px; color: #94a3b8; font-size: 13px;">Total Paid</td>
                        <td style="padding-bottom: 15px; text-align: right; font-weight: 800; color: #0f172a;">$${received.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 16px; font-weight: 800; color: #0f172a;">Balance Remaining</td>
                        <td style="padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: right; font-size: 24px; font-weight: 900; color: #10b981;">$0.00</td>
                    </tr>
                </table>
            </div>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-top: 1px solid #f1f5f9;">
            <div style="border-top: 1px solid #e2e8f0; text-align: center; padding-top: 30px;">
                <p style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; font-style: italic;">We appreciate your business!</p>
                <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-weight: 800; margin-bottom: 15px;">Clear View LLC</p>
                <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">📞 (206) 848-9325</p>
                <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 25px;">📧 clearview3cleaners@gmail.com</p>
            </div>
        </div>
    </div>
</body>
</html>
            `
          }
        });
      }

      setCompletingLead(null);
      setCheckNumber('');
      setReceivedAmount('');
      setPaymentStep('method');
    } catch (err) { console.error(err); }
  };

  const filteredJobs = useMemo(() => {
    return filterJobsBySelectedDay(jobs, viewDate, selectedDay, userEmail || undefined);
  }, [jobs, selectedDay, viewDate, userEmail]);

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

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-12 min-h-screen bg-white text-left font-sans text-slate-900 max-w-[1600px] mx-auto">
      <div className="space-y-12">
        {/* HEADER MATCHING TERMINAL STYLE */}
        <div className="flex flex-col xl:flex-row justify-end items-center gap-8 border-b border-slate-100 pb-12">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <p className="text-slate-400 font-black uppercase text-[8px] tracking-[0.4em] mb-1 italic leading-none">System Date</p>
              <h4 className="text-2xl font-black italic tracking-tighter leading-none uppercase">{format(new Date(), 'MMM dd, yyyy')}</h4>
            </div>
            <div className="flex bg-slate-50 rounded-[1.5rem] p-1.5 shadow-sm border border-slate-100">
              {(['day', 'week', 'month'] as const).map((t) => (
                <button 
                  key={t} 
                  onClick={() => setViewType(t)} 
                  className={`px-6 py-3 rounded-xl font-black text-[9px] uppercase italic transition-all ${viewType === t ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CALENDAR INTERFACE - UPGRADED AESTHETIC */}
        <div className="bg-white rounded-[3.5rem] p-10 shadow-2xl border-2 border-slate-50 text-center mx-auto relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-2 h-full bg-slate-900 transition-all duration-500 group-hover:bg-emerald-500" />
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-8 mb-12 px-6">
            <div className="flex items-center gap-6">
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
                <Calendar size={24} />
              </div>
              <h2 className="text-4xl font-black uppercase italic text-slate-900 tracking-tighter">{monthFull}</h2>
            </div>
            
            <div className="flex gap-3">
              <button onClick={handlePrev} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"><ChevronLeft size={24}/></button>
              <button onClick={handleNext} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"><ChevronRight size={24}/></button>
            </div>
          </div>

          {viewType !== 'day' && (
            <div className="grid grid-cols-7 gap-4 mb-6 px-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                <div key={idx} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] italic">{day}</div>
              ))}
            </div>
          )}

          <div className={`grid ${viewType === 'day' ? 'grid-cols-1 max-w-sm mx-auto' : 'grid-cols-7'} gap-4 px-4 pb-4`}>
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="h-20" />;
              const dayNum = date.getDate();
              const isSelected = isSameDay(date, new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay));
              const isToday = isSameDay(date, new Date());
              const dSummary = getDayOccupancySummary(jobs, date, userEmail || undefined).get(dayNum) || { count: 0, unassigned: 0 };
              
              return (
                <button 
                  key={i} 
                  onClick={() => { setViewDate(date); setSelectedDay(dayNum); }} 
                  className={`relative h-24 rounded-[2rem] font-black text-2xl transition-all duration-500 flex flex-col items-center justify-center border-2 group
                    ${isSelected ? 'bg-slate-900 text-white scale-105 shadow-2xl border-slate-900 z-10' : 
                      isToday ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      dSummary.count > 0 ? 'bg-white text-slate-900 border-slate-100 hover:border-slate-900' : 
                      'bg-white text-slate-300 border-transparent hover:border-slate-100'}`}
                >
                  {dayNum}
                  {viewType === 'day' && <span className="text-[10px] uppercase tracking-[0.2em] mt-2 opacity-60 font-bold">{format(date, 'EEEE')}</span>}
                  
                  {dSummary.count > 0 && (
                    <div className="flex gap-1 absolute bottom-4">
                      {Array.from({ length: Math.min(dSummary.count, 3) }).map((_, dotIdx) => (
                        <span key={dotIdx} className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MISSIONS LIST */}
        <div className="space-y-10 pt-8">
          <div className="flex items-center justify-between px-8">
            <div className="flex items-center gap-4">
              <Activity size={14} className="text-slate-300" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Daily Assignments</p>
            </div>
            <div className="bg-slate-50 px-5 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase italic tracking-widest">
              {filteredJobs.length} Operations Detected
            </div>
          </div>

          <div className="grid gap-6">
            {filteredJobs.length > 0 ? filteredJobs.map((job, idx) => (
              <div key={`${job.id}-${idx}`} className="animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                <JobCard 
                  job={job} 
                  isAdmin={false} 
                  setCompletingJob={setCompletingLead} 
                  userEmail={userEmail} 
                  unlockedJobs={unlockedJobs} 
                  toggleLock={toggleLock} 
                  updateJob={updateJob} 
                  isUpdating={isUpdating} 
                  currentDayTime={startOfDay(new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay)).getTime()} 
                />
              </div>
            )) : (
              <div className="text-center py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-100 flex flex-col items-center gap-6">
                <div className="p-6 bg-white rounded-3xl shadow-sm text-slate-100">
                  <Zap size={48} />
                </div>
                <p className="text-slate-300 font-black uppercase tracking-[0.2em] italic text-2xl">No Missions assigned for this sector</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL - MATCHING ADMIN */}
      {completingLead && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6 text-center">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 relative shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="mb-12 border-b-4 border-slate-900 pb-8">
              <h2 className="text-5xl font-black uppercase italic text-slate-900 tracking-tighter leading-none mb-4">Confirm <br/><span className="text-slate-200">Completion.</span></h2>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] italic leading-none">Mission Finalization Terminal</p>
            </div>
            
            {paymentStep === 'method' && (
              <div className="space-y-8">
                <div className="grid gap-5">
                  <button onClick={() => setPaymentStep('card_manual')} className="flex items-center justify-between p-8 bg-slate-900 text-white rounded-[2rem] hover:bg-black transition-all group shadow-2xl">
                    <div className="flex items-center gap-6">
                      <div className="bg-white/10 p-3 rounded-xl">
                        <CreditCard size={32} className="text-blue-400" />
                      </div>
                      <div className="text-left">
                        <span className="block font-black uppercase italic text-2xl leading-none tracking-tighter">Pay with Card</span>
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2 group-hover:text-blue-300 transition-colors">Secure Stripe Payment</span>
                      </div>
                    </div>
                    <ArrowRight size={24} className="text-slate-700 group-hover:text-white transition-all" />
                  </button>
                  <div className="grid grid-cols-2 gap-5">
                    <button onClick={() => setPaymentStep('cash_details')} className="flex flex-col items-center p-8 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group gap-4 border-2 border-transparent hover:border-slate-200 shadow-sm">
                      <div className="bg-white p-4 rounded-2xl shadow-sm text-slate-400 group-hover:text-emerald-500 transition-all"><Banknote size={32} /></div>
                      <span className="font-black uppercase italic text-[10px] tracking-widest text-slate-400 group-hover:text-slate-900">Cash Payment</span>
                    </button>
                    <button onClick={() => setPaymentStep('check_details')} className="flex flex-col items-center p-8 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group gap-4 border-2 border-transparent hover:border-slate-200 shadow-sm">
                      <div className="bg-white p-4 rounded-2xl shadow-sm text-slate-400 group-hover:text-blue-500 transition-all"><Receipt size={32} /></div>
                      <span className="font-black uppercase italic text-[10px] tracking-widest text-slate-400 group-hover:text-slate-900">Check Payment</span>
                    </button>
                  </div>
                </div>
                <button onClick={() => setCompletingLead(null)} className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 hover:text-slate-900 transition-colors italic">Abort Finalization</button>
              </div>
            )}

            {/* PAYMENT STEP UI UPDATED TO MATCH ADMIN PREMIUM STYLE */}
            {paymentStep === 'card_manual' && (
              <div className="space-y-10">
                <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-slate-100 text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 italic">Amount to Charge Card</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-3xl">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={receivedAmount} 
                      onChange={(e) => setReceivedAmount(e.target.value)} 
                      className="w-full bg-white border-2 border-slate-100 rounded-3xl py-8 px-12 text-5xl font-black text-slate-900 outline-none focus:border-slate-900 transition-all text-center [appearance:textfield] shadow-sm" 
                      autoFocus 
                    />
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-6 px-4">
                    <div className="text-left border-r border-slate-200">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic mb-1">Bill Total</p>
                      <p className="text-2xl font-black text-slate-400 tracking-tighter leading-none">${completingLead?.total || completingLead?.finalPrice || '0'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic mb-1">Crew Tip</p>
                      <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">
                        ${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all border border-transparent">Back</button>
                  <button 
                    disabled={isProcessingStripe || (parseFloat(receivedAmount) || 0) < (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))} 
                    onClick={initiateStripeCheckout} 
                    className={`flex-1 py-6 rounded-[2rem] font-black uppercase italic text-xs tracking-widest shadow-2xl transition-all flex items-center justify-center gap-4
                      ${(parseFloat(receivedAmount) || 0) < (parseFloat(completingLead?.total || completingLead?.finalPrice || '0')) 
                        ? 'bg-slate-50 text-slate-200 cursor-not-allowed border-2 border-dashed border-slate-100' 
                        : 'bg-slate-900 text-white hover:bg-black'}`}
                  >
                    {isProcessingStripe ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} className="text-blue-400" />}
                    {isProcessingStripe ? 'Opening Secure Portal...' : (parseFloat(receivedAmount) || 0) < (parseFloat(completingLead?.total || completingLead?.finalPrice || '0')) ? 'Insufficient Funds' : 'Initialize Stripe Pay'}
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'cash_details' && (
              <div className="space-y-10">
                <div className="bg-slate-50 p-10 rounded-[2.5rem] border-2 border-slate-100 text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 italic">Total Cash Collected</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-3xl">$</span>
                    <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-3xl py-8 px-12 text-5xl font-black text-slate-900 outline-none focus:border-slate-900 transition-all text-center [appearance:textfield] shadow-sm" autoFocus />
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-6 px-4">
                    <div className="text-left border-r border-slate-200">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic mb-1">Service Fee</p>
                      <p className="text-2xl font-black text-slate-400 tracking-tighter leading-none">${completingLead?.total || completingLead?.finalPrice || '0'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic mb-1">Crew Tip</p>
                      <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all border border-transparent">Back</button>
                  <button onClick={() => handleJobCompletion('Cash')} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic text-xs tracking-widest shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4">Finalize Mission <ArrowRight size={20} /></button>
                </div>
              </div>
            )}

            {paymentStep === 'check_details' && (
              <div className="space-y-8 text-left">
                <div className="grid gap-6">
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 italic ml-2">Verification #</p>
                    <input type="text" placeholder="CHECK NUMBER" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 px-8 text-2xl font-black text-slate-900 outline-none focus:border-slate-900 transition-all shadow-sm" autoFocus />
                  </div>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 italic ml-2">Check Amount</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-2xl">$</span>
                      <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 px-10 text-3xl font-black text-slate-900 outline-none focus:border-slate-900 transition-all [appearance:textfield] shadow-sm" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-emerald-50/50 p-8 rounded-[2rem] border-2 border-emerald-100/50 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase italic tracking-widest mb-1">Bonus Gratuity</p>
                    <p className="text-3xl font-black text-emerald-600 italic tracking-tighter leading-none">
                      ${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl shadow-sm text-emerald-500">
                    <Zap size={24} />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all border border-transparent">Back</button>
                  <button onClick={() => handleJobCompletion('Check')} className="flex-1 py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic text-xs tracking-widest shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4">Transmit Check <ArrowRight size={20} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
