import { Test, TestingModule } from '@nestjs/testing';
import { IpBlockerService } from './ip-blocker.service';

describe('IpBlockerService', () => {
  let service: IpBlockerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IpBlockerService],
    }).compile();

    service = module.get<IpBlockerService>(IpBlockerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hasVoted', () => {
    it('should return false for new IP/domain combination', () => {
      const result = service.hasVoted('192.168.1.1', 'example.com');
      expect(result).toBe(false);
    });

    it('should return true after recording a vote', () => {
      const ip = '192.168.1.1';
      const domain = 'example.com';
      
      service.recordVote(ip, domain);
      const result = service.hasVoted(ip, domain);
      
      expect(result).toBe(true);
    });

    it('should handle different IP addresses for same domain', () => {
      const domain = 'example.com';
      
      service.recordVote('192.168.1.1', domain);
      
      expect(service.hasVoted('192.168.1.1', domain)).toBe(true);
      expect(service.hasVoted('192.168.1.2', domain)).toBe(false);
    });

    it('should handle same IP address for different domains', () => {
      const ip = '192.168.1.1';
      
      service.recordVote(ip, 'example.com');
      
      expect(service.hasVoted(ip, 'example.com')).toBe(true);
      expect(service.hasVoted(ip, 'test.com')).toBe(false);
    });
  });

  describe('recordVote', () => {
    it('should record a vote for IP/domain combination', () => {
      const ip = '192.168.1.1';
      const domain = 'example.com';
      
      expect(service.hasVoted(ip, domain)).toBe(false);
      
      service.recordVote(ip, domain);
      
      expect(service.hasVoted(ip, domain)).toBe(true);
    });

    it('should handle multiple votes from same IP for different domains', () => {
      const ip = '192.168.1.1';
      
      service.recordVote(ip, 'example.com');
      service.recordVote(ip, 'test.com');
      
      expect(service.hasVoted(ip, 'example.com')).toBe(true);
      expect(service.hasVoted(ip, 'test.com')).toBe(true);
    });

    it('should handle multiple votes from different IPs for same domain', () => {
      const domain = 'example.com';
      
      service.recordVote('192.168.1.1', domain);
      service.recordVote('192.168.1.2', domain);
      
      expect(service.hasVoted('192.168.1.1', domain)).toBe(true);
      expect(service.hasVoted('192.168.1.2', domain)).toBe(true);
    });
  });

  describe('clearAllVotes', () => {
    it('should clear all recorded votes', () => {
      // Record some votes
      service.recordVote('192.168.1.1', 'example.com');
      service.recordVote('192.168.1.2', 'test.com');
      
      expect(service.hasVoted('192.168.1.1', 'example.com')).toBe(true);
      expect(service.hasVoted('192.168.1.2', 'test.com')).toBe(true);
      
      // Clear all votes
      service.clearAllVotes();
      
      expect(service.hasVoted('192.168.1.1', 'example.com')).toBe(false);
      expect(service.hasVoted('192.168.1.2', 'test.com')).toBe(false);
    });

    it('should reset vote count to zero', () => {
      service.recordVote('192.168.1.1', 'example.com');
      service.recordVote('192.168.1.2', 'test.com');
      
      expect(service.getVoteCount()).toBe(2);
      
      service.clearAllVotes();
      
      expect(service.getVoteCount()).toBe(0);
    });
  });

  describe('getVoteCount', () => {
    it('should return zero for new service', () => {
      expect(service.getVoteCount()).toBe(0);
    });

    it('should return correct count after recording votes', () => {
      service.recordVote('192.168.1.1', 'example.com');
      expect(service.getVoteCount()).toBe(1);
      
      service.recordVote('192.168.1.2', 'example.com');
      expect(service.getVoteCount()).toBe(2);
      
      service.recordVote('192.168.1.1', 'test.com');
      expect(service.getVoteCount()).toBe(3);
    });

    it('should not increment count for duplicate votes', () => {
      const ip = '192.168.1.1';
      const domain = 'example.com';
      
      service.recordVote(ip, domain);
      expect(service.getVoteCount()).toBe(1);
      
      // Recording same vote again should not increment count
      service.recordVote(ip, domain);
      expect(service.getVoteCount()).toBe(1);
    });
  });

  describe('performance characteristics', () => {
    it('should provide constant-time lookup performance', () => {
      // Add a large number of votes to test performance
      const startTime = Date.now();
      
      for (let i = 0; i < 10000; i++) {
        service.recordVote(`192.168.1.${i % 255}`, `domain${i}.com`);
      }
      
      const recordTime = Date.now() - startTime;
      
      // Test lookup performance
      const lookupStartTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        service.hasVoted(`192.168.1.${i % 255}`, `domain${i}.com`);
      }
      
      const lookupTime = Date.now() - lookupStartTime;
      
      // These are rough performance checks - actual times will vary
      // but should be very fast for Set operations
      expect(recordTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(lookupTime).toBeLessThan(100);  // Lookups should be very fast
    });
  });
});