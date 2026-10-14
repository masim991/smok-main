import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DataProvider, useData, type SmokeEntry } from '../components/contexts/DataContext';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  remoteEntries: [] as SmokeEntry[],
  remoteGoals: [] as unknown[],
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/services/storage/LocalMemoryStorage', () => ({ localMemoryStorage: {} }));
vi.mock('@/components/services/notifications/LocalNotifications', () => ({
  notificationService: { scheduleGoalReminder: vi.fn(async () => undefined) },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: async () => ({ data: table === 'entries' ? mocks.remoteEntries : mocks.remoteGoals, error: null }) }),
    }),
  },
}));

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
    multiGet: async (keys: string[]) => keys.map(key => [key, data.get(key) ?? null] as [string, string | null]),
  };
}

let tree: ReactTestRenderer | undefined;
let model: ReturnType<typeof useData>;
let rerender: (() => Promise<void>) | undefined;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
process.env.TZ = 'Asia/Seoul';

async function mount(entries: SmokeEntry[], user: null | { id: string } = null) {
  mocks.user = user;
  const store = memoryStore({ '@SmokeTracker:entries': JSON.stringify(entries) });
  function Probe() { model = useData(); return null; }
  await act(async () => { tree = create(<DataProvider storage={store}><Probe /></DataProvider>); });
  rerender = async () => { await act(async () => { tree?.update(<DataProvider storage={store}><Probe /></DataProvider>); }); };
  return store;
}

beforeEach(() => { mocks.user = null; mocks.remoteEntries = []; mocks.remoteGoals = []; });
afterEach(async () => { if (tree) await act(async () => { tree?.unmount(); }); tree = undefined; rerender = undefined; vi.useRealTimers(); });

describe('Phase 0 record regressions', () => {
  it('uses the local calendar day around midnight in Seoul', async () => {
    await mount([
      { id: 'previous', date: '2026-10-13T05:00:00.000Z', count: 1 }, // Oct 13 14:00 KST
      { id: 'today', date: '2026-10-13T15:30:00.000Z', count: 2 }, // Oct 14 00:30 KST
    ]);
    expect(model.getEntriesByDate(new Date(2026, 9, 14)).map(entry => entry.id)).toEqual(['today']);
  });

  it('returns a zero weekly summary for an empty record set', async () => {
    await mount([]);
    expect(model.getWeeklySummary()).toHaveLength(7);
    expect(model.getWeeklySummary().every(day => day.cigarettes === 0)).toBe(true);
  });

  it('does not award future smoke-free days as goal progress', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T03:00:00.000Z'));
    await mount([{ id: 'one', date: new Date().toISOString(), count: 1 }]);
    await act(async () => {
      await model.addGoal({ type: 'smoke_free_days', target: 7, currentValue: 0, title: 'Clean week', description: '', difficulty: 'easy', icon: '7' });
    });
    expect(model.goals[0].currentValue).toBeLessThanOrEqual(new Date().getDay());
  });

  it('keeps an offline local entry when a remote query returns empty', async () => {
    const local = { id: 'offline', date: '2026-10-14T10:00:00.000Z', count: 2 };
    const store = await mount([local]);
    mocks.user = { id: 'account-a' };
    await rerender?.();
    expect(model.entries).toEqual([local]);
    expect(JSON.parse(store.data.get('@SmokeTracker:entries') ?? '[]')).toEqual([local]);
  });

  it('does not silently replace a conflicting local entry', async () => {
    const local = { id: 'same', date: '2026-10-14T10:00:00.000Z', count: 2 };
    mocks.remoteEntries = [{ ...local, count: 1 }];
    await mount([local]);
    mocks.user = { id: 'account-a' };
    await rerender?.();
    expect(model.entries.find(entry => entry.id === 'same')?.count).toBe(2);
  });
});
