'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from '../../../lib/firebase';
import { 
  doc, onSnapshot, updateDoc, serverTimestamp, 
  collection, addDoc, query, where, orderBy, getDocs, limit 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, History, Zap, Download, Calendar as CalendarIcon, Clock, Timer, LogIn, LogOut, RefreshCcw } from 'lucide-react';

interface Shift {
  id: string;
  status: string;
  startTime: any;
  endTime?: any;
  date: string;
  totalHours?: number;
}

// --- HELPERS ---
const formatTime = (decimalHours: number) => {
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}H ${m}M` : `${m}M`;
};

const formatLiveTimer = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- DYNAMIC PERIOD GENERATOR (Starts Jan 1st, 2026) ---
const generatePayPeriods = () => {
  const periods = [];
  const now = new Date();
  
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();
  let isFirstHalf = now.getDate() <= 15;

  while (currentYear >= 2026 && currentMonth >= 0) {
    let start, end;
    if (isFirstHalf) {
      start = new Date(currentYear, currentMonth, 1);
      end = new Date(currentYear, currentMonth, 15, 23, 59, 59);
    } else {
      start = new Date(currentYear, currentMonth, 16);
      end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
    }
    const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    periods.push({ label, start, end });
    if (isFirstHalf) { currentMonth--; isFirstHalf = false; } else { isFirstHalf = true; }
    if (periods.length > 26) break; 
  }
  return periods;
};

export default function ClockPage() {
  const [status, setStatus] = useState<'clocked_in' | 'clocked_out' | 'loading'>('loading');
  const [history, setHistory] = useState<Shift[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [activeShiftStart, setActiveShiftStart] = useState<Date | null>(null);
  const [liveElapsed, setLiveLiveElapsed] = useState(0);
  
  const periods = useMemo(() => generatePayPeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const hoursByDate = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach(shift => {
      if (shift.date && shift.totalHours) map[shift.date] = (map[shift.date] || 0) + shift.totalHours;
    });
    return map;
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (!selectedDay) return history;
    return history.filter(shift => shift.date === selectedDay);
  }, [history, selectedDay]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status === 'clocked_in' && activeShiftStart) {
      const interval = setInterval(() => {
        setLiveLiveElapsed(new Date().getTime() - activeShiftStart.getTime());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, activeShiftStart]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const userEmail = user.email!.toLowerCase().trim();
      
      const unsubStatus = onSnapshot(doc(db, "employees", userEmail), (docSnap) => {
        if (docSnap.exists()) setStatus(docSnap.data().status || 'clocked_out');
        setLoading(false);
      });

      const q = query(
        collection(db, "employees", userEmail, "attendance"), 
        where("startTime", ">=", selectedPeriod.start),
        where("startTime", "<=", selectedPeriod.end),
        orderBy("startTime", "desc")
      );

      const unsubHistory = onSnapshot(q, (snap) => {
        const shifts = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Shift[];
        setHistory(shifts);
        const active = shifts.find(s => s.status === 'active');
        if (active && active.startTime) {
          setActiveShiftStart(active.startTime.toDate());
        } else {
          setActiveShiftStart(null);
          setLiveLiveElapsed(0);
        }
      });

      return () => { unsubStatus(); unsubHistory(); };
    });
  }, [selectedPeriod]);

  const handleClockAction = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const userEmail = user.email!.toLowerCase().trim();
    const empRef = doc(db, "employees", userEmail);
    const attendRef = collection(db, "employees", userEmail, "attendance");

    if (status === 'clocked_out') {
      await updateDoc(empRef, { status: 'clocked_in', lastAction: serverTimestamp() });
      await addDoc(attendRef, { startTime: serverTimestamp(), endTime: null, date: new Date().toLocaleDateString(), status: 'active' });
    } else {
      await updateDoc(empRef, { status: 'clocked_out', lastAction: serverTimestamp() });
      const q = query(attendRef, where("status", "==", "active"), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const startTime = snap.docs[0].data().startTime.toDate();
        const hours = parseFloat(((new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
        await updateDoc(doc(db, "employees", userEmail, "attendance", snap.docs[0].id), { endTime: serverTimestamp(), status: 'completed', totalHours: hours });
      }
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div className="p-8 lg:p-16 bg-slate-50 min-h-screen text-left">
      
      {/* HEADER SECTION */}
      <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-end gap-8">
        <div>
          <h1 className="text-7xl font-black uppercase italic tracking-tighter text-slate-900">Punch Clock</h1>
          <p className="text-blue-600 font-black uppercase tracking-[0.4em] text-[11px] mt-2 italic flex items-center gap-2">
            <Clock size={14}/> Crew Attendance System
          </p>
        </div>
        <div className="bg-slate-900 px-10 py-6 rounded-[2.5rem] shadow-2xl border border-slate-800 text-center">
          <p className="text-blue-500 font-black uppercase tracking-widest text-[10px] mb-1 italic">Current Time</p>
          <p className="text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          
          {/* ACTION CARD */}
          <div className="bg-white rounded-[4rem] p-16 shadow-2xl border border-slate-100 text-center space-y-12 relative overflow-hidden">
             <div className={`absolute top-0 left-0 w-full h-6 transition-all duration-700 ${status === 'clocked_in' ? 'bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : 'bg-slate-200'}`} />
             
             <div className="space-y-4">
               <h2 className={`text-9xl font-black uppercase italic tracking-tighter transition-colors ${status === 'clocked_in' ? 'text-emerald-500' : 'text-slate-200'}`}>
                 {status === 'clocked_in' ? 'Active' : 'Offline'}
               </h2>
               {status === 'clocked_in' && (
                 <div className="flex items-center justify-center gap-3 text-blue-600 animate-in fade-in zoom-in duration-500">
                   <Timer size={24} className="animate-pulse" />
                   <span className="text-3xl font-black italic tracking-tight">{formatLiveTimer(liveElapsed)}</span>
                 </div>
               )}
             </div>

             <button 
               onClick={handleClockAction} 
               className={`w-full py-16 rounded-[3.5rem] font-black text-6xl uppercase italic shadow-2xl transition-all active:scale-95 hover:brightness-110 flex items-center justify-center gap-6
                 ${status === 'clocked_in' ? 'bg-red-500 text-white shadow-red-200' : 'bg-blue-600 text-white shadow-blue-200'}`}
             >
               {status === 'clocked_in' ? <><LogOut size={48}/> End Shift</> : <><LogIn size={48}/> Start Shift</>}
             </button>
          </div>

          {/* CALENDAR */}
          <div className="bg-white rounded-[4rem] p-12 border border-slate-100 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 px-4">
              <div className="flex items-center gap-4">
                <div className="bg-slate-900 p-4 rounded-3xl text-white shadow-xl"><CalendarIcon size={28}/></div>
                <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Timecard History</h3>
              </div>
              <select 
                className="bg-slate-50 border-2 border-slate-100 text-[11px] font-black uppercase tracking-widest p-5 rounded-[2rem] outline-none cursor-pointer hover:bg-slate-100 transition-all text-slate-600 appearance-none pr-12 bg-[url('https://cdn-icons-png.flaticon.com/512/60/60995.png')] bg-[length:12px] bg-[right_20px_center] bg-no-repeat"
                value={selectedPeriod.label}
                onChange={(e) => {
                  setSelectedPeriod(periods.find(p => p.label === e.target.value)!);
                  setSelectedDay(null);
                }}
              >
                {periods.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-7 gap-6">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-[11px] font-black text-slate-300 uppercase py-2 tracking-[0.3em] italic">{d}</div>
              ))}
              
              {(() => {
                const days = [];
                const startDayNum = selectedPeriod.start.getDate();
                const endDayNum = selectedPeriod.end.getDate();
                
                for (let s = 0; s < selectedPeriod.start.getDay(); s++) {
                  days.push(<div key={`spacer-${s}`} className="aspect-square" />);
                }
                
                for (let i = startDayNum; i <= endDayNum; i++) {
                  const dateObj = new Date(selectedPeriod.start.getFullYear(), selectedPeriod.start.getMonth(), i);
                  const dateStr = dateObj.toLocaleDateString();
                  const hours = hoursByDate[dateStr] || 0;
                  const isSelected = selectedDay === dateStr;
                  const isToday = new Date().toLocaleDateString() === dateStr;

                  days.push(
                    <div 
                      key={dateStr} 
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)} 
                      className={`aspect-square rounded-[2.5rem] border-4 p-6 flex flex-col transition-all cursor-pointer group relative
                        ${isSelected ? 'border-blue-600 bg-blue-50/20 scale-105 z-10 shadow-xl' : 
                          hours > 6 ? 'border-emerald-500 bg-emerald-50/30' : 
                          hours > 0 ? 'border-blue-400 bg-blue-50/30' : 
                          'border-slate-50 hover:border-slate-200 bg-white'}`}
                    >
                      <span className={`text-lg font-black ${isToday ? 'text-blue-600 underline' : isSelected ? 'text-blue-600' : 'text-slate-300'}`}>{i}</span>
                      {hours > 0 && (
                        <div className="mt-auto text-center space-y-2">
                          <p className="text-sm font-black text-slate-900 uppercase italic group-hover:scale-110 transition-transform">{formatTime(hours)}</p>
                          <div className={`h-2.5 w-full rounded-full ${hours > 6 ? 'bg-emerald-500' : 'bg-blue-500'} shadow-sm`} />
                        </div>
                      )}
                    </div>
                  );
                }
                return days;
              })()}
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-10">
          <div className="bg-slate-900 rounded-[4rem] p-12 text-white shadow-2xl relative overflow-hidden group border border-slate-800">
            <Zap className="absolute -right-8 -top-8 text-white/5 w-56 h-56 rotate-12 group-hover:scale-110 group-hover:text-blue-500/10 transition-all duration-1000" />
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-xl"><History size={18}/></div>
                <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.4em] italic">Period Recap</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Total Hours Worked</p>
                <h4 className="text-7xl font-black italic tracking-tighter text-white">
                  {formatTime(history.reduce((a, s) => a + (s.totalHours || 0), 0))}
                </h4>
              </div>
            </div>
          </div>

          <div className="space-y-8 px-2">
            <div className="flex items-center justify-between">
               <div className="flex flex-col">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] italic">{selectedDay ? 'Reviewing Day' : 'Punch Details'}</h3>
                  {selectedDay && <p className="text-xl font-black text-blue-600 italic leading-none mt-2">{selectedDay}</p>}
               </div>
               {selectedDay && (
                 <button onClick={() => setSelectedDay(null)} className="text-[10px] font-black bg-blue-600 text-white px-5 py-2.5 rounded-full uppercase italic shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center gap-2">
                   <RefreshCcw size={14}/> Reset
                 </button>
               )}
            </div>
            
            <div className="space-y-6 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
              {filteredHistory.length === 0 ? (
                <div className="py-32 text-center space-y-4 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                  <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] italic">No Punches Logged</p>
                </div>
              ) : (
                filteredHistory.map((shift) => (
                  <div key={shift.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6 transition-all hover:scale-[1.02] hover:shadow-2xl">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                      <div className="flex flex-col">
                        <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Shift Date</p>
                        <p className="text-lg font-black text-slate-900 italic">{shift.date}</p>
                      </div>
                      <div className={`px-6 py-2.5 rounded-2xl text-xs font-black italic uppercase shadow-sm ${shift.status === 'active' ? 'bg-emerald-100 text-emerald-600 animate-pulse' : 'bg-slate-900 text-white'}`}>
                        {shift.status === 'active' ? '● Live' : formatTime(shift.totalHours || 0)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-emerald-500 uppercase italic mb-2 tracking-widest">Clock In</p>
                        <p className="text-xl font-black text-slate-800 italic">{shift.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                        <p className="text-[10px] font-black text-red-500 uppercase italic mb-2 tracking-widest">Clock Out</p>
                        <p className="text-xl font-black text-slate-800 italic">{shift.endTime ? shift.endTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}