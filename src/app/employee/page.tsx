import { redirect } from 'next/navigation';

export default function EmployeeRoot() {
  // This tells the browser: "If someone lands on /employee, 
  // immediately send them to the dashboard."
  redirect('/employee/dashboard');
}