'use client';
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Check, X, Loader2, CalendarDays, Lock } from 'lucide-react';

interface EditablePunchRowProps {
  punch: any;
  employeeId: string;
  hourlyRate: number;
  vacationBalance: number;
  sickBalance: number;
  canEditRate?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function EditablePunchRow({ 
  punch, 
  employeeId, 
  hourlyRate,
  vacationBalance,
  sickBalance,
  canEditRate = true,
  onSave, 
  onCancel 
}: EditablePunchRowProps) {
  const [currentPunchType, setCurrentPunchType] = useState(punch.type || 'work');
  const [date, setDate] = useState(punch.startTime?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0]);
  
  const extractTime = (d?: Date) => {
    if (!d) return '09:00';
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const [startTime, setStartTime] = useState(extractTime(punch.startTime?.toDate?.()));
  const [endTime, setEndTime] = useState(extractTime(punch.endTime?.toDate?.()));
  const [rate, setRate] = useState(punch.hourlyRate?.toString() || hourlyRate?.toString() || '20');
  const [totalHours, setTotalHours] = useState(punch.totalHours?.toString() || '8.0');
  const [paidHours, setPaidHours] = useState(punch.paidHours?.toString() || (punch.type === 'work' ? punch.totalHours?.toString() : '0.0'));
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setCurrentPunchType(punch.type || 'work');
    setDate(punch.startTime?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0]);
    setStartTime(extractTime(punch.startTime?.toDate?.()));
    setEndTime(extractTime(punch.endTime?.toDate?.()));
    setRate(punch.hourlyRate?.toString() || hourlyRate?.toString() || '20');
    setTotalHours(punch.totalHours?.toString() || '8.0');
    setPaidHours(punch.paidHours?.toString() || (punch.type === 'work' ? punch.totalHours?.toString() : '0.0'));
  }, [punch, hourlyRate]);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      const punchRef = doc(db, "employees", employeeId, "attendance", punch.id);
      const updates: any = { 
        type: currentPunchType, 
        date: date,
        hourlyRate: parseFloat(rate) || 0,
      };

      let deductionDifference = 0;
      const oldPaidHours = punch.paidHours || 0;

      if (currentPunchType === 'work') {
        const startDT = new Date(`${date}T${startTime}:00`);
        const endDT = new Date(`${date}T${endTime}:00`);

        if (endDT < startDT) {
          alert("End time cannot be before start time.");
          setIsUpdating(false);
          return;
        }
        const newTotalHours = (endDT.getTime() - startDT.getTime()) / (1000 * 60 * 60);
        updates.startTime = Timestamp.fromDate(startDT);
        updates.endTime = Timestamp.fromDate(endDT);
        updates.totalHours = parseFloat(newTotalHours.toFixed(2));
        updates.paidHours = updates.totalHours;
      } else { // vacation or sick
        const hoursOff = parseFloat(totalHours) > 0 ? parseFloat(totalHours) : 8;
        const paidAmount = parseFloat(paidHours) || 0;
        
        updates.startTime = Timestamp.fromDate(new Date(`${date}T00:00:00`));
        const endDateTime = new Date(new Date(`${date}T00:00:00`).getTime() + hoursOff * 60 * 60 * 1000);
        updates.endTime = Timestamp.fromDate(endDateTime);
        updates.totalHours = parseFloat(hoursOff.toFixed(2));
        updates.paidHours = parseFloat(paidAmount.toFixed(2));
        
        deductionDifference = updates.paidHours - oldPaidHours;
      }
      
      await updateDoc(punchRef, updates);

      // Update employee balance if PTO deduction changed
      if (deductionDifference !== 0) {
        const empRef = doc(db, 'employees', employeeId);
        const balanceField = currentPunchType === 'vacation' ? 'vacationBalance' : 'sickBalance';
        const currentBalance = currentPunchType === 'vacation' ? vacationBalance : sickBalance;
        
        await updateDoc(empRef, {
          [balanceField]: Math.max(0, currentBalance - deductionDifference)
        });
      }

      onSave();
    } catch (error) {
      console.error("Error updating punch:", error);
      alert("Failed to update punch. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getDisplayHours = () => {
    if (currentPunchType === 'work') {
      const startDT = new Date(`${date}T${startTime}:00`);
      const endDT = new Date(`${date}T${endTime}:00`);
      if (isNaN(startDT.getTime()) || isNaN(endDT.getTime())) return '0.00';
      return ((endDT.getTime() - startDT.getTime()) / (1000 * 60 * 60)).toFixed(2);
    }
    return parseFloat(totalHours).toFixed(2);
  };

  const displayTotalHours = getDisplayHours();
  const currentBalance = currentPunchType === 'vacation' ? vacationBalance : sickBalance;

  return (
    <div className="flex flex-col gap-4 p-6 rounded-[2.5rem] bg-slate-50 text-slate-900 border-2 border-slate-200 shadow-2xl animate-in zoom-in-95 duration-300 mb-4">
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <CalendarDays size={14} />
          </div>
          <h4 className="text-[10px] font-black uppercase italic tracking-widest text-slate-900">Editing {currentPunchType} Entry</h4>
        </div>
        {currentPunchType !== 'work' && (
          <div className="bg-white px-3 py-1 rounded-full border border-slate-200 flex items-center gap-2">
            <span className="text-[7px] font-black uppercase text-slate-400 italic">Balance:</span>
            <span className="text-[10px] font-black italic text-blue-600">{currentBalance.toFixed(2)}h</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
            <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Date</label>
            <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-white text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic shadow-sm"
            />
        </div>
        {currentPunchType === 'work' ? (
          <>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Clock In</label>
              <input 
                type="time" 
                value={startTime} 
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-white text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic shadow-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-2 mb-1 italic">Clock Out</label>
              <input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-white text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic shadow-sm"
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-4 mb-1 italic">Total Hours Off</label>
              <input 
                type="number" 
                value={totalHours} 
                onChange={(e) => setTotalHours(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-white text-slate-900 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic shadow-sm"
                step="0.5"
                min="0.5"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-black uppercase text-slate-400 ml-4 mb-1 italic">Hours Paid</label>
              <input 
                type="number" 
                value={paidHours} 
                onChange={(e) => setPaidHours(e.target.value)}
                className="w-full p-3 text-[10px] font-black bg-white text-blue-600 rounded-xl border-2 border-transparent outline-none focus:border-slate-900 transition-all uppercase italic shadow-sm"
                step="0.1"
                min="0"
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
            className={`w-full p-3 text-[10px] font-black rounded-xl border-2 outline-none transition-all uppercase italic shadow-sm ${canEditRate ? 'bg-white text-emerald-600 border-transparent focus:border-emerald-600' : 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed'}`}
            step="0.01"
          />
          {!canEditRate && <Lock size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200">
          <p className="text-[7px] font-black uppercase text-slate-400 italic">Net Duration</p>
          <p className="text-xs font-black text-slate-900 italic">{displayTotalHours}h</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onCancel} 
            className="px-6 py-3 bg-white text-slate-400 rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-slate-200 transition-all"
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
