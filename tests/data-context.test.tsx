import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { DataProvider, useData, type SmokeEntry } from '../components/contexts/DataContext';
import { accountDataKey } from '../lib/syncPolicy';

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  remoteEntries: [] as SmokeEntry[],
  remoteGoals: [] as unknown[],
  writeError: null as null | string,
  readError: null as null | string,
  writes: [] as { table: string; id: string; kind: string }[],
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/services/storage/LocalMemoryStorage', () => ({ localMemoryStorage: {} }));
vi.mock('@/components/services/notifications/LocalNotifications', () => ({
  notificationService: { scheduleGoalReminder: vi.fn(async () => undefined) },
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: async () => ({ data: table === 'entries' ? mocks.remoteEntries : mocks.remoteGoals, error: mocks.readError ? { message: mocks.readError } : null }) }),
      upsert: async (value: { id: string }) => {
        mocks.writes.push({ table, id: value.id, kind: 'upsert' });
        return { error: mocks.writeError ? { message: mocks.writeError } : null };
      },
      delete: () => ({ eq: () => ({ eq: async (_field: string, id: string) => {
        mocks.writes.push({ table, id, kind: 'delete' });
        return { error: mocks.writeError ? { message: mocks.writeError } : null };
      } }) }),
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
  const initial = user
    ? { [accountDataKey(user.id)]: JSON.stringify({ entries, goals: [], pending: [] }) }
    : { '@SmokeTracker:entries': JSON.stringify(entries) };
  const store = memoryStore(initial);
  function Probe() { model = useData(); return null; }
  await act(async () => { tree = create(<DataProvider storage={store}><Probe /></DataProvider>); });
  rerender = async () => { await act(async () => { tree?.update(<DataProvider storage={store}><Probe /></DataProvider>); }); };
  return store;
}

beforeEach(() => { mocks.user = null; mocks.remoteEntries = []; mocks.remoteGoals = []; mocks.writeError = null; mocks.readError = null; mocks.writes = []; });
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
    const store = await mount([local], { id: 'account-a' });
    expect(model.entries).toEqual([local]);
    expect(JSON.parse(store.data.get(accountDataKey('account-a')) ?? '{}').entries).toEqual([local]);
  });

  it('does not silently replace a conflicting local entry', async () => {
    const local = { id: 'same', date: '2026-10-14T10:00:00.000Z', count: 2 };
    mocks.remoteEntries = [{ ...local, count: 1 }];
    await mount([local], { id: 'account-a' });
    expect(model.entries.find(entry => entry.id === 'same')?.count).toBe(2);
    expect(model.syncError).toContain('1');
  });

  it('keeps local records and displays a remote read failure', async () => {
    const local = { id: 'offline', date: '2026-10-14T10:00:00.000Z', count: 2 };
    mocks.readError = 'network unavailable';
    await mount([local], { id: 'account-a' });
    expect(model.entries).toEqual([local]);
    expect(model.syncError).toContain('network unavailable');
  });

  it('keeps failed writes pending and retries with the same ID', async () => {
    await mount([], { id: 'account-a' });
    mocks.writeError = 'offline';
    await act(async () => { await model.addEntry(1); });
    const id = model.entries[0].id;
    expect(model.syncError).toBeTruthy();
    expect(mocks.writes).toEqual([{ table: 'entries', id, kind: 'upsert' }]);
    mocks.writeError = null;
    await act(async () => { await model.retrySync(); });
    expect(mocks.writes.at(-1)).toEqual({ table: 'entries', id, kind: 'upsert' });
    expect(mocks.writes).toHaveLength(2);
  });

  it('keeps two rapid records instead of replacing the first one', async () => {
    await mount([], { id: 'account-a' });
    await act(async () => { await Promise.all([model.addEntry(1), model.addEntry(2)]); });
    expect(model.entries.map(entry => entry.count).sort()).toEqual([1, 2]);
  });

  it('does not show one account’s local records in another account', async () => {
    const local = { id: 'a', date: '2026-10-14T10:00:00.000Z', count: 2 };
    await mount([local], { id: 'account-a' });
    mocks.user = { id: 'account-b' };
    await rerender?.();
    expect(model.entries).toEqual([]);
    mocks.user = { id: 'account-a' };
    await rerender?.();
    expect(model.entries).toEqual([local]);
  });

  it('blocks writes instead of reusing another account after a failed load', async () => {
    const local = { id: 'a', date: '2026-10-14T10:00:00.000Z', count: 2 };
    const store = await mount([local], { id: 'account-a' });
    store.data.set(accountDataKey('account-b'), '{corrupted');
    mocks.user = { id: 'account-b' };
    await rerender?.();
    expect(model.syncError).toContain('로컬 데이터 로드 실패');
    let failure: unknown;
    await act(async () => { await model.addEntry(1).catch(error => { failure = error; }); });
    expect(failure).toBeInstanceOf(Error);
    expect(store.data.get(accountDataKey('account-b'))).toBe('{corrupted');
    expect(mocks.writes).toEqual([]);
  });

  it('blocks writes when account JSON is valid but its record shape is damaged', async () => {
    const store = await mount([], { id: 'account-a' });
    const damaged = JSON.stringify({ entries: {}, goals: [], pending: [] });
    store.data.set(accountDataKey('account-b'), damaged);
    mocks.user = { id: 'account-b' };
    await rerender?.();
    expect(model.syncError).toContain('로컬 데이터 로드 실패');
    let failure: unknown;
    await act(async () => { await model.addEntry(1).catch(error => { failure = error; }); });
    expect(failure).toBeInstanceOf(Error);
    expect(store.data.get(accountDataKey('account-b'))).toBe(damaged);
    expect(mocks.writes).toEqual([]);
  });

  it('preserves legacy keys until the user explicitly imports them', async () => {
    const local = { id: 'legacy', date: '2026-10-14T10:00:00.000Z', count: 2 };
    const store = await mount([local]);
    mocks.user = { id: 'account-a' };
    await rerender?.();
    expect(model.entries).toEqual([]);
    expect(model.legacyDataAvailable).toBe(true);
    await act(async () => { await model.importLegacyData(); });
    expect(model.entries).toEqual([local]);
    expect(JSON.parse(store.data.get('@SmokeTracker:entries') ?? '[]')).toEqual([local]);
  });
});
