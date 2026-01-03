import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';

export interface DnsService {
  lookupDmarcRecord(domain: string): Promise<string | null>;
  validateDomainFormat(domain: string): boolean;
}

@Injectable()
export class DnsServiceImpl implements DnsService {
  private readonly logger = new Logger(DnsServiceImpl.name);
  
  // Domain format validation regex - matches valid domain names
  private readonly domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  
  /**
   * Validates domain format using regex pattern
   * @param domain The domain to validate
   * @returns true if domain format is valid, false otherwise
   */
  validateDomainFormat(domain: string): boolean {
    if (!domain || typeof domain !== 'string') {
      return false;
    }
    
    // Remove leading/trailing whitespace and convert to lowercase
    const cleanDomain = domain.trim().toLowerCase();
    
    // Check length constraints
    if (cleanDomain.length === 0 || cleanDomain.length > 253) {
      return false;
    }
    
    // Check for valid domain format
    return this.domainRegex.test(cleanDomain);
  }
  
  /**
   * Looks up DMARC record for a domain
   * @param domain The domain to lookup DMARC record for
   * @returns DMARC record string if found, null if not found
   * @throws Error for DNS lookup failures or invalid domain format
   */
  async lookupDmarcRecord(domain: string): Promise<string | null> {
    // Validate domain format first
    if (!this.validateDomainFormat(domain)) {
      throw new Error(`Invalid domain format: ${domain}`);
    }
    
    const cleanDomain = domain.trim().toLowerCase();
    const dmarcDomain = `_dmarc.${cleanDomain}`;
    
    try {
      this.logger.debug(`Looking up DMARC record for domain: ${dmarcDomain}`);
      
      // Lookup TXT records for _dmarc subdomain
      const txtRecords = await dns.resolveTxt(dmarcDomain);
      
      // Find DMARC record (starts with "v=DMARC1")
      for (const record of txtRecords) {
        const recordString = Array.isArray(record) ? record.join('') : record;
        if (recordString.startsWith('v=DMARC1')) {
          this.logger.debug(`Found DMARC record for ${domain}: ${recordString}`);
          return recordString;
        }
      }
      
      this.logger.debug(`No DMARC record found for domain: ${domain}`);
      return null;
      
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
        // Domain not found or no TXT records - this is expected for domains without DMARC
        this.logger.debug(`No DMARC record found for domain: ${domain} (${error.code})`);
        return null;
      }
      
      // Other DNS errors (timeouts, server errors, etc.)
      this.logger.error(`DNS lookup failed for domain ${domain}:`, error);
      throw new Error(`DNS lookup failed for domain ${domain}: ${error.message}`);
    }
  }
}