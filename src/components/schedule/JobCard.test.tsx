import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobCard from './JobCard';
import React from 'react';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ forEach: vi.fn() })),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((d) => d),
    now: vi.fn(() => new Date()),
  }
}));

vi.mock('../../lib/firebase', () => ({
  db: {}
}));

describe('JobCard Component', () => {
  const mockJob = {
    id: 'test-123',
    firstName: 'John',
    lastName: 'Doe',
    address: '123 Main St',
    city: 'Seattle',
    phone: '206-555-0123',
    status: 'Scheduled',
    selectedServices: ['Window Cleaning', 'Gutter Cleaning'],
    windowCount: 20,
    windowType: 'both',
    homeSize: '3-4',
    stories: 2,
    total: '517.12',
    timeSlot: 'morning',
    actualBookedDays: [new Date()],
    memo: 'Watch out for the dog'
  };

  const mockProps = {
    job: mockJob,
    isAdmin: true,
    allEmployees: [{ id: 'emp1', name: 'Tech One' }],
    unlockedJobs: new Set<string>(),
    setCompletingJob: vi.fn(),
    currentDayTime: new Date().setHours(0,0,0,0)
  };

  it('renders basic job information', () => {
    render(<JobCard {...mockProps} />);
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    // Calculated: 20 windows (both: 20*14=280) + 3-4 Bed Gutters (225) + 2 Stories (50, added to windows). Total Base: 555. 
    // Discount (Window + Gutter = 10%): 55.50. Before Tax: 499.50. Tax (assumed 8.7% on taxable portion of 225): 17.62. Final Total: 517.12
    expect(screen.getByText(/517.12/i)).toBeInTheDocument();
  });

  it('expands when clicked to show details', () => {
    render(<JobCard {...mockProps} />);
    const header = screen.getByText(/John Doe/i);
    fireEvent.click(header);
    
    expect(screen.getByText(/123 Main St/i)).toBeInTheDocument();
    expect(screen.getByText(/Watch out for the dog/i)).toBeInTheDocument();
  });

  it('shows "Unlock to Edit" button when expanded', () => {
    render(<JobCard {...mockProps} />);
    fireEvent.click(screen.getByText(/John Doe/i));
    expect(screen.getByText(/Unlock to Edit/i)).toBeInTheDocument();
  });

  it('requires passcode logic trigger when toggleLock is called', () => {
    const toggleLock = vi.fn();
    render(<JobCard {...mockProps} toggleLock={toggleLock} />);
    fireEvent.click(screen.getByText(/John Doe/i));
    
    const unlockBtn = screen.getByText(/Unlock to Edit/i);
    fireEvent.click(unlockBtn);
    expect(toggleLock).toHaveBeenCalledWith(mockJob.id);
  });

  it('displays correct arrival time label', () => {
    render(<JobCard {...mockProps} />);
    // morning -> 8:00 AM
    expect(screen.getByText(/8:00 AM/i)).toBeInTheDocument();
  });
});
