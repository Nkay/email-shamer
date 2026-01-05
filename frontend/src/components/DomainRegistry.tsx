import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { ValidationResult, ValidationIssue } from './DomainSubmissionForm';

export interface DomainEntry {
  domain: string;
  lastChecked: Date;
  upvotes: number;
  dmarcStatus: 'missing' | 'invalid' | 'weak';
  validationResult: ValidationResult;
}

interface DomainRegistryProps {
  onDomainClick?: (domain: string) => void;
  onUpvote?: (domain: string) => Promise<void>;
  onRecheck?: (domain: string) => Promise<ValidationResult>;
}

export const DomainRegistry: React.FC<DomainRegistryProps> = ({
  onDomainClick,
  onUpvote,
  onRecheck,
}) => {
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recheckingDomain, setRecheckingDomain] = useState<string | null>(null);
  const [votingDomain, setVotingDomain] = useState<string | null>(null);

  // Fetch domains from the registry API
  const fetchDomains = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/domains/registry');
      if (!response.ok) {
        throw new Error(`Failed to fetch domains: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Sort domains by votes (descending) and then by check date (most recent first)
      const sortedDomains = data.sort((a: DomainEntry, b: DomainEntry) => {
        if (a.upvotes !== b.upvotes) {
          return b.upvotes - a.upvotes; // Higher votes first
        }
        // If votes are equal, sort by check date (most recent first)
        return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime();
      });
      
      setDomains(sortedDomains);
    } catch (err) {
      console.error('Error fetching domains:', err);
      setError(err instanceof Error ? err.message : 'Failed to load domain registry');
      
      // For development, use mock data if API fails
      const mockDomains: DomainEntry[] = [
        {
          domain: 'example.com',
          lastChecked: new Date('2024-01-15'),
          upvotes: 5,
          dmarcStatus: 'missing',
          validationResult: {
            domain: 'example.com',
            dmarcRecord: null,
            isValid: false,
            issues: [
              {
                type: 'missing_record',
                severity: 'error',
                message: 'No DMARC record found',
                recommendation: 'Add a DMARC record to your DNS settings'
              }
            ],
            checkTimestamp: new Date('2024-01-15'),
          }
        },
        {
          domain: 'test.org',
          lastChecked: new Date('2024-01-14'),
          upvotes: 3,
          dmarcStatus: 'weak',
          validationResult: {
            domain: 'test.org',
            dmarcRecord: 'v=DMARC1; p=none;',
            isValid: false,
            issues: [
              {
                type: 'weak_policy',
                severity: 'warning',
                message: 'DMARC policy is set to "none"',
                recommendation: 'Consider upgrading to "quarantine" or "reject" policy'
              }
            ],
            checkTimestamp: new Date('2024-01-14'),
          }
        }
      ];
      setDomains(mockDomains);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const handleUpvote = async (domain: string) => {
    if (!onUpvote || votingDomain) return;
    
    try {
      setVotingDomain(domain);
      await onUpvote(domain);
      
      // Update local state to reflect the upvote
      setDomains(prevDomains => 
        prevDomains.map(d => 
          d.domain === domain 
            ? { ...d, upvotes: d.upvotes + 1 }
            : d
        ).sort((a, b) => {
          if (a.upvotes !== b.upvotes) {
            return b.upvotes - a.upvotes;
          }
          return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime();
        })
      );
    } catch (err) {
      console.error('Error upvoting domain:', err);
      // Could show a toast notification here
    } finally {
      setVotingDomain(null);
    }
  };

  const handleRecheck = async (domain: string) => {
    if (!onRecheck || recheckingDomain) return;
    
    try {
      setRecheckingDomain(domain);
      const result = await onRecheck(domain);
      
      // If domain is now compliant, remove it from the registry
      if (result.isValid) {
        setDomains(prevDomains => prevDomains.filter(d => d.domain !== domain));
      } else {
        // Update the domain entry with new results
        setDomains(prevDomains => 
          prevDomains.map(d => 
            d.domain === domain 
              ? {
                  ...d,
                  lastChecked: result.checkTimestamp,
                  validationResult: result,
                  dmarcStatus: getDmarcStatus(result)
                }
              : d
          )
        );
      }
    } catch (err) {
      console.error('Error rechecking domain:', err);
      // Could show a toast notification here
    } finally {
      setRecheckingDomain(null);
    }
  };

  const handleDomainClick = (domain: string) => {
    if (onDomainClick) {
      onDomainClick(domain);
    }
  };

  const getDmarcStatus = (result: ValidationResult): 'missing' | 'invalid' | 'weak' => {
    if (!result.dmarcRecord) return 'missing';
    
    const hasWeakPolicy = result.issues.some(issue => 
      issue.type === 'weak_policy' && issue.severity === 'warning'
    );
    
    if (hasWeakPolicy) return 'weak';
    return 'invalid';
  };

  const getStatusColor = (status: 'missing' | 'invalid' | 'weak') => {
    switch (status) {
      case 'missing':
        return 'text-red-600 bg-red-50';
      case 'invalid':
        return 'text-red-600 bg-red-50';
      case 'weak':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: 'missing' | 'invalid' | 'weak') => {
    switch (status) {
      case 'missing':
        return 'No DMARC';
      case 'invalid':
        return 'Invalid DMARC';
      case 'weak':
        return 'Weak Policy';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading domains...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && domains.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Domain Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDomains} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domain Registry</CardTitle>
        <p className="text-gray-500 mt-1">
          Domains with DMARC configuration issues, sorted by community votes
        </p>
      </CardHeader>
      <CardContent>
        {domains.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No domains in the registry yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Check some domains to populate the registry!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domainEntry) => (
              <div
                key={domainEntry.domain}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleDomainClick(domainEntry.domain)}
                        className="text-lg font-medium text-primary-600 hover:text-primary-700 cursor-pointer"
                      >
                        {domainEntry.domain}
                      </button>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          domainEntry.dmarcStatus
                        )}`}
                      >
                        {getStatusText(domainEntry.dmarcStatus)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      Checked on {formatDate(domainEntry.lastChecked)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1">
                      <Button
                        onClick={() => handleUpvote(domainEntry.domain)}
                        variant="outline"
                        size="sm"
                        disabled={votingDomain === domainEntry.domain}
                        className="flex items-center space-x-1"
                      >
                        <span>👍</span>
                        <span>{domainEntry.upvotes}</span>
                      </Button>
                    </div>
                    
                    <Button
                      onClick={() => handleRecheck(domainEntry.domain)}
                      variant="outline"
                      size="sm"
                      disabled={recheckingDomain === domainEntry.domain}
                    >
                      {recheckingDomain === domainEntry.domain ? 'Checking...' : 'Recheck'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};