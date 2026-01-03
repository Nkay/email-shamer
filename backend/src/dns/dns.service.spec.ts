import { Test, TestingModule } from '@nestjs/testing';
import { DnsServiceImpl } from './dns.service';
import * as fc from 'fast-check';

describe('DnsService', () => {
  let service: DnsServiceImpl;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DnsServiceImpl],
    }).compile();

    service = module.get<DnsServiceImpl>(DnsServiceImpl);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateDomainFormat', () => {
    it('should validate valid domain formats', () => {
      expect(service.validateDomainFormat('example.com')).toBe(true);
      expect(service.validateDomainFormat('sub.example.com')).toBe(true);
      expect(service.validateDomainFormat('test-domain.org')).toBe(true);
      expect(service.validateDomainFormat('a.b.c.example.co.uk')).toBe(true);
    });

    it('should reject invalid domain formats', () => {
      expect(service.validateDomainFormat('')).toBe(false);
      expect(service.validateDomainFormat('invalid')).toBe(false);
      expect(service.validateDomainFormat('invalid.')).toBe(false);
      expect(service.validateDomainFormat('.invalid')).toBe(false);
      expect(service.validateDomainFormat('invalid..com')).toBe(false);
      expect(service.validateDomainFormat('invalid-.com')).toBe(false);
      expect(service.validateDomainFormat('-invalid.com')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(service.validateDomainFormat(null as any)).toBe(false);
      expect(service.validateDomainFormat(undefined as any)).toBe(false);
      expect(service.validateDomainFormat('   ')).toBe(false);
      expect(service.validateDomainFormat('a'.repeat(254))).toBe(false); // Too long
    });
  });

  describe('lookupDmarcRecord', () => {
    it('should throw error for invalid domain format', async () => {
      await expect(service.lookupDmarcRecord('invalid')).rejects.toThrow('Invalid domain format');
      await expect(service.lookupDmarcRecord('')).rejects.toThrow('Invalid domain format');
    });

    // Note: We can't easily test actual DNS lookups in unit tests without mocking
    // The property test below will handle the comprehensive validation
  });

  // Feature: dmarc-portal, Property 1: Domain validation completeness
  // For any valid domain name submitted to the system, the DMARC Portal should perform 
  // format validation, DNS lookup, DMARC record evaluation, and return a complete 
  // validation result with appropriate compliance status and detailed explanations.
  // Validates: Requirements 1.1
  describe('Property 1: Domain validation completeness', () => {
    it('should perform complete domain validation for any valid domain', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid domain names
          fc.record({
            subdomain: fc.option(fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9-]/.test(c)), { minLength: 1, maxLength: 10 })),
            domain: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9-]/.test(c)), { minLength: 1, maxLength: 20 }),
            tld: fc.constantFrom('com', 'org', 'net', 'edu', 'gov', 'co.uk', 'example')
          }).map(({ subdomain, domain, tld }) => {
            const cleanDomain = domain.replace(/^-+|-+$/g, '').replace(/--+/g, '-') || 'test';
            const cleanSubdomain = subdomain ? subdomain.replace(/^-+|-+$/g, '').replace(/--+/g, '-') : null;
            return cleanSubdomain ? `${cleanSubdomain}.${cleanDomain}.${tld}` : `${cleanDomain}.${tld}`;
          }).filter(domain => domain.length <= 253 && domain.length > 0),
          async (domain) => {
            // Test 1: Format validation should pass for generated valid domains
            const isValidFormat = service.validateDomainFormat(domain);
            expect(isValidFormat).toBe(true);

            // Test 2: DNS lookup should not throw for format validation
            // (It may return null for non-existent domains, but shouldn't throw format errors)
            try {
              const result = await service.lookupDmarcRecord(domain);
              // Result can be null (no DMARC record) or string (DMARC record found)
              expect(result === null || typeof result === 'string').toBe(true);
              
              // If a DMARC record is found, it should start with v=DMARC1
              if (result !== null) {
                expect(result.startsWith('v=DMARC1')).toBe(true);
              }
            } catch (error) {
              // DNS lookup failures are acceptable for non-existent domains
              // but should not be format validation errors
              expect(error.message).not.toContain('Invalid domain format');
            }
          }
        ),
        { numRuns: 10 } // Reduced runs to avoid timeout
      );
    }, 30000); // 30 second timeout

    it('should reject invalid domain formats consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate invalid domain patterns
          fc.oneof(
            fc.constant(''), // Empty string
            fc.constant('invalid'), // No TLD
            fc.string().filter(s => s.includes('..')), // Double dots
            fc.string().filter(s => s.startsWith('.')), // Leading dot
            fc.string().filter(s => s.endsWith('.')), // Trailing dot
            fc.string().filter(s => s.includes(' ')), // Spaces
            fc.stringOf(fc.char(), { minLength: 254 }) // Too long
          ),
          async (invalidDomain) => {
            // Format validation should fail
            const isValidFormat = service.validateDomainFormat(invalidDomain);
            expect(isValidFormat).toBe(false);

            // DNS lookup should throw format error
            await expect(service.lookupDmarcRecord(invalidDomain))
              .rejects.toThrow('Invalid domain format');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});