'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManageStaffRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/payroll');
  }, [router]);
  return null;
}
