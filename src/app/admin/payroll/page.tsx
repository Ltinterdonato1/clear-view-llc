'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, functions } from '../../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
  collection, query, where, getDocs, orderBy, doc, deleteDoc, updateDoc, 
  onSnapshot, writeBatch, serverTimestamp, addDoc, limit
} from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions';
import { 
  DollarSign, Users, UserPlus, Trash2, Loader2, Save, 
  X, LogOut, LogIn, ChevronDown, Receipt, Plus, Check, BarChart3, ChevronUp, Edit, Clock, Palmtree, Stethoscope, Briefcase, Coins, Activity, CalendarCheck, ShieldCheck
} from 'lucide-react';
import { calculateJobStats } from '../../../lib/scheduleUtils';
import EditablePunchRow from '../../../components/admin/EditablePunchRow';
import AddPunchForm from '../../../components/admin/AddPunchForm';

const BRANCHES = ['Tri-Cities', 'Walla Walla', 'Tacoma', 'Puyallup'];
const ROLES = ['field_employee', 'admin'];
const OWNER_EMAIL = 'clearview3cleaners@gmail.com';

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

export default function UnifiedPayrollStaff() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'payroll' | 'staff'>('payroll');
  
  // SHARED STATE
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // PAYROLL STATE
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [unassignedLeadsCount, setUnassignedLeadsCount] = useState(0);
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);
  const [payStubEmployee, setPayStubEmployee] = useState<any | null>(null);
  const periods = useMemo(() => generatePayPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [expandedPunches, setExpandedPunches] = useState<any[]>([]);
  const [editingPunch, setEditingPunch] = useState<any | null>(null);
  const [isAddingPunch, setIsAddingPunch] = useState(false);

  // STAFF STATE
  const [isAddFormOpen, setIsAddStaffOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState<string | null>(null);

  // ADD FORM STATE
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('field_employee');
  const [selectedBranches, setSelectedBranches] = useState<string[]>(['Tri-Cities']);
  const [hourlyRate, setHourlyRate] = useState('20');
  const [vacationBalance, setVacationBalance] = useState('0');
  const [sickBalance, setSickBalance] = useState('0');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
      setCurrentUser(user);
    });

    const q = query(collection(db, "employees"), orderBy("role", "asc"));
    const unsubscribeStaff = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(docs);
      setLoading(false);
    });

    return () => { unsubscribeAuth(); unsubscribeStaff(); };
  }, [router]);

  // --- PAYROLL CALCULATION ---
  useEffect(() => {
    const calculatePayroll = async () => {
      if (employees.length === 0 || activeTab !== 'payroll') return;
      setLoading(true);
      try {
        const leadsRef = collection(db, "leads");
        const leadsQuery = query(leadsRef, where("status", "in", ["Archived", "Completed", "completed"]));
        const leadsSnap = await getDocs(leadsQuery);
        const allCompletedLeads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Track unassigned leads for this period
        const unassigned = allCompletedLeads.filter((lead: any) => {
          const pDate = lead.completedAt ? (typeof lead.completedAt === 'string' ? new Date(lead.completedAt) : lead.completedAt.toDate?.()) : null;
          return pDate && pDate >= selectedPeriod.start && pDate <= selectedPeriod.end && !lead.assignedTo;
        });
        setUnassignedLeadsCount(unassigned.length);

        const report = [];
        for (const emp of employees) {
          const attendRef = collection(db, "employees", emp.id, "attendance");
          const q = query(attendRef, where("startTime", ">=", selectedPeriod.start), where("startTime", "<=", selectedPeriod.end));
          const snap = await getDocs(q);
          const empShifts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          const timeOffBreakdown: { 
            vacation: { paid: number, unpaid: number, pay: number }, 
            sick: { paid: number, unpaid: number, pay: number } 
          } = {
            vacation: { paid: 0, unpaid: 0, pay: 0 },
            sick: { paid: 0, unpaid: 0, pay: 0 }
          };
          let totalWorkHours = 0;
          let workPay = 0;

          // Grouping by [type] and [rate] for precise date ranges
          const groupingMap: { [key: string]: { type: string, rate: number, hours: number, pay: number, dates: Date[] } } = {};

          empShifts.forEach((s: any) => {
            const shiftRate = s.hourlyRate || emp.hourlyRate || 0;
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
            } else { // vacation or sick
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

          // Finalize breakdowns with formatted date ranges
          const finalizedBreakdown = Object.values(groupingMap).map((group) => {
            const sorted = group.dates.sort((a, b) => a.getTime() - b.getTime());
            let range = 'N/A';
            if (sorted.length > 0) {
              const startStr = sorted[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const endStr = sorted[sorted.length-1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              range = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
            }
            return {
              ...group,
              dateRange: range
            };
          }).filter(g => g.hours > 0);

          const ptoPayTotal = timeOffBreakdown.vacation.pay + timeOffBreakdown.sick.pay;
          const totalPaidHours = totalWorkHours + timeOffBreakdown.vacation.paid + timeOffBreakdown.sick.paid;

          let empTips = 0;
          let empReferralBonuses = 0;

          allCompletedLeads.forEach((lead: any) => {
            const pDate = lead.completedAt ? (typeof lead.completedAt === 'string' ? new Date(lead.completedAt) : lead.completedAt.toDate?.()) : null;
            if (pDate && pDate >= selectedPeriod.start && pDate <= selectedPeriod.end) {
              if (lead.assignedTo === emp.id) empTips += parseFloat(lead.tipAmount || "0");
              if (lead.referralEmployee === emp.id) {
                const s = calculateJobStats(lead);
                empReferralBonuses += parseFloat(s.referralBonus || "0");
              }
            }
          });            

          report.push({ 
            ...emp, 
            workPay,
            ptoPay: ptoPayTotal,
            lineItems: finalizedBreakdown,
            tips: empTips,
            referralBonuses: empReferralBonuses,
            grossPay: workPay + ptoPayTotal + empTips + empReferralBonuses,
            sickAccrued: totalPaidHours / 40,
            ptoAccrued: totalPaidHours / 40,
            timeOffBreakdown,
            totalWorkHours,
            totalPaidHours
          });
        }
        setPayrollData(report);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    calculatePayroll();
  }, [employees, selectedPeriod, activeTab, refreshTrigger]);

  const [punchesLimit, setPunchesLimit] = useState(8);

  const fetchPunches = async () => {
    if (expandedTechId) {
      const attendRef = collection(db, "employees", expandedTechId, "attendance");
      const q = query(attendRef, orderBy("startTime", "desc"), limit(punchesLimit));
      const snap = await getDocs(q);
      const punches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpandedPunches(punches);
    } else {
      setExpandedPunches([]);
    }
  };

  useEffect(() => {
    if (expandedTechId) {
      fetchPunches();
    }
  }, [expandedTechId, punchesLimit, refreshTrigger]);

  const grandTotal = payrollData.reduce((sum, e) => sum + e.grossPay, 0);

  // --- HANDLERS ---
  const handleManualToggleClock = async (member: any) => {
    const isClockedIn = member.status === 'clocked_in';
    const attendRef = collection(db, "employees", member.id, "attendance");
    try {
      if (isClockedIn) {
        const q = query(attendRef, where("status", "==", "active"));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        if (!snap.empty) {
          snap.forEach(shiftDoc => {
            const startTime = shiftDoc.data().startTime?.toDate() || new Date();
            const totalHours = Math.max(0, (new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60));
            batch.update(doc(db, "employees", member.id, "attendance", shiftDoc.id), {
              endTime: serverTimestamp(),
              totalHours: parseFloat(totalHours.toFixed(2)),
              status: 'completed'
            });
          });
        }
        batch.update(doc(db, "employees", member.id), { status: 'clocked_out', lastAction: serverTimestamp() });
        await batch.commit();
      } else {
        await updateDoc(doc(db, "employees", member.id), { status: 'clocked_in', lastAction: serverTimestamp() });
        await addDoc(attendRef, {
          startTime: serverTimestamp(), 
          date: new Date().toLocaleDateString(), 
          status: 'active', 
          totalHours: 0,
          hourlyRate: parseFloat(String(member.hourlyRate)) || 0
        });
      }
      setRefreshTrigger(p => p + 1);
    } catch (err) { console.error(err); }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;
    setIsSubmitting(true);
    try {
      const createStaffAccount = httpsCallable(functions, 'createStaffAccount');
      await createStaffAccount({ 
        email: email.toLowerCase().trim(), password, name: fullName, phone, role,
        homeBranches: selectedBranches,
        hourlyRate: parseFloat(hourlyRate) || 0,
        vacationBalance: parseFloat(vacationBalance) || 0,
        sickBalance: parseFloat(sickBalance) || 0
      });
      setFullName(''); setEmail(''); setPhone(''); setPassword(''); setHourlyRate('20');
      setVacationBalance('0'); setSickBalance('0'); setSelectedBranches(['Tri-Cities']);
      setIsAddStaffOpen(false);
    } catch (error) { console.error(error); }
    finally { setIsSubmitting(false); }
  };

  const saveEdit = async (member: any) => {
    setIsUpdating(true);
    try {
      const updates: any = {
        name: member.name, email: member.email.toLowerCase().trim(), phone: member.phone || '',
        hourlyRate: parseFloat(String(member.hourlyRate)) || 0,
        role: member.role, homeBranches: member.homeBranches || [],
        vacationBalance: parseFloat(String(member.vacationBalance)) || 0,
        sickBalance: parseFloat(String(member.sickBalance)) || 0
      };
      if (member.newPassword) {
        const updateStaffPassword = httpsCallable(functions, 'updateStaffPassword');
        await updateStaffPassword({ uid: member.uid, newPassword: member.newPassword });
      }
      await updateDoc(doc(db, "employees", member.id), updates);
      setShowSaveSuccess(member.id);
      setTimeout(() => setShowSaveSuccess(null), 3000);
    } catch (err) { console.error(err); }
    finally { setIsUpdating(false); }
  };

  const handleDeletePunch = async (punch: any, emp: any) => {
    try {
      // Refund balance if it was a paid PTO punch
      if (punch.type !== 'work' && (punch.paidHours || 0) > 0) {
        const empRef = doc(db, 'employees', emp.id);
        const balanceField = punch.type === 'vacation' ? 'vacationBalance' : 'sickBalance';
        const currentBalance = emp[balanceField] || 0;
        await updateDoc(empRef, {
          [balanceField]: currentBalance + punch.paidHours
        });
      }
      const punchRef = doc(db, "employees", emp.id, "attendance", punch.id);
      await deleteDoc(punchRef);
      fetchPunches();
      setRefreshTrigger(p => p + 1);
    } catch (err) { console.error(err); alert("Failed to delete punch."); }
  };

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-10 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">
      
      {/* MINIMALIST SWITCHER */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('payroll')}
              className={`p-4 rounded-2xl transition-all ${activeTab === 'payroll' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-200 hover:text-slate-400 hover:bg-slate-50'}`}
            >
              <DollarSign size={24} />
            </button>
            <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-500 ${activeTab === 'payroll' ? 'text-slate-900' : 'text-slate-200'}`}>Payroll</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('staff')}
              className={`p-4 rounded-2xl transition-all ${activeTab === 'staff' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-200 hover:text-slate-400 hover:bg-slate-50'}`}
            >
              <Users size={24} />
            </button>
            <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors duration-500 ${activeTab === 'staff' ? 'text-slate-900' : 'text-slate-200'}`}>Staff</span>
          </div>
        </div>

        {activeTab === 'payroll' ? (
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-slate-400 font-black uppercase text-[8px] tracking-[0.4em] mb-1 italic leading-none">Net Payout</p>
              <h4 className="text-2xl font-black italic tracking-tighter leading-none">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
            </div>
            <div className="relative group min-w-[240px]">
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
        ) : (
          <button 
            onClick={() => setIsAddStaffOpen(!isAddFormOpen)}
            className={`group px-8 py-4 rounded-[1.5rem] font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl ${
              isAddFormOpen ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-100 hover:scale-105'
            }`}
          >
            {isAddFormOpen ? <X size={16}/> : <Plus size={16} className="group-hover:rotate-90 transition-transform"/>}
            {isAddFormOpen ? 'Close' : 'Add Employee'}
          </button>
        )}
      </div>

      {activeTab === 'payroll' && unassignedLeadsCount > 0 && (
        <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-orange-500/5">
          <div className="flex items-center gap-6 text-center md:text-left">
            <div className="p-4 bg-orange-500 text-white rounded-2xl shadow-lg">
              <Activity size={24} />
            </div>
            <div>
              <h4 className="text-xl font-black uppercase italic text-orange-600 tracking-tighter leading-none mb-2">Unassigned Revenue Detected</h4>
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest italic">{unassignedLeadsCount} Completed Job(s) in this period have no technician assigned. Tips and Credits will not be calculated for these jobs.</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/admin/schedule')}
            className="px-10 py-5 bg-orange-500 text-white rounded-2xl font-black uppercase italic text-xs tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-600/20 flex items-center gap-3 active:scale-95 transition-transform"
          >
            <CalendarCheck size={18} />
            Fix in Schedule
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-48 text-center flex flex-col items-center gap-6">
          <Loader2 className="animate-spin text-slate-200" size={64} />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Reading Terminal...</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-700">
          {activeTab === 'payroll' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
              {payrollData.map((emp) => {
                const isExpanded = expandedTechId === emp.id;
                return (
                  <div key={emp.id} className={`group bg-white rounded-[3rem] border-2 transition-all duration-500 overflow-hidden ${isExpanded ? 'border-slate-900 shadow-2xl scale-[1.02]' : 'border-slate-50 hover:border-slate-200 hover:shadow-xl'}`}>
                    <div onClick={() => setExpandedTechId(isExpanded ? null : emp.id)} className="p-6 md:p-8 flex items-center gap-6 cursor-pointer">
                      <div onClick={(e) => { e.stopPropagation(); handleManualToggleClock(emp); }} className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner shrink-0 transition-all duration-500 font-black text-xs text-center ${emp.status === 'clocked_in' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                        {emp.status === 'clocked_in' ? 'On-Duty' : 'Off-Duty'}
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="font-black text-slate-900 uppercase italic text-xl md:text-2xl leading-none tracking-tighter">{emp.name}</h3>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">{emp.role?.replace('_', ' ')}</p>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-6 md:px-8 pb-8 space-y-8 animate-in slide-in-from-top-4 duration-500 border-t border-slate-50">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6">
                          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-between">
                            <p className="text-[7px] font-black text-slate-400 uppercase italic mb-1">Work Pay</p>
                            <p className="text-lg font-black text-slate-900 italic tracking-tighter">${emp.workPay.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-between">
                            <p className="text-[7px] font-black text-blue-600 uppercase italic mb-1">Tips</p>
                            <p className="text-lg font-black text-blue-600 italic tracking-tighter">${emp.tips.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-between">
                            <p className="text-[7px] font-black text-orange-600 uppercase italic mb-1">Refs</p>
                            <p className="text-lg font-black text-orange-600 italic tracking-tighter">${emp.referralBonuses.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-900 p-4 rounded-2xl flex flex-col justify-between border-2 border-slate-800 shadow-lg">
                            <p className="text-[7px] font-black text-slate-500 uppercase italic mb-1">PTO Balance</p>
                            <p className="text-lg font-black text-white italic tracking-tighter">{emp.vacationBalance?.toFixed(2) || '0.00'}h</p>
                          </div>
                          <div className="bg-slate-900 p-4 rounded-2xl flex flex-col justify-between border-2 border-slate-800 shadow-lg">
                            <p className="text-[7px] font-black text-slate-500 uppercase italic mb-1">Sick Balance</p>
                            <p className="text-lg font-black text-white italic tracking-tighter">{emp.sickBalance?.toFixed(2) || '0.00'}h</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black uppercase italic text-slate-400 tracking-widest">Recent Punches</h4>
                            <button 
                              onClick={() => {
                                setIsAddingPunch(p => !p);
                                setEditingPunch(null);
                              }}
                              className={`group px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 ${
                                isAddingPunch ? 'bg-slate-900 text-white' : 'bg-white text-slate-900 border border-slate-100 hover:scale-105'
                              }`}
                            >
                              {isAddingPunch ? <X size={14}/> : <Plus size={14} className="group-hover:rotate-90 transition-transform"/>}
                              {isAddingPunch ? 'Cancel' : 'Add Punch'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {isAddingPunch ? (
                              <AddPunchForm
                                employeeId={expandedTechId!}
                                hourlyRate={emp.hourlyRate}
                                vacationBalance={emp.vacationBalance || 0}
                                sickBalance={emp.sickBalance || 0}
                                onSave={() => { 
                                  setIsAddingPunch(false); 
                                  fetchPunches(); 
                                  setRefreshTrigger(prev => prev + 1);
                                }}
                                onCancel={() => setIsAddingPunch(false)}
                              />
                            ) : (null)}
                            {expandedPunches.map(punch => (
                              <div key={punch.id}>
                                {editingPunch?.id === punch.id ? (
                                  <EditablePunchRow 
                                    punch={punch} 
                                    employeeId={expandedTechId!} 
                                    hourlyRate={emp.hourlyRate}
                                    vacationBalance={emp.vacationBalance || 0}
                                    sickBalance={emp.sickBalance || 0}
                                    onSave={() => { 
                                      setEditingPunch(null); 
                                      fetchPunches(); 
                                      setRefreshTrigger(prev => prev + 1);
                                    }}
                                    onCancel={() => setEditingPunch(null)}
                                  />
                                ) : (
                                  <div className="grid grid-cols-7 gap-2 items-center p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 text-left">
                                    <div className="col-span-2 flex items-center gap-3">
                                      <p className="text-xs font-black text-slate-900 italic tracking-tighter">{punch.startTime?.toDate().toLocaleDateString()}</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400">{punch.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-xs font-bold text-slate-400">{punch.endTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-xs font-black text-slate-900 italic">{punch.totalHours?.toFixed(2)}h</p>
                                    <p className={`text-[9px] font-black uppercase text-left italic ${punch.type === 'work' ? 'text-slate-300' : 'text-blue-600'}`}>{punch.type?.replace('_', ' ') || 'work'}</p>
                                    <div className="flex justify-end gap-3 px-2">
                                      <button onClick={() => setEditingPunch(punch)} className="text-slate-300 hover:text-blue-600 transition-colors">
                                        <Edit size={16} />
                                      </button>
                                      <button onClick={() => handleDeletePunch(punch, emp)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {expandedPunches.length >= punchesLimit && (
                              <button
                                onClick={() => setPunchesLimit(p => p + 8)}
                                className="w-full text-center py-4 text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 border-t border-dashed border-slate-100 mt-2"
                              >
                                View More Punches
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-6 pt-6 border-t border-slate-100">
                          <div className="flex gap-10">
                            <div><p className="text-[8px] font-black text-slate-400 uppercase italic mb-1 tracking-widest">Net Hours</p><p className="text-xl font-black text-slate-900 italic tracking-tighter">{formatPreciseTime(emp.totalPaidHours)}</p></div>
                            <div><p className="text-[8px] font-black text-slate-400 uppercase italic mb-1 tracking-widest">Total Payout</p><p className="text-xl font-black text-blue-600 italic tracking-tighter">${emp.grossPay.toFixed(2)}</p></div>
                          </div>
                          <button onClick={() => setPayStubEmployee(emp)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase italic flex items-center gap-3 hover:scale-105 transition-all shadow-lg shadow-slate-900/20"><Receipt size={16} className="text-blue-400" /> View Pay Stub</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-10">
              {isAddFormOpen && (
                <div className="animate-in slide-in-from-top-8 duration-700 bg-slate-50 rounded-[3rem] p-8 md:p-12 border border-slate-100 relative overflow-hidden">
                  <form onSubmit={handleAddStaff} className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-12">
                    <div className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 shadow-sm italic transition-all uppercase" placeholder="FULL NAME" required /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 shadow-sm italic transition-all uppercase" placeholder="PHONE" /></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 shadow-sm italic transition-all" placeholder="EMAIL" required /><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 shadow-sm italic transition-all uppercase" placeholder="PASSWORD" required /></div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="space-y-3"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Hourly</label><input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 italic transition-all" /></div>
                        <div className="space-y-3"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">PTO</label><input type="number" value={vacationBalance} onChange={(e) => setVacationBalance(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 italic transition-all text-blue-600" /></div>
                        <div className="space-y-3"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Sick</label><input type="number" value={sickBalance} onChange={(e) => setSickBalance(e.target.value)} className="w-full px-6 py-4 bg-white border-2 border-transparent rounded-[1.5rem] font-black text-[10px] outline-none focus:border-slate-900 italic transition-all text-blue-600" /></div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-12">
                      <div className="space-y-6">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Role</label>
                        <div className="grid grid-cols-2 gap-3">
                          {ROLES.map(r => (
                            <button 
                                key={r}
                                type="button"
                                onClick={() => setRole(r)}
                                className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase italic transition-all border-2 ${role === r ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-white text-slate-300'}`}
                            >
                                {r.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-6"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Branches</label><div className="grid grid-cols-2 gap-3">{BRANCHES.map(b => (<button key={b} type="button" onClick={() => setSelectedBranches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])} className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase italic transition-all border-2 ${selectedBranches.includes(b) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-white text-slate-300'}`}>{b}</button>))}</div></div>
                      <button type="submit" disabled={isSubmitting} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic text-xs tracking-widest shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <UserPlus size={18} />} Enroll Technician</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {employees.map((member) => {
                  const isExpanded = expandedStaffId === member.id;
                  const isOwner = currentUser?.email === OWNER_EMAIL;
                  const isSelf = currentUser?.email === member.email;
                  const canEdit = isOwner;

                  return (
                    <div key={member.id} className={`group bg-white rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${isExpanded ? 'border-slate-900 shadow-2xl scale-[1.01]' : 'border-slate-50 hover:border-slate-200 hover:shadow-xl'}`}>
                      <div onClick={() => setExpandedStaffId(isExpanded ? null : member.id)} className="p-6 md:p-8 flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-6">
                          <div onClick={(e) => { e.stopPropagation(); handleManualToggleClock(member); }} className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all font-black text-xs text-center ${member.status === 'clocked_in' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-red-500 text-white'}`}>
                            {member.status === 'clocked_in' ? 'On-Duty' : 'Off-Duty'}
                          </div>
                          <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">{member.name}</h3>
                        </div>
                        <div className={`transition-all duration-500 ${isExpanded ? 'rotate-180 text-slate-900' : 'text-slate-200'}`}><ChevronDown size={24} /></div>
                      </div>
                      {isExpanded && (
                        <div className="px-6 md:px-8 pb-10 space-y-8 animate-in slide-in-from-top-4 duration-500 border-t border-slate-50 pt-8 text-left">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Full Name</label><input type="text" readOnly={!canEdit} value={member.name} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, name: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-slate-900 uppercase ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Terminal Email</label><input type="email" readOnly={!canEdit} value={member.email || ''} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, email: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-slate-900 ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Phone</label><input type="tel" readOnly={!canEdit} value={member.phone || ''} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, phone: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-slate-900 ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic text-red-400">Password Reset</label><input type="text" readOnly={!canEdit} placeholder={canEdit ? "NEW PASSWORD" : "RESTRICTED"} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, newPassword: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-red-400 placeholder:text-red-200 ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-left">
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Hourly</label><input type="number" readOnly={!canEdit} value={member.hourlyRate} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, hourlyRate: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-slate-900 ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic text-blue-600">PTO</label><input type="number" readOnly={!canEdit} value={member.vacationBalance || 0} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, vacationBalance: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-blue-600 text-blue-600 ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                            <div className="space-y-2"><label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic text-blue-600">Sick</label><input type="number" readOnly={!canEdit} value={member.sickBalance || 0} onChange={(e) => setEmployees(employees.map(s => s.id === member.id ? {...s, sickBalance: e.target.value} : s))} className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] italic outline-none focus:ring-2 ring-blue-600 text-blue-600 ${canEdit ? 'bg-slate-50' : 'bg-slate-100 text-slate-400'}`} /></div>
                          </div>
                          <div className="space-y-6">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Role</label>
                            <div className="grid grid-cols-2 gap-3 text-left">
                              {ROLES.map(r => (
                                <button
                                  key={r}
                                  type="button"
                                  disabled={!isOwner}
                                  onClick={() => setEmployees(employees.map(s => s.id === member.id ? { ...s, role: r } : s))}
                                  className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase italic transition-all border-2 ${
                                    member.role === r
                                      ? 'bg-slate-900 border-slate-900 text-white'
                                      : 'bg-white border-white text-slate-300 hover:border-slate-200'
                                  } ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {r.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-6 text-left">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Branches</label>
                            <div className="grid grid-cols-2 gap-3">
                              {BRANCHES.map(b => (
                                <button
                                  key={b}
                                  type="button"
                                  disabled={!canEdit}
                                  onClick={() => {
                                    const currentBranches = member.homeBranches || [];
                                    const newBranches = currentBranches.includes(b)
                                      ? currentBranches.filter((x: string) => x !== b)
                                      : [...currentBranches, b];
                                    setEmployees(employees.map(s => s.id === member.id ? { ...s, homeBranches: newBranches } : s));
                                  }}
                                  className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase italic transition-all border-2 ${
                                    member.homeBranches?.includes(b)
                                      ? 'bg-slate-900 border-slate-900 text-white'
                                      : 'bg-white border-white text-slate-300 hover:border-slate-200'
                                  } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {b}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-4 pt-6 border-t border-slate-100 text-left">
                            {canEdit ? (
                                <>
                                    <button onClick={() => saveEdit(member)} className="flex-1 py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase italic flex items-center justify-center gap-3 hover:bg-black transition-all">
                                      {isUpdating ? <Loader2 className="animate-spin" size={16}/> : showSaveSuccess === member.id ? <Check size={16}/> : <Save size={16}/>} 
                                      {showSaveSuccess === member.id ? 'Updated' : 'Save Changes'}
                                    </button>
                                    <button onClick={async () => { if (window.confirm("Permanently terminate this profile?")) await deleteDoc(doc(db, "employees", member.id)); }} className="px-8 py-5 bg-white border-2 border-slate-100 rounded-[1.5rem] font-black text-[10px] uppercase italic text-slate-200 hover:text-red-500 hover:border-red-500 transition-all"><Trash2 size={18}/></button>
                                </>
                            ) : (
                                <div className="flex-1 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-black text-[8px] uppercase italic text-slate-400 text-center flex items-center justify-center gap-3">
                                    <ShieldCheck size={14} className="text-blue-500" />
                                    Self-Editing Restricted
                                </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAY STUB MODAL */}
      {payStubEmployee && (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] max-w-2xl w-full p-8 md:p-12 shadow-2xl border border-slate-50 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setPayStubEmployee(null)} className="absolute top-8 right-8 text-slate-200 hover:text-slate-900 p-2 transition-all hover:rotate-90"><X size={32}/></button>
            <div className="mb-8 border-b-4 border-slate-900 pb-8">
              <h2 className="text-3xl font-black uppercase italic text-slate-900 tracking-tighter leading-none mb-4">Earnings <br/><span className="text-slate-200">Statement.</span></h2>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] italic leading-none">Clear View LLC</p>
            </div>
            <div className="mb-12 leading-none text-left">
              <p className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{payStubEmployee.name}</p>
              <p className="text-[10px] font-bold text-slate-300 lowercase italic">{payStubEmployee.email}</p>
            </div>
            <div className="space-y-8">
              <table className="w-full text-left border-collapse">
                <thead><tr className="border-b border-slate-100 text-left"><th className="py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic text-left">Description</th><th className="text-center py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Hours</th><th className="text-center py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic">Rate</th><th className="text-right py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest italic text-left">Total</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {/* BREAKDOWN BY TYPE, RATE AND DATE RANGE */}
                  {payStubEmployee.lineItems.map((group: any, idx: number) => (
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

                  {payStubEmployee.tips > 0 && (<tr><td className="py-5 text-xs font-black text-blue-600 uppercase italic tracking-tighter text-left">Gratuity</td><td colSpan={2} className="text-center text-xs text-slate-300">—</td><td className="py-5 text-right text-xs font-black text-blue-600 italic tracking-tighter">${payStubEmployee.tips.toFixed(2)}</td></tr>)}
                  {payStubEmployee.referralBonuses > 0 && (<tr><td className="py-5 text-xs font-black text-orange-600 uppercase italic tracking-tighter text-left">Referral</td><td colSpan={2} className="text-center text-xs text-slate-300">—</td><td className="py-5 text-right text-xs font-black text-orange-600 italic tracking-tighter">${payStubEmployee.referralBonuses.toFixed(2)}</td></tr>)}
                </tbody>
                <tfoot><tr className="border-t-4 border-slate-900"><td colSpan={3} className="py-6 text-sm font-black text-slate-900 uppercase italic tracking-widest text-left">Total Net Payout</td><td className="py-6 text-2xl font-black text-slate-900 text-right italic tracking-tighter">${payStubEmployee.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></tfoot>
              </table>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col gap-4 shadow-inner text-left">
                  <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase text-slate-400 italic">Accrued This Period</span><p className="text-[8px] font-black text-slate-300 italic uppercase">1h per 40h worked</p></div>
                  <div className="flex gap-8">
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-400 uppercase italic text-left">Sick</p><p className="text-lg font-black text-slate-900 italic tracking-tighter text-left">+{payStubEmployee.sickAccrued.toFixed(2)}h</p></div>
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-400 uppercase italic text-left">PTO</p><p className="text-lg font-black text-slate-900 italic tracking-tighter text-left">+{payStubEmployee.ptoAccrued.toFixed(2)}h</p></div>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-[2rem] flex flex-col gap-4 shadow-xl text-left">
                  <span className="text-[8px] font-black uppercase text-slate-500 italic">Remaining Balance (Current)</span>
                  <div className="flex gap-8">
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-500 uppercase italic text-left">Sick</p><p className="text-lg font-black text-white italic tracking-tighter text-left">{payStubEmployee.sickBalance?.toFixed(2) || '0.00'}h</p></div>
                    <div className="space-y-1"><p className="text-[7px] font-black text-slate-500 uppercase italic text-left">PTO</p><p className="text-lg font-black text-white italic tracking-tighter text-left">{payStubEmployee.vacationBalance?.toFixed(2) || '0.00'}h</p></div>
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
