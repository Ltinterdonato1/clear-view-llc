'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

const heroImages = [
  "/img/worktruck1.png",
  "/img/worktruck2.jpg",
  "/img/worktruck4.jpg",
  "/img/worktruckcityrain.jpg",
  "/img/worktruckfall.jpg",
];

export default function Hero() {
  const [currentMonth, setCurrentMonth] = useState(0);

  useEffect(() => {
    setCurrentMonth(new Date().getMonth());
  }, []);

  const selectedImageIndex = currentMonth % heroImages.length;
  const currentHeroImage = heroImages[selectedImageIndex];

  return (
    <section className="relative pt-40 pb-24 px-6 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-start">
        
        {/* Left Side: Brand DNA Typography */}
        <div className="z-10 pt-4">
          <span className="text-blue-600 font-bold tracking-[0.3em] uppercase text-[10px] mb-6 block">
            Licensed • Bonded • Insured
          </span>
          
          <h1 className="text-5xl md:text-7xl lg:text-[5.0rem] font-black leading-[0.85] tracking-tighter mb-10 text-slate-900">
            Modern <br/>
            Window Cleaning <br/>
            <span className="text-slate-400 font-serif italic font-light tracking-tight">for Modern Homes.</span>
          </h1>
          
          <p className="text-2xl md:text-3xl font-serif italic text-slate-400 leading-tight mb-12 max-w-lg">
            The Clearest Windows in town! <span className="text-slate-900"></span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6">
            {/* The "Professional" CTA: Black, Bold, Sharp */}
            <button 
              onClick={() => window.dispatchEvent(new Event('open-quote-modal'))}
              className="bg-slate-900 text-white px-12 py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] hover:scale-110 transition-all duration-300 shadow-xl shadow-slate-200"
            >
              Get Your Instant Quote
            </button>
          </div>
        </div>

        {/* Right Side: High-End Framed Visual */}
        <div className="relative">
          <div className="relative w-full aspect-[4/5] rounded-[4rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] bg-slate-50 border border-slate-100">
            <Image 
              src={currentHeroImage} 
              alt="Clear View LLC Professional Service" 
              fill 
              priority
              className="object-cover transition-transform duration-[2000ms] hover:scale-110"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}