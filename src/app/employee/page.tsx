import { redirect } from 'next/navigation';

export default function EmployeeRoot() {
  // Redirect employees to the Clock In/Out page by default
  redirect('/employee/ClockinandOut');
}