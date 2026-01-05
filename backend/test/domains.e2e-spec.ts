import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DomainRegistryService } from '../src/firebase/domain-registry.service';
import { IpBlockerService } from '../src/voting/ip-blocker.service';
import { DmarcValidator } from '../src/dmarc/dmarc-validator.service';
import { ValidationResult, DomainEntry } from '../src/firebase/models/domain.model';

describe('Domains API (e2e)', () => {
  let app: INestApplication;
  let domainRegistryService: DomainRegistryService;
  let ipBlockerService: IpBlockerService;
  let dmarcValidator: DmarcValidator;

  const mockValidationResult: ValidationResult = {
    domain: 'test-domain.com',
    dmarcRecord: 'v=DMARC1; p=none;',
    isValid: false,
    issues: [
      {
        type: 'weak_policy',
        severity: 'warning',
        message: 'DMARC policy is set to none',
        recommendation: 'Consider setting policy to quarantine or reject',
      },
    ],
    checkTimestamp: new Date('2024-01-01T00:00:00Z'),
  };

  const mockCompliantResult: ValidationResult = {
    domain: 'compliant-domain.com',
    dmarcRecord: 'v=DMARC1; p=reject; rua=mailto:dmarc@compliant-domain.com',
    isValid: true,
    issues: [],
    checkTimestamp: new Date('2024-01-01T00:00:00Z'),
  };

  const mockDomainEntry: DomainEntry = {
    domain: 'test-domain.com',
    lastChecked: new Date('2024-01-01T00:00:00Z'),
    upvotes: 5,
    dmarcStatus: 'weak',
    validationResult: mockValidationResult,
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get service instances for mocking
    domainRegistryService = app.get<DomainRegistryService>(DomainRegistryService);
    ipBlockerService = app.get<IpBlockerService>(IpBlockerService);
    dmarcValidator = app.get<DmarcValidator>('DmarcValidator');

    // Clear any existing votes
    ipBlockerService.clearAllVotes();
  }, 10000);

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  }, 10000);

  describe('POST /api/domains/validate', () => {
    it('should validate a domain successfully', async () => {
      // Mock the validator to return our test result
      jest.spyOn(dmarcValidator, 'validateDomain').mockResolvedValue(mockValidationResult);

      const response = await request(app.getHttpServer())
        .post('/api/domains/validate')
        .send({ domain: 'test-domain.com' })
        .expect(201);

      expect(response.body).toMatchObject({
        domain: 'test-domain.com',
        dmarcRecord: 'v=DMARC1; p=none;',
        isValid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            type: 'weak_policy',
            severity: 'warning',
          }),
        ]),
      });
    });

    it('should return 400 for missing domain', async () => {
      await request(app.getHttpServer())
        .post('/api/domains/validate')
        .send({})
        .expect(400);
    });

    it('should return 400 for empty domain', async () => {
      await request(app.getHttpServer())
        .post('/api/domains/validate')
        .send({ domain: '' })
        .expect(400);
    });

    it('should handle validation errors gracefully', async () => {
      jest.spyOn(dmarcValidator, 'validateDomain').mockRejectedValue(new Error('DNS lookup failed'));

      await request(app.getHttpServer())
        .post('/api/domains/validate')
        .send({ domain: 'error-domain.com' })
        .expect(500);
    });
  });

  describe('GET /api/domains/registry', () => {
    it('should return empty registry when no domains exist', async () => {
      jest.spyOn(domainRegistryService, 'listNonCompliantDomains').mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/api/domains/registry')
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return sorted domain registry', async () => {
      const domains = [
        { ...mockDomainEntry, domain: 'low-votes.com', upvotes: 1 },
        { ...mockDomainEntry, domain: 'high-votes.com', upvotes: 10 },
        { ...mockDomainEntry, domain: 'medium-votes.com', upvotes: 5 },
      ];

      jest.spyOn(domainRegistryService, 'listNonCompliantDomains').mockResolvedValue(domains);

      const response = await request(app.getHttpServer())
        .get('/api/domains/registry')
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].domain).toBe('high-votes.com'); // Highest votes first
      expect(response.body[1].domain).toBe('medium-votes.com');
      expect(response.body[2].domain).toBe('low-votes.com'); // Lowest votes last
    });

    it('should handle registry fetch errors', async () => {
      jest.spyOn(domainRegistryService, 'listNonCompliantDomains').mockRejectedValue(new Error('Database error'));

      await request(app.getHttpServer())
        .get('/api/domains/registry')
        .expect(500);
    });
  });

  describe('POST /api/domains/:domain/recheck', () => {
    it('should recheck domain and return updated results', async () => {
      jest.spyOn(dmarcValidator, 'validateDomain').mockResolvedValue(mockValidationResult);

      const response = await request(app.getHttpServer())
        .post('/api/domains/test-domain.com/recheck')
        .expect(201);

      expect(response.body).toMatchObject({
        domain: 'test-domain.com',
        isValid: false,
      });
    });

    it('should remove domain from registry when now compliant', async () => {
      jest.spyOn(dmarcValidator, 'validateDomain').mockResolvedValue(mockCompliantResult);
      const removeSpy = jest.spyOn(domainRegistryService, 'removeDomainFromRegistry').mockResolvedValue();

      const response = await request(app.getHttpServer())
        .post('/api/domains/compliant-domain.com/recheck')
        .expect(201);

      expect(response.body.isValid).toBe(true);
      expect(removeSpy).toHaveBeenCalledWith('compliant-domain.com');
    });

    it('should handle recheck errors', async () => {
      jest.spyOn(dmarcValidator, 'validateDomain').mockRejectedValue(new Error('Recheck failed'));

      await request(app.getHttpServer())
        .post('/api/domains/error-domain.com/recheck')
        .expect(500);
    });
  });

  describe('POST /api/domains/:domain/upvote', () => {
    it('should successfully upvote a domain', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(mockValidationResult);
      jest.spyOn(domainRegistryService, 'incrementUpvotes').mockResolvedValue(6);

      const response = await request(app.getHttpServer())
        .post('/api/domains/test-domain.com/upvote')
        .set('x-forwarded-for', '192.168.1.1')
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        newUpvoteCount: 6,
        message: 'Vote recorded successfully',
      });
    });

    it('should reject duplicate votes from same IP', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(mockValidationResult);
      jest.spyOn(domainRegistryService, 'incrementUpvotes').mockResolvedValue(6);
      jest.spyOn(domainRegistryService, 'getUpvoteCount').mockResolvedValue(5);

      // First vote should succeed
      const firstVoteResponse = await request(app.getHttpServer())
        .post('/api/domains/test-domain.com/upvote')
        .set('x-forwarded-for', '192.168.1.1')
        .expect(201);

      expect(firstVoteResponse.body.success).toBe(true);

      // Second vote from same IP should be rejected
      const secondVoteResponse = await request(app.getHttpServer())
        .post('/api/domains/test-domain.com/upvote')
        .set('x-forwarded-for', '192.168.1.1')
        .expect(201);

      expect(secondVoteResponse.body).toEqual({
        success: false,
        newUpvoteCount: 5,
        message: 'You have already voted for this domain',
      });
    }, 10000);

    it('should return 404 for non-existent domain', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/domains/nonexistent.com/upvote')
        .set('x-forwarded-for', '192.168.1.1')
        .expect(404);
    });

    it('should handle different IP header formats', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(mockValidationResult);
      jest.spyOn(domainRegistryService, 'incrementUpvotes').mockResolvedValue(1);

      // Test x-real-ip header
      await request(app.getHttpServer())
        .post('/api/domains/test-domain.com/upvote')
        .set('x-real-ip', '203.0.113.1')
        .expect(201);

      // Test x-client-ip header
      await request(app.getHttpServer())
        .post('/api/domains/test-domain.com/upvote')
        .set('x-client-ip', '203.0.113.2')
        .expect(201);
    });
  });

  describe('GET /api/domains/:domain/details', () => {
    it('should return domain details', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(mockValidationResult);

      const response = await request(app.getHttpServer())
        .get('/api/domains/test-domain.com/details')
        .expect(200);

      expect(response.body).toMatchObject({
        domain: 'test-domain.com',
        dmarcRecord: 'v=DMARC1; p=none;',
        isValid: false,
      });
    });

    it('should return 404 for non-existent domain', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/domains/nonexistent.com/details')
        .expect(404);
    });

    it('should handle details fetch errors', async () => {
      jest.spyOn(domainRegistryService, 'getDomainResult').mockRejectedValue(new Error('Database error'));

      await request(app.getHttpServer())
        .get('/api/domains/error-domain.com/details')
        .expect(500);
    });
  });

  describe('Complete domain validation workflow', () => {
    it('should handle complete workflow: validate -> registry -> upvote -> recheck', async () => {
      // Step 1: Validate a domain (non-compliant)
      jest.spyOn(dmarcValidator, 'validateDomain').mockResolvedValue(mockValidationResult);
      
      const validateResponse = await request(app.getHttpServer())
        .post('/api/domains/validate')
        .send({ domain: 'workflow-test.com' })
        .expect(201);

      expect(validateResponse.body.isValid).toBe(false);

      // Step 2: Check registry (should include our domain)
      jest.spyOn(domainRegistryService, 'listNonCompliantDomains').mockResolvedValue([
        { ...mockDomainEntry, domain: 'workflow-test.com' }
      ]);

      const registryResponse = await request(app.getHttpServer())
        .get('/api/domains/registry')
        .expect(200);

      expect(registryResponse.body).toHaveLength(1);
      expect(registryResponse.body[0].domain).toBe('workflow-test.com');

      // Step 3: Upvote the domain
      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(mockValidationResult);
      jest.spyOn(domainRegistryService, 'incrementUpvotes').mockResolvedValue(1);

      const upvoteResponse = await request(app.getHttpServer())
        .post('/api/domains/workflow-test.com/upvote')
        .set('x-forwarded-for', '192.168.1.100')
        .expect(201);

      expect(upvoteResponse.body.success).toBe(true);
      expect(upvoteResponse.body.newUpvoteCount).toBe(1);

      // Step 4: Recheck domain (now compliant)
      jest.spyOn(dmarcValidator, 'validateDomain').mockResolvedValue({
        ...mockValidationResult,
        domain: 'workflow-test.com',
        isValid: true,
        issues: []
      });
      jest.spyOn(domainRegistryService, 'removeDomainFromRegistry').mockResolvedValue();

      const recheckResponse = await request(app.getHttpServer())
        .post('/api/domains/workflow-test.com/recheck')
        .expect(201);

      expect(recheckResponse.body.isValid).toBe(true);
    }, 15000);
  });

  describe('Voting system integrity', () => {
    it('should prevent vote manipulation across multiple domains', async () => {
      const domain1 = 'domain1.com';
      const domain2 = 'domain2.com';
      const clientIp = '192.168.1.200';

      jest.spyOn(domainRegistryService, 'getDomainResult').mockResolvedValue(mockValidationResult);
      jest.spyOn(domainRegistryService, 'incrementUpvotes').mockResolvedValue(1);

      // Vote for domain1 - should succeed
      const vote1Response = await request(app.getHttpServer())
        .post(`/api/domains/${domain1}/upvote`)
        .set('x-forwarded-for', clientIp)
        .expect(201);

      expect(vote1Response.body.success).toBe(true);

      // Vote for domain2 from same IP - should succeed (different domain)
      const vote2Response = await request(app.getHttpServer())
        .post(`/api/domains/${domain2}/upvote`)
        .set('x-forwarded-for', clientIp)
        .expect(201);

      expect(vote2Response.body.success).toBe(true);

      // Try to vote for domain1 again - should fail
      jest.spyOn(domainRegistryService, 'getUpvoteCount').mockResolvedValue(1);

      const vote3Response = await request(app.getHttpServer())
        .post(`/api/domains/${domain1}/upvote`)
        .set('x-forwarded-for', clientIp)
        .expect(201);

      expect(vote3Response.body.success).toBe(false);
      expect(vote3Response.body.message).toBe('You have already voted for this domain');
    }, 10000);
  });
});