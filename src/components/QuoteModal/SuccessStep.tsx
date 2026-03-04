'use client';
import React from 'react';

/**
 * SuccessStep Component
 * @param {Function} onClose - This function should reset the step to 0 AND reset the formData state in the parent component.
 */
export default function SuccessStep({ onClose }: any) {
  
  const handleFinalClick = () => {
    // Scroll to top so the new quote starts at the header instead of the footer
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Trigger the reset function passed from the parent
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center animate-in zoom-in fade-in duration-700">
      
      

      {/* Success Header */}
      <h2 className="text-6xl font-black text-brand-blue uppercase tracking-tighter italic leading-none">
        You're All Set!
      </h2>
      
      <div className="mt-8 space-y-4">
        <p className="text-xl font-bold text-slate-800 uppercase tracking-tight">
          Booking Confirmed
        </p>
        <p className="text-slate-500 font-medium leading-relaxed">
          We've sent a detailed confirmation to your email. <br />
          We will see you at your scheduled time!
        </p>
      </div>

      {/* Main Action - This resets the app */}
      <div className="mt-12 space-y-10">
        <button 
          onClick={handleFinalClick} 
          className="w-full py-6 bg-brand-blue text-white rounded-[2rem] font-black uppercase shadow-2xl shadow-brand-blue/20 hover:scale-[1.02] active:scale-95 transition-all tracking-widest text-base italic"
        >
          See you then!
        </button>
        
        {/* Contact Footer */}
        <div className="pt-10 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">
            Need to reschedule?
          </p>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-black text-slate-800 uppercase italic">
              Call: <span className="text-brand-blue ml-1">(206) 848-9325</span>
            </p>
            <p className="text-sm font-black text-slate-800 uppercase italic">
              Email: <a href="mailto:clearview3cleaners@gmail.com" className="text-brand-blue underline hover:text-brand-orange transition-colors lowercase font-bold">clearview3cleaners@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}