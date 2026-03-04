'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, PlusCircle, LogOut, BarChart3, Users, Sparkles, CalendarCheck, Contact, DollarSign } from 'lucide-react'; 
import { auth } from '../lib/firebase'; 
import { signOut } from 'firebase/auth';
import QuoteModal from './QuoteModal';

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const navLinks = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
    { name: 'Schedule', href: '/admin/schedule', icon: <CalendarCheck size={18} /> },
    { name: 'Customers', href: '/admin/customers', icon: <Contact size={18} /> },
    { name: 'Payroll', href: '/admin/payroll', icon: <DollarSign size={18} /> },
    { name: 'Report', href: '/admin/reports', icon: <BarChart3 size={18} /> },
    { name: 'Staff', href: '/admin/manage-staff', icon: <Users size={18} /> },
  ];

  return (
    <>
      <nav className="bg-slate-900 text-white w-72 min-h-screen fixed left-0 top-0 flex flex-col p-8 shadow-2xl z-50 border-r border-slate-800">
        {/* LOGO */}
        <div className="flex items-center gap-4 mb-16 px-2 text-left">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <p className="font-black text-2xl uppercase italic tracking-tighter leading-none text-white">Admin</p>
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] mt-1">Clear View LLC</p>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <div className="flex-1 space-y-3 text-left">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 ml-4">Command Center</p>
          
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.name} 
                href={link.href}
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[11px] uppercase italic tracking-widest transition-all ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 scale-105 translate-x-2' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            );
          })}

          <div className="pt-8 space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-6 ml-4">Quick Actions</p>
            <button 
              onClick={() => setIsQuoteModalOpen(true)}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[11px] uppercase italic tracking-widest transition-all bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white shadow-lg shadow-emerald-500/5"
            >
              <CalendarCheck size={18} />
              Book Now
            </button>
          </div>
        </div>

        {/* LOGOUT BUTTON */}
        <button 
          onClick={handleLogout}
          className="mt-auto flex items-center gap-4 px-6 py-4 rounded-2xl font-black text-[11px] uppercase italic tracking-widest text-slate-500 hover:text-white hover:bg-red-500/10 transition-all text-left border border-transparent hover:border-red-500/20"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </nav>

      {/* GLOBAL QUOTE MODAL FOR ADMIN */}
      <QuoteModal 
        isOpen={isQuoteModalOpen} 
        onClose={() => setIsQuoteModalOpen(false)} 
        isEmployeeBooking={true} 
      />
    </>
  );
}