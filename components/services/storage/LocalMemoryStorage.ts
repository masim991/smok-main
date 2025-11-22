import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorage } from './Storage';

interface CacheEntry {
  data: string;
  timestamp: number;
  expiry?: number;
}

export class LocalMemoryStorage implements IStorage {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes default cache
  
  constructor(private fallbackStorage: IStorage = new (require('./Storage').AsyncStorageProvider)()) {}

  async getItem(key: string): Promise<string | null> {
    // Check memory cache first
    const cached = this.cache.get(key);
    if (cached && this.isValidCache(cached)) {
      console.log(`Cache hit for key: ${key}`);
      return cached.data;
    }

    // Fallback to persistent storage
    try {
      const value = await this.fallbackStorage.getItem(key);
      if (value) {
        // Cache the result
        this.cache.set(key, {
          data: value,
          timestamp: Date.now(),
          expiry: Date.now() + this.CACHE_DURATION
        });
      }
      return value;
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Update memory cache immediately
      this.cache.set(key, {
        data: value,
        timestamp: Date.now(),
        expiry: Date.now() + this.CACHE_DURATION
      });

      // Persist to storage
      await this.fallbackStorage.setItem(key, value);
      console.log(`Cached and persisted key: ${key}`);
    } catch (error) {
      console.error(`Error setting item ${key}:`, error);
      throw error;
    }
  }

  async multiGet(keys: string[]): Promise<ReadonlyArray<[string, string | null]>> {
    const results: [string, string | null][] = [];
    const uncachedKeys: string[] = [];

    // Check cache for each key
    for (const key of keys) {
      const cached = this.cache.get(key);
      if (cached && this.isValidCache(cached)) {
        results.push([key, cached.data]);
      } else {
        uncachedKeys.push(key);
        results.push([key, null]); // Placeholder
      }
    }

    // Fetch uncached keys from persistent storage
    if (uncachedKeys.length > 0) {
      try {
        const uncachedResults = await this.fallbackStorage.multiGet(uncachedKeys);
        
        // Update results and cache
        for (const [key, value] of uncachedResults) {
          if (value) {
            this.cache.set(key, {
              data: value,
              timestamp: Date.now(),
              expiry: Date.now() + this.CACHE_DURATION
            });
          }
          
          // Update the placeholder in results
          const resultIndex = results.findIndex(([k]) => k === key);
          if (resultIndex !== -1) {
            results[resultIndex] = [key, value];
          }
        }
      } catch (error) {
        console.error('Error in multiGet:', error);
      }
    }

    return results;
  }

  // Cache management methods
  private isValidCache(entry: CacheEntry): boolean {
    return entry.expiry ? Date.now() < entry.expiry : true;
  }

  public clearCache(): void {
    this.cache.clear();
    console.log('Memory cache cleared');
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // Preload frequently accessed data
  public async preloadData(keys: string[]): Promise<void> {
    try {
      await this.multiGet(keys);
      console.log(`Preloaded ${keys.length} keys into cache`);
    } catch (error) {
      console.error('Error preloading data:', error);
    }
  }

  // Clean expired cache entries
  public cleanExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry && now >= entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache entries`);
    }
  }
}

// Singleton instance
export const localMemoryStorage = new LocalMemoryStorage();