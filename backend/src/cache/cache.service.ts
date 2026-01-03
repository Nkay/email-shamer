import { Injectable, Logger } from '@nestjs/common';

export interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTtlMinutes = 60; // 1 hour default TTL

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, ttlMinutes?: number): void {
    const ttl = ttlMinutes || this.defaultTtlMinutes;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + ttl);

    this.cache.set(key, {
      data,
      expiresAt,
    });

    this.logger.debug(`Cached data for key: ${key}, expires at: ${expiresAt.toISOString()}`);
  }

  /**
   * Get data from cache if not expired, with explicit cache hit/miss information
   */
  getWithInfo<T>(key: string): { found: boolean; data: T | null } {
    const entry = this.cache.get(key);

    if (!entry) {
      this.logger.debug(`Cache miss for key: ${key}`);
      return { found: false, data: null };
    }

    if (new Date() > entry.expiresAt) {
      // Cache expired
      this.cache.delete(key);
      this.logger.debug(`Cache expired for key: ${key}`);
      return { found: false, data: null };
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return { found: true, data: entry.data as T };
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    const result = this.getWithInfo<T>(key);
    return result.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (new Date() > entry.expiresAt) {
      // Cache expired
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Deleted cache entry for key: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cleared cache, removed ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[]; expiredKeys: string[] } {
    const now = new Date();
    const keys: string[] = [];
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      } else {
        keys.push(key);
      }
    }

    return {
      size: this.cache.size,
      keys,
      expiredKeys,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired cache entries`);
    }

    return cleanedCount;
  }

  /**
   * Get or set pattern - if key exists return it, otherwise compute and cache
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlMinutes?: number,
  ): Promise<T> {
    const result = this.getWithInfo<T>(key);
    if (result.found) {
      return result.data as T;
    }

    const computed = await computeFn();
    this.set(key, computed, ttlMinutes);
    return computed;
  }
}