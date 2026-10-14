import type { IStorage } from '@/components/services/storage/Storage'
import type { Goal, SmokeEntry } from '@/components/contexts/DataContext'
import { accountDataKey, type PendingMutation } from './syncPolicy'

export const ENTRIES_STORAGE_KEY = '@SmokeTracker:entries'
export const GOALS_STORAGE_KEY = '@SmokeTracker:goals'

export type AccountMutation = PendingMutation<SmokeEntry | Goal>
export type AccountSnapshot = {
  entries: SmokeEntry[]
  goals: Goal[]
  pending: AccountMutation[]
  legacyImported?: boolean
}

function parseRecords<T>(raw: string | null, label: string): T[] {
  const value: unknown = JSON.parse(raw ?? '[]')
  if (!Array.isArray(value) || !value.every(item => item && typeof item === 'object' && typeof item.id === 'string')) {
    throw new Error(`${label} has an invalid format`)
  }
  return value as T[]
}

export async function readLegacyData(store: IStorage) {
  const pairs = await store.multiGet([ENTRIES_STORAGE_KEY, GOALS_STORAGE_KEY])
  return {
    entries: parseRecords<SmokeEntry>(pairs.find(([key]) => key === ENTRIES_STORAGE_KEY)?.[1] ?? null, 'Legacy entries'),
    goals: parseRecords<Goal>(pairs.find(([key]) => key === GOALS_STORAGE_KEY)?.[1] ?? null, 'Legacy goals'),
  }
}

export async function readAccountData(store: IStorage, userId: string): Promise<AccountSnapshot> {
  const raw = await store.getItem(accountDataKey(userId))
  if (!raw) return { entries: [], goals: [], pending: [] }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Account data has an invalid format')
  const snapshot = value as Record<string, unknown>
  const entries = parseRecords<SmokeEntry>(JSON.stringify(snapshot.entries ?? null), 'Account entries')
  const goals = parseRecords<Goal>(JSON.stringify(snapshot.goals ?? null), 'Account goals')
  const pending = snapshot.pending === undefined ? [] : snapshot.pending
  if (!Array.isArray(pending) || !pending.every(item =>
    item && typeof item === 'object' &&
    (item.table === 'entries' || item.table === 'goals') &&
    (item.kind === 'upsert' || item.kind === 'delete') &&
    typeof item.id === 'string' &&
    (item.kind === 'delete' || (item.value && item.value.id === item.id))
  )) throw new Error('Pending changes have an invalid format')
  return { entries, goals, pending: pending as AccountMutation[], legacyImported: snapshot.legacyImported === true }
}

export async function writeAccountData(store: IStorage, userId: string | null, snapshot: AccountSnapshot): Promise<void> {
  if (userId) {
    await store.setItem(accountDataKey(userId), JSON.stringify(snapshot))
  } else {
    await store.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(snapshot.entries))
    await store.setItem(GOALS_STORAGE_KEY, JSON.stringify(snapshot.goals))
  }
}
