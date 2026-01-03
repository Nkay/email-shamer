import { Test, TestingModule } from '@nestjs/testing';
import { DmarcValidatorImpl, DmarcPolicy, ValidationIssue } from './dmarc-validator.service';
import * as fc from 'fast-check';

describe('DmarcValidatorService', () => {
  let service: DmarcValidatorImpl;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DmarcValidatorImpl],
    }).compile();

    service = module.get<DmarcValidatorImpl>(DmarcValidatorImpl);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseDmarcRecord', () => {
    it('should parse valid DMARC records', () => {
      const record = 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com';
      const policy = service.parseDmarcRecord(record);
      
      expect(policy.version).toBe('DMARC1');
      expect(policy.policy).toBe('reject');
      expect(policy.reportingAddresses).toContain('mailto:dmarc@example.com');
    });

    it('should handle minimal DMARC records', () => {
      const record = 'v=DMARC1; p=none';
      const policy = service.parseDmarcRecord(record);
      
      expect(policy.version).toBe('DMARC1');
      expect(policy.policy).toBe('none');
    });

    it('should throw error for invalid records', () => {
      expect(() => service.parseDmarcRecord('')).toThrow();
      expect(() => service.parseDmarcRecord('invalid')).toThrow();
      expect(() => service.parseDmarcRecord('v=DMARC2; p=none')).toThrow();
    });

    it('should parse complex DMARC records', () => {
      const record = 'v=DMARC1; p=quarantine; sp=reject; pct=50; rua=mailto:dmarc@example.com; adkim=s; aspf=r';
      const policy = service.parseDmarcRecord(record);
      
      expect(policy.policy).toBe('quarantine');
      expect(policy.subdomainPolicy).toBe('reject');
      expect(policy.percentage).toBe(50);
      expect(policy.alignment?.dkim).toBe('strict');
      expect(policy.alignment?.spf).toBe('relaxed');
    });
  });

  describe('evaluatePolicy', () => {
    it('should identify weak policies', () => {
      const policy: DmarcPolicy = {
        version: 'DMARC1',
        policy: 'none',
        rawRecord: 'v=DMARC1; p=none',
      };
      
      const issues = service.evaluatePolicy(policy);
      const weakPolicyIssue = issues.find(issue => issue.type === 'weak_policy');
      expect(weakPolicyIssue).toBeDefined();
      expect(weakPolicyIssue?.severity).toBe('warning');
    });

    it('should identify missing reporting addresses', () => {
      const policy: DmarcPolicy = {
        version: 'DMARC1',
        policy: 'reject',
        rawRecord: 'v=DMARC1; p=reject',
      };
      
      const issues = service.evaluatePolicy(policy);
      const reportingIssue = issues.find(issue => 
        issue.type === 'configuration_issue' && issue.message.includes('reporting addresses')
      );
      expect(reportingIssue).toBeDefined();
    });

    it('should validate reporting address formats', () => {
      const policy: DmarcPolicy = {
        version: 'DMARC1',
        policy: 'reject',
        reportingAddresses: ['invalid-email', 'mailto:valid@example.com'],
        rawRecord: 'v=DMARC1; p=reject; rua=invalid-email,mailto:valid@example.com',
      };
      
      const issues = service.evaluatePolicy(policy);
      const syntaxIssue = issues.find(issue => issue.type === 'syntax_error');
      expect(syntaxIssue).toBeDefined();
      expect(syntaxIssue?.message).toContain('invalid-email');
    });
  });

  // Feature: dmarc-portal, Property 7: DMARC evaluation thoroughness
  // For any DMARC record found during lookup, the system should evaluate record syntax, 
  // policy settings, alignment requirements, and security effectiveness to produce 
  // comprehensive validation results.
  // Validates: Requirements 6.4
  describe('Property 7: DMARC evaluation thoroughness', () => {
    it('should thoroughly evaluate any valid DMARC record', () => {
      fc.assert(
        fc.property(
          // Generate valid DMARC records
          fc.record({
            policy: fc.constantFrom('none', 'quarantine', 'reject'),
            subdomainPolicy: fc.option(fc.constantFrom('none', 'quarantine', 'reject')),
            percentage: fc.option(fc.integer({ min: 1, max: 100 })),
            reportingAddress: fc.option(fc.emailAddress()),
            dkimAlignment: fc.option(fc.constantFrom('r', 's', 'relaxed', 'strict')),
            spfAlignment: fc.option(fc.constantFrom('r', 's', 'relaxed', 'strict')),
          }).map(({ policy, subdomainPolicy, percentage, reportingAddress, dkimAlignment, spfAlignment }) => {
            let record = `v=DMARC1; p=${policy}`;
            
            if (subdomainPolicy) {
              record += `; sp=${subdomainPolicy}`;
            }
            if (percentage) {
              record += `; pct=${percentage}`;
            }
            if (reportingAddress) {
              record += `; rua=mailto:${reportingAddress}`;
            }
            if (dkimAlignment) {
              record += `; adkim=${dkimAlignment}`;
            }
            if (spfAlignment) {
              record += `; aspf=${spfAlignment}`;
            }
            
            return record;
          }),
          (dmarcRecord) => {
            // Test 1: Should successfully parse any valid DMARC record
            let parsedPolicy: DmarcPolicy;
            expect(() => {
              parsedPolicy = service.parseDmarcRecord(dmarcRecord);
            }).not.toThrow();

            // Test 2: Parsed policy should contain all required fields
            expect(parsedPolicy!.version).toBe('DMARC1');
            expect(['none', 'quarantine', 'reject']).toContain(parsedPolicy!.policy);
            expect(parsedPolicy!.rawRecord).toBe(dmarcRecord);

            // Test 3: Should perform comprehensive evaluation
            const issues = service.evaluatePolicy(parsedPolicy!);
            expect(Array.isArray(issues)).toBe(true);

            // Test 4: All issues should have required properties
            for (const issue of issues) {
              expect(issue).toHaveProperty('type');
              expect(issue).toHaveProperty('severity');
              expect(issue).toHaveProperty('message');
              expect(issue).toHaveProperty('recommendation');
              expect(['error', 'warning', 'info']).toContain(issue.severity);
              expect(['missing_record', 'syntax_error', 'weak_policy', 'alignment_issue', 'configuration_issue'])
                .toContain(issue.type);
              expect(typeof issue.message).toBe('string');
              expect(typeof issue.recommendation).toBe('string');
              expect(issue.message.length).toBeGreaterThan(0);
              expect(issue.recommendation.length).toBeGreaterThan(0);
            }

            // Test 5: Should identify weak policies
            if (parsedPolicy!.policy === 'none') {
              const hasWeakPolicyIssue = issues.some(issue => issue.type === 'weak_policy');
              expect(hasWeakPolicyIssue).toBe(true);
            }

            // Test 6: Should validate percentage settings
            if (parsedPolicy!.percentage !== undefined && parsedPolicy!.percentage < 100) {
              const hasPercentageIssue = issues.some(issue => 
                issue.type === 'configuration_issue' && 
                (issue.message.includes('percentage') || issue.message.includes('% of messages'))
              );
              expect(hasPercentageIssue).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle malformed DMARC records appropriately', () => {
      fc.assert(
        fc.property(
          // Generate potentially malformed DMARC records
          fc.oneof(
            fc.constant(''), // Empty string
            fc.constant('invalid'), // No version
            fc.constant('v=DMARC2; p=none'), // Wrong version
            fc.constant('v=DMARC1'), // Missing policy
            fc.constant('v=DMARC1; p=invalid'), // Invalid policy
            fc.constant('v=DMARC1; p=none; pct=150'), // Invalid percentage
            fc.string().filter(s => !s.includes('v=DMARC1')), // Random strings without DMARC
          ),
          (malformedRecord) => {
            // Should either throw an error or handle gracefully
            try {
              const policy = service.parseDmarcRecord(malformedRecord);
              // If parsing succeeds, evaluation should still work
              const issues = service.evaluatePolicy(policy);
              expect(Array.isArray(issues)).toBe(true);
            } catch (error) {
              // Parsing should fail with descriptive error message
              expect(error).toBeInstanceOf(Error);
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should provide consistent evaluation results', () => {
      fc.assert(
        fc.property(
          // Generate the same DMARC record multiple times
          fc.record({
            policy: fc.constantFrom('none', 'quarantine', 'reject'),
            hasReporting: fc.boolean(),
          }).map(({ policy, hasReporting }) => {
            let record = `v=DMARC1; p=${policy}`;
            if (hasReporting) {
              record += '; rua=mailto:dmarc@example.com';
            }
            return record;
          }),
          (dmarcRecord) => {
            // Parse and evaluate the same record multiple times
            const policy1 = service.parseDmarcRecord(dmarcRecord);
            const policy2 = service.parseDmarcRecord(dmarcRecord);
            const issues1 = service.evaluatePolicy(policy1);
            const issues2 = service.evaluatePolicy(policy2);

            // Results should be identical
            expect(policy1).toEqual(policy2);
            expect(issues1).toEqual(issues2);
            
            // Issue count should be consistent
            expect(issues1.length).toBe(issues2.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});