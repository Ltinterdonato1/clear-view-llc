'use client';
import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase'; // Ensure 'db' is exported from your firebase.ts
import { 
  signInWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function UnifiedLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Ensure the session stays active even if the browser closes
      await setPersistence(auth, browserLocalPersistence);
      
      // 2. Sign in the user
      const cleanEmail = email.toLowerCase().trim();
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 3. THE "TRAFFIC COP" LOGIC
      // If it's you, go straight to Admin
      if (cleanEmail === 'clearview3cleaners@gmail.com') {
        router.push('/admin/dashboard');
        return;
      }

      // If it's anyone else, check their role in the 'employees' collection
      const employeeDoc = await getDoc(doc(db, "employees", cleanEmail));
      
      if (employeeDoc.exists()) {
        const role = employeeDoc.data().role;
        
        if (role === 'admin') {
          router.push('/admin/dashboard'); 
        } else {
          // Hannah lands here and gets sent to /employee
          router.push('/employee');
        }
      } else {
        setError('No employee profile found. Please contact the administrator.');
      }
    } catch (err: any) {
      setError('Invalid email or password.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 space-y-10 border border-slate-100">
        
        <div className="text-center">
          <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">
            Staff Portal
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">
            Clear View LLC
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="space-y-4 text-left">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-900 ml-4 mb-1.5 block italic tracking-widest">Email</label>
              <input 
                type="email" 
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-black text-xs border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-300 italic"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ENTER EMAIL..."
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-900 ml-4 mb-1.5 block italic tracking-widest">Password</label>
              <input 
                type="password" 
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-black text-xs border-2 border-transparent focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-300 italic"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && <p className="text-[10px] font-black text-red-500 text-center uppercase italic tracking-widest">{error}</p>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic tracking-[0.2em] shadow-xl hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}