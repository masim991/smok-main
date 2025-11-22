import AsyncStorage from '@react-native-async-storage/async-storage';

export interface IStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiGet(keys: string[]): Promise<ReadonlyArray<[string, string | null]>>;
  // Optional methods for enhanced storage implementations
  preloadData?(keys: string[]): Promise<void>;
  cleanExpiredCache?(): void;
  clearCache?(): void;
}

export class AsyncStorageProvider implements IStorage {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  }
  async multiGet(keys: string[]): Promise<ReadonlyArray<[string, string | null]>> {
    const pairs = await AsyncStorage.multiGet(keys);
    // Ensure a readonly tuple array shape compatible with our interface
    return pairs.map(([k, v]) => [k, v] as [string, string | null]);
  }
}

// Placeholder for a future DB storage (e.g., Supabase/Firebase)
// Implement the same interface to swap storages without changing DataContext.
export class PlaceholderDbStorage implements IStorage {
  async getItem(_key: string): Promise<string | null> {
    // TODO: Implement with real DB
    return null;
  }
  async setItem(_key: string, _value: string): Promise<void> {
    // TODO: Implement with real DB
    return;
  }
  async multiGet(_keys: string[]): Promise<[string, string | null][]> {
    // TODO: Implement with real DB
    return [];
  }
}
