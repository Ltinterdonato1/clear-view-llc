'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../../../lib/firebase';
import { 
  doc, onSnapshot, updateDoc, serverTimestamp, 
  collection, addDoc, query, where, orderBy, getDocs, limit, getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  Loader2, History, Zap, Calendar as CalendarIcon, Clock, Timer, 
  LogIn, LogOut, Receipt, DollarSign, Activity, Check, X, ChevronDown
} from 'lucide-react';
import { calculateJobStats } from '../../../lib/scheduleUtils';

interface Shift {
  id: string;
  status: string;
  startTime: any;
  endTime?: any;
  date: string;
  totalHours?: number;
  hourlyRate?: number;
  type?: string;
  paidHours?: number;
}

// --- HELPERS ---
const formatPreciseTime = (decimalHours: number) => {
  const totalSeconds = Math.round(decimalHours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
};

const generatePayPeriods = () => {
  const periods = [];
  const now = new Date();
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();
  let isFirstHalf = now.getDate() <= 15;
  const cutoffDate = new Date(2026, 0, 1);

  while (true) {
    let start, end;
    if (isFirstHalf) {
      start = new Date(currentYear, currentMonth, 1);
      end = new Date(currentYear, currentMonth, 15, 23, 59, 59);
    } else {
      start = new Date(currentYear, currentMonth, 16);
      end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    }
    if (start < cutoffDate) break;
    const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    periods.push({ label, start, end });
    if (isFirstHalf) { currentMonth--; isFirstHalf = false; if (currentMonth < 0) { currentMonth = 11; currentYear--; } } else { isFirstHalf = true; }
    if (periods.length > 50) break;
  }
  return periods;
};

export default function ClockPage() {
  const [status, setStatus] = useState<'clocked_in' | 'clocked_out' | 'loading'>('loading');
  const [loading, setLoading] = useState(true);
  const periods = useMemo(() => generatePayPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [payrollSummary, setPayrollSummary] = useState<any>(null);
  const [showPayStub, setShowPayStub] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setCurrentUser(user);
      const userEmail = user.email!.toLowerCase().trim();
      
      const unsubEmp = onSnapshot(doc(db, "employees", userEmail), (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setEmployeeData(data);
          setStatus(data.status || 'clocked_out');
        }
        setLoading(false);
      });

      return () => unsubEmp();
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const calculateMyPayroll = async () => {
      if (!currentUser || !employeeData) return;
      const userEmail = currentUser.email!.toLowerCase().trim();
      
      try {
        const attendRef = collection(db, "employees", userEmail, "attendance");
        const q = query(attendRef, where("startTime", ">=", selectedPeriod.start), where("startTime", "<=", selectedPeriod.end), orderBy("startTime", "desc"));
        const attendSnap = await getDocs(q);
        const shifts = attendSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const leadsRef = collection(db, "leads");
        const leadsQuery = query(leadsRef, where("status", "in", ["Archived", "Completed", "completed"]));
        const leadsSnap = await getDocs(leadsQuery);
        const allCompletedLeads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const timeOffBreakdown: any = {
          vacation: { paid: 0, unpaid: 0, pay: 0 },
          sick: { paid: 0, unpaid: 0, pay: 0 }
        };
        let totalWorkHours = 0;
        let workPay = 0;
        const groupingMap: any = {};

        shifts.forEach((s: any) => {
          const shiftRate = s.hourlyRate || employeeData.hourlyRate || 0;
          const shiftDate = s.startTime?.toDate?.() || new Date(s.date);
          const type = s.type || 'work';
          const groupKey = `${type}-${shiftRate}`;

          if (!groupingMap[groupKey]) {
            groupingMap[groupKey] = { type, rate: shiftRate, hours: 0, pay: 0, dates: [] };
          }
          groupingMap[groupKey].dates.push(shiftDate);

          if (type === 'work') {
            const hours = s.totalHours || 0;
            totalWorkHours += hours;
            workPay += hours * shiftRate;
            groupingMap[groupKey].hours += hours;
            groupingMap[groupKey].pay += hours * shiftRate;
          } else {
            const t = type as 'vacation' | 'sick';
            const paid = s.paidHours !== undefined ? s.paidHours : 0;
            const total = s.totalHours || 0;
            timeOffBreakdown[t].paid += paid;
            timeOffBreakdown[t].unpaid += Math.max(0, total - paid);
            timeOffBreakdown[t].pay += paid * shiftRate;
            groupingMap[groupKey].hours += paid;
            groupingMap[groupKey].pay += paid * shiftRate;
          }
        });

        const finalizedBreakdown = Object.values(groupingMap).map((group: any) => {
          const sorted = group.dates.sort((a: any, b: any) => a.getTime() - b.getTime());
          let range = 'N/A';
          if (sorted.length > 0) {
            const startStr = sorted[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = sorted[sorted.length-1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            range = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
          }
          return { ...group, dateRange: range };
        }).filter((g: any) => g.hours > 0);

        const ptoPayTotal = timeOffBreakdown.vacation.pay + timeOffBreakdown.sick.pay;
        const totalPaidHours = totalWorkHours + timeOffBreakdown.vacation.paid + timeOffBreakdown.sick.paid;

        let myTips = 0;
        let myRefs = 0;
        allCompletedLeads.forEach((lead: any) => {
          const pDate = lead.completedAt ? (typeof lead.completedAt === 'string' ? new Date(lead.completedAt) : lead.completedAt.toDate?.()) : null;
          if (pDate && pDate >= selectedPeriod.start && pDate <= selectedPeriod.end) {
            if (lead.assignedTo === employeeData.id) myTips += parseFloat(lead.tipAmount || "0");
            if (lead.referralEmployee === employeeData.id) {
              const s = calculateJobStats(lead);
              myRefs += parseFloat(s.referralBonus || "0");
            }
          }
        });

        setPayrollSummary({
          workPay,
          ptoPay: ptoPayTotal,
          tips: myTips,
          referralBonuses: myRefs,
          grossPay: workPay + ptoPayTotal + myTips + myRefs,
          totalWorkHours,
          totalPaidHours,
          timeOffBreakdown,
          lineItems: finalizedBreakdown,
          shifts,
          sickAccrued: totalPaidHours / 40,
          ptoAccrued: totalPaidHours / 40
        });

      } catch (err) { console.error(err); }
    };

    calculateMyPayroll();
  }, [currentUser, employeeData, selectedPeriod]);

  const handleClockAction = async () => {
    if (!currentUser || !employeeData) return;
    const userEmail = currentUser.email!.toLowerCase().trim();
    const empRef = doc(db, "employees", userEmail);
    const attendRef = collection(db, "employees", userEmail, "attendance");

    if (status === 'clocked_out') {
      await updateDoc(empRef, { status: 'clocked_in', lastAction: serverTimestamp() });
      await addDoc(attendRef, { 
        startTime: serverTimestamp(), 
        endTime: null, 
        date: new Date().toLocaleDateString(), 
        status: 'active',
        hourlyRate: employeeData.hourlyRate || 0,
        type: 'work'
      });
    } else {
      await updateDoc(empRef, { status: 'clocked_out', lastAction: serverTimestamp() });
      const q = query(attendRef, where("status", "==", "active"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const startTime = snap.docs[0].data().startTime.toDate();
        const hours = parseFloat(((new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
        await updateDoc(doc(db, "employees", userEmail, "attendance", snap.docs[0].id), { 
          endTime: serverTimestamp(), 
          status: 'completed', 
          totalHours: hours,
          paidHours: hours 
        });
      }
    }
  };

  if (loading || !payrollSummary) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-6">
      <Loader2 className="animate-spin text-slate-200" size={64} />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Reading Terminal...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-8 md:space-y-10 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">
      
      {/* HEADER - STACKS ON MOBILE */}
      <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-100 pb-8 gap-6 sm:gap-0">
        <div className="hidden sm:block" />

        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 w-full sm:w-auto">
          <div className="text-center sm:text-right w-full sm:w-auto">
            <p className="text-slate-400 font-black uppercase text-[8px] tracking-[0.4em] mb-1 italic leading-none">Net Payout</p>
            <h4 className="text-2xl font-black italic tracking-tighter leading-none">${payrollSummary.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
          </div>
          <div className="relative group w-full sm:min-w-[240px]">
            <select 
              className="w-full bg-slate-50 border-2 border-transparent rounded-[1.5rem] font-black text-[10px] uppercase italic p-4 outline-none focus:border-slate-900 focus:bg-white transition-all appearance-none cursor-pointer shadow-sm"
              value={selectedPeriod.label}
              onChange={(e) => setSelectedPeriod(periods.find(p => p.label === e.target.value)!)}
            >
              {periods.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-slate-900 transition-colors"><ChevronDown size={18}/></div>
          </div>
        </div>
      </div>

      {/* CLOCK CONTROL CARD - RESPONSIVE SIZING */}
      <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border-2 border-slate-900 shadow-2xl overflow-hidden relative group">
        <div className={`absolute top-0 left-0 w-2 h-full transition-colors duration-700 ${status === 'clocked_in' ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <div className="p-6 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
            <div className={`h-20 w-20 md:h-24 md:w-24 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center shadow-inner transition-all duration-500 ${status === 'clocked_in' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {status === 'clocked_in' ? <Zap size={32} className="md:size-[40px] animate-pulse" /> : <Clock size={32} className="md:size-[40px]" />}
            </div>
            <div>
              <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                {status === 'clocked_in' ? 'Active Duty' : 'Offline'}
              </h2>
            </div>
          </div>
          <button 
            onClick={handleClockAction}
            className={`w-full md:w-auto px-8 md:px-12 py-5 md:py-6 rounded-[1.5rem] md:rounded-[2rem] font-black text-lg md:text-xl uppercase italic shadow-xl transition-all active:scale-95 flex items-center justify-center gap-4 ${
              status === 'clocked_in' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-slate-900 text-white hover:bg-black'
            }`}
          >
            {status === 'clocked_in' ? <><LogOut size={20}/> End Shift</> : <><LogIn size={20}/> Start Shift</>}
          </button>
        </div>
      </div>

      {/* STATS GRID - 2 COLUMNS ON MOBILE */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">
        <div className="bg-slate-50 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between border-2 border-transparent hover:border-slate-200 transition-all">
          <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase italic mb-2 tracking-widest">Work Pay</p>
          <p className="text-xl md:text-2xl font-black text-slate-900 italic tracking-tighter">${payrollSummary.workPay.toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between border-2 border-transparent hover:border-slate-200 transition-all">
          <p className="text-[7px] md:text-[8px] font-black text-blue-600 uppercase italic mb-2 tracking-widest">Tips</p>
          <p className="text-xl md:text-2xl font-black text-blue-600 italic tracking-tighter">${payrollSummary.tips.toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between border-2 border-transparent hover:border-slate-200 transition-all">
          <p className="text-[7px] md:text-[8px] font-black text-orange-600 uppercase italic mb-2 tracking-widest">Refs</p>
          <p className="text-xl md:text-2xl font-black text-orange-600 italic tracking-tighter">${payrollSummary.referralBonuses.toFixed(2)}</p>
        </div>
        <div className="bg-slate-900 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between border-2 border-slate-800 shadow-xl">
          <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase italic mb-2 tracking-widest">PTO</p>
          <p className="text-xl md:text-2xl font-black text-white italic tracking-tighter">{employeeData.vacationBalance?.toFixed(2) || '0.00'}h</p>
        </div>
        <div className="bg-slate-900 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between border-2 border-slate-800 shadow-xl">
          <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase italic mb-2 tracking-widest">Sick</p>
          <p className="text-xl md:text-2xl font-black text-white italic tracking-tighter">{employeeData.sickBalance?.toFixed(2) || '0.00'}h</p>
        </div>
      </div>

      {/* RECENT PUNCHES - CONVERT TO MOBILE CARDS */}
      <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border-2 border-slate-50 p-6 md:p-12 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50 pb-6">
          <h4 className="text-sm font-black uppercase italic text-slate-400 tracking-widest">Recent Punches</h4>
          <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase italic tracking-widest">
            {payrollSummary.shifts.length} Records in Period
          </div>
        </div>
        
        <div className="space-y-3">
          {payrollSummary.shifts.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <Activity className="text-slate-100" size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 italic leading-none">No intelligence logs found</p>
            </div>
          ) : payrollSummary.shifts.map((punch: any) => (
            <div key={punch.id}>
              {/* DESKTOP ROW */}
              <div className="hidden md:grid grid-cols-7 gap-2 items-center p-4 rounded-[1.5rem] hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                <div className="col-span-2 flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${punch.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`} />
                  <p className="text-xs font-black text-slate-900 italic tracking-tighter">{punch.startTime?.toDate().toLocaleDateString()}</p>
                </div>
                <p className="text-xs font-bold text-slate-400">{punch.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-xs font-bold text-slate-400">{punch.endTime ? punch.endTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                <p className="text-xs font-black text-slate-900 italic">{punch.totalHours?.toFixed(2) || '0.00'}h</p>
                <p className={`text-[9px] font-black uppercase text-left italic ${punch.type === 'work' ? 'text-slate-300' : 'text-blue-600'}`}>
                  {punch.type?.replace('_', ' ') || 'work'}
                </p>
                <div className="flex justify-end pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-slate-300">
                    <Clock size={14} />
                  </div>
                </div>
              </div>

              {/* MOBILE CARD */}
              <div className="md:hidden bg-slate-50/50 p-5 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${punch.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`} />
                    <p className="text-xs font-black text-slate-900 italic uppercase">{punch.startTime?.toDate().toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase italic tracking-widest ${punch.type === 'work' ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                    {punch.type?.replace('_', ' ') || 'work'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1">Start</p>
                    <p className="text-xs font-bold text-slate-600">{punch.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div>
                    <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1">End</p>
                    <p className="text-xs font-bold text-slate-600">{punch.endTime ? punch.endTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-sm font-black text-slate-900 italic">{punch.totalHours?.toFixed(2) || '0.00'}h</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER - WRAPS ON MOBILE */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-6 pt-10 border-t border-slate-100">
          <div className="flex gap-10 md:gap-12 w-full md:w-auto justify-between md:justify-start">
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase italic mb-1 tracking-widest leading-none">Net Hours</p>
              <p className="text-xl md:text-2xl font-black text-slate-900 italic tracking-tighter">{formatPreciseTime(payrollSummary.totalPaidHours)}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-400 uppercase italic mb-1 tracking-widest leading-none">Total Payout</p>
              <p className="text-xl md:text-2xl font-black text-blue-600 italic tracking-tighter">${payrollSummary.grossPay.toFixed(2)}</p>
            </div>
          </div>
          <button 
            onClick={() => setShowPayStub(true)}
            className="w-full md:w-auto px-10 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase italic flex items-center justify-center gap-3 hover:scale-105 hover:bg-black transition-all shadow-xl shadow-slate-900/20"
          >
            <Receipt size={18} className="text-blue-400" /> 
            View Pay Stub
          </button>
        </div>
      </div>

      {/* PAY STUB MODAL */}
      {showPayStub && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] max-w-2xl w-full p-6 md:p-12 shadow-2xl border border-slate-50 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowPayStub(false)} className="absolute top-6 md:top-8 right-6 md:right-8 text-slate-200 hover:text-slate-900 p-2 transition-all hover:rotate-90"><X size={32}/></button>
            <div className="mb-8 border-b-4 border-slate-900 pb-8">
              <h2 className="text-2xl md:text-3xl font-black uppercase italic text-slate-900 tracking-tighter leading-none mb-4">Earnings <br/><span className="text-slate-200">Statement.</span></h2>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] italic leading-none">Clear View LLC</p>
            </div>
            <div className="mb-10 leading-none text-left">
              <p className="text-xl md:text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{employeeData.name}</p>
              <p className="text-[10px] font-bold text-slate-300 lowercase italic">{employeeData.email}</p>
            </div>
            <div className="space-y-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[400px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Description</th>
                      <th className="text-center py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Hours</th>
                      <th className="text-center py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Rate</th>
                      <th className="text-right py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payrollSummary.lineItems.map((group: any, idx: number) => (
                      <tr key={idx}>
                        <td className={`py-5 text-xs font-black uppercase italic tracking-tighter text-left ${group.type === 'work' ? 'text-slate-900' : 'text-blue-600'}`}>
                          {group.type === 'work' ? 'Hours Worked' : group.type === 'vacation' ? 'Paid Vacation (PTO)' : 'Paid Sick Time'} <br/>
                          <span className="text-[9px] font-black uppercase tracking-widest not-italic text-slate-900">[{group.dateRange}]</span>
                        </td>
                        <td className="py-5 text-center text-xs font-black text-slate-900 italic tracking-tighter">{group.hours.toFixed(2)}h</td>
                        <td className="py-5 text-center text-xs font-black text-slate-900 italic tracking-tighter">${group.rate.toFixed(2)}</td>
                        <td className="py-5 text-right text-xs font-black text-slate-900 italic tracking-tighter">${group.pay.toFixed(2)}</td>
                      </tr>
                    ))}

                    {payrollSummary.tips > 0 && (
                      <tr>
                        <td className="py-5 text-xs font-black text-blue-600 uppercase italic tracking-tighter text-left">Gratuity</td>
                        <td colSpan={2} className="text-center text-xs text-slate-300">—</td>
                        <td className="py-5 text-right text-xs font-black text-blue-600 italic tracking-tighter">${payrollSummary.tips.toFixed(2)}</td>
                      </tr>
                    )}
                    {payrollSummary.referralBonuses > 0 && (
                      <tr>
                        <td className="py-5 text-xs font-black text-orange-600 uppercase italic tracking-tighter text-left">Referral</td>
                        <td colSpan={2} className="text-center text-xs text-slate-300">—</td>
                        <td className="py-5 text-right text-xs font-black text-orange-600 italic tracking-tighter">${payrollSummary.referralBonuses.toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-4 border-slate-900">
                      <td colSpan={3} className="py-6 text-sm font-black text-slate-900 uppercase italic tracking-widest text-left">Total Net Payout</td>
                      <td className="py-6 text-xl md:text-2xl font-black text-slate-900 text-right italic tracking-tighter">${payrollSummary.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-4 shadow-inner text-left">
                  <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase text-slate-400 italic">Accrued This Period</span><p className="text-[8px] font-black text-slate-300 italic uppercase">1h per 40h</p></div>
                  <div className="flex gap-8">
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-400 uppercase italic text-left">Sick</p><p className="text-lg font-black text-slate-900 italic tracking-tighter text-left">+{payrollSummary.sickAccrued.toFixed(2)}h</p></div>
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-400 uppercase italic text-left">PTO</p><p className="text-lg font-black text-slate-900 italic tracking-tighter text-left">+{payrollSummary.ptoAccrued.toFixed(2)}h</p></div>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-[2rem] flex flex-col gap-4 shadow-xl text-left">
                  <span className="text-[8px] font-black uppercase text-slate-500 italic">Remaining Balance (Current)</span>
                  <div className="flex gap-8">
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-500 uppercase italic text-left">Sick</p><p className="text-lg font-black text-white italic tracking-tighter text-left">{employeeData.sickBalance?.toFixed(2) || '0.00'}h</p></div>
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-500 uppercase italic text-left">PTO</p><p className="text-lg font-black text-white italic tracking-tighter text-left">{employeeData.vacationBalance?.toFixed(2) || '0.00'}h</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
