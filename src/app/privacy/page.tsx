'use client';
import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="bg-white min-h-screen pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Main Header Mirroring the Home Section */}
        <div className="mb-20">
          <span className="text-blue-600 font-bold tracking-[0.3em] uppercase text-[10px] mb-4 block">
            Legal & Security
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-4">
            Privacy Policy & <br/>
            <span className="text-slate-400 font-serif italic font-light tracking-tight">Data Protection.</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-8">
            Last Updated: February 2026
          </p>
        </div>
        
        <div className="space-y-16">
          {/* Section 1 */}
          <section className="grid md:grid-cols-3 gap-8 items-start">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              01. Information <br/> We Collect
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                We collect only the information necessary to provide a professional result.
              </p>
              <div className="text-slate-600 space-y-4 font-medium leading-relaxed">
                <p>Specifically, we require contact details (name, email, phone) and the service address for on-site visits.</p>
                <p><strong>Property Photos:</strong> We document our work on your windows or gutters to ensure quality and verify results for our internal records.</p>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              02. Photography <br/> & Marketing
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                Your home is your sanctuary; we treat it with the utmost respect.
              </p>
              <ul className="text-slate-600 space-y-4 font-medium leading-relaxed list-none">
                <li>• <strong className="text-slate-900">No Identifiers:</strong> We never publish house numbers or license plates.</li>
                <li>• <strong className="text-slate-900">Privacy Boundaries:</strong> We exclude people, cars, and high-value items from all photos.</li>
                <li>• <strong className="text-slate-900">Pets:</strong> We only post pet photos with your explicit verbal permission.</li>
                <li>• <strong className="text-slate-900">Opt-Out:</strong> Simply tell us if you prefer your property not be featured in marketing.</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              03. Payment <br/> Security
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                We prioritize your financial security over everything else.
              </p>
              <p className="text-slate-600 font-medium leading-relaxed">
                Clear View LLC does not store your credit card information. All payments are handled by a PCI-compliant third-party via an encrypted portal to ensure your data stays private and protected.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              04. No-Hassle <br/> Philosophy
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight mb-6">
                We value your time and your inbox, unlike the corporations.
              </p>
              <p className="text-slate-600 font-medium leading-relaxed">
                We don't send quarterly marketing emails or annual solicitation. We only communicate regarding your scheduled service or quote requests. When you're ready for your next cleaning, we'll be here.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="grid md:grid-cols-3 gap-8 items-start border-t border-slate-100 pt-16">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase">
              05. Contact
            </h2>
            <div className="md:col-span-2">
              <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight">
                Any questions? Please reach out to <br/>
                <span className="text-slate-900 underline underline-offset-8">clearview3cleaners@gmail.com</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}