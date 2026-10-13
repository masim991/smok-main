// Do not treat a backend's default row limit as a complete account snapshot.
export async function fetchAllRows<T extends { id: string }>(fetchPage: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (;;) {
    const { data, error } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error || data == null) throw new Error('원격 데이터 전체를 읽지 못했습니다.');
    if (data.length === 0) return rows;
    for (const row of data) {
      if (seen.has(row.id)) throw new Error('원격 조회 중 데이터가 변경되었습니다. 다시 동기화합니다.');
      seen.add(row.id); rows.push(row);
    }
    // Continue even when the server caps a page below the requested pageSize.
  }
}
