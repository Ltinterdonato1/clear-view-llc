'use client';
import Link from 'next/link';
import { Mail, Phone, MapPin, ShieldCheck, Instagram, Facebook } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white text-slate-900 pt-24 pb-12 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-8 pb-20">
          
          {/* NAVIGATION */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              Explore
            </h3>
            <ul className="space-y-3">
              <li><button onClick={scrollToTop} className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-black hover:scale-105 transition-all duration-300 origin-left block">Home</button></li>
              <li><Link href="/privacy" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-black hover:scale-105 transition-all duration-300 origin-left block">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-black hover:scale-105 transition-all duration-300 origin-left block">Terms of Service</Link></li>
              <li><Link href="/login" className="text-[11px] font-black uppercase tracking-widest text-slate-600 hover:text-black hover:scale-105 transition-all duration-300 origin-left block">Staff Login</Link></li>
            </ul>
          </div>

          {/* SERVICE AREAS (SEO) */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              Locations
            </h3>
            <ul className="space-y-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
              <li className="hover:text-black hover:scale-105 transition-all duration-300 origin-left cursor-default">Tri-Cities</li>
              <li className="hover:text-black hover:scale-105 transition-all duration-300 origin-left cursor-default">Walla Walla</li>
              <li className="hover:text-black hover:scale-105 transition-all duration-300 origin-left cursor-default">Tacoma</li>
              <li className="hover:text-black hover:scale-105 transition-all duration-300 origin-left cursor-default">Puyallup</li>
            </ul>
          </div>

          {/* CONTACT & SOCIALS */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              Connect
            </h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <a href="tel:2068489325" className="text-lg font-black tracking-tighter text-slate-900 hover:scale-105 transition-all duration-300 origin-left block">(206) 848-9325</a>
                <a href="mailto:clearview3cleaners@gmail.com" className="text-[11px] font-bold text-slate-600 hover:text-black hover:scale-105 transition-all duration-300 origin-left truncate block">clearview3cleaners@gmail.com</a>
              </div>
              
              <div className="flex gap-4 pt-2">
                <a href="https://www.instagram.com/clearviewwindowcleanersllc/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-black hover:scale-110 transition-all duration-300">
                  <Instagram size={18} />
                </a>
                <a href="https://www.facebook.com/profile.php?id=61587647291154" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-black hover:scale-110 transition-all duration-300">
                  <Facebook size={18} />
                </a>
              </div>
            </div>
          </div>

          {/* AVAILABILITY */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
              Hours
            </h3>
            <div className="space-y-4 text-[11px] font-black uppercase tracking-widest">
              <div className="flex flex-col gap-1 border-l-2 border-slate-100 pl-4 hover:border-black transition-colors duration-300">
                <span className="text-slate-400 text-[9px]">Mon — Fri</span>
                <span className="text-slate-900">8:30 — 6:00</span>
              </div>
              <div className="flex flex-col gap-1 border-l-2 border-slate-100 pl-4 hover:border-black transition-colors duration-300">
                <span className="text-slate-400 text-[9px]">Sat — Sun</span>
                <span className="text-slate-900">8:30 — 5:00</span>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM STRIP */}
        <div className="pt-12 border-t border-slate-100 text-center">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
            © {currentYear} CLEAR VIEW LLC
          </p>
        </div>
      </div>
    </footer>
  );
}