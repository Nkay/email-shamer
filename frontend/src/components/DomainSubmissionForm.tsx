import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

export interface ValidationResult {
  domain: string;
  dmarcRecord: string | null;
  isValid: boolean;
  issues: ValidationIssue[];
  checkTimestamp: Date;
}

export interface ValidationIssue {
  type: 'missing_record' | 'syntax_error' | 'weak_policy' | 'alignment_issue';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

interface DomainSubmissionFormProps {
  onSubmit: (domain: string) => Promise<ValidationResult>;
  isLoading?: boolean;
}

export const DomainSubmissionForm: React.FC<DomainSubmissionFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');

  const validateDomainFormat = (domain: string): boolean => {
    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedDomain = domain.trim().toLowerCase();

    // Validate domain format
    if (!trimmedDomain) {
      setError('Please enter a domain name');
      return;
    }

    if (!validateDomainFormat(trimmedDomain)) {
      setError('Please enter a valid domain name (e.g., example.com)');
      return;
    }

    try {
      await onSubmit(trimmedDomain);
      // Clear form on successful submission
      setDomain('');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while checking the domain. Please try again.');
      }
    }
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomain(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label="Domain Name"
              type="text"
              value={domain}
              onChange={handleDomainChange}
              placeholder="example.com"
              error={error}
              helperText="Enter a domain name to check its DMARC configuration"
              disabled={isLoading}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isLoading || !domain.trim()}
          >
            {isLoading ? 'Checking...' : 'Check DMARC Configuration'}
          </Button>
        </form>
      </div>
    </div>
  );
};