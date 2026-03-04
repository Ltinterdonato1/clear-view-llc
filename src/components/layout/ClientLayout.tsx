'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import QuoteModal from '../QuoteModal';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const pathname = usePathname();

  // 3. UPDATED: Hide the public clutter if the path starts with /admin OR /employee
  const isPortal = pathname?.startsWith('/admin') || pathname?.startsWith('/employee');

  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener('open-quote-modal', handleOpenModal);
    return () => {
      window.removeEventListener('open-quote-modal', handleOpenModal);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 4. Use isPortal to hide Navbar */}
      {!isPortal && <Navbar onOpenModal={() => setIsModalOpen(true)} />}
      
      <main className="flex-grow">
        {children}
      </main>

      {/* 5. Use isPortal to hide Footer */}
      {!isPortal && <Footer />}

      {/* Hide the QuoteModal trigger logic in the portal as well if you want */}
      {!isPortal && (
        <QuoteModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      )}
    </div>
  );
}