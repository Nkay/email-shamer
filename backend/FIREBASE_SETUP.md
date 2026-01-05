# Firebase Setup Guide

## Overview

The DMARC Portal backend uses Firebase Firestore for data persistence. This guide explains how to set up Firebase credentials and deploy the required indexes.

## Prerequisites

- Firebase project created (project ID: `mail-shamer`)
- Firebase service account credentials file
- Firebase CLI installed (optional, for index deployment)

## Credentials Setup

### Option 1: Service Account File (Recommended)

1. Place your Firebase service account credentials file in the project root as `mail-shamer-firebase-secrets.json`
2. The application will automatically detect and use this file
3. Ensure the file contains all required fields:
   - `project_id`
   - `private_key`
   - `client_email`

### Option 2: Environment Variables

Set the following environment variables:
```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/your/service-account.json
FIREBASE_PROJECT_ID=mail-shamer
```

## Startup Validation

The application includes startup validation that will:
- ✅ Check if credentials file exists
- ✅ Validate required fields in the credentials
- ✅ Fail gracefully with helpful error messages if credentials are missing
- ✅ Log successful initialization with project ID

## Firestore Indexes

The application requires composite indexes for efficient queries. The required indexes are defined in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "domains",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isValid",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "upvotes",
          "order": "DESCENDING"
        },
        {
          "fieldPath": "lastChecked",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

### Deploying Indexes

#### Option 1: Firebase CLI (Recommended)
```bash
firebase deploy --only firestore:indexes
```

#### Option 2: Firebase Console
If you see an error about missing indexes, the error message will include a direct link to create the required index in the Firebase Console.

## Testing Firebase Integration

Run the comprehensive test suite to verify Firebase integration:

```bash
npm test
npm run test:e2e
```

## Troubleshooting

### Application Won't Start
- **Error**: "Firebase credentials file not found"
- **Solution**: Ensure `mail-shamer-firebase-secrets.json` exists in the project root

### Missing Index Errors
- **Error**: "The query requires an index"
- **Solution**: Deploy Firestore indexes using Firebase CLI or create them via the provided console link

### Permission Errors
- **Error**: "Permission denied"
- **Solution**: Verify your service account has the following roles:
  - Firebase Admin SDK Administrator Service Agent
  - Cloud Datastore User

## Security Notes

- ⚠️ Never commit the credentials file to version control
- ⚠️ The credentials file is already added to `.gitignore`
- ✅ Use environment variables in production
- ✅ Rotate service account keys regularly

## Data Model

The application uses the following Firestore collections:

### `/domains/{domainId}`
```typescript
interface DomainDocument {
  domain: string;
  dmarcRecord: string | null;
  isValid: boolean;
  issues: ValidationIssue[];
  lastChecked: Timestamp;
  upvotes: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Performance Considerations

- ✅ Caching layer reduces Firestore reads
- ✅ Composite indexes optimize query performance
- ✅ Transactions ensure data consistency for upvotes
- ✅ TTL-based cache expiration keeps data fresh