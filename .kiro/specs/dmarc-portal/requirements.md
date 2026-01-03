# Requirements Document

## Introduction

The Shamer DMARC Portal is a publicly accessible web application that helps organizations and individuals check domain DMARC configurations. The system validates DMARC records, provides educational content about proper configuration, and maintains a public registry of domains with inadequate DMARC protection. The portal aims to improve email security across the internet by making DMARC validation accessible and educational.

## Glossary

- **DMARC_Portal**: The complete web application system including frontend and backend
- **Domain_Checker**: The backend service responsible for DMARC record validation
- **Portal_Frontend**: The public web interface for domain checking and information
- **DMARC_Record**: DNS record that specifies email authentication policies
- **Domain_Registry**: The stored collection of checked domains and their validation results
- **Upvote_System**: The mechanism allowing users to vote on domain importance
- **IP_Blocker**: The in-memory system preventing duplicate votes from same IP addresses

## Requirements

### Requirement 1: Public Domain Validation Interface

**User Story:** As a domain administrator, I want to check my domain's DMARC configuration through a public portal, so that I can identify and fix email security issues.

#### Acceptance Criteria

1. WHEN a user submits a domain name, THE DMARC_Portal SHALL validate the domain format and perform DMARC record lookup
2. WHEN a DMARC record is found, THE Domain_Checker SHALL evaluate its configuration against security best practices
3. WHEN a DMARC record is missing or misconfigured, THE Portal_Frontend SHALL display the current record and explain the specific issues
4. WHEN a domain has proper DMARC configuration, THE DMARC_Portal SHALL confirm compliance and provide validation details
5. THE Portal_Frontend SHALL be accessible without any authentication or authorization requirements

### Requirement 2: Educational Content System

**User Story:** As a system administrator, I want to learn about proper DMARC configuration, so that I can implement secure email policies for my organization.

#### Acceptance Criteria

1. THE Portal_Frontend SHALL provide an informational page describing correct DMARC setup procedures
2. THE Portal_Frontend SHALL explain required configuration steps for implementing DMARC
3. THE Portal_Frontend SHALL document security risks associated with missing or misconfigured DMARC records
4. THE Portal_Frontend SHALL document deliverability risks associated with improper DMARC policies
5. WHEN users access educational content, THE Portal_Frontend SHALL present information in a clear, structured format

### Requirement 3: Public Domain Registry

**User Story:** As a security researcher, I want to view a list of domains with DMARC issues, so that I can understand the scope of email security problems and track improvements.

#### Acceptance Criteria

1. THE Portal_Frontend SHALL display a public list of all domains that have been checked and found non-compliant
2. WHEN displaying domain entries, THE Portal_Frontend SHALL show domain name, check date, and current DMARC status
3. WHEN a user clicks on a domain entry, THE Portal_Frontend SHALL display detailed validation results and explanations
4. THE Portal_Frontend SHALL provide a button to trigger re-checking of any listed domain
5. WHEN a re-check confirms DMARC compliance, THE DMARC_Portal SHALL remove the domain from the non-compliant list

### Requirement 4: Community Voting System

**User Story:** As a community member, I want to upvote important domains in the registry, so that critical domains with DMARC issues receive more attention.

#### Acceptance Criteria

1. WHEN viewing the domain registry, THE Portal_Frontend SHALL display upvote buttons for each domain entry
2. WHEN a user clicks an upvote button, THE DMARC_Portal SHALL increment the vote count for that domain
3. THE Portal_Frontend SHALL display current vote counts for each domain in the registry
4. THE Portal_Frontend SHALL sort domain entries by vote count to prioritize highly-voted domains
5. WHEN domains have equal vote counts, THE Portal_Frontend SHALL use check date as secondary sorting criteria

### Requirement 5: IP-Based Vote Limiting

**User Story:** As a system administrator, I want to prevent vote manipulation, so that the community voting system remains fair and representative.

#### Acceptance Criteria

1. WHEN a user attempts to vote, THE IP_Blocker SHALL check if the IP address has already voted for that specific domain
2. IF an IP address has already voted for a domain, THEN THE DMARC_Portal SHALL reject the additional vote attempt
3. THE IP_Blocker SHALL store voting restrictions only in server memory using efficient data structures
4. WHEN the server restarts, THE IP_Blocker SHALL reset all voting restrictions to allow fresh voting
5. THE IP_Blocker SHALL use constant-time lookup operations to minimize performance impact

### Requirement 6: Backend DMARC Validation

**User Story:** As the system, I want to efficiently validate DMARC records, so that I can provide accurate results while minimizing external DNS queries.

#### Acceptance Criteria

1. WHEN receiving a domain validation request, THE Domain_Checker SHALL first query its internal Domain_Registry
2. IF a domain was previously checked and results are current, THEN THE Domain_Checker SHALL return cached results
3. IF a domain is not cached or results are outdated, THEN THE Domain_Checker SHALL perform DNS DMARC record lookup
4. WHEN performing DMARC lookup, THE Domain_Checker SHALL evaluate record syntax, policy settings, and security effectiveness
5. THE Domain_Checker SHALL store validation results in the Domain_Registry with timestamp for future reference

### Requirement 7: Technology Stack Implementation

**User Story:** As a developer, I want to use modern, type-safe technologies, so that the system is maintainable and reliable.

#### Acceptance Criteria

1. THE Portal_Frontend SHALL be implemented using TypeScript for type safety
2. THE Portal_Frontend SHALL use Tailwind CSS for styling and responsive design
3. THE Portal_Frontend SHALL use UGS (UI component system) for consistent interface components
4. THE Domain_Checker SHALL be implemented using TypeScript and NestJS framework
5. THE Domain_Registry SHALL use Firebase as the persistence layer for domain data and metadata

### Requirement 8: Data Persistence and Caching

**User Story:** As the system, I want to efficiently manage domain data, so that I can provide fast responses while maintaining data accuracy.

#### Acceptance Criteria

1. WHEN storing domain validation results, THE Domain_Checker SHALL include domain name, DMARC record content, validation status, and check timestamp
2. THE Domain_Registry SHALL persist upvote counts and voting metadata for each domain entry
3. WHEN determining if cached data is current, THE Domain_Checker SHALL use configurable cache expiration periods
4. THE Domain_Registry SHALL support efficient queries for domain lookup, registry listing, and vote counting
5. WHEN the system experiences high load, THE Domain_Registry SHALL maintain consistent performance for read and write operations