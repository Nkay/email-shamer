import React from 'react';
import { ValidationResult, ValidationIssue } from './DomainSubmissionForm';

interface ValidationResultDisplayProps {
  result: ValidationResult;
}

const SeverityIcon: React.FC<{ severity: ValidationIssue['severity'] }> = ({ severity }) => {
  switch (severity) {
    case 'error':
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'info':
      return (
        <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      );
  }
};

const StatusBadge: React.FC<{ isValid: boolean }> = ({ isValid }) => {
  if (isValid) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        DMARC Compliant
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      DMARC Issues Found
    </span>
  );
};

const IssueCard: React.FC<{ issue: ValidationIssue }> = ({ issue }) => {
  const severityColors = {
    error: 'border-red-200 bg-red-50',
    warning: 'border-yellow-200 bg-yellow-50',
    info: 'border-blue-200 bg-blue-50',
  };

  return (
    <div className={`border rounded-lg p-4 ${severityColors[issue.severity]}`}>
      <div className="flex items-start space-x-3">
        <SeverityIcon severity={issue.severity} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 capitalize">
            {issue.type.replace('_', ' ')} - {issue.severity}
          </h4>
          <p className="mt-1 text-sm text-gray-700">{issue.message}</p>
          {issue.recommendation && (
            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Recommendation
              </p>
              <p className="mt-1 text-sm text-gray-700">{issue.recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ValidationResultDisplay: React.FC<ValidationResultDisplayProps> = ({ result }) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="card">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                DMARC Validation Results
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Domain: <span className="font-medium text-gray-900">{result.domain}</span>
              </p>
              <p className="text-sm text-gray-500">
                Checked: {formatDate(result.checkTimestamp)}
              </p>
            </div>
            <StatusBadge isValid={result.isValid} />
          </div>
        </div>

        {/* DMARC Record Section */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Current DMARC Record</h3>
          {result.dmarcRecord ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <code className="text-sm text-gray-800 break-all">
                {result.dmarcRecord}
              </code>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-red-800">
                  No DMARC record found for this domain
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Issues Section */}
        {result.issues.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Validation Issues ({result.issues.length})
            </h3>
            <div className="space-y-4">
              {result.issues.map((issue, index) => (
                <IssueCard key={index} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* Success Message */}
        {result.isValid && result.issues.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">
                  Excellent! Your domain has a properly configured DMARC record.
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Your email authentication is set up correctly and helps protect against email spoofing.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};