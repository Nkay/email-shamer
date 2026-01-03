import { Injectable, Logger } from '@nestjs/common';

export interface ValidationIssue {
  type: 'missing_record' | 'syntax_error' | 'weak_policy' | 'alignment_issue' | 'configuration_issue';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

export interface DmarcPolicy {
  version: string;
  policy: 'none' | 'quarantine' | 'reject';
  subdomainPolicy?: 'none' | 'quarantine' | 'reject';
  percentage?: number;
  reportingAddresses?: string[];
  alignment?: {
    spf: 'relaxed' | 'strict';
    dkim: 'relaxed' | 'strict';
  };
  rawRecord: string;
}

export interface ValidationResult {
  domain: string;
  dmarcRecord: string | null;
  isValid: boolean;
  issues: ValidationIssue[];
  checkTimestamp: Date;
  parsedPolicy?: DmarcPolicy;
}

export interface DmarcValidator {
  validateDomain(domain: string): Promise<ValidationResult>;
  parseDmarcRecord(record: string): DmarcPolicy;
  evaluatePolicy(policy: DmarcPolicy): ValidationIssue[];
}

@Injectable()
export class DmarcValidatorImpl implements DmarcValidator {
  private readonly logger = new Logger(DmarcValidatorImpl.name);

  /**
   * Validates a domain's DMARC configuration
   * @param domain The domain to validate
   * @returns Complete validation result
   */
  async validateDomain(domain: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      domain,
      dmarcRecord: null,
      isValid: false,
      issues: [],
      checkTimestamp: new Date(),
    };

    // This method will be completed when we integrate with DNS service
    // For now, it's a placeholder that will be implemented in integration tasks
    throw new Error('validateDomain not yet implemented - requires DNS service integration');
  }

