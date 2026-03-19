'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Menu, X, CalendarCheck, DollarSign, 
  BarChart3, LogOut, Plus, ChevronRight, Activity
} from 'lucide-react'; 
import { db, auth } from '../lib/firebase'; 
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, getDocs, where, doc, getDoc } from 'firebase/firestore';
import QuoteModal from './QuoteModal';
import { detectScheduleConflicts } from '../lib/conflictUtils';

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [hasUnassigned, setHasUnassigned] = useState(false);
  const [userName, setUserName] = useState('Admin');

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Fetch current user name
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Special case for owner
        if (user.email === 'clearview3cleaners@gmail.com') {
            setUserName('Admin');
            return;
        }

        // Try to find employee name by email
        try {
            const employeesRef = collection(db, "employees");
            const q = query(employeesRef, where("email", "==", user.email));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const empData = querySnapshot.docs[0].data();
                if (empData.name) {
                    const fullName = empData.name;
                    const firstName = fullName.split(' ')[0];
                    setUserName(firstName);
                    return;
                }
            }
            
            setUserName(user.email?.split('@')[0] || 'Team Member');
        } catch (error) {
            console.error("Error fetching user name:", error);
            setUserName('Team Member');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Conflict & Unassigned Listener for Global Alert
  useEffect(() => {
    let unsubLeads: () => void;

    const checkAllAlerts = async (jobs: any[]) => {
      const empRef = collection(db, "employees");
      const empSnap = await getDocs(empRef);
      const employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const allAttendance: any[] = [];
      for (const emp of employees) {
        const attendRef = collection(db, "employees", emp.id, "attendance");
        const q = query(attendRef, where("type", "in", ["vacation", "sick"]));
        const snap = await getDocs(q);
        snap.forEach(d => allAttendance.push({ ...d.data(), employeeId: emp.id }));
      }
      
      const conflicts = detectScheduleConflicts(jobs, allAttendance);
      setHasConflicts(conflicts.length > 0);

      const unassigned = jobs.filter(j => !j.assignedTo && j.status !== 'Archived' && j.status !== 'Completed' && !j.isNotification && !j.hideFromCustomersPage);
      setHasUnassigned(unassigned.length > 0);
    };

    const qLeads = collection(db, "leads");
    unsubLeads = onSnapshot(qLeads, (leadSnap) => {
      const jobs = leadSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      checkAllAlerts(jobs);
    });

    return () => {
      if (unsubLeads) unsubLeads();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navLinks = [
    { name: 'Schedule', href: '/admin/schedule', icon: <CalendarCheck size={22} />, alert: hasConflicts || hasUnassigned, alertType: hasConflicts ? 'conflict' : 'unassigned' },
    { name: 'Payroll', href: '/admin/payroll', icon: <DollarSign size={22} /> },
    { name: 'Reports', href: '/admin/reports', icon: <BarChart3 size={22} /> },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full py-10 px-6">

      {/* BRANDING */}
      <div className="mb-16 px-6 space-y-1 text-left">
        <p className="font-black text-2xl tracking-tighter text-slate-900 leading-none uppercase italic">{userName}</p>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Clear View LLC</p>
      </div>

      {/* LINKS */}
      <div className="flex-1 space-y-4">
        {navLinks.map((link) => {
          const cleanPath = pathname.replace(/\/$/, '') || '/';
          const cleanLink = link.href.replace(/\/$/, '') || '/';
          const isActive = cleanPath === cleanLink;

          return (
            <Link 
              key={link.name} 
              href={link.href}
              className={`flex items-center justify-between px-6 py-5 rounded-[1.5rem] transition-all duration-300 group relative ${
                isActive 
                  ? 'bg-black text-white shadow-[0_20px_40px_-5px_rgba(0,0,0,0.3)] scale-[1.02]' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-5">
                <span className={`${isActive ? 'text-white' : 'text-slate-300 group-hover:text-slate-900'} transition-colors relative`}>
                  {link.icon}
                  {link.alert && (
                    <span className={`absolute -top-1 -right-1 w-3 h-3 border-2 border-white rounded-full animate-pulse shadow-sm ${link.alertType === 'conflict' ? 'bg-red-500' : 'bg-orange-500'}`}></span>
                  )}
                </span>
                <span className="font-black text-xs uppercase tracking-widest italic">{link.name}</span>
              </div>
              {isActive && <ChevronRight size={16} className="text-slate-400" />}
            </Link>
          );
        })}

        <button 
          onClick={() => setIsQuoteModalOpen(true)}
          className="w-full flex items-center gap-5 px-6 py-5 rounded-[1.5rem] transition-all duration-300 text-slate-400 hover:bg-slate-50 hover:text-slate-900 border-2 border-transparent hover:border-slate-100"
        >
          <Plus size={22} className="text-slate-300 group-hover:text-slate-900" />
          <span className="font-black text-xs uppercase tracking-widest italic">Book Now</span>
        </button>
      </div>

      {/* LOGOUT */}
      <button 
        onClick={handleLogout}
        className="mt-auto flex items-center gap-5 px-6 py-5 rounded-[1.5rem] font-black text-xs uppercase italic tracking-widest text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
      >
        <LogOut size={22} />
        Log Out
      </button>
    </div>
  );

  return (
    <>
      {/* MOBILE BAR - Adjusted for smaller screens */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-20 md:h-24 bg-white/95 backdrop-blur-xl border-b border-slate-100 z-[60] flex items-center justify-between px-6 md:px-8">
        <div className="flex flex-col">
          <p className="font-black text-lg md:text-xl tracking-tighter text-slate-900 uppercase italic leading-none">{userName}</p>
          <p className="text-[8px] md:text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">Clear View LLC</p>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {hasConflicts && (
            <div className="p-2 bg-red-50 text-red-500 rounded-lg animate-pulse">
              <Activity size={18} />
            </div>
          )}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="p-2.5 md:p-3 bg-slate-50 rounded-2xl text-slate-900 hover:bg-slate-100 transition-all border border-slate-100"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-80 min-h-screen fixed left-0 top-0 bg-white shadow-[20px_0_60px_-15px_rgba(0,0,0,0.05)] z-50 border-r border-slate-50">
        <NavContent />
      </aside>

      {/* MOBILE/TABLET OVERLAY */}
      <div className={`lg:hidden fixed inset-0 z-[55] transition-all duration-500 ${isOpen ? 'visible' : 'invisible'}`}>
        <div 
          className={`absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsOpen(false)}
        />
        <aside className={`absolute left-0 top-0 bottom-0 w-[280px] sm:w-[320px] bg-white shadow-2xl transition-transform duration-500 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="pt-20 md:pt-24 h-full">
            <NavContent />
          </div>
        </aside>
      </div>

      <QuoteModal 
        isOpen={isQuoteModalOpen} 
        onClose={() => setIsQuoteModalOpen(false)} 
        isEmployeeBooking={true} 
      />
    </>
  );
}
