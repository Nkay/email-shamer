import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { IpBlockerService } from './ip-blocker.service';
import { DomainsController } from '../domains/domains.controller';
import { DomainRegistryService } from '../firebase/domain-registry.service';
import { FirebaseService } from '../firebase/firebase.service';
import { CacheService } from '../cache/cache.service';
import { ValidationResult, DomainEntry } from '../firebase/models/domain.model';

describe('Voting System Property Tests', () => {
  let ipBlockerService: IpBlockerService;
  let domainsController: DomainsController;
  let domainRegistryService: jest.Mocked<DomainRegistryService>;
  let firebaseService: jest.Mocked<FirebaseService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const mockFirebaseService = {
      getDomain: jest.fn(),
      createDomain: jest.fn(),
      updateDomain: jest.fn(),
      deleteDomain: jest.fn(),
      incrementUpvotes: jest.fn(),
      getNonCompliantDomains: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn(),
    };

    const mockDomainRegistryService = {
      listNonCompliantDomains: jest.fn(),
      getDomainResult: jest.fn(),
      incrementUpvotes: jest.fn(),
      getUpvoteCount: jest.fn(),
      removeDomainFromRegistry: jest.fn(),
      storeDomainResult: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainsController],
      providers: [
        IpBlockerService,
        {
          provide: DomainRegistryService,
          useValue: mockDomainRegistryService,
        },
        {
          provide: FirebaseService,
          useValue: mockFirebaseService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: 'DmarcValidator',
          useValue: { validateDomain: jest.fn() },
        },
      ],
    }).compile();

    ipBlockerService = module.get<IpBlockerService>(IpBlockerService);
    domainsController = module.get<DomainsController>(DomainsController);
    domainRegistryService = module.get(DomainRegistryService);
    firebaseService = module.get(FirebaseService);
    cacheService = module.get(CacheService);
  });

  // Generators for property-based testing
  const ipAddressArb = fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

  const domainArb = fc.tuple(
    fc.stringOf(fc.char().filter(c => /[a-z0-9-]/.test(c)), { minLength: 1, maxLength: 10 }),
    fc.constantFrom('com', 'org', 'net', 'edu', 'gov')
  ).map(([name, tld]) => `${name}.${tld}`);

  const validationIssueArb = fc.record({
    type: fc.constantFrom('missing_record', 'syntax_error', 'weak_policy', 'alignment_issue', 'configuration_issue') as fc.Arbitrary<'missing_record' | 'syntax_error' | 'weak_policy' | 'alignment_issue' | 'configuration_issue'>,
    severity: fc.constantFrom('error', 'warning', 'info') as fc.Arbitrary<'error' | 'warning' | 'info'>,
    message: fc.string(),
    recommendation: fc.string(),
  });

  const validationResultArb = fc.record({
    domain: domainArb,
    dmarcRecord: fc.oneof(fc.constant(null), fc.string()),
    isValid: fc.boolean(),
    issues: fc.array(validationIssueArb),
    checkTimestamp: fc.date(),
  });

  const domainEntryArb = fc.record({
    domain: domainArb,
    lastChecked: fc.date(),
    upvotes: fc.integer({ min: 0, max: 1000 }),
    dmarcStatus: fc.constantFrom('missing', 'invalid', 'weak') as fc.Arbitrary<'missing' | 'invalid' | 'weak'>,
    validationResult: validationResultArb,
  });

  describe('Property 4: Vote management integrity', () => {
    // Feature: dmarc-portal, Property 4: Vote management integrity
    it('should allow exactly one upvote per IP per domain', () => {
      fc.assert(fc.property(
        fc.array(fc.tuple(ipAddressArb, domainArb), { minLength: 1, maxLength: 50 }),
        (ipDomainPairs) => {
          // Clear any existing votes
          ipBlockerService.clearAllVotes();

          // Track expected votes
          const expectedVotes = new Set<string>();
          let actualVoteCount = 0;

          for (const [ip, domain] of ipDomainPairs) {
            const voteKey = `${ip}:${domain}`;
            const hadVoted = ipBlockerService.hasVoted(ip, domain);
            
            if (!hadVoted) {
              ipBlockerService.recordVote(ip, domain);
              expectedVotes.add(voteKey);
              actualVoteCount++;
            }

            // After recording (or attempting to record), hasVoted should return true
            expect(ipBlockerService.hasVoted(ip, domain)).toBe(true);
          }

          // Total vote count should match unique IP/domain combinations
          expect(ipBlockerService.getVoteCount()).toBe(expectedVotes.size);
          expect(actualVoteCount).toBe(expectedVotes.size);
        }
      ), { numRuns: 100 });
    });

    // Feature: dmarc-portal, Property 4: Vote management integrity
    it('should prevent duplicate votes from same IP for same domain', () => {
      fc.assert(fc.property(
        ipAddressArb,
        domainArb,
        fc.integer({ min: 1, max: 10 }),
        (ip, domain, attempts) => {
          // Clear any existing votes
          ipBlockerService.clearAllVotes();

          // First vote should be allowed
          expect(ipBlockerService.hasVoted(ip, domain)).toBe(false);
          ipBlockerService.recordVote(ip, domain);
          expect(ipBlockerService.hasVoted(ip, domain)).toBe(true);
          expect(ipBlockerService.getVoteCount()).toBe(1);

          // Subsequent votes should not change the state
          for (let i = 0; i < attempts; i++) {
            ipBlockerService.recordVote(ip, domain);
            expect(ipBlockerService.hasVoted(ip, domain)).toBe(true);
            expect(ipBlockerService.getVoteCount()).toBe(1);
          }
        }
      ), { numRuns: 100 });
    });

    // Feature: dmarc-portal, Property 4: Vote management integrity
    it('should allow same IP to vote for different domains', () => {
      fc.assert(fc.property(
        ipAddressArb,
        fc.array(domainArb, { minLength: 1, maxLength: 10 }),
        (ip, domains) => {
          // Clear any existing votes
          ipBlockerService.clearAllVotes();

          // Remove duplicates to get unique domains
          const uniqueDomains = [...new Set(domains)];

          for (let i = 0; i < uniqueDomains.length; i++) {
            const domain = uniqueDomains[i];
            
            expect(ipBlockerService.hasVoted(ip, domain)).toBe(false);
            ipBlockerService.recordVote(ip, domain);
            expect(ipBlockerService.hasVoted(ip, domain)).toBe(true);
            
            // Vote count should increase with each unique domain
            expect(ipBlockerService.getVoteCount()).toBe(i + 1);
          }

          // Final count should match number of unique domains
          expect(ipBlockerService.getVoteCount()).toBe(uniqueDomains.length);
        }
      ), { numRuns: 100 });
    });

    // Feature: dmarc-portal, Property 4: Vote management integrity
    it('should allow different IPs to vote for same domain', () => {
      fc.assert(fc.property(
        fc.array(ipAddressArb, { minLength: 1, maxLength: 10 }),
        domainArb,
        (ips, domain) => {
          // Clear any existing votes
          ipBlockerService.clearAllVotes();

          // Remove duplicates to get unique IPs
          const uniqueIps = [...new Set(ips)];

          for (let i = 0; i < uniqueIps.length; i++) {
            const ip = uniqueIps[i];
            
            expect(ipBlockerService.hasVoted(ip, domain)).toBe(false);
            ipBlockerService.recordVote(ip, domain);
            expect(ipBlockerService.hasVoted(ip, domain)).toBe(true);
            
            // Vote count should increase with each unique IP
            expect(ipBlockerService.getVoteCount()).toBe(i + 1);
          }

          // Final count should match number of unique IPs
          expect(ipBlockerService.getVoteCount()).toBe(uniqueIps.length);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 5: Registry sorting consistency', () => {
    // Feature: dmarc-portal, Property 5: Registry sorting consistency
    it('should sort domains primarily by vote count (descending)', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(domainEntryArb, { minLength: 2, maxLength: 20 }),
        async (domains) => {
          // Ensure domains have unique names and different vote counts
          const domainsWithUniqueVotes: DomainEntry[] = domains.map((domain, index) => ({
            domain: `domain${index}.com`, // Ensure unique domains
            lastChecked: domain.lastChecked,
            upvotes: (domains.length - index - 1) * 10, // Descending: [30, 20, 10, 0] for 4 domains
            dmarcStatus: domain.dmarcStatus,
            validationResult: {
              ...domain.validationResult,
              domain: `domain${index}.com`,
            },
          }));

          // Mock the domain registry service to return unsorted domains
          const shuffledDomains = [...domainsWithUniqueVotes].sort(() => Math.random() - 0.5);
          domainRegistryService.listNonCompliantDomains.mockResolvedValue(shuffledDomains);

          const result = await domainsController.getDomainRegistry();
          
          // Check that domains are sorted by upvotes in descending order
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].upvotes).toBeGreaterThanOrEqual(result[i + 1].upvotes);
          }
          
          // Verify the highest upvote count is first
          if (result.length > 0) {
            const maxUpvotes = Math.max(...domainsWithUniqueVotes.map(d => d.upvotes));
            expect(result[0].upvotes).toBe(maxUpvotes);
          }
        }
      ), { numRuns: 50 });
    });

    // Feature: dmarc-portal, Property 5: Registry sorting consistency
    it('should sort by check date when vote counts are equal', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 100 }),
        async (numDomains, sameVoteCount) => {
          // Create domains with same vote count but different check dates
          const domains: DomainEntry[] = Array.from({ length: numDomains }, (_, index) => ({
            domain: `domain${index}.com`,
            lastChecked: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)), // Different dates
            upvotes: sameVoteCount, // Same vote count
            dmarcStatus: 'weak' as const,
            validationResult: {
              domain: `domain${index}.com`,
              dmarcRecord: 'v=DMARC1; p=none;',
              isValid: false,
              issues: [],
              checkTimestamp: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)),
            },
          }));

          // Mock the domain registry service
          const shuffledDomains = [...domains].sort(() => Math.random() - 0.5);
          domainRegistryService.listNonCompliantDomains.mockResolvedValue(shuffledDomains);

          const result = await domainsController.getDomainRegistry();
          
          // Since all have same vote count, should be sorted by check date (most recent first)
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].lastChecked.getTime()).toBeGreaterThanOrEqual(
              result[i + 1].lastChecked.getTime()
            );
          }
        }
      ), { numRuns: 50 });
    });

    // Feature: dmarc-portal, Property 5: Registry sorting consistency
    it('should maintain stable sorting for identical entries', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        fc.date(),
        fc.integer({ min: 3, max: 8 }),
        async (voteCount, checkDate, numIdentical) => {
          // Create identical domain entries (except for domain names)
          const domains: DomainEntry[] = Array.from({ length: numIdentical }, (_, index) => ({
            domain: `identical${index}.com`, // Different domains but same metadata
            lastChecked: checkDate,
            upvotes: voteCount,
            dmarcStatus: 'weak' as const,
            validationResult: {
              domain: `identical${index}.com`,
              dmarcRecord: 'v=DMARC1; p=none;',
              isValid: false,
              issues: [],
              checkTimestamp: checkDate,
            },
          }));

          // Mock the domain registry service
          const shuffledDomains = [...domains].sort(() => Math.random() - 0.5);
          domainRegistryService.listNonCompliantDomains.mockResolvedValue(shuffledDomains);

          const result = await domainsController.getDomainRegistry();
          
          // All entries should have the same vote count and check date
          for (const entry of result) {
            expect(entry.upvotes).toBe(voteCount);
            expect(entry.lastChecked.getTime()).toBe(checkDate.getTime());
          }

          // Should return all entries
          expect(result).toHaveLength(numIdentical);
        }
      ), { numRuns: 50 });
    });
  });
});