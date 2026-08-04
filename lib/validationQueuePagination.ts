export function parseValidationQueuePagination(searchParams: URLSearchParams) {
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawPageSize = Number(searchParams.get("pageSize") ?? searchParams.get("limit") ?? "25");
  const page = Math.max(Number.isFinite(rawPage) ? Math.floor(rawPage) : 1, 1);
  const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize) ? Math.floor(rawPageSize) : 25, 1), 100);
  return { page, pageSize };
}

export function paginateValidationQueueItems<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);
  return {
    paginatedItems,
    totalPages: Math.ceil(items.length / pageSize),
  };
}
