'use client';
import React, { useState } from 'react';
import Image from 'next/image';

const services = [
  {
    title: "Residential Window Cleaning",
    description: "Experience truly sparkling, streak-free windows. Our pure-water system lifts away dirt and grime without harsh chemicals.",
    image: "/img/WindowCleaning1.jpg"
  },
  {
    title: "Commercial Window Cleaning",
    description: "Keep your business looking its best. From small storefronts to 3-story buildings, we ensure a professional shine.",
    image: "/img/Comercial.webp"
  },
  {
    title: "Gutter Cleaning",
    description: "Protect your home's foundation. Our thorough cleaning removes all debris and flushes downspouts. We disconnect the gutter if it is connected to a drain pipe to ensure a total clear-out.",
    image: "/img/GutterCleaning1.jpeg"
  },
  {
    title: "Pressure Washing",
    description: "Restore your home's exterior. We safely remove dirt and mold from driveways and siding. For Trex decking, we use a specialized light acid wash instead of pressure to prevent damage. We also offer rapid cedar fence restoration, making grey wood look new again in just 15-20 minutes.",
    image: "/img/PatioPressureWashing1.jpg"
  },
  {
    title: "Roof Maintenance",
    description: "Extend the life of your roof. We provide professional blow-offs and eco-friendly moss treatments using baking soda to safely protect your shingles without pressure washing.",
    image: "/img/Acid_Moss_Treatment.jpg"
  },
  {
    title: "Solar Panel Cleaning",
    description: "Maximize your energy efficiency. Our specialized fed-pole system safely removes dust and debris from panels on 1 and 2-story homes, ensuring peak performance.",
    image: "/img/Solar_Panel_Cleaning.jpg"
  }
];
export default function Services() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* HEADER: Adjusted for exact sizing */}
        <div className="mb-20 text-center">
          <span className="text-black font-bold tracking-[0.3em] uppercase text-[10px] mb-4 block">
            Our Expertise
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-4">
            Professional Solutions for <br/>
            <span className="text-slate-400 font-serif italic font-light tracking-tight">a Crystal Clear View.</span>
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-16 items-start">
          
          {/* SERVICE SELECTION */}
          <div className="w-full lg:w-5/12">
            {services.map((service, index) => (
              <div key={index} className="border-b border-slate-100 last:border-0">
                <button
                  onMouseEnter={() => setActiveTab(index)}
                  onClick={() => setActiveTab(index)}
                  className={`w-full text-left py-8 transition-all duration-500 ${
                    activeTab === index ? "opacity-100" : "opacity-20 hover:opacity-40"
                  }`}
                >
                  {/* TITLE: Matches 'Professional Solutions' size/weight */}
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-none">
                    {service.title}
                  </h3>
                  
                  {/* DESCRIPTION: Matches 'a Crystal Clear View' font/color */}
                  <div className={`overflow-hidden transition-all duration-700 ease-in-out ${
                    activeTab === index ? "max-h-96 mt-6" : "max-h-0"
                  }`}>
                    <p className="text-xl md:text-2xl font-serif italic text-slate-400 leading-tight pr-10">
                      {service.description}
                    </p>
                    
                    {/* Mobile Image */}
                    <div className="lg:hidden relative aspect-[16/10] w-full mt-8 rounded-[2rem] overflow-hidden shadow-2xl">
                      <Image src={service.image} alt={service.title} fill className="object-cover" />
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* DESKTOP VISUAL */}
          <div className="hidden lg:block lg:w-7/12 sticky top-24">
            <div className="relative aspect-[4/3] w-full rounded-[4rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.25)] bg-slate-50">
              {services.map((service, index) => (
                <Image
                  key={index}
                  src={service.image}
                  alt={service.title}
                  fill
                  priority={index === 0}
                  className={`object-cover transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                    activeTab === index ? "opacity-100 scale-100" : "opacity-0 scale-110"
                  }`}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}