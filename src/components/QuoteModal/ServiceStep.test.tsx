import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ServiceStep from './ServiceStep';
import React from 'react';

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
  CheckCircle2: () => <span>CheckCircle2</span>,
  ChevronRight: () => <span>ChevronRight</span>,
  Layout: () => <span>Layout</span>,
  Waves: () => <span>Waves</span>,
  Droplets: () => <span>Droplets</span>,
  PlusCircle: () => <span>PlusCircle</span>,
  Check: () => <span>Check</span>,
  ChevronLeft: () => <span>ChevronLeft</span>,
}));

const mockStats = {
  total: '175.00',
  lineItems: [],
  discounts: [],
  timeDisplay: '1h 30m'
};

const mockFormData = {
  selectedServices: [],
  stories: 1,
  homeSize: '1-2',
  windowCount: 15,
  deluxeWindow: false,
  gutterFlush: false,
  deluxeGutter: false,
  drivewaySize: '1-2',
  backPatio: false
};

const mockSetFormData = vi.fn();
const mockSetWindowType = vi.fn();
const mockOnNext = vi.fn();
const mockOnBack = vi.fn();

describe('ServiceStep', () => {
  it('renders correctly', () => {
    render(
      <ServiceStep
        formData={mockFormData}
        setFormData={mockSetFormData}
        windowType="exterior"
        setWindowType={mockSetWindowType}
        stats={mockStats}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Window Cleaning/i)).toBeInTheDocument();
    expect(screen.getByText(/Gutter Cleaning/i)).toBeInTheDocument();
    expect(screen.getByText(/Pressure Washing/i)).toBeInTheDocument();
  });

  it('calls setFormData when a service is toggled', () => {
    render(
      <ServiceStep
        formData={mockFormData}
        setFormData={mockSetFormData}
        windowType="exterior"
        setWindowType={mockSetWindowType}
        stats={mockStats}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    const windowService = screen.getByText(/Window Cleaning/i);
    fireEvent.click(windowService);
    expect(mockSetFormData).toHaveBeenCalled();
  });

  it('shows extra options when a service is selected', () => {
    const formDataWithWindow = {
      ...mockFormData,
      selectedServices: ['Window Cleaning']
    };
    render(
      <ServiceStep
        formData={formDataWithWindow}
        setFormData={mockSetFormData}
        windowType="exterior"
        setWindowType={mockSetWindowType}
        stats={mockStats}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    expect(screen.getByText(/Screen Cleaning/i)).toBeInTheDocument();
  });

  it('calls onNext when Select Date is clicked', () => {
    const formDataWithWindow = {
      ...mockFormData,
      selectedServices: ['Window Cleaning']
    };
    render(
      <ServiceStep
        formData={formDataWithWindow}
        setFormData={mockSetFormData}
        windowType="exterior"
        setWindowType={mockSetWindowType}
        stats={mockStats}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    );
    const nextButton = screen.getByText(/Select Date/i);
    fireEvent.click(nextButton);
    expect(mockOnNext).toHaveBeenCalled();
  });
});
