import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { DomainDocument, ValidationResult } from './models/domain.model';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firestore: admin.firestore.Firestore;

  onModuleInit() {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const projectId = process.env.FIREBASE_PROJECT_ID;

      if (serviceAccountPath && projectId) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
          projectId: projectId,
        });
      } else {
        // For development/testing, use default credentials or emulator
        admin.initializeApp({
          projectId: projectId || 'dmarc-portal-dev',
        });
      }
    }

    this.firestore = admin.firestore();
  }

  getFirestore(): admin.firestore.Firestore {
    return this.firestore;
  }

  getDomainsCollection(): admin.firestore.CollectionReference {
    return this.firestore.collection('domains');
  }

  /**
   * Create a new domain document
   */
  async createDomain(validationResult: ValidationResult): Promise<void> {
    try {
      const now = admin.firestore.Timestamp.now();
      const domainDoc: DomainDocument = {
        domain: validationResult.domain,
        dmarcRecord: validationResult.dmarcRecord,
        isValid: validationResult.isValid,
        issues: validationResult.issues,
        lastChecked: admin.firestore.Timestamp.fromDate(validationResult.checkTimestamp),
        upvotes: 0,
        createdAt: now,
        updatedAt: now,
      };

      await this.getDomainsCollection().doc(validationResult.domain).set(domainDoc);
      this.logger.log(`Created domain document for: ${validationResult.domain}`);
    } catch (error) {
      this.logger.error(`Failed to create domain document for ${validationResult.domain}:`, error);
      throw error;
    }
  }

  /**
   * Get a domain document by domain name
   */
  async getDomain(domain: string): Promise<DomainDocument | null> {
    try {
      const doc = await this.getDomainsCollection().doc(domain).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data() as DomainDocument;
    } catch (error) {
      this.logger.error(`Failed to get domain document for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing domain document
   */
  async updateDomain(validationResult: ValidationResult): Promise<void> {
    try {
      const updateData: Partial<DomainDocument> = {
        dmarcRecord: validationResult.dmarcRecord,
        isValid: validationResult.isValid,
        issues: validationResult.issues,
        lastChecked: admin.firestore.Timestamp.fromDate(validationResult.checkTimestamp),
        updatedAt: admin.firestore.Timestamp.now(),
      };

      await this.getDomainsCollection().doc(validationResult.domain).update(updateData);
      this.logger.log(`Updated domain document for: ${validationResult.domain}`);
    } catch (error) {
      this.logger.error(`Failed to update domain document for ${validationResult.domain}:`, error);
      throw error;
    }
  }

  /**
   * Delete a domain document
   */
  async deleteDomain(domain: string): Promise<void> {
    try {
      await this.getDomainsCollection().doc(domain).delete();
      this.logger.log(`Deleted domain document for: ${domain}`);
    } catch (error) {
      this.logger.error(`Failed to delete domain document for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Get all non-compliant domains (isValid = false)
   */
  async getNonCompliantDomains(): Promise<DomainDocument[]> {
    try {
      const snapshot = await this.getDomainsCollection()
        .where('isValid', '==', false)
        .orderBy('upvotes', 'desc')
        .orderBy('lastChecked', 'desc')
        .get();

      return snapshot.docs.map(doc => doc.data() as DomainDocument);
    } catch (error) {
      this.logger.error('Failed to get non-compliant domains:', error);
      throw error;
    }
  }

  /**
   * Increment upvotes for a domain
   */
  async incrementUpvotes(domain: string): Promise<number> {
    try {
      const docRef = this.getDomainsCollection().doc(domain);
      const result = await this.firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        if (!doc.exists) {
          throw new Error(`Domain ${domain} not found`);
        }

        const currentUpvotes = (doc.data() as DomainDocument).upvotes || 0;
        const newUpvotes = currentUpvotes + 1;

        transaction.update(docRef, {
          upvotes: newUpvotes,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        return newUpvotes;
      });

      this.logger.log(`Incremented upvotes for ${domain} to ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to increment upvotes for ${domain}:`, error);
      throw error;
    }
  }
}