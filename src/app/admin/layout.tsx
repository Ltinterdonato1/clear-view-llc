'use client';
import AdminNavbar from '../../components/AdminNavbar';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show the sidebar on the Login page
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) return <>{children}</>;

  return (
    <div className="flex bg-white min-h-screen overflow-x-hidden">
      <AdminNavbar />
      {/* 
          Mobile: pt-24 to clear the 24h fixed mobile bar. 
          Desktop: ml-80 to clear the 80w fixed sidebar.
      */}
      <main className="flex-1 lg:ml-80 pt-24 lg:pt-0 min-h-screen w-full overflow-x-hidden">
        <div className="max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}