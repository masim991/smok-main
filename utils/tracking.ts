export type TrackingEntry = { id: string; date: string; count: number; notes?: string };
export const SMOKE_FREE_CHECKIN = '[checkin:smoke-free]';
export function isSmokeFreeCheckin(entry: TrackingEntry): boolean {
  return entry.count === 0 && entry.notes === SMOKE_FREE_CHECKIN;
}
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validEntry(value: unknown): value is TrackingEntry {
  const e = value as TrackingEntry;
  return !!e && typeof e.id === 'string' && typeof e.date === 'string' && Number.isFinite(Date.parse(e.date)) && Number.isInteger(e.count) && e.count >= 0 && e.count <= 1000 && (e.count > 0 || isSmokeFreeCheckin(e)) && (e.notes == null || typeof e.notes === 'string');
}
export function totalOnDay(entries: TrackingEntry[], date: Date): number {
  const key = localDay(date);
  return entries.filter(e => localDay(new Date(e.date)) === key).reduce((sum, e) => sum + e.count, 0);
}
export function weeklySummary(entries: TrackingEntry[], now = new Date()) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return names.map((day, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { day, date: localDay(date), cigarettes: totalOnDay(entries, date) };
  });
}
export function monthlyTrend(entries: TrackingEntry[], now = new Date()) {
  const last = now.getDate(); // Future unobserved days must not dilute the average.
  const result = [];
  for (let start = 1; start <= last; start += 7) {
    const end = Math.min(start + 6, last);
    let total = 0;
    for (let day = start; day <= end; day++) total += totalOnDay(entries, new Date(now.getFullYear(), now.getMonth(), day));
    result.push({ week: result.length + 1, average: total / (end - start + 1), startDate: localDay(new Date(now.getFullYear(), now.getMonth(), start)), endDate: localDay(new Date(now.getFullYear(), now.getMonth(), end)) });
  }
  return result;
}
export function completedSmokeFreeDays(entries: TrackingEntry[], startDate: string, consecutive: boolean, now = new Date()): number {
  const start = new Date(startDate);
  if (!Number.isFinite(start.getTime())) return 0;
  // Only whole days after the goal was started qualify; today is still in progress.
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  let count = 0;
  for (; day >= first; day.setDate(day.getDate() - 1)) {
    const key = localDay(day);
    const confirmed = entries.some(entry => isSmokeFreeCheckin(entry) && localDay(new Date(entry.date)) === key);
    if (confirmed && totalOnDay(entries, day) === 0) count++;
    else if (consecutive) break;
  }
  return count;
}
