import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { ValidationResult, ValidationIssue } from './DomainSubmissionForm';
import { DomainEntry } from './DomainRegistry';

interface DomainDetailsProps {
  domainEntry: DomainEntry;
  onClose: () => void;
  onUpvote?: (domain: string) => Promise<void>;
  onRecheck?: (domain: string) => Promise<ValidationResult>;
}

export const DomainDetails: React.FC<DomainDetailsProps> = ({
  domainEntry,
  onClose,
  onUpvote,
  onRecheck,
}) => {
  const [isVoting, setIsVoting] = React.useState(false);
  const [isRechecking, setIsRechecking] = React.useState(false);

  const handleUpvote = async () => {
    if (!onUpvote || isVoting) return;
    
    try {
      setIsVoting(true);
      await onUpvote(domainEntry.domain);
    } catch (err) {
      console.error('Error upvoting domain:', err);
    } finally {
      setIsVoting(false);
    }
  };

  const handleRecheck = async () => {
    if (!onRecheck || isRechecking) return;
    
    try {
      setIsRechecking(true);
      await onRecheck(domainEntry.domain);
    } catch (err) {
      console.error('Error rechecking domain:', err);
    } finally {
      setIsRechecking(false);
    }
  };

  const getSeverityColor = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="shadow-xl border-0">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{domainEntry.domain}</CardTitle>
                <p className="text-gray-500 mt-1">
                  Last checked: {formatDate(domainEntry.lastChecked)}
                </p>
              </div>
              <Button onClick={onClose} variant="outline" size="sm">
                ✕ Close
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Action Buttons */}
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleUpvote}
                variant="outline"
                disabled={isVoting}
                className="flex items-center space-x-2"
              >
                <span>👍</span>
                <span>{isVoting ? 'Voting...' : `Upvote (${domainEntry.upvotes})`}</span>
              </Button>
              
              <Button
                onClick={handleRecheck}
                variant="primary"
                disabled={isRechecking}
              >
                {isRechecking ? 'Rechecking...' : 'Recheck Domain'}
              </Button>
            </div>

            {/* DMARC Record Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Current DMARC Record</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                {domainEntry.validationResult.dmarcRecord ? (
                  <code className="text-sm font-mono text-gray-800">
                    {domainEntry.validationResult.dmarcRecord}
                  </code>
                ) : (
                  <p className="text-gray-500 italic">No DMARC record found</p>
                )}
              </div>
            </div>

            {/* Validation Issues */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Validation Issues ({domainEntry.validationResult.issues.length})
              </h3>
              
              {domainEntry.validationResult.issues.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-600">✅ No issues found - DMARC configuration looks good!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {domainEntry.validationResult.issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-lg">{getSeverityIcon(issue.severity)}</span>
                        <div className="flex-1">
                          <h4 className="font-medium capitalize">
                            {issue.type.replace('_', ' ')} ({issue.severity})
                          </h4>
                          <p className="mt-1">{issue.message}</p>
                          {issue.recommendation && (
                            <div className="mt-2 p-3 bg-white bg-opacity-50 rounded border">
                              <p className="text-sm">
                                <strong>Recommendation:</strong> {issue.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">About DMARC</h4>
              <p className="text-blue-800 text-sm">
                DMARC (Domain-based Message Authentication, Reporting, and Conformance) helps protect 
                your domain from email spoofing and phishing attacks. A properly configured DMARC record 
                tells email receivers how to handle messages that fail authentication checks.
              </p>
            </div>

            {/* Voting Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Community Voting</h4>
              <p className="text-gray-600 text-sm">
                This domain has received <strong>{domainEntry.upvotes}</strong> votes from the community. 
                Voting helps prioritize which domains need attention for DMARC configuration improvements.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};