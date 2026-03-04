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

export const metadata: Metadata = {
  title: "CLEAR VIEW LLC | Tri-Cities Window Cleaning",
  description: "Professional window and gutter cleaning services in the Tri-Cities, WA area. Advanced pure-water technology for a crystal clear view.",
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