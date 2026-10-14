export type SyncTable = 'entries' | 'goals'
export type PendingMutation<T extends { id: string }> = {
  table: SyncTable
  kind: 'upsert' | 'delete'
  id: string
  value?: T
}

export function accountDataKey(userId: string): string {
  return `@SmokeTracker:account:${encodeURIComponent(userId)}:data:v1`
}

// Keep the latest local intent for an ID. Retrying an upsert uses the same stable ID.
export function queueMutation<T extends { id: string }>(pending: PendingMutation<T>[], mutation: PendingMutation<T>) {
  return [...pending.filter(item => item.table !== mutation.table || item.id !== mutation.id), mutation]
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]))
  }
  return value
}

const sameRecord = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

export function reconcileRemote<T extends { id: string }>(
  local: readonly T[],
  remote: readonly T[],
  pending: readonly PendingMutation<T>[],
  table: SyncTable,
): { records: T[]; conflicts: string[]; acknowledged: string[] } {
  const remoteById = new Map(remote.map(item => [item.id, item]))
  const pendingById = new Map(pending.filter(item => item.table === table).map(item => [item.id, item]))
  const records: T[] = []
  const conflicts: string[] = []
  const acknowledged: string[] = []

  for (const item of local) {
    const operation = pendingById.get(item.id)
    if (operation?.kind === 'delete') continue
    const server = remoteById.get(item.id)
    if (!server) {
      records.push(item)
      if (!operation) conflicts.push(item.id) // A remote deletion cannot be distinguished from an unsynced legacy record.
      continue
    }
    records.push(item)
    if (!sameRecord(item, server)) conflicts.push(item.id)
    else if (operation?.kind === 'upsert') acknowledged.push(item.id)
    remoteById.delete(item.id)
  }

  for (const [id, item] of remoteById) {
    if (pendingById.get(id)?.kind === 'delete') continue
    records.push(item)
  }
  for (const operation of pendingById.values()) {
    if (operation.kind === 'delete' && !remote.some(item => item.id === operation.id)) acknowledged.push(operation.id)
  }
  return { records, conflicts, acknowledged }
}
