import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body, 
  HttpException, 
  HttpStatus,
  Req,
  Logger,
  Inject
} from '@nestjs/common';
import { Request } from 'express';
import { DomainRegistryService } from '../firebase/domain-registry.service';
import { IpBlockerService } from '../voting/ip-blocker.service';
import { DmarcValidator } from '../dmarc/dmarc-validator.service';
import { ValidationResult, DomainEntry } from '../firebase/models/domain.model';

interface ValidateDomainRequest {
  domain: string;
}

interface UpvoteResponse {
  success: boolean;
  newUpvoteCount: number;
  message: string;
}

@Controller('api/domains')
export class DomainsController {
  private readonly logger = new Logger(DomainsController.name);

  constructor(
    private readonly domainRegistryService: DomainRegistryService,
    private readonly ipBlockerService: IpBlockerService,
    @Inject('DmarcValidator') private readonly dmarcValidator: DmarcValidator,
  ) {}

  /**
   * Validate a domain's DMARC configuration
   */
  @Post('validate')
  async validateDomain(@Body() request: ValidateDomainRequest): Promise<ValidationResult> {
    try {
      if (!request.domain) {
        throw new HttpException('Domain is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Validating domain: ${request.domain}`);
      const result = await this.dmarcValidator.validateDomain(request.domain);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to validate domain ${request.domain}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to validate domain',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the public registry of non-compliant domains
   */
  @Get('registry')
  async getDomainRegistry(): Promise<DomainEntry[]> {
    try {
      this.logger.log('Fetching domain registry');
      const domains = await this.domainRegistryService.listNonCompliantDomains();
      
      // Sort by upvotes (descending) then by check date (most recent first)
      return domains.sort((a, b) => {
        if (a.upvotes !== b.upvotes) {
          return b.upvotes - a.upvotes; // Higher upvotes first
        }
        return b.lastChecked.getTime() - a.lastChecked.getTime(); // More recent first
      });
    } catch (error) {
      this.logger.error('Failed to fetch domain registry:', error);
      throw new HttpException(
        'Failed to fetch domain registry',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upvote a domain in the registry
   */
  @Post(':domain/upvote')
  async upvoteDomain(
    @Param('domain') domain: string,
    @Req() request: Request,
  ): Promise<UpvoteResponse> {
    try {
      const clientIp = this.getClientIp(request);
      
      this.logger.log(`Upvote request for domain ${domain} from IP ${clientIp}`);

      // Check if this IP has already voted for this domain
      if (this.ipBlockerService.hasVoted(clientIp, domain)) {
        return {
          success: false,
          newUpvoteCount: await this.domainRegistryService.getUpvoteCount(domain),
          message: 'You have already voted for this domain',
        };
      }

      // Check if domain exists in registry
      const domainResult = await this.domainRegistryService.getDomainResult(domain);
      if (!domainResult) {
        throw new HttpException('Domain not found in registry', HttpStatus.NOT_FOUND);
      }

      // Record the vote and increment upvotes
      this.ipBlockerService.recordVote(clientIp, domain);
      const newUpvoteCount = await this.domainRegistryService.incrementUpvotes(domain);

      this.logger.log(`Successfully upvoted domain ${domain}. New count: ${newUpvoteCount}`);

      return {
        success: true,
        newUpvoteCount,
        message: 'Vote recorded successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to upvote domain ${domain}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to record vote',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Re-check a domain's DMARC configuration
   */
  @Post(':domain/recheck')
  async recheckDomain(@Param('domain') domain: string): Promise<ValidationResult> {
    try {
      this.logger.log(`Re-checking domain: ${domain}`);
      
      // Force a fresh validation (bypass cache)
      const result = await this.dmarcValidator.validateDomain(domain);
      
      // If domain is now compliant, remove it from registry
      if (result.isValid) {
        await this.domainRegistryService.removeDomainFromRegistry(domain);
        this.logger.log(`Domain ${domain} is now compliant, removed from registry`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to recheck domain ${domain}:`, error);
      throw new HttpException(
        'Failed to recheck domain',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get detailed information about a specific domain
   */
  @Get(':domain/details')
  async getDomainDetails(@Param('domain') domain: string): Promise<ValidationResult> {
    try {
      this.logger.log(`Fetching details for domain: ${domain}`);
      
      const result = await this.domainRegistryService.getDomainResult(domain);
      if (!result) {
        throw new HttpException('Domain not found', HttpStatus.NOT_FOUND);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get domain details for ${domain}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Failed to get domain details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Extract client IP address from request
   */
  private getClientIp(request: Request): string {
    // Check various headers for the real IP address
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const clientIp = request.headers['x-client-ip'] as string;
    
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    }
    
    if (realIp) {
      return realIp;
    }
    
    if (clientIp) {
      return clientIp;
    }
    
    // Fallback to connection remote address
    return request.connection.remoteAddress || request.socket.remoteAddress || 'unknown';
  }
}