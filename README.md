# DMARC Portal System

A publicly accessible web application that helps organizations and individuals check domain DMARC configurations, provides educational content, and maintains a public registry of domains with inadequate DMARC protection.

## Project Structure

```
├── backend/          # NestJS backend API
│   ├── src/         # Source code
│   ├── test/        # E2E tests
│   └── package.json # Backend dependencies
├── frontend/         # Next.js frontend
│   ├── src/         # Source code
│   └── package.json # Frontend dependencies
└── README.md        # This file
```

## Technology Stack

### Backend
- **Framework**: NestJS with TypeScript
- **Database**: Firebase Firestore
- **Testing**: Jest + fast-check for property-based testing
- **DNS**: Node.js built-in dns module

### Frontend
- **Framework**: Next.js with TypeScript
- **Styling**: Tailwind CSS
- **Components**: Custom UGS (UI component system)
- **Testing**: Jest + React Testing Library + fast-check

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project (for production)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase configuration
   ```

4. Run development server:
   ```bash
   npm run start:dev
   ```

5. Run tests:
   ```bash
   npm test
   ```

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment file and configure:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your backend URL
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Run tests:
   ```bash
   npm test
   ```

## Development

### Backend Development
- API endpoints will be available at `http://localhost:3001`
- Health check: `GET /health`
- API documentation: Available after implementing OpenAPI/Swagger

### Frontend Development  
- Web interface available at `http://localhost:3000`
- Hot reload enabled for development
- Tailwind CSS for styling

### Testing
Both projects include:
- Unit tests with Jest
- Property-based tests with fast-check
- Integration/E2E tests
- Test coverage reporting

## Firebase Configuration

For production deployment, you'll need:
1. Firebase project with Firestore enabled
2. Service account key for backend authentication
3. Firestore security rules configured for public read access

## Contributing

1. Follow the implementation tasks in `.kiro/specs/dmarc-portal/tasks.md`
2. Run tests before submitting changes
3. Ensure TypeScript compilation passes
4. Follow the established code style

## License

See LICENSE file for details.