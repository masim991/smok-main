import type { IStorage } from './Storage';
import type { SmokeEntry, Goal } from '../../contexts/DataContext';
import { validEntry } from '../../../utils/tracking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localMemoryStorage } from './LocalMemoryStorage';
import { LOCAL_TEST_USER_ID } from '../../../lib/localTest';
const repositories = new Set<TrackingRepository>();

export async function clearTrackingData(userId: string): Promise<void> {
  if (!userId || userId === 'guest') throw new Error('삭제할 계정을 확인해주세요.');
  await Promise.all([...repositories].filter(repository => repository.owner === userId).map(repository => repository.retire()));
  const keys = [`@SmokeTracker:v2:${userId}`];
  if (userId !== LOCAL_TEST_USER_ID) keys.push('stay_monitor_pending_count', 'stay_monitor_runtime');
  await AsyncStorage.multiRemove(keys);
  // The caller signs out after deleting. Invalidate cached copies as well.
  localMemoryStorage.clearCache();
}

export type PendingChange = { table: 'entries' | 'goals'; id: string; deleted?: boolean; row?: Record<string, unknown> };
export type TrackingSnapshot = { version: 1; entries: SmokeEntry[]; goals: Goal[]; pending: PendingChange[] };
export const emptySnapshot = (): TrackingSnapshot => ({ version: 1, entries: [], goals: [], pending: [] });
export function validGoal(value: unknown): value is Goal {
  const g = value as Goal;
  return !!g && typeof g.id === 'string' && ['reduction', 'smoke_free_days', 'milestone', 'streak'].includes(g.type) && Number.isFinite(g.target) && g.target > 0 && Number.isFinite(Date.parse(g.startDate)) && ['active', 'completed', 'failed'].includes(g.status) && Number.isFinite(g.currentValue) && g.currentValue >= 0 && typeof g.title === 'string' && typeof g.description === 'string';
}
export class TrackingRepository {
  snapshot = emptySnapshot();
  private queue: Promise<unknown> = Promise.resolve();
  private retired = false;
  get isRetired() { return this.retired; }
  readonly key: string;
  constructor(private storage: IStorage, readonly owner: string) { this.key = `@SmokeTracker:v2:${owner}`; repositories.add(this); }
  async retire() { this.retired = true; await this.queue; repositories.delete(this); }
  async load() {
    const raw = await this.storage.getItem(this.key);
    if (raw) {
      const value = JSON.parse(raw);
      if (value.version !== 1 || !Array.isArray(value.entries) || !Array.isArray(value.goals) || !Array.isArray(value.pending) || !value.entries.every(validEntry) || !value.goals.every(validGoal) || !value.pending.every((p: PendingChange) => p && ['entries', 'goals'].includes(p.table) && typeof p.id === 'string' && (p.deleted === true || (p.row && typeof p.row === 'object')))) throw new Error('저장 데이터 형식이 올바르지 않습니다. 원본 데이터는 보존됩니다.');
      this.snapshot = value;
    } else if (this.owner === 'guest') {
      // Legacy data has no owner metadata; expose it only in guest mode, never upload it to an account.
      const entries = await this.storage.getItem('@SmokeTracker:entries');
      const goals = await this.storage.getItem('@SmokeTracker:goals');
      const parsedEntries = entries ? JSON.parse(entries) : [];
      const parsedGoals = goals ? JSON.parse(goals) : [];
      if (!Array.isArray(parsedEntries) || !Array.isArray(parsedGoals)) throw new Error('기존 데이터 형식을 확인해주세요.');
      this.snapshot = { version: 1, entries: parsedEntries.filter(validEntry), goals: parsedGoals.filter(validGoal), pending: [] };
      await this.storage.setItem(this.key, JSON.stringify(this.snapshot));
    }
    return this.snapshot;
  }
  transact<T>(operation: (current: TrackingSnapshot) => Promise<{ next: TrackingSnapshot; result: T }> | { next: TrackingSnapshot; result: T }): Promise<T> {
    const task = this.queue.then(async () => {
      if (this.retired) throw new Error('삭제된 계정은 변경할 수 없습니다.');
      const { next, result } = await operation(this.snapshot);
      if (this.retired) throw new Error('삭제된 계정은 변경할 수 없습니다.');
      await this.storage.setItem(this.key, JSON.stringify(next));
      this.snapshot = next; // Publish only after durable storage succeeds.
      return result;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}
export function enqueueChange(pending: PendingChange[], change: PendingChange): PendingChange[] {
  return [...pending.filter(p => p.table !== change.table || p.id !== change.id), change];
}
export function acknowledgeChanges(pending: PendingChange[], acknowledged: Set<PendingChange>): PendingChange[] {
  return pending.filter(change => !acknowledged.has(change));
}
export function reconcileRows<T extends { id: string }>(remote: T[], local: T[], table: PendingChange['table'], pending: PendingChange[]): T[] {
  const map = new Map(remote.map(item => [item.id, item]));
  for (const change of pending.filter(change => change.table === table)) {
    if (change.deleted) map.delete(change.id);
    else { const item = local.find(item => item.id === change.id); if (item) map.set(item.id, item); }
  }
  return [...map.values()];
}
