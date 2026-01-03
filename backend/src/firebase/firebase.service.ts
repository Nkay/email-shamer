import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
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
}