'use client';
import React from 'react';
import Image from 'next/image';

const steps = [
  {
    title: "Pure Water System",
    text: "We filter local water through a 4-stage deionization system, removing all minerals to create a powerful, natural cleaning agent."
  },
  {
    title: "Carbon Fiber Reach",
    text: "Our ultra-light poles allow us to reach up to 3 stories high while staying safely on the ground—no heavy ladders leaning on your home."
  },
  {
    title: "Crystal Clear Finish",
    text: "Because the water is pure, it acts like a magnet for dirt. It dries completely invisible with no squeegees, no streaks, and no residue."
  }
];

export default function Process() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="mb-20 text-center">
          <span className="text-black font-bold tracking-[0.3em] uppercase text-[10px] mb-4 block">
            The Clear View Method
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-[0.9]">
            Modern Technology <br/>
            <span className="text-slate-400 font-serif italic font-light tracking-tight">For a Better Shine.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-center">
          
          <div className="space-y-16">
            {steps.map((step, i) => (
              <div key={i} className="group">
                <div className="sm:col-span-3">
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">
                    {step.title}
                  </h3>
                  <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          {/* UPDATED: IMAGE HOLDER */}
          <div className="relative">
            <div className="relative aspect-[4/5] w-full rounded-[4rem] overflow-hidden shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] bg-slate-100">
              <Image 
                src="/img/Commercial2.jpeg" // UPDATE THIS FILENAME
                alt="Our professional cleaning process"
                fill
                className="object-cover"
              />
            </div>

            {/* Floating Safety Badge */}
            <div className="absolute -bottom-6 -right-4 md:-right-8 bg-black text-white p-8 rounded-[2.5rem] shadow-2xl -rotate-2 border-4 border-white z-20">
              <p className="font-black text-xl tracking-tighter leading-none mb-1">100% Safe</p>
              <p className="font-serif italic text-blue-100 text-sm leading-none">Ladder-Free Tech.</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}