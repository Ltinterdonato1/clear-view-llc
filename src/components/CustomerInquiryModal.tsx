'use client';
import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X } from 'lucide-react';

const INITIAL_FORM_DATA = {
  firstName: '', lastName: '', email: '', phone: '', address: '', city: '',
};

export default function CustomerInquiryModal({ 
  isOpen, 
  onClose, 
  mode = 'referral',
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  mode?: 'referral' | 'customer';
  onSuccess?: () => void;
}) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveInquiry = async () => {
    // Basic validation: ensure all fields have a value
    const { firstName, lastName, email, phone, address, city } = formData;
    if (!firstName || !lastName || !email || !phone || !address || !city) {
      alert("Please fill out all fields before saving.");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const isReferralMode = mode === 'referral';
      
      const leadData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        status: 'New', 
        isReferral: isReferralMode, // true for employee referrals, false for direct admin entry
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "leads"), leadData);
      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error saving customer inquiry:", error);
      alert("Something went wrong with saving the inquiry. Please check your connection and try again!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setFormData(INITIAL_FORM_DATA);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md max-h-[95vh] overflow-hidden rounded-[3rem] shadow-2xl border border-white/20">
        <button onClick={handleCloseModal} className="absolute top-8 right-10 z-50 text-slate-300 hover:text-slate-900 font-black text-2xl">✕</button>
        <div className="p-8 md:p-12 overflow-y-auto max-h-[90vh]">
          {isSuccess ? (
            <div className="text-center">
              <h2 className="text-3xl font-black uppercase italic text-emerald-600 mb-4">
                Customer Saved!
              </h2>
              <p className="text-slate-700 mb-8">Information has been successfully saved.</p>
              <button onClick={handleCloseModal} className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase italic tracking-widest hover:bg-emerald-700 transition-all">Done</button>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-black uppercase italic text-slate-800 mb-8">
                New Customer
              </h2>
              <div className="space-y-6">
                <input 
                  type="text" 
                  name="firstName" 
                  placeholder="First Name" 
                  value={formData.firstName} 
                  onChange={handleChange} 
                  className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input 
                  type="text" 
                  name="lastName" 
                  placeholder="Last Name" 
                  value={formData.lastName} 
                  onChange={handleChange} 
                  className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input 
                  type="email" 
                  name="email" 
                  placeholder="Email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input 
                  type="tel" 
                  name="phone" 
                  placeholder="Phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input 
                  type="text" 
                  name="address" 
                  placeholder="Address" 
                  value={formData.address} 
                  onChange={handleChange} 
                  className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input 
                  type="text" 
                  name="city" 
                  placeholder="City" 
                  value={formData.city} 
                  onChange={handleChange} 
                  className="w-full p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleSaveInquiry} 
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase italic tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Add'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
