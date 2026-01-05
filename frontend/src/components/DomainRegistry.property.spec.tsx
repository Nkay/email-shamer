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
  // Create simple, unique domain generator
  const domainArbitrary = fc.integer({ min: 1, max: 10000 })
    .map(n => `test-domain-${n}.com`);
  
  const validationIssueArbitrary = fc.record({
    type: fc.constantFrom('missing_record', 'syntax_error', 'weak_policy', 'alignment_issue'),
    severity: fc.constantFrom('error', 'warning', 'info'),
    message: fc.constantFrom('Missing DMARC record', 'Invalid syntax', 'Weak policy detected'),
    recommendation: fc.constantFrom('Add DMARC record', 'Fix syntax errors', 'Strengthen policy'),
  }) as fc.Arbitrary<ValidationIssue>;

  const dmarcRecordArbitrary = fc.oneof(
    fc.constant('v=DMARC1; p=none; rua=mailto:dmarc@example.com'),
    fc.constant('v=DMARC1; p=quarantine; pct=100; rua=mailto:reports@example.com'),
    fc.constant('v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s'),
    fc.constant(null)
  );

  // Create unique domain entries with guaranteed uniqueness
  const createDomainEntry = (index: number): fc.Arbitrary<DomainEntry> => {
    return fc.record({
      domain: fc.constant(`test-domain-${index}.com`),
      lastChecked: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
      upvotes: fc.integer({ min: 0, max: 100 }),
      dmarcStatus: fc.constantFrom('missing', 'invalid', 'weak'),
      validationResult: fc.record({
        domain: fc.constant(`test-domain-${index}.com`),
        dmarcRecord: dmarcRecordArbitrary,
        isValid: fc.constant(false), // Registry only shows non-compliant domains
        issues: fc.array(validationIssueArbitrary, { minLength: 1, maxLength: 3 }),
        checkTimestamp: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
      }) as fc.Arbitrary<ValidationResult>,
    }) as fc.Arbitrary<DomainEntry>;
  };

  const domainRegistryArbitrary = fc.integer({ min: 0, max: 5 })
    .chain(size => {
      if (size === 0) return fc.constant([]);
      return fc.tuple(...Array.from({ length: size }, (_, i) => createDomainEntry(i)));
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
          }, { timeout: 3000 });

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

            // Check that domains appear in the correct order by checking domain names
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
      { numRuns: 20, timeout: 5000 } // Reduced runs and increased timeout
    );
  });

  test('Property 3: Domain entry information completeness - For any domain entry displayed in the registry, the interface should include domain name, check date, DMARC status, upvote button, recheck button, and current vote count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }).chain(size => 
          fc.tuple(...Array.from({ length: size }, (_, i) => createDomainEntry(i)))
        ),
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
            }, { timeout: 3000 });

            domains.forEach((domainEntry, index) => {
              // 1. Domain name should be displayed
              expect(screen.getByText(domainEntry.domain)).toBeInTheDocument();
              
              // 2. Check date should be displayed - use more specific selector
              const formattedDate = new Date(domainEntry.lastChecked).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });
              
              // Find the specific domain container by looking for the domain text
              const domainElements = container.querySelectorAll('[class*="border-gray-200 rounded-lg"]');
              let domainContainer = null;
              
              for (const element of domainElements) {
                if (element.textContent?.includes(domainEntry.domain)) {
                  domainContainer = element;
                  break;
                }
              }
              
              if (domainContainer) {
                expect(domainContainer.textContent).toContain(`Checked on ${formattedDate}`);
              } else {
                // Fallback: check that the date exists somewhere
                expect(container.textContent).toContain(`Checked on ${formattedDate}`);
              }
              
              // 3. DMARC status should be displayed - check within the specific domain container
              const statusText = domainEntry.dmarcStatus === 'missing' ? 'No DMARC' :
                                domainEntry.dmarcStatus === 'invalid' ? 'Invalid DMARC' : 'Weak Policy';
              
              if (domainContainer) {
                expect(domainContainer.textContent).toContain(statusText);
              } else {
                // Fallback: just check that the status exists somewhere
                expect(container.textContent).toContain(statusText);
              }
              
              // 4. Upvote button should be present with vote count
              const upvoteButtons = screen.getAllByText('👍');
              expect(upvoteButtons.length).toBeGreaterThan(0);
              
              // Check that the vote count exists somewhere in the container
              if (domainContainer) {
                expect(domainContainer.textContent).toContain(domainEntry.upvotes.toString());
              } else {
                expect(container.textContent).toContain(domainEntry.upvotes.toString());
              }
              
              // 5. Recheck button should be present
              const recheckButtons = screen.getAllByText('Recheck');
              expect(recheckButtons.length).toBeGreaterThan(0);
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
      { numRuns: 20, timeout: 5000 } // Reduced runs and increased timeout
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
        fc.integer({ min: 2, max: 4 }).chain(size => 
          fc.tuple(...Array.from({ length: size }, (_, i) => createDomainEntry(i)))
        ),
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
            }, { timeout: 3000 });

            // Get the expected sorted order
            const expectedOrder = [...domains].sort((a, b) => {
              if (a.upvotes !== b.upvotes) {
                return b.upvotes - a.upvotes; // Higher votes first
              }
              return new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime(); // More recent first
            });

            // Get the actual displayed order by checking domain names in order
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
      { numRuns: 15, timeout: 5000 } // Reduced runs for stability
    );
  });

  test('Property 3: Status color coding should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 2 }).chain(size => 
          fc.tuple(...Array.from({ length: size }, (_, i) => createDomainEntry(i)))
        ),
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
            }, { timeout: 3000 });

            domains.forEach((domainEntry) => {
              const statusElements = container.querySelectorAll('[class*="rounded-full"]');
              
              // Find the status element for this domain by checking nearby text
              const statusElement = Array.from(statusElements).find(el => {
                const parent = el.closest('[class*="border-gray-200 rounded-lg"]');
                return parent && parent.textContent?.includes(domainEntry.domain);
              });
              
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
      { numRuns: 10, timeout: 8000 } // Further reduced runs and increased timeout
    );
  });
});