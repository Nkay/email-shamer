import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import * as fc from 'fast-check';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    service.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      const key = 'test-key';
      const data = { message: 'test data' };

      service.set(key, data);
      const retrieved = service.get(key);

      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      const result = service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect custom TTL', () => {
      const key = 'ttl-test';
      const data = 'test';
      const ttlMinutes = 30;

      service.set(key, data, ttlMinutes);
      const retrieved = service.get(key);

      expect(retrieved).toBe(data);
    });
  });

  describe('expiration', () => {
    it('should return null for expired entries', async () => {
      const key = 'expire-test';
      const data = 'test';
      
      // Set with very short TTL (0.01 minutes = 0.6 seconds)
      service.set(key, data, 0.01);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const result = service.get(key);
      expect(result).toBeNull();
    });

    it('should clean up expired entries', async () => {
      const key1 = 'expire1';
      const key2 = 'expire2';
      const key3 = 'valid';
      
      // Set expired entries
      service.set(key1, 'data1', 0.01);
      service.set(key2, 'data2', 0.01);
      // Set valid entry
      service.set(key3, 'data3', 60);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const cleanedCount = service.cleanup();
      expect(cleanedCount).toBe(2);
      
      const stats = service.getStats();
      expect(stats.keys).toContain(key3);
      expect(stats.keys).not.toContain(key1);
      expect(stats.keys).not.toContain(key2);
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired key', () => {
      const key = 'has-test';
      service.set(key, 'data');
      
      expect(service.has(key)).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(service.has('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      const key = 'expired-has';
      service.set(key, 'data', 0.01);
      
      await new Promise(resolve => setTimeout(resolve, 700));
      
      expect(service.has(key)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing key', () => {
      const key = 'delete-test';
      service.set(key, 'data');
      
      const deleted = service.delete(key);
      expect(deleted).toBe(true);
      expect(service.get(key)).toBeNull();
    });

    it('should return false for non-existent key', () => {
      const deleted = service.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      service.set('key1', 'data1');
      service.set('key2', 'data2');
      
      service.clear();
      
      expect(service.get('key1')).toBeNull();
      expect(service.get('key2')).toBeNull();
      
      const stats = service.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      service.set('key1', 'data1');
      service.set('key2', 'data2');
      
      const stats = service.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
      expect(stats.expiredKeys).toEqual([]);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'getOrSet-test';
      const cachedData = 'cached';
      const computedData = 'computed';
      
      service.set(key, cachedData);
      
      const computeFn = jest.fn().mockResolvedValue(computedData);
      const result = await service.getOrSet(key, computeFn);
      
      expect(result).toBe(cachedData);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('should compute and cache value if not exists', async () => {
      const key = 'getOrSet-compute';
      const computedData = 'computed';
      
      const computeFn = jest.fn().mockResolvedValue(computedData);
      const result = await service.getOrSet(key, computeFn);
      
      expect(result).toBe(computedData);
      expect(computeFn).toHaveBeenCalledTimes(1);
      expect(service.get(key)).toBe(computedData);
    });
  });

  // Property-based tests for cache behavior
  describe('Property 6: Cache-first lookup strategy', () => {
    // Feature: dmarc-portal, Property 6: Cache-first lookup strategy
    it('should always check cache before computing new values', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // key
        fc.anything(), // cached data
        fc.anything(), // computed data
        async (key, cachedData, computedData) => {
          // Clear cache to start fresh
          service.clear();
          
          // Set up cache with data
          service.set(key, cachedData, 60); // 1 hour TTL
          
          // Mock compute function
          const computeFn = jest.fn().mockResolvedValue(computedData);
          
          // Call getOrSet - should return cached value without calling compute function
          const result = await service.getOrSet(key, computeFn);
          
          // Verify cache-first behavior
          expect(result).toEqual(cachedData);
          expect(computeFn).not.toHaveBeenCalled();
        }
      ), { numRuns: 100 });
    });

    // Feature: dmarc-portal, Property 6: Cache-first lookup strategy  
    it('should compute and cache when cache miss occurs', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }), // key
        fc.anything(), // computed data
        async (key, computedData) => {
          // Clear cache to ensure miss
          service.clear();
          
          // Mock compute function
          const computeFn = jest.fn().mockResolvedValue(computedData);
          
          // Call getOrSet - should compute and cache
          const result = await service.getOrSet(key, computeFn);
          
          // Verify compute-and-cache behavior
          expect(result).toEqual(computedData);
          expect(computeFn).toHaveBeenCalledTimes(1);
          expect(service.get(key)).toEqual(computedData);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 9: Cache expiration consistency', () => {
    // Feature: dmarc-portal, Property 9: Cache expiration consistency
    it('should respect TTL and return null for expired entries', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 50 }), // key
        fc.anything(), // data
        fc.integer({ min: 1, max: 10 }), // ttl in minutes
        (key, data, ttlMinutes) => {
          // Clear cache
          service.clear();
          
          // Set data with TTL
          service.set(key, data, ttlMinutes);
          
          // Should be available immediately
          expect(service.get(key)).toEqual(data);
          expect(service.has(key)).toBe(true);
          
          // Manually expire by setting past expiration time
          const cacheEntry = (service as any).cache.get(key);
          if (cacheEntry) {
            cacheEntry.expiresAt = new Date(Date.now() - 1000); // 1 second ago
          }
          
          // Should now be expired
          expect(service.get(key)).toBeNull();
          expect(service.has(key)).toBe(false);
        }
      ), { numRuns: 100 });
    });

    // Feature: dmarc-portal, Property 9: Cache expiration consistency
    it('should maintain consistent expiration behavior across all cache operations', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          key: fc.string({ minLength: 1, maxLength: 20 }),
          data: fc.anything(),
          ttl: fc.integer({ min: 1, max: 60 })
        }), { minLength: 1, maxLength: 10 }),
        (entries) => {
          // Clear cache
          service.clear();
          
          // Set all entries
          entries.forEach(entry => {
            service.set(entry.key, entry.data, entry.ttl);
          });
          
          // All entries should be available
          entries.forEach(entry => {
            expect(service.get(entry.key)).toEqual(entry.data);
            expect(service.has(entry.key)).toBe(true);
          });
          
          // Manually expire all entries
          entries.forEach(entry => {
            const cacheEntry = (service as any).cache.get(entry.key);
            if (cacheEntry) {
              cacheEntry.expiresAt = new Date(Date.now() - 1000);
            }
          });
          
          // All entries should now be expired
          entries.forEach(entry => {
            expect(service.get(entry.key)).toBeNull();
            expect(service.has(entry.key)).toBe(false);
          });
          
          // Cleanup should remove all expired entries
          const cleanedCount = service.cleanup();
          expect(cleanedCount).toBe(entries.length);
          
          const stats = service.getStats();
          expect(stats.size).toBe(0);
        }
      ), { numRuns: 50 });
    });
  });
});