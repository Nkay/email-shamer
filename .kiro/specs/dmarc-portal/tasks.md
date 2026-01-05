# Implementation Plan: DMARC Portal System

## Overview

This implementation plan breaks down the DMARC Portal system into discrete, manageable coding tasks. The approach follows a backend-first strategy to establish core validation logic, followed by frontend development, and concludes with integration and testing. Each task builds incrementally on previous work to ensure a working system at each checkpoint.

## Tasks

- [x] 1. Set up project structure and core dependencies
  - Create NestJS backend project with TypeScript configuration
  - Create frontend project with TypeScript, Tailwind CSS, and UGS components
  - Configure Firebase project and connection settings
  - Set up testing frameworks (Jest, fast-check)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Implement core DMARC validation logic
  - [x] 2.1 Create DNS lookup service with domain format validation
    - Implement DnsService interface with Node.js dns module
    - Add domain format validation using regex patterns
    - Handle DNS lookup errors and timeouts
    - _Requirements: 1.1, 6.3_

  - [x] 2.2 Write property test for DNS lookup service
    - **Property 1: Domain validation completeness**
    - **Validates: Requirements 1.1**

  - [x] 2.3 Create DMARC record parser and validator
    - Implement DmarcValidator interface for parsing DMARC TXT records
    - Add validation logic for DMARC policy syntax and security best practices
    - Generate detailed validation issues and recommendations
    - _Requirements: 1.2, 1.4, 6.4_

  - [x] 2.4 Write property test for DMARC validation
    - **Property 7: DMARC evaluation thoroughness**
    - **Validates: Requirements 6.4**

- [x] 3. Implement data persistence layer
  - [x] 3.1 Create Firebase service and domain data models
    - Set up Firebase Admin SDK integration with NestJS
    - Define DomainDocument interface and Firestore collections
    - Implement basic CRUD operations for domain data
    - _Requirements: 7.5, 8.1_

  - [x] 3.2 Implement domain registry service
    - Create DomainRegistry service with caching logic
    - Add methods for storing and retrieving validation results
    - Implement upvote counting and domain listing functionality
    - _Requirements: 6.1, 6.2, 6.5, 8.2_

  - [x] 3.3 Write property test for data persistence
    - **Property 8: Data persistence completeness**
    - **Validates: Requirements 6.5, 8.1, 8.2**

- [x] 4. Implement caching and performance optimization
  - [x] 4.1 Create in-memory cache service
    - Implement cache with TTL (time-to-live) expiration
    - Add cache-first lookup strategy for domain validation
    - Configure cache expiration periods
    - _Requirements: 6.1, 6.2, 8.3_

  - [x] 4.2 Write property test for cache behavior
    - **Property 6: Cache-first lookup strategy**
    - **Property 9: Cache expiration consistency**
    - **Validates: Requirements 6.1, 6.2, 6.3, 8.3**

- [x] 5. Implement voting system with IP restrictions
  - [x] 5.1 Create IP blocking service
    - Implement IpBlocker service using in-memory Set for vote tracking
    - Add methods for checking and recording votes per IP/domain combination
    - Ensure constant-time lookup performance
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Integrate voting with domain registry
    - Add upvote endpoints to NestJS controllers
    - Implement vote validation and duplicate prevention
    - Update domain sorting by vote count and check date
    - _Requirements: 4.2, 4.4, 4.5_

  - [x] 5.3 Write property test for voting system
    - **Property 4: Vote management integrity**
    - **Property 5: Registry sorting consistency**
    - **Validates: Requirements 4.2, 4.4, 4.5, 5.1, 5.2**

- [-] 6. Create backend API endpoints
  - [ ] 6.1 Implement domain validation endpoints
    - Create POST /api/domains/validate endpoint for domain checking
    - Add GET /api/domains/registry endpoint for listing non-compliant domains
    - Implement POST /api/domains/{domain}/recheck for re-validation
    - _Requirements: 1.1, 3.1, 3.5_

  - [ ] 6.2 Implement voting and interaction endpoints
    - Create POST /api/domains/{domain}/upvote endpoint
    - Add GET /api/domains/{domain}/details endpoint for detailed results
    - Ensure all endpoints are publicly accessible (no authentication)
    - _Requirements: 1.5, 3.3, 4.2_

  - [ ] 6.3 Write integration tests for API endpoints
    - Test complete domain validation workflow
    - Test voting and registry management
    - _Requirements: 1.1, 3.1, 4.2_

- [ ] 7. Checkpoint - Backend validation and testing
  - Ensure all backend tests pass
  - Verify Firebase integration works correctly
  - Test DNS lookup and DMARC validation with real domains
  - Ask the user if questions arise

- [ ] 8. Implement frontend domain checking interface
  - [ ] 8.1 Create domain submission form component
    - Build TypeScript React component with Tailwind CSS styling
    - Add form validation and error handling
    - Implement domain submission to backend API
    - _Requirements: 1.1, 7.1, 7.2_

  - [ ] 8.2 Create validation result display component
    - Display DMARC validation results with issue explanations
    - Show current DMARC record or indicate if missing
    - Format validation issues with severity levels and recommendations
    - _Requirements: 1.3, 1.4_

  - [ ] 8.3 Write property test for result display
    - **Property 11: Issue explanation completeness**
    - **Validates: Requirements 1.3**

- [ ] 9. Implement domain registry and voting interface
  - [ ] 9.1 Create domain registry list component
    - Display list of non-compliant domains with required information
    - Show domain name, check date, DMARC status, and vote counts
    - Implement sorting by votes and check date
    - _Requirements: 3.1, 3.2_

  - [ ] 9.2 Add voting and interaction features
    - Implement upvote buttons for each domain entry
    - Add recheck buttons to trigger domain re-validation
    - Handle click events for detailed domain information display
    - _Requirements: 3.3, 3.4, 4.1_

  - [ ] 9.3 Write property test for registry display
    - **Property 2: Non-compliant domain display accuracy**
    - **Property 3: Domain entry information completeness**
    - **Validates: Requirements 3.1, 3.2, 3.4, 4.1, 4.3**

- [ ] 10. Create educational content pages
  - [ ] 10.1 Implement DMARC education page
    - Create informational page describing correct DMARC setup
    - Document required configuration steps and best practices
    - Explain security and deliverability risks of misconfiguration
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 10.2 Write unit tests for educational content
    - Test that required educational content is present
    - Verify page accessibility and structure
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 11. Implement error handling and user experience
  - [ ] 11.1 Add comprehensive error handling
    - Handle DNS lookup failures and network timeouts
    - Manage Firebase connection errors and retry logic
    - Provide user-friendly error messages for all failure scenarios
    - _Requirements: Error handling from design_

  - [ ] 11.2 Add loading states and user feedback
    - Implement loading indicators for domain validation
    - Add success/error notifications for user actions
    - Ensure responsive design works across devices
    - _Requirements: 7.2_

- [ ] 12. Integration and end-to-end testing
  - [ ] 12.1 Wire frontend and backend together
    - Connect all frontend components to backend APIs
    - Test complete user workflows from domain submission to results
    - Verify voting system works end-to-end
    - _Requirements: All integration requirements_

  - [ ] 12.2 Write end-to-end property tests
    - **Property 10: Public accessibility**
    - **Property 12: Detailed validation display**
    - **Validates: Requirements 1.5, 3.3**

- [ ] 13. Final checkpoint and deployment preparation
  - Ensure all tests pass (unit, property, and integration)
  - Verify system performance meets requirements
  - Test with real DMARC records and domains
  - Ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- The implementation follows backend-first approach for solid foundation
- All testing tasks are required for comprehensive quality assurance