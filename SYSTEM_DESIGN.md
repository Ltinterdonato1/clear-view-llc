# Clear View LLC: System Design & Business Logic

This document serves as the "Source of Truth" for the Clear View LLC service management platform. It outlines the architecture, data models, and business processes.

---

## 1. System Overview
Clear View LLC is a service-based application designed to automate window cleaning, gutter maintenance, and pressure washing business operations. It provides a customer-facing booking engine, an employee portal for field operations, and an admin dashboard for business management.

### Tech Stack
- **Frontend:** Next.js 15 (App Router), Tailwind CSS, Lucide Icons.
- **Backend/DB:** Firebase (Firestore, Auth, Functions v2).
- **Integrations:** Stripe (Payments via internal API), Firebase Mail Extension (Automated Emails).

---

## 2. User Personas & Flows

### A. Customer Flow (Public)
1.  **Landing Page:** Hero section with "Instant Quote" CTA. Includes verified reviews for all 4 primary locations (Tri-Cities, Walla Walla, Tacoma, Puyallup).
2.  **Quote Discovery:** Visual service selection to help customers identify their needs (e.g., window count, home size, driveway size).
3.  **Booking Engine (`QuoteModal`):**
    *   **Step 1 (Contact):** Gather name, address, and home details.
    *   **Step 2 (Service):** Select services with real-time price calculation based on `BASE_PRICES`.
    *   **Step 3 (Calendar):** Choose available slots. The system calculates duration (`totalMinutes`) and restricts availability based on existing "Confirmed" leads.
    *   **Step 4 (Review):** Confirm details and final price.
4.  **Completion:** 
    *   New record created in `leads` collection.
    *   Confirmation email triggered via **Double-Write Strategy**: writes direct HTML to `mail` collection AND template data to `leads`.

### B. Employee Flow (Staff Portal)
1.  **Login:** Role-based redirection from `/login` to `/employee`.
2.  **Clock-in/Out:** Employees track daily attendance. Data is stored per employee in their `attendance` sub-collection.
3.  **Schedule:** Employees view assigned jobs for the day, including customer addresses and job notes.
4.  **Customer Info:** Access to `leads` data to review service history and specific job requirements before starting work.

### C. Admin Flow (Management)
1.  **Dashboard:** High-level overview of revenue, active crew status, and upcoming job volume.
2.  **Staff Management:** Admin can onboard employees, set roles (`admin` vs `employee`), force clock-out staff, and review performance.
3.  **Payroll & Reports:** Automatically calculates hours from attendance logs and generates revenue reports.
4.  **Manual Booking:** Allows the business owner to manually enter leads (phone-ins) into the system with automatic email confirmations.
5.  **Job Management (`JobCard`):** 
    *   **Resend Confirmation:** Manually triggers a professional confirmation email.
    *   **Email Invoice:** Generates a real-time Stripe checkout link and emails it to the customer.
    *   **Complete Job:** Processes final payment method (Card, Cash, Check) and sends a "Paid in Full" receipt.

---

## 3. Database Schema (Firestore)

### `leads` (Collection)
*The primary document for every job/inquiry.*
- **Fields:** 
    - `firstName`, `lastName`, `email`, `phone`: Customer contact info.
    - `address`, `city`: Job location.
    - `homeSize`, `stories`, `windowCount`: Property details used for pricing.
    - `selectedServices`: Array of services.
    - `total`: Final quoted price.
    - `status`: "New", "Confirmed", "In Progress", "Completed", "Archived".
    - `isNotification`: (Boolean) If true, document is used for email triggering and hidden from calendar/board.
    - `template`: (Object) Contains `name` and `data` for the Email Extension.

### `employees` (Collection)
*Employee profiles and access control.*
- **ID:** Email address (lowercase).
- **Sub-collection `attendance`:** Tracks `startTime`, `endTime`, and `totalHours`.

### `mail` (Collection)
*Triggers for the Firebase Trigger Email extension.*
- **Trigger Logic:** Uses Direct HTML writes for guaranteed delivery across all browser environments.

### `email_templates` (Collection)
*Storage for professional email designs (Confirmation, Invoice, Receipt).*

---

## 4. Business Logic Key Rules

### Pricing Engine (`BASE_PRICES`)
- **Minimum Service Fee:** $175.
- **Bundle Discounts:** 10% for 2 services, 20% for 3+ services.
- **Multi-Day Logic:** Jobs exceeding 540 minutes are automatically split across multiple calendar days.

### Email Delivery (Stability Rules)
- **Double-Write Strategy:** To ensure 100% delivery, the system writes to both the `mail` and `leads` collections.
- **Sanitization:** All Firestore writes pass through a `sanitize` helper to remove `undefined` fields and prevent data crashes.
- **Notification Filtering:** Background triggers are filtered out of the Dispatch Board using `isNotification` checks in `scheduleUtils.ts`.

### Payment Integration (Stripe)
- **Session Generation:** Uses internal API route `/api/stripe/create-checkout-session` for immediate link generation, bypassing Firestore permission delays.

---

## 5. Testing Strategy
The project maintains a rigorous testing suite focused on verifying business logic and UI integrity.
- **Utilities:** Pricing, time estimation, and calendar occupancy.
- **Workflow:** Step transitions and validation in the booking engine.
- **Security:** Verification of lock/unlock mechanisms and tech assignments.

---

## 6. Deployment & Maintenance
- **GitHub:** Source control for all frontend and Cloud Function logic.
- **Vercel:** Preferred hosting for Next.js 15 and Node.js API support.
- **Security:** Multi-layer security via Firestore Rules, Auth Custom Claims, and environment variables.
