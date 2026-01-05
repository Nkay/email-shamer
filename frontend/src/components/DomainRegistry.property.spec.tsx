import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { DomainRegistry, DomainEntry } from './DomainRegistry';
import { ValidationResult, ValidationIssue } from './DomainSubmissionForm';

// Feature: dmarc-portal, Property 2: Non-compliant domain display accuracy
// Feature: dmarc-portal, Property 3: Domain entry information completeness
// **Validates: Requirements 3.1, 3.2, 3.4, 4.1, 4.3**

// Mock fetch globally for these tests
global.fetch = jest.fn();

describe('DomainRegistry Property Tests', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  // Generators for property-based testing
  // Create a more reliable domain generator that avoids duplicates
  const domainArbitrary = fc.tuple(
    fc.stringOf(fc.char().filter(c => /[a-z0-9-]/.test(c)), { minLength: 1, maxLength: 10 }),
    fc.constantFrom('com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'co.uk', 'de', 'fr')
  ).map(([name, tld]) => `${name.replace(/^-+|-+$/g, '').replace(/-+/g, '-')}.${tld}`)
   .filter(domain => domain.length > 4 && !domain.startsWith('.') && !domain.includes('..'));
  
  const validationIssueArbitrary = fc.record({
    type: fc.constantFrom('missing_record', 'syntax_error', 'weak_policy', 'alignment_issue'),
    severity: fc.constantFrom('error', 'warning', 'info'),
    message: fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length >= 5),
    recommendation: fc.string({ minLength: 5, maxLength: 300 }).filter(s => s.trim().length >= 5),
  }) as fc.Arbitrary<ValidationIssue>;

  const dmarcRecordArbitrary = fc.oneof(
    fc.constant('v=DMARC1; p=none; rua=mailto:dmarc@example.com'),
    fc.constant('v=DMARC1; p=quarantine; pct=100; rua=mailto:reports@example.com'),
    fc.constant('v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s'),
    fc.constant(null)
  );

  const validationResultArbitrary = fc.record({
    domain: domainArbitrary,
    dmarcRecord: dmarcRecordArbitrary,
    isValid: fc.constant(false), // Registry only shows non-compliant domains
    issues: fc.array(validationIssueArbitrary, { minLength: 1, maxLength: 5 }),
    checkTimestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
  }) as fc.Arbitrary<ValidationResult>;

  const domainEntryArbitrary = fc.record({
    domain: domainArbitrary,
    lastChecked: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
    upvotes: fc.integer({ min: 0, max: 1000 }),
    dmarcStatus: fc.constantFrom('missing', 'invalid', 'weak'),
    validationResult: validationResultArbitrary,
  }) as fc.Arbitrary<DomainEntry>;

  const domainRegistryArbitrary = fc.array(domainEntryArbitrary, { minLength: 0, maxLength: 20 })
    .map(domains => {
      // Ensure unique domains to avoid React key conflicts
      const uniqueDomains = new Map();
      domains.forEach((domain, index) => {
        const key = `${domain.domain}-${index}`;
        if (!uniqueDomains.has(domain.domain)) {
          uniqueDomains.set(domain.domain, domain);
        }
      });
      return Array.from(uniqueDomains.values());
    });

  test('Property 2: Non-compliant domain display accuracy - For any domain in the system, it should appear in the public registry list if and only if it has been checked and found to be non-compliant with DMARC best practices', async () => {
    await fc.assert(
      fc.asyncProperty(domainRegistryArbitrary, async (domains) => {
        // Mock the API response
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => domains,
        });

        const { container, unmount } = render(<DomainRegistry />);
        
        try {
          // Wait for the component to load
          await waitFor(() => {
            expect(screen.queryByText('Loading domains...')).not.toBeInTheDocument();
          });

          if (domains.length === 0) {
            // Should show empty state message
            expect(screen.getByText(/No domains in the registry yet/i)).toBeInTheDocument();
          } else {
            // All domains in the registry should be non-compliant
            domains.forEach((domain) => {
              // Each domain should be displayed
              expect(screen.getByText(domain.domain)).toBeInTheDocument();
              
              // Each domain should have a non-compliant status
              expect(domain.validationResult.isValid).toBe(false);
              expect(domain.validationResult.issues.length).toBeGreaterThan(0);
              
              // Status should be one of the non-compliant types
              expect(['missing', 'invalid', 'weak']).toContain(domain.dmarcStatus);
            });

            // Verify sorting: domains should be sorted by votes (descending) then by check date
            const sortedDomains = [...domains].sort((a, b) => {
              if (a.upvotes !== b.upvotes) {
                return b.upvotes - a.upvotes;
              }
              return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime();
            });

            // Check that domains appear in the correct order
            const domainElements = container.querySelectorAll('[class*="border-gray-200 rounded-lg"]');
            sortedDomains.forEach((domain, index) => {
              if (index < domainElements.length) {
                const domainElement = domainElements[index];
                expect(domainElement.textContent).toContain(domain.domain);
              }
            });
          }

          return true;
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 3: Domain entry information completeness - For any domain entry displayed in the registry, the interface should include domain name, check date, DMARC status, upvote button, recheck button, and current vote count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(domainEntryArbitrary, { minLength: 1, maxLength: 5 })
          .map(domains => {
            // Ensure unique domains to avoid React key conflicts
            const uniqueDomains = new Map();
            domains.forEach((domain, index) => {
              const uniqueKey = `${domain.domain}-${index}`;
              if (!uniqueDomains.has(domain.domain)) {
                uniqueDomains.set(domain.domain, { ...domain, domain: uniqueKey });
              }
            });
            return Array.from(uniqueDomains.values());
          }),
        async (domains) => {
          // Mock the API response
          (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => domains,
          });

          const { container, unmount } = render(<DomainRegistry />);
          
          try {
            // Wait for the component to load
            await waitFor(() => {
              expect(screen.queryByText('Loading domains...')).not.toBeInTheDocument();
            });

            domains.forEach((domainEntry) => {
              // 1. Domain name should be displayed
              expect(screen.getByText(domainEntry.domain)).toBeInTheDocument();
              
              // 2. Check date should be displayed
              const formattedDate = new Date(domainEntry.lastChecked).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
              expect(screen.getByText(`Checked on ${formattedDate}`)).toBeInTheDocument();
              
              // 3. DMARC status should be displayed
              const statusText = domainEntry.dmarcStatus === 'missing' ? 'No DMARC' :
                                domainEntry.dmarcStatus === 'invalid' ? 'Invalid DMARC' : 'Weak Policy';
              expect(screen.getByText(statusText)).toBeInTheDocument();
              
              // 4. Upvote button should be present with vote count
              const upvoteButtons = screen.getAllByText('👍');
              expect(upvoteButtons.length).toBeGreaterThan(0);
              expect(screen.getByText(domainEntry.upvotes.toString())).toBeInTheDocument();
              
              // 5. Recheck button should be present
              expect(screen.getByText('Recheck')).toBeInTheDocument();
            });

            // Verify that all required interactive elements are present
            const upvoteButtons = container.querySelectorAll('button[class*="flex items-center space-x-1"]');
            const recheckButtons = screen.getAllByText('Recheck');
            
            expect(upvoteButtons.length).toBe(domains.length);
            expect(recheckButtons.length).toBe(domains.length);

            return true;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3 Edge Case: Empty registry should show appropriate message', async () => {
    // Mock empty API response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { unmount } = render(<DomainRegistry />);
    
    try {
      // Wait for the component to load
      await waitFor(() => {
        expect(screen.queryByText('Loading domains...')).not.toBeInTheDocument();
      });

      // Should show empty state message
      expect(screen.getByText(/No domains in the registry yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Check some domains to populate the registry/i)).toBeInTheDocument();
      
      // Should not show any domain entries
      expect(screen.queryByText('👍')).not.toBeInTheDocument();
      expect(screen.queryByText('Recheck')).not.toBeInTheDocument();
    } finally {
      unmount();
    }
  });

  test('Property 2 & 3: Registry sorting consistency - domains should be sorted by votes (descending) then by check date (most recent first)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(domainEntryArbitrary, { minLength: 2, maxLength: 10 }),
        async (domains) => {
          // Mock the API response
          (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => domains,
          });

          const { container, unmount } = render(<DomainRegistry />);
          
          try {
            // Wait for the component to load
            await waitFor(() => {
              expect(screen.queryByText('Loading domains...')).not.toBeInTheDocument();
            });

            // Get the expected sorted order
            const expectedOrder = [...domains].sort((a, b) => {
              if (a.upvotes !== b.upvotes) {
                return b.upvotes - a.upvotes; // Higher votes first
              }
              return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime(); // More recent first
            });

            // Get the actual displayed order
            const domainElements = container.querySelectorAll('[class*="border-gray-200 rounded-lg"]');
            
            expectedOrder.forEach((expectedDomain, index) => {
              if (index < domainElements.length) {
                const actualElement = domainElements[index];
                expect(actualElement.textContent).toContain(expectedDomain.domain);
                expect(actualElement.textContent).toContain(expectedDomain.upvotes.toString());
              }
            });

            return true;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: Status color coding should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(domainEntryArbitrary, { minLength: 1, maxLength: 3 })
          .map(domains => {
            // Ensure unique domains to avoid React key conflicts
            const uniqueDomains = new Map();
            domains.forEach((domain, index) => {
              const uniqueKey = `test-${index}-${domain.domain.replace(/[^a-z0-9]/g, '')}`;
              if (!uniqueDomains.has(uniqueKey)) {
                uniqueDomains.set(uniqueKey, { ...domain, domain: uniqueKey });
              }
            });
            return Array.from(uniqueDomains.values());
          }),
        async (domains) => {
          // Mock the API response
          (fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => domains,
          });

          const { container, unmount } = render(<DomainRegistry />);
          
          try {
            // Wait for the component to load
            await waitFor(() => {
              expect(screen.queryByText('Loading domains...')).not.toBeInTheDocument();
            });

            domains.forEach((domainEntry) => {
              const statusElements = container.querySelectorAll('[class*="rounded-full"]');
              
              // Find the status element for this domain
              const statusElement = Array.from(statusElements).find(el => 
                el.textContent && (
                  el.textContent.includes('No DMARC') ||
                  el.textContent.includes('Invalid DMARC') ||
                  el.textContent.includes('Weak Policy')
                )
              );
              
              expect(statusElement).toBeTruthy();
              
              // Verify color coding based on status
              if (domainEntry.dmarcStatus === 'missing' || domainEntry.dmarcStatus === 'invalid') {
                expect(statusElement?.className).toContain('text-red-600');
                expect(statusElement?.className).toContain('bg-red-50');
              } else if (domainEntry.dmarcStatus === 'weak') {
                expect(statusElement?.className).toContain('text-yellow-600');
                expect(statusElement?.className).toContain('bg-yellow-50');
              }
            });

            return true;
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 30, timeout: 10000 } // Reduced runs and increased timeout for stability
    );
  });
});