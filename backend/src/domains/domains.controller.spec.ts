import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainRegistryService } from '../firebase/domain-registry.service';
import { IpBlockerService } from '../voting/ip-blocker.service';
import { DmarcValidator } from '../dmarc/dmarc-validator.service';
import { ValidationResult, DomainEntry } from '../firebase/models/domain.model';

describe('DomainsController', () => {
  let controller: DomainsController;
  let domainRegistryService: jest.Mocked<DomainRegistryService>;
  let ipBlockerService: jest.Mocked<IpBlockerService>;
  let dmarcValidator: jest.Mocked<DmarcValidator>;

  const mockValidationResult: ValidationResult = {
    domain: 'example.com',
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

  const mockDomainEntry: DomainEntry = {
    domain: 'example.com',
    lastChecked: new Date('2024-01-01T00:00:00Z'),
    upvotes: 5,
    dmarcStatus: 'weak',
    validationResult: mockValidationResult,
  };

  beforeEach(async () => {
    const mockDomainRegistryService = {
      listNonCompliantDomains: jest.fn(),
      getDomainResult: jest.fn(),
      incrementUpvotes: jest.fn(),
      getUpvoteCount: jest.fn(),
      removeDomainFromRegistry: jest.fn(),
    };

    const mockIpBlockerService = {
      hasVoted: jest.fn(),
      recordVote: jest.fn(),
    };

    const mockDmarcValidator = {
      validateDomain: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DomainsController],
      providers: [
        {
          provide: DomainRegistryService,
          useValue: mockDomainRegistryService,
        },
        {
          provide: IpBlockerService,
          useValue: mockIpBlockerService,
        },
        {
          provide: 'DmarcValidator',
          useValue: mockDmarcValidator,
        },
      ],
    }).compile();

    controller = module.get<DomainsController>(DomainsController);
    domainRegistryService = module.get(DomainRegistryService);
    ipBlockerService = module.get(IpBlockerService);
    dmarcValidator = module.get('DmarcValidator');
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('validateDomain', () => {
    it('should validate a domain successfully', async () => {
      dmarcValidator.validateDomain.mockResolvedValue(mockValidationResult);

      const result = await controller.validateDomain({ domain: 'example.com' });

      expect(result).toEqual(mockValidationResult);
      expect(dmarcValidator.validateDomain).toHaveBeenCalledWith('example.com');
    });

    it('should throw error for missing domain', async () => {
      await expect(controller.validateDomain({ domain: '' })).rejects.toThrow(
        new HttpException('Domain is required', HttpStatus.BAD_REQUEST),
      );
    });

    it('should handle validation errors', async () => {
      dmarcValidator.validateDomain.mockRejectedValue(new Error('DNS error'));

      await expect(controller.validateDomain({ domain: 'example.com' })).rejects.toThrow(
        new HttpException('Failed to validate domain', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });

  describe('getDomainRegistry', () => {
    it('should return sorted domain registry', async () => {
      const domains = [
        { ...mockDomainEntry, domain: 'low-votes.com', upvotes: 1 },
        { ...mockDomainEntry, domain: 'high-votes.com', upvotes: 10 },
        { ...mockDomainEntry, domain: 'medium-votes.com', upvotes: 5 },
      ];

      domainRegistryService.listNonCompliantDomains.mockResolvedValue(domains);

      const result = await controller.getDomainRegistry();

      expect(result).toHaveLength(3);
      expect(result[0].domain).toBe('high-votes.com'); // Highest votes first
      expect(result[1].domain).toBe('medium-votes.com');
      expect(result[2].domain).toBe('low-votes.com'); // Lowest votes last
    });

    it('should sort by check date when votes are equal', async () => {
      const domains = [
        { 
          ...mockDomainEntry, 
          domain: 'older.com', 
          upvotes: 5, 
          lastChecked: new Date('2024-01-01T00:00:00Z') 
        },
        { 
          ...mockDomainEntry, 
          domain: 'newer.com', 
          upvotes: 5, 
          lastChecked: new Date('2024-01-02T00:00:00Z') 
        },
      ];

      domainRegistryService.listNonCompliantDomains.mockResolvedValue(domains);

      const result = await controller.getDomainRegistry();

      expect(result[0].domain).toBe('newer.com'); // More recent first
      expect(result[1].domain).toBe('older.com');
    });
  });

  describe('upvoteDomain', () => {
    const mockRequest = {
      connection: { remoteAddress: '192.168.1.1' },
      headers: {},
    } as any;

    it('should successfully upvote a domain', async () => {
      ipBlockerService.hasVoted.mockReturnValue(false);
      domainRegistryService.getDomainResult.mockResolvedValue(mockValidationResult);
      domainRegistryService.incrementUpvotes.mockResolvedValue(6);

      const result = await controller.upvoteDomain('example.com', mockRequest);

      expect(result).toEqual({
        success: true,
        newUpvoteCount: 6,
        message: 'Vote recorded successfully',
      });
      expect(ipBlockerService.recordVote).toHaveBeenCalledWith('192.168.1.1', 'example.com');
    });

    it('should reject duplicate votes', async () => {
      ipBlockerService.hasVoted.mockReturnValue(true);
      domainRegistryService.getUpvoteCount.mockResolvedValue(5);

      const result = await controller.upvoteDomain('example.com', mockRequest);

      expect(result).toEqual({
        success: false,
        newUpvoteCount: 5,
        message: 'You have already voted for this domain',
      });
      expect(ipBlockerService.recordVote).not.toHaveBeenCalled();
    });

    it('should handle domain not found', async () => {
      ipBlockerService.hasVoted.mockReturnValue(false);
      domainRegistryService.getDomainResult.mockResolvedValue(null);

      await expect(controller.upvoteDomain('nonexistent.com', mockRequest)).rejects.toThrow(
        new HttpException('Domain not found in registry', HttpStatus.NOT_FOUND),
      );
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const requestWithForwarded = {
        ...mockRequest,
        headers: { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' },
      };

      ipBlockerService.hasVoted.mockReturnValue(false);
      domainRegistryService.getDomainResult.mockResolvedValue(mockValidationResult);
      domainRegistryService.incrementUpvotes.mockResolvedValue(6);

      await controller.upvoteDomain('example.com', requestWithForwarded);

      expect(ipBlockerService.recordVote).toHaveBeenCalledWith('203.0.113.1', 'example.com');
    });
  });

  describe('recheckDomain', () => {
    it('should recheck domain and keep in registry if still non-compliant', async () => {
      dmarcValidator.validateDomain.mockResolvedValue(mockValidationResult);

      const result = await controller.recheckDomain('example.com');

      expect(result).toEqual(mockValidationResult);
      expect(domainRegistryService.removeDomainFromRegistry).not.toHaveBeenCalled();
    });

    it('should remove domain from registry if now compliant', async () => {
      const compliantResult = { ...mockValidationResult, isValid: true };
      dmarcValidator.validateDomain.mockResolvedValue(compliantResult);

      const result = await controller.recheckDomain('example.com');

      expect(result).toEqual(compliantResult);
      expect(domainRegistryService.removeDomainFromRegistry).toHaveBeenCalledWith('example.com');
    });
  });

  describe('getDomainDetails', () => {
    it('should return domain details', async () => {
      domainRegistryService.getDomainResult.mockResolvedValue(mockValidationResult);

      const result = await controller.getDomainDetails('example.com');

      expect(result).toEqual(mockValidationResult);
    });

    it('should handle domain not found', async () => {
      domainRegistryService.getDomainResult.mockResolvedValue(null);

      await expect(controller.getDomainDetails('nonexistent.com')).rejects.toThrow(
        new HttpException('Domain not found', HttpStatus.NOT_FOUND),
      );
    });
  });
});