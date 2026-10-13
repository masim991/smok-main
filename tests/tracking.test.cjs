const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const nativeStorageMock = { removedKeys: [], async multiRemove(keys) { this.removedKeys = keys; } };
nativeStorageMock.default = nativeStorageMock;
// Test pure TS business logic without starting React Native or requiring a simulator.
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths;
  mod.require = name => name === '@react-native-async-storage/async-storage' ? nativeStorageMock : name === './LocalMemoryStorage' ? { localMemoryStorage: { clearCache() {} } } : name.endsWith('/lib/localTest') ? load('lib/localTest.ts') : name.endsWith('/utils/tracking') ? load('utils/tracking.ts') : module.require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return mod.exports;
}
const tracking = load('utils/tracking.ts');
const { fetchAllRows } = load('utils/remoteRows.ts');
const { TrackingRepository, enqueueChange, acknowledgeChanges, reconcileRows, clearTrackingData } = load('components/services/storage/TrackingRepository.ts');
function memory() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } };
}
test('local midnight places a UTC evening entry on the following local date', () => {
  const date = new Date(2026, 9, 13, 0, 30);
  const entry = { id: '1', date: date.toISOString(), count: 2 };
  assert.equal(tracking.totalOnDay([entry], date), 2);
  assert.equal(tracking.localDay(date), '2026-10-13');
});
test('monthly ranges include the final afternoon and exclude future days from average', () => {
  const now = new Date(2026, 9, 7, 23);
  const rows = [{ id: '1', date: new Date(2026, 9, 7, 22).toISOString(), count: 7 }];
  assert.equal(tracking.monthlyTrend(rows, now)[0].average, 1);
  assert.equal(tracking.monthlyTrend(rows, new Date(2026, 9, 8))[1].average, 0);
});
test('goals never count today, future days, or days before their start', () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), date: new Date(2026, 9, 9 + i, 23).toISOString(), count: 0, notes: '[checkin:smoke-free]' }));
  assert.equal(tracking.completedSmokeFreeDays(rows, new Date(2026, 9, 13, 10).toISOString(), true, new Date(2026, 9, 13, 23)), 0);
  assert.equal(tracking.completedSmokeFreeDays(rows, new Date(2026, 9, 10, 10).toISOString(), true, new Date(2026, 9, 13, 23)), 2);
});
test('concurrent increments are serialized rather than dropping the second entry', async () => {
  const repo = new TrackingRepository(memory(), 'alice'); await repo.load();
  await Promise.all(Array.from({ length: 20 }, (_, i) => repo.transact(s => ({ next: { ...s, entries: [...s.entries, { id: String(i), date: new Date().toISOString(), count: 1 }] }, result: undefined }))));
  assert.equal(repo.snapshot.entries.length, 20);
});
test('failed durable write leaves previous snapshot intact and permits retry', async () => {
  const store = memory(); const repo = new TrackingRepository(store, 'alice'); await repo.load();
  const original = store.setItem; store.setItem = async () => { throw new Error('disk full'); };
  await assert.rejects(repo.transact(s => ({ next: { ...s, entries: [{ id: '1', date: new Date().toISOString(), count: 1 }] }, result: undefined })));
  assert.equal(repo.snapshot.entries.length, 0);
  store.setItem = original;
  await repo.transact(s => ({ next: s, result: undefined }));
});
test('legacy guest data is never imported by an authenticated account', async () => {
  const store = memory(); store.values.set('@SmokeTracker:entries', JSON.stringify([{ id: '1', date: new Date().toISOString(), count: 1 }]));
  const alice = new TrackingRepository(store, 'alice'); const guest = new TrackingRepository(store, 'guest');
  await alice.load(); await guest.load();
  assert.equal(alice.snapshot.entries.length, 0); assert.equal(guest.snapshot.entries.length, 1);
  assert.notEqual(alice.key, guest.key);
});
test('offline delete tombstone replaces pending upsert for the same record', () => {
  const pending = enqueueChange([{ table: 'entries', id: '1', row: { count: 1 } }], { table: 'entries', id: '1', deleted: true });
  assert.deepEqual(pending, [{ table: 'entries', id: '1', deleted: true }]);
});
test('corrupt storage is retained and load rejects instead of replacing with an empty list', async () => {
  const store = memory(); const repo = new TrackingRepository(store, 'alice'); store.values.set(repo.key, '{broken');
  await assert.rejects(repo.load()); assert.equal(store.values.get(repo.key), '{broken');
});
test('retired account repository rejects queued writes after account deletion', async () => {
  const store = memory(); const repo = new TrackingRepository(store, 'retired-account'); await repo.load();
  await repo.retire();
  await assert.rejects(repo.transact(s => ({ next: s, result: undefined })), /삭제된 계정/);
  assert.equal(store.values.has(repo.key), false);
});
test('remote pagination retains all 1251 records despite backend default limits', async () => {
  const rows = Array.from({ length: 1251 }, (_, index) => ({ id: String(index) }));
  const result = await fetchAllRows(async start => ({ data: rows.slice(start, start + 300), error: null }));
  assert.equal(result.length, 1251);
});
test('failed later remote page rejects the entire fetch instead of returning truncated history', async () => {
  await assert.rejects(fetchAllRows(async start => start === 0 ? { data: [{ id: '1' }], error: null } : { data: null, error: new Error('offline') }));
});
test('a newer local delete survives acknowledgement of an earlier in-flight upsert', () => {
  const uploading = { table: 'entries', id: '1', row: { count: 1 } };
  const latest = enqueueChange([uploading], { table: 'entries', id: '1', deleted: true });
  const pending = acknowledgeChanges(latest, new Set([uploading]));
  assert.equal(pending.length, 1);
  assert.deepEqual(reconcileRows([{ id: '1', count: 1 }], [], 'entries', pending), []);
});
test('a local record added during remote fetch is retained when the stale remote snapshot arrives', () => {
  const entry = { id: 'new', count: 2 };
  const pending = [{ table: 'entries', id: 'new', row: entry }];
  assert.deepEqual(reconcileRows([], [entry], 'entries', pending), [entry]);
});
test('nullable remote notes remain a valid record rather than silently removing history', () => {
  assert.equal(tracking.validEntry({ id: '1', date: new Date().toISOString(), count: 1, notes: null }), true);
});
test('a failed initial read can be retried without overwriting existing saved records', async () => {
  const store = memory(); const repo = new TrackingRepository(store, 'retry-account');
  const saved = { version: 1, entries: [{ id: '1', date: new Date().toISOString(), count: 1 }], goals: [], pending: [] };
  store.values.set(repo.key, JSON.stringify(saved));
  const original = store.getItem;
  store.getItem = async () => { throw new Error('temporary read failure'); };
  await assert.rejects(repo.load());
  assert.equal(store.values.get(repo.key), JSON.stringify(saved));
  store.getItem = original;
  assert.equal((await repo.load()).entries.length, 1);
});
test('clearing local test records preserves real location settings and pending records', async () => {
  await clearTrackingData('local-test');
  assert.deepEqual(nativeStorageMock.removedKeys, ['@SmokeTracker:v2:local-test']);
});
test('null server data is an error rather than an empty account history', async () => {
  await assert.rejects(fetchAllRows(async () => ({ data: null, error: null })));
});
test('unrecorded days never count as confirmed smoke-free days', () => {
  assert.equal(tracking.completedSmokeFreeDays([], new Date(2026, 9, 1).toISOString(), false, new Date(2026, 9, 13)), 0);
});
test('zero counts require an explicit smoke-free check-in marker', () => {
  const entry = { id: '1', date: new Date().toISOString(), count: 0 };
  assert.equal(tracking.validEntry(entry), false);
  assert.equal(tracking.validEntry({ ...entry, notes: 'no smoking' }), false);
  assert.equal(tracking.validEntry({ ...entry, notes: tracking.SMOKE_FREE_CHECKIN }), true);
});
test('a confirmed day with a later smoking record does not count toward smoke-free goals', () => {
  const rows = [
    { id: '1', date: new Date(2026, 9, 11, 18).toISOString(), count: 0, notes: tracking.SMOKE_FREE_CHECKIN },
    { id: '2', date: new Date(2026, 9, 11, 20).toISOString(), count: 1 },
    { id: '3', date: new Date(2026, 9, 12, 22).toISOString(), count: 0, notes: tracking.SMOKE_FREE_CHECKIN },
  ];
  assert.equal(tracking.completedSmokeFreeDays(rows, new Date(2026, 9, 10).toISOString(), false, new Date(2026, 9, 13)), 1);
  assert.equal(tracking.completedSmokeFreeDays(rows, new Date(2026, 9, 10).toISOString(), true, new Date(2026, 9, 13)), 1);
});
