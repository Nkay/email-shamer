import React from 'react';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { ValidationResultDisplay } from './ValidationResultDisplay';
import { ValidationResult, ValidationIssue } from './DomainSubmissionForm';

// Feature: dmarc-portal, Property 11: Issue explanation completeness
// **Validates: Requirements 1.3**

describe('ValidationResultDisplay Property Tests', () => {
  // Generators for property-based testing
  const domainArbitrary = fc.domain();
  
  const validationIssueArbitrary = fc.record({
    type: fc.constantFrom('missing_record', 'syntax_error', 'weak_policy', 'alignment_issue'),
    severity: fc.constantFrom('error', 'warning', 'info'),
    message: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length >= 5),
    recommendation: fc.string({ minLength: 5, maxLength: 300 }).filter(s => s.trim().length >= 5),
  }) as fc.Arbitrary<ValidationIssue>;

  // Create more realistic DMARC record generator
  const dmarcRecordArbitrary = fc.oneof(
    fc.constant('v=DMARC1; p=none; rua=mailto:dmarc@example.com'),
    fc.constant('v=DMARC1; p=quarantine; pct=100; rua=mailto:reports@example.com'),
    fc.constant('v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s'),
    fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10 && !s.includes('\n'))
  );

  const validationResultArbitrary = fc.record({
    domain: domainArbitrary,
    dmarcRecord: fc.option(dmarcRecordArbitrary, { nil: null }),
    isValid: fc.boolean(),
    issues: fc.array(validationIssueArbitrary, { minLength: 0, maxLength: 10 }),
    checkTimestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
  }) as fc.Arbitrary<ValidationResult>;

  test('Property 11: Issue explanation completeness - For any domain with DMARC issues, the system should display both the current DMARC record (or indicate if missing) and provide specific explanations of the identified problems', () => {
    fc.assert(
      fc.property(validationResultArbitrary, (result) => {
        const { container, unmount } = render(<ValidationResultDisplay result={result} />);
        
        try {
          // Check that domain name is displayed (use getAllByText since domain appears multiple times)
          const domainElements = screen.getAllByText(result.domain);
          expect(domainElements.length).toBeGreaterThan(0);
          
          // Check that DMARC record section exists
          expect(screen.getByText('Current DMARC Record')).toBeInTheDocument();
          
          // Check DMARC record display
          if (result.dmarcRecord) {
            // Should display the actual record - use flexible matching for whitespace normalization
            const codeElement = container.querySelector('code');
            expect(codeElement).toBeInTheDocument();
            expect(codeElement?.textContent).toBeTruthy();
            // Check that the essential content is there (ignoring whitespace normalization)
            const normalizedRecord = result.dmarcRecord.replace(/\s+/g, ' ').trim();
            const normalizedContent = codeElement?.textContent?.replace(/\s+/g, ' ').trim();
            expect(normalizedContent).toBe(normalizedRecord);
          } else {
            // Should indicate missing record
            expect(screen.getByText(/No DMARC record found/i)).toBeInTheDocument();
          }
          
          // Check that all issues are displayed with explanations
          if (result.issues.length > 0) {
            // Should have validation issues section
            expect(screen.getByText(/Validation Issues/i)).toBeInTheDocument();
            
            // Each issue should have its message and recommendation displayed
            result.issues.forEach((issue) => {
              // Use more flexible text matching for issue messages
              const messageElements = container.querySelectorAll('*');
              const messageFound = Array.from(messageElements).some(el => 
                el.textContent && el.textContent.includes(issue.message.trim())
              );
              expect(messageFound).toBe(true);
              
              if (issue.recommendation && issue.recommendation.trim()) {
                const recElements = container.querySelectorAll('*');
                const recFound = Array.from(recElements).some(el => 
                  el.textContent && el.textContent.includes(issue.recommendation.trim())
                );
                expect(recFound).toBe(true);
              }
            });
            
            // Should display issue count
            expect(screen.getByText(`Validation Issues (${result.issues.length})`)).toBeInTheDocument();
          }
          
          // Check status badge is present
          if (result.isValid) {
            expect(screen.getByText(/DMARC Compliant/i)).toBeInTheDocument();
          } else {
            expect(screen.getByText(/DMARC Issues Found/i)).toBeInTheDocument();
          }
          
          // Check timestamp is displayed - use a more flexible matcher for dates
          const timestampText = screen.getByText(/Checked:/);
          expect(timestampText).toBeInTheDocument();
          
          // Verify the formatted date appears somewhere in the document
          const formattedDate = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(result.checkTimestamp);
          
          // Use a more flexible approach to find the date
          const dateElements = container.querySelectorAll('*');
          const dateFound = Array.from(dateElements).some(el => 
            el.textContent && el.textContent.includes(formattedDate)
          );
          expect(dateFound).toBe(true);
          
          // Verify that each issue has proper severity indication
          result.issues.forEach((issue) => {
            // Check that severity icons are present (by checking for SVG elements)
            const issueElements = container.querySelectorAll(`[class*="${issue.severity === 'error' ? 'text-red-500' : issue.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'}"]`);
            expect(issueElements.length).toBeGreaterThan(0);
          });
          
          return true;
        } finally {
          // Clean up after each test iteration
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 11 Edge Case: Missing DMARC record should be clearly indicated', () => {
    fc.assert(
      fc.property(
        fc.record({
          domain: domainArbitrary,
          dmarcRecord: fc.constant(null),
          isValid: fc.constant(false),
          issues: fc.array(validationIssueArbitrary, { minLength: 1, maxLength: 5 }),
          checkTimestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        }) as fc.Arbitrary<ValidationResult>,
        (result) => {
          const { unmount } = render(<ValidationResultDisplay result={result} />);
          
          try {
            // Should clearly indicate missing DMARC record
            expect(screen.getByText(/No DMARC record found/i)).toBeInTheDocument();
            
            // Should not display any actual record content
            const codeElements = screen.queryAllByRole('code');
            expect(codeElements.length).toBe(0);
            
            return true;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('Property 11 Edge Case: Valid domain with no issues should show success message', () => {
    fc.assert(
      fc.property(
        fc.record({
          domain: domainArbitrary,
          dmarcRecord: dmarcRecordArbitrary,
          isValid: fc.constant(true),
          issues: fc.constant([]),
          checkTimestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
        }) as fc.Arbitrary<ValidationResult>,
        (result) => {
          const { container, unmount } = render(<ValidationResultDisplay result={result} />);
          
          try {
            // Should show success message
            expect(screen.getByText(/Excellent! Your domain has a properly configured DMARC record/i)).toBeInTheDocument();
            
            // Should show compliant badge
            expect(screen.getByText(/DMARC Compliant/i)).toBeInTheDocument();
            
            // Should display the DMARC record - use a more flexible approach
            const codeElement = container.querySelector('code');
            expect(codeElement).toBeInTheDocument();
            expect(codeElement?.textContent?.trim()).toBe(result.dmarcRecord!.trim());
            
            // Should not show validation issues section
            expect(screen.queryByText(/Validation Issues/i)).not.toBeInTheDocument();
            
            return true;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});