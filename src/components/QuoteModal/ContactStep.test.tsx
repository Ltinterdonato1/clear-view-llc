import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ContactStep from './ContactStep';
import React from 'react';

const mockFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  otherCity: '',
  branch: '',
};

const mockSetFormData = vi.fn();
const mockOnNext = vi.fn();

describe('ContactStep', () => {
  it('renders correctly', () => {
    render(<ContactStep formData={mockFormData} setFormData={mockSetFormData} onNext={mockOnNext} />);
    expect(screen.getByPlaceholderText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
  });

  it('formats phone number correctly', () => {
    render(<ContactStep formData={mockFormData} setFormData={mockSetFormData} onNext={mockOnNext} />);
    const phoneInput = screen.getByPlaceholderText(/Phone Number/i);
    
    fireEvent.change(phoneInput, { target: { value: '5095551212' } });
    
    expect(mockSetFormData).toHaveBeenCalledWith(expect.objectContaining({
      phone: '(509) 555-1212'
    }));
  });

  it('shows other city input when "Other WA" is selected', () => {
    const formDataWithOther = {
      ...mockFormData,
      branch: 'Tri-Cities',
      city: 'Other'
    };
    render(<ContactStep formData={formDataWithOther} setFormData={mockSetFormData} onNext={mockOnNext} />);
    expect(screen.getByPlaceholderText(/Enter WA City Name/i)).toBeInTheDocument();
  });

  it('disables next button when form is invalid', () => {
    render(<ContactStep formData={mockFormData} setFormData={mockSetFormData} onNext={mockOnNext} />);
    const nextButton = screen.getByRole('button', { name: /Services/i });
    expect(nextButton).toBeDisabled();
  });

  it('enables next button when form is valid', () => {
    const validFormData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '(509) 555-1212',
      address: '123 Main St',
      city: 'Kennewick',
      branch: 'Tri-Cities'
    };
    render(<ContactStep formData={validFormData} setFormData={mockSetFormData} onNext={mockOnNext} />);
    const nextButton = screen.getByRole('button', { name: /Services/i });
    expect(nextButton).not.toBeDisabled();
    
    fireEvent.click(nextButton);
    expect(mockOnNext).toHaveBeenCalled();
  });
});
