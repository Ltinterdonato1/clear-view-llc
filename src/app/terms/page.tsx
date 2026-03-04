'use client';
import React from 'react';

export default function TermsOfService() {
  const currentMonthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Main Header Mirroring the Brand DNA */}
        <div className="mb-20 border-b border-slate-100 pb-12">
          <span className="text-blue-600 font-bold tracking-[0.3em] uppercase text-[10px] mb-4 block">
            Client Agreement
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-4">
            Terms of Service & <br/>
            <span className="text-slate-400 font-serif italic font-light tracking-tight">Standard Operations.</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-8">
            Last Updated: {currentMonthYear}
          </p>
        </div>
        
        <div className="space-y-20">
          {/* Section 1 */}
          <section className="grid md:grid-cols-3 gap-8 items-start">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              01. Services <br/> Provided
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                Professional window and gutter maintenance delivered safely from the ground.
              </p>
              <p className="text-slate-600 font-medium leading-relaxed">
                Clear View LLC utilizes advanced water-fed pole technology, allowing our technicians to reach up to 3 stories with precision while ensuring the safety of our team and your property.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              02. Weather <br/> Policy
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                Rain or shine, we prioritize the quality of your results and team safety.
              </p>
              <p className="text-slate-600 font-medium leading-relaxed">
                While light rain does not affect the quality of a pure-water clean, we reserve the right to reschedule in the event of high winds or severe lightning to maintain our high standards of service.
              </p>
            </div>
          </section>

          {/* Section 3 - Responsibilities */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase text-blue-600">
              03. Prep <br/> & Access
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-8">
                To ensure a flawless finish, please prepare your property before our arrival.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
                <div className="space-y-2">
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">Interior Access</p>
                  <p className="text-slate-600 text-sm leading-relaxed">Please maintain <strong className="text-slate-900">3ft of clear space</strong> in front of all windows. Move furniture, desks, and fragile sills items prior to arrival.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">Windows & Sills</p>
                  <p className="text-slate-600 text-sm leading-relaxed">Ensure all windows are fully closed. Notify our technician of any known leaks or hardware issues before we begin.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">Exterior Prep</p>
                  <p className="text-slate-600 text-sm leading-relaxed">Clear furniture and planters from patios/walkways for pressure washing. Ensure outdoor spigots are on and accessible.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight">The Promise</p>
                  <p className="text-slate-600 text-sm leading-relaxed">Proper preparation ensures we can focus entirely on the quality of your cleaning and stay on schedule.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              04. Payment <br/> Terms
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                Simple, transparent billing upon the completion of our work.
              </p>
              <p className="text-slate-600 font-medium leading-relaxed">
                Payment is due upon completion of service. We accept cash, local checks, and all major debit/credit cards through our secure online portal.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              05. Our <br/> Guarantee
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6 text-blue-600">
                If it isn't a "Clear View," we'll make it right at no cost.
              </p>
              <p className="text-slate-600 font-medium leading-relaxed">
                If you notice streaks or spots within 48 hours, contact us at <span className="text-slate-900 font-bold underline decoration-blue-500 underline-offset-4">206-848-9325</span>. We will return to resolve the issue immediately.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}