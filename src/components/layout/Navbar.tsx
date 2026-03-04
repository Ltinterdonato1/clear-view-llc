'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Instagram, Facebook, Lock } from 'lucide-react';

interface NavbarProps {
  onOpenModal?: () => void;
}

export default function Navbar({ onOpenModal }: NavbarProps) {
  const [showCTA, setShowCTA] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogoClick = (e: React.MouseEvent) => {
    if (pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      // Show CTA after scrolling past the hero (~600px)
      if (window.scrollY > 600) {
        setShowCTA(true);
      } else {
        setShowCTA(false);
      }

      // Detect if we are near the bottom of the page (near footer)
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      
      // If we are within 600px of the bottom, assume footer is visible
      if (scrollTop + windowHeight >= documentHeight - 600) {
        setIsAtBottom(true);
      } else {
        setIsAtBottom(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        
        {/* LOGO SECTION - Mirroring the Editorial Style */}
        <Link 
          href="/" 
          onClick={handleLogoClick}
          className="flex items-center gap-4 group cursor-pointer hover:scale-110 transition-all duration-500 origin-left"
        >
          <div className="flex-shrink-0 w-12 h-12 relative flex items-center justify-center">
            <img 
              src="/img/Logo.png" 
              alt="Clear View LLC" 
              className="max-w-full max-h-full object-contain group-hover:rotate-3 transition-transform duration-500"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="font-black text-black leading-none tracking-tighter uppercase text-xl">
              Clear View LLC
            </h1>
          </div>
        </Link>

        {/* RIGHT SIDE: SOCIALS, PHONE, & CTA */}
        <div className="flex items-center gap-8">
          
          {/* Socials & Staff - Subtle & Clean */}
          <div className="hidden lg:flex items-center gap-6 pr-8 border-r border-slate-200">
            <a 
              href="https://www.instagram.com/clearviewwindowcleanersllc/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`text-black hover:scale-125 transition-all duration-500 ${isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <Instagram size={18} strokeWidth={2.5} />
            </a>
            <a 
              href="https://www.facebook.com/profile.php?id=61587647291154" 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`text-black hover:scale-125 transition-all duration-500 ${isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <Facebook size={18} strokeWidth={2.5} />
            </a>
            <Link 
              href="/login" 
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-black hover:scale-110 transition-all duration-500 origin-right ${isAtBottom ? 'opacity-0 pointer-events-none -translate-x-2' : 'opacity-100'}`}
            >
              <Lock size={10} strokeWidth={3} />
              <span>Staff</span>
            </Link>
          </div>

          {/* Contact Info */}
          <div className="hidden md:block text-right">
            <a href="tel:2068489325" className="text-xl font-black text-black tracking-tighter hover:scale-110 transition-all duration-500 origin-right block">
              (206) 848-9325
            </a>
          </div>
          
          {/* The "Professional" Button: Matches Footer & Hero CTAs */}
          <div className={`transition-all duration-500 ${showCTA ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
            <button 
              onClick={() => onOpenModal?.()}
              className="bg-black text-white px-8 py-4 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:scale-110 active:scale-95 transition-all whitespace-nowrap"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}