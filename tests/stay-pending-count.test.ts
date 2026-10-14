import { describe, expect, it } from 'vitest';
import { flushStayPendingCount, parsePendingCount, STAY_PENDING_COUNT_KEY } from '../lib/stayPendingCount';

function memoryStore(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[STAY_PENDING_COUNT_KEY, initial]]);
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
  };
}

describe('stay pending count', () => {
  it('ignores missing, invalid and non-positive values', () => {
    expect(parsePendingCount(null)).toBe(0);
    expect(parsePendingCount('abc')).toBe(0);
    expect(parsePendingCount('-2')).toBe(0);
    expect(parsePendingCount('3')).toBe(3);
  });

  it('records the pending count and clears it after success', async () => {
    const store = memoryStore('2');
    const recorded: number[] = [];
    await expect(flushStayPendingCount(store, async count => { recorded.push(count); })).resolves.toBe(2);
    expect(recorded).toEqual([2]);
    expect(store.data.get(STAY_PENDING_COUNT_KEY)).toBe('0');
  });

  it('keeps the pending count when the write fails', async () => {
    const store = memoryStore('2');
    await expect(flushStayPendingCount(store, async () => { throw new Error('Data is still loading'); })).rejects.toThrow();
    expect(store.data.get(STAY_PENDING_COUNT_KEY)).toBe('2');
  });

  it('preserves counts added while the write is in progress', async () => {
    const store = memoryStore('2');
    await flushStayPendingCount(store, async () => { store.data.set(STAY_PENDING_COUNT_KEY, '3'); });
    expect(store.data.get(STAY_PENDING_COUNT_KEY)).toBe('1');
  });

  it('does nothing without a pending count', async () => {
    const store = memoryStore();
    let calls = 0;
    await expect(flushStayPendingCount(store, async () => { calls += 1; })).resolves.toBe(0);
    expect(calls).toBe(0);
    expect(store.data.has(STAY_PENDING_COUNT_KEY)).toBe(false);
  });
});
