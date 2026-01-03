import { Timestamp } from 'firebase-admin/firestore';

export interface ValidationIssue {
  type: 'missing_record' | 'syntax_error' | 'weak_policy' | 'alignment_issue';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommendation: string;
}

export interface DomainDocument {
  domain: string;
  dmarcRecord: string | null;
  isValid: boolean;
  issues: ValidationIssue[];
  lastChecked: Timestamp;
  upvotes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ValidationResult {
  domain: string;
  dmarcRecord: string | null;
  isValid: boolean;
  issues: ValidationIssue[];
  checkTimestamp: Date;
}

export interface DomainEntry {
  domain: string;
  lastChecked: Date;
  upvotes: number;
  dmarcStatus: 'missing' | 'invalid' | 'weak';
  validationResult: ValidationResult;
}