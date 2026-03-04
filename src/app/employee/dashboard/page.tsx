'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  LayoutDashboard, CheckCircle2, Clock, 
  Calendar, ArrowRight, ClipboardList, Loader2, ShieldCheck, Zap, MapPin, History
} from 'lucide-react';
import Link from 'next/link';

export default function EmployeeDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [status, setStatus] = useState('clocked_out');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const email = user.email!.toLowerCase();
      setUserEmail(email);

      // 1. Get Employee Status & Name
      const empRef = doc(db, "employees", email);
      const unsubStatus = onSnapshot(empRef, (docSnap) => {
        if (docSnap.exists()) {
          setStatus(docSnap.data().status || 'clocked_out');
          setUserName(docSnap.data().name || 'Crew Member');
        } else {
          setUserName(email === 'clearview3cleaners@gmail.com' ? 'Admin' : 'Crew Member');
        }
      });

      // 2. Get Jobs
      const q = query(collection(db, "leads"));
      const unsubJobs = onSnapshot(q, (snapshot) => {
        const jobsData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setJobs(jobsData);
        setLoading(false);
      }, (error) => {
        console.error("Firestore Error:", error);
        setLoading(false);
      });

      return () => { unsubStatus(); unsubJobs(); };
    });

    return () => unsubscribeAuth();
  }, []);

  // Filter logic: Only show missions assigned to this employee
  // Admin sees everything
  const myJobs = useMemo(() => {
    if (!userEmail) return [];
    if (userEmail === 'clearview3cleaners@gmail.com') return jobs;
    return jobs.filter(j => j.assignedTo === userEmail);
  }, [jobs, userEmail]);

  const pendingJobs = myJobs.filter(j => j.status !== 'completed' && j.status !== 'Completed');
  const completedJobs = myJobs.filter(j => j.status === 'completed' || j.status === 'Completed');
  
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 space-y-4">
      <Loader2 className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-400 font-bold italic uppercase text-[10px] tracking-widest">Compiling Intelligence...</p>
    </div>
  );

  return (
    <div className="p-6 lg:p-12 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700 text-left">
      
      {/* WELCOME HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] italic mb-1">Clear View Operations</p>
          <h1 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            {userName.split(' ')[0]}<br/>Dashboard
          </h1>
        </div>
        {status === 'clocked_in' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
            <Zap size={14} className="text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Duty</span>
          </div>
        )}
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4 group hover:border-blue-600 transition-all">
          <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="text-4xl font-black text-slate-900 italic tracking-tighter leading-none">{pendingJobs.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Missions Pending</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4 group hover:border-emerald-500 transition-all">
          <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-4xl font-black text-slate-900 italic tracking-tighter leading-none">{completedJobs.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Missions Closed</p>
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl shadow-slate-200 space-y-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${status === 'clocked_in' ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-black uppercase italic tracking-tighter leading-none">
              {status === 'clocked_in' ? 'Clocked In' : 'Off Mission'}
            </p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Live Personnel Status</p>
          </div>
        </div>
      </div>

      {/* NEXT UP SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-4 italic flex items-center gap-2">
            <ShieldCheck size={14}/> Primary Assignment
          </h3>
          {pendingJobs.length > 0 ? (
            <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-sm space-y-8 hover:shadow-xl transition-all">
              <div>
                <h4 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
                  {pendingJobs[0].template?.data?.fullName || `${pendingJobs[0].firstName} ${pendingJobs[0].lastName}`}
                </h4>
                <p className="text-slate-400 font-bold text-lg mt-3 uppercase italic flex items-center gap-2">
                  <MapPin size={18} className="text-blue-600" />
                  {pendingJobs[0].address}, {pendingJobs[0].city}
                </p>
              </div>
              <div className="flex items-center justify-between py-6 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Target Date</span>
                  <div className="flex items-center gap-2 text-blue-600 font-black italic text-sm uppercase">
                    <Calendar size={16} />
                    <span>{pendingJobs[0].template?.data?.date || "SCHEDULED"}</span>
                  </div>
                </div>
                <Link href="/employee/schedule" className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-blue-600 transition-all shadow-lg">
                  <ArrowRight size={24} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100/50 rounded-[3rem] p-16 text-center border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-black uppercase italic tracking-widest text-xs">No Missions Assigned</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-4 italic flex items-center gap-2">
            <History size={14}/> Operation History
          </h3>
          <div className="space-y-3">
            {completedJobs.slice(0, 4).map((job) => (
              <div key={job.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between group hover:border-emerald-500 transition-all">
                <div>
                  <p className="font-black text-slate-900 uppercase italic text-lg leading-none tracking-tighter group-hover:text-emerald-600">
                    {job.template?.data?.fullName || `${job.firstName} ${job.lastName}`}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest italic">Mission Confirmed & Settled</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl shadow-sm">
                  <CheckCircle2 size={20} />
                </div>
              </div>
            ))}
            {completedJobs.length === 0 && (
              <div className="p-12 text-center opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest">No completed missions recorded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}