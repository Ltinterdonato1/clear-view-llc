'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../lib/firebase'; 
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, where, getDocs, limit, deleteDoc, serverTimestamp } from 'firebase/firestore'; 
import { 
  Search, User, MapPin, CheckCircle2, CreditCard, 
  Banknote, Receipt, X, ChevronDown, ChevronUp, PhoneCall, 
  ExternalLink, Filter, Activity, Zap, History, CalendarPlus, Trash2, ArrowRight, Loader2, MessageSquare, Mail, Smartphone
} from 'lucide-react';
import QuoteModal from '../../../components/QuoteModal';
import JobCard from '../../../components/schedule/JobCard';
import { calculateJobStats } from '../../../lib/scheduleUtils';

export default function AdminDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [completingLead, setCompletingLead] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Leads' | 'Bookings' | 'Completed'>('All');
  
  const [unlockedJobs, setUnlockedJobs] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [historyModalLead, setHistoryModalLead] = useState<any | null>(null);
  const [lastService, setLastService] = useState<any | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);

  const [paymentStep, setPaymentStep] = useState<'method' | 'cash_details' | 'check_details' | 'card_options' | 'card_manual'>('method');
  const [checkNumber, setCheckNumber] = useState('');
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [isProcessingStripe, setIsProcessingStripe] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      await deleteDoc(doc(db, "leads", id));
      alert("Job deleted successfully.");
    } catch (err) {
      console.error("Error deleting lead:", err);
      alert("Error deleting job. Check your connection.");
    }
  };

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
      setLeads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qCrew = query(collection(db, "employees"), orderBy("name", "asc"));
    const unsubCrew = onSnapshot(qCrew, (snap) => {
      setAllEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLeads(); unsubCrew(); };
  }, []);

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
    else next.add(jobId);
    setUnlockedJobs(next);
  };

  const fetchJobHistory = async (lead: any) => {
    setHistoryModalLead(lead);
    const email = lead.email || lead.template?.data?.email;
    if (!email) { setLastService(null); return; }
    const q = query(collection(db, "leads"), where("email", "==", email), where("status", "in", ["Completed", "completed", "Archived"]), orderBy("createdAt", "desc"), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) setLastService(snap.docs[0].data());
    else setLastService(null);
  };

  const handleBookAgain = () => {
    if (!lastService && !historyModalLead) return;
    const source = lastService || historyModalLead;
    setBookingData({
      firstName: source.firstName, lastName: source.lastName, email: source.email || source.template?.data?.email,
      phone: source.phone, address: source.address, city: source.city, windowCount: source.windowCount || 0,
      stories: source.stories || 1, selectedServices: source.selectedServices || [],
      deluxeWindow: source.deluxeWindow || false, deluxeGutter: source.deluxeGutter || false,
      gutterFlush: source.gutterFlush || false, backPatio: source.backPatio || false
    });
    setIsBookingOpen(true);
    setHistoryModalLead(null);
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
        if (completingLead.trexDeckSize !== 'none') breakdownItems.push(`• Trex Light Acid Wash (${completingLead.trexDeckSize.toUpperCase()})`);
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
    } catch (err: any) {
      alert(`Error: ${err.message}`);
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

  const filteredLeads = leads.filter(lead => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (
      (lead.firstName || '').toLowerCase().includes(search) || (lead.lastName || '').toLowerCase().includes(search) || 
      (lead.template?.data?.fullName || '').toLowerCase().includes(search) || (lead.address || '').toLowerCase().includes(search) || 
      (lead.city || '').toLowerCase().includes(search)
    );
    const s = lead.status?.toLowerCase();
    const isBooked = s === 'scheduled' || (lead.actualBookedDays && lead.actualBookedDays.length > 0);
    const isCompleted = s === 'completed' || s === 'archived';
    const isNewLead = (s === 'new' || !s) && !isBooked && !isCompleted;
    let matchesFilter = false;
    if (statusFilter === 'All') matchesFilter = s !== 'archived';
    else if (statusFilter === 'Leads') matchesFilter = isNewLead;
    else if (statusFilter === 'Bookings') matchesFilter = isBooked;
    else if (statusFilter === 'Completed') matchesFilter = isCompleted;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-8 md:p-12 space-y-12 min-h-screen bg-slate-50/50 text-left font-sans">
      <div className="flex flex-col xl:flex-row justify-between items-center gap-8">
        <div className="text-center xl:text-left flex-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-4">Dashboard</h1>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input type="text" placeholder="SEARCH..." className="w-full pl-14 pr-8 py-4 bg-white rounded-2xl font-black text-[10px] uppercase italic shadow-sm outline-none border-2 border-transparent focus:border-emerald-600 transition-all" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100">
            {['All', 'Leads', 'Bookings', 'Completed'].map((f) => (
              <button key={f} onClick={() => setStatusFilter(f as any)} className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase italic transition-all ${statusFilter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        <div className="space-y-5">
          <div className="flex items-center gap-4 px-6"><Filter size={14} className="text-slate-300" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Activities</p></div>
          <div className="grid gap-4">
            {loading ? (
              <div className="text-center py-24 font-black text-slate-200 animate-pulse italic uppercase text-3xl tracking-tighter">Syncing...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100"><p className="text-slate-300 font-black uppercase tracking-widest italic text-xl">No Jobs Found</p></div>
            ) : filteredLeads.map((lead) => {
              const isExpanded = expandedLeadId === lead.id;
              if (isExpanded) {
                return (
                  <div key={`container-expanded-${lead.id}`} className="relative">
                    <button onClick={() => setExpandedLeadId(null)} className="absolute top-6 right-6 z-20 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-900 transition-all"><X size={20} /></button>
                    <JobCard 
                      job={lead} 
                      isAdmin={true} 
                      allEmployees={allEmployees} 
                      unlockedJobs={unlockedJobs} 
                      isUpdating={isUpdating} 
                      toggleLock={toggleLock} 
                      updateJob={updateJob} 
                      deleteJob={handleDeleteJob} 
                      onDeleteSuccess={() => setExpandedLeadId(null)}
                      setCompletingJob={setCompletingLead} 
                      currentDayTime={Date.now()} 
                      initialExpanded={true}
                    />
                  </div>
                );
              }
              const total = parseFloat(lead.total || lead.finalPrice || lead.template?.data?.totalAmount || '0');
              const displayFullName = lead.template?.data?.fullName || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'New Customer';
              const fullAddress = `${lead.address || ''}, ${lead.city || ''}`;
              return (
                <div key={`row-${lead.id}`} className={`bg-white rounded-[2.5rem] shadow-sm border-2 transition-all overflow-hidden border-transparent hover:border-slate-100`}>
                  <div onClick={() => setExpandedLeadId(lead.id)} className="p-8 flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${lead.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-600 transition-all'}`}><User size={20} /></div>
                      <div>
                        <div className="flex items-center gap-4"><h3 className="font-black text-slate-900 text-2xl uppercase italic leading-none tracking-tighter">{displayFullName}</h3><span className={`px-2.5 py-1 rounded-lg text-[7px] font-black uppercase italic tracking-widest ${lead.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-50 text-emerald-600'}`}>{lead.status || 'New'}</span></div>
                        <p className="text-[9px] text-slate-400 font-black mt-2 uppercase tracking-[0.2em] italic flex items-center gap-2"><MapPin size={10} className="text-emerald-600" /> {fullAddress}</p>
                      </div>
                    </div>
                    <div className="text-right"><p className="text-[9px] font-black text-slate-300 uppercase italic mb-1 tracking-[0.2em]">Job Value</p><p className="text-3xl font-black text-slate-900 italic tracking-tighter leading-none">${total.toFixed(0)}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* JOB HISTORY MODAL */}
      {historyModalLead && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-12 relative shadow-2xl animate-in zoom-in duration-300 text-center">
            <button onClick={() => setHistoryModalLead(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors bg-slate-50 p-2.5 rounded-full"><X size={24} /></button>
            <div className="mb-10 text-center">
              <h2 className="text-5xl font-black uppercase italic text-slate-900 mb-2 leading-none tracking-tighter">History</h2>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em] italic">Previous Jobs for {historyModalLead.firstName}</p>
            </div>
            {lastService ? (
              <div className="space-y-8 text-left">
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-5 italic">Last Job Specs</p>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div><p className="text-[8px] font-black text-emerald-600 uppercase italic">Revenue Yield</p><p className="text-3xl font-black text-slate-900 italic">${lastService.total || lastService.template?.data?.totalAmount}</p></div>
                    <div><p className="text-[8px] font-black text-emerald-600 uppercase italic">Execution Date</p><p className="text-xl font-black text-slate-900 italic">{lastService.completedAt ? new Date(lastService.completedAt).toLocaleDateString() : 'Historical'}</p></div>
                  </div>
                  <div className="space-y-3"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Services Rendered</p><div className="flex flex-wrap gap-2">{(lastService.selectedServices || []).map((s: string) => (<span key={s} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase italic tracking-widest">{s}</span>))}</div></div>
                </div>
                <button onClick={handleBookAgain} className="w-full py-6 bg-emerald-600 text-white rounded-3xl font-black uppercase italic text-lg tracking-tighter shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-4"><CalendarPlus size={24} /> Book Again</button>
              </div>
            ) : (
              <div className="text-center py-16 space-y-5">
                <div className="bg-slate-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto text-slate-200"><Zap size={32} /></div>
                <p className="text-xs font-black text-slate-300 uppercase italic tracking-widest">No previous jobs found.</p>
                <button onClick={handleBookAgain} className="px-8 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest hover:bg-emerald-600 transition-all">Initialize New Job</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {completingLead && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-12 relative shadow-2xl animate-in zoom-in duration-300">
            <div className="mb-10 text-center"><h2 className="text-5xl font-black uppercase italic text-slate-900 mb-2 leading-none tracking-tighter">Confirmation</h2></div>
            
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
                <button onClick={() => { setCompletingLead(null); setPaymentStep('method'); }} className="w-full py-4 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-900 transition-colors">Return to Dashboard</button>
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
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase italic tracking-widest">
                      100% of tips go directly to your technician!
                    </p>
                  </div>
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
                
                <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase italic tracking-widest">Optional Tip</p>
                    <p className="text-2xl font-black text-emerald-600 italic">
                      ${Math.max(0, (parseFloat(receivedAmount) || 0) - (parseFloat(completingLead?.total || completingLead?.finalPrice || '0'))).toFixed(2)}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-emerald-100/50 text-center">
                    <p className="text-[9px] font-black text-emerald-600/70 uppercase italic tracking-widest">
                      100% of tips go directly to your technician!
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
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

      <QuoteModal isOpen={isBookingOpen} onClose={() => { setIsBookingOpen(false); setBookingData(null); }} isEmployeeBooking={true} prefillData={bookingData} />
    </div>
  );
}
