'use client';
import React, { useState, useEffect } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, Users, Calendar, LogOut, Menu, X, LayoutDashboard, FileText } from 'lucide-react';
import QuoteModal from '../../components/QuoteModal'; // Changed import

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState('clocked_out');
  const [userName, setUserName] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isQuoteModalOpen, setQuoteModalOpen] = useState(false); // Changed state variable name

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        const userEmail = user.email?.toLowerCase() || '';
        
        // 1. ADMIN BYPASS: If it's you, don't wait for an employee document
        if (userEmail === 'clearview3cleaners@gmail.com') {
          setUserName('Admin (Clear View)');
          setStatus('clocked_in');
          return;
        }

        // 2. EMPLOYEE LOOKUP: For Hannah and others
        const empRef = doc(db, "employees", userEmail);
        const unsubDoc = onSnapshot(empRef, (docSnap) => {
          if (docSnap.exists()) {
            setStatus(docSnap.data().status || 'clocked_out');
            setUserName(docSnap.data().name); // Removed fallback to enforce name from Firestore
          } else {
            // Fallback so the screen isn't blank if profile is missing
            setUserName('Crew');
            setStatus('clocked_out');
          }
        }, (error) => {
          console.error("Firestore error:", error);
          // If rules block access, at least show a name
          setUserName('Crew Member');
        });

        return () => unsubDoc();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const navItems = [
    { name: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard },
    { name: 'Clock In/Out', href: '/employee/ClockinandOut', icon: Clock },
    { name: 'Customers', href: '/employee/customers', icon: Users },
    { name: 'Schedule', href: '/employee/schedule', icon: Calendar },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex bg-slate-50 overflow-hidden font-sans text-left">
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static transition-transform duration-300 ease-in-out flex flex-col shadow-2xl`}>
        <div className="p-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Clear View LLC</h2>
          <p className="text-xl font-black italic uppercase text-white mt-1">{userName || 'Crew Portal'}</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${
                  isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800'
                }`}>
                <item.icon size={20} /> {item.name}
              </Link>
            );
          })}
          <button
            onClick={() => { setQuoteModalOpen(true); setSidebarOpen(false); }} // Changed state setter
            className="flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all text-slate-400 hover:bg-slate-800"
          >
            <FileText size={20} /> Book Now
          </button>
        </nav>

        <div className="p-8 border-t border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${status === 'clocked_in' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
             <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
               {status === 'clocked_in' ? 'Active' : 'Offline'}
             </p>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-3 text-slate-500 font-bold hover:text-red-400 transition-colors">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto">
        <header className="lg:hidden p-4 bg-white border-b flex justify-between items-center sticky top-0 z-40">
          <h1 className="font-black italic text-blue-600 uppercase tracking-tighter">
            {userName || 'Crew'}
          </h1>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 bg-slate-100 rounded-lg text-slate-600">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <div className="min-h-full">
          {children}
        </div>
      </main>

      {isQuoteModalOpen && <QuoteModal isOpen={isQuoteModalOpen} onClose={() => setQuoteModalOpen(false)} isEmployeeBooking={true} />} {/* Changed component and props */}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}