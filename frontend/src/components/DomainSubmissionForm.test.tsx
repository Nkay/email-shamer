import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DomainSubmissionForm, ValidationResult } from './DomainSubmissionForm';

describe('DomainSubmissionForm', () => {
  const mockValidationResult: ValidationResult = {
    domain: 'example.com',
    dmarcRecord: 'v=DMARC1; p=reject;',
    isValid: true,
    issues: [],
    checkTimestamp: new Date(),
  };

  const mockOnSubmit = jest.fn().mockResolvedValue(mockValidationResult);

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  test('renders form with domain input and submit button', () => {
    render(<DomainSubmissionForm onSubmit={mockOnSubmit} />);
    
    expect(screen.getByLabelText(/domain name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check dmarc configuration/i })).toBeInTheDocument();
  });

  test('validates domain format and shows error for invalid domain', async () => {
    const user = userEvent.setup();
    render(<DomainSubmissionForm onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/domain name/i);
    const button = screen.getByRole('button', { name: /check dmarc configuration/i });
    
    await user.type(input, 'invalid-domain');
    await user.click(button);
    
    expect(screen.getByText(/please enter a valid domain name/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows error for empty domain', async () => {
    const user = userEvent.setup();
    render(<DomainSubmissionForm onSubmit={mockOnSubmit} />);
    
    const button = screen.getByRole('button', { name: /check dmarc configuration/i });
    await user.click(button);
    
    expect(screen.getByText(/please enter a domain name/i)).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('submits valid domain and clears form on success', async () => {
    const user = userEvent.setup();
    render(<DomainSubmissionForm onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/domain name/i);
    const button = screen.getByRole('button', { name: /check dmarc configuration/i });
    
    await user.type(input, 'example.com');
    await user.click(button);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith('example.com');
    });
    
    expect(input).toHaveValue('');
  });

  test('shows loading state when isLoading is true', () => {
    render(<DomainSubmissionForm onSubmit={mockOnSubmit} isLoading={true} />);
    
    const button = screen.getByRole('button', { name: /checking/i });
    expect(button).toBeDisabled();
    expect(screen.getByDisplayValue('')).toBeDisabled();
  });

  test('handles submission error and shows error message', async () => {
    const user = userEvent.setup();
    const mockOnSubmitError = jest.fn().mockRejectedValue(new Error('Network error'));
    
    render(<DomainSubmissionForm onSubmit={mockOnSubmitError} />);
    
    const input = screen.getByLabelText(/domain name/i);
    const button = screen.getByRole('button', { name: /check dmarc configuration/i });
    
    await user.type(input, 'example.com');
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('clears error when user starts typing', async () => {
    const user = userEvent.setup();
    render(<DomainSubmissionForm onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/domain name/i);
    const button = screen.getByRole('button', { name: /check dmarc configuration/i });
    
    // First trigger an error
    await user.click(button);
    expect(screen.getByText(/please enter a domain name/i)).toBeInTheDocument();
    
    // Then start typing to clear the error
    await user.type(input, 'e');
    expect(screen.queryByText(/please enter a domain name/i)).not.toBeInTheDocument();
  });
});