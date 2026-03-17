import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, collection, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Check, X, Loader2, PlusCircle, Lock } from 'lucide-react';

interface AddPunchFormProps {
  employeeId: string;
  hourlyRate: number;
  vacationBalance: number;
  sickBalance: number;
  canEditRate?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function AddPunchForm({ 
  employeeId, 
  hourlyRate,
  vacationBalance,
  sickBalance,
  canEditRate = true,
  onSave, 
  onCancel 
}: AddPunchFormProps) {
  const [punchType, setPunchType] = useState<'work' | 'vacation' | 'sick'>('work');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [totalHours, setTotalHours] = useState('8.0');
  const [paidHours, setPaidHours] = useState('8.0');
  const [rate, setRate] = useState(hourlyRate?.toString() || '20');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (punchType === 'work') {
      setPaidHours(totalHours);
    } else {
      const currentBalance = punchType === 'vacation' ? vacationBalance : sickBalance;
      setPaidHours(Math.min(parseFloat(totalHours) || 8, currentBalance).toString());
    }
  }, [totalHours, punchType, vacationBalance, sickBalance]);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const attendRef = collection(db, "employees", employeeId, "attendance");
      const newPunch: any = { 
        type: punchType, 
        date: date,
        hourlyRate: parseFloat(rate) || 0,
        status: 'completed'
      };

      let deductionAmount = 0;

      if (punchType === 'work') {
        const startDT = new Date(`${date}T${startTime}:00`);
        const endDT = new Date(`${date}T${endTime}:00`);

        if (endDT < startDT) {
          alert("End time cannot be before start time.");
          setIsUpdating(false);
          return;
        }
        const newTotalHours = (endDT.getTime() - startDT.getTime()) / (1000 * 60 * 60);
        newPunch.startTime = Timestamp.fromDate(startDT);
        newPunch.endTime = Timestamp.fromDate(endDT);
        newPunch.totalHours = parseFloat(newTotalHours.toFixed(2));
        newPunch.paidHours = newPunch.totalHours;
      } else { // vacation or sick
        const hoursOff = parseFloat(totalHours) > 0 ? parseFloat(totalHours) : 8;
        const paidAmount = parseFloat(paidHours) || 0;
        
        newPunch.startTime = Timestamp.fromDate(new Date(`${date}T00:00:00`));
        const endDateTime = new Date(new Date(`${date}T00:00:00`).getTime() + hoursOff * 60 * 60 * 1000);
        newPunch.endTime = Timestamp.fromDate(endDateTime);
        newPunch.totalHours = parseFloat(hoursOff.toFixed(2));
        newPunch.paidHours = parseFloat(paidAmount.toFixed(2));
        
        deductionAmount = newPunch.paidHours;
      }
      
      await addDoc(attendRef, newPunch);

      // Update employee balance if PTO was used
      if (deductionAmount > 0) {
        const empRef = doc(db, 'employees', employeeId);
        const balanceField = punchType === 'vacation' ? 'vacationBalance' : 'sickBalance';
        const currentBalance = punchType === 'vacation' ? vacationBalance : sickBalance;
        
        await updateDoc(empRef, {
          [balanceField]: Math.max(0, currentBalance - deductionAmount)
        });
      }

      onSave();
    } catch (error) {
      console.error("Error adding punch:", error);
      alert("Failed to add punch. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getDisplayHours = () => {
    if (punchType === 'work') {
      const startDT = new Date(`${date}T${startTime}:00`);
      const endDT = new Date(`${date}T${endTime}:00`);
      if (isNaN(startDT.getTime()) || isNaN(endDT.getTime())) return '0.00';
      return ((endDT.getTime() - startDT.getTime()) / (1000 * 60 * 60)).toFixed(2);
    }
    return parseFloat(totalHours).toFixed(2);
  };

  const displayTotalHours = getDisplayHours();
  const currentBalance = punchType === 'vacation' ? vacationBalance : sickBalance;

  return (
    <div className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-white text-slate-900 border-[3px] border-slate-900 shadow-2xl animate-in zoom-in-95 duration-300 mb-4 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-2 h-full bg-slate-900" />
      <div className="flex justify-between items-center px-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-xl">
            <PlusCircle size={16} />
          </div>
          <h4 className="text-xs font-black uppercase italic tracking-widest text-slate-900">Add New Entry</h4>
        </div>
        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            {(['work', 'vacation', 'sick'] as const).map((type) => (
                <button 
                    key={type}
                    onClick={() => setPunchType(type)}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase italic tracking-widest transition-all ${
                        punchType === type 
                            ? 'bg-slate-900 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                >
                    {type}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 px-4 pt-4">
        <div>
            <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Date</label>
            <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-slate-50 text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic"
            />
        </div>
        {punchType === 'work' ? (
          <>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Clock In</label>
              <input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-slate-50 text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Clock Out</label>
              <input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-slate-50 text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 italic">Hours Off</label>
                <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest italic bg-blue-50 px-2 py-0.5 rounded-full">Bal: {currentBalance.toFixed(2)}h</span>
              </div>
              <input 
                type="number" 
                value={totalHours} 
                onChange={(e) => setTotalHours(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-slate-50 text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic"
                step="0.5"
                min="0.5"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Hours Paid</label>
              <input 
                type="number" 
                value={paidHours} 
                onChange={(e) => setPaidHours(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-blue-50 text-blue-600 rounded-xl border-2 border-blue-100 outline-none focus:border-blue-600 transition-all uppercase italic"
                step="0.1"
                min="0"
                max={Math.min(parseFloat(totalHours) || 8, currentBalance)}
              />
            </div>
          </>
        )}
        <div className="space-y-1 relative">
          <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Rate ($)</label>
          <input 
            type="number" 
            value={rate} 
            readOnly={!canEditRate}
            onChange={(e) => setRate(e.target.value)}
            className={`w-full p-3 text-[10px] font-black rounded-xl border-2 outline-none transition-all uppercase italic shadow-sm ${canEditRate ? 'bg-emerald-50 text-emerald-600 border-emerald-100 focus:border-emerald-600' : 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed'}`}
            step="0.01"
          />
          {!canEditRate && <Lock size={12} className="absolute right-3 top-[calc(50%+6px)] -translate-y-1/2 text-slate-300" />}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 px-4">
        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <p className="text-[7px] font-black uppercase text-slate-400 italic mb-0.5">Net Duration</p>
          <p className="text-xs font-black text-slate-900 italic tracking-tighter">{displayTotalHours}h</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onCancel} 
            className="px-6 py-3 bg-white text-slate-400 rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-slate-50 border border-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            className="px-8 py-3 bg-slate-900 hover:bg-black text-white rounded-xl transition-all shadow-lg font-black text-[9px] uppercase italic tracking-widest flex items-center gap-2" 
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} strokeWidth={3} />}
            Create Record
          </button>
        </div>
      </div>
    </div>
  );
}