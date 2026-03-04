'use client';
import React, { useState, useEffect } from 'react';
import { db, auth, functions } from '../../../lib/firebase'; 
import { onAuthStateChanged } from 'firebase/auth'; 
import { useRouter } from 'next/navigation';
import { collection, query, getDocs, orderBy, doc, deleteDoc, updateDoc, onSnapshot, where, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions';
import { Users, UserPlus, Trash2, Loader2, ShieldCheck, Save, Edit2, X, LogOut, LogIn, MapPin } from 'lucide-react';

const BRANCHES = ['Tri-Cities', 'Walla Walla', 'Tacoma', 'Puyallup'];

export default function ManageStaff() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('field_employee');
  const [homeBranch, setHomeBranch] = useState('Tri-Cities');
  const [hourlyRate, setHourlyRate] = useState('20');
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) router.push('/login');
    });

    const q = query(collection(db, "employees"), orderBy("role", "asc"));
    const unsubscribeStaff = onSnapshot(q, (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Registry sync error:", error);
      setLoading(false);
    });

    return () => { unsubscribeAuth(); unsubscribeStaff(); };
  }, [router]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;
    setIsSubmitting(true);
    try {
      const createStaffAccount = httpsCallable(functions, 'createStaffAccount');
      await createStaffAccount({ 
        email: email.toLowerCase().trim(), 
        password: password, 
        name: fullName, 
        phone: phone,
        role: role,
        homeBranch: homeBranch,
        hourlyRate: parseFloat(hourlyRate) || 0
      });
      setFullName(''); setEmail(''); setPhone(''); setPassword(''); setHourlyRate('20');
    } catch (error: any) {
      alert(`Submission Failed: ${error.message}`);
    } finally { setIsSubmitting(false); }
  };

  const handleManualToggleClock = async (member: any) => {
    const isClockedIn = member.status === 'clocked_in';
    const attendRef = collection(db, "employees", member.id, "attendance");

    if (!window.confirm(`Force ${isClockedIn ? 'Clock OUT' : 'Clock IN'} for ${member.name}?`)) return;

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
          startTime: serverTimestamp(), endTime: null, date: new Date().toLocaleDateString(), status: 'active', totalHours: 0
        });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    }
  };

  const saveEdit = async () => {
    if (!editingMember) return;
    setIsUpdating(true);
    try {
      // Fix: Ensure no fields are 'undefined' which crashes Firebase
      const updates = {
        name: editingMember.name || '',
        role: editingMember.role || 'field_employee',
        hourlyRate: parseFloat(String(editingMember.hourlyRate)) || 0,
        homeBranch: editingMember.homeBranch || 'Tri-Cities',
        phone: editingMember.phone || ''
      };
      
      await updateDoc(doc(db, "employees", editingMember.id), updates);
      setEditingMember(null);
    } catch (err: any) {
      alert("Failed to update: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteStaff = async (id: string) => {
    if (window.confirm("Delete this staff member record?")) {
      try { await deleteDoc(doc(db, "employees", id)); } catch (error) { alert("Failed to delete."); }
    }
  };

  return (
    <div className="p-8 md:p-12 space-y-12 max-w-7xl mx-auto min-h-screen bg-slate-50/50 text-left font-sans">
      <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Personnel</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <form onSubmit={handleAddStaff} className="bg-white rounded-[3rem] p-8 shadow-xl border border-slate-100 space-y-8 sticky top-12">
            <div className="space-y-5">
              <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block tracking-widest italic">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 ring-blue-600 italic" placeholder="ENTER NAME..." required /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block tracking-widest italic">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 ring-blue-600 italic" placeholder="EMAIL..." required /></div>
              <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block tracking-widest italic">Password</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 ring-blue-600 italic" placeholder="PASSWORD..." required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block italic">Rate</label>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 ring-blue-600 italic" placeholder="20.00" /></div>
                <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block italic">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase italic appearance-none cursor-pointer"><option value="field_employee">Tech</option><option value="admin">Admin</option></select></div>
              </div>
              <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block tracking-widest italic">Home Branch</label>
              <select value={homeBranch} onChange={(e) => setHomeBranch(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase italic appearance-none cursor-pointer">
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select></div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase italic text-[10px] tracking-widest shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} Confirm</button>
          </form>
        </div>

        <div className="lg:col-span-8 grid gap-4">
          {staff.map((member) => (
            <div key={member.id} className={`rounded-[2.5rem] p-8 shadow-sm border-2 transition-all flex flex-col md:row items-center justify-between gap-6 ${member.status === 'clocked_in' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-6 flex-1 text-left w-full">
                <div onClick={() => handleManualToggleClock(member)} className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-inner cursor-pointer transition-all ${member.status === 'clocked_in' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 text-slate-300 hover:bg-emerald-100 hover:text-emerald-600'}`}>
                  {member.status === 'clocked_in' ? <LogOut size={24}/> : <LogIn size={24}/>}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-slate-900 uppercase italic text-2xl leading-none">{member.name}</h3>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-900 text-white italic">{member.role}</span>
                    <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-lg bg-blue-100 text-blue-600 italic flex items-center gap-1"><MapPin size={8}/> {member.homeBranch || 'N/A'}</span>
                    <p className="text-[9px] font-black text-slate-400 lowercase italic">{member.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase italic mb-1">Hourly Rate</p>
                  <p className="text-xl font-black text-slate-900 italic">${member.hourlyRate || 0}/hr</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingMember(member)} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Edit2 size={16}/></button>
                <button onClick={() => deleteStaff(member.id)} className="p-3 bg-slate-50 text-slate-300 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editingMember && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] max-w-xl w-full p-12 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setEditingMember(null)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 p-2"><X size={24}/></button>
            <h2 className="text-4xl font-black uppercase italic text-slate-900 mb-8">Update Profile</h2>
            <div className="space-y-6">
              <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block">Name</label>
              <input type="text" value={editingMember.name} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 ring-blue-600" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block">Rate</label>
                <input type="number" value={editingMember.hourlyRate} onChange={(e) => setEditingMember({...editingMember, hourlyRate: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:ring-2 ring-blue-600" /></div>
                <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block">Role</label>
                <select value={editingMember.role} onChange={(e) => setEditingMember({...editingMember, role: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase appearance-none"><option value="field_employee">Tech</option><option value="admin">Admin</option></select></div>
              </div>
              <div><label className="text-[9px] font-black uppercase text-slate-400 ml-4 mb-1.5 block">Home Branch</label>
              <select value={editingMember.homeBranch || 'Tri-Cities'} onChange={(e) => setEditingMember({...editingMember, homeBranch: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] uppercase appearance-none">
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select></div>
              <button onClick={saveEdit} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase italic text-[10px] tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-3">{isUpdating ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
