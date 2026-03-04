'use client';
import AdminNavbar from '../../components/AdminNavbar';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show the sidebar on the Login page
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) return <>{children}</>;

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <AdminNavbar />
      <main className="flex-1 ml-64 p-4">
        {children}
      </main>
    </div>
  );
}