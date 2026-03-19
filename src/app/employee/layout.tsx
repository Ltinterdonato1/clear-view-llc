'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, Users, Calendar, LogOut, Menu, X, LayoutDashboard, Plus, ChevronRight, Sparkles } from 'lucide-react';
import QuoteModal from '../../components/QuoteModal';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState('clocked_out');
  const [userName, setUserName] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isQuoteModalOpen, setQuoteModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const userEmail = user.email?.toLowerCase() || '';

        if (userEmail === 'clearview3cleaners@gmail.com') {
          setUserName('Admin');
          setStatus('clocked_in');
          return;
        }

        const empRef = doc(db, "employees", userEmail);
        const unsubDoc = onSnapshot(empRef, (docSnap) => {
          if (docSnap.exists()) {
            setStatus(docSnap.data().status || 'clocked_out');
            setUserName(docSnap.data().name || 'Crew Member');
          } else {
            setUserName('Crew');
            setStatus('clocked_out');
          }
        }, (error) => {
          console.error("Firestore error:", error);
          setUserName('Crew Member');
        });

        return () => unsubDoc();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const navItems = [
    { name: 'Clock In/Out', href: '/employee/ClockinandOut', icon: Clock },
    { name: 'Customers', href: '/employee/customers', icon: Users },
    { name: 'Schedule', href: '/employee/schedule', icon: Calendar },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-10 px-6 text-left">
      {/* BRANDING */}
      <div className="mb-16 px-6 space-y-1">
        <p className="font-black text-2xl tracking-tighter text-slate-900 leading-none uppercase italic">{userName || 'Crew'}</p>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Clear View LLC</p>
      </div>

      {/* LINKS */}
      <div className="flex-1 space-y-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.name} 
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center justify-between px-6 py-5 rounded-[1.5rem] transition-all duration-300 group ${
                isActive 
                  ? 'bg-black text-white shadow-[0_20px_40px_-5px_rgba(0,0,0,0.3)] scale-[1.02]' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-5">
                <span className={`${isActive ? 'text-white' : 'text-slate-300 group-hover:text-slate-900'} transition-colors`}>
                  <item.icon size={22} />
                </span>
                <span className="font-black text-xs uppercase tracking-widest italic">{item.name}</span>
              </div>
              {isActive && <ChevronRight size={16} className="text-slate-400" />}
            </Link>
          );
        })}

        <button
          onClick={() => { setQuoteModalOpen(true); setSidebarOpen(false); }}
          className="w-full flex items-center gap-5 px-6 py-5 rounded-[1.5rem] transition-all duration-300 text-slate-400 hover:bg-slate-50 hover:text-slate-900 border-2 border-transparent hover:border-slate-100"
        >
          <Plus size={22} className="text-slate-300 group-hover:text-slate-900" />
          <span className="font-black text-xs uppercase tracking-widest italic">Book Now</span>
        </button>
      </div>

      {/* STATUS & LOGOUT */}
      <div className="mt-auto space-y-6 pt-8 border-t border-slate-50">
        <div className="flex items-center gap-4 px-6">
          <div className={`w-3 h-3 rounded-full ${status === 'clocked_in' ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
            {status === 'clocked_in' ? 'System Active' : 'Offline'}
          </p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-5 px-6 py-5 rounded-[1.5rem] font-black text-xs uppercase italic tracking-widest text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all w-full"
        >
          <LogOut size={22} />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-left overflow-x-hidden">

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-24 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-[60] flex items-center justify-between px-8">
        <div className="flex flex-col">
          <p className="font-black text-lg tracking-tighter text-slate-900 uppercase italic leading-none">{userName || 'Crew'}</p>
          <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">CVLLC Portal</p>
        </div>
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="p-3 bg-slate-50 rounded-2xl text-slate-900 hover:bg-slate-100 transition-all border border-slate-100"
        >
          {isSidebarOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      <div className="flex h-screen overflow-hidden pt-24 lg:pt-0">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-80 bg-white shadow-[20px_0_60px_-15px_rgba(0,0,0,0.05)] z-50 border-r border-slate-50">
          <SidebarContent />
        </aside>

        {/* MOBILE SIDEBAR OVERLAY */}
        <div className={`lg:hidden fixed inset-0 z-[55] transition-all duration-500 ${isSidebarOpen ? 'visible' : 'invisible'}`}>
          <div 
            className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-500 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => setSidebarOpen(false)}
          />
          <aside className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl transition-transform duration-500 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="h-full">
              <SidebarContent />
            </div>
          </aside>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative p-4 md:p-8">
          {children}
        </main>
      </div>

      {isQuoteModalOpen && <QuoteModal isOpen={isQuoteModalOpen} onClose={() => setQuoteModalOpen(false)} isEmployeeBooking={true} />}
    </div>
  );
}

