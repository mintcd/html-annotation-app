/** Collection queries are bounded; follow every keyset cursor for app-wide lists. */
export const SYNC_QUERY_PAGE_SIZE = 256;

export interface PagedSyncQuery<Row, Cursor> {
  limit(limit: number): PagedSyncQuery<Row, Cursor>;
  cursor(cursor: Cursor): PagedSyncQuery<Row, Cursor>;
  execute(): Promise<{ readonly rows: readonly Row[]; readonly nextCursor?: Cursor }>;
}

export async function collectSyncRows<Row, Cursor>(
  query: PagedSyncQuery<Row, Cursor>,
): Promise<Row[]> {
  const bounded = query.limit(SYNC_QUERY_PAGE_SIZE);
  const rows: Row[] = [];
  let page = await bounded.execute();
  rows.push(...page.rows);

  while (page.nextCursor !== undefined) {
    page = await bounded.cursor(page.nextCursor).execute();
    rows.push(...page.rows);
  }

  return rows;
}
