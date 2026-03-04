import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalendarStep from './CalendarStep';
import React from 'react';

// Mock Firebase
vi.mock('../../lib/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ forEach: vi.fn() })),
  query: vi.fn(),
  where: vi.fn(),
}));

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  Clock: () => <span>Clock</span>,
  Check: () => <span>Check</span>,
  Split: () => <span>Split</span>,
  ArrowRight: () => <span>ArrowRight</span>,
  ChevronLeft: () => <span>ChevronLeft</span>,
  Calendar: () => <span>CalendarIcon</span>,
  Blocks: () => <span>Blocks</span>,
}));

// Mock DayPicker to avoid complex UI testing
vi.mock('react-day-picker', () => ({
  DayPicker: ({ onSelect }: any) => (
    <div data-testid="day-picker">
      <button onClick={() => onSelect(new Date(2026, 1, 20))}>Select Date</button>
    </div>
  ),
}));

const mockStats = {
  total: '200.00',
  lineItems: [],
  discounts: [],
  travelFee: 0,
  totalMinutes: 120, // 2 hours
  timeDisplay: '2h 0m',
  isBlockRequired: false,
  isEnterpriseJob: false,
  daysRequired: 1,
  serviceJobs: [{ name: 'Window Cleaning', time: 120 }]
};

const mockFormData = {
  firstName: '', lastName: '', email: '', phone: '', address: '', city: '',
  homeSize: '1-2', stories: 1, windowCount: 15,
  selectedServices: ['Window Cleaning'],
  deluxeWindow: false, deluxeGutter: false, gutterFlush: false, backPatio: false,
  drivewaySize: '1-2',
  selectedDate: null,
  endDate: null,
  timeSlot: null,
  endSlot: null,
  day1SelectedSlotStartTimeMinutes: null,
  day1SelectedJobEndTimeMinutes: null,
  day2SelectedSlotStartTimeMinutes: null,
  day2SelectedJobEndTimeMinutes: null,
  isAllDayBlockMode: false,
  mode: 'single',
  memo: '',
};

describe('CalendarStep', () => {
  let setFormData: any;

  beforeEach(() => {
    setFormData = vi.fn();
  });

  it('renders single day mode by default for short jobs', () => {
    render(
      <CalendarStep
        formData={mockFormData}
        setFormData={setFormData}
        stats={mockStats}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(/Single Day/i)).toBeInTheDocument();
  });

  it('forces split mode for jobs > 9 hours', async () => {
    const heavyStats = {
      ...mockStats,
      totalMinutes: 600, // 10 hours
      serviceJobs: [
        { name: 'Window Cleaning', time: 300 },
        { name: 'Gutter Cleaning', time: 300 }
      ]
    };

    render(
      <CalendarStep
        formData={mockFormData}
        setFormData={setFormData}
        stats={heavyStats}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(setFormData).toHaveBeenCalledWith(expect.any(Function));
      // The functional update should eventually set mode to 'split'
      const updateFn = setFormData.mock.calls[0][0];
      const newState = updateFn(mockFormData);
      expect(newState.mode).toBe('split');
    });
  });

  it('forces all day block mode for jobs > 18 hours', async () => {
    const enterpriseStats = {
      ...mockStats,
      totalMinutes: 1200, // 20 hours
      serviceJobs: [
        { name: 'Window Cleaning', time: 600 },
        { name: 'Pressure Washing', time: 600 }
      ]
    };

    render(
      <CalendarStep
        formData={mockFormData}
        setFormData={setFormData}
        stats={enterpriseStats}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(setFormData).toHaveBeenCalledWith(expect.any(Function));
      const updateFn = setFormData.mock.calls[0][0];
      const newState = updateFn(mockFormData);
      expect(newState.mode).toBe('allDayBlock');
    });
  });

  it('allows selecting a time slot', () => {
    render(
      <CalendarStep
        formData={mockFormData}
        setFormData={setFormData}
        stats={mockStats}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );
    
    const morningSlot = screen.getByText(/8:00 AM Start/i);
    fireEvent.click(morningSlot);
    
    expect(setFormData).toHaveBeenCalled();
  });
});