  /**
   * Parses a DMARC record string into a structured policy object
   * @param record The DMARC record string
   * @returns Parsed DMARC policy
   */
  parseDmarcRecord(record: string): DmarcPolicy {
    if (!record || typeof record !== 'string') {
      throw new Error('Invalid DMARC record: record must be a non-empty string');
    }

    const cleanRecord = record.trim();
    if (!cleanRecord.startsWith('v=DMARC1')) {
      throw new Error('Invalid DMARC record: must start with v=DMARC1');
    }

    const policy: DmarcPolicy = {
      version: 'DMARC1',
      policy: 'none', // Default
      rawRecord: cleanRecord,
    };

    // Parse key-value pairs separated by semicolons
    const pairs = cleanRecord.split(';').map(pair => pair.trim()).filter(pair => pair.length > 0);

    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(part => part.trim());
      
      if (!key || value === undefined) {
        continue; // Skip malformed pairs
      }

      switch (key.toLowerCase()) {
        case 'v':
          if (value !== 'DMARC1') {
            throw new Error(`Invalid DMARC version: ${value}`);
          }
          policy.version = value;
          break;

        case 'p':
          if (!['none', 'quarantine', 'reject'].includes(value)) {
            throw new Error(`Invalid policy value: ${value}`);
          }
          policy.policy = value as 'none' | 'quarantine' | 'reject';
          break;

        case 'sp':
          if (!['none', 'quarantine', 'reject'].includes(value)) {
            throw new Error(`Invalid subdomain policy value: ${value}`);
          }
          policy.subdomainPolicy = value as 'none' | 'quarantine' | 'reject';
          break;

        case 'pct':
          const percentage = parseInt(value, 10);
          if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            throw new Error(`Invalid percentage value: ${value}`);
          }
          policy.percentage = percentage;
          break;

        case 'rua':
        case 'ruf':
          if (!policy.reportingAddresses) {
            policy.reportingAddresses = [];
          }
          // Parse comma-separated email addresses
          const addresses = value.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
          policy.reportingAddresses.push(...addresses);
          break;

        case 'adkim':
          if (!policy.alignment) {
            policy.alignment = { spf: 'relaxed', dkim: 'relaxed' };
          }
          if (!['r', 's', 'relaxed', 'strict'].includes(value)) {
            throw new Error(`Invalid DKIM alignment value: ${value}`);
          }
          policy.alignment.dkim = value === 's' || value === 'strict' ? 'strict' : 'relaxed';
          break;

        case 'aspf':
          if (!policy.alignment) {
            policy.alignment = { spf: 'relaxed', dkim: 'relaxed' };
          }
          if (!['r', 's', 'relaxed', 'strict'].includes(value)) {
            throw new Error(`Invalid SPF alignment value: ${value}`);
          }
          policy.alignment.spf = value === 's' || value === 'strict' ? 'strict' : 'relaxed';
          break;

        // Ignore other tags (fo, rf, ri) for now
        default:
          this.logger.debug(`Ignoring unknown DMARC tag: ${key}=${value}`);
          break;
      }
    }

    return policy;
  }

  /**
   * Evaluates a parsed DMARC policy for security best practices
   * @param policy The parsed DMARC policy
   * @returns Array of validation issues and recommendations
   */
  evaluatePolicy(policy: DmarcPolicy): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check policy strength
    if (policy.policy === 'none') {
      issues.push({
        type: 'weak_policy',
        severity: 'warning',
        message: 'DMARC policy is set to "none" which provides no protection',
        recommendation: 'Consider upgrading to "quarantine" or "reject" policy for better email security',
      });
    }

    // Check percentage
    if (policy.percentage !== undefined && policy.percentage < 100) {
      issues.push({
        type: 'configuration_issue',
        severity: 'info',
        message: `DMARC policy applies to only ${policy.percentage}% of messages`,
        recommendation: 'Consider setting pct=100 for full protection once you are confident in your configuration',
      });
    }

    // Check for reporting addresses
    if (!policy.reportingAddresses || policy.reportingAddresses.length === 0) {
      issues.push({
        type: 'configuration_issue',
        severity: 'info',
        message: 'No reporting addresses configured (rua/ruf)',
        recommendation: 'Add reporting addresses to receive DMARC reports and monitor email authentication',
      });
    }

    // Check subdomain policy
    if (!policy.subdomainPolicy) {
      issues.push({
        type: 'configuration_issue',
        severity: 'info',
        message: 'No explicit subdomain policy set',
        recommendation: 'Consider setting "sp" tag to explicitly control subdomain behavior',
      });
    } else if (policy.subdomainPolicy === 'none' && policy.policy !== 'none') {
      issues.push({
        type: 'weak_policy',
        severity: 'warning',
        message: 'Subdomain policy is weaker than main domain policy',
        recommendation: 'Consider aligning subdomain policy with main domain policy for consistent protection',
      });
    }

    // Check alignment settings
    if (policy.alignment) {
      if (policy.alignment.spf === 'relaxed' && policy.alignment.dkim === 'relaxed') {
        issues.push({
          type: 'alignment_issue',
          severity: 'info',
          message: 'Both SPF and DKIM alignment are set to relaxed',
          recommendation: 'Consider strict alignment for stronger authentication requirements',
        });
      }
    }

    // Validate reporting addresses format
    if (policy.reportingAddresses) {
      for (const address of policy.reportingAddresses) {
        if (!this.isValidEmailFormat(address)) {
          issues.push({
            type: 'syntax_error',
            severity: 'error',
            message: `Invalid reporting address format: ${address}`,
            recommendation: 'Ensure reporting addresses follow the format: mailto:user@domain.com',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Basic email format validation for reporting addresses
   * @param address The email address to validate
   * @returns true if format is valid
   */
  private isValidEmailFormat(address: string): boolean {
    // Handle mailto: prefix
    const cleanAddress = address.startsWith('mailto:') ? address.substring(7) : address;
    
    // Basic email regex - not comprehensive but good enough for DMARC reporting addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(cleanAddress);
  }
}