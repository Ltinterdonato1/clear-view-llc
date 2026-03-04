'use client';
import { Star, Quote, MapPin } from 'lucide-react';

const REVIEWS = [
  {
    location: "Tri-Cities",
    resident: "Richland Homeowner",
    text: "Professional, punctual, and the windows look incredible. Their pure-water system is a game changer. Best service in the Tri-Cities.",
    stars: 5
  },
  {
    location: "Walla Walla",
    resident: "College Place Resident",
    text: "Used them for gutter cleaning and moss treatment. Fast, safe, and they left the property spotless. Highly recommend for Walla Walla area.",
    stars: 5
  },
  {
    location: "Tacoma",
    resident: "North End Business",
    text: "We use Clear View for our storefront. They keep our business looking sharp and are extremely reliable. Incredible quality in Tacoma.",
    stars: 5
  },
  {
    location: "Puyallup",
    resident: "South Hill Resident",
    text: "Experience truly sparkling results. The team was courteous and our windows haven't looked this good in years. Puyallup's finest.",
    stars: 5
  }
];

export default function GoogleReviews() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* HEADER: DNA Matched */}
        <div className="mb-20 text-center">
          <span className="text-black font-bold tracking-[0.3em] uppercase text-[10px] mb-4 block">
            Customer Voice
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-4">
            What Your Neighbors <br/>
            <span className="text-slate-400 font-serif italic font-light tracking-tight">Are Saying.</span>
          </h2>
          
          <div className="flex items-center justify-center gap-3 mt-8">
            <div className="flex text-black">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={14} fill="currentColor" stroke="none" />
              ))}
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
              5.0 Avg Rating Across 4 Locations
            </span>
          </div>
        </div>

        {/* REVIEWS GRID: 4 Locations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-left mb-20">
          {REVIEWS.map((review, idx) => (
            <div key={idx} className="relative group p-8 bg-slate-50/50 rounded-[2rem] border border-transparent hover:border-slate-100 hover:bg-white transition-all duration-500">
              <Quote className="text-slate-100 absolute -top-2 -left-2" size={40} strokeWidth={3} />
              <div className="relative space-y-6">
                <div className="flex items-center gap-2 text-blue-600">
                  <MapPin size={12} fill="currentColor" stroke="none" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{review.location}</span>
                </div>
                
                <p className="text-lg font-serif italic text-slate-500 leading-tight">
                  "{review.text}"
                </p>
                
                <div>
                  <p className="font-black text-slate-900 uppercase text-[10px] tracking-[0.2em] mb-1">{review.resident}</p>
                  <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                    Verified Customer
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* GOOGLE CTA: Professional Version */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-12 border-t border-slate-100">
          <div className="text-center md:text-left">
            <p className="text-slate-900 font-black uppercase text-xs tracking-widest mb-2">Read our full history</p>
            <p className="text-slate-400 font-serif italic">New reviews are published weekly on our Google Business profiles.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-400">CV</div>
              ))}
            </div>
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
              Trusted by 500+ Local Families
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}
