// Background stay task accumulates auto-counts under a legacy global key; the foreground drains it.
export const STAY_PENDING_COUNT_KEY = 'stay_monitor_pending_count';

type CountStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function parsePendingCount(raw: string | null): number {
  const value = parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// Clears only what was recorded, after the write succeeds. A failed write keeps the value for the next attempt,
// and counts added by the background task during the write are preserved.
export async function flushStayPendingCount(store: CountStore, addEntry: (count: number) => Promise<void>): Promise<number> {
  const pending = parsePendingCount(await store.getItem(STAY_PENDING_COUNT_KEY));
  if (pending === 0) return 0;
  await addEntry(pending);
  const latest = parsePendingCount(await store.getItem(STAY_PENDING_COUNT_KEY));
  await store.setItem(STAY_PENDING_COUNT_KEY, String(Math.max(0, latest - pending)));
  return pending;
}
