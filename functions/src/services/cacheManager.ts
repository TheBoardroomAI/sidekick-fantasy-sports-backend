import * as admin from 'firebase-admin';

const db = admin.firestore();

interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
  size: number;
}

interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export class CacheManager {
  private static readonly DEFAULT_CONFIG: CacheConfig = {
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    maxSize: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000,
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  };

  private static memoryCache = new Map<string, CacheEntry>();
  private static cacheSize = 0;
  private static lastCleanup = Date.now();

  // Get data from cache
  static async get(key: string): Promise<any | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && memoryEntry.expiresAt > new Date()) {
        // Update access statistics
        memoryEntry.accessCount++;
        memoryEntry.lastAccessed = new Date();
        return memoryEntry.data;
      }

      // Check Firestore cache
      const cacheDoc = await db.collection('cache').doc(key).get();
      
      if (!cacheDoc.exists) {
        return null;
      }

      const cacheData = cacheDoc.data() as CacheEntry;
      
      // Check if expired
      if (cacheData.expiresAt.toDate() <= new Date()) {
        // Clean up expired entry
        await this.delete(key);
        return null;
      }

      // Update access statistics
      await cacheDoc.ref.update({
        accessCount: admin.firestore.FieldValue.increment(1),
        lastAccessed: new Date()
      });

      // Store in memory cache for faster access
      this.setMemoryCache(key, cacheData);

      return cacheData.data;

    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set data in cache
  static async set(
    key: string, 
    data: any, 
    ttl?: number, 
    tags: string[] = []
  ): Promise<boolean> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (ttl || this.DEFAULT_CONFIG.defaultTTL));
      
      // Calculate data size
      const dataSize = this.calculateSize(data);
      
      // Check if data is too large
      if (dataSize > this.DEFAULT_CONFIG.maxSize / 10) {
        console.warn(`Cache entry too large: ${dataSize} bytes for key ${key}`);
        return false;
      }

      const cacheEntry: CacheEntry = {
        key,
        data,
        timestamp: now,
        expiresAt,
        accessCount: 0,
        lastAccessed: now,
        tags,
        size: dataSize
      };

      // Store in Firestore
      await db.collection('cache').doc(key).set(cacheEntry);

      // Store in memory cache
      this.setMemoryCache(key, cacheEntry);

      // Trigger cleanup if needed
      await this.cleanupIfNeeded();

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Delete from cache
  static async delete(key: string): Promise<boolean> {
    try {
      // Remove from memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry) {
        this.cacheSize -= memoryEntry.size;
        this.memoryCache.delete(key);
      }

      // Remove from Firestore
      await db.collection('cache').doc(key).delete();

      return true;

    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Clear cache by tags
  static async clearByTags(tags: string[]): Promise<number> {
    try {
      let deletedCount = 0;

      // Clear from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.cacheSize -= entry.size;
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }

      // Clear from Firestore
      for (const tag of tags) {
        const snapshot = await db.collection('cache')
          .where('tags', 'array-contains', tag)
          .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });

        if (!snapshot.empty) {
          await batch.commit();
        }
      }

      console.log(`Cleared ${deletedCount} cache entries with tags: ${tags.join(', ')}`);
      return deletedCount;

    } catch (error) {
      console.error('Cache clear by tags error:', error);
      return 0;
    }
  }

  // Get or set pattern (cache-aside)
  static async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl?: number,
    tags: string[] = []
  ): Promise<T | null> {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      const freshData = await fetchFunction();
      
      if (freshData !== null && freshData !== undefined) {
        // Store in cache
        await this.set(key, freshData, ttl, tags);
      }

      return freshData;

    } catch (error) {
      console.error('Cache getOrSet error:', error);
      return null;
    }
  }

  // Set memory cache entry
  private static setMemoryCache(key: string, entry: CacheEntry): void {
    // Remove existing entry if present
    const existing = this.memoryCache.get(key);
    if (existing) {
      this.cacheSize -= existing.size;
    }

    // Check memory limits
    if (this.cacheSize + entry.size > this.DEFAULT_CONFIG.maxSize ||
        this.memoryCache.size >= this.DEFAULT_CONFIG.maxEntries) {
      this.evictMemoryCache();
    }

    // Add new entry
    this.memoryCache.set(key, entry);
    this.cacheSize += entry.size;
  }

  // Evict entries from memory cache (LRU)
  private static evictMemoryCache(): void {
    const entries = Array.from(this.memoryCache.entries());
    
    // Sort by last accessed (oldest first)
    entries.sort((a, b) => 
      a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
    );

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [key, entry] = entries[i];
      this.memoryCache.delete(key);
      this.cacheSize -= entry.size;
    }

    console.log(`Evicted ${toRemove} entries from memory cache`);
  }

  // Calculate data size in bytes
  private static calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
    }
  }

  // Cleanup expired entries
  static async cleanup(): Promise<number> {
    try {
      const now = new Date();
      let deletedCount = 0;

      // Clean memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.expiresAt <= now) {
          this.cacheSize -= entry.size;
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }

      // Clean Firestore cache
      const expiredSnapshot = await db.collection('cache')
        .where('expiresAt', '<=', now)
        .limit(500)
        .get();

      if (!expiredSnapshot.empty) {
        const batch = db.batch();
        expiredSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
          deletedCount++;
        });
        await batch.commit();
      }

      this.lastCleanup = Date.now();
      
      if (deletedCount > 0) {
        console.log(`Cache cleanup: removed ${deletedCount} expired entries`);
      }

      return deletedCount;

    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  // Cleanup if needed
  private static async cleanupIfNeeded(): Promise<void> {
    const timeSinceLastCleanup = Date.now() - this.lastCleanup;
    
    if (timeSinceLastCleanup > this.DEFAULT_CONFIG.cleanupInterval) {
      await this.cleanup();
    }
  }

  // Get cache statistics
  static async getStats(): Promise<any> {
    try {
      const memoryStats = {
        entries: this.memoryCache.size,
        sizeBytes: this.cacheSize,
        sizeMB: Math.round(this.cacheSize / (1024 * 1024) * 100) / 100
      };

      // Get Firestore cache stats
      const cacheSnapshot = await db.collection('cache').get();
      const firestoreEntries = cacheSnapshot.docs.map(doc => doc.data() as CacheEntry);
      
      const firestoreStats = {
        entries: firestoreEntries.length,
        totalSize: firestoreEntries.reduce((sum, entry) => sum + entry.size, 0),
        averageAccessCount: firestoreEntries.reduce((sum, entry) => sum + entry.accessCount, 0) / firestoreEntries.length || 0,
        expiredEntries: firestoreEntries.filter(entry => entry.expiresAt.toDate() <= new Date()).length
      };

      return {
        memory: memoryStats,
        firestore: firestoreStats,
        config: this.DEFAULT_CONFIG,
        lastCleanup: new Date(this.lastCleanup)
      };

    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  // Warm cache with frequently accessed data
  static async warmCache(): Promise<void> {
    try {
      console.log('Starting cache warmup...');

      // Warm up common data that's frequently accessed
      const warmupTasks = [
        this.warmupPlayerData(),
        this.warmupPersonaData(),
        this.warmupSubscriptionData()
      ];

      await Promise.allSettled(warmupTasks);
      
      console.log('Cache warmup completed');

    } catch (error) {
      console.error('Cache warmup error:', error);
    }
  }

  // Warmup player data
  private static async warmupPlayerData(): Promise<void> {
    try {
      // This would fetch and cache commonly accessed player data
      // Implementation depends on your data service
      console.log('Warming up player data cache...');
      
      // Example: Cache top players for each position
      const positions = ['QB', 'RB', 'WR', 'TE'];
      
      for (const position of positions) {
        const cacheKey = `players:top:${position}`;
        // This would call your actual data service
        // await this.getOrSet(cacheKey, () => dataService.getTopPlayers(position), 30 * 60 * 1000, ['players', position]);
      }

    } catch (error) {
      console.error('Player data warmup error:', error);
    }
  }

  // Warmup persona data
  private static async warmupPersonaData(): Promise<void> {
    try {
      console.log('Warming up persona data cache...');
      
      // Cache persona configurations
      const personas = ['oracle', 'rebel', 'mentor', 'analyst', 'rookie', 'zane'];
      
      for (const persona of personas) {
        const cacheKey = `persona:config:${persona}`;
        // Cache persona configuration data
        // await this.getOrSet(cacheKey, () => personaService.getConfig(persona), 60 * 60 * 1000, ['personas']);
      }

    } catch (error) {
      console.error('Persona data warmup error:', error);
    }
  }

  // Warmup subscription data
  private static async warmupSubscriptionData(): Promise<void> {
    try {
      console.log('Warming up subscription data cache...');
      
      // Cache subscription tier configurations
      const cacheKey = 'subscription:tiers';
      // await this.getOrSet(cacheKey, () => subscriptionService.getTiers(), 60 * 60 * 1000, ['subscriptions']);

    } catch (error) {
      console.error('Subscription data warmup error:', error);
    }
  }
}

