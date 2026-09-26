/** Read the whole index in primary-key order. A fixed limit or offset page can
 * silently omit candidates once the database grows or rows change mid-read.
 */
export async function readSearchIndexPages<T extends { candidate_id: unknown }>(
  fetchPage: (
    afterId: string | null,
    pageSize: number,
  ) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000)
    throw new Error("Invalid search index page size");
  const rows: T[] = [];
  let afterId: string | null = null;
  for (;;) {
    const response = await fetchPage(afterId, pageSize);
    if (response.error)
      throw new Error(
        "Candidate search index query failed: " + response.error.message,
      );
    const page = response.data || [];
    if (page.length > pageSize)
      throw new Error("Candidate search index page exceeded its limit");
    for (const row of page) {
      const id = String(row.candidate_id || "");
      if (!id || (afterId !== null && id <= afterId))
        throw new Error("Candidate search index order is invalid");
      rows.push(row);
      afterId = id;
    }
    if (page.length < pageSize) return rows;
  }
}
