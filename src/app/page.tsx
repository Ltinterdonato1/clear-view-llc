'use client';
import React, { useState, useEffect } from 'react';
// Navbar and Footer are removed from here because they live in layout.tsx now
import Hero from '../components/home/Hero';
import Services from '../components/home/Services';
import QuoteModal from '../components/QuoteModal';
import Process from '../components/home/Process';
import GoogleReviews from '../components/home/GoogleReviews';

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenModal = () => setIsModalOpen(true);
    window.addEventListener('open-quote-modal', handleOpenModal);
    return () => {
      window.removeEventListener('open-quote-modal', handleOpenModal);
    };
  }, []);

  return (
    <main className="min-h-screen">
      {/* Navbar is handled by layout.tsx */}
      
      <Hero />
      <Services />
      <Process />
      <GoogleReviews />

      {/* Footer is handled by layout.tsx */}

      <QuoteModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  );
}