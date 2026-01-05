import { Injectable } from '@nestjs/common';

@Injectable()
export class IpBlockerService {
  private readonly voteRestrictions: Set<string> = new Set();

  /**
   * Check if an IP address has already voted for a specific domain
   * @param ipAddress The IP address to check
   * @param domain The domain to check voting for
   * @returns true if the IP has already voted for this domain
   */
  hasVoted(ipAddress: string, domain: string): boolean {
    const voteKey = this.createVoteKey(ipAddress, domain);
    return this.voteRestrictions.has(voteKey);
  }

  /**
   * Record a vote from an IP address for a specific domain
   * @param ipAddress The IP address that is voting
   * @param domain The domain being voted for
   */
  recordVote(ipAddress: string, domain: string): void {
    const voteKey = this.createVoteKey(ipAddress, domain);
    this.voteRestrictions.add(voteKey);
  }

  /**
   * Clear all voting restrictions (called on server restart)
   */
  clearAllVotes(): void {
    this.voteRestrictions.clear();
  }

  /**
   * Get the total number of vote restrictions currently stored
   * @returns The number of IP/domain combinations that have voted
   */
  getVoteCount(): number {
    return this.voteRestrictions.size;
  }

  /**
   * Create a unique key for IP/domain combination
   * Uses constant-time lookup with Set data structure
   * @param ipAddress The IP address
   * @param domain The domain
   * @returns A unique key string for the IP/domain combination
   */
  private createVoteKey(ipAddress: string, domain: string): string {
    return `${ipAddress}:${domain}`;
  }
}