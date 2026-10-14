import { describe, expect, it } from 'vitest'
import { accountDataKey, queueMutation, reconcileRemote } from '../lib/syncPolicy'

const one = { id: 'one', date: '2026-10-14T01:00:00Z', count: 1 }

describe('account-scoped conservative sync', () => {
  it('keeps account keys distinct without changing legacy keys', () => {
    expect(accountDataKey('alice')).not.toBe(accountDataKey('bob'))
    expect(accountDataKey('alice')).toContain('@SmokeTracker:account:')
  })
  it('keeps a local-only record and reports the ambiguity', () => {
    expect(reconcileRemote([one], [], [], 'entries')).toEqual({ records: [one], conflicts: ['one'], acknowledged: [] })
  })
  it('keeps a divergent local record and reports a conflict', () => {
    expect(reconcileRemote([one], [{ ...one, count: 2 }], [], 'entries')).toEqual({ records: [one], conflicts: ['one'], acknowledged: [] })
  })
  it('merges remote-only data and acknowledges an identical retry', () => {
    const pending = [{ table: 'entries' as const, kind: 'upsert' as const, id: one.id, value: one }]
    const two = { ...one, id: 'two' }
    expect(reconcileRemote([one], [one, two], pending, 'entries')).toEqual({ records: [one, two], conflicts: [], acknowledged: ['one'] })
  })
  it('treats key order and absent optional values as the same record', () => {
    const remote = { count: 1, notes: null, date: one.date, id: 'one' }
    expect(reconcileRemote([one], [remote], [], 'entries').conflicts).toEqual([])
  })
  it('deduplicates repeat operations and keeps deletes as tombstones', () => {
    const first = { table: 'entries' as const, kind: 'upsert' as const, id: one.id, value: one }
    const second = { table: 'entries' as const, kind: 'delete' as const, id: one.id }
    expect(queueMutation(queueMutation([], first), second)).toEqual([second])
    expect(reconcileRemote([], [one], [second], 'entries').records).toEqual([])
  })
})
