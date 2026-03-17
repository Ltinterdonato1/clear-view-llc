'use client';
import React, { useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';

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
      await setPersistence(auth, browserLocalPersistence);
      const cleanEmail = email.toLowerCase().trim();
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      
      if (cleanEmail === 'clearview3cleaners@gmail.com') {
        router.push('/admin/schedule');
        return;
      }

      const employeeDoc = await getDoc(doc(db, "employees", cleanEmail));
      if (employeeDoc.exists()) {
        const role = employeeDoc.data().role;
        if (role === 'admin') {
          router.push('/admin/schedule'); 
        } else {
          router.push('/employee');
        }
      } else {
        setError('No employee profile found.');
      }
    } catch (err: any) {
      setError('Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-50 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-slate-900 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-slate-200 mx-auto mb-8 rotate-3">
            <Sparkles className="text-blue-400" size={40} />
          </div>
          <h1 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
            Staff<br/>Portal
          </h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.5em] mt-6 italic">
            Clear View LLC
          </p>
        </div>

        <div className="bg-white rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] p-12 border border-slate-50">
          <form onSubmit={handleLogin} className="space-y-10">
            <div className="space-y-6">
              <div className="relative group">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-6 mb-2 block tracking-widest italic transition-colors group-focus-within:text-blue-600">Email Address</label>
                <input 
                  type="email" 
                  className="w-full px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] font-black text-sm outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-200 italic"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@clearview.com"
                  required
                />
              </div>
              <div className="relative group">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-6 mb-2 block tracking-widest italic transition-colors group-focus-within:text-blue-600">Secure Password</label>
                <input 
                  type="password" 
                  className="w-full px-8 py-5 bg-slate-50 border-2 border-transparent rounded-[2rem] font-black text-sm outline-none focus:bg-white focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-200"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-red-500 bg-red-50 py-3 rounded-2xl animate-in fade-in zoom-in-95">
                <AlertCircle size={14} />
                <p className="text-[10px] font-black uppercase italic tracking-widest">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase italic tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-blue-600 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-4 text-sm"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <>
                  Log In
                  
                </>
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center mt-12 text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">
          Authorized Personnel Only • Secure Session
        </p>
      </div>
    </div>
  );
}
