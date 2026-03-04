# Clear View LLC: System Design & Business Logic

This document serves as the "Source of Truth" for the Clear View LLC service management platform. It outlines the architecture, data models, and business processes.

---

## 1. System Overview
Clear View LLC is a service-based application designed to automate window cleaning, gutter maintenance, and pressure washing business operations. It provides a customer-facing booking engine, an employee portal for field operations, and an admin dashboard for business management.

### Tech Stack
- **Frontend:** Next.js 15 (App Router), Tailwind CSS, Lucide Icons.
- **Backend/DB:** Firebase (Firestore, Auth, Functions).
- **Integrations:** Stripe (Payments), Firebase Mail Extension (Automated Emails).

---

## 2. User Personas & Flows

### A. Customer Flow (Public)
1.  **Landing Page:** Hero section with "Instant Quote" CTA.
2.  **Quote Discovery:** Visual service selection to help customers identify their needs (e.g., window count, home size, driveway size).
3.  **Booking Engine (`QuoteModal`):**
    *   **Step 1 (Contact):** Gather name, address, and home details.
    *   **Step 2 (Service):** Select services with real-time price calculation based on `BASE_PRICES`.
    *   **Step 3 (Calendar):** Choose available slots. The system calculates duration (`totalMinutes`) and restricts availability based on existing "Confirmed" leads.
    *   **Step 4 (Review):** Confirm details and final price.
4.  **Completion:** 
    *   New record created in `leads` collection.
    *   Confirmation email triggered via `mail` collection (Firebase Extension).

### B. Employee Flow (Staff Portal)
1.  **Login:** Role-based redirection from `/login` to `/employee`.
2.  **Clock-in/Out:** Employees track daily attendance. Data is stored per employee in their `attendance` sub-collection.
3.  **Schedule:** Employees view assigned jobs for the day, including customer addresses and job notes.
4.  **Customer Info:** Access to `leads` data to review service history and specific job requirements before starting work.

### C. Admin Flow (Management)
1.  **Dashboard:** High-level overview of revenue, active crew status, and upcoming job volume.
2.  **Staff Management:** Admin can onboard employees, set roles (`admin` vs `employee`), and review performance.
3.  **Payroll & Reports:** Automatically calculates hours from attendance logs and generates revenue reports.
4.  **Manual Booking:** Allows the business owner to manually enter leads (phone-ins) into the system.

---

## 3. Database Schema (Firestore)

### `leads` (Collection)
*The primary document for every job/inquiry.*
- **Fields:** 
    - `firstName`, `lastName`, `email`, `phone`: Customer contact info.
    - `address`, `city`: Job location.
    - `homeSize`, `stories`, `windowCount`: Property details used for pricing.
    - `selectedServices`: Array of services (e.g., ["Window Cleaning", "Gutter Cleaning"]).
    - `total`: Final quoted price.
    - `status`: "New", "Confirmed", "In Progress", "Completed", "Cancelled".
    - `actualBookedDays`: Array of Timestamps for multi-day jobs.
    - `totalMinutes`: Calculated labor time.

### `employees` (Collection)
*Employee profiles and access control.*
- **ID:** Email address (lowercase).
- **Fields:** `name`, `role` ("admin" | "employee"), `status` ("clocked_in" | "clocked_out").
- **Sub-collection `attendance`:**
    - `startTime` (Timestamp), `endTime` (Timestamp), `date` (String), `totalHours` (Number).

### `mail` (Collection)
*Triggers for the Firebase Trigger Email extension.*
- **Fields:** `to` (Array), `template` (Object with `name` and `data`).

---

## 4. Business Logic Key Rules

### Pricing Engine (`BASE_PRICES`)
- **Minimum Service Fee:** $175 (Ensures profitability on small jobs).
- **Travel Surcharge:** $80 (Applied to Yakima, Selah, Sunnyside, etc.).
- **Ladder Fees:** Added for 2-story ($50) or 3-story ($75) jobs.
- **Bundle Discounts:**
    - 2 services: 10% off.
    - 3+ services: 20% off.

### Scheduling Logic
- **Work Day:** System assumes a 7.5-hour (450 mins) standard work day per crew.
- **Modes:**
    - **Standard:** Single slot job.
    - **Split:** Job requiring multiple sessions.
    - **All Day Block:** Large jobs (Enterprise) that lock out the calendar until complete.
- **Duration Calculation:** 
    - e.g., Window Cleaning: 5-9 mins per window + setup time.
    - e.g., Gutter Cleaning: Base time based on house size + addon time for flushing/polishing.

---

## 5. Testing Strategy
The project maintains a rigorous testing suite focused on verifying business logic and UI integrity.

### Infrastructure
- **Framework:** Vitest
- **Environment:** JSDOM
- **Libraries:** React Testing Library

### Coverage Areas
1.  **Utilities (`src/lib/scheduleUtils.test.ts`):** Tests for pricing, time estimation, and calendar occupancy logic.
2.  **Booking Workflow (`src/components/QuoteModal/*.test.tsx`):** Verification of form validation, service selection, and scheduling mode transitions (Single/Split/Block).
3.  **Operations (`src/components/schedule/JobCard.test.tsx`):** Security and functionality of the on-site job management interface for crew.

---

## 6. Deployment & Maintenance
- **Hosting:** Vercel (Next.js) + Firebase (Backend).
- **Security:** Firestore Security Rules ensure employees can only see relevant data and admins have full access.
