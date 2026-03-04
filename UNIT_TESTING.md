# Project Unit Testing Documentation

This document outlines the unit test coverage for the Clear View LLC application, focusing on business logic, pricing calculations, and scheduling constraints.

---

### 1. Pricing & Estimations (`scheduleUtils.ts`)
**Logic:** Ensures accurate quote generation and enforcement of business rules.

*   **Business Use Case:** Ensure the business maintains a profitable minimum for any service call.
    *   **Test Case:** `should respect minimum charge`
    *   **Input:** 1 Window, Exterior cleaning only (calculated value ~$8.00).
    *   **Verification:** Total is forced to **$175.00** (Minimum Service Fee).

*   **Business Use Case:** Reward customers for booking multiple services (Bundling).
    *   **Test Case:** `should calculate multiple services and apply discount`
    *   **Input:** Selected Services: Windows, Gutters, and Pressure Washing.
    *   **Verification:** A **20% Bundle Discount** is applied to the subtotal and displayed as savings.

*   **Business Use Case:** Calculate accurate labor time for scheduling.
    *   **Test Case:** `calculateJobStats`
    *   **Input:** 20 windows, Interior/Exterior (`both`).
    *   **Verification:** Time display returns `3h 30m` (based on 9 mins/window + 30m setup).

---

### 3. Service Selection Logic (`ServiceStep.tsx`)
**Logic:** Manages the inclusion of services and their specific add-ons in the customer quote.

*   **Business Use Case:** Allow customers to build a custom service package.
    *   **Test Case:** `calls setFormData when a service is toggled`
    *   **Input:** User clicks the "Window Cleaning" card.
    *   **Verification:** `formData.selectedServices` is updated to include/exclude the service, triggering a price recalculation.

*   **Business Use Case:** Surface relevant up-sell options only when applicable.
    *   **Test Case:** `shows extra options when a service is selected`
    *   **Input:** "Window Cleaning" is selected.
    *   **Verification:** Add-on options like "Screen Cleaning" become visible and interactive.

---

### 4. Scheduling & Booking Modes (`CalendarStep.tsx`)
**Logic:** Automatically adjusts booking requirements based on the estimated scope of work.

*   **Business Use Case:** Small jobs should be completed in a single visit.
    *   **Test Case:** `renders single day mode by default for short jobs`
    *   **Input:** `totalMinutes`: 120 (2 hours).
    *   **Verification:** The interface defaults to **Single Day** mode; multi-day options are optional/disabled.

*   **Business Use Case:** Large jobs (>9 hours) cannot be done in one day and must be split.
    *   **Test Case:** `forces split mode for jobs > 9 hours`
    *   **Input:** `totalMinutes`: 600 (10 hours).
    *   **Verification:** `formData.mode` is automatically set to **split**; user is prompted to select two separate dates.

*   **Business Use Case:** Massive "Enterprise" jobs (>18 hours) require consecutive block-out dates.
    *   **Test Case:** `forces all day block mode for jobs > 18 hours`
    *   **Input:** `totalMinutes`: 1200 (20 hours).
    *   **Verification:** `formData.mode` is set to **allDayBlock**; the system calculates the number of consecutive days required (e.g., 3 days).

---

### 3. Contact & Service Area Logic (`ContactStep.tsx`)
**Logic:** Validates customer data and handles regional travel fees.

*   **Business Use Case:** Charge for travel when customers are outside the local service bubble.
    *   **Test Case:** `shows travel surcharge notice for premium cities`
    *   **Input:** City: "Yakima".
    *   **Verification:** An **$80.00 Travel Surcharge** alert is displayed, and the "Next" button remains disabled until the user acknowledges or fulfills other requirements.

*   **Business Use Case:** Ensure clean data for SMS/Phone communications.
    *   **Test Case:** `formats phone number correctly`
    *   **Input:** Raw string `5095551212`.
    *   **Verification:** Input value is automatically formatted to `(509) 555-1212`.

*   **Business Use Case:** Prevent incomplete leads from entering the system.
    *   **Test Case:** `disables next button when form is invalid`
    *   **Input:** Empty address or invalid email format (missing `@`).
    *   **Verification:** The "Services" button is `disabled` and visually grayed out.

---

### 4. Employee Management & Job Security (`JobCard.tsx`)
**Logic:** Controls what field crew can see and edit on-site.

*   **Business Use Case:** Prevent accidental on-site edits without authorization.
    *   **Test Case:** `calls toggleLock when lock button is clicked`
    *   **Input:** User clicks "Unlock Control".
    *   **Verification:** The system triggers the **Pin Authorization** prompt before expanding the edit section.

*   **Business Use Case:** Crew should only see jobs assigned to them to avoid confusion.
    *   **Test Case:** `should filter by worker email if not admin`
    *   **Input:** List of 10 jobs; User Email: `worker1@example.com`.
    *   **Verification:** Only jobs where `assignedTo == worker1@example.com` are returned in the filtered list.

*   **Business Use Case:** Allow on-site adjustments to window counts or services.
    *   **Test Case:** `calls updateJob when a field in authority section is changed`
    *   **Input:** Changing `windowCount` from 15 to 20 while "Unlocked".
    *   **Verification:** `updateJob` function is called with the new data, triggering a recalculation of the final total.

---

### 5. Occupancy Analytics (`scheduleUtils.ts`)
**Logic:** Provides the Admin with a high-level view of daily capacity.

*   **Business Use Case:** Identify "Danger Zones" where jobs are booked but not yet assigned to a crew.
    *   **Test Case:** `should show all jobs for admin email`
    *   **Input:** Job A (Assigned), Job B (Unassigned).
    *   **Verification:** Returns an object `{ count: 2, unassigned: 1 }`, allowing the Admin UI to highlight the day in **Orange** (Alert).
