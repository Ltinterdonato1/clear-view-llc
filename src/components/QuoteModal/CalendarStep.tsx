'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, startOfDay, addDays, isSameDay } from 'date-fns';
import {
  Clock, Check, Split, ArrowRight, ChevronLeft, Calendar as CalendarIcon, Blocks, AlertCircle,
} from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { normalizeSlot } from '../../lib/scheduleUtils';

import { FormData, CalendarStepProps } from '../../types/quote-types';

const JobTag = ({ job, day, formatHoursToHm }: any) => (
  <div
    className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-tight transition-all border cursor-default ${
      day === 1 ? 'bg-blue-600 border-blue-700 text-white shadow-sm' : 
      day === 2 ? 'bg-slate-900 border-slate-950 text-white shadow-sm' : 
      'bg-emerald-600 border-emerald-700 text-white shadow-sm'
    } opacity-90`}
  >
    {job.name} ({formatHoursToHm(job.time / 60)})
  </div>
);

const ARRIVAL_SLOTS = [
  { id: 'morning', label: '8:00 AM Start', desc: 'Full Day availability', hour: 8, minute: 0 },
  { id: 'midday', label: '11:30 AM Start', desc: 'Mid-day availability', hour: 11, minute: 30 },
  { id: 'afternoon', label: '3:00 PM Start', desc: 'Evening availability', hour: 15, minute: 0 },
];

export default function CalendarStep({ formData, setFormData, stats, onNext, onBack }: CalendarStepProps) {
  const [splitStep, setSplitStep] = useState(1);
  const [occupiedSlots, setOccupiedSlots] = useState<Record<number, Set<string>>>({});
  const [dayTotalMins, setDayTotalMins] = useState<Record<number, number>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const totalHoursForAllJobs = useMemo(() => stats.totalMinutes / 60, [stats.totalMinutes]);
  const isSplitMode = formData.mode === 'split';
  const isAllDayBlockMode = formData.mode === 'allDayBlock';
  const isInteractive = stats.daysRequired > 1;

  const [dayMapping, setDayMapping] = useState<Record<string, number>>({});

  const formatHoursToHm = (hoursFloat: number) => {
    const totalMinutes = Math.round(hoursFloat * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0 && minutes === 0) return `0m`;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  useEffect(() => {
    const initialMap: Record<string, number> = {};
    const SERVICE_PRIORITY: Record<string, number> = { 'Roof Cleaning': 1, 'Gutter Cleaning': 2, 'Pressure Washing': 3, 'Solar Panel Cleaning': 4, 'Window Cleaning': 5, 'Skylights': 6 };
    const sortedRawJobs = [...stats.serviceJobs].sort((a, b) => (SERVICE_PRIORITY[a.name] || 99) - (SERVICE_PRIORITY[b.name] || 99));
    const dMins = [0, 0, 0, 0, 0, 0, 0, 0];
    sortedRawJobs.forEach((job) => {
      let assignedDay = 1;
      let found = false;
      for (let i = 1; i <= stats.daysRequired; i++) {
        if (dMins[i] + job.time <= 540) { assignedDay = i; found = true; break; }
      }
      if (!found) {
        let minDay = 1; let minVal = dMins[1];
        for (let i = 1; i <= stats.daysRequired; i++) { if (dMins[i] < minVal) { minVal = dMins[i]; minDay = i; } }
        assignedDay = minDay;
      }
      const shouldForceSplitMove = formData.mode === 'split' && job.name.includes('Window Cleaning') && sortedRawJobs.length > 1;
      if (shouldForceSplitMove && assignedDay === 1) assignedDay = 2;
      initialMap[job.name] = assignedDay;
      dMins[assignedDay] += job.time;
    });
    setDayMapping(initialMap);
  }, [stats.serviceJobs, formData.mode, stats.daysRequired]);

  // LIVE OCCUPANCY SYNC
  useEffect(() => {
    if (!formData.branch) return;

    const leadsRef = collection(db, 'leads');
    const q = query(leadsRef, where('branch', '==', formData.branch));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const slotMap: Record<number, Set<string>> = {};
      const minsMap: Record<number, number> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const status = (data.status || '').toLowerCase();
        if (['completed', 'archived', 'cancelled'].includes(status)) return;
        
        const getSafeDate = (d: any): Date | null => {
          if (!d) return null;
          if (typeof d.toDate === 'function') return d.toDate();
          if (d.seconds !== undefined) return new Date(d.seconds * 1000);
          const parsed = new Date(d);
          return isNaN(parsed.getTime()) ? null : parsed;
        };

        const mode = (data.mode || 'single').toLowerCase();
        const jobTotalMins = Number(data.totalMinutes) || 120;

        const markSlot = (date: Date, slotID: string, duration: number) => {
          const ts = startOfDay(date).getTime();
          if (!slotMap[ts]) slotMap[ts] = new Set<string>();
          
          slotMap[ts].add(slotID);
          if (slotID === 'morning' && duration > 210) slotMap[ts].add('midday');
          if (slotID === 'morning' && duration > 420) slotMap[ts].add('afternoon');
          if (slotID === 'midday' && duration > 210) slotMap[ts].add('afternoon');
          
          minsMap[ts] = (minsMap[ts] || 0) + duration;
        };

        if (mode === 'alldayblock') {
          const bookedDays = data.actualBookedDays || [];
          bookedDays.forEach((ts: any, idx: number) => {
            const d = getSafeDate(ts); if (!d) return;
            const isFinalDay = idx === bookedDays.length - 1;
            const duration = isFinalDay ? (jobTotalMins % 540 || 540) : 540;
            markSlot(d, 'morning', duration);
          });
        } else {
          const bookedDays = data.actualBookedDays || [];
          if (bookedDays.length > 0) {
            bookedDays.forEach((ts: any, idx: number) => {
              const d = getSafeDate(ts); if (d) {
                let s = 'morning';
                if (idx === 0) s = normalizeSlot(data.timeSlot || 'morning');
                else if (idx === 1) s = normalizeSlot(data.endSlot || 'morning');
                else s = normalizeSlot(data.additionalSlots?.[idx - 2] || 'morning');
                markSlot(d, s, jobTotalMins / bookedDays.length);
              }
            });
          } else {
            const start = getSafeDate(data.selectedDate);
            if (start) markSlot(start, normalizeSlot(data.timeSlot || 'morning'), jobTotalMins);
          }
        }
      });
      setOccupiedSlots(slotMap);
      setDayTotalMins(minsMap);
    });

    return () => unsubscribe();
  }, [formData.branch]);

  const getSlotCapacity = (slotId: string) => {
    if (slotId === 'morning') return 540;
    if (slotId === 'midday') return 390;
    if (slotId === 'afternoon') return 180;
    return 0;
  };

  const isSlotImpossible = (slotId: string) => {
    const targetDate = splitStep === 1 ? formData.selectedDate : splitStep === 2 ? formData.endDate : (formData.additionalDates?.[splitStep - 3] || null);
    if (targetDate) {
      const dayTs = startOfDay(targetDate).getTime();
      const taken = occupiedSlots[dayTs];
      const existingMins = dayTotalMins[dayTs] || 0;
      
      const dayJobs = stats.serviceJobs.filter(j => dayMapping[j.name] === splitStep);
      const neededMins = dayJobs.reduce((acc, j) => acc + j.time, 0);

      if (isSameDay(targetDate, currentTime)) {
        const slot = ARRIVAL_SLOTS.find(s => s.id === slotId);
        if (slot) {
          const slotTime = new Date(currentTime);
          slotTime.setHours(slot.hour, slot.minute, 0, 0);
          const thirtyMinsFromNow = new Date(currentTime.getTime() + 30 * 60 * 1000);
          if (slotTime < thirtyMinsFromNow) return true;
        }
      }

      if (taken && taken.has(slotId)) return true;
      if (existingMins + neededMins > 540) return true;
      if (neededMins > getSlotCapacity(slotId)) return true;

      if (taken) {
        if (slotId === 'morning' && neededMins > 210 && taken.has('midday')) return true;
        if (slotId === 'morning' && neededMins > 420 && taken.has('afternoon')) return true;
        if (slotId === 'midday' && neededMins > 210 && taken.has('afternoon')) return true;
      }
    }
    return false;
  };

  const canFinalize = isAllDayBlockMode ? formData.selectedDate && formData.timeSlot : isSplitMode ? formData.selectedDate && formData.endDate && formData.timeSlot && formData.endSlot : formData.selectedDate && formData.timeSlot;

  const disabledDays = [
    { before: startOfDay(currentTime) },
    ...Object.keys(dayTotalMins).filter((tsStr) => {
      const ts = Number(tsStr);
      const mins = dayTotalMins[ts] || 0;
      const takenCount = occupiedSlots[ts]?.size || 0;
      
      // Blur day if:
      // 1. All day block mode and day has ANY work
      // 2. All 3 slots are taken
      // 3. Day is over 500 minutes full
      if (isAllDayBlockMode && mins > 0) return true; 
      if (takenCount >= 3) return true;
      if (mins >= 500) return true; 
      return false;
    }).map((ts) => new Date(Number(ts))),
    ...(splitStep === 2 && formData.selectedDate ? [{ before: addDays(formData.selectedDate, 1) }] : []),
    ...(splitStep > 2 && formData.endDate ? [{ before: addDays(formData.endDate, splitStep - 2) }] : []),
  ];

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 text-left pt-2">
      <style jsx global>{`
        .rdp { --rdp-cell-size: 45px; --rdp-accent-color: #2563eb; --rdp-background-color: #dbeafe; margin: 0; }
        .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background-color: var(--rdp-accent-color) !important; color: white !important; font-weight: 900 !important; border-radius: 12px !important; }
        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: #f1f5f9 !important; border-radius: 12px !important; }
        .rdp-head_cell { font-size: 10px !important; font-weight: 900 !important; text-transform: uppercase !important; letter-spacing: 0.1em !important; color: #94a3b8 !important; }
      `}</style>

      <div className="flex flex-col items-center gap-6 relative">
        <button onClick={onBack} className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-blue-600 transition-colors group">
          <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        <div className="bg-slate-100 p-1.5 rounded-[2rem] flex gap-1 w-full max-md border border-slate-200">
          {(['single', 'split', 'allDayBlock'] as const).map((m) => {
            const isDisabled = (m === 'single' && totalHoursForAllJobs > 9) || 
                               (m === 'split' && (stats.serviceJobs.length < 2 || totalHoursForAllJobs > 18)) || 
                               (m === 'allDayBlock' && totalHoursForAllJobs <= 9);
            return (
              <button
                key={m} onClick={() => handleModeChange(m)}
                disabled={isDisabled}
                className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  formData.mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                } ${ isDisabled ? 'opacity-20 grayscale' : '' }`}
              >
                {m === 'single' ? <CalendarIcon size={14} /> : m === 'split' ? <Split size={14} /> : <Blocks size={14} />}
                {m.replace(/([A-Z])/g, ' $1').trim()}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid gap-6 max-w-4xl mx-auto ${stats.daysRequired > 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {Array.from({ length: Math.max(1, stats.daysRequired) }).map((_, idx) => {
          const dNum = idx + 1;
          const dayJobs = stats.serviceJobs.filter(j => dayMapping[j.name] === dNum || (!dayMapping[j.name] && dNum === 1));
          const dayHours = dayJobs.reduce((acc, j) => acc + j.time, 0) / 60;
          const isActive = splitStep === dNum;
          const dayDate = dNum === 1 ? formData.selectedDate : dNum === 2 ? formData.endDate : (formData.additionalDates?.[dNum - 3] || null);
          const currentSlot = dNum === 1 ? formData.timeSlot : dNum === 2 ? formData.endSlot : (formData.additionalSlots?.[dNum - 3] || null);
          
          return (
            <div key={dNum} onClick={() => isInteractive && setSplitStep(dNum)} className={`p-6 rounded-[2.5rem] border-4 transition-all relative overflow-hidden ${isInteractive ? 'cursor-pointer' : 'cursor-default'} ${
                isActive ? 'border-blue-600 bg-blue-50 shadow-xl' : 'border-slate-100 bg-white hover:border-blue-200 opacity-60'
              } ${dayHours > 9 ? 'ring-4 ring-red-500/20 border-red-500' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase italic">Day {dNum}</p>
                  <p className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none mt-1">
                    {dayDate ? format(new Date(dayDate), 'MMM do') : 'Select Date'}
                  </p>
                  {currentSlot && <p className="text-[9px] font-black text-blue-500 uppercase mt-1 tracking-widest">{ARRIVAL_SLOTS.find(s => s.id === currentSlot)?.label}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Work</p>
                  <p className={`text-lg font-black italic ${dayHours > 9 ? 'text-red-500' : 'text-slate-900'}`}>{formatHoursToHm(dayHours)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {dayJobs.map((j) => (
                  <JobTag key={j.name} job={j} day={dNum} formatHoursToHm={formatHoursToHm} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-[3.5rem] p-8 md:p-12 shadow-sm flex flex-col items-center justify-center min-h-[500px]">
          <div className="scale-110 md:scale-125 transition-transform duration-500">
            <DayPicker mode="single" selected={ splitStep === 1 ? (formData.selectedDate ?? undefined) : splitStep === 2 ? (formData.endDate ?? undefined) : (formData.additionalDates?.[splitStep - 3] ?? undefined) } 
              onSelect={(d) => {
                if (!d) return;
                const dStart = startOfDay(d);
                setFormData((p: any) => {
                  if (splitStep === 1) return { ...p, selectedDate: dStart };
                  if (splitStep === 2) return { ...p, endDate: dStart };
                  const newDates = [...(p.additionalDates || [])];
                  newDates[splitStep - 3] = dStart;
                  return { ...p, additionalDates: newDates };
                });
              }} disabled={disabledDays}
            />
          </div>
        </div>
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-6 mb-4">Day {splitStep} Window</h4>
            <div className="space-y-4">
              {ARRIVAL_SLOTS.map((slot) => {
                let isSelected = false;
                if (splitStep === 1) isSelected = formData.timeSlot === slot.id;
                else if (splitStep === 2) isSelected = formData.endSlot === slot.id;
                else isSelected = (formData.additionalSlots?.[splitStep - 3] === slot.id);

                const disabled = isSlotImpossible(slot.id);
                
                return (
                  <button key={slot.id} disabled={disabled} onClick={() => {
                      setFormData((p: any) => {
                        if (splitStep === 1) return { ...p, timeSlot: slot.id };
                        if (splitStep === 2) return { ...p, endSlot: slot.id };
                        const newSlots = [...(p.additionalSlots || [])];
                        newSlots[splitStep - 3] = slot.id;
                        return { ...p, additionalSlots: newSlots };
                      });
                    }} className={`w-full p-7 rounded-[2.5rem] border-2 transition-all flex items-center justify-between text-left ${
                      disabled ? 'opacity-20 grayscale cursor-not-allowed' : isSelected ? 'border-blue-600 bg-blue-50 shadow-md' : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`p-4 rounded-2xl ${ isSelected ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400' }`}><Clock size={22} /></div>
                      <div><p className="font-black uppercase italic text-base text-slate-900 leading-tight">{slot.label}</p></div>
                    </div>
                    {isSelected && <Check className="text-blue-600" size={28} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pt-8">
            <button onClick={onNext} disabled={!canFinalize} className={`w-full py-8 rounded-[2.5rem] font-black uppercase italic transition-all shadow-xl flex items-center justify-center gap-2 text-lg ${ canFinalize ? 'bg-slate-900 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-300 transparent' }`}>
              Confirm Times <ArrowRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
