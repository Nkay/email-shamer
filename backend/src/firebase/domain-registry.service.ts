import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { CacheService } from '../cache/cache.service';
import { DomainDocument, ValidationResult, DomainEntry } from './models/domain.model';

@Injectable()
export class DomainRegistryService {
  private readonly logger = new Logger(DomainRegistryService.name);
  private readonly cacheExpirationMinutes = 60; // 1 hour cache

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Store domain validation result with caching
   */
  async storeDomainResult(result: ValidationResult): Promise<void> {
    try {
      // Check if domain already exists
      const existingDomain = await this.firebaseService.getDomain(result.domain);
      
      if (existingDomain) {
        await this.firebaseService.updateDomain(result);
      } else {
        await this.firebaseService.createDomain(result);
      }

      // Update cache using cache service
      const cacheKey = `domain:${result.domain}`;
      this.cacheService.set(cacheKey, result, this.cacheExpirationMinutes);
      
      this.logger.log(`Stored validation result for domain: ${result.domain}`);
    } catch (error) {
      this.logger.error(`Failed to store domain result for ${result.domain}:`, error);
      throw error;
    }
  }

  /**
   * Get domain validation result with cache-first strategy
   */
  async getDomainResult(domain: string): Promise<ValidationResult | null> {
    try {
      const cacheKey = `domain:${domain}`;
      
      // Check cache first using cache service
      const cachedResult = this.cacheService.get<ValidationResult>(cacheKey);
      if (cachedResult) {
        this.logger.debug(`Cache hit for domain: ${domain}`);
        return cachedResult;
      }

      // Cache miss - fetch from database
      this.logger.debug(`Cache miss for domain: ${domain}`);
      const domainDoc = await this.firebaseService.getDomain(domain);
      
      if (!domainDoc) {
        return null;
      }

      const result = this.convertDocumentToResult(domainDoc);
      
      // Update cache using cache service
      this.cacheService.set(cacheKey, result, this.cacheExpirationMinutes);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to get domain result for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * List all non-compliant domains for the public registry
   */
  async listNonCompliantDomains(): Promise<DomainEntry[]> {
    try {
      const nonCompliantDocs = await this.firebaseService.getNonCompliantDomains();
      
      return nonCompliantDocs.map(doc => this.convertDocumentToEntry(doc));
    } catch (error) {
      this.logger.error('Failed to list non-compliant domains:', error);
      throw error;
    }
  }

  /**
   * Remove domain from registry (when it becomes compliant)
   */
  async removeDomainFromRegistry(domain: string): Promise<void> {
    try {
      await this.firebaseService.deleteDomain(domain);
      
      // Remove from cache using cache service
      const cacheKey = `domain:${domain}`;
      this.cacheService.delete(cacheKey);
      
      this.logger.log(`Removed domain from registry: ${domain}`);
    } catch (error) {
      this.logger.error(`Failed to remove domain from registry ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Increment upvotes for a domain
   */
  async incrementUpvotes(domain: string): Promise<number> {
    try {
      const newUpvotes = await this.firebaseService.incrementUpvotes(domain);
      
      // Invalidate cache to ensure fresh data on next read
      const cacheKey = `domain:${domain}`;
      this.cacheService.delete(cacheKey);
      
      return newUpvotes;
    } catch (error) {
      this.logger.error(`Failed to increment upvotes for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Get current upvote count for a domain
   */
  async getUpvoteCount(domain: string): Promise<number> {
    try {
      const domainDoc = await this.firebaseService.getDomain(domain);
      return domainDoc?.upvotes || 0;
    } catch (error) {
      this.logger.error(`Failed to get upvote count for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Convert Firestore document to ValidationResult
   */
  private convertDocumentToResult(doc: DomainDocument): ValidationResult {
    return {
      domain: doc.domain,
      dmarcRecord: doc.dmarcRecord,
      isValid: doc.isValid,
      issues: doc.issues,
      checkTimestamp: doc.lastChecked.toDate(),
    };
  }

  /**
   * Convert Firestore document to DomainEntry for registry display
   */
  private convertDocumentToEntry(doc: DomainDocument): DomainEntry {
    const dmarcStatus = this.determineDmarcStatus(doc);
    
    return {
      domain: doc.domain,
      lastChecked: doc.lastChecked.toDate(),
      upvotes: doc.upvotes,
      dmarcStatus,
      validationResult: this.convertDocumentToResult(doc),
    };
  }

  /**
   * Determine DMARC status based on validation issues
   */
  private determineDmarcStatus(doc: DomainDocument): 'missing' | 'invalid' | 'weak' {
    if (!doc.dmarcRecord) {
      return 'missing';
    }

    const hasErrorIssues = doc.issues.some(issue => issue.severity === 'error');
    if (hasErrorIssues) {
      return 'invalid';
    }

    return 'weak';
  }

  /**
   * Clear all cached entries (useful for testing)
   */
  clearCache(): void {
    this.cacheService.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  getCacheStats(): { size: number; keys: string[]; expiredKeys: string[] } {
    return this.cacheService.getStats();
  }
}