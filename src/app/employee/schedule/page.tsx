'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  ChevronLeft, ChevronRight, X, Banknote, Mail, 
  CreditCard, Loader2, ArrowRight, Receipt, MessageSquare, Smartphone, CheckSquare, Calendar
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

  const sendPaymentLink = async (type: 'email') => {
    if (!completingLead) return;
    setIsSendingEmail(true);

    try {
      const paidAmount = parseFloat(receivedAmount) || 0;
      const name = completingLead.template?.data?.fullName || `${completingLead.firstName || ''} ${completingLead.lastName || ''}`.trim() || 'Valued Customer';
      const customerEmail = completingLead.email || completingLead.template?.data?.email || "";

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paidAmount,
          leadId: completingLead.id,
          customerEmail: customerEmail,
          customerName: name
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

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
        message: {
          subject: `Thank you for your business! - Clear View LLC`,
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
          message: {
            subject: `Payment Receipt - Clear View LLC`,
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
    <div className="p-6 md:p-12 space-y-12 min-h-screen bg-slate-50/50 text-left font-sans">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="w-full text-center py-4">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">My Schedule</h1>
          <p className="text-emerald-600 font-black uppercase text-[9px] tracking-[0.4em] italic mt-4">Crew Dispatch Portal</p>
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
              const dSummary = getDayOccupancySummary(jobs, date, userEmail || undefined).get(dayNum) || { count: 0, unassigned: 0 };
              return (
                <button key={i} onClick={() => { setViewDate(date); setSelectedDay(dayNum); }} className={`relative h-14 rounded-2xl font-black text-lg transition-all flex flex-col items-center justify-center ${isSelected ? 'bg-emerald-600 text-white scale-105 shadow-lg' : 'text-slate-800 hover:bg-slate-50'} ${dSummary.count > 0 ? 'border-2 border-emerald-500' : ''}`}>
                  {dayNum}
                  {viewType === 'day' && <span className="text-[9px] uppercase tracking-widest mt-1 opacity-60">{format(date, 'EEEE')}</span>}
                  <div className="flex gap-0.5 absolute bottom-2">
                    {Array.from({ length: Math.min(dSummary.count, 3) }).map((_, dotIdx) => (
                      <span key={dotIdx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-10">
          {filteredJobs.length > 0 ? filteredJobs.map((job, idx) => (
            <JobCard key={`${job.id}-${idx}`} job={job} isAdmin={false} setCompletingJob={setCompletingLead} userEmail={userEmail} unlockedJobs={unlockedJobs} toggleLock={toggleLock} updateJob={updateJob} isUpdating={isUpdating} currentDayTime={startOfDay(new Date(viewDate.getFullYear(), viewDate.getMonth(), selectedDay)).getTime()} />
          )) : (
            <div className="text-center py-24 bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-2xl">No Missions Assigned Today</p>
            </div>
          )}
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
                      <CreditCard size={32} className="text-emerald-400 group-hover:text-white" />
                      <div className="text-left"><span className="block font-black uppercase italic text-xl leading-none">Pay with Card</span><span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 group-hover:text-emerald-100">Secure Stripe Payment</span></div>
                    </div>
                  </button>
                  <div className="grid grid-cols-2 gap-5">
                    <button onClick={() => setPaymentStep('cash_details')} className="flex flex-col items-center p-8 bg-slate-50 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group gap-3 border-2 border-transparent hover:border-emerald-100"><Banknote size={28} className="text-slate-400 group-hover:text-emerald-500" /><span className="font-black uppercase italic text-[9px] tracking-widest">Cash</span></button>
                    <button onClick={() => setPaymentStep('check_details')} className="flex flex-col items-center p-8 bg-slate-50 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group gap-3 border-2 border-transparent hover:border-emerald-100"><Receipt size={28} className="text-slate-400 group-hover:text-emerald-500" /><span className="font-black uppercase italic text-[9px] tracking-widest">Check</span></button>
                  </div>
                </div>
                <button onClick={() => setCompletingLead(null)} className="w-full py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-colors">Return to Missions</button>
              </div>
            )}

            {paymentStep === 'card_manual' && (
              <div className="space-y-8">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Amount to Charge Card</p>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={receivedAmount} 
                    onChange={(e) => setReceivedAmount(e.target.value)} 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl py-6 px-8 text-4xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all text-center [appearance:textfield]" 
                    autoFocus 
                  />
                  <div className="mt-6 flex justify-between items-center px-4">
                    <div className="text-left">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Original Bill</p>
                      <p className="text-xl font-black text-slate-400">${completingLead?.total || completingLead?.finalPrice || '0'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic">Optional Tip</p>
                      <p className="text-2xl font-black text-emerald-600 italic leading-none">
                        ${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase italic tracking-widest">
                      100% of tips go directly to your technician!
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button 
                    disabled={isProcessingStripe || (parseFloat(receivedAmount) || 0) < (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))} 
                    onClick={initiateStripeCheckout} 
                    className={`flex-1 py-6 rounded-3xl font-black uppercase italic text-sm tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 
                      ${(parseFloat(receivedAmount) || 0) < (parseFloat(completingLead?.total || completingLead?.finalPrice || '0')) 
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                  >
                    {isProcessingStripe ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
                    {isProcessingStripe ? 'Opening Stripe...' : (parseFloat(receivedAmount) || 0) < (parseFloat(completingLead?.total || completingLead?.finalPrice || '0')) ? 'Insufficient Amount' : 'Initialize Payment'}
                  </button>
                </div>
              </div>
            )}

            {paymentStep === 'cash_details' && (
              <div className="space-y-8">
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Total Cash Received</p>
                  <input type="number" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-2xl py-6 px-8 text-4xl font-black text-slate-900 outline-none focus:border-emerald-600 transition-all text-center [appearance:textfield]" autoFocus />
                  <div className="mt-6 flex justify-between items-center px-4">
                    <div className="text-left"><p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Bill Balance</p><p className="text-xl font-black text-slate-400">${completingLead?.total || completingLead?.finalPrice || '0'}</p></div>
                    <div className="text-right"><p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic">Calculated Tip</p><p className="text-2xl font-black text-emerald-600 italic leading-none">${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}</p></div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={() => handleJobCompletion('Cash')} className="flex-1 py-6 bg-slate-900 text-white rounded-3xl font-black uppercase italic text-sm tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3">Complete Mission <ArrowRight size={18} /></button>
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
                
                <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase italic tracking-widest">Optional Tip</p>
                    <p className="text-2xl font-black text-emerald-600 italic">
                      ${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setPaymentStep('method')} className="px-8 py-6 bg-slate-100 rounded-2xl font-black uppercase italic text-[10px] tracking-widest text-slate-400 hover:bg-slate-200 transition-all">Back</button>
                  <button onClick={() => handleJobCompletion('Check')} className="flex-1 py-6 bg-slate-900 text-white rounded-3xl font-black uppercase italic text-sm tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-4">Submit Check <ArrowRight size={18} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
