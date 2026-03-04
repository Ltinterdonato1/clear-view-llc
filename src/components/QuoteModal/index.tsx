'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore'; 
import { startOfDay, format, isValid, differenceInHours } from 'date-fns'; 
import { X } from 'lucide-react';

// Component Imports
import ContactStep from './ContactStep';
import ServiceStep from './ServiceStep';
import CalendarStep from './CalendarStep';
import FinalReview from './FinalReview';
import SuccessStep from './SuccessStep';

// Utils
import { normalizeSlot, calculateJobStats, TIME_SLOT_MAP } from '../../lib/scheduleUtils';
import { FormData } from '../../types/quote-types';

const INITIAL_FORM_DATA: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  branch: 'Tri-Cities',
  otherCity: '',
  selectedServices: [],
  windowCount: 0,
  windowType: 'none',
  homeSize: '1-2',
  stories: 1,
  selectedDate: null,
  timeSlot: 'morning',
  mode: 'single',
  endDate: null,
  endSlot: 'morning',
  additionalDates: [],
  additionalSlots: [],
  actualBookedDays: [],
  skylightCount: 0,
  skylightInteriorCount: 0,
  roofCleaning: false,
  roofBlowOff: false,
  mossTreatment: false,
  mossAcidWash: false,
  solarPanelCleaning: false,
  solarPanelCount: 0,
  deluxeGutter: false,
  gutterFlush: false,
  referralEmployee: '',
  referralSource: '',
  availableReferralRewards: 0,
  militaryDiscount: false,
  trexWash: false,
  trexDeckSize: 'none',
  cedarFenceRestoration: false,
  fenceSize: 'none',
  sidingCleaning: false,
  backPatio: false,
  patioSize: 'none',
  drivewaySize: 'none',
  roofType: '',
  deluxeWindow: false,
  day1SelectedSlotStartTimeMinutes: null,
  day1SelectedJobEndTimeMinutes: null,
  day2SelectedSlotStartTimeMinutes: null,
  day2SelectedJobEndTimeMinutes: null,
  isAllDayBlockMode: false,
  memo: ''
};

