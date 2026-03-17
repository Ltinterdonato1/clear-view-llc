'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, onSnapshot, doc, where, getDocs, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  LayoutDashboard, CheckCircle2, Clock, 
  Calendar, ArrowRight, ClipboardList, Loader2, ShieldCheck, Zap, MapPin, History,
  Search, Filter, Activity, User, ChevronRight, X
} from 'lucide-react';
import Link from 'next/link';
import JobCard from '../../../components/schedule/JobCard';
import { calculateJobStats } from '../../../lib/scheduleUtils';

export default function EmployeeDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [status, setStatus] = useState('clocked_out');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Assigned' | 'Completed'>('All');
  const [expandedJobId, setExpandedLeadId] = useState<string | null>(null);
  const [completingJob, setCompletingJob] = useState<any | null>(null);

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
      const q = query(collection(db, "leads"), orderBy("createdAt", "desc"));
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
  const myJobs = useMemo(() => {
    if (!userEmail) return [];
    const isAdmin = userEmail === 'clearview3cleaners@gmail.com';

    return jobs.filter(j => {
      const isAssigned = isAdmin || j.assignedTo === userEmail;
      if (!isAssigned) return false;

      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        (j.firstName || '').toLowerCase().includes(search) || 
        (j.lastName || '').toLowerCase().includes(search) || 
        (j.template?.data?.fullName || '').toLowerCase().includes(search) || 
        (j.address || '').toLowerCase().includes(search) || 
        (j.city || '').toLowerCase().includes(search)
      );

      const s = j.status?.toLowerCase();
      const isCompleted = s === 'completed' || s === 'archived';

      let matchesFilter = true;
      if (statusFilter === 'Assigned') matchesFilter = !isCompleted;
      else if (statusFilter === 'Completed') matchesFilter = isCompleted;

      return matchesSearch && matchesFilter;
    });
  }, [jobs, userEmail, searchTerm, statusFilter]);

  const pendingJobs = myJobs.filter(j => j.status !== 'completed' && j.status !== 'Completed' && j.status !== 'Archived');
  const completedJobs = myJobs.filter(j => j.status === 'completed' || j.status === 'Completed' || j.status === 'Archived');

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-white space-y-6">
      <Loader2 className="animate-spin text-slate-200" size={64} />
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 italic">Syncing Terminal...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 lg:p-12 xl:p-16 space-y-12 max-w-[1600px] mx-auto min-h-screen bg-white text-left font-sans text-slate-900">

      {/* HEADER MATCHING ADMIN */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-8 border-b border-slate-100 pb-12">
        <div className="text-center xl:text-left flex-1">
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] mb-2 italic leading-none">Clear View Operations</p>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{userName.split(' ')[0]}'s Terminal</h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="SEARCH MISSIONS..." 
              className="w-full pl-14 pr-8 py-5 bg-slate-50 rounded-[1.5rem] font-black text-[10px] uppercase italic outline-none border-2 border-transparent focus:border-slate-900 transition-all shadow-sm" 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="flex bg-slate-50 rounded-[1.5rem] p-1.5 shadow-sm border border-slate-100">
            {['All', 'Assigned', 'Completed'].map((f) => (
              <button 
                key={f} 
                onClick={() => setStatusFilter(f as any)} 
                className={`px-6 py-3 rounded-xl font-black text-[9px] uppercase italic transition-all ${statusFilter === f ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* STAT CARDS - UPGRADED AESTHETIC */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
        <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-xl space-y-6 group hover:border-slate-900 transition-all duration-500">
          <div className="bg-slate-900 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <ClipboardList size={28} />
          </div>
          <div>
            <p className="text-6xl font-black text-slate-900 italic tracking-tighter leading-none">{pendingJobs.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">Active Missions</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-xl space-y-6 group hover:border-emerald-500 transition-all duration-500">
          <div className="bg-emerald-500 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-6xl font-black text-slate-900 italic tracking-tighter leading-none">{completedJobs.length}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 italic">Mission Cleared</p>
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl space-y-6 relative overflow-hidden group">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${status === 'clocked_in' ? 'bg-emerald-500' : 'bg-slate-700'}`}>
            <Clock size={28} />
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-black uppercase italic tracking-tighter leading-none group-hover:text-emerald-400 transition-colors">
              {status === 'clocked_in' ? 'System Active' : 'Offline Mode'}
            </p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-3 italic">Personnel Status</p>
          </div>
          <Zap className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-1000" />
        </div>
      </div>

      {/* MISSIONS SECTION - MATCHING ADMIN LIST STYLE */}
      <div className="space-y-8 pt-8">
        <div className="flex items-center gap-4 px-6">
          <Activity size={14} className="text-slate-300" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Current Intelligence</p>
        </div>

        <div className="grid gap-6">
          {myJobs.length === 0 ? (
            <div className="text-center py-32 bg-slate-50 rounded-[4rem] border-2 border-dashed border-slate-100">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-2xl">No Data Found in Sector</p>
            </div>
          ) : myJobs.map((job) => {
            const isExpanded = expandedJobId === job.id;
            const isCompleted = job.status?.toLowerCase() === 'completed' || job.status?.toLowerCase() === 'archived';

            if (isExpanded) {
              return (
                <div key={`container-expanded-${job.id}`} className="relative animate-in zoom-in-95 duration-500">
                  <button 
                    onClick={() => setExpandedLeadId(null)} 
                    className="absolute top-8 right-8 z-20 p-3 bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90"
                  >
                    <X size={24} />
                  </button>
                  <JobCard 
                    job={job} 
                    isAdmin={false} 
                    userEmail={userEmail!}
                    setCompletingJob={setCompletingJob} 
                    currentDayTime={Date.now()} 
                    initialExpanded={true}
                  />
                </div>
              );
            }

            const total = parseFloat(job.total || job.finalPrice || job.template?.data?.totalAmount || '0');
            const displayFullName = job.template?.data?.fullName || `${job.firstName || ''} ${job.lastName || ''}`.trim() || 'New Customer';
            const fullAddress = `${job.address || ''}, ${job.city || ''}`;

            return (
              <div 
                key={`row-${job.id}`} 
                onClick={() => setExpandedLeadId(job.id)}
                className={`bg-white rounded-[3rem] shadow-xl border-2 transition-all duration-500 overflow-hidden cursor-pointer group
                  ${isCompleted ? 'border-slate-50 opacity-80' : 'border-transparent hover:border-slate-900 hover:shadow-2xl hover:scale-[1.01]'}`}
              >
                <div className="p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex items-center gap-8 w-full md:w-auto">
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-inner transition-all duration-500
                      ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white'}`}
                    >
                      <User size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="font-black text-slate-900 text-3xl uppercase italic leading-none tracking-tighter group-hover:text-slate-900 transition-colors">
                          {displayFullName}
                        </h3>
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase italic tracking-widest shadow-sm
                          ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}
                        >
                          {job.status || 'Assigned'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-bold mt-3 uppercase tracking-widest italic flex items-center gap-2">
                        <MapPin size={12} className="text-slate-300 group-hover:text-emerald-500 transition-colors" /> 
                        {fullAddress}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-12 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-slate-50 pt-6 md:pt-0">
                    <div className="text-left md:text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase italic mb-1 tracking-widest">Target Date</p>
                      <p className="text-xl font-black text-slate-900 italic tracking-tighter leading-none uppercase">
                        {job.template?.data?.date || "TBD"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase italic mb-1 tracking-widest">Yield</p>
                      <p className="text-4xl font-black text-slate-900 italic tracking-tighter leading-none">
                        ${total.toFixed(0)}
                      </p>
                    </div>
                    <div className="hidden lg:block text-slate-100 group-hover:text-slate-900 transition-colors duration-500">
                      <ChevronRight size={32} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}