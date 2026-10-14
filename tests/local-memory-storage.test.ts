import { describe, expect, it, vi } from 'vitest'

vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }))
import { LocalMemoryStorage } from '../components/services/storage/LocalMemoryStorage'

describe('local cache failure handling', () => {
  it('does not serve a value that failed to persist', async () => {
    const fallback = {
      getItem: async () => 'old',
      setItem: async () => { throw new Error('disk unavailable') },
      multiGet: async () => [] as [string, string | null][],
    }
    const cache = new LocalMemoryStorage(fallback)
    await expect(cache.setItem('key', 'new')).rejects.toThrow('disk unavailable')
    expect(await cache.getItem('key')).toBe('old')
  })
  it('surfaces storage read failures instead of returning an empty dataset', async () => {
    const fallback = {
      getItem: async () => { throw new Error('read unavailable') },
      setItem: async () => undefined,
      multiGet: async () => { throw new Error('read unavailable') },
    }
    const cache = new LocalMemoryStorage(fallback)
    await expect(cache.getItem('key')).rejects.toThrow('read unavailable')
    await expect(cache.multiGet(['key'])).rejects.toThrow('read unavailable')
  })
})