export default function QuoteModal({ 
  isOpen, 
  onClose, 
  isEmployeeBooking = false,
  prefillData = null
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  isEmployeeBooking?: boolean,
  prefillData?: any
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedTimestamps, setBookedTimestamps] = useState<Set<number>>(new Set());
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  useEffect(() => {
    const qCrew = query(collection(db, "employees"), orderBy("name", "asc"));
    getDocs(qCrew).then(snap => {
      setAllEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const fetchAndSetBookedTimestamps = async () => {
    const q = query(collection(db, "leads"), where("status", "in", ["Scheduled", "scheduled", "Confirmed", "confirmed", "Completed", "completed", "Archived", "archived"]));
    const snapshot = await getDocs(q);
    const booked = new Set<number>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.actualBookedDays && Array.isArray(data.actualBookedDays)) {
        data.actualBookedDays.forEach((ts: any) => {
          const date = ts.toDate ? ts.toDate() : new Date(ts);
          if (date && !isNaN(date.getTime())) booked.add(startOfDay(date).getTime());
        });
      }
    });
    setBookedTimestamps(booked);
    return booked;
  };

  useEffect(() => { if (isOpen) fetchAndSetBookedTimestamps(); }, [isOpen, step]);

  useEffect(() => {
    if (isOpen && prefillData) { setFormData({ ...INITIAL_FORM_DATA, ...prefillData }); }
    else if (isOpen) { setFormData(INITIAL_FORM_DATA); setStep(1); }
  }, [isOpen, prefillData]);

  const stats = useMemo(() => calculateJobStats(formData), [formData]);

  const handleResetAndClose = () => { setStep(1); setFormData(INITIAL_FORM_DATA); onClose(); };

  const getSafeDate = (d: any): Date | null => {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d.toDate === 'function') return d.toDate();
    const parsed = new Date(d);
    return isValid(parsed) ? parsed : null;
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const f = { ...formData };
      const firstName = (f.firstName || '').trim();
      const lastName = (f.lastName || '').trim();
      const email = (f.email || '').trim().toLowerCase();
      const address = f.address || '';
      const city = f.city === 'Other' ? (f.otherCity || 'Other City') : f.city;
      const fullAddress = `${address}, ${city}`;
      
      const taxItem = stats.lineItems.find((item: any) => item.name.toLowerCase().includes('tax'));
      const taxAmount = taxItem ? Number(taxItem.price) : 0;
      const serviceSubtotal = stats.lineItems
        .filter((item: any) => !item.name.toLowerCase().includes('tax'))
        .reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0);
      const discountAmount = stats.discounts.reduce((acc, d) => acc + d.amount, 0);

      // Compile Scheduling Strings
      const bookedDays: Date[] = [];
      const dateLines: string[] = [];
      const timeLines: string[] = [];
      
      const d1 = getSafeDate(f.selectedDate);
      if (d1) {
        bookedDays.push(d1);
        dateLines.push(format(d1, 'EEEE, MMMM do'));
        timeLines.push(TIME_SLOT_MAP[normalizeSlot(f.timeSlot || 'morning')]);
      }
      const d2 = getSafeDate(f.endDate);
      if (stats.daysRequired >= 2 && d2) {
        bookedDays.push(d2);
        dateLines.push(format(d2, 'EEEE, MMMM do'));
        timeLines.push(TIME_SLOT_MAP[normalizeSlot(f.endSlot || 'morning')]);
      }
      if (stats.daysRequired >= 3 && f.additionalDates) {
        f.additionalDates.forEach((d, i) => {
          const dn = getSafeDate(d);
          if (dn) {
            bookedDays.push(dn);
            dateLines.push(format(dn, 'EEEE, MMMM do'));
            const slot = f.additionalSlots?.[i] || 'morning';
            timeLines.push(TIME_SLOT_MAP[normalizeSlot(slot)]);
          }
        });
      }

      // Format Services Breakdown
      const srvItems: string[] = [];
      if (f.selectedServices.includes('Window Cleaning')) srvItems.push(`• Window Cleaning (${f.windowType?.toUpperCase()})${f.deluxeWindow ? ' + Deluxe Screens' : ''}`);
      if (f.selectedServices.includes('Gutter Cleaning')) srvItems.push(`• Gutter Cleaning (${f.homeSize} Bed)`);
      if (f.selectedServices.includes('Roof Cleaning')) {
        if (f.roofBlowOff) srvItems.push(`• Roof Blow-off`);
        if (f.mossTreatment) srvItems.push(`• Baking Soda Moss Out`);
        if (f.mossAcidWash) srvItems.push(`• Acid Wash Removal`);
      }
      if (f.selectedServices.includes('Pressure Washing')) {
        if (f.drivewaySize !== 'none') srvItems.push(`• Driveway Wash`);
        if (f.patioSize !== 'none') srvItems.push(`• Patio Wash`);
        if (f.sidingCleaning) srvItems.push(`• Siding Soft-Wash`);
      }

      // Prep Guide Conditional Logic
      const needsWater = (f.windowType === 'exterior' || f.windowType === 'both') || !!f.skylightCount || !!f.gutterFlush || !!f.sidingCleaning || f.drivewaySize !== 'none' || f.patioSize !== 'none' || f.fenceSize !== 'none' || !!f.trexWash;
      const needsInterior = (f.windowType === 'interior' || f.windowType === 'both');
      
      let prepGuideTable = '';
      if (needsWater || needsInterior) {
        prepGuideTable = `
          <div style="background: #f8fafc; padding: 40px; border-top: 1px solid #f1f5f9;">
            <div style="text-align: center; margin-bottom: 30px;"><h4 style="margin: 0; text-transform: uppercase; font-size: 10px; letter-spacing: 4px; color: #94a3b8; font-weight: 800;">Preparation Guide</h4></div>
            <table width="100%" style="font-size: 13px; color: #475569; line-height: 1.8; margin-bottom: 10px;">
              ${needsWater ? '<tr><td style="padding-bottom: 12px;">🔹 Ensure outdoor water spigots are accessible and turned ON.</td></tr>' : ''}
              ${needsInterior ? '<tr><td style="padding-bottom: 12px;">🔹 Please provide 3ft of clearance around interior windows.</td></tr>' : ''}
              <tr><td style="padding-bottom: 12px;">🔹 Secure all pets and move fragile items away from work areas.</td></tr>
            </table>
          </div>
        `;
      }

      const hoursUntilService = d1 ? differenceInHours(d1, new Date()) : 100;
      const reminderText = hoursUntilService < 24 
        ? 'We will remind you 1 hour before your service.' 
        : 'We will remind you 24 and 1 hours before your service.';

      // 3. Save Lead with standard names for Firebase Template
      await addDoc(collection(db, "leads"), {
        ...f,
        email, 
        to: [email],
        firstName, 
        lastName, 
        address, 
        city,
        fullAddress,
        date: dateLines.join('<br/>'),
        time: timeLines.join('<br/>'),
        serviceBreakdown: srvItems.join('\n'),
        subtotal: serviceSubtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        balanceDue: stats.total,
        status: 'New', 
        createdAt: serverTimestamp(), 
        total: stats.total, 
        totalMinutes: stats.totalMinutes,
        selectedDate: d1 ? Timestamp.fromDate(d1) : null,
        actualBookedDays: bookedDays.map(d => Timestamp.fromDate(d)),
        template: {
          name: 'confirmation',
          data: {
            firstName,
            fullAddress,
            date: dateLines.join('<br/>'),
            time: timeLines.join('<br/>'),
            serviceBreakdown: srvItems.join('\n'),
            subtotal: serviceSubtotal.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            balanceDue: stats.total
          }
        }
      });

      // 4. Send the Designer Email directly as a fallback
      const emailHtml = `
        <!DOCTYPE html><html>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background-color: #f1f5f9; margin: 0; padding: 40px 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);">
                <div style="background: #0f172a; padding: 60px 40px; text-align: center;">
                    <div style="display: inline-block; padding: 12px 24px; border: 1px solid #334155; border-radius: 100px; margin-bottom: 24px;">
                        <span style="color: #38bdf8; font-size: 10px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">Reservation Confirmed</span>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 42px; font-weight: 900; letter-spacing: -2px; text-transform: uppercase; font-style: italic;">Clear View LLC</h1>
                </div>
                <div style="padding: 50px 40px;">
                    <p style="font-size: 20px; line-height: 1.5; margin-bottom: 40px; color: #334155; font-weight: 300;">
                        Hi <strong style="font-weight: 800; color: #0f172a;">${firstName}</strong>, we have reserved a professional crew for your property at <span style="color: #0284c7; font-weight: 600;">${fullAddress}</span>. We look forward to seeing you.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 40px; border-collapse: separate; border-spacing: 0 10px;">
                        <tr>
                            <td style="background: #f8fafc; padding: 20px; border-radius: 16px 0 0 16px; border: 1px solid #e2e8f0; border-right: none; width: 50%;">
                                <span style="display: block; color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">Scheduled Date(s)</span>
                                <strong style="color: #0f172a; font-size: 16px;">${dateLines.join('<br/>')}</strong>
                            </td>
                            <td style="background: #f8fafc; padding: 20px; border-radius: 0 16px 16px 0; border: 1px solid #e2e8f0; border-left: none; width: 50%;">
                                <span style="display: block; color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">Arrival Window</span>
                                <strong style="color: #0284c7; font-size: 16px;">${timeLines.join('<br/>')}</strong>
                            </td>
                        </tr>
                    </table>
                    <div style="margin-bottom: 40px;">
                        <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #94a3b8; margin-bottom: 20px; font-weight: 800; text-align: center;">Service Breakdown</h3>
                        <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 20px; padding: 25px; font-size: 14px; font-weight: 500; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); white-space: pre-line; line-height: 1.8;">
${srvItems.join('\n')}
                        </div>
                    </div>
                    <div style="background: #0f172a; border-radius: 24px; padding: 35px; color: #ffffff;">
                        <table width="100%" style="border-collapse: collapse;">
                            <tr>
                                <td style="padding-bottom: 15px; color: #94a3b8; font-size: 13px;">Contract Subtotal</td>
                                <td style="padding-bottom: 15px; text-align: right; font-weight: 600;">$${serviceSubtotal.toFixed(2)}</td>
                            </tr>
                            ${taxAmount > 0 ? `
                            <tr>
                                <td style="padding-bottom: 15px; color: #94a3b8; font-size: 13px;">Sales Tax (8.5%)</td>
                                <td style="padding-bottom: 15px; text-align: right; font-weight: 600;">+$${taxAmount.toFixed(2)}</td>
                            </tr>` : ''}
                            ${discountAmount > 0 ? `
                            <tr>
                                <td style="padding-bottom: 15px; color: #10b981; font-size: 13px; font-weight: 700;">Multi-Service Savings</td>
                                <td style="padding-bottom: 15px; text-align: right; color: #10b981; font-weight: 700;">-$${discountAmount.toFixed(2)}</td>
                            </tr>` : ''}
                            <tr>
                                <td style="padding-top: 20px; border-top: 1px solid #1e293b; font-size: 16px; font-weight: 800;">Total Balance Due</td>
                                <td style="padding-top: 20px; border-top: 1px solid #1e293b; text-align: right; font-size: 28px; font-weight: 900; color: #38bdf8;">$${stats.total}</td>
                            </tr>
                        </table>
                        <p style="margin: 20px 0 0; font-size: 11px; color: #475569; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Due upon completion of service</p>
                    </div>
                </div>
                ${prepGuideTable}
                <div style="background: #ffffff; padding: 30px; text-align: center; border-top: 1px solid #f1f5f9;">
                  <p style="font-size: 13px; color: #475569; margin: 0;">⏰ <strong>Reminder:</strong> ${reminderText}</p>
                </div>
                <div style="border-top: 1px solid #e2e8f0; text-align: center; padding: 40px; background: #f8fafc;">
                    <p style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 15px; text-transform: uppercase; font-style: italic;">Thank you for booking with us!</p>
                    <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-weight: 800; margin-bottom: 15px;">Clear View LLC</p>
                    <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">📞 (206) 848-9325</p>
                    <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 25px;">📧 clearview3cleaners@gmail.com</p>
                    <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                        <a href="https://clearview3cleaners.com/terms" style="color: #64748b; text-decoration: none; margin: 0 10px;">Terms of Service</a>
                        <span style="color: #e2e8f0;">|</span>
                        <a href="https://clearview3cleaners.com/privacy" style="color: #64748b; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
                    </div>
                </div>
            </div>
        </body></html>
      `;
      await addDoc(collection(db, "mail"), { to: [email, 'clearview3cleaners@gmail.com'], message: { subject: `Reservation Confirmed - Clear View LLC`, html: emailHtml } });

      setStep(5);
    } catch (error: any) { alert(error.message); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 transition-all duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={handleResetAndClose} />
      <div className={`bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden transform transition-all duration-500 flex flex-col ${isOpen ? 'scale-100' : 'scale-95'}`}>
        <button onClick={handleResetAndClose} className="absolute top-8 right-8 z-50 p-2 text-slate-300 hover:text-slate-900 transition-colors bg-slate-50 rounded-full"><X size={24} /></button>
        <div className="p-8 md:p-12 overflow-y-auto max-h-[90vh]">
          {step === 1 && <ContactStep formData={formData} setFormData={setFormData} onNext={() => setStep(2)} allEmployees={allEmployees} />}
          {step === 2 && <ServiceStep formData={formData} setFormData={setFormData} stats={stats} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <CalendarStep formData={formData} setFormData={setFormData} stats={stats} onNext={() => setStep(4)} onBack={() => setStep(2)}  />}
          {step === 4 && <FinalReview formData={formData} setFormData={setFormData} stats={stats} onNext={handleFinalSubmit} onBack={() => setStep(3)} bookedTimestamps={bookedTimestamps} />}
          {step === 5 && <SuccessStep onClose={handleResetAndClose} />}
        </div>
      </div>
    </div>
  );
}
