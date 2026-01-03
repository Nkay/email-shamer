import { Test, TestingModule } from '@nestjs/testing';
import { DomainRegistryService } from './domain-registry.service';
import { FirebaseService } from './firebase.service';
import { CacheService } from '../cache/cache.service';
import { ValidationResult, ValidationIssue, DomainDocument } from './models/domain.model';
import * as fc from 'fast-check';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  firestore: {
    Timestamp: {
      now: jest.fn(() => ({ toDate: () => new Date() })),
      fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    },
  },
}));

describe('DomainRegistryService', () => {
  let service: DomainRegistryService;
  let firebaseService: jest.Mocked<FirebaseService>;

  // Generators for property-based testing
  const validationIssueArb = fc.record({
    type: fc.constantFrom('missing_record', 'syntax_error', 'weak_policy', 'alignment_issue') as fc.Arbitrary<'missing_record' | 'syntax_error' | 'weak_policy' | 'alignment_issue'>,
    severity: fc.constantFrom('error', 'warning', 'info') as fc.Arbitrary<'error' | 'warning' | 'info'>,
    message: fc.string({ minLength: 1, maxLength: 100 }),
    recommendation: fc.string({ minLength: 1, maxLength: 100 }),
  }) as fc.Arbitrary<ValidationIssue>;

  const validationResultArb = fc.record({
    domain: fc.domain(),
    dmarcRecord: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    isValid: fc.boolean(),
    issues: fc.array(validationIssueArb, { maxLength: 5 }),
    checkTimestamp: fc.date(),
  }) as fc.Arbitrary<ValidationResult>;

  const domainDocumentArb = fc.record({
    domain: fc.domain(),
    dmarcRecord: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
    isValid: fc.boolean(),
    issues: fc.array(validationIssueArb, { maxLength: 5 }),
    lastChecked: fc.date().map(date => ({ toDate: () => date })),
    upvotes: fc.nat({ max: 1000 }),
    createdAt: fc.date().map(date => ({ toDate: () => date })),
    updatedAt: fc.date().map(date => ({ toDate: () => date })),
  }) as fc.Arbitrary<DomainDocument>;

  beforeEach(async () => {
    const mockFirebaseService = {
      getDomain: jest.fn(),
      createDomain: jest.fn(),
      updateDomain: jest.fn(),
      deleteDomain: jest.fn(),
      getNonCompliantDomains: jest.fn(),
      incrementUpvotes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainRegistryService,
        CacheService,
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
      ],
    }).compile();

    service = module.get<DomainRegistryService>(DomainRegistryService);
    firebaseService = module.get(FirebaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearCache();
  });

  describe('Property 8: Data persistence completeness', () => {
    // Feature: dmarc-portal, Property 8: Data persistence completeness
    // Validates: Requirements 6.5, 8.1, 8.2
    it('should store and retrieve validation results with complete data integrity', async () => {
      await fc.assert(
        fc.asyncProperty(validationResultArb, async (validationResult) => {
          // Setup: Mock Firebase service responses
          firebaseService.getDomain.mockResolvedValue(null); // Domain doesn't exist initially
          firebaseService.createDomain.mockResolvedValue(undefined);

          // Store the validation result
          await service.storeDomainResult(validationResult);

          // Verify createDomain was called with correct data
          expect(firebaseService.createDomain).toHaveBeenCalledWith(validationResult);

          // Mock the retrieval
          const mockDomainDoc: DomainDocument = {
            domain: validationResult.domain,
            dmarcRecord: validationResult.dmarcRecord,
            isValid: validationResult.isValid,
            issues: validationResult.issues,
            lastChecked: { toDate: () => validationResult.checkTimestamp } as any,
            upvotes: 0,
            createdAt: { toDate: () => new Date() } as any,
            updatedAt: { toDate: () => new Date() } as any,
          };

          firebaseService.getDomain.mockResolvedValue(mockDomainDoc);

          // Retrieve the validation result
          const retrievedResult = await service.getDomainResult(validationResult.domain);

          // Verify data completeness and integrity
          expect(retrievedResult).not.toBeNull();
          expect(retrievedResult!.domain).toBe(validationResult.domain);
          expect(retrievedResult!.dmarcRecord).toBe(validationResult.dmarcRecord);
          expect(retrievedResult!.isValid).toBe(validationResult.isValid);
          expect(retrievedResult!.issues).toEqual(validationResult.issues);
          expect(retrievedResult!.checkTimestamp).toEqual(validationResult.checkTimestamp);
        }),
        { numRuns: 100 }
      );
    });

    // Feature: dmarc-portal, Property 8: Data persistence completeness
    // Validates: Requirements 6.5, 8.1, 8.2
    it('should handle upvote counting with data consistency', async () => {
      await fc.assert(
        fc.asyncProperty(fc.domain(), fc.nat({ max: 100 }), async (domain, initialUpvotes) => {
          // Setup: Mock domain exists with initial upvotes
          const mockDomainDoc: DomainDocument = {
            domain,
            dmarcRecord: 'v=DMARC1; p=none;',
            isValid: false,
            issues: [],
            lastChecked: { toDate: () => new Date() } as any,
            upvotes: initialUpvotes,
            createdAt: { toDate: () => new Date() } as any,
            updatedAt: { toDate: () => new Date() } as any,
          };

          firebaseService.getDomain.mockResolvedValue(mockDomainDoc);
          firebaseService.incrementUpvotes.mockResolvedValue(initialUpvotes + 1);

          // Increment upvotes
          const newUpvotes = await service.incrementUpvotes(domain);

          // Verify upvote increment
          expect(newUpvotes).toBe(initialUpvotes + 1);
          expect(firebaseService.incrementUpvotes).toHaveBeenCalledWith(domain);

          // Verify cache invalidation (getDomain should be called again)
          firebaseService.getDomain.mockResolvedValue({
            ...mockDomainDoc,
            upvotes: initialUpvotes + 1,
          });

          const upvoteCount = await service.getUpvoteCount(domain);
          expect(upvoteCount).toBe(initialUpvotes + 1);
        }),
        { numRuns: 100 }
      );
    });

    // Feature: dmarc-portal, Property 8: Data persistence completeness
    // Validates: Requirements 6.5, 8.1, 8.2
    it('should maintain cache consistency with database operations', async () => {
      await fc.assert(
        fc.asyncProperty(validationResultArb, async (validationResult) => {
          // Setup: Mock Firebase service responses
          firebaseService.getDomain.mockResolvedValue(null);
          firebaseService.createDomain.mockResolvedValue(undefined);

          // Store result (should cache it)
          await service.storeDomainResult(validationResult);

          // Mock domain document for retrieval
          const mockDomainDoc: DomainDocument = {
            domain: validationResult.domain,
            dmarcRecord: validationResult.dmarcRecord,
            isValid: validationResult.isValid,
            issues: validationResult.issues,
            lastChecked: { toDate: () => validationResult.checkTimestamp } as any,
            upvotes: 0,
            createdAt: { toDate: () => new Date() } as any,
            updatedAt: { toDate: () => new Date() } as any,
          };

          // Clear previous mock calls
          firebaseService.getDomain.mockClear();
          firebaseService.getDomain.mockResolvedValue(mockDomainDoc);

          // First retrieval should hit cache (no Firebase call needed)
          const firstResult = await service.getDomainResult(validationResult.domain);
          
          // Second retrieval should also hit cache (no additional Firebase call)
          const secondResult = await service.getDomainResult(validationResult.domain);

          // Both results should be identical and complete
          expect(firstResult).toEqual(secondResult);
          expect(firstResult!.domain).toBe(validationResult.domain);
          expect(firstResult!.dmarcRecord).toBe(validationResult.dmarcRecord);
          expect(firstResult!.isValid).toBe(validationResult.isValid);
          expect(firstResult!.issues).toEqual(validationResult.issues);

          // Since both calls should hit cache, Firebase getDomain should not be called
          expect(firebaseService.getDomain).toHaveBeenCalledTimes(0);
        }),
        { numRuns: 100 }
      );
    });

    // Feature: dmarc-portal, Property 8: Data persistence completeness
    // Validates: Requirements 6.5, 8.1, 8.2
    it('should correctly filter and sort non-compliant domains', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(domainDocumentArb.map(doc => ({ ...doc, isValid: false })), { minLength: 1, maxLength: 10 }),
          async (nonCompliantDocs) => {
            // Setup: Mock Firebase service to return non-compliant domains
            firebaseService.getNonCompliantDomains.mockResolvedValue(nonCompliantDocs);

            // Get non-compliant domains list
            const domainEntries = await service.listNonCompliantDomains();

            // Verify all returned domains are non-compliant
            expect(domainEntries).toHaveLength(nonCompliantDocs.length);
            
            domainEntries.forEach((entry, index) => {
              const originalDoc = nonCompliantDocs[index];
              
              // Verify data completeness
              expect(entry.domain).toBe(originalDoc.domain);
              expect(entry.lastChecked).toEqual(originalDoc.lastChecked.toDate());
              expect(entry.upvotes).toBe(originalDoc.upvotes);
              expect(entry.dmarcStatus).toMatch(/^(missing|invalid|weak)$/);
              
              // Verify validation result completeness
              expect(entry.validationResult.domain).toBe(originalDoc.domain);
              expect(entry.validationResult.dmarcRecord).toBe(originalDoc.dmarcRecord);
              expect(entry.validationResult.isValid).toBe(originalDoc.isValid);
              expect(entry.validationResult.issues).toEqual(originalDoc.issues);
              expect(entry.validationResult.checkTimestamp).toEqual(originalDoc.lastChecked.toDate());
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should handle domain not found gracefully', async () => {
      firebaseService.getDomain.mockResolvedValue(null);

      const result = await service.getDomainResult('nonexistent.com');
      expect(result).toBeNull();
    });

    it('should update existing domain instead of creating new one', async () => {
      const existingDoc: DomainDocument = {
        domain: 'example.com',
        dmarcRecord: 'v=DMARC1; p=none;',
        isValid: false,
        issues: [],
        lastChecked: { toDate: () => new Date() } as any,
        upvotes: 5,
        createdAt: { toDate: () => new Date() } as any,
        updatedAt: { toDate: () => new Date() } as any,
      };

      firebaseService.getDomain.mockResolvedValue(existingDoc);
      firebaseService.updateDomain.mockResolvedValue(undefined);

      const validationResult: ValidationResult = {
        domain: 'example.com',
        dmarcRecord: 'v=DMARC1; p=reject;',
        isValid: true,
        issues: [],
        checkTimestamp: new Date(),
      };

      await service.storeDomainResult(validationResult);

      expect(firebaseService.updateDomain).toHaveBeenCalledWith(validationResult);
      expect(firebaseService.createDomain).not.toHaveBeenCalled();
    });

    it('should clear cache correctly', () => {
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
      expect(stats.expiredKeys).toEqual([]);
    });
  });
});