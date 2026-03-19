'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import ServiceStep from './ServiceStep';
import ContactStep from './ContactStep';
import CalendarStep from './CalendarStep';
import FinalReview from './FinalReview';
import SuccessStep from './SuccessStep';
import { calculateJobStats } from '../../lib/scheduleUtils';
import { FormData, QuoteStats } from '../../types/quote-types';
import { X } from 'lucide-react';

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  branch: 'Tri-Cities',
  homeSize: '1-2',
  stories: 1,
  windowCount: 20,
  selectedServices: [],
  deluxeWindow: false,
  skylightCount: 0,
  skylightInteriorCount: 0,
  trexWash: false,
  trexDeckSize: 'none',
  cedarFenceRestoration: false,
  fenceSize: 'none',
  sidingCleaning: false,
  backPatio: false,
  patioSize: 'none',
  drivewaySize: 'none',
  roofCleaning: false,
  roofBlowOff: false,
  mossTreatment: false,
  mossAcidWash: false,
  solarPanelCleaning: false,
  solarPanelCount: 0,
  selectedDate: null,
  endDate: null,
  timeSlot: null,
  endSlot: null,
  day1SelectedSlotStartTimeMinutes: null,
  day1SelectedJobEndTimeMinutes: null,
  day2SelectedSlotStartTimeMinutes: null,
  day2SelectedJobEndTimeMinutes: null,
  isAllDayBlockMode: false,
  mode: 'standard',
  memo: '',
  windowType: 'none',
  roofType: 'Composition',
  deluxeGutter: false,
  gutterFlush: false,
  actualBookedDays: [],
  renewalFrequency: null,
  referralCount: 0,
  isReturningCustomer: false,
};

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEmployeeBooking?: boolean;
  prefillData?: any;
}

export default function QuoteModal({ isOpen, onClose, isEmployeeBooking = false, prefillData }: QuoteModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookedTimestamps, setBookedTimestamps] = useState<number[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (prefillData) {
      setFormData(prev => ({ ...prev, ...prefillData }));
    }
  }, [prefillData]);

  // Detection logic for returning customers and referrals
  useEffect(() => {
    const detectCustomerProfile = async () => {
        if (formData.email || (formData.firstName && formData.lastName)) {
            const leadsRef = collection(db, "leads");
            let q;
            if (formData.email) {
                q = query(leadsRef, where("email", "==", formData.email.toLowerCase().trim()));
            } else {
                q = query(leadsRef, where("firstName", "==", formData.firstName.trim()), where("lastName", "==", formData.lastName.trim()));
            }

            const snap = await getDocs(q);
            if (!snap.empty) {
                const history = snap.docs.map(d => d.data());
                const firstWithRenewal = history.find(h => h.renewalFrequency);
                
                // Count referrals given by this customer
                const allLeadsQuery = query(collection(db, "leads"));
                const allSnap = await getDocs(allLeadsQuery);
                const email = formData.email?.toLowerCase().trim();
                const fullName = `${formData.firstName} ${formData.lastName}`.toLowerCase().trim();
                
                const referrals = allSnap.docs.filter(d => {
                    const data = d.data();
                    return data.referralSourceEmail?.toLowerCase().trim() === email || 
                           data.referralSourceName?.toLowerCase().trim() === fullName;
                }).length;

                setFormData(prev => ({
                    ...prev,
                    isReturningCustomer: true,
                    renewalFrequency: firstWithRenewal?.renewalFrequency || null,
                    referralCount: referrals
                }));
            }
        }
    };

    if (step === 2) { // Trigger detection when moving to service step
        detectCustomerProfile();
    }
  }, [step, formData.email, formData.firstName, formData.lastName]);

  useEffect(() => {
    const fetchBookedDates = async () => {
      const q = query(collection(db, "leads"), where("status", "==", "scheduled"));
      const snap = await getDocs(q);
      const booked: number[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.selectedDate) {
          const d = data.selectedDate instanceof Timestamp ? data.selectedDate.toDate() : new Date(data.selectedDate);
          booked.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
        }
      });
      setBookedTimestamps(booked);
    };
    const fetchEmployees = async () => {
      const q = query(collection(db, "employees"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const employees = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllEmployees(employees);
    };
    if (isOpen) {
      fetchBookedDates();
      fetchEmployees();
    }
  }, [isOpen]);

  const stats = useMemo(() => calculateJobStats(formData) as QuoteStats, [formData]);

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const leadData = {
        ...formData,
        ...stats,
        createdAt: serverTimestamp(),
        status: isEmployeeBooking ? 'scheduled' : 'new',
        source: isEmployeeBooking ? 'manual_admin' : 'website_quote',
        // Convert dates to Firestore Timestamps
        selectedDate: formData.selectedDate ? Timestamp.fromDate(formData.selectedDate) : null,
        endDate: formData.endDate ? Timestamp.fromDate(formData.endDate) : null,
        actualBookedDays: formData.actualBookedDays?.map(d => d instanceof Date ? Timestamp.fromDate(d) : d) || []
      };

      await addDoc(collection(db, "leads"), leadData);
      setStep(5);
    } catch (err) {
      console.error("Error saving lead:", err);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setStep(1);
    setFormData(initialFormData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/80 backdrop-blur-xl overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border border-slate-50 relative flex flex-col my-auto">
        <button 
          onClick={handleResetAndClose}
          className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-all p-2 z-10"
        >
          <X size={32} />
        </button>

        <div className="p-8 md:p-12">
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
