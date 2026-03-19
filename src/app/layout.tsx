// Deployment Ping: 2026-03-16-v2
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "../components/layout/ClientLayout";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Array of work truck images
const workTruckImages = [
  '/img/worktruck1.png',
  '/img/worktruck2.jpg',
  '/img/worktruck4.jpg',
  '/img/worktruckcityrain.jpg',
  '/img/worktruckfall.jpg'
];

// Get current month (0-11)
const currentMonth = new Date().getMonth();

// Select an image based on the current month
const selectedImage = workTruckImages[currentMonth % workTruckImages.length];

export const metadata: Metadata = {
  title: "Clear View LLC",
  description: "Professional window and gutter cleaning services. Advanced pure-water technology for a crystal clear view.",
  openGraph: {
    title: "Clear View LLC",
    description: "Professional window and gutter cleaning services.",
    images: [
      {
        url: selectedImage,
        width: 1200,
        height: 630,
        alt: "Clear View LLC Work Truck",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* All the "Interactive" stuff happens inside here now */}
        <ClientLayout>{children}</ClientLayout>
        <Script src="https://js.helcim.com/v1/helcim.js" strategy="lazyOnload" />
      </body>
    </html> 
  );
}
