'use client';

import { useState } from 'react';
import { DomainSubmissionForm, ValidationResult } from '../components/DomainSubmissionForm';
import { ValidationResultDisplay } from '../components/ValidationResultDisplay';
import { DomainRegistry, DomainEntry } from '../components/DomainRegistry';
import { DomainDetails } from '../components/DomainDetails';

export default function Home() {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'check' | 'registry'>('check');

  const handleDomainSubmit = async (domain: string): Promise<ValidationResult> => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call to backend
      const response = await fetch(`/api/domains/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
      });

      if (!response.ok) {
        throw new Error(`Failed to validate domain: ${response.statusText}`);
      }

      const result: ValidationResult = await response.json();
      setValidationResult(result);
      return result;
    } catch (error) {
      // For now, return a mock result for demonstration
      const mockResult: ValidationResult = {
        domain,
        dmarcRecord: null,
        isValid: false,
        issues: [
          {
            type: 'missing_record',
            severity: 'error',
            message: 'No DMARC record found for this domain',
            recommendation: 'Add a DMARC record to your DNS settings to enable email authentication'
          }
        ],
        checkTimestamp: new Date(),
      };
      setValidationResult(mockResult);
      return mockResult;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDomainClick = (domain: string) => {
    // For now, we'll need to fetch the domain details
    // In a real implementation, this would come from the registry API
    const mockDomainEntry: DomainEntry = {
      domain,
      lastChecked: new Date(),
      upvotes: 0,
      dmarcStatus: 'missing',
      validationResult: {
        domain,
        dmarcRecord: null,
        isValid: false,
        issues: [
          {
            type: 'missing_record',
            severity: 'error',
            message: 'No DMARC record found for this domain',
            recommendation: 'Add a DMARC record to your DNS settings to enable email authentication'
          }
        ],
        checkTimestamp: new Date(),
      }
    };
    setSelectedDomain(mockDomainEntry);
  };

  const handleUpvote = async (domain: string) => {
    try {
      const response = await fetch(`/api/domains/${domain}/upvote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to upvote domain: ${response.statusText}`);
      }

      // The response should contain the updated vote count
      const result = await response.json();
      console.log(`Upvoted ${domain}, new vote count: ${result.upvotes}`);
    } catch (error) {
      console.error('Error upvoting domain:', error);
      // For development, we'll just log the action
      console.log(`Mock upvote for ${domain}`);
    }
  };

  const handleRecheck = async (domain: string): Promise<ValidationResult> => {
    try {
      const response = await fetch(`/api/domains/${domain}/recheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to recheck domain: ${response.statusText}`);
      }

      const result: ValidationResult = await response.json();
      return result;
    } catch (error) {
      console.error('Error rechecking domain:', error);
      // For development, return a mock result
      return {
        domain,
        dmarcRecord: null,
        isValid: false,
        issues: [
          {
            type: 'missing_record',
            severity: 'error',
            message: 'No DMARC record found for this domain',
            recommendation: 'Add a DMARC record to your DNS settings to enable email authentication'
          }
        ],
        checkTimestamp: new Date(),
      };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
          Check Your Domain's
          <span className="text-primary-600"> DMARC Configuration</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Validate your domain's DMARC record and improve email security. 
          Get detailed analysis and recommendations for better email authentication.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-12 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 justify-center">
          <button
            onClick={() => setActiveTab('check')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'check'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Check Domain
          </button>
          <button
            onClick={() => setActiveTab('registry')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'registry'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Domain Registry
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'check' ? (
          <>
            <DomainSubmissionForm 
              onSubmit={handleDomainSubmit}
              isLoading={isLoading}
            />

            {validationResult && (
              <ValidationResultDisplay result={validationResult} />
            )}
          </>
        ) : (
          <DomainRegistry
            onDomainClick={handleDomainClick}
            onUpvote={handleUpvote}
            onRecheck={handleRecheck}
          />
        )}
      </div>

      {/* Domain Details Modal */}
      {selectedDomain && (
        <DomainDetails
          domainEntry={selectedDomain}
          onClose={() => setSelectedDomain(null)}
          onUpvote={handleUpvote}
          onRecheck={handleRecheck}
        />
      )}

      <div className="mt-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Why DMARC Matters
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            DMARC helps protect your domain from email spoofing and phishing attacks
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-900">Email Security</h3>
            <p className="mt-2 text-gray-500">
              Prevent unauthorized use of your domain in email attacks
            </p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-900">Brand Protection</h3>
            <p className="mt-2 text-gray-500">
              Protect your brand reputation from email-based fraud
            </p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-medium text-gray-900">Deliverability</h3>
            <p className="mt-2 text-gray-500">
              Improve email deliverability with proper authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}